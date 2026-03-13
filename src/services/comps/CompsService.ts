import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { CardSale, RecentSalesResponse, UUID } from "@/types";

const STALE_AFTER_HOURS = 48;
const LOCAL_CACHE_TTL_MS = 60 * 1000;

type CacheEntry = {
  value: RecentSalesResponse;
  cachedAt: number;
};

const cache = new Map<string, CacheEntry>();

function toCardSale(row: any): CardSale {
  return {
    id: row.id,
    cardId: row.card_id,
    source: row.source,
    sourceListingId: row.source_listing_id,
    title: row.title,
    price: Number(row.price ?? 0),
    currency: row.currency ?? "USD",
    saleDate: row.sale_date,
    condition: row.condition,
    grade: row.grade,
    url: row.url,
    rawPayload: row.raw_payload ?? null,
    normalizedConfidence: row.normalized_confidence ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function readCache(cardId: string): RecentSalesResponse | null {
  const hit = cache.get(cardId);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > LOCAL_CACHE_TTL_MS) {
    cache.delete(cardId);
    return null;
  }
  return hit.value;
}

function writeCache(cardId: string, value: RecentSalesResponse) {
  cache.set(cardId, { value, cachedAt: Date.now() });
}

function debugLog(label: string, data: Record<string, unknown>) {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[comps] ${label}`, data);
  }
}

function isStale(sales: CardSale[]): boolean {
  if (!sales.length) return true;
  const newest = sales[0];
  const ageHours = (Date.now() - Date.parse(newest.saleDate)) / (1000 * 60 * 60);
  return ageHours >= STALE_AFTER_HOURS;
}

function buildDemoSales(cardId: string, referenceValue?: number): CardSale[] {
  const base = Number(referenceValue ?? 0);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 150;
  const rows: CardSale[] = [];

  for (let i = 0; i < 4; i += 1) {
    const jitter = (((cardId.charCodeAt(i % cardId.length) || 31) * (i + 7)) % 17 - 8) / 100;
    const price = Number((safeBase * (1 + jitter)).toFixed(2));
    const saleDate = new Date(Date.now() - (i + 1) * 86400000).toISOString();
    rows.push({
      id: `demo-${cardId}-${i}`,
      cardId,
      source: "demo_market",
      sourceListingId: `demo-${cardId}-${i}`,
      title: "Market Estimate Sale",
      price,
      currency: "USD",
      saleDate,
      condition: i % 2 === 0 ? "Near Mint" : "Ungraded",
      grade: null,
      url: null,
      rawPayload: { demo: true },
      normalizedConfidence: "medium",
      createdAt: saleDate,
      updatedAt: saleDate
    });
  }

  return rows;
}

export interface CompsService {
  getRecentSales(cardId: UUID, maxItems?: number): Promise<CardSale[]>;
  refreshRecentSales(cardId: UUID, options?: { forceRefresh?: boolean; maxItems?: number }): Promise<RecentSalesResponse>;
  maybeRefreshRecentSales(cardId: UUID, options?: { maxItems?: number }): Promise<RecentSalesResponse>;
  getDisplayRecentSales(cardId: UUID, options?: { referenceValue?: number; maxItems?: number }): Promise<RecentSalesResponse>;
}

class CompsServiceImpl implements CompsService {
  async getRecentSales(cardId: UUID, maxItems = 5): Promise<CardSale[]> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("card_sales")
      .select("id,card_id,source,source_listing_id,title,price,currency,sale_date,condition,grade,url,raw_payload,normalized_confidence,created_at,updated_at")
      .eq("card_id", cardId)
      .order("sale_date", { ascending: false })
      .limit(maxItems);

    if (error) throw error;
    return (data ?? []).map(toCardSale);
  }

  async refreshRecentSales(cardId: UUID, options?: { forceRefresh?: boolean; maxItems?: number }): Promise<RecentSalesResponse> {
    const supabase = await getRequiredSupabaseClient();
    const maxItems = options?.maxItems ?? 5;

    const { data, error } = await supabase.functions.invoke("card-comps", {
      body: {
        action: "get_recent_sales",
        cardId,
        forceRefresh: Boolean(options?.forceRefresh),
        maxItems
      }
    });

    if (error) {
      debugLog("refresh_fallback_invoke_error", { cardId, message: error.message ?? "invoke_failed" });
      return {
        cardId,
        refreshStatus: "fallback",
        stale: false,
        usedFallback: true,
        sales: buildDemoSales(cardId),
        debug: {
          reason: error.message ?? "card-comps invoke failed"
        }
      };
    }

    const response = data as RecentSalesResponse;
    if (!response?.ok) {
      debugLog("refresh_fallback_response_error", { cardId, error: response?.error ?? "unknown" });
      return {
        cardId,
        refreshStatus: "fallback",
        stale: false,
        usedFallback: true,
        sales: buildDemoSales(cardId),
        debug: {
          reason: response?.error ?? "card-comps returned failure"
        }
      };
    }

    const mapped: RecentSalesResponse = {
      ...response,
      sales: (response.sales ?? []).map((row: any) => toCardSale(row))
    };

    if (!mapped.sales.length) {
      mapped.sales = buildDemoSales(cardId);
      mapped.usedFallback = true;
      mapped.refreshStatus = "fallback";
      mapped.debug = {
        ...(mapped.debug ?? {}),
        reason: mapped.debug?.reason ?? "no_sales_returned"
      };
    }

    debugLog("refresh_success", {
      cardId,
      refreshStatus: mapped.refreshStatus,
      usedFallback: mapped.usedFallback,
      count: mapped.sales.length,
      debug: mapped.debug ?? null
    });

    writeCache(cardId, mapped);
    return mapped;
  }

  async maybeRefreshRecentSales(cardId: UUID, options?: { maxItems?: number }): Promise<RecentSalesResponse> {
    const cached = readCache(cardId);
    if (cached && !cached.stale) return cached;

    const existing = await this.getRecentSales(cardId, options?.maxItems ?? 5);
    const existingIsStale = isStale(existing);
    if (existing.length && !existingIsStale) {
      const fresh: RecentSalesResponse = {
        cardId,
        refreshStatus: "fresh",
        stale: false,
        usedFallback: existing.some((sale) => sale.source === "demo_market"),
        sales: existing
      };
      writeCache(cardId, fresh);
      return fresh;
    }

    if (existing.length && existingIsStale) {
      const staleResponse: RecentSalesResponse = {
        cardId,
        refreshStatus: "fresh",
        stale: true,
        usedFallback: existing.some((sale) => sale.source === "demo_market"),
        sales: existing
      };
      writeCache(cardId, staleResponse);
      void this.refreshRecentSales(cardId, {
        forceRefresh: true,
        maxItems: options?.maxItems ?? 5
      });
      debugLog("serving_stale_and_refreshing_background", { cardId, count: existing.length });
      return staleResponse;
    }

    return this.refreshRecentSales(cardId, {
      forceRefresh: !existing.length,
      maxItems: options?.maxItems ?? 5
    });
  }

  async getDisplayRecentSales(cardId: UUID, options?: { referenceValue?: number; maxItems?: number }): Promise<RecentSalesResponse> {
    try {
      const response = await this.maybeRefreshRecentSales(cardId, {
        maxItems: options?.maxItems ?? 5
      });
      if (response.sales.length) return response;

      return {
        cardId,
        refreshStatus: "fallback",
        stale: false,
        usedFallback: true,
        sales: buildDemoSales(cardId, options?.referenceValue),
        debug: {
          reason: "empty_after_refresh"
        }
      };
    } catch (error) {
      return {
        cardId,
        refreshStatus: "fallback",
        stale: false,
        usedFallback: true,
        sales: buildDemoSales(cardId, options?.referenceValue),
        debug: {
          reason: error instanceof Error ? error.message : "unexpected_comps_error"
        }
      };
    }
  }
}

export const compsService: CompsService = new CompsServiceImpl();

