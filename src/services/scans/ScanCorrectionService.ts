import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { UUID } from "@/types";

export interface CardCorrectionFields {
  sport?: string | null;
  playerName?: string | null;
  year?: number | null;
  brand?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  team?: string | null;
}

export interface CardSearchResult {
  id: UUID;
  sport: string | null;
  playerName: string;
  year: number | null;
  brand: string | null;
  setName: string | null;
  cardNumber: string | null;
  team: string | null;
  cardTitle: string;
}

async function getLatestValuationSnapshotId(cardId: UUID): Promise<UUID | null> {
  const supabase = await getRequiredSupabaseClient();
  const { data, error } = await supabase
    .from("valuation_snapshots")
    .select("id")
    .eq("card_id", cardId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.id as UUID | undefined) ?? null;
}

async function syncCollectionAfterCorrection(params: {
  scanId: UUID;
  userId: UUID;
  oldCardId: UUID | null;
  newCardId: UUID;
  valuationSnapshotId: UUID | null;
  frontImagePath: string | null;
  backImagePath: string | null;
}): Promise<void> {
  const supabase = await getRequiredSupabaseClient();

  const { data: sourceItems, error: sourceError } = await supabase
    .from("collection_items")
    .select("id,card_id,source_scan_id")
    .eq("user_id", params.userId)
    .eq("source_scan_id", params.scanId)
    .order("created_at", { ascending: true });
  if (sourceError) throw sourceError;

  let sourceItem = (sourceItems ?? [])[0] ?? null;
  if (!sourceItem && params.oldCardId) {
    const { data: byOldCard, error: byOldCardError } = await supabase
      .from("collection_items")
      .select("id,card_id,source_scan_id")
      .eq("user_id", params.userId)
      .eq("card_id", params.oldCardId)
      .maybeSingle();
    if (byOldCardError) throw byOldCardError;
    sourceItem = byOldCard ?? null;
  }

  const { data: correctedItem, error: correctedError } = await supabase
    .from("collection_items")
    .select("id,card_id,source_scan_id")
    .eq("user_id", params.userId)
    .eq("card_id", params.newCardId)
    .maybeSingle();
  if (correctedError) throw correctedError;

  const sharedUpdate = {
    source_scan_id: params.scanId,
    latest_valuation_snapshot_id: params.valuationSnapshotId,
    valuation_snapshot_id: params.valuationSnapshotId,
    front_image_path: params.frontImagePath,
    back_image_path: params.backImagePath
  };

  if (sourceItem && correctedItem && sourceItem.id !== correctedItem.id) {
    const { error: updateCorrectedError } = await supabase
      .from("collection_items")
      .update(sharedUpdate)
      .eq("id", correctedItem.id)
      .eq("user_id", params.userId);
    if (updateCorrectedError) throw updateCorrectedError;

    const { error: deleteSourceError } = await supabase
      .from("collection_items")
      .delete()
      .eq("id", sourceItem.id)
      .eq("user_id", params.userId);
    if (deleteSourceError) throw deleteSourceError;
    return;
  }

  if (sourceItem) {
    const { error: sourceUpdateError } = await supabase
      .from("collection_items")
      .update({
        ...sharedUpdate,
        card_id: params.newCardId
      })
      .eq("id", sourceItem.id)
      .eq("user_id", params.userId);

    if (!sourceUpdateError) return;

    if ((sourceUpdateError as any)?.code === "23505" && correctedItem) {
      const { error: updateCorrectedError } = await supabase
        .from("collection_items")
        .update(sharedUpdate)
        .eq("id", correctedItem.id)
        .eq("user_id", params.userId);
      if (updateCorrectedError) throw updateCorrectedError;

      const { error: deleteSourceError } = await supabase
        .from("collection_items")
        .delete()
        .eq("id", sourceItem.id)
        .eq("user_id", params.userId);
      if (deleteSourceError) throw deleteSourceError;
      return;
    }

    throw sourceUpdateError;
  }

  if (correctedItem) {
    const { error: updateCorrectedError } = await supabase
      .from("collection_items")
      .update(sharedUpdate)
      .eq("id", correctedItem.id)
      .eq("user_id", params.userId);
    if (updateCorrectedError) throw updateCorrectedError;
  }
}

async function safeUpdateScan(scanId: UUID, payload: Record<string, unknown>): Promise<void> {
  const supabase = await getRequiredSupabaseClient();
  const mutablePayload = { ...payload };

  // Retry strategy for environments where optional correction columns are not yet applied.
  for (let i = 0; i < 6; i += 1) {
    const { error } = await supabase.from("scans").update(mutablePayload).eq("id", scanId);
    if (!error) return;

    const message = String((error as any)?.message ?? "");
    const code = String((error as any)?.code ?? "");
    const match = message.match(/Could not find the '([^']+)' column/);
    if (code === "PGRST204" && match?.[1]) {
      delete (mutablePayload as any)[match[1]];
      continue;
    }

    throw error;
  }
}

function cleanText(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  return v.length ? v : null;
}

function sanitizeSearchTerm(value: string): string {
  return value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
}

function norm(value?: string | null): string {
  return sanitizeSearchTerm(value ?? "").toLowerCase();
}

function overlapScore(left?: string | null, right?: string | null): number {
  const l = norm(left);
  const r = norm(right);
  if (!l || !r) return 0;
  if (l === r) return 3;
  if (l.includes(r) || r.includes(l)) return 2;
  const lTokens = l.split(" ").filter(Boolean);
  const rTokens = r.split(" ").filter(Boolean);
  const shared = lTokens.filter((token) => rTokens.includes(token));
  return shared.length >= 2 ? 1 : 0;
}

function scoreSearchCandidate(candidate: CardSearchResult, fields: CardCorrectionFields): number {
  let score = 0;
  score += overlapScore(candidate.playerName, fields.playerName) * 3;
  if (fields.year && candidate.year && Number(candidate.year) === Number(fields.year)) score += 5;
  score += overlapScore(candidate.brand, fields.brand) * 2;
  score += overlapScore(candidate.setName, fields.setName) * 2;
  score += overlapScore(candidate.cardNumber, fields.cardNumber) * 4;
  score += overlapScore(candidate.team, fields.team);
  score += overlapScore(candidate.sport, fields.sport);
  return score;
}

function buildManualEditQuery(fields: CardCorrectionFields): string {
  return [fields.playerName, fields.year, fields.brand, fields.setName, fields.cardNumber, fields.team, fields.sport]
    .filter((part) => part !== null && part !== undefined && String(part).trim().length > 0)
    .join(" ");
}

function computeCardTitle(fields: CardCorrectionFields): string {
  const parts = [fields.year ? String(fields.year) : "", cleanText(fields.brand), cleanText(fields.setName), cleanText(fields.cardNumber)]
    .filter(Boolean)
    .join(" ");
  return parts || cleanText(fields.playerName) || "Corrected Card";
}

export interface ScanCorrectionService {
  reportIncorrectResult(scanId: UUID, reason?: string | null): Promise<void>;
  searchCards(query: string, limit?: number): Promise<CardSearchResult[]>;
  getLikelyMatches(scanId: UUID, limit?: number): Promise<CardSearchResult[]>;
  applyCardSelection(scanId: UUID, cardId: UUID, source: "manual_edit" | "manual_search" | "likely_match", reason?: string | null): Promise<void>;
  applyManualEdits(scanId: UUID, fields: CardCorrectionFields, reason?: string | null): Promise<UUID>;
}

class ScanCorrectionServiceImpl implements ScanCorrectionService {
  async reportIncorrectResult(scanId: UUID, reason?: string | null): Promise<void> {
    await safeUpdateScan(scanId, {
      reported_incorrect: true,
      reported_reason: cleanText(reason),
      correction_source: "report_only"
    });
  }

  async searchCards(query: string, limit = 10): Promise<CardSearchResult[]> {
    const supabase = await getRequiredSupabaseClient();
    const q = sanitizeSearchTerm(query);
    if (!q) return [];
    const tokens = q
      .split(/[\s\-_/]+/)
      .map((token) => sanitizeSearchTerm(token))
      .filter((token) => token.length >= 2);

    const searchTerms = Array.from(
      new Set([
        q,
        tokens.slice(0, 3).join(" "),
        ...tokens
      ].filter((term) => term.length >= 2))
    ).slice(0, 8);

    const byId = new Map<string, CardSearchResult>();

    for (const term of searchTerms) {
      const like = `%${term}%`;
      const { data, error } = await supabase
        .from("cards")
        .select("id,sport,player_name,year,brand,set_name,card_number,team,card_title")
        .or(
          [
            `player_name.ilike.${like}`,
            `sport.ilike.${like}`,
            `brand.ilike.${like}`,
            `set_name.ilike.${like}`,
            `card_number.ilike.${like}`,
            `team.ilike.${like}`
          ].join(",")
        )
        .limit(limit);

      if (error) throw error;

      for (const row of data ?? []) {
        if (byId.has(row.id)) continue;
        byId.set(row.id, {
          id: row.id,
          sport: row.sport,
          playerName: row.player_name,
          year: row.year,
          brand: row.brand,
          setName: row.set_name,
          cardNumber: row.card_number,
          team: row.team,
          cardTitle: row.card_title
        });
        if (byId.size >= limit) break;
      }

      if (byId.size >= limit) break;
    }

    return Array.from(byId.values()).slice(0, limit);
  }

  async getLikelyMatches(scanId: UUID, limit = 5): Promise<CardSearchResult[]> {
    const supabase = await getRequiredSupabaseClient();
    const { data: scan, error } = await supabase.from("scans").select("identified_payload,suggested_matches").eq("id", scanId).maybeSingle();
    if (error) throw error;
    if (!scan) return [];

    const suggested = Array.isArray(scan.suggested_matches) ? scan.suggested_matches : [];
    const suggestedIds = suggested
      .map((item: any) => String(item?.cardId ?? item?.id ?? ""))
      .filter(Boolean)
      .slice(0, limit);

    if (suggestedIds.length) {
      const { data: cards, error: cardsError } = await supabase
        .from("cards")
        .select("id,sport,player_name,year,brand,set_name,card_number,team,card_title")
        .in("id", suggestedIds);
      if (cardsError) throw cardsError;
      return (cards ?? []).map((row: any) => ({
        id: row.id,
        sport: row.sport,
        playerName: row.player_name,
        year: row.year,
        brand: row.brand,
        setName: row.set_name,
        cardNumber: row.card_number,
        team: row.team,
        cardTitle: row.card_title
      }));
    }

    const payload = (scan.identified_payload ?? {}) as Record<string, any>;
    const queries = [
      payload.playerName,
      [payload.year, payload.brand, payload.setName, payload.cardNumber].filter(Boolean).join(" "),
      [payload.playerName, payload.team].filter(Boolean).join(" ")
    ].filter((x) => typeof x === "string" && x.trim().length > 0) as string[];

    for (const query of queries) {
      const results = await this.searchCards(query, limit);
      if (results.length) {
        return results.slice(0, limit);
      }
    }

    return [];
  }

  async applyCardSelection(
    scanId: UUID,
    cardId: UUID,
    source: "manual_edit" | "manual_search" | "likely_match",
    reason?: string | null
  ): Promise<void> {
    const supabase = await getRequiredSupabaseClient();
    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .select("id,user_id,card_id,corrected_card_id,front_image_path,back_image_path")
      .eq("id", scanId)
      .maybeSingle();
    if (scanError) throw scanError;
    if (!scan) throw new Error("Scan not found.");

    const oldCardId = (scan.corrected_card_id ?? scan.card_id ?? null) as UUID | null;
    const latestValuationId = await getLatestValuationSnapshotId(cardId);

    await safeUpdateScan(scanId, {
      corrected_card_id: cardId,
      card_id: cardId,
      valuation_snapshot_id: latestValuationId,
      was_corrected: true,
      correction_source: source,
      correction_reason: cleanText(reason),
      reported_incorrect: true
    });

    await syncCollectionAfterCorrection({
      scanId,
      userId: scan.user_id as UUID,
      oldCardId,
      newCardId: cardId,
      valuationSnapshotId: latestValuationId,
      frontImagePath: (scan.front_image_path ?? null) as string | null,
      backImagePath: (scan.back_image_path ?? null) as string | null
    });
  }

  async applyManualEdits(scanId: UUID, fields: CardCorrectionFields, reason?: string | null): Promise<UUID> {
    const supabase = await getRequiredSupabaseClient();

    const playerName = cleanText(fields.playerName) ?? "Unknown Player";
    const cardTitle = computeCardTitle(fields);
    const normalized = {
      sport: cleanText(fields.sport),
      player_name: playerName,
      year: fields.year ?? null,
      brand: cleanText(fields.brand),
      set_name: cleanText(fields.setName),
      card_number: cleanText(fields.cardNumber),
      team: cleanText(fields.team)
    };

    const manualQuery = buildManualEditQuery(fields);
    let matchedCard: CardSearchResult | null = null;
    if (manualQuery) {
      const searchMatches = await this.searchCards(manualQuery, 20);
      let best: CardSearchResult | null = null;
      let bestScore = -1;
      for (const candidate of searchMatches) {
        const score = scoreSearchCandidate(candidate, fields);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      const hasStrongIdentitySignal =
        (best ? overlapScore(best.playerName, normalized.player_name) : 0) >= 2 ||
        (best ? overlapScore(best.cardNumber, normalized.card_number) : 0) >= 2 ||
        (best ? overlapScore(best.setName, normalized.set_name) : 0) >= 2;
      const yearCompatible = !fields.year || !best?.year || Number(best.year) === Number(fields.year);

      if (best && bestScore >= 6 && hasStrongIdentitySignal && yearCompatible) matchedCard = best;
    }

    let cardId: UUID;
    if (matchedCard?.id) {
      cardId = matchedCard.id;
      const { error: updateError } = await supabase
        .from("cards")
        .update({
          sport: normalized.sport,
          card_title: cardTitle,
          year: normalized.year,
          brand: normalized.brand,
          set_name: normalized.set_name,
          card_number: normalized.card_number,
          team: normalized.team,
          metadata: {
            correctionSource: "manual_edit"
          }
        })
        .eq("id", cardId);
      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("cards")
        .insert({
          sport: normalized.sport,
          player_name: normalized.player_name,
          card_title: cardTitle,
          year: normalized.year,
          brand: normalized.brand,
          set_name: normalized.set_name,
          card_number: normalized.card_number,
          team: normalized.team,
          position: null,
          rarity_label: null,
          metadata: { correctionSource: "manual_edit" }
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      cardId = inserted.id;

      // Preserve a usable reference value when this becomes a brand new card.
      const { data: scanRow, error: scanError } = await supabase
        .from("scans")
        .select("identified_payload")
        .eq("id", scanId)
        .maybeSingle();
      if (scanError) throw scanError;

      const payload = (scanRow?.identified_payload ?? {}) as Record<string, any>;
      const referenceValue = Number(payload.referenceValue ?? 0);
      if (referenceValue > 0) {
        await supabase.from("valuation_snapshots").insert({
          card_id: cardId,
          reference_value: referenceValue,
          source: "manual_edit_fallback",
          condition_basis: payload.conditionEstimate ?? "Unspecified",
          fetched_at: new Date().toISOString(),
          currency: "USD",
          source_confidence: Number(payload.confidence ?? 0) || null,
          metadata: {
            createdBy: "manual_edit",
            basedOnScanId: scanId
          }
        });
      }
    }

    await this.applyCardSelection(scanId, cardId, "manual_edit", cleanText(reason) ?? "Manual edit correction");

    await safeUpdateScan(scanId, {
      correction_source: "manual_edit",
      correction_reason: cleanText(reason) ?? "Manual edit correction"
    });

    return cardId;
  }
}

export const scanCorrectionService: ScanCorrectionService = new ScanCorrectionServiceImpl();
