import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import { Platform } from "react-native";
import type {
  FailedUploadCleanupRequest,
  ScanImageUploadRequest,
  ScanImageUploadResult,
  ScanImageSide
} from "@/types";

const FRONT_BUCKET = "scan-fronts";
const BACK_BUCKET = "scan-backs";
const MAX_UPLOAD_DIMENSION = 1600;

function inferContentType(localUri: string): string | null {
  const normalized = localUri.split("?")[0].toLowerCase();
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".heic")) return "image/heic";
  if (normalized.endsWith(".heif")) return "image/heif";
  if (normalized.endsWith(".webp")) return "image/webp";
  return null;
}

async function normalizeUploadUri(localUri: string): Promise<string> {
  if (Platform.OS === "web") {
    return localUri;
  }

  const ImageManipulator = await import("expo-image-manipulator");
  const actions: Array<{ resize: { width?: number; height?: number } }> = [
    { resize: { width: MAX_UPLOAD_DIMENSION } }
  ];
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    actions,
    {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG
    }
  );

  return result.uri;
}

async function uriToBlob(localUri: string): Promise<Blob> {
  if (Platform.OS !== "web") {
    return new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onerror = () => reject(new Error(`Failed to read image at uri: ${localUri}`));
      xhr.onload = () => {
        if (xhr.status >= 400) {
          reject(new Error(`Failed to read image at uri: ${localUri}`));
          return;
        }
        resolve(xhr.response as Blob);
      };
      xhr.responseType = "blob";
      xhr.open("GET", localUri, true);
      xhr.send();
    });
  }

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
    const uploadUri = await normalizeUploadUri(input.localUri);
    const blob = await uriToBlob(uploadUri);
    const detectedContentType =
      input.contentType ?? blob.type ?? inferContentType(uploadUri) ?? "image/jpeg";

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
