import type { UUID } from "@/types/db";

export type ScanImageSide = "front" | "back";

export interface ScanImageUploadRequest {
  userId: UUID;
  scanId: UUID;
  localUri: string;
  contentType?: string;
}

export interface ScanImageUploadResult {
  bucket: string;
  path: string;
  side: ScanImageSide;
  uploadedAt: string;
}

export interface FailedUploadCleanupRequest {
  items: Array<Pick<ScanImageUploadResult, "bucket" | "path">>;
}
