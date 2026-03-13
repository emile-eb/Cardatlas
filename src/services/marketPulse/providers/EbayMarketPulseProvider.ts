import type { MarketPulseProvider } from "@/services/marketPulse/providers/MarketPulseProvider";
import type { ProviderFetchInput, ProviderFetchResult, ProviderListing } from "@/services/marketPulse/types";

type EbayConfig = {
  clientId?: string;
  clientSecret?: string;
  marketplaceId: string;
};

function getEbayConfig(): EbayConfig {
  return {
    clientId: process.env.EBAY_CLIENT_ID?.trim(),
    clientSecret: process.env.EBAY_CLIENT_SECRET?.trim(),
    marketplaceId: process.env.EXPO_PUBLIC_EBAY_MARKETPLACE_ID?.trim() || "EBAY_US"
  };
}

function hasCredentials(config: EbayConfig): boolean {
  return Boolean(config.clientId && config.clientSecret);
}

function toBase64(value: string): string {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let i = 0;
  while (i < value.length) {
    const a = value.charCodeAt(i++);
    const b = value.charCodeAt(i++);
    const c = value.charCodeAt(i++);
    const triplet = (a << 16) | ((b || 0) << 8) | (c || 0);
    output += chars[(triplet >> 18) & 0x3f];
    output += chars[(triplet >> 12) & 0x3f];
    output += Number.isFinite(b) ? chars[(triplet >> 6) & 0x3f] : "=";
    output += Number.isFinite(c) ? chars[triplet & 0x3f] : "=";
  }
  return output;
}

function buildBrowseSearchUrl(query: string, limit: number): string {
  const base = "https://api.ebay.com/buy/browse/v1/item_summary/search";
  const qs = new URLSearchParams({
    q: query,
    limit: String(Math.max(1, Math.min(limit, 200))),
    sort: "newlyListed"
  });
  return `${base}?${qs.toString()}`;
}

function normalizeEbayItems(payload: any): ProviderListing[] {
  const items = Array.isArray(payload?.itemSummaries) ? payload.itemSummaries : [];
  return items.map((item: any) => ({
    source: "ebay",
    sourceListingId: item?.itemId ? String(item.itemId) : null,
    title: String(item?.title ?? "eBay Listing"),
    subtitle: item?.condition ? String(item.condition) : null,
    imageUrl: item?.image?.imageUrl ? String(item.image.imageUrl) : null,
    itemWebUrl: item?.itemWebUrl ? String(item.itemWebUrl) : null,
    price: item?.price?.value ? Number(item.price.value) : null,
    currency: item?.price?.currency ? String(item.price.currency) : "USD",
    itemOriginDate: item?.itemOriginDate ? String(item.itemOriginDate) : null,
    buyingOptions: Array.isArray(item?.buyingOptions) ? { options: item.buyingOptions } : null,
    marketplaceId: "EBAY_US",
    pulseReason: "New Listing",
    rawPayload: item ?? null
  }));
}

class EbayMarketPulseProviderImpl implements MarketPulseProvider {
  readonly providerId = "ebay" as const;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  private async getAccessToken(config: EbayConfig): Promise<string> {
    if (!hasCredentials(config)) {
      throw new Error("eBay credentials are not configured.");
    }

    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 10_000) {
      return this.tokenCache.token;
    }

    const auth = toBase64(`${config.clientId}:${config.clientSecret}`);
    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
    });
    if (!response.ok) {
      throw new Error(`eBay auth failed (${response.status}).`);
    }

    const payload = await response.json();
    const token = String(payload?.access_token ?? "");
    const expiresIn = Number(payload?.expires_in ?? 0);
    if (!token) {
      throw new Error("Missing eBay access token.");
    }

    this.tokenCache = {
      token,
      expiresAt: now + expiresIn * 1000
    };
    return token;
  }

  async fetchLatestListings(input: ProviderFetchInput): Promise<ProviderFetchResult> {
    const config = getEbayConfig();
    if (!hasCredentials(config)) {
      throw new Error("eBay provider is not configured.");
    }

    const token = await this.getAccessToken(config);
    const response = await fetch(buildBrowseSearchUrl(input.query, input.limit), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId
      }
    });
    if (!response.ok) {
      throw new Error(`eBay browse request failed (${response.status}).`);
    }

    const payload = await response.json();
    return {
      source: "ebay",
      listings: normalizeEbayItems(payload),
      isMock: false
    };
  }
}

export const ebayMarketPulseProvider: MarketPulseProvider = new EbayMarketPulseProviderImpl();
