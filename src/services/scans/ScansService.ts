import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import { storageBuckets, storageService } from "@/services/storage/StorageService";
import { authService } from "@/services/auth/AuthService";
import type { Scan, ScanJob, ScanJobStatus, UUID } from "@/types";

function nowIso() {
  return new Date().toISOString();
}

export interface CreateScanJobInput {
  userId: UUID;
}

export interface AttachScanImageInput {
  scanId: UUID;
  userId: UUID;
  localUri: string;
  contentType?: string;
  storageOwnerId?: UUID;
}

export interface FailScanJobInput {
  scanId: UUID;
  errorMessage: string;
}

export interface CreateScanJobWithUploadsInput {
  userId: UUID;
  frontLocalUri: string;
  backLocalUri: string;
}

export interface ScansService {
  createScanJob(input: CreateScanJobInput): Promise<ScanJob>;
  attachFrontImage(input: AttachScanImageInput): Promise<ScanJob>;
  attachBackImage(input: AttachScanImageInput): Promise<ScanJob>;
  markUploaded(scanId: UUID): Promise<ScanJob>;
  markFailed(input: FailScanJobInput): Promise<ScanJob>;
  fetchScanJobById(scanId: UUID): Promise<ScanJob | null>;
  listRecentScans(userId: UUID, limit?: number): Promise<ScanJob[]>;
  createScanJobWithUploads(input: CreateScanJobWithUploadsInput): Promise<ScanJob>;
}

function mapDbScanToJob(scan: any): ScanJob {
  const status = scan.status as ScanJobStatus;
  return {
    id: scan.id,
    userId: scan.user_id,
    status,
    uploads: {
      frontImagePath: scan.front_image_path ?? undefined,
      backImagePath: scan.back_image_path ?? undefined,
      uploadedAt: status === "uploaded" || status === "processing" || status === "completed" || status === "needs_review"
        ? scan.processing_started_at ?? scan.scanned_at
        : undefined
    },
    processing: {
      status,
      startedAt: scan.processing_started_at ?? undefined,
      completedAt: scan.processing_finished_at ?? scan.completed_at ?? undefined,
      failedAt: status === "failed" ? scan.processing_finished_at ?? undefined : undefined,
      errorMessage: scan.error_message ?? undefined,
      confidenceLabel: scan.confidence_label ?? undefined,
      reviewReason: scan.review_reason ?? null
    },
    identifiedPayload: scan.identified_payload ?? undefined,
    cardId: scan.card_id ?? null,
    valuationSnapshotId: scan.valuation_snapshot_id ?? null,
    createdAt: scan.scanned_at,
    updatedAt: scan.processing_finished_at ?? scan.processing_started_at ?? scan.scanned_at
  };
}

class ScansServiceImpl implements ScansService {
  private async ensureAuthenticatedSession(): Promise<void> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return;

    // Ensure we always have an authenticated (anonymous) user token before hitting RLS-protected tables.
    await authService.restoreOrCreateAnonymousSession();
  }

  async createScanJob(input: CreateScanJobInput): Promise<ScanJob> {
    await this.ensureAuthenticatedSession();
    const supabase = await getRequiredSupabaseClient();

    const { data, error } = await supabase
      .from("scans")
      .insert({
        user_id: input.userId,
        front_image_path: null,
        back_image_path: null,
        status: "pending_upload",
        scanned_at: nowIso()
      })
      .select("*")
      .single();

    if (error) throw error;
    return mapDbScanToJob(data);
  }

  async attachFrontImage(input: AttachScanImageInput): Promise<ScanJob> {
    await this.ensureAuthenticatedSession();
    const upload = await storageService.uploadFrontScanImage({
      userId: input.storageOwnerId ?? input.userId,
      scanId: input.scanId,
      localUri: input.localUri,
      contentType: input.contentType
    });

    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("scans")
      .update({ front_image_path: upload.path })
      .eq("id", input.scanId)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    if (error) {
      await storageService.deleteUpload(upload.bucket, upload.path);
      throw error;
    }

    return mapDbScanToJob(data);
  }

  async attachBackImage(input: AttachScanImageInput): Promise<ScanJob> {
    await this.ensureAuthenticatedSession();
    const upload = await storageService.uploadBackScanImage({
      userId: input.storageOwnerId ?? input.userId,
      scanId: input.scanId,
      localUri: input.localUri,
      contentType: input.contentType
    });

    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("scans")
      .update({ back_image_path: upload.path })
      .eq("id", input.scanId)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    if (error) {
      await storageService.deleteUpload(upload.bucket, upload.path);
      throw error;
    }

    return mapDbScanToJob(data);
  }

  async markUploaded(scanId: UUID): Promise<ScanJob> {
    await this.ensureAuthenticatedSession();
    return this.updateStatus(scanId, "uploaded");
  }

  async markFailed(input: FailScanJobInput): Promise<ScanJob> {
    await this.ensureAuthenticatedSession();
    const existing = await this.fetchScanJobById(input.scanId);
    if (existing) {
      await storageService.deleteFailedScanUploads({
        items: [
          existing.uploads.frontImagePath ? { bucket: storageBuckets.scanFronts, path: existing.uploads.frontImagePath } : null,
          existing.uploads.backImagePath ? { bucket: storageBuckets.scanBacks, path: existing.uploads.backImagePath } : null
        ].filter(Boolean) as Array<{ bucket: string; path: string }>
      });
    }

    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("scans")
      .update({
        status: "failed",
        error_message: input.errorMessage,
        processing_finished_at: nowIso()
      })
      .eq("id", input.scanId)
      .select("*")
      .single();

    if (error) throw error;
    return mapDbScanToJob(data);
  }

  async fetchScanJobById(scanId: UUID): Promise<ScanJob | null> {
    await this.ensureAuthenticatedSession();
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase.from("scans").select("*").eq("id", scanId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapDbScanToJob(data);
  }

  async listRecentScans(userId: UUID, limit = 20): Promise<ScanJob[]> {
    await this.ensureAuthenticatedSession();
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("scans")
      .select("*")
      .eq("user_id", userId)
      .order("scanned_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapDbScanToJob);
  }

  async createScanJobWithUploads(input: CreateScanJobWithUploadsInput): Promise<ScanJob> {
    await this.ensureAuthenticatedSession();
    const job = await this.createScanJob({ userId: input.userId });

    try {
      await this.attachFrontImage({ scanId: job.id, userId: input.userId, localUri: input.frontLocalUri });
      await this.attachBackImage({ scanId: job.id, userId: input.userId, localUri: input.backLocalUri });
      return this.markUploaded(job.id);
    } catch (error) {
      await this.markFailed({
        scanId: job.id,
        errorMessage: error instanceof Error ? error.message : "Failed to upload scan images."
      });
      throw error;
    }
  }

  private async updateStatus(scanId: UUID, status: ScanJobStatus): Promise<ScanJob> {
    await this.ensureAuthenticatedSession();
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("scans")
      .update({ status })
      .eq("id", scanId)
      .select("*")
      .single();

    if (error) throw error;
    return mapDbScanToJob(data);
  }
}

export const scansService: ScansService = new ScansServiceImpl();

export function mapScanJobToLegacyScan(scanJob: ScanJob): Scan {
  return {
    id: scanJob.id,
    userId: scanJob.userId,
    status: scanJob.status,
    cardId: scanJob.cardId ?? null,
    valuationSnapshotId: scanJob.valuationSnapshotId ?? null,
    frontImagePath: scanJob.uploads.frontImagePath ?? "",
    backImagePath: scanJob.uploads.backImagePath ?? "",
    processingStartedAt: scanJob.processing.startedAt ?? null,
    processingFinishedAt: scanJob.processing.completedAt ?? scanJob.processing.failedAt ?? null,
    completedAt: scanJob.processing.completedAt ?? null,
    identifiedPayload: scanJob.identifiedPayload ?? null,
    confidenceLabel: scanJob.processing.confidenceLabel ?? null,
    reviewReason: scanJob.processing.reviewReason ?? null,
    errorMessage: scanJob.processing.errorMessage ?? null,
    scannedAt: scanJob.createdAt
  };
}
