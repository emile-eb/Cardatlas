import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type {
  FailedUploadCleanupRequest,
  ScanImageUploadRequest,
  ScanImageUploadResult,
  ScanImageSide
} from "@/types";

const FRONT_BUCKET = "scan-fronts";
const BACK_BUCKET = "scan-backs";

async function uriToBlob(localUri: string): Promise<Blob> {
  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error(`Failed to read image at uri: ${localUri}`);
  }
  return response.blob();
}

function buildScanPath(input: ScanImageUploadRequest, side: ScanImageSide) {
  return `${input.userId}/${input.scanId}/${side}.jpg`;
}

function bucketForSide(side: ScanImageSide) {
  return side === "front" ? FRONT_BUCKET : BACK_BUCKET;
}

export interface StorageService {
  uploadFrontScanImage(input: ScanImageUploadRequest): Promise<ScanImageUploadResult>;
  uploadBackScanImage(input: ScanImageUploadRequest): Promise<ScanImageUploadResult>;
  deleteUpload(bucket: string, path: string): Promise<void>;
  deleteFailedScanUploads(request: FailedUploadCleanupRequest): Promise<void>;
}

class StorageServiceImpl implements StorageService {
  async uploadFrontScanImage(input: ScanImageUploadRequest): Promise<ScanImageUploadResult> {
    return this.uploadScanImage(input, "front");
  }

  async uploadBackScanImage(input: ScanImageUploadRequest): Promise<ScanImageUploadResult> {
    return this.uploadScanImage(input, "back");
  }

  async deleteUpload(bucket: string, path: string): Promise<void> {
    const supabase = await getRequiredSupabaseClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  }

  async deleteFailedScanUploads(request: FailedUploadCleanupRequest): Promise<void> {
    await Promise.allSettled(request.items.map((item) => this.deleteUpload(item.bucket, item.path)));
  }

  private async uploadScanImage(
    input: ScanImageUploadRequest,
    side: ScanImageSide
  ): Promise<ScanImageUploadResult> {
    const supabase = await getRequiredSupabaseClient();
    const path = buildScanPath(input, side);
    const bucket = bucketForSide(side);
    const blob = await uriToBlob(input.localUri);
    const detectedContentType = input.contentType ?? blob.type ?? "application/octet-stream";

    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      upsert: true,
      contentType: detectedContentType
    });

    if (error) {
      throw new Error(
        `Storage upload failed (${side}) bucket=${bucket} path=${path} code=${error.code ?? "unknown"} message=${error.message ?? "unknown"}`
      );
    }

    return {
      bucket,
      path,
      side,
      uploadedAt: new Date().toISOString()
    };
  }
}

export const storageService: StorageService = new StorageServiceImpl();

export const storageBuckets = {
  scanFronts: FRONT_BUCKET,
  scanBacks: BACK_BUCKET
} as const;
