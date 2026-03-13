export type PriceHistoryTimeframe = "1D" | "7D" | "1M" | "YTD" | "1Y";

export type ChartPoint = { x: number; y: number };

export const PRICE_HISTORY_TIMEFRAMES: PriceHistoryTimeframe[] = ["1D", "7D", "1M", "YTD", "1Y"];

const SERIES_COUNT: Record<PriceHistoryTimeframe, number> = {
  "1D": 24,
  "7D": 28,
  "1M": 30,
  YTD: 40,
  "1Y": 52
};

export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function seededNoise(seed: string, index: number): number {
  let hash = 0;
  const key = `${seed}-${index}`;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return ((Math.abs(hash) % 1000) / 1000) * 2 - 1;
}

export function generateSeries(seed: string, basePrice: number, timeframe: PriceHistoryTimeframe): number[] {
  const points = SERIES_COUNT[timeframe];
  const safeBase = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 120;
  const volatility = timeframe === "1D" ? 0.012 : timeframe === "7D" ? 0.018 : timeframe === "1M" ? 0.022 : timeframe === "YTD" ? 0.03 : 0.04;
  const trend = timeframe === "1D" ? 0.003 : timeframe === "7D" ? 0.012 : timeframe === "1M" ? 0.018 : timeframe === "YTD" ? 0.035 : 0.06;

  const values: number[] = [];
  let value = safeBase * (0.94 + ((Math.abs(seed.length * 13) % 100) / 1000));
  for (let i = 0; i < points; i += 1) {
    const noise = seededNoise(seed, i) * volatility;
    value = value * (1 + trend / points + noise);
    values.push(Number(value.toFixed(2)));
  }
  return values;
}

export function toChartPoints(values: number[], width: number, height: number): ChartPoint[] {
  if (!values.length || width <= 0 || height <= 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0.0001);

  return values.map((v, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const normalized = (v - min) / spread;
    const y = height - normalized * height;
    return { x, y };
  });
}

export function smoothSeries(values: number[]): number[] {
  if (values.length < 4) return values;
  return values.map((_, index) => {
    const start = Math.max(0, index - 2);
    const end = Math.min(values.length - 1, index + 2);
    let sum = 0;
    let count = 0;
    for (let i = start; i <= end; i += 1) {
      sum += values[i];
      count += 1;
    }
    return Number((sum / count).toFixed(2));
  });
}

export function enforceUpwardTrend(values: number[]): number[] {
  if (values.length < 2) return values;
  const first = values[0];
  const last = values[values.length - 1];
  const minTarget = first * 1.08;
  if (last >= minTarget) return values;

  const neededLift = minTarget - last;
  return values.map((value, index) => {
    const factor = index / Math.max(values.length - 1, 1);
    return Number((value + neededLift * factor).toFixed(2));
  });
}
