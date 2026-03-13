import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { CardItem } from "@/types/models";
import type { ProcessScanResponse, ScanJobStatus, UUID } from "@/types";
import { rarityFromPrice } from "@/utils/rarity";

export interface ProcessedScanResult {
  scanId: UUID;
  status: ScanJobStatus;
  cardId: UUID | null;
  correctedCardId: UUID | null;
  valuationSnapshotId: UUID | null;
  confidenceLabel: "high" | "medium" | "low" | null;
  reviewReason: string | null;
  wasCorrected: boolean;
  correctionSource: string | null;
  correctionReason: string | null;
  reportedIncorrect: boolean;
  errorMessage: string | null;
  likelyMatches: CardItem[];
  card: CardItem | null;
}

export interface ScanProcessingService {
  startProcessing(scanId: UUID): Promise<ProcessScanResponse>;
  retryScanProcessing(scanId: UUID): Promise<ProcessScanResponse>;
  getScanStatus(scanId: UUID): Promise<ScanJobStatus | null>;
  getProcessedScanResult(scanId: UUID): Promise<ProcessedScanResult | null>;
}

async function resolveStorageUrl(bucket: "scan-fronts" | "scan-backs", path: string, supabase: any): Promise<string> {
  if (!path?.trim()) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) return path;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return "";
  return data?.signedUrl ?? "";
}

function toCardItem(scan: any, card: any | null, valuation: any | null): CardItem | null {
  if (!scan) return null;
  if (!card && !scan.identified_payload) return null;

  const payload = (scan.identified_payload ?? {}) as Record<string, any>;
  const playerInfo = payload.playerInfo ?? {};
  const playerName = card?.player_name ?? payload.playerName ?? "Unknown Player";
  const cardTitle = card?.card_title ?? payload.cardTitle ?? "Unidentified Card";

  const referenceValue = Number(valuation?.reference_value ?? payload.referenceValue ?? 0);
  const { rarityLabel, rarityLevel } = rarityFromPrice(referenceValue);
  return {
    id: scan.id,
    sport: card?.sport ?? payload.sport ?? undefined,
    sourceScanId: scan.id,
    sourceCardId: scan.corrected_card_id ?? scan.card_id ?? null,
    correctedCardId: scan.corrected_card_id ?? null,
    wasCorrected: Boolean(scan.was_corrected),
    correctionSource: scan.correction_source ?? null,
    correctionReason: scan.correction_reason ?? null,
    reportedIncorrect: Boolean(scan.reported_incorrect),
    valuationSnapshotId: scan.valuation_snapshot_id ?? null,
    scanStatus: scan.status,
    confidenceLabel: scan.confidence_label ?? undefined,
    reviewReason: scan.review_reason ?? null,
    playerName,
    cardTitle,
    year: Number(card?.year ?? payload.year ?? new Date(scan.scanned_at).getFullYear()),
    brand: card?.brand ?? payload.brand ?? "Unknown",
    set: card?.set_name ?? payload.setName ?? "Unknown",
    cardNumber: card?.card_number ?? payload.cardNumber ?? "",
    team: card?.team ?? payload.team ?? "Unknown",
    position: card?.position ?? payload.position ?? "",
    referenceValue,
    gradedUpside: Number(payload.gradedUpside ?? (payload.referenceValue ? Number(payload.referenceValue) * 1.35 : 0)),
    rarityLevel,
    rarityLabel,
    condition: payload.conditionEstimate ?? valuation?.condition_basis ?? "Unspecified",
    description: card?.description ?? payload.description ?? "Processed scan result.",
    playerInfo: {
      era: card?.era ?? playerInfo.era ?? "Unknown",
      careerNote: playerInfo.careerNote ?? ""
    },
    imageFront: scan.front_image_url ?? "",
    imageBack: scan.back_image_url ?? scan.front_image_url ?? "",
    dateScanned: scan.scanned_at
  };
}

class ScanProcessingServiceImpl implements ScanProcessingService {
  async startProcessing(scanId: UUID): Promise<ProcessScanResponse> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase.functions.invoke("process-scan", {
      body: { scanId }
    });

    if (error) throw error;
    return data as ProcessScanResponse;
  }

  async retryScanProcessing(scanId: UUID): Promise<ProcessScanResponse> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase.functions.invoke("process-scan", {
      body: { scanId, retry: true }
    });

    if (error) throw error;
    return data as ProcessScanResponse;
  }

  async getScanStatus(scanId: UUID): Promise<ScanJobStatus | null> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase.from("scans").select("status").eq("id", scanId).maybeSingle();
    if (error) throw error;
    return (data?.status as ScanJobStatus | undefined) ?? null;
  }

  async getProcessedScanResult(scanId: UUID): Promise<ProcessedScanResult | null> {
    const supabase = await getRequiredSupabaseClient();
    const { data: scan, error: scanError } = await supabase.from("scans").select("*").eq("id", scanId).maybeSingle();
    if (scanError) throw scanError;
    if (!scan) return null;

    const frontImageUrl = await resolveStorageUrl("scan-fronts", scan.front_image_path ?? "", supabase);
    const backImageUrl = await resolveStorageUrl("scan-backs", scan.back_image_path ?? "", supabase);
    const scanWithUrls = {
      ...scan,
      front_image_url: frontImageUrl,
      back_image_url: backImageUrl
    };

    const effectiveCardId = scan.corrected_card_id ?? scan.card_id;
    const cardPromise = effectiveCardId
      ? supabase.from("cards").select("*").eq("id", effectiveCardId).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any);

    const valuationPromise = effectiveCardId
      ? supabase
          .from("valuation_snapshots")
          .select("*")
          .eq("card_id", effectiveCardId)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : scan.valuation_snapshot_id
        ? supabase.from("valuation_snapshots").select("*").eq("id", scan.valuation_snapshot_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as any);

    const [cardResult, valuationResult] = await Promise.all([cardPromise, valuationPromise]);
    if (cardResult.error) throw cardResult.error;
    if (valuationResult.error) throw valuationResult.error;

    const likelyMatches: CardItem[] = [];
    const suggestions = Array.isArray(scan.suggested_matches) ? scan.suggested_matches : [];
    const suggestedIds = suggestions
      .map((item: any) => String(item?.cardId ?? item?.id ?? ""))
      .filter(Boolean)
      .slice(0, 5);
    if (suggestedIds.length) {
      const { data: suggestionCards, error: suggestionError } = await supabase
        .from("cards")
        .select("*")
        .in("id", suggestedIds);
      if (!suggestionError) {
        for (const suggestionCard of suggestionCards ?? []) {
          const match = toCardItem(
            { ...scanWithUrls, card_id: suggestionCard.id, corrected_card_id: suggestionCard.id },
            suggestionCard,
            null
          );
          if (match) likelyMatches.push(match);
        }
      }
    }

    return {
      scanId: scan.id,
      status: scan.status,
      cardId: scan.card_id,
      correctedCardId: scan.corrected_card_id ?? null,
      valuationSnapshotId: scan.valuation_snapshot_id,
      confidenceLabel: scan.confidence_label ?? null,
      reviewReason: scan.review_reason ?? null,
      wasCorrected: Boolean(scan.was_corrected),
      correctionSource: scan.correction_source ?? null,
      correctionReason: scan.correction_reason ?? null,
      reportedIncorrect: Boolean(scan.reported_incorrect),
      errorMessage: scan.error_message ?? null,
      likelyMatches,
      card: toCardItem(scanWithUrls, cardResult.data, valuationResult.data)
    };
  }
}

export const scanProcessingService: ScanProcessingService = new ScanProcessingServiceImpl();
