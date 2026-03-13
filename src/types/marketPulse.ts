import type { ISODateString, UUID } from "@/types/db";

export type MarketPulseReason = "New Listing" | "Collector Pick" | "Hot Rookie" | "Premium Card" | string;

export interface MarketPulseItem {
  id: UUID;
  source: string;
  sourceListingId: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  itemWebUrl: string | null;
  price: number | null;
  currency: string;
  itemOriginDate: ISODateString | null;
  buyingOptions: Record<string, unknown> | null;
  marketplaceId: string | null;
  cardId: UUID | null;
  sport: string | null;
  playerName: string | null;
  team: string | null;
  pulseReason: MarketPulseReason | null;
  isMock: boolean;
  sortOrder: number | null;
  rawPayload: Record<string, unknown> | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface MarketPulseFeedResponse {
  items: MarketPulseItem[];
  source: "mock" | "ebay";
  isMock: boolean;
  refreshedAt: ISODateString | null;
  didTriggerBackgroundRefresh: boolean;
  errorMessage?: string | null;
}

export interface MarketPulseRefreshResult {
  source: "mock" | "ebay";
  isMock: boolean;
  itemsWritten: number;
  refreshedAt: ISODateString;
  errorMessage?: string | null;
}

