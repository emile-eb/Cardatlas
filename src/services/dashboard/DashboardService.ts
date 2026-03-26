import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import { collectionService } from "@/services/collection/CollectionService";
import { subscriptionsService } from "@/services/subscriptions/SubscriptionsService";
import type { HomeDashboardResponse, UUID } from "@/types";
import { rarityFromPrice } from "@/utils/rarity";

async function resolveStorageUrl(bucket: "scan-fronts" | "scan-backs", path: string, supabase: any): Promise<string> {
  if (!path?.trim()) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) return path;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return "";
  return data?.signedUrl ?? "";
}

export interface DashboardService {
  getHomeDashboard(userId: UUID): Promise<HomeDashboardResponse>;
}

class DashboardServiceImpl implements DashboardService {
  async getHomeDashboard(userId: UUID): Promise<HomeDashboardResponse> {
    const [collectionItems, usage, entitlement, freeTrial, subscription] = await Promise.all([
      collectionService.listByUser(userId),
      subscriptionsService.getUsageState(userId),
      subscriptionsService.getEntitlements(userId),
      subscriptionsService.startTrialEligibilityCheck(userId),
      subscriptionsService.getState(userId)
    ]);

    const supabase = await getRequiredSupabaseClient();

    const { data: scansRows, error: scansError } = await supabase
      .from("scans")
      .select("*")
      .eq("user_id", userId)
      .order("scanned_at", { ascending: false })
      .limit(20);
    if (scansError) throw scansError;

    const cardIds = Array.from(
      new Set([
        ...collectionItems.map((item) => item.cardId),
        ...(scansRows ?? []).map((scan: any) => scan.card_id).filter(Boolean)
      ])
    );

    const valuationIds = Array.from(
      new Set([
        ...collectionItems.map((item) => item.latestValuationSnapshotId),
        ...(scansRows ?? []).map((scan: any) => scan.valuation_snapshot_id).filter(Boolean)
      ].filter(Boolean))
    );

    const { data: cardsRows, error: cardsError } = cardIds.length
      ? await supabase.from("cards").select("*").in("id", cardIds)
      : { data: [], error: null };
    if (cardsError) throw cardsError;

    const { data: valuationRows, error: valuationsError } = valuationIds.length
      ? await supabase.from("valuation_snapshots").select("*").in("id", valuationIds)
      : { data: [], error: null };
    if (valuationsError) throw valuationsError;

    const cardMap = new Map<string, any>((cardsRows ?? []).map((card: any) => [card.id as string, card]));
    const valuationMap = new Map<string, any>((valuationRows ?? []).map((valuation: any) => [valuation.id as string, valuation]));

    const recentScans = await Promise.all(
      (scansRows ?? []).map(async (scan: any) => {
        const effectiveCardId = scan.corrected_card_id ?? scan.card_id ?? null;
        const card = effectiveCardId ? cardMap.get(effectiveCardId) : null;
        const payload = {
          ...(scan.identified_payload ?? {}),
          ...(card
            ? {
                sport: card.sport ?? undefined,
                playerName: card.player_name ?? undefined,
                cardTitle: card.card_title ?? undefined,
                year: card.year ?? undefined,
                brand: card.brand ?? undefined,
                setName: card.set_name ?? undefined,
                cardNumber: card.card_number ?? undefined,
                team: card.team ?? undefined,
                position: card.position ?? undefined,
                description: card.description ?? undefined,
                playerInfo: card.player_info ?? undefined,
                gradeScore:
                  (scan.identified_payload as Record<string, unknown> | null | undefined)?.gradeScore ??
                  (card.metadata as Record<string, unknown> | null | undefined)?.gradeScore ??
                  undefined
              }
            : {})
        };
        const frontImagePath = await resolveStorageUrl("scan-fronts", scan.front_image_path ?? "", supabase);
        const backImagePath = await resolveStorageUrl("scan-backs", scan.back_image_path ?? "", supabase);
        return {
          id: scan.id,
          userId: scan.user_id,
          status: scan.status,
          cardId: effectiveCardId,
          valuationSnapshotId: scan.valuation_snapshot_id ?? null,
          frontImagePath,
          backImagePath,
          processingStartedAt: scan.processing_started_at ?? null,
          processingFinishedAt: scan.processing_finished_at ?? null,
          completedAt: scan.completed_at ?? null,
          identifiedPayload: payload,
          confidenceLabel: scan.confidence_label ?? null,
          reviewReason: scan.review_reason ?? null,
          wasCorrected: scan.was_corrected ?? null,
          correctionSource: scan.correction_source ?? null,
          correctionReason: scan.correction_reason ?? null,
          correctedCardId: scan.corrected_card_id ?? null,
          suggestedMatches: scan.suggested_matches ?? null,
          reportedIncorrect: scan.reported_incorrect ?? null,
          reportedReason: scan.reported_reason ?? null,
          errorMessage: scan.error_message ?? null,
          scannedAt: scan.scanned_at
        };
      })
    );

    const collectionHighlights = await Promise.all(
      collectionItems
      .map((item) => {
        const card = cardMap.get(item.cardId);
        if (!card) return null;

        const valuation = item.latestValuationSnapshotId ? valuationMap.get(item.latestValuationSnapshotId) : null;
        const baseValue = Number((valuation as any)?.reference_value ?? 0);
        const latestValue = Number(item.adjustedValue ?? baseValue);

        const { rarityLabel, rarityLevel } = rarityFromPrice(latestValue);
        return {
          collectionItemId: item.id,
          isFavorite: Boolean(item.isFavorite),
          notes: item.notes ?? null,
          addedAt: item.createdAt,
          isAutograph: Boolean(item.isAutograph),
          isMemorabilia: Boolean(item.isMemorabilia),
          isParallel: Boolean(item.isParallel),
          parallelName: item.parallelName ?? null,
          serialNumber: item.serialNumber ?? null,
          isGraded: Boolean(item.isGraded),
          gradingCompany: item.gradingCompany ?? null,
          grade: item.grade ?? null,
          attributesUpdatedAt: item.attributesUpdatedAt ?? null,
          adjustedValue: item.adjustedValue ?? null,
          valuationSource: item.valuationSource ?? null,
          valuationUpdatedAt: item.valuationUpdatedAt ?? null,
          card: {
            id: card.id,
            sport: card.sport ?? null,
            playerName: card.player_name,
            cardTitle: card.card_title,
            year: card.year,
            brand: card.brand,
            set: card.set_name,
            cardNumber: card.card_number,
            team: card.team,
            position: card.position,
            rarityLevel: card.rarity_level ?? rarityLevel,
            rarityLabel,
            era: card.era ?? null,
            description: card.description ?? null,
            playerInfo: card.player_info ?? null,
            metadata: card.metadata ?? null,
            imageFront: card.canonical_front_image_path ?? null,
            imageBack: card.canonical_back_image_path ?? null
          },
          latestValue,
          baseValue
        };
      })
      .map(async (entry) => {
        if (!entry) return null;
        const signedFront = await resolveStorageUrl("scan-fronts", entry.card.imageFront ?? "", supabase);
        const signedBack = await resolveStorageUrl("scan-backs", entry.card.imageBack ?? "", supabase);
        return {
          ...entry,
          card: {
            ...entry.card,
            imageFront: signedFront || entry.card.imageFront,
            imageBack: signedBack || entry.card.imageBack
          }
        };
      })
    );
    const filteredHighlights = collectionHighlights.filter(Boolean) as HomeDashboardResponse["collectionHighlights"];

    const portfolioValue = filteredHighlights.reduce((sum, item) => sum + item.latestValue, 0);
    const teamCount = new Set(filteredHighlights.map((item) => item.card.team)).size;

    return {
      userId,
      portfolioValue,
      cardCount: collectionItems.length,
      teamCount,
      usage,
      entitlement,
      freeTrial,
      scansRemaining: usage.scansRemaining,
      canUseAI: entitlement.isPremium,
      subscription,
      recentScans,
      latestValuation: filteredHighlights[0]
        ? {
            cardId: filteredHighlights[0].card.id,
            conditionBasis: "Unspecified",
            referenceValue: filteredHighlights[0].latestValue,
            source: "model_estimate",
            valuedAt: new Date().toISOString(),
            lowEstimate: null,
            highEstimate: null
          }
        : undefined,
      personalization: {},
      collectionHighlights: filteredHighlights
    };
  }
}

export const dashboardService: DashboardService = new DashboardServiceImpl();
