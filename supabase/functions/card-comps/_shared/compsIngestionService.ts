// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { isNormalizationUsable, normalizeCompResults } from "./normalization.ts";
import { createFallbackCompsProvider, createRealCompsProvider } from "./providers.ts";
import type { CardCompsRequestBody, CardSaleRow, CompNormalizationResult, NormalizedCardIdentity, RecentSalesResponse } from "./types.ts";

const DEFAULT_MAX_ITEMS = 5;
const DEFAULT_STALE_HOURS = 48;
const DEBUG_COMPS = (Deno.env.get("COMPS_DEBUG") ?? "").toLowerCase() === "true" || !Deno.env.get("DENO_DEPLOYMENT_ID");

function nowIso() {
  return new Date().toISOString();
}

function toRow(data: any): CardSaleRow {
  return {
    id: data.id,
    card_id: data.card_id,
    source: data.source,
    source_listing_id: data.source_listing_id,
    title: data.title,
    price: Number(data.price ?? 0),
    currency: data.currency ?? "USD",
    sale_date: data.sale_date,
    condition: data.condition,
    grade: data.grade,
    url: data.url,
    raw_payload: data.raw_payload,
    normalized_confidence: data.normalized_confidence,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
}

function hoursSince(iso: string): number {
  return (Date.now() - Date.parse(iso)) / (1000 * 60 * 60);
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    return [err.code, err.message, err.details].filter(Boolean).map(String).join(" | ") || "Unknown comps error";
  }
  return "Unknown comps error";
}

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!DEBUG_COMPS) return;
  console.log(`[card-comps] ${label}`, payload);
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

async function loadIdentity(service: any, cardId: string): Promise<NormalizedCardIdentity> {
  const [cardRes, valuationRes] = await Promise.all([
    service
      .from("cards")
      .select("id,sport,player_name,card_title,year,brand,set_name,card_number,team")
      .eq("id", cardId)
      .single(),
    service
      .from("valuation_snapshots")
      .select("reference_value,currency,fetched_at")
      .eq("card_id", cardId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (cardRes.error) throw cardRes.error;
  if (valuationRes.error) throw valuationRes.error;

  return {
    cardId,
    sport: cardRes.data.sport ?? null,
    playerName: cardRes.data.player_name,
    cardTitle: cardRes.data.card_title,
    year: cardRes.data.year ?? null,
    brand: cardRes.data.brand ?? null,
    setName: cardRes.data.set_name ?? null,
    cardNumber: cardRes.data.card_number ?? null,
    team: cardRes.data.team ?? null,
    referenceValue: Number(valuationRes.data?.reference_value ?? 0),
    currency: valuationRes.data?.currency ?? "USD"
  };
}

async function readRecentSales(service: any, cardId: string, maxItems: number): Promise<CardSaleRow[]> {
  const { data, error } = await service
    .from("card_sales")
    .select("id,card_id,source,source_listing_id,title,price,currency,sale_date,condition,grade,url,raw_payload,normalized_confidence,created_at,updated_at")
    .eq("card_id", cardId)
    .order("sale_date", { ascending: false })
    .limit(Math.max(maxItems, 5));

  if (error) throw error;
  return (data ?? []).map(toRow);
}

async function persistNormalizedRows(service: any, cardId: string, rows: CompNormalizationResult[]): Promise<number> {
  if (!rows.length) return 0;

  const withListing = rows.filter((r) => Boolean(r.sourceListingId));
  const withoutListing = rows.filter((r) => !r.sourceListingId);
  let persisted = 0;

  if (withListing.length) {
    const payload = withListing.map((row) => ({
      card_id: cardId,
      source: row.source,
      source_listing_id: row.sourceListingId,
      title: row.title,
      price: row.price,
      currency: row.currency,
      sale_date: row.saleDate,
      condition: row.condition,
      grade: row.grade,
      url: row.url,
      raw_payload: row.rawPayload,
      normalized_confidence: row.normalizedConfidence,
      updated_at: nowIso()
    }));

    const { error } = await service.from("card_sales").upsert(payload, {
      onConflict: "source,source_listing_id"
    });
    if (error) throw error;
    persisted += payload.length;
  }

  if (withoutListing.length) {
    const rowsWithUrl = withoutListing.filter((row) => Boolean(row.url));
    const rowsWithoutUrl = withoutListing.filter((row) => !row.url);

    const existingKeys = new Set<string>();
    if (rowsWithUrl.length) {
      const urls = Array.from(new Set(rowsWithUrl.map((row) => row.url)));
      const { data: existingUrlRows, error: existingUrlError } = await service
        .from("card_sales")
        .select("source,url")
        .eq("card_id", cardId)
        .in("url", urls);
      if (existingUrlError) throw existingUrlError;
      for (const row of existingUrlRows ?? []) {
        existingKeys.add(`${row.source}|${row.url}`);
      }
    }

    const dedupedWithoutListing = [
      ...rowsWithUrl.filter((row) => !existingKeys.has(`${row.source}|${row.url}`)),
      ...rowsWithoutUrl
    ];

    const payload = dedupedWithoutListing.map((row) => ({
      card_id: cardId,
      source: row.source,
      source_listing_id: null,
      title: row.title,
      price: row.price,
      currency: row.currency,
      sale_date: row.saleDate,
      condition: row.condition,
      grade: row.grade,
      url: row.url,
      raw_payload: row.rawPayload,
      normalized_confidence: row.normalizedConfidence,
      updated_at: nowIso()
    }));
    if (payload.length) {
      const { error } = await service.from("card_sales").insert(payload);
      if (error) throw error;
      persisted += payload.length;
    }
  }

  return persisted;
}

async function ingestAndPersist(service: any, identity: NormalizedCardIdentity): Promise<{ usedFallback: boolean; accepted: number; persisted: number; provider: string; reason?: string }> {
  const realProvider = createRealCompsProvider();
  const fallbackProvider = createFallbackCompsProvider();

  try {
    const realRaw = await realProvider.fetchRecentSalesForCard(identity);
    const normalized = normalizeCompResults(realRaw.items);
    debugLog("normalized_real", {
      cardId: identity.cardId,
      provider: realRaw.provider,
      rawCount: realRaw.rawCount,
      normalizedCount: normalized.length
    });
    if (isNormalizationUsable(normalized)) {
      const persisted = await persistNormalizedRows(service, identity.cardId, normalized);
      return {
        usedFallback: false,
        accepted: normalized.length,
        persisted,
        provider: realProvider.providerName
      };
    }

    const fallbackRaw = await fallbackProvider.fetchRecentSalesForCard(identity);
    const fallbackNormalized = normalizeCompResults(fallbackRaw.items);
    debugLog("normalized_fallback_after_weak_real", {
      cardId: identity.cardId,
      rawCount: fallbackRaw.rawCount,
      normalizedCount: fallbackNormalized.length
    });
    const persisted = await persistNormalizedRows(service, identity.cardId, fallbackNormalized);
    return {
      usedFallback: true,
      accepted: fallbackNormalized.length,
      persisted,
      provider: fallbackProvider.providerName,
      reason: "real_results_not_usable"
    };
  } catch (error) {
    const fallbackRaw = await fallbackProvider.fetchRecentSalesForCard(identity);
    const fallbackNormalized = normalizeCompResults(fallbackRaw.items);
    debugLog("normalized_fallback_after_error", {
      cardId: identity.cardId,
      reason: formatError(error),
      rawCount: fallbackRaw.rawCount,
      normalizedCount: fallbackNormalized.length
    });
    const persisted = await persistNormalizedRows(service, identity.cardId, fallbackNormalized);
    return {
      usedFallback: true,
      accepted: fallbackNormalized.length,
      persisted,
      provider: fallbackProvider.providerName,
      reason: formatError(error)
    };
  }
}

async function getRecentSalesForCard(service: any, params: {
  authUserId: string;
  cardId: string;
  forceRefresh: boolean;
  maxItems: number;
  staleAfterHours: number;
}): Promise<RecentSalesResponse> {
  const userId = await getUserIdByAuth(service, params.authUserId);
  const hasAccess = await userCanAccessCard(service, userId, params.cardId);
  if (!hasAccess) {
    return {
      ok: false,
      cardId: params.cardId,
      refreshStatus: "error",
      stale: false,
      usedFallback: false,
      sales: [],
      error: "Card not found or not accessible for this user."
    };
  }

  const identity = await loadIdentity(service, params.cardId);

  let existing = await readRecentSales(service, params.cardId, params.maxItems);
  const newest = existing[0];
  const stale = !newest || hoursSince(newest.sale_date) >= params.staleAfterHours;

  if (!params.forceRefresh && existing.length >= params.maxItems && !stale) {
    return {
      ok: true,
      cardId: params.cardId,
      refreshStatus: "fresh",
      stale: false,
      usedFallback: existing.some((row) => row.source === "demo_market"),
      sales: existing.slice(0, params.maxItems)
    };
  }

  const ingest = await ingestAndPersist(service, identity);
  existing = await readRecentSales(service, params.cardId, params.maxItems);

  return {
    ok: true,
    cardId: params.cardId,
    refreshStatus: ingest.usedFallback ? "fallback" : "refreshed",
    stale,
    usedFallback: ingest.usedFallback,
    sales: existing.slice(0, params.maxItems),
    debug: {
      provider: ingest.provider,
      normalizationAccepted: ingest.accepted,
      persisted: ingest.persisted,
      reason: ingest.reason
    }
  };
}

async function refreshRecentCards(service: any, params: {
  authUserId: string;
  cardIds?: string[];
  limit: number;
}): Promise<{ ok: boolean; refreshed: number; fallbackCount: number }> {
  const userId = await getUserIdByAuth(service, params.authUserId);

  let cardIds = (params.cardIds ?? []).filter(Boolean);
  if (!cardIds.length) {
    const { data, error } = await service
      .from("scans")
      .select("card_id")
      .eq("user_id", userId)
      .not("card_id", "is", null)
      .order("scanned_at", { ascending: false })
      .limit(params.limit);
    if (error) throw error;
    cardIds = Array.from(new Set((data ?? []).map((row: any) => row.card_id).filter(Boolean)));
  }

  let refreshed = 0;
  let fallbackCount = 0;

  for (const cardId of cardIds.slice(0, params.limit)) {
    const response = await getRecentSalesForCard(service, {
      authUserId: params.authUserId,
      cardId,
      forceRefresh: true,
      maxItems: 5,
      staleAfterHours: DEFAULT_STALE_HOURS
    });
    if (response.ok) {
      refreshed += 1;
      if (response.usedFallback) fallbackCount += 1;
    }
  }

  return { ok: true, refreshed, fallbackCount };
}

export async function handleCardComps(input: {
  authUserId: string;
  body: CardCompsRequestBody;
}): Promise<RecentSalesResponse | { ok: boolean; refreshed: number; fallbackCount: number; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      cardId: input.body.cardId ?? "",
      refreshStatus: "error",
      stale: false,
      usedFallback: false,
      sales: [],
      error: "Missing Supabase server environment variables."
    };
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const action = input.body.action ?? "get_recent_sales";

  try {
    if (action === "refresh_recent_cards") {
      return await refreshRecentCards(service, {
        authUserId: input.authUserId,
        cardIds: input.body.cardIds,
        limit: Number(input.body.maxItems ?? 20)
      });
    }

    const cardId = String(input.body.cardId ?? "").trim();
    if (!cardId) {
      return {
        ok: false,
        cardId: "",
        refreshStatus: "error",
        stale: false,
        usedFallback: false,
        sales: [],
        error: "cardId is required."
      };
    }

    return await getRecentSalesForCard(service, {
      authUserId: input.authUserId,
      cardId,
      forceRefresh: Boolean(input.body.forceRefresh),
      maxItems: Math.min(Number(input.body.maxItems ?? DEFAULT_MAX_ITEMS), 10),
      staleAfterHours: Number(input.body.staleAfterHours ?? DEFAULT_STALE_HOURS)
    });
  } catch (error) {
    return {
      ok: false,
      cardId: String(input.body.cardId ?? ""),
      refreshStatus: "error",
      stale: false,
      usedFallback: false,
      sales: [],
      error: formatError(error)
    };
  }
}

