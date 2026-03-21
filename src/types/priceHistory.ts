import type { CardPriceHistorySnapshotsRow } from "@/types/db";

export type PriceHistoryTimeframe = "7D" | "30D" | "90D" | "ALL";

export type PriceHistorySnapshot = {
  snapshotDate: CardPriceHistorySnapshotsRow["snapshot_date"];
  referenceValue: number | null;
  rawAvgAsk: number | null;
  psa9AvgAsk: number | null;
  psa10AvgAsk: number | null;
  listingCountRaw: number;
  listingCountPsa9: number;
  listingCountPsa10: number;
};

export type PriceHistoryPoint = {
  snapshotDate: string;
  referenceValue: number;
  rawAvgAsk: number | null;
  psa9AvgAsk: number | null;
  psa10AvgAsk: number | null;
  listingCountRaw: number;
  listingCountPsa9: number;
  listingCountPsa10: number;
};

export type PriceHistoryReadResult = {
  snapshots: PriceHistorySnapshot[];
  points: PriceHistoryPoint[];
};
