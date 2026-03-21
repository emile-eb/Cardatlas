import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { MarketPulseProvider } from "@/services/marketPulse/providers/MarketPulseProvider";
import type { ProviderFetchInput, ProviderFetchResult, ProviderListing } from "@/services/marketPulse/types";

type MarketPulseRefreshFunctionResponse = {
  ok: boolean;
  source?: "ebay";
  isMock?: boolean;
  items?: ProviderListing[];
  itemsWritten?: number;
  refreshedAt?: string | null;
  error?: string;
};

class EbayMarketPulseProviderImpl implements MarketPulseProvider {
  readonly providerId = "ebay" as const;

  async fetchLatestListings(input: ProviderFetchInput): Promise<ProviderFetchResult> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase.functions.invoke("market-pulse-refresh", {
      body: {
        limit: input.limit
      }
    });

    if (error) {
      throw new Error(error.message || "Market Pulse refresh failed.");
    }

    const response = data as MarketPulseRefreshFunctionResponse | null;
    if (!response?.ok) {
      throw new Error(response?.error || "Market Pulse refresh returned an invalid response.");
    }

    return {
      source: "ebay",
      listings: Array.isArray(response.items) ? response.items : [],
      isMock: false,
      alreadyStored: true,
      refreshedAt: response.refreshedAt ?? null,
      itemsWritten: response.itemsWritten ?? 0
    };
  }
}

export const ebayMarketPulseProvider: MarketPulseProvider = new EbayMarketPulseProviderImpl();
