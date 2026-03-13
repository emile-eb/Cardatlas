// @ts-nocheck
import type { CardCompsProvider, CardCompsProviderResult, NormalizedCardIdentity, RawCompResult } from "./types.ts";

const EBAY_COMPLETED_ENDPOINT = "https://ebay-average-selling-price.p.rapidapi.com/findCompletedItems";
const EBAY_COMPLETED_HOST = "ebay-average-selling-price.p.rapidapi.com";
const DEFAULT_MAX_RESULTS = 60;
const ALLOWED_MAX_RESULTS = new Set([60, 120, 240]);
const DEFAULT_EXCLUDED = ["lot", "reprint", "custom", "digital", "proxy"];

function clean(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function pseudo(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 10000) / 10000;
}

function shouldDebugLog(): boolean {
  const explicit = (Deno.env.get("COMPS_DEBUG") ?? "").toLowerCase() === "true";
  const localRun = !Deno.env.get("DENO_DEPLOYMENT_ID");
  return explicit || localRun;
}

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!shouldDebugLog()) return;
  console.log(`[card-comps] ${label}`, payload);
}

function formatCardSearchQuery(identity: NormalizedCardIdentity): string {
  return [
    identity.year ? String(identity.year) : "",
    clean(identity.playerName),
    clean(identity.brand),
    clean(identity.setName),
    clean(identity.cardNumber)
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMaxResults(value: string | null): number {
  const parsed = Number(value ?? DEFAULT_MAX_RESULTS);
  return ALLOWED_MAX_RESULTS.has(parsed) ? parsed : DEFAULT_MAX_RESULTS;
}

function resolveExcludedKeywords(): string[] {
  const fromEnv = clean(Deno.env.get("RAPIDAPI_EBAY_EXCLUDED_KEYWORDS"));
  if (!fromEnv) return DEFAULT_EXCLUDED;
  return fromEnv
    .split(",")
    .map((k) => clean(k))
    .filter(Boolean);
}

function buildAspects(identity: NormalizedCardIdentity): Record<string, string> {
  const aspects: Record<string, string> = {};
  if (identity.team) aspects.Team = identity.team;
  if (identity.sport) aspects.Sport = identity.sport;
  return aspects;
}

function toRawResults(
  provider: string,
  topLevel: Record<string, unknown>,
  fullResponse: Record<string, unknown>,
  products: any[]
): RawCompResult[] {
  return products
    .filter((record) => !!record && typeof record === "object")
    .map((record) => ({
      provider,
      payload: {
        ...(record as Record<string, unknown>),
        __top_level: topLevel,
        __raw_response: fullResponse
      }
    }));
}

function extractProducts(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json.products)) return json.products;
  if (Array.isArray(json.results)) return json.results;
  if (json.results && Array.isArray(json.results.products)) return json.results.products;
  return [];
}

class RapidApiEbaySoldProvider implements CardCompsProvider {
  providerName = "ebay";

  async fetchRecentSalesForCard(identity: NormalizedCardIdentity): Promise<CardCompsProviderResult> {
    const endpoint = EBAY_COMPLETED_ENDPOINT;
    const apiKey = Deno.env.get("RAPIDAPI_KEY") ?? "";
    const host = EBAY_COMPLETED_HOST;

    if (!apiKey) {
      throw new Error("RapidAPI sold-items env is not configured.");
    }

    const keywords = formatCardSearchQuery(identity);
    if (!keywords) {
      throw new Error("Card identity is too weak for comps query.");
    }

    const maxSearchResults = normalizeMaxResults(Deno.env.get("RAPIDAPI_EBAY_MAX_SEARCH_RESULTS"));
    const categoryId = clean(Deno.env.get("RAPIDAPI_EBAY_CATEGORY_ID")) || "261328";
    const excludedKeywords = resolveExcludedKeywords();

    const body: Record<string, unknown> = {
      keywords,
      excluded_keywords: excludedKeywords,
      max_search_results: maxSearchResults,
      category_id: categoryId,
      remove_outliers: true,
      site_id: "0",
      aspects: buildAspects(identity)
    };

    debugLog("request_body", {
      endpoint,
      body
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-rapidapi-host": host,
        "x-rapidapi-key": apiKey
      },
      body: JSON.stringify(body)
    });

    const rawText = await response.text();
    let json: any = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch {
      json = null;
    }

    debugLog("response_status", {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      throw new Error(`RapidAPI comps error: ${response.status} ${rawText}`);
    }

    const topLevel = {
      average_price: json?.average_price ?? null,
      median_price: json?.median_price ?? null,
      min_price: json?.min_price ?? null,
      max_price: json?.max_price ?? null,
      response_url: json?.response_url ?? null
    };

    debugLog("response_top_level", {
      ...topLevel,
      has_results: Array.isArray(json?.results),
      has_products: Array.isArray(json?.products)
    });

    const products = extractProducts(json);

    return {
      provider: this.providerName,
      rawCount: products.length,
      items: toRawResults(this.providerName, topLevel, (json ?? {}) as Record<string, unknown>, products)
    };
  }
}

class FakeCompsProvider implements CardCompsProvider {
  providerName = "demo_market";

  async fetchRecentSalesForCard(identity: NormalizedCardIdentity): Promise<CardCompsProviderResult> {
    const base = Number(identity.referenceValue ?? 0);
    const usableBase = Number.isFinite(base) && base > 0 ? base : 100;
    const sourceSeed = `${identity.cardId}|${identity.playerName}|${identity.cardNumber ?? ""}`;
    const today = Date.now();
    const rows: any[] = [];

    for (let i = 0; i < 5; i += 1) {
      const jitter = (pseudo(`${sourceSeed}:${i}`) - 0.5) * 0.22;
      const price = Number((usableBase * (1 + jitter)).toFixed(2));
      const soldAt = new Date(today - (i + 1) * 1000 * 60 * 60 * 24 * (1 + i)).toISOString();
      rows.push({
        listingId: `demo-${identity.cardId}-${i}`,
        title: `${identity.year ?? ""} ${identity.brand ?? ""} ${identity.playerName} ${identity.cardNumber ?? ""}`.replace(/\s+/g, " ").trim(),
        soldPrice: price,
        currency: identity.currency || "USD",
        soldDate: soldAt,
        link: null,
        condition: i % 2 === 0 ? "Ungraded" : "Near Mint",
        provider: "demo_market"
      });
    }

    return {
      provider: this.providerName,
      rawCount: rows.length,
      items: rows.map((row) => ({ provider: this.providerName, payload: row }))
    };
  }
}

export function createRealCompsProvider(): CardCompsProvider {
  return new RapidApiEbaySoldProvider();
}

export function createFallbackCompsProvider(): CardCompsProvider {
  return new FakeCompsProvider();
}
