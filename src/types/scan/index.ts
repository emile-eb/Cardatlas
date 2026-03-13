import type { UUID, ISODateString } from "@/types/db";
import type { Card } from "@/types/domain";
import type { ValuationModel } from "@/types/valuation";

export type ScanJobStatus = "pending_upload" | "uploaded" | "processing" | "completed" | "failed" | "needs_review";

export interface ScanUploadState {
  frontImagePath?: string;
  backImagePath?: string;
  uploadedAt?: ISODateString;
}

export interface ScanProcessingState {
  status: ScanJobStatus;
  startedAt?: ISODateString;
  completedAt?: ISODateString;
  failedAt?: ISODateString;
  errorMessage?: string;
  confidenceLabel?: "high" | "medium" | "low";
  reviewReason?: string | null;
}

export interface ScanResult {
  card: Card;
  valuation: ValuationModel;
}

export interface ScanJob {
  id: UUID;
  userId: UUID;
  status: ScanJobStatus;
  uploads: ScanUploadState;
  processing: ScanProcessingState;
  result?: ScanResult;
  identifiedPayload?: unknown;
  cardId?: UUID | null;
  valuationSnapshotId?: UUID | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
