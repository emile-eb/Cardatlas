import type { ISODateString, UUID } from "@/types/db";

export interface ActiveListing {
  id: UUID;
  source: string;
  sourceListingId: string | null;
  title: string;
  price: number;
  currency: string;
  itemWebUrl: string | null;
  imageUrl: string | null;
  itemOriginDate: ISODateString;
  condition: string | null;
  marketplaceId: string | null;
  isMock: boolean;
  rawPayload: Record<string, unknown> | null;
}

export interface ActiveListingsSummary {
  averageActivePrice: number;
  lowestActivePrice: number;
  highestActivePrice: number;
  listingCount: number;
}

export interface ActiveListingsResponse {
  cardId: UUID;
  listings: ActiveListing[];
  summary: ActiveListingsSummary;
  usedFallback: boolean;
  stale: boolean;
  refreshStatus: "fresh" | "refreshed" | "fallback" | "error";
  source: "mock" | "ebay";
  error?: string;
}

