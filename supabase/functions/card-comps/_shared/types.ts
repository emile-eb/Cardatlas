// @ts-nocheck
export interface NormalizedCardIdentity {
  cardId: string;
  sport: string | null;
  playerName: string;
  cardTitle: string;
  year: number | null;
  brand: string | null;
  setName: string | null;
  cardNumber: string | null;
  team: string | null;
  referenceValue: number;
  currency: string;
}

export interface RawCompResult {
  provider: string;
  payload: Record<string, unknown>;
}

export interface CardCompsProviderResult {
  provider: string;
  rawCount: number;
  items: RawCompResult[];
}

export interface CardCompsProvider {
  providerName: string;
  fetchRecentSalesForCard(identity: NormalizedCardIdentity): Promise<CardCompsProviderResult>;
}

export interface CompNormalizationResult {
  source: string;
  sourceListingId: string | null;
  title: string | null;
  price: number;
  currency: string;
  saleDate: string;
  condition: string | null;
  grade: string | null;
  url: string | null;
  rawPayload: Record<string, unknown>;
  normalizedConfidence: "high" | "medium" | "low";
}

export interface CardSaleRow {
  id: string;
  card_id: string;
  source: string;
  source_listing_id: string | null;
  title: string | null;
  price: number;
  currency: string;
  sale_date: string;
  condition: string | null;
  grade: string | null;
  url: string | null;
  raw_payload: Record<string, unknown> | null;
  normalized_confidence: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecentSalesResponse {
  ok: boolean;
  cardId: string;
  refreshStatus: "fresh" | "refreshed" | "fallback" | "error";
  stale: boolean;
  usedFallback: boolean;
  sales: CardSaleRow[];
  debug?: {
    provider?: string;
    normalizationAccepted?: number;
    persisted?: number;
    reason?: string;
  };
  error?: string;
}

export interface CardCompsRequestBody {
  action?: "get_recent_sales" | "refresh_recent_cards";
  cardId?: string;
  cardIds?: string[];
  forceRefresh?: boolean;
  maxItems?: number;
  staleAfterHours?: number;
}

