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
  year: number | null;
  brand: string | null;
  setName: string | null;
  cardNumber: string | null;
  sport: string | null;
  playerName: string | null;
  team: string | null;
  referenceValue: number | null;
  activeMarketAverageAsk: number | null;
  lowestAsk: number | null;
  listingCount: number | null;
  pulseReason: MarketPulseReason | null;
  signalStrengthScore: number | null;
  lastRefreshedAt: ISODateString | null;
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
