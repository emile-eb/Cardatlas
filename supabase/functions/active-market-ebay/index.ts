// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import {
  buildGeneralQuery,
  buildLiveMarketQueryPlans,
  clean,
  loadCardIdentity,
  retrieveAcceptedEbayMarketListings
} from "../_shared/liveMarketRetrieval.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const DEFAULT_FETCH_LIMIT = 12;
const MAX_FETCH_LIMIT = 20;
const DEBUG_CARD_ID = "3d41362f-4033-4cc7-9077-5ef9a7cec50e";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init?.headers ?? {})
    }
  });
}

function normalizeLimit(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_FETCH_LIMIT);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_FETCH_LIMIT;
  return Math.min(Math.max(Math.round(parsed), 1), MAX_FETCH_LIMIT);
}

function shouldDebugLog(): boolean {
  return (Deno.env.get("ACTIVE_MARKET_DEBUG") ?? "").toLowerCase() === "true" || !Deno.env.get("DENO_DEPLOYMENT_ID");
}

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!shouldDebugLog()) return;
  console.log(`[active-market-ebay] ${label}`, payload);
}

function shouldDebugCard(cardId: string, debugEnabled?: boolean): boolean {
  if (debugEnabled) return true;
  const target = clean(Deno.env.get("ACTIVE_MARKET_DEBUG_CARD_ID"));
  return Boolean(target && target === cardId);
}

function logTrace(requestId: string | undefined, label: string, payload: Record<string, unknown>, enabled = true) {
  if (!enabled) return;
  debugLog(label, {
    requestId,
    ...payload
  });
}

function isEbayRateLimitError(stage: string, message: string): boolean {
  return stage === "ebay_fetch" && /\b429\b/.test(message) && /rate limit/i.test(message);
}

async function getUserIdByAuth(service: any, authUserId: string): Promise<string> {
  const { data, error } = await service.from("users").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("User not found for auth identity.");
  return data.id;
}

async function userCanAccessCard(service: any, userId: string, cardId: string): Promise<boolean> {
  const [scanRes, collectionRes] = await Promise.all([
    service.from("scans").select("id").eq("user_id", userId).eq("card_id", cardId).limit(1),
    service.from("collection_items").select("id").eq("user_id", userId).eq("card_id", cardId).limit(1)
  ]);

  if (scanRes.error) throw scanRes.error;
  if (collectionRes.error) throw collectionRes.error;

  return (scanRes.data?.length ?? 0) > 0 || (collectionRes.data?.length ?? 0) > 0;
}

Deno.serve(async (req) => {
  let debugCardId = "";
  let debugRequestId = "";
  let debugEnabled = false;
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, error: "Missing required Supabase server environment variables." }, { status: 500 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return json({ ok: false, error: "Missing bearer token." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      cardId?: string;
      maxItems?: number;
      debug?: { requestId?: string; enabled?: boolean; inspectRejected?: boolean };
    } | null;
    const cardId = clean(body?.cardId);
    if (!cardId) {
      return json({ ok: false, error: "cardId is required." }, { status: 400 });
    }

    debugCardId = cardId;
    debugEnabled = shouldDebugCard(cardId, body?.debug?.enabled === true);
    const debugContext = {
      requestId: clean(body?.debug?.requestId) || `am-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      enabled: debugEnabled,
      inspectRejected: body?.debug?.inspectRejected === true && debugEnabled,
      requestOrigin: clean(String(body?.debug?.requestOrigin ?? "")) || "panel"
    };
    debugRequestId = debugContext.requestId;
    logTrace(debugContext.requestId, "request_start", {
      authResolved: true,
      cardId,
      maxItems: normalizeLimit(body?.maxItems),
      debugEnabled: debugContext.enabled,
      inspectRejected: debugContext.inspectRejected,
      requestOrigin: debugContext.requestOrigin
    }, debugEnabled);

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const userId = await getUserIdByAuth(service, userData.user.id);
    logTrace(debugContext.requestId, "user_resolved", {
      authUserResolved: true,
      appUserIdResolved: true,
      appUserId: userId
    }, debugEnabled);

    const hasAccess = await userCanAccessCard(service, userId, cardId);
    if (!hasAccess) {
      return json({ ok: false, error: "Card not found or not accessible for this user." }, { status: 403 });
    }
    logTrace(debugContext.requestId, "card_access_granted", { cardId, granted: true }, debugEnabled);

    const identity = await loadCardIdentity(service, cardId);
    logTrace(debugContext.requestId, "identity_loaded", { cardId, identity }, debugEnabled);

    let result;
    try {
      result = await retrieveAcceptedEbayMarketListings(identity, {
        limit: normalizeLimit(body?.maxItems),
        debug: {
          ...debugContext,
          onTrace: (label, payload) => logTrace(debugContext.requestId, label, payload, debugEnabled)
        }
      });
    } catch (error) {
      const stage = error instanceof Error && "stage" in error ? String((error as Error & { stage?: string }).stage ?? "unknown") : "unknown";
      const stack = error instanceof Error ? error.stack ?? null : null;
      const message = error instanceof Error ? error.message : "Unexpected live market retrieval error";
      const context =
        error instanceof Error && "context" in error
          ? (error as Error & { context?: Record<string, unknown> }).context ?? null
          : null;
      debugLog("retrieval_failed", {
        requestId: debugContext.requestId,
        cardId,
        stage,
        message,
        stack,
        context
      });
      if (isEbayRateLimitError(stage, message)) {
        logTrace(debugContext.requestId, "ebay_rate_limited", {
          cardId,
          stage,
          message,
          requestOrigin: debugContext.requestOrigin
        }, true);
        return json(
          {
            ok: true,
            provider: "ebay",
            usedMock: false,
            query: buildGeneralQuery(identity),
            queries: buildLiveMarketQueryPlans(identity).map((plan) => ({
              key: plan.key,
              tier: plan.tier,
              targetSegment: plan.targetSegment,
              query: plan.query
            })),
            items: [],
            ...(debugEnabled
              ? {
                  debugError: {
                    requestId: debugContext.requestId,
                    cardId,
                    stage,
                    message,
                    stack,
                    context
                  }
                }
              : {})
          },
          { status: 200 }
        );
      }
      if (debugEnabled) {
        return json(
          {
            ok: false,
            error: message,
            debugError: {
              requestId: debugContext.requestId,
              cardId,
              stage,
              message,
              stack,
              context
            }
          },
          { status: 200 }
        );
      }
      throw error;
    }

    logTrace(debugContext.requestId, "shared_core_summary", {
      cardId,
      requestOrigin: debugContext.requestOrigin,
      acceptedCount: result.counts.acceptedCount,
      rejectedCount: result.counts.rejectedCount,
      totalRawRetrievedCount: result.counts.totalRawRetrievedCount,
      totalDedupedCount: result.counts.totalDedupedCount,
      rejectionCounts: result.counts.rejectionCounts
    }, debugEnabled);

    return json(
      {
        ok: true,
        provider: "ebay",
        usedMock: false,
        query: buildGeneralQuery(identity),
        queries: result.queries,
        items: result.items,
        ...(cardId === DEBUG_CARD_ID && result.debugSummary ? { debugSummary: result.debugSummary } : {})
      },
      { status: 200 }
    );
  } catch (error) {
    debugLog("request_failed", {
      requestId: debugRequestId || undefined,
      cardId: debugCardId || undefined,
      error: error instanceof Error ? error.message : "unknown_error",
      stack: error instanceof Error ? error.stack ?? null : null,
      stage: error instanceof Error && "stage" in error ? String((error as Error & { stage?: string }).stage ?? "unknown") : "unknown"
    });
    if (debugEnabled) {
      return json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Unexpected active market server error",
          debugError: {
            requestId: debugRequestId || null,
            cardId: debugCardId || null,
            stage: error instanceof Error && "stage" in error ? String((error as Error & { stage?: string }).stage ?? "unknown") : "unknown",
            message: error instanceof Error ? error.message : "Unexpected active market server error",
            stack: error instanceof Error ? error.stack ?? null : null
          }
        },
        { status: 200 }
      );
    }
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected active market server error"
      },
      { status: 500 }
    );
  }
});
