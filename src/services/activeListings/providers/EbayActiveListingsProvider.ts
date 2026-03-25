import type { ActiveListingsProvider } from "@/services/activeListings/providers/ActiveListingsProvider";
import type {
  ActiveMarketDebugError,
  ActiveListingsProviderResult,
  ActiveMarketDebugSummary,
  ActiveMarketDebugTrace,
  RawActiveListing
} from "@/services/activeListings/types";
import type { UUID } from "@/types";
import { getRequiredSupabaseClient } from "@/lib/supabase/client";

type ActiveMarketFunctionResponse = {
  ok: boolean;
  provider?: "ebay";
  usedMock?: boolean;
  items?: RawActiveListing[];
  debugSummary?: ActiveMarketDebugSummary;
  debugError?: ActiveMarketDebugError;
  query?: string;
  error?: string;
};

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log(`[active_market_provider] ${label}`, payload);
}

class EbayActiveListingsProviderImpl implements ActiveListingsProvider {
  readonly providerId = "ebay" as const;

  async getActiveListings(
    cardId: UUID,
    options?: { referenceValue?: number; maxItems?: number; debugTrace?: ActiveMarketDebugTrace }
  ): Promise<ActiveListingsProviderResult> {
    const supabase = await getRequiredSupabaseClient();
    debugLog("invoke_start", {
      requestId: options?.debugTrace?.requestId,
      cardId,
      maxItems: options?.maxItems,
      debugEnabled: options?.debugTrace?.enabled === true,
      inspectRejected: options?.debugTrace?.inspectRejected === true,
      requestOrigin: options?.debugTrace?.requestOrigin ?? "panel"
    });
    const { data, error } = await supabase.functions.invoke("active-market-ebay", {
      body: {
        cardId,
        maxItems: options?.maxItems,
        debug: options?.debugTrace
      }
    });

    if (error) {
      debugLog("invoke_error", {
        requestId: options?.debugTrace?.requestId,
        cardId,
        error: error.message || "Active market live request failed."
      });
      throw new Error(error.message || "Active market live request failed.");
    }

    const response = data as ActiveMarketFunctionResponse | null;
    if (!response?.ok) {
      if (response?.debugError) {
        console.groupCollapsed(
          `[active_market_provider][debugError] ${response.debugError.requestId ?? "unknown"} ${response.debugError.cardId ?? cardId}`
        );
        console.log(response.debugError);
        console.groupEnd();
      }
      debugLog("invoke_invalid_response", {
        requestId: options?.debugTrace?.requestId,
        cardId,
        error: response?.error || "Active market live response was invalid.",
        stage: response?.debugError?.stage ?? null
      });
      throw new Error(response?.error || "Active market live response was invalid.");
    }

    debugLog("invoke_success", {
      requestId: options?.debugTrace?.requestId,
      cardId,
      returnedCount: Array.isArray(response.items) ? response.items.length : 0
    });
    if (response.debugError) {
      console.groupCollapsed(
        `[active_market_provider][debugError] ${response.debugError.requestId ?? "unknown"} ${response.debugError.cardId ?? cardId}`
      );
      console.log(response.debugError);
      console.groupEnd();
    }
    if (response.debugSummary) {
      console.groupCollapsed(
        `[active_market_provider][debugSummary] ${response.debugSummary.requestId} ${response.debugSummary.cardId}`
      );
      console.log("summary", {
        requestOrigin: response.debugSummary.requestOrigin,
        dominantRejectionReason: response.debugSummary.dominantRejectionReason,
        thresholds: response.debugSummary.thresholds,
        acceptedCount: response.debugSummary.acceptedCount,
        rejectedCount: response.debugSummary.rejectedCount,
        finalReturnedCount: response.debugSummary.finalReturnedCount
      });
      console.log("rejectionReasonBuckets", response.debugSummary.rejectionReasonBuckets);
      console.log("topRejectedCandidates", response.debugSummary.topRejectedCandidates);
      console.log(response.debugSummary);
      console.groupEnd();
    }

    return {
      provider: "ebay",
      items: Array.isArray(response.items) ? response.items : [],
      usedMock: false,
      debugSummary: response.debugSummary,
      debugError: response.debugError
    };
  }
}

export const ebayActiveListingsProvider: ActiveListingsProvider = new EbayActiveListingsProviderImpl();
