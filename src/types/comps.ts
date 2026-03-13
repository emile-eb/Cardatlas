import type { ISODateString, UUID } from "@/types/db";

export type CardSaleSource = "rapidapi_ebay_sold" | "demo_market" | string;
export type CompNormalizationConfidence = "high" | "medium" | "low";
export type CompRefreshStatus = "fresh" | "refreshed" | "fallback" | "error";

export interface CardSale {
  id: UUID;
  cardId: UUID;
  source: CardSaleSource;
  sourceListingId: string | null;
  title: string | null;
  price: number;
  currency: string;
  saleDate: ISODateString;
  condition: string | null;
  grade: string | null;
  url: string | null;
  rawPayload: Record<string, unknown> | null;
  normalizedConfidence: CompNormalizationConfidence | string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RawCompResult {
  provider: CardSaleSource;
  payload: Record<string, unknown>;
}

export interface CompNormalizationResult {
  source: CardSaleSource;
  sourceListingId: string | null;
  title: string | null;
  price: number;
  currency: string;
  saleDate: ISODateString;
  condition: string | null;
  grade: string | null;
  url: string | null;
  rawPayload: Record<string, unknown>;
  normalizedConfidence: CompNormalizationConfidence;
}

export interface CardCompsProviderResult {
  provider: CardSaleSource;
  rawCount: number;
  items: RawCompResult[];
}

export interface RecentSalesResponse {
  ok?: boolean;
  cardId: UUID;
  sales: CardSale[];
  refreshStatus: CompRefreshStatus;
  usedFallback: boolean;
  stale: boolean;
  error?: string;
  debug?: {
    provider?: string;
    normalizationAccepted?: number;
    persisted?: number;
    reason?: string;
  };
}
