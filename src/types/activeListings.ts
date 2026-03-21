import type { ISODateString, UUID } from "@/types/db";

export type ActiveMarketSegment = "raw" | "psa9" | "psa10" | "otherGraded" | "excluded";
export type ActiveMarketClassificationConfidence = "high" | "medium" | "low";

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
  marketSegment: ActiveMarketSegment;
  classificationConfidence: ActiveMarketClassificationConfidence;
  classificationReason: string;
  wasOutlierFiltered: boolean;
  outlierFilterReason: string | null;
}

export interface ActiveListingsSummary {
  averageActivePrice: number;
  lowestActivePrice: number;
  highestActivePrice: number;
  listingCount: number;
}

export interface ActiveListingsSegments {
  raw: ActiveListing[];
  psa9: ActiveListing[];
  psa10: ActiveListing[];
  otherGraded: ActiveListing[];
  excluded: ActiveListing[];
}

export interface ActiveListingsResponse {
  cardId: UUID;
  listings: ActiveListing[];
  segments: ActiveListingsSegments;
  filteredSegments: ActiveListingsSegments;
  summary: ActiveListingsSummary;
  usedFallback: boolean;
  stale: boolean;
  refreshStatus: "fresh" | "refreshed" | "fallback" | "error";
  source: "mock" | "ebay";
  error?: string;
}
