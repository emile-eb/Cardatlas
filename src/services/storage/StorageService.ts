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

export type ScanUploadDebug = {
  side: ScanImageSide;
  originalUri: string;
  normalizedUri: string;
  normalizationApplied: boolean;
  originalSizeBytes: number | null;
  normalizedSizeBytes: number | null;
  uploadedBlobSizeBytes: number;
  contentType: string;
};

const latestUploadDebugBySide: Record<ScanImageSide, ScanUploadDebug | null> = {
  front: null,
  back: null
};

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
  return localUri;
}

async function getFileSize(localUri: string): Promise<number | null> {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    const FileSystem = await import("expo-file-system");
    const info = await FileSystem.getInfoAsync(localUri, { size: true });
    if ("size" in info && typeof info.size === "number") {
      return info.size;
    }
    return null;
  } catch {
    return null;
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  let padding = 0;
  if (cleaned.endsWith("==")) padding = 2;
  else if (cleaned.endsWith("=")) padding = 1;

  const outputLength = Math.floor((cleaned.length * 3) / 4) - padding;
  const bytes = new Uint8Array(outputLength);
  let byteIndex = 0;

  for (let i = 0; i < cleaned.length; i += 4) {
    const enc1 = chars.indexOf(cleaned[i] ?? "A");
    const enc2 = chars.indexOf(cleaned[i + 1] ?? "A");
    const enc3 = cleaned[i + 2] === "=" ? 64 : chars.indexOf(cleaned[i + 2] ?? "A");
    const enc4 = cleaned[i + 3] === "=" ? 64 : chars.indexOf(cleaned[i + 3] ?? "A");

    const chunk = (enc1 << 18) | (enc2 << 12) | ((enc3 & 63) << 6) | (enc4 & 63);

    if (byteIndex < outputLength) bytes[byteIndex++] = (chunk >> 16) & 255;
    if (enc3 !== 64 && byteIndex < outputLength) bytes[byteIndex++] = (chunk >> 8) & 255;
    if (enc4 !== 64 && byteIndex < outputLength) bytes[byteIndex++] = chunk & 255;
  }

  return bytes;
}

async function uriToUploadBody(localUri: string): Promise<Blob | Uint8Array> {
  if (Platform.OS !== "web") {
    const FileSystem = await import("expo-file-system");
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64
    });
    return base64ToUint8Array(base64);
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
    const originalSizeBytes = await getFileSize(input.localUri);
    const uploadUri = await normalizeUploadUri(input.localUri);
    const normalizedSizeBytes = await getFileSize(uploadUri);
    const uploadBody = await uriToUploadBody(uploadUri);
    const detectedContentType =
      input.contentType ??
      (uploadBody instanceof Blob ? uploadBody.type : null) ??
      inferContentType(uploadUri) ??
      "image/jpeg";
    const uploadSizeBytes = uploadBody instanceof Blob ? uploadBody.size : uploadBody.byteLength;

    latestUploadDebugBySide[side] = {
      side,
      originalUri: input.localUri,
      normalizedUri: uploadUri,
      normalizationApplied: uploadUri !== input.localUri,
      originalSizeBytes,
      normalizedSizeBytes,
      uploadedBlobSizeBytes: uploadSizeBytes,
      contentType: detectedContentType
    };

    const { error } = await supabase.storage.from(bucket).upload(path, uploadBody, {
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

export function getLatestScanUploadDebug(side: ScanImageSide): ScanUploadDebug | null {
  return latestUploadDebugBySide[side];
}
