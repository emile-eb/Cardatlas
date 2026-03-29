import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { CardItem } from "@/types/models";
import type { CollectionItem, UUID } from "@/types";
import { calculateAttributeAdjustedValue } from "@/services/valuation/CollectionValuationService";

function normalizeGradeScenario(grade?: string | null): "9" | "10" | null {
  const value = Number((grade ?? "").trim());
  if (!Number.isFinite(value)) return null;
  if (value >= 9.5) return "10";
  if (value >= 9) return "9";
  return null;
}

async function resolveGradingScenarioValue(
  supabase: any,
  cardId: UUID,
  grade?: string | null
): Promise<number | null> {
  const preferredScenario = normalizeGradeScenario(grade);
  const scenarioOrder = preferredScenario === "10" ? ["10", "9"] : ["9", "10"];

  const { data, error } = await supabase
    .from("card_grading_scenarios")
    .select("assumed_grade,estimated_value")
    .eq("card_id", cardId)
    .eq("grading_company", "PSA")
    .in("assumed_grade", ["9", "10"]);

  if (error) throw error;

  const rows = (data ?? []) as Array<{ assumed_grade: string; estimated_value: number | null }>;
  for (const assumedGrade of scenarioOrder) {
    const match = rows.find((row) => String(row.assumed_grade) === assumedGrade);
    const estimatedValue = Number(match?.estimated_value ?? 0);
    if (Number.isFinite(estimatedValue) && estimatedValue > 0) {
      return estimatedValue;
    }
  }

  return null;
}

export interface AddCollectionItemInput {
  userId: UUID;
  card: CardItem;
  sourceScanId?: UUID | null;
}

export interface AddProcessedScanCollectionItemInput {
  userId: UUID;
  scanId: UUID;
}

export interface CollectionService {
  listByUser(userId: UUID): Promise<CollectionItem[]>;
  addItem(input: AddCollectionItemInput): Promise<CollectionItem>;
  addProcessedScanItem(input: AddProcessedScanCollectionItemInput): Promise<CollectionItem>;
  toggleFavorite(userId: UUID, collectionItemId: UUID, nextValue: boolean): Promise<CollectionItem>;
  updateItem(
    userId: UUID,
    collectionItemId: UUID,
    input: {
      notes?: string | null;
      isFavorite?: boolean;
      isAutograph?: boolean;
      isMemorabilia?: boolean;
      isParallel?: boolean;
      parallelName?: string | null;
      serialNumber?: string | null;
      isGraded?: boolean;
      gradingCompany?: string | null;
      grade?: string | null;
    }
  ): Promise<CollectionItem>;
  removeItem(userId: UUID, collectionItemId: UUID): Promise<void>;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stableUuidFromString(input: string): string {
  const seed = input || "cardatlas";
  const chars = "0123456789abcdef";
  const bytes: string[] = [];

  for (let i = 0; i < 32; i += 1) {
    const code = seed.charCodeAt(i % seed.length);
    const nibble = (code + i * 11) % 16;
    bytes.push(chars[nibble]);
  }

  bytes[12] = "4";
  bytes[16] = "a";

  return `${bytes.slice(0, 8).join("")}-${bytes.slice(8, 12).join("")}-${bytes.slice(12, 16).join("")}-${bytes
    .slice(16, 20)
    .join("")}-${bytes.slice(20, 32).join("")}`;
}

function toCollectionItem(item: any): CollectionItem {
  return {
    id: item.id,
    userId: item.user_id,
    cardId: item.card_id,
    sourceScanId: item.source_scan_id,
    latestValuationSnapshotId: item.latest_valuation_snapshot_id,
    acquiredAt: item.acquired_at,
    notes: item.notes,
    isFavorite: item.is_favorite,
    isAutograph: item.is_autograph,
    isMemorabilia: item.is_memorabilia,
    isParallel: item.is_parallel,
    parallelName: item.parallel_name,
    serialNumber: item.serial_number,
    isGraded: item.is_graded,
    gradingCompany: item.grading_company,
    grade: item.grade,
    attributesUpdatedAt: item.attributes_updated_at ?? null,
    adjustedValue: item.adjusted_value ?? null,
    valuationSource: item.valuation_source ?? null,
    valuationUpdatedAt: item.valuation_updated_at ?? null,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

class CollectionServiceImpl implements CollectionService {
  async listByUser(userId: UUID): Promise<CollectionItem[]> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("collection_items")
      .select(
        "id,user_id,card_id,source_scan_id,latest_valuation_snapshot_id,acquired_at,notes,is_favorite,is_autograph,is_memorabilia,is_parallel,parallel_name,serial_number,is_graded,grading_company,grade,attributes_updated_at,adjusted_value,valuation_source,valuation_updated_at,created_at,updated_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(toCollectionItem);
  }

  async addItem(input: AddCollectionItemInput): Promise<CollectionItem> {
    const supabase = await getRequiredSupabaseClient();
    const cardId = isUuid(input.card.sourceCardId ?? "") ? (input.card.sourceCardId as string) : (isUuid(input.card.id) ? input.card.id : stableUuidFromString(input.card.id));

    const { error: cardError } = await supabase.from("cards").upsert(
      {
        id: cardId,
        sport: null,
        player_name: input.card.playerName,
        card_title: input.card.cardTitle,
        year: input.card.year,
        brand: input.card.brand,
        set_name: input.card.set,
        card_number: input.card.cardNumber,
        team: input.card.team,
        position: input.card.position,
        rarity_label: input.card.rarityLabel,
        description: input.card.description,
        era: input.card.playerInfo?.era ?? null,
        player_info: input.card.playerInfo ?? null,
        metadata: {
          source: "client_add_item",
          gradeScore: input.card.gradeScore ?? null
        }
      },
      { onConflict: "id" }
    );
    if (cardError) throw cardError;

    const valuationSnapshotId = input.card.valuationSnapshotId ?? null;
    const sourceScanId = input.sourceScanId ?? (input.card.sourceScanId as UUID | undefined) ?? null;

    return this.upsertCollectionItemByUserAndCard({
      userId: input.userId,
      cardId,
      sourceScanId,
      valuationSnapshotId,
      frontImagePath: input.card.imageFront ?? null,
      backImagePath: input.card.imageBack ?? null
    });
  }

  async addProcessedScanItem(input: AddProcessedScanCollectionItemInput): Promise<CollectionItem> {
    const supabase = await getRequiredSupabaseClient();
    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .select("id,user_id,status,card_id,valuation_snapshot_id,front_image_path,back_image_path")
      .eq("id", input.scanId)
      .eq("user_id", input.userId)
      .maybeSingle();

    if (scanError) throw scanError;
    if (!scan) throw new Error("Scan not found.");
    if (scan.status !== "completed" && scan.status !== "needs_review") {
      throw new Error("Scan must finish processing before adding to collection.");
    }
    if (!scan.card_id) throw new Error("Scan does not have a processed card id.");

    return this.upsertCollectionItemByUserAndCard({
      userId: input.userId,
      cardId: scan.card_id,
      sourceScanId: scan.id,
      valuationSnapshotId: scan.valuation_snapshot_id ?? null,
      frontImagePath: scan.front_image_path ?? null,
      backImagePath: scan.back_image_path ?? null
    });
  }

  async toggleFavorite(userId: UUID, collectionItemId: UUID, nextValue: boolean): Promise<CollectionItem> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("collection_items")
      .update({ is_favorite: nextValue })
      .eq("id", collectionItemId)
      .eq("user_id", userId)
      .select(
        "id,user_id,card_id,source_scan_id,latest_valuation_snapshot_id,acquired_at,notes,is_favorite,is_autograph,is_memorabilia,is_parallel,parallel_name,serial_number,is_graded,grading_company,grade,attributes_updated_at,adjusted_value,valuation_source,valuation_updated_at,created_at,updated_at"
      )
      .single();

    if (error) throw error;
    return toCollectionItem(data);
  }

  async updateItem(
    userId: UUID,
    collectionItemId: UUID,
    input: {
      notes?: string | null;
      isFavorite?: boolean;
      isAutograph?: boolean;
      isMemorabilia?: boolean;
      isParallel?: boolean;
      parallelName?: string | null;
      serialNumber?: string | null;
      isGraded?: boolean;
      gradingCompany?: string | null;
      grade?: string | null;
    }
  ): Promise<CollectionItem> {
    const supabase = await getRequiredSupabaseClient();
    const payload: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(input, "notes")) payload.notes = input.notes ?? null;
    if (Object.prototype.hasOwnProperty.call(input, "isFavorite")) payload.is_favorite = Boolean(input.isFavorite);
    if (Object.prototype.hasOwnProperty.call(input, "isAutograph")) payload.is_autograph = Boolean(input.isAutograph);
    if (Object.prototype.hasOwnProperty.call(input, "isMemorabilia")) payload.is_memorabilia = Boolean(input.isMemorabilia);
    if (Object.prototype.hasOwnProperty.call(input, "isParallel")) payload.is_parallel = Boolean(input.isParallel);
    if (Object.prototype.hasOwnProperty.call(input, "parallelName")) payload.parallel_name = input.parallelName ?? null;
    if (Object.prototype.hasOwnProperty.call(input, "serialNumber")) payload.serial_number = input.serialNumber ?? null;
    if (Object.prototype.hasOwnProperty.call(input, "isGraded")) payload.is_graded = Boolean(input.isGraded);
    if (Object.prototype.hasOwnProperty.call(input, "gradingCompany")) payload.grading_company = input.gradingCompany ?? null;
    if (Object.prototype.hasOwnProperty.call(input, "grade")) payload.grade = input.grade ?? null;
    payload.attributes_updated_at = new Date().toISOString();

    const { data: existingItem, error: existingItemError } = await supabase
      .from("collection_items")
      .select("card_id,latest_valuation_snapshot_id,is_autograph,is_memorabilia,is_parallel,parallel_name,serial_number,is_graded,grading_company,grade")
      .eq("id", collectionItemId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingItemError) throw existingItemError;

    const latestSnapshotId = existingItem?.latest_valuation_snapshot_id ?? null;
    let baseReferenceValue = 0;
    if (latestSnapshotId) {
      const { data: valuationRow, error: valuationError } = await supabase
        .from("valuation_snapshots")
        .select("reference_value")
        .eq("id", latestSnapshotId)
        .maybeSingle();
      if (valuationError) throw valuationError;
      baseReferenceValue = Number(valuationRow?.reference_value ?? 0);
    }

    const mergedAttributes = {
      isAutograph: Object.prototype.hasOwnProperty.call(input, "isAutograph")
        ? Boolean(input.isAutograph)
        : Boolean(existingItem?.is_autograph),
      isMemorabilia: Object.prototype.hasOwnProperty.call(input, "isMemorabilia")
        ? Boolean(input.isMemorabilia)
        : Boolean(existingItem?.is_memorabilia),
      isParallel: Object.prototype.hasOwnProperty.call(input, "isParallel")
        ? Boolean(input.isParallel)
        : Boolean(existingItem?.is_parallel),
      parallelName: Object.prototype.hasOwnProperty.call(input, "parallelName")
        ? input.parallelName ?? null
        : existingItem?.parallel_name ?? null,
      serialNumber: Object.prototype.hasOwnProperty.call(input, "serialNumber")
        ? input.serialNumber ?? null
        : existingItem?.serial_number ?? null,
      isGraded: Object.prototype.hasOwnProperty.call(input, "isGraded")
        ? Boolean(input.isGraded)
        : Boolean(existingItem?.is_graded),
      grade: Object.prototype.hasOwnProperty.call(input, "grade") ? input.grade ?? null : existingItem?.grade ?? null
    };

    const scenarioAdjustedValue =
      mergedAttributes.isGraded && existingItem?.card_id
        ? await resolveGradingScenarioValue(supabase, existingItem.card_id as UUID, mergedAttributes.grade)
        : null;

    const valuation = calculateAttributeAdjustedValue({
      baseReferenceValue,
      ...mergedAttributes
    });

    payload.adjusted_value =
      scenarioAdjustedValue ??
      (baseReferenceValue > 0 ? valuation.adjustedValue : null);
    payload.valuation_source = scenarioAdjustedValue
      ? "grading_outlook"
      : baseReferenceValue > 0
        ? "attribute_adjusted"
        : null;
    payload.valuation_updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("collection_items")
      .update(payload)
      .eq("id", collectionItemId)
      .eq("user_id", userId)
      .select(
        "id,user_id,card_id,source_scan_id,latest_valuation_snapshot_id,acquired_at,notes,is_favorite,is_autograph,is_memorabilia,is_parallel,parallel_name,serial_number,is_graded,grading_company,grade,attributes_updated_at,adjusted_value,valuation_source,valuation_updated_at,created_at,updated_at"
      )
      .single();

    if (error) throw error;
    return toCollectionItem(data);
  }

  async removeItem(userId: UUID, collectionItemId: UUID): Promise<void> {
    const supabase = await getRequiredSupabaseClient();
    const { error } = await supabase.from("collection_items").delete().eq("id", collectionItemId).eq("user_id", userId);
    if (error) throw error;
  }

  private async upsertCollectionItemByUserAndCard(input: {
    userId: UUID;
    cardId: UUID;
    sourceScanId: UUID | null;
    valuationSnapshotId: UUID | null;
    frontImagePath: string | null;
    backImagePath: string | null;
  }): Promise<CollectionItem> {
    const supabase = await getRequiredSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from("collection_items")
      .select("id")
      .eq("user_id", input.userId)
      .eq("card_id", input.cardId)
      .maybeSingle();

    if (existingError) throw existingError;

    const payload = {
      user_id: input.userId,
      card_id: input.cardId,
      source_scan_id: input.sourceScanId,
      latest_valuation_snapshot_id: input.valuationSnapshotId,
      valuation_snapshot_id: input.valuationSnapshotId,
      front_image_path: input.frontImagePath,
      back_image_path: input.backImagePath,
      is_favorite: false
    };

    const query = existing?.id
      ? supabase
          .from("collection_items")
          .update({
            source_scan_id: payload.source_scan_id,
            latest_valuation_snapshot_id: payload.latest_valuation_snapshot_id,
            valuation_snapshot_id: payload.valuation_snapshot_id,
            front_image_path: payload.front_image_path,
            back_image_path: payload.back_image_path
          })
          .eq("id", existing.id)
      : supabase.from("collection_items").insert(payload);

    const { data, error } = await query
      .select(
        "id,user_id,card_id,source_scan_id,latest_valuation_snapshot_id,acquired_at,notes,is_favorite,is_autograph,is_memorabilia,is_parallel,parallel_name,serial_number,is_graded,grading_company,grade,attributes_updated_at,adjusted_value,valuation_source,valuation_updated_at,created_at,updated_at"
      )
      .single();

    if (error) throw error;
    return toCollectionItem(data);
  }
}

export const collectionService: CollectionService = new CollectionServiceImpl();
