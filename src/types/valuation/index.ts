import type { ISODateString, UUID } from "@/types/db";

export interface ValuationModel {
  cardId: UUID | null;
  conditionBasis: string;
  referenceValue: number;
  lowEstimate?: number | null;
  highEstimate?: number | null;
  source: string;
  valuedAt: ISODateString;
  currency?: string;
  sourceConfidence?: number | null;
  metadata?: Record<string, unknown> | null;
}
