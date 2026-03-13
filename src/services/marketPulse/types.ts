import type { MarketPulseReason } from "@/types/marketPulse";

export interface ProviderListing {
  source: string;
  sourceListingId: string | null;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  itemWebUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  itemOriginDate?: string | null;
  buyingOptions?: Record<string, unknown> | null;
  marketplaceId?: string | null;
  sport?: string | null;
  playerName?: string | null;
  team?: string | null;
  pulseReason?: MarketPulseReason | null;
  isMock?: boolean;
  rawPayload?: Record<string, unknown> | null;
}

export interface ProviderFetchInput {
  limit: number;
  query: string;
  marketplaceId: string;
}

export interface ProviderFetchResult {
  source: "mock" | "ebay";
  listings: ProviderListing[];
  isMock: boolean;
}

