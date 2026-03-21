import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { CardPriceHistorySnapshotsRow, PriceHistoryPoint, PriceHistoryReadResult, PriceHistorySnapshot } from "@/types";

function toNumberOrNull(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function toCount(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.round(next) : 0;
}

function toSnapshot(row: Pick<
  CardPriceHistorySnapshotsRow,
  | "snapshot_date"
  | "reference_value"
  | "raw_avg_ask"
  | "psa9_avg_ask"
  | "psa10_avg_ask"
  | "listing_count_raw"
  | "listing_count_psa9"
  | "listing_count_psa10"
>): PriceHistorySnapshot {
  return {
    snapshotDate: new Date(row.snapshot_date).toISOString(),
    referenceValue: toNumberOrNull(row.reference_value),
    rawAvgAsk: toNumberOrNull(row.raw_avg_ask),
    psa9AvgAsk: toNumberOrNull(row.psa9_avg_ask),
    psa10AvgAsk: toNumberOrNull(row.psa10_avg_ask),
    listingCountRaw: toCount(row.listing_count_raw),
    listingCountPsa9: toCount(row.listing_count_psa9),
    listingCountPsa10: toCount(row.listing_count_psa10)
  };
}

function toPoint(snapshot: PriceHistorySnapshot): PriceHistoryPoint | null {
  if (!Number.isFinite(snapshot.referenceValue)) return null;
  return {
    snapshotDate: snapshot.snapshotDate,
    referenceValue: Number(snapshot.referenceValue),
    rawAvgAsk: snapshot.rawAvgAsk,
    psa9AvgAsk: snapshot.psa9AvgAsk,
    psa10AvgAsk: snapshot.psa10AvgAsk,
    listingCountRaw: snapshot.listingCountRaw,
    listingCountPsa9: snapshot.listingCountPsa9,
    listingCountPsa10: snapshot.listingCountPsa10
  };
}

class PriceHistoryService {
  async getCardHistory(cardId: string): Promise<PriceHistoryReadResult> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("card_price_history_snapshots")
      .select(
        "snapshot_date,reference_value,raw_avg_ask,psa9_avg_ask,psa10_avg_ask,listing_count_raw,listing_count_psa9,listing_count_psa10"
      )
      .eq("card_id", cardId)
      .order("snapshot_date", { ascending: true });

    if (error) throw error;

    const snapshots = ((data ?? []) as Array<any>).map((row) => toSnapshot(row));
    const points = snapshots.map((snapshot) => toPoint(snapshot)).filter(Boolean) as PriceHistoryPoint[];

    return { snapshots, points };
  }
}

export const priceHistoryService = new PriceHistoryService();
