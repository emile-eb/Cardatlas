import type { ProviderFetchInput, ProviderFetchResult } from "@/services/marketPulse/types";

export interface MarketPulseProvider {
  providerId: "mock" | "ebay";
  fetchLatestListings(input: ProviderFetchInput): Promise<ProviderFetchResult>;
}

