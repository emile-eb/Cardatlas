// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { clean, ensureTrackedCard, getUserIdByAuth, userCanAccessCard } from "../_shared/trackedCards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

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

function shouldDebugLog(): boolean {
  return !Deno.env.get("DENO_DEPLOYMENT_ID");
}

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!shouldDebugLog()) return;
  console.log(`[ensure-card-tracking] ${label}`, payload);
}

Deno.serve(async (req) => {
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

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const userId = await getUserIdByAuth(service, userData.user.id);
    const body = await req.json().catch(() => ({}));
    const cardId = clean(body?.cardId);
    if (!cardId) {
      return json({ ok: false, error: "cardId is required." }, { status: 400 });
    }

    const hasAccess = await userCanAccessCard(service, userId, cardId);
    if (!hasAccess) {
      return json({ ok: false, error: "Card not accessible to this user." }, { status: 403 });
    }

    const result = await ensureTrackedCard(service, cardId, "scan_auto");
    debugLog("ensured", { cardId, action: result.action, userId });
    return json({ ok: true, cardId, action: result.action }, { status: 200 });
  } catch (error) {
    debugLog("failed", { reason: error instanceof Error ? error.message : String(error) });
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
