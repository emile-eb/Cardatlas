import type { PriceHistoryPoint, PriceHistoryTimeframe } from "@/types";

export type ChartPoint = { x: number; y: number };

export const PRICE_HISTORY_TIMEFRAMES: PriceHistoryTimeframe[] = ["7D", "30D", "90D", "ALL"];

const TIMEFRAME_DAYS: Record<Exclude<PriceHistoryTimeframe, "ALL">, number> = {
  "7D": 7,
  "30D": 30,
  "90D": 90
};

export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function filterHistoryPoints(points: PriceHistoryPoint[], timeframe: PriceHistoryTimeframe): PriceHistoryPoint[] {
  if (timeframe === "ALL" || points.length <= 1) return points;

  const latest = points[points.length - 1];
  if (!latest) return [];

  const days = TIMEFRAME_DAYS[timeframe];
  const latestTime = Date.parse(latest.snapshotDate);
  const windowStart = latestTime - (days - 1) * 24 * 60 * 60 * 1000;
  return points.filter((point) => Date.parse(point.snapshotDate) >= windowStart);
}

export function toChartPoints(values: number[], width: number, height: number): ChartPoint[] {
  if (!values.length || width <= 0 || height <= 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0.0001);

  return values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const normalized = (value - min) / spread;
    const y = height - normalized * height;
    return { x, y };
  });
}

export function getHistoryDensity(pointsCount: number): "empty" | "single" | "building" | "ready" {
  if (pointsCount <= 0) return "empty";
  if (pointsCount === 1) return "single";
  if (pointsCount <= 4) return "building";
  return "ready";
}

export function getHistoryRangeStats(points: PriceHistoryPoint[]) {
  if (!points.length) return null;

  const values = points.map((point) => point.referenceValue);
  const first = values[0];
  const last = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const deltaPct = first > 0 ? ((last - first) / first) * 100 : 0;

  return { first, last, min, max, deltaPct };
}

export function getHistorySupportCopy(pointsCount: number): string {
  const density = getHistoryDensity(pointsCount);
  if (density === "empty") {
    return "Tracked history is not available for this card yet.";
  }
  if (density === "single") {
    return "Tracking has started. The trend will build as more daily snapshots are collected.";
  }
  if (density === "building") {
    return "Tracking is still building for this card, so the early trend is directional rather than complete.";
  }
  return "Historical snapshots show how the CardAtlas Reference Value has moved over time.";
}

export function getTrendInsight(deltaPct: number, pointsCount: number) {
  const density = getHistoryDensity(pointsCount);
  if (density === "empty") {
    return "CardAtlas will build this view as tracked snapshots accumulate for this card.";
  }
  if (density === "single") {
    return "This is the first saved reference point for the card. Trend insight will sharpen as more history is captured.";
  }
  if (density === "building") {
    return "Early tracked history is starting to form around the current CardAtlas Reference Value, but the trend is still developing.";
  }
  if (Math.abs(deltaPct) < 4) {
    return "Historical movement has stayed relatively stable, which supports the current CardAtlas Reference Value.";
  }
  if (deltaPct > 0) {
    return "Recent price movement has climbed into the current CardAtlas Reference Value and still shows constructive momentum.";
  }
  return "Recent movement has cooled into the current CardAtlas Reference Value, which suggests softer momentum around the current range.";
}
