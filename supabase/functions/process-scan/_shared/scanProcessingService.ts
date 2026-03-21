// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { parseStructuredIdentification } from "./structuredOutput.ts";
import { createRecognitionProvider } from "./providers.ts";
import type { ProcessScanResponse, StructuredCardIdentification } from "./types.ts";
import { ensureTrackedCard } from "../../_shared/trackedCards.ts";

const LOW_CONFIDENCE_THRESHOLD = 0.55;
const REVIEW_THRESHOLD = 0.85;

function nowIso() {
  return new Date().toISOString();
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const maybe = error as Record<string, unknown>;
    const pieces = [
      maybe.code ? `code=${String(maybe.code)}` : null,
      maybe.message ? `message=${String(maybe.message)}` : null,
      maybe.details ? `details=${String(maybe.details)}` : null,
      maybe.hint ? `hint=${String(maybe.hint)}` : null
    ].filter(Boolean);
    if (pieces.length) return pieces.join(" | ");
    try {
      return JSON.stringify(maybe);
    } catch {
      return "Unknown processing error";
    }
  }
  return "Unknown processing error";
}

function confidenceLabel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= REVIEW_THRESHOLD) return "high";
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function rarityLabelFromPrice(referenceValue: number): "Common" | "Notable" | "Rare" | "Elite" | "Grail" {
  if (referenceValue >= 5000) return "Grail";
  if (referenceValue >= 500) return "Elite";
  if (referenceValue >= 100) return "Rare";
  if (referenceValue >= 25) return "Notable";
  return "Common";
}

function classifyOutcome(result: StructuredCardIdentification): {
  status: "completed" | "needs_review" | "failed";
  reviewReason: string | null;
  confidenceLabel: "high" | "medium" | "low";
} {
  const label = confidenceLabel(result.confidence);
  if (result.reviewNeeded) {
    return {
      status: "needs_review",
      reviewReason: result.reviewReason ?? "Provider requested manual review.",
      confidenceLabel: label
    };
  }

  if (result.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return {
      status: "failed",
      reviewReason: "Low confidence identification.",
      confidenceLabel: label
    };
  }

  if (result.confidence < REVIEW_THRESHOLD) {
    return {
      status: "needs_review",
      reviewReason: result.reviewReason ?? "Confidence below auto-accept threshold.",
      confidenceLabel: label
    };
  }

  return {
    status: "completed",
    reviewReason: null,
    confidenceLabel: label
  };
}

async function findOrCreateCardFromProcessedResult(
  service: any,
  identification: StructuredCardIdentification,
  input: { frontImagePath: string | null; backImagePath: string | null }
): Promise<string> {
  const { data: existing, error: existingError } = await service
    .from("cards")
    .select("id")
    .eq("sport", identification.sport)
    .eq("player_name", identification.playerName)
    .eq("year", identification.year)
    .eq("brand", identification.brand)
    .eq("set_name", identification.setName)
    .eq("card_number", identification.cardNumber)
    .maybeSingle();

  if (existingError) throw existingError;
  const computedRarityLabel = rarityLabelFromPrice(identification.referenceValue);
  if (existing?.id) {
    await service
      .from("cards")
      .update({
        card_title: identification.cardTitle,
        team: identification.team,
        position: identification.position,
        rarity_label: computedRarityLabel,
        description: identification.description,
        era: identification.playerInfo.era,
        player_info: identification.playerInfo,
        metadata: {
          source: identification.valueSource,
          normalizedKey: {
            sport: normalize(identification.sport),
            player: normalize(identification.playerName),
            year: identification.year,
            brand: normalize(identification.brand),
            set: normalize(identification.setName),
            number: normalize(identification.cardNumber)
          }
        },
        canonical_front_image_path: input.frontImagePath,
        canonical_back_image_path: input.backImagePath
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error: createError } = await service
    .from("cards")
    .insert({
      sport: identification.sport,
      player_name: identification.playerName,
      card_title: identification.cardTitle,
      year: identification.year,
      brand: identification.brand,
      set_name: identification.setName,
      card_number: identification.cardNumber,
      team: identification.team,
      position: identification.position,
      rarity_label: computedRarityLabel,
      era: identification.playerInfo.era,
      description: identification.description,
      player_info: identification.playerInfo,
      metadata: {
        source: identification.valueSource,
        normalizedKey: {
          sport: normalize(identification.sport),
          player: normalize(identification.playerName),
          year: identification.year,
          brand: normalize(identification.brand),
          set: normalize(identification.setName),
          number: normalize(identification.cardNumber)
        }
      },
      canonical_front_image_path: input.frontImagePath,
      canonical_back_image_path: input.backImagePath
    })
    .select("id")
    .single();

  if (createError) throw createError;
  return created.id;
}

async function createValuationSnapshot(service: any, input: {
  cardId: string;
  scanId: string;
  identification: StructuredCardIdentification;
}): Promise<string> {
  const { identification } = input;
  const { data, error } = await service
    .from("valuation_snapshots")
    .insert({
      card_id: input.cardId,
      source_scan_id: input.scanId,
      reference_value: identification.referenceValue,
      value_low: identification.referenceValue * 0.85,
      value_high: identification.referenceValue * 1.15,
      source: identification.valueSource,
      condition_basis: identification.conditionEstimate,
      fetched_at: nowIso(),
      currency: "USD",
      source_confidence: identification.confidence,
      metadata: {
        reviewNeeded: identification.reviewNeeded,
        providerValueSource: identification.valueSource
      }
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function processScan(input: {
  scanId: string;
  retry?: boolean;
  authUserId: string;
}): Promise<ProcessScanResponse> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: userRow, error: userError } = await service
    .from("users")
    .select("id")
    .eq("auth_user_id", input.authUserId)
    .maybeSingle();
  if (userError) throw userError;
  if (!userRow?.id) throw new Error("User not found for auth identity.");

  const { data: scan, error: scanError } = await service
    .from("scans")
    .select("*")
    .eq("id", input.scanId)
    .eq("user_id", userRow.id)
    .maybeSingle();

  if (scanError) throw scanError;
  if (!scan) throw new Error("Scan not found.");

  const allowedStatuses = input.retry
    ? ["failed", "needs_review", "uploaded"]
    : ["uploaded", "failed", "needs_review"];
  if (!allowedStatuses.includes(scan.status)) {
    throw new Error(`Scan status ${scan.status} cannot be processed.`);
  }

  await service
    .from("scans")
    .update({
      status: "processing",
      processing_started_at: nowIso(),
      processing_finished_at: null,
      review_reason: null,
      error_message: null,
      confidence_label: null
    })
    .eq("id", input.scanId);

  try {
    if (!scan.front_image_path) {
      throw new Error("Scan front image path missing.");
    }

    const { data: frontSigned, error: frontError } = await service.storage
      .from("scan-fronts")
      .createSignedUrl(scan.front_image_path, 60 * 10);
    if (frontError) throw frontError;

    let backSignedUrl: string | null = null;
    if (scan.back_image_path) {
      const { data: backSigned, error: backError } = await service.storage
        .from("scan-backs")
        .createSignedUrl(scan.back_image_path, 60 * 10);
      if (backError) throw backError;
      backSignedUrl = backSigned?.signedUrl ?? null;
    }

    const provider = createRecognitionProvider();
    const providerOutput = await provider.recognizeCard({
      scanId: scan.id,
      frontImageUrl: frontSigned?.signedUrl ?? "",
      backImageUrl: backSignedUrl
    });

    const identification = parseStructuredIdentification(providerOutput);
    const outcome = classifyOutcome(identification);

    let cardId: string | null = null;
    let valuationSnapshotId: string | null = null;

    if (outcome.status !== "failed") {
      cardId = await findOrCreateCardFromProcessedResult(service, identification, {
        frontImagePath: scan.front_image_path ?? null,
        backImagePath: scan.back_image_path ?? null
      });
      valuationSnapshotId = await createValuationSnapshot(service, {
        cardId,
        scanId: scan.id,
        identification
      });
    }

    await service
      .from("scans")
      .update({
        status: outcome.status,
        card_id: cardId,
        valuation_snapshot_id: valuationSnapshotId,
        identified_payload: identification,
        confidence_label: outcome.confidenceLabel,
        review_reason: outcome.reviewReason,
        completed_at: outcome.status === "completed" || outcome.status === "needs_review" ? nowIso() : null,
        processing_finished_at: nowIso(),
        error_message: outcome.status === "failed" ? outcome.reviewReason : null
      })
      .eq("id", scan.id);

    if (cardId && (outcome.status === "completed" || outcome.status === "needs_review")) {
      try {
        await ensureTrackedCard(service, cardId, "scan_auto");
      } catch (trackingError) {
        console.log("[process-scan] auto_tracking_failed", {
          scanId: scan.id,
          cardId,
          reason: formatUnknownError(trackingError)
        });
      }
    }

    return {
      scanId: scan.id,
      status: outcome.status,
      cardId,
      valuationSnapshotId,
      confidenceLabel: outcome.confidenceLabel,
      reviewReason: outcome.reviewReason,
      errorMessage: outcome.status === "failed" ? outcome.reviewReason : null
    };
  } catch (error) {
    const message = formatUnknownError(error);

    await service
      .from("scans")
      .update({
        status: "failed",
        processing_finished_at: nowIso(),
        error_message: message
      })
      .eq("id", scan.id);

    return {
      scanId: scan.id,
      status: "failed",
      cardId: null,
      valuationSnapshotId: null,
      confidenceLabel: null,
      reviewReason: null,
      errorMessage: message
    };
  }
}
