import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import { normalizeProviderListings } from "@/services/marketPulse/normalization";
import type { MarketPulseProvider } from "@/services/marketPulse/providers/MarketPulseProvider";
import { ebayMarketPulseProvider } from "@/services/marketPulse/providers/EbayMarketPulseProvider";
import { mockMarketPulseProvider } from "@/services/marketPulse/providers/MockMarketPulseProvider";
import type { MarketPulseFeedResponse, MarketPulseItem, MarketPulseRefreshResult } from "@/types/marketPulse";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";

const DEFAULT_LIMIT = 20;
const DEFAULT_QUERY = "trending sports cards";
const DEFAULT_MARKETPLACE_ID = "EBAY_US";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function modeFromEnv(): "mock" | "ebay" {
  const raw = String(process.env.EXPO_PUBLIC_MARKET_PULSE_PROVIDER ?? "mock").toLowerCase().trim();
  return raw === "ebay" ? "ebay" : "mock";
}

function mapRowToItem(row: any): MarketPulseItem {
  return {
    id: row.id,
    source: row.source,
    sourceListingId: row.source_listing_id ?? null,
    title: row.title,
    subtitle: row.subtitle ?? null,
    imageUrl: row.image_url ?? null,
    itemWebUrl: row.item_web_url ?? null,
    price: row.price != null ? Number(row.price) : null,
    currency: row.currency ?? "USD",
    itemOriginDate: row.item_origin_date ?? null,
    buyingOptions: row.buying_options ?? null,
    marketplaceId: row.marketplace_id ?? null,
    cardId: row.card_id ?? null,
    sport: row.sport ?? null,
    playerName: row.player_name ?? null,
    team: row.team ?? null,
    pulseReason: row.pulse_reason ?? null,
    isMock: Boolean(row.is_mock),
    sortOrder: row.sort_order ?? null,
    rawPayload: row.raw_payload ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isStale(items: MarketPulseItem[]): boolean {
  if (!items.length) return true;
  const latestTs = Math.max(...items.map((item) => Date.parse(item.updatedAt || item.createdAt || "")));
  if (!Number.isFinite(latestTs)) return true;
  return Date.now() - latestTs >= REFRESH_INTERVAL_MS;
}

export interface MarketPulseService {
  shouldRefreshMarketPulse(items: MarketPulseItem[]): boolean;
  refreshMarketPulse(limit?: number): Promise<MarketPulseRefreshResult>;
  getMarketPulseFeed(limit?: number): Promise<MarketPulseFeedResponse>;
}

class MarketPulseServiceImpl implements MarketPulseService {
  private refreshPromise: Promise<MarketPulseRefreshResult> | null = null;
  private volatileItems: MarketPulseItem[] = [];

  private selectProvider(): MarketPulseProvider {
    return modeFromEnv() === "ebay" ? ebayMarketPulseProvider : mockMarketPulseProvider;
  }

  shouldRefreshMarketPulse(items: MarketPulseItem[]): boolean {
    return isStale(items);
  }

  private async listCached(limit = DEFAULT_LIMIT): Promise<MarketPulseItem[]> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("market_pulse_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("item_origin_date", { ascending: false })
      .limit(limit);

    if (error) {
      if (__DEV__) console.log("[market_pulse] list cache failed", error.message);
      return [];
    }
    return (data ?? []).map(mapRowToItem);
  }

  private async writeListings(rows: any[]): Promise<number> {
    if (!rows.length) return 0;
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("market_pulse_items")
      .upsert(rows, { onConflict: "source,source_listing_id" })
      .select("id");
    if (error) throw error;
    return Array.isArray(data) ? data.length : rows.length;
  }

  private setVolatileFromRows(rows: any[]) {
    const timestamp = nowIso();
    this.volatileItems = rows.map((row, index) =>
      mapRowToItem({
        id: row.source_listing_id || `${row.source}-${index}`,
        source: row.source,
        source_listing_id: row.source_listing_id,
        title: row.title,
        subtitle: row.subtitle,
        image_url: row.image_url,
        item_web_url: row.item_web_url,
        price: row.price,
        currency: row.currency,
        item_origin_date: row.item_origin_date,
        buying_options: row.buying_options,
        marketplace_id: row.marketplace_id,
        card_id: row.card_id,
        sport: row.sport,
        player_name: row.player_name,
        team: row.team,
        pulse_reason: row.pulse_reason,
        is_mock: row.is_mock,
        sort_order: row.sort_order,
        raw_payload: row.raw_payload,
        created_at: timestamp,
        updated_at: timestamp
      })
    );
  }

  async refreshMarketPulse(limit = DEFAULT_LIMIT): Promise<MarketPulseRefreshResult> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const selected = this.selectProvider();
      try {
        const provided = await selected.fetchLatestListings({
          limit,
          query: DEFAULT_QUERY,
          marketplaceId: DEFAULT_MARKETPLACE_ID
        });
        const normalized = normalizeProviderListings(provided.listings);
        this.setVolatileFromRows(normalized);
        let itemsWritten = 0;
        try {
          itemsWritten = await this.writeListings(normalized);
        } catch (writeError) {
          if (__DEV__) console.log("[market_pulse] write failed, using volatile cache", writeError);
          itemsWritten = normalized.length;
        }
        return {
          source: provided.source,
          isMock: provided.isMock,
          itemsWritten,
          refreshedAt: nowIso()
        };
      } catch (primaryError) {
        if (__DEV__) console.log("[market_pulse] primary provider failed", primaryError);
        analyticsService.track(ANALYTICS_EVENTS.providerFallbackUsed, {
          surface: "market_pulse",
          provider: modeFromEnv(),
          reason: primaryError instanceof Error ? primaryError.message : "provider_unavailable"
        });

        const fallback = await mockMarketPulseProvider.fetchLatestListings({
          limit,
          query: DEFAULT_QUERY,
          marketplaceId: DEFAULT_MARKETPLACE_ID
        });
        const normalizedFallback = normalizeProviderListings(fallback.listings);
        this.setVolatileFromRows(normalizedFallback);
        let itemsWritten = 0;
        try {
          itemsWritten = await this.writeListings(normalizedFallback);
        } catch (writeError) {
          if (__DEV__) console.log("[market_pulse] fallback write failed, using volatile cache", writeError);
          itemsWritten = normalizedFallback.length;
        }
        return {
          source: "mock",
          isMock: true,
          itemsWritten,
          refreshedAt: nowIso(),
          errorMessage: primaryError instanceof Error ? primaryError.message : "Provider unavailable"
        };
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async getMarketPulseFeed(limit = DEFAULT_LIMIT): Promise<MarketPulseFeedResponse> {
    const cached = await this.listCached(limit);

    if (!cached.length) {
      const refreshed = await this.refreshMarketPulse(limit);
      const seeded = await this.listCached(limit);
      const items = seeded.length ? seeded : this.volatileItems.slice(0, limit);
      return {
        items,
        source: refreshed.source,
        isMock: refreshed.isMock,
        refreshedAt: refreshed.refreshedAt,
        didTriggerBackgroundRefresh: false,
        errorMessage: refreshed.errorMessage ?? null
      };
    }

    const stale = this.shouldRefreshMarketPulse(cached);
    if (stale) {
      void this.refreshMarketPulse(limit);
    }

    return {
      items: cached,
      source: cached.some((item) => !item.isMock) ? "ebay" : "mock",
      isMock: cached.every((item) => item.isMock),
      refreshedAt: cached[0]?.updatedAt ?? cached[0]?.createdAt ?? null,
      didTriggerBackgroundRefresh: stale,
      errorMessage: null
    };
  }
}

export const marketPulseService: MarketPulseService = new MarketPulseServiceImpl();
