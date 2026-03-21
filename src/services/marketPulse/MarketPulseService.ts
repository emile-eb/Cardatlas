import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import { normalizeProviderListings } from "@/services/marketPulse/normalization";
import type { MarketPulseProvider } from "@/services/marketPulse/providers/MarketPulseProvider";
import { ebayMarketPulseProvider } from "@/services/marketPulse/providers/EbayMarketPulseProvider";
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
  const raw = String(process.env.EXPO_PUBLIC_MARKET_PULSE_PROVIDER ?? "ebay").toLowerCase().trim();
  return raw === "mock" ? "ebay" : "ebay";
}

function mapRowToItem(row: any): MarketPulseItem {
  const rawPayload = row.raw_payload ?? null;
  const cardIdentity = rawPayload?.cardIdentity ?? {};
  const marketContext = rawPayload?.marketContext ?? {};
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
    year: Number(cardIdentity.year ?? 0) || null,
    brand: cardIdentity.brand ?? null,
    setName: cardIdentity.setName ?? null,
    cardNumber: cardIdentity.cardNumber ?? null,
    sport: row.sport ?? null,
    playerName: row.player_name ?? null,
    team: row.team ?? null,
    referenceValue: marketContext.referenceValue != null ? Number(marketContext.referenceValue) : null,
    activeMarketAverageAsk: marketContext.activeMarketAverageAsk != null ? Number(marketContext.activeMarketAverageAsk) : null,
    lowestAsk: marketContext.lowestAsk != null ? Number(marketContext.lowestAsk) : null,
    listingCount: marketContext.listingCount != null ? Number(marketContext.listingCount) : null,
    pulseReason: row.pulse_reason ?? null,
    signalStrengthScore: marketContext.pulseScore != null ? Number(marketContext.pulseScore) : null,
    lastRefreshedAt: marketContext.refreshedAt ?? row.updated_at ?? row.created_at ?? null,
    isMock: Boolean(row.is_mock),
    sortOrder: row.sort_order ?? null,
    rawPayload,
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

function shouldReplaceMockCache(items: MarketPulseItem[]): boolean {
  return modeFromEnv() === "ebay" && items.length > 0 && items.every((item) => item.isMock);
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
    return ebayMarketPulseProvider;
  }

  shouldRefreshMarketPulse(items: MarketPulseItem[]): boolean {
    return isStale(items) || shouldReplaceMockCache(items);
  }

  private async listCached(limit = DEFAULT_LIMIT): Promise<MarketPulseItem[]> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("market_pulse_items")
      .select("*")
      .order("updated_at", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("item_origin_date", { ascending: false })
      .limit(limit * 3);

    if (error) {
      if (__DEV__) console.log("[market_pulse] list cache failed", error.message);
      return [];
    }

    const rows = data ?? [];
    const realFeed = rows.filter((row: any) => row.source === "cardatlas_pulse");
    const selectedRows = realFeed.length ? realFeed : rows.filter((row: any) => !row.is_mock);

    return selectedRows.slice(0, limit).map(mapRowToItem);
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
      analyticsService.track(ANALYTICS_EVENTS.marketPulseRefreshStarted, {
        provider: selected.providerId,
        limit
      });
      try {
        const provided = await selected.fetchLatestListings({
          limit,
          query: DEFAULT_QUERY,
          marketplaceId: DEFAULT_MARKETPLACE_ID
        });
        const normalized = normalizeProviderListings(provided.listings);
        this.setVolatileFromRows(normalized);
        const itemsWritten = provided.itemsWritten ?? normalized.length;
        analyticsService.track(ANALYTICS_EVENTS.marketPulseRefreshCompleted, {
          provider: provided.source,
          isMock: provided.isMock,
          itemsWritten
        });
        analyticsService.track(ANALYTICS_EVENTS.marketPulseItemCount, {
          provider: provided.source,
          count: normalized.length,
          isMock: provided.isMock
        });
        return {
          source: provided.source,
          isMock: provided.isMock,
          itemsWritten,
          refreshedAt: provided.refreshedAt ?? nowIso(),
          errorMessage: provided.errorMessage ?? null
        };
      } catch (primaryError) {
        if (__DEV__) console.log("[market_pulse] primary provider failed", primaryError);
        throw primaryError;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise.catch((error) => {
      analyticsService.track(ANALYTICS_EVENTS.marketPulseRefreshFailed, {
        reason: error instanceof Error ? error.message : "unknown_error"
      });
      throw error;
    });
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

    const needsRefresh = this.shouldRefreshMarketPulse(cached);
    if (needsRefresh) {
      void this.refreshMarketPulse(limit);
    }

    return {
      items: cached,
      source: cached.some((item) => !item.isMock) ? "ebay" : "mock",
      isMock: cached.every((item) => item.isMock),
      refreshedAt: cached[0]?.updatedAt ?? cached[0]?.createdAt ?? null,
      didTriggerBackgroundRefresh: needsRefresh,
      errorMessage: null
    };
  }
}

export const marketPulseService: MarketPulseService = new MarketPulseServiceImpl();
