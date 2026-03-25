import { normalizeActiveListings } from "@/services/activeListings/normalization";
import { ebayActiveListingsProvider } from "@/services/activeListings/providers/EbayActiveListingsProvider";
import type { ActiveMarketDebugTrace } from "@/services/activeListings/types";
import type { ActiveListingsResponse, ActiveListing, UUID } from "@/types";
import {
  applyOutlierFilteringToListings,
  getFilteredActiveListingsSegments,
  getVisibleActiveListings,
  groupActiveListingsBySegment
} from "@/services/activeListings/classification";

function providerMode(): "mock" | "ebay" {
  const value = String(process.env.EXPO_PUBLIC_ACTIVE_LISTINGS_PROVIDER ?? "mock").toLowerCase().trim();
  return value === "mock" ? "mock" : "ebay";
}

function debugCardTarget(): string | null {
  const value = String(process.env.EXPO_PUBLIC_ACTIVE_MARKET_DEBUG_CARD_ID ?? "3d41362f-4033-4cc7-9077-5ef9a7cec50e").trim();
  return value || null;
}

function createRequestId(prefix = "am"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log(`[active_market_service] ${label}`, payload);
}

function countSegments(listings: ActiveListing[]) {
  return listings.reduce(
    (counts, listing) => {
      counts[listing.marketSegment] += 1;
      return counts;
    },
    { raw: 0, psa9: 0, psa10: 0, otherGraded: 0, excluded: 0 } as Record<string, number>
  );
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
  getDisplayActiveListings(
    cardId: UUID,
    options?: { referenceValue?: number; maxItems?: number; debugTrace?: ActiveMarketDebugTrace }
  ): Promise<ActiveListingsResponse>;
}

class ActiveListingsServiceImpl implements ActiveListingsService {
  async getDisplayActiveListings(
    cardId: UUID,
    options?: { referenceValue?: number; maxItems?: number; debugTrace?: ActiveMarketDebugTrace }
  ): Promise<ActiveListingsResponse> {
    const selectedMode = providerMode();
    const debugEnabled = options?.debugTrace?.enabled === true || debugCardTarget() === cardId;
    const debugTrace = debugEnabled
      ? {
          requestId: options?.debugTrace?.requestId || createRequestId(options?.debugTrace?.requestOrigin === "grading" ? "amg" : "am"),
          enabled: true,
          inspectRejected: options?.debugTrace?.inspectRejected !== false,
          requestOrigin: options?.debugTrace?.requestOrigin ?? "panel"
        }
      : options?.debugTrace;
    debugLog("provider_selection", {
      requestId: debugTrace?.requestId,
      providerMode: selectedMode,
      selectedLiveEbay: selectedMode === "ebay",
      cardId,
      maxItems: options?.maxItems,
      referenceValue: options?.referenceValue,
      debugEnabled: debugTrace?.enabled === true,
      inspectRejected: debugTrace?.inspectRejected === true,
      requestOrigin: debugTrace?.requestOrigin ?? "panel"
    });
    try {
      const result = await ebayActiveListingsProvider.getActiveListings(cardId, {
        ...options,
        debugTrace
      });
      debugLog("provider_returned", {
        requestId: debugTrace?.requestId,
        provider: result.provider,
        usedMock: result.usedMock,
        returnedCount: result.items.length
      });
      if (result.debugSummary) {
        debugLog("debug_summary", {
          requestId: result.debugSummary.requestId,
          cardId: result.debugSummary.cardId,
          requestOrigin: result.debugSummary.requestOrigin,
          dominantRejectionReason: result.debugSummary.dominantRejectionReason,
          thresholds: result.debugSummary.thresholds,
          totalRetrievedBeforeDedupe: result.debugSummary.totalRetrievedBeforeDedupe,
          acceptedCount: result.debugSummary.acceptedCount,
          rejectedCount: result.debugSummary.rejectedCount,
          finalReturnedCount: result.debugSummary.finalReturnedCount
        });
      }
      const normalized = normalizeActiveListings(result.items, result.usedMock);
      debugLog("normalized", {
        requestId: debugTrace?.requestId,
        normalizedCount: normalized.length,
        classificationCounts: countSegments(normalized)
      });
      const preparedListings = applyOutlierFilteringToListings(normalized, options?.referenceValue);
      const segments = groupActiveListingsBySegment(preparedListings);
      const filteredSegments = getFilteredActiveListingsSegments(segments);
      const visibleListings = getVisibleActiveListings(filteredSegments);
      const finalVisibleSegment =
        filteredSegments.raw.length ? "raw" : filteredSegments.psa9.length ? "psa9" : filteredSegments.psa10.length ? "psa10" : filteredSegments.otherGraded.length ? "otherGraded" : "none";
      debugLog("post_processing", {
        requestId: debugTrace?.requestId,
        outlierFilteredCounts: {
          raw: segments.raw.filter((listing) => listing.wasOutlierFiltered).length,
          psa9: segments.psa9.filter((listing) => listing.wasOutlierFiltered).length,
          psa10: segments.psa10.filter((listing) => listing.wasOutlierFiltered).length,
          otherGraded: segments.otherGraded.filter((listing) => listing.wasOutlierFiltered).length,
          excluded: 0
        },
        filteredCounts: {
          raw: filteredSegments.raw.length,
          psa9: filteredSegments.psa9.length,
          psa10: filteredSegments.psa10.length,
          otherGraded: filteredSegments.otherGraded.length,
          excluded: filteredSegments.excluded.length
        },
        finalVisibleSegment,
        finalVisibleCount: visibleListings.length
      });
      return responseFrom(cardId, normalized, result.provider, result.usedMock, options?.referenceValue);
    } catch (error) {
      debugLog("provider_failed", {
        requestId: debugTrace?.requestId,
        cardId,
        providerMode: selectedMode,
        reason: error instanceof Error ? error.message : "active_listings_unavailable",
        source: selectedMode === "ebay" ? "ebay_provider" : "provider_selection"
      });
      throw error;
    }
  }
}

export const activeListingsService: ActiveListingsService = new ActiveListingsServiceImpl();
