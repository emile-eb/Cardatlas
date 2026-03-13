// @ts-nocheck
import type { CompNormalizationResult, NormalizedCardIdentity, RawCompResult } from "./types.ts";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function deepGet(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

function firstValue(obj: Record<string, unknown>, paths: string[]): unknown {
  for (const path of paths) {
    const value = deepGet(obj, path);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function inferGrade(title: string | null): string | null {
  if (!title) return null;
  const match = title.match(/(PSA|BGS|SGC|CGC)\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return `${match[1].toUpperCase()} ${match[2]}`;
}

function normalizeOne(raw: RawCompResult): CompNormalizationResult | null {
  const payload = asObject(raw.payload);
  const title = String(firstValue(payload, ["title", "name", "item.title", "listing.title"]) ?? "").trim() || null;

  const listingIdRaw = firstValue(payload, ["itemId", "id", "listingId", "listing.id", "item.itemId", "legacyItemId"]);
  const sourceListingId = listingIdRaw != null ? String(listingIdRaw).trim() || null : null;

  const price =
    toNumber(firstValue(payload, ["sale_price", "price.value", "price", "soldPrice", "sellingStatus.currentPrice.value", "currentBidPrice.value"])) ??
    toNumber(firstValue(payload, ["priceWithCurrency.value", "convertedCurrentPrice.value"]));

  if (!price || price <= 0) return null;

  const currency =
    String(firstValue(payload, ["currency", "currencyCode", "sale_currency", "price.currency", "sellingStatus.currentPrice.currencyId"]) ?? "USD").trim() ||
    "USD";

  const saleDate =
    toIsoDate(firstValue(payload, ["date_sold", "saleDate", "soldDate", "dateSold", "endTime", "listing.endTime", "timestamp"])) ??
    new Date().toISOString();

  const condition = String(firstValue(payload, ["condition", "conditionDisplayName", "itemCondition", "subtitle"]) ?? "").trim() || null;
  const url = String(firstValue(payload, ["link", "url", "itemWebUrl", "viewItemURL", "item.url", "listing.url"]) ?? "").trim() || null;
  const grade = inferGrade(title);

  let normalizedConfidence: "high" | "medium" | "low" = "low";
  const hasId = Boolean(sourceListingId);
  const hasDate = Boolean(saleDate);
  const hasTitle = Boolean(title);
  const hasUrl = Boolean(url);
  if ((hasId || hasUrl) && hasDate && hasTitle) normalizedConfidence = "high";
  else if (hasDate && hasTitle) normalizedConfidence = "medium";

  return {
    source: raw.provider,
    sourceListingId,
    title,
    price: Number(price.toFixed(2)),
    currency,
    saleDate,
    condition,
    grade,
    url,
    rawPayload: payload,
    normalizedConfidence
  };
}

function dedupe(rows: CompNormalizationResult[]): CompNormalizationResult[] {
  const map = new Map<string, CompNormalizationResult>();
  for (const row of rows) {
    const key = row.sourceListingId
      ? `${row.source}|${row.sourceListingId}`
      : row.url
        ? `${row.source}|${row.url}`
        : `${row.source}|${row.title ?? ""}|${row.price}|${row.saleDate.slice(0, 10)}`;
    if (!map.has(key)) map.set(key, row);
  }
  return Array.from(map.values());
}

export function normalizeCompResults(rawItems: RawCompResult[]): CompNormalizationResult[] {
  const normalized = rawItems
    .map(normalizeOne)
    .filter(Boolean)
    .filter((row: CompNormalizationResult | null) => {
      if (!row) return false;
      if (row.price <= 0) return false;
      if (!row.saleDate) return false;
      return true;
    }) as CompNormalizationResult[];

  return dedupe(normalized)
    .sort((a, b) => Date.parse(b.saleDate) - Date.parse(a.saleDate))
    .slice(0, 15);
}

export function isNormalizationUsable(rows: CompNormalizationResult[]): boolean {
  if (!rows.length) return false;
  const strongCount = rows.filter((row) => row.normalizedConfidence === "high" || row.normalizedConfidence === "medium").length;
  return rows.length >= 3 && strongCount >= 2;
}

export function buildFallbackFromIdentity(identity: NormalizedCardIdentity): CompNormalizationResult[] {
  const base = Number(identity.referenceValue ?? 0);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 120;
  const seed = `${identity.cardId}:${identity.playerName}:${identity.cardNumber ?? ""}`;
  const out: CompNormalizationResult[] = [];

  for (let i = 0; i < 5; i += 1) {
    let hash = 0;
    const mix = `${seed}:${i}`;
    for (let j = 0; j < mix.length; j += 1) hash = (hash * 33 + mix.charCodeAt(j)) >>> 0;
    const noise = ((hash % 1000) / 1000 - 0.5) * 0.18;
    const price = Number((safeBase * (1 + noise)).toFixed(2));
    const saleDate = new Date(Date.now() - (i + 1) * 86400000 * (i + 1)).toISOString();
    out.push({
      source: "demo_market",
      sourceListingId: `demo-${identity.cardId}-${i}`,
      title: `${identity.year ?? ""} ${identity.brand ?? ""} ${identity.playerName} ${identity.cardNumber ?? ""}`.replace(/\s+/g, " ").trim(),
      price,
      currency: identity.currency || "USD",
      saleDate,
      condition: i % 2 === 0 ? "Ungraded" : "Near Mint",
      grade: null,
      url: null,
      rawPayload: {
        demo: true,
        generatedAt: new Date().toISOString(),
        cardId: identity.cardId
      },
      normalizedConfidence: "medium"
    });
  }

  return out;
}
