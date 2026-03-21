import type { ActiveListingsProvider } from "@/services/activeListings/providers/ActiveListingsProvider";
import type { ActiveListingsProviderResult, RawActiveListing } from "@/services/activeListings/types";
import type { UUID } from "@/types";
import { getRequiredSupabaseClient } from "@/lib/supabase/client";

type ActiveMarketFunctionResponse = {
  ok: boolean;
  provider?: "ebay";
  usedMock?: boolean;
  items?: RawActiveListing[];
  query?: string;
  error?: string;
};

class EbayActiveListingsProviderImpl implements ActiveListingsProvider {
  readonly providerId = "ebay" as const;

  async getActiveListings(cardId: UUID, options?: { referenceValue?: number; maxItems?: number }): Promise<ActiveListingsProviderResult> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase.functions.invoke("active-market-ebay", {
      body: {
        cardId,
        maxItems: options?.maxItems
      }
    });

    if (error) {
      throw new Error(error.message || "Active market live request failed.");
    }

    const response = data as ActiveMarketFunctionResponse | null;
    if (!response?.ok) {
      throw new Error(response?.error || "Active market live response was invalid.");
    }

    return {
      provider: "ebay",
      items: Array.isArray(response.items) ? response.items : [],
      usedMock: false
    };
  }
}

export const ebayActiveListingsProvider: ActiveListingsProvider = new EbayActiveListingsProviderImpl();
