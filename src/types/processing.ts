export interface StructuredPlayerInfo {
  era: string;
  careerNote: string;
}

export interface StructuredCardIdentification {
  sport: string;
  playerName: string;
  cardTitle: string;
  year: number | null;
  brand: string | null;
  setName: string | null;
  cardNumber: string | null;
  team: string | null;
  position: string | null;
  rarityLabel: string | null;
  conditionEstimate: string;
  confidence: number;
  description: string;
  playerInfo: StructuredPlayerInfo;
  referenceValue: number;
  gradedUpside?: number | null;
  valueSource: string;
  reviewNeeded: boolean;
  reviewReason: string | null;
}

export interface ProcessScanResponse {
  scanId: string;
  status: "processing" | "completed" | "failed" | "needs_review";
  cardId: string | null;
  valuationSnapshotId: string | null;
  confidenceLabel: "high" | "medium" | "low" | null;
  reviewReason: string | null;
  errorMessage: string | null;
}
