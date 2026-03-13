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
  playerInfo: {
    era: string;
    careerNote: string;
  };
  referenceValue: number;
  gradedUpside?: number | null;
  valueSource: string;
  reviewNeeded: boolean;
  reviewReason: string | null;
}

export type ProcessingStatus = "completed" | "needs_review" | "failed";

export interface RecognitionInput {
  scanId: string;
  frontImageUrl: string;
  backImageUrl?: string | null;
}

export interface CardRecognitionProvider {
  providerName: string;
  recognizeCard(input: RecognitionInput): Promise<unknown>;
}

export interface ProcessScanResponse {
  scanId: string;
  status: "processing" | "completed" | "needs_review" | "failed";
  cardId: string | null;
  valuationSnapshotId: string | null;
  confidenceLabel: "high" | "medium" | "low" | null;
  reviewReason: string | null;
  errorMessage: string | null;
}
