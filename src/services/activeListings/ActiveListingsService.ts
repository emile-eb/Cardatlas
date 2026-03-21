import { normalizeActiveListings } from "@/services/activeListings/normalization";
import { ebayActiveListingsProvider } from "@/services/activeListings/providers/EbayActiveListingsProvider";
import { mockActiveListingsProvider } from "@/services/activeListings/providers/MockActiveListingsProvider";
import type { ActiveListingsResponse, ActiveListing, UUID } from "@/types";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import {
  applyOutlierFilteringToListings,
  getFilteredActiveListingsSegments,
  getVisibleActiveListings,
  groupActiveListingsBySegment
} from "@/services/activeListings/classification";

function providerMode(): "mock" | "ebay" {
  const value = String(process.env.EXPO_PUBLIC_ACTIVE_LISTINGS_PROVIDER ?? "mock").toLowerCase().trim();
  return value === "ebay" ? "ebay" : "mock";
}

function summarize(listings: ActiveListing[]) {
  const prices = listings.map((x) => x.price).filter((x) => Number.isFinite(x));
  if (!prices.length) {
    return {
      averageActivePrice: 0,
      lowestActivePrice: 0,
      highestActivePrice: 0,
      listingCount: 0
    };
  }
  const total = prices.reduce((sum, value) => sum + value, 0);
  return {
    averageActivePrice: total / prices.length,
    lowestActivePrice: Math.min(...prices),
    highestActivePrice: Math.max(...prices),
    listingCount: prices.length
  };
}

function responseFrom(
  cardId: UUID,
  listings: ActiveListing[],
  source: "mock" | "ebay",
  usedFallback: boolean,
  referenceValue?: number
): ActiveListingsResponse {
  const preparedListings = applyOutlierFilteringToListings(listings, referenceValue);
  const segments = groupActiveListingsBySegment(preparedListings);
  const filteredSegments = getFilteredActiveListingsSegments(segments);
  const visibleListings = getVisibleActiveListings(filteredSegments);
  return {
    cardId,
    listings: preparedListings,
    segments,
    filteredSegments,
    summary: summarize(visibleListings),
    usedFallback,
    stale: false,
    refreshStatus: usedFallback ? "fallback" : "fresh",
    source
  };
}

export interface ActiveListingsService {
  getDisplayActiveListings(cardId: UUID, options?: { referenceValue?: number; maxItems?: number }): Promise<ActiveListingsResponse>;
}

class ActiveListingsServiceImpl implements ActiveListingsService {
  async getDisplayActiveListings(cardId: UUID, options?: { referenceValue?: number; maxItems?: number }): Promise<ActiveListingsResponse> {
    try {
      const selected = providerMode() === "ebay" ? ebayActiveListingsProvider : mockActiveListingsProvider;
      const result = await selected.getActiveListings(cardId, options);
      const normalized = normalizeActiveListings(result.items, result.usedMock);
      return responseFrom(cardId, normalized, result.provider, result.usedMock, options?.referenceValue);
    } catch (error) {
      const fallback = await mockActiveListingsProvider.getActiveListings(cardId, options);
      const normalized = normalizeActiveListings(fallback.items, true);
      analyticsService.track(ANALYTICS_EVENTS.providerFallbackUsed, {
        surface: "active_market",
        provider: providerMode(),
        cardId,
        reason: error instanceof Error ? error.message : "active_listings_unavailable"
      });
      if (__DEV__) {
        console.log("[active_market] fallback_used", {
          cardId,
          provider: providerMode(),
          error
        });
      }
      return {
        ...responseFrom(cardId, normalized, "mock", true, options?.referenceValue),
        error: error instanceof Error ? error.message : "Active listings unavailable"
      };
    }
  }
}

export const activeListingsService: ActiveListingsService = new ActiveListingsServiceImpl();
