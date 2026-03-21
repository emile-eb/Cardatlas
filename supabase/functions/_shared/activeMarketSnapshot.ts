// @ts-nocheck
const DEFAULT_EXCLUDED_KEYWORDS = ["lot", "reprint", "custom", "digital", "proxy"];
const RAW_MIN_SCORE = 7;
const GRADED_STRONG_SCORE = 14;
const GRADED_MEDIUM_SCORE = 11;

export function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function toBase64(value: string): string {
  if (typeof globalThis.btoa === "function") return globalThis.btoa(value);

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

export function resolveExcludedKeywords(): string[] {
  const fromEnv = clean(Deno.env.get("EBAY_ACTIVE_EXCLUDED_KEYWORDS"));
  if (!fromEnv) return DEFAULT_EXCLUDED_KEYWORDS;
  return fromEnv
    .split(",")
    .map((part) => clean(part).toLowerCase())
    .filter(Boolean);
}

export function getMarketplaceId(): string {
  return clean(Deno.env.get("EBAY_MARKETPLACE_ID")) || clean(Deno.env.get("EXPO_PUBLIC_EBAY_MARKETPLACE_ID")) || "EBAY_US";
}

function tokenize(value: string | null | undefined): string[] {
  return clean(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function dedupeTokens(tokens: string[]): string[] {
  return Array.from(new Set(tokens.filter(Boolean)));
}

function parseCardNumberTokens(cardNumber: string | null | undefined): string[] {
  const raw = clean(cardNumber).toLowerCase();
  if (!raw) return [];
  const stripped = raw.replace(/[^a-z0-9]/g, "");
  return dedupeTokens([raw, stripped].filter(Boolean));
}

function normalizeListingTitle(value: string | null | undefined): string {
  return clean(value)
    .toLowerCase()
    .replace(/[\-\/|\\]+/g, " ")
    .replace(/[^a-z0-9\s#]+/g, " ")
    .replace(/\bpsa\s*10\b/g, "psa 10")
    .replace(/\bpsa10\b/g, "psa 10")
    .replace(/\bpsa\s*9\b/g, "psa 9")
    .replace(/\bpsa9\b/g, "psa 9")
    .replace(/\bgem[\s\-]*mint[\s\-]*10\b/g, " gem mint 10 ")
    .replace(/\bmint[\s\-]*9\b/g, " mint 9 ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickPrimarySetTokens(identity: any): string[] {
  const stopWords = new Set(["trading", "card", "cards", "edition", "series", "baseball", "basketball", "football", "soccer", "hockey"]);
  const brandTokens = new Set(tokenize(identity.brand));
  return tokenize(identity.setName).filter((token) => !stopWords.has(token) && !brandTokens.has(token)).slice(0, 2);
}

function buildQuery(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => clean(part == null ? "" : String(part)))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGeneralQuery(identity: any): string {
  return buildQuery([identity.year ? String(identity.year) : "", identity.playerName, identity.brand, identity.setName, identity.cardNumber]);
}

function buildGradedQueryPlans(identity: any, gradeSegment: "psa9" | "psa10") {
  const gradeToken = gradeSegment === "psa10" ? "PSA 10" : "PSA 9";
  const primarySetTokens = pickPrimarySetTokens(identity);
  const brandOrSet = clean(identity.brand) || primarySetTokens.join(" ");

  return [
    {
      key: `${gradeSegment}_tier1`,
      tier: 1,
      targetSegment: gradeSegment,
      query: buildQuery([identity.year ? String(identity.year) : "", identity.playerName, identity.brand, identity.setName, identity.cardNumber, gradeToken])
    },
    {
      key: `${gradeSegment}_tier2`,
      tier: 2,
      targetSegment: gradeSegment,
      query: buildQuery([identity.playerName, identity.brand, identity.setName, identity.cardNumber, gradeToken])
    },
    {
      key: `${gradeSegment}_tier3`,
      tier: 3,
      targetSegment: gradeSegment,
      query: buildQuery([identity.playerName, identity.cardNumber, brandOrSet, gradeToken])
    }
  ].filter((plan) => Boolean(plan.query));
}

function buildQueryPlans(identity: any) {
  return [
    { key: "general_raw_anchor", tier: 1, targetSegment: "raw", query: buildGeneralQuery(identity) },
    ...buildGradedQueryPlans(identity, "psa9"),
    ...buildGradedQueryPlans(identity, "psa10")
  ].filter((plan) => Boolean(plan.query));
}

function isFixedPriceListing(item: any): boolean {
  const options = Array.isArray(item?.buyingOptions) ? item.buyingOptions.map((value: unknown) => String(value)) : [];
  return options.includes("FIXED_PRICE") || options.includes("BEST_OFFER");
}

function hasExcludedKeyword(title: string, excluded: string[]): boolean {
  const normalizedTitle = title.toLowerCase();
  return excluded.some((keyword) => normalizedTitle.includes(keyword));
}

function countTokenMatches(normalizedTitle: string, tokens: string[]): number {
  return tokens.reduce((count, token) => (normalizedTitle.includes(token) ? count + 1 : count), 0);
}

function hasExactCardNumber(normalizedTitle: string, tokens: string[]): boolean {
  return tokens.some((token) => {
    if (!token) return false;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s|#)${escaped}(\\s|$)`, "i").test(normalizedTitle);
  });
}

function getStrongGradeMatch(normalizedTitle: string, targetSegment: "raw" | "psa9" | "psa10"): boolean {
  if (targetSegment === "psa10") return normalizedTitle.includes("psa 10");
  if (targetSegment === "psa9") return normalizedTitle.includes("psa 9");
  return !/\bpsa\s*(9|10)\b/.test(normalizedTitle);
}

function scoreCandidate(item: any, identity: any, targetSegment: "raw" | "psa9" | "psa10", excludedKeywords: string[]) {
  const title = clean(item?.title);
  const normalizedTitle = normalizeListingTitle(title);

  if (!normalizedTitle) return { accepted: false, score: -100 };
  if (hasExcludedKeyword(normalizedTitle, excludedKeywords)) return { accepted: false, score: -100 };

  const playerTokens = tokenize(identity.playerName);
  const brandTokens = tokenize(identity.brand);
  const setTokens = pickPrimarySetTokens(identity);
  const teamTokens = tokenize(identity.team);
  const cardNumberTokens = parseCardNumberTokens(identity.cardNumber);

  const playerMatches = countTokenMatches(normalizedTitle, playerTokens);
  const brandMatches = countTokenMatches(normalizedTitle, brandTokens);
  const setMatches = countTokenMatches(normalizedTitle, setTokens);
  const teamMatches = countTokenMatches(normalizedTitle, teamTokens);
  const cardNumberMatch = hasExactCardNumber(normalizedTitle, cardNumberTokens);
  const yearMatch = identity.year ? normalizedTitle.includes(String(identity.year)) : false;
  const strongGradeMatch = getStrongGradeMatch(normalizedTitle, targetSegment);

  let score = 0;
  if (isFixedPriceListing(item)) score += 2;
  score += Math.min(playerMatches, playerTokens.length || 0) * 4;
  score += brandMatches * 2;
  score += setMatches * 2;
  score += teamMatches;
  if (cardNumberMatch) score += 5;
  if (yearMatch) score += 3;
  if (targetSegment === "psa9" || targetSegment === "psa10") {
    if (strongGradeMatch) score += 8;
    if (normalizedTitle.includes("graded") || normalizedTitle.includes("slabbed")) score += 1;
  }

  if (targetSegment === "raw") {
    return { accepted: score >= RAW_MIN_SCORE && playerMatches > 0 && cardNumberMatch, score };
  }

  const meetsStrongThreshold = strongGradeMatch && score >= GRADED_STRONG_SCORE;
  const meetsMediumThreshold =
    strongGradeMatch &&
    score >= GRADED_MEDIUM_SCORE &&
    playerMatches > 0 &&
    cardNumberMatch &&
    (yearMatch || brandMatches > 0 || setMatches > 0);

  return { accepted: meetsStrongThreshold || meetsMediumThreshold, score };
}

function buildBrowseSearchUrl(query: string, limit: number) {
  const base = "https://api.ebay.com/buy/browse/v1/item_summary/search";
  const qs = new URLSearchParams({ q: query, limit: String(limit), sort: "newlyListed" });
  return `${base}?${qs.toString()}`;
}

async function fetchBrowseCandidates(query: string, limit: number, token: string, marketplaceId: string) {
  const response = await fetch(buildBrowseSearchUrl(query, limit), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId
    }
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`eBay active listings request failed (${response.status}): ${raw}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.itemSummaries) ? payload.itemSummaries : [];
}

async function getEbayAccessToken() {
  const clientId = clean(Deno.env.get("EBAY_CLIENT_ID"));
  const clientSecret = clean(Deno.env.get("EBAY_CLIENT_SECRET"));
  if (!clientId || !clientSecret) throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET.");

  const auth = toBase64(`${clientId}:${clientSecret}`);
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`eBay auth failed (${response.status}): ${raw}`);
  }

  const payload = await response.json();
  const token = clean(payload?.access_token);
  if (!token) throw new Error("Missing eBay access token.");
  return token;
}

function normalizeCondition(item: any): string | null {
  return clean(item?.condition) || clean(item?.conditionId) || null;
}

function classifyTitle(title: string) {
  const normalizedTitle = normalizeListingTitle(title);

  const exclusionRules = [
    { pattern: /\bcase\s*break\b/, reason: "excluded_break_listing" },
    { pattern: /\bbreak\b/, reason: "excluded_break_listing" },
    { pattern: /\blots?\b/, reason: "excluded_lot_listing" },
    { pattern: /\bbundle\b/, reason: "excluded_bundle_listing" },
    { pattern: /\bpack\b/, reason: "excluded_pack_listing" },
    { pattern: /\bwax\b/, reason: "excluded_wax_listing" },
    { pattern: /\brepack\b/, reason: "excluded_repack_listing" },
    { pattern: /\breprint\b/, reason: "excluded_reprint_listing" },
    { pattern: /\bcustom\s+card\b/, reason: "excluded_custom_listing" },
    { pattern: /\bproxy\b/, reason: "excluded_proxy_listing" },
    { pattern: /\bdigital\b/, reason: "excluded_digital_listing" }
  ];

  for (const rule of exclusionRules) {
    if (rule.pattern.test(normalizedTitle)) {
      return { marketSegment: "excluded", classificationConfidence: "high", classificationReason: rule.reason };
    }
  }

  if (/\bpsa 10\b/.test(normalizedTitle)) {
    return { marketSegment: "psa10", classificationConfidence: "high", classificationReason: "matched_exact_psa10" };
  }
  if (/\bpsa\b/.test(normalizedTitle) && /\bgem mint 10\b/.test(normalizedTitle)) {
    return { marketSegment: "psa10", classificationConfidence: "medium", classificationReason: "matched_psa_gem_mint_10" };
  }
  if (/\bpsa 9\b/.test(normalizedTitle)) {
    return { marketSegment: "psa9", classificationConfidence: "high", classificationReason: "matched_exact_psa9" };
  }
  if (/\bpsa\b/.test(normalizedTitle) && /\bmint 9\b/.test(normalizedTitle)) {
    return { marketSegment: "psa9", classificationConfidence: "medium", classificationReason: "matched_psa_mint_9" };
  }
  if (/\bpsa\b/.test(normalizedTitle) && /\bpsa (?!9\b|10\b)\d+(?:\.\d+)?\b/.test(normalizedTitle)) {
    return { marketSegment: "otherGraded", classificationConfidence: "high", classificationReason: "matched_psa_other_grade" };
  }
  if (/\b(bgs|beckett|sgc|cgc|csg)\b/.test(normalizedTitle)) {
    return { marketSegment: "otherGraded", classificationConfidence: "high", classificationReason: "matched_other_grading_company" };
  }
  if (/\b(graded|slabbed|encased|authentic)\b/.test(normalizedTitle)) {
    return { marketSegment: "otherGraded", classificationConfidence: "medium", classificationReason: "matched_generic_graded_term" };
  }

  return { marketSegment: "raw", classificationConfidence: "high", classificationReason: "no_grading_terms_found" };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function filterSegmentListings(listings: any[], referenceValue?: number) {
  const prices = listings.map((listing) => listing.price).filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) {
    return listings.map((listing) => ({ ...listing, wasOutlierFiltered: false, outlierFilterReason: null }));
  }

  if (listings.length >= 4) {
    const segmentMedian = median(prices);
    const lowerBound = segmentMedian * 0.5;
    const upperBound = segmentMedian * 2.0;
    return listings.map((listing) => {
      if (listing.price < lowerBound) return { ...listing, wasOutlierFiltered: true, outlierFilterReason: "excluded_below_segment_median_threshold" };
      if (listing.price > upperBound) return { ...listing, wasOutlierFiltered: true, outlierFilterReason: "excluded_above_segment_median_threshold" };
      return { ...listing, wasOutlierFiltered: false, outlierFilterReason: null };
    });
  }

  if (Number.isFinite(referenceValue) && Number(referenceValue) > 0) {
    const lowerBound = Number(referenceValue) * 0.4;
    const upperBound = Number(referenceValue) * 2.5;
    return listings.map((listing) => {
      if (listing.price < lowerBound) return { ...listing, wasOutlierFiltered: true, outlierFilterReason: "excluded_below_reference_threshold" };
      if (listing.price > upperBound) return { ...listing, wasOutlierFiltered: true, outlierFilterReason: "excluded_above_reference_threshold" };
      return { ...listing, wasOutlierFiltered: false, outlierFilterReason: null };
    });
  }

  return listings.map((listing) => ({ ...listing, wasOutlierFiltered: false, outlierFilterReason: null }));
}

function average(listings: any[]) {
  const prices = listings.map((listing) => Number(listing.price)).filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) return null;
  return Number((prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2));
}

function buildSegments(listings: any[]) {
  return listings.reduce(
    (acc, listing) => {
      acc[listing.marketSegment].push(listing);
      return acc;
    },
    { raw: [], psa9: [], psa10: [], otherGraded: [], excluded: [] }
  );
}

export async function loadCardIdentity(service: any, cardId: string) {
  const { data, error } = await service
    .from("cards")
    .select("id,sport,player_name,card_title,year,brand,set_name,card_number,team")
    .eq("id", cardId)
    .single();

  if (error) throw error;

  return {
    cardId,
    sport: data.sport ?? null,
    playerName: data.player_name ?? "",
    cardTitle: data.card_title ?? "",
    year: data.year ?? null,
    brand: data.brand ?? null,
    setName: data.set_name ?? null,
    cardNumber: data.card_number ?? null,
    team: data.team ?? null
  };
}

export async function loadLatestReferenceValue(service: any, cardId: string) {
  const { data, error } = await service
    .from("valuation_snapshots")
    .select("reference_value,currency,fetched_at")
    .eq("card_id", cardId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    referenceValue: Number.isFinite(Number(data?.reference_value)) ? Number(data.reference_value) : null,
    currency: clean(data?.currency) || "USD",
    fetchedAt: data?.fetched_at ?? null
  };
}

export async function fetchSegmentedActiveMarketSnapshot(identity: any, options: { limit?: number; referenceValue?: number | null } = {}) {
  const plans = buildQueryPlans(identity);
  if (!plans.length) {
    return {
      listings: [],
      segments: { raw: [], psa9: [], psa10: [], otherGraded: [], excluded: [] },
      filteredSegments: { raw: [], psa9: [], psa10: [], otherGraded: [], excluded: [] },
      marketSummary: {
        raw_avg_ask: null,
        psa9_avg_ask: null,
        psa10_avg_ask: null,
        listing_count_raw: 0,
        listing_count_psa9: 0,
        listing_count_psa10: 0
      },
      queryCount: 0
    };
  }

  const marketplaceId = getMarketplaceId();
  const token = await getEbayAccessToken();
  const excludedKeywords = resolveExcludedKeywords();
  const limit = Math.min(Math.max(Number(options.limit ?? 12), 1), 24);
  const perQueryLimit = Math.min(Math.max(limit * 2, 20), 40);
  const maxAccepted = Math.min(Math.max(limit * 3, 24), 48);

  const results = await Promise.all(
    plans.map(async (plan) => {
      const items = await fetchBrowseCandidates(plan.query, perQueryLimit, token, marketplaceId);
      return { plan, items };
    })
  );

  const deduped = new Map<string, any>();

  for (const result of results) {
    for (const item of result.items) {
      const itemId = clean(item?.itemId);
      const price = Number(item?.price?.value ?? 0);
      if (!itemId || !Number.isFinite(price) || price <= 0) continue;

      const evaluation = scoreCandidate(item, identity, result.plan.targetSegment, excludedKeywords);
      if (!evaluation.accepted) continue;

      const existing = deduped.get(itemId);
      if (!existing || evaluation.score > existing.bestScore) {
        deduped.set(itemId, { item, bestScore: evaluation.score });
      }
    }
  }

  const listings = Array.from(deduped.values())
    .sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return clean(b.item?.itemOriginDate).localeCompare(clean(a.item?.itemOriginDate));
    })
    .slice(0, maxAccepted)
    .map(({ item }) => {
      const classification = classifyTitle(clean(item?.title) || "eBay Listing");
      return {
        id: clean(item?.itemId),
        title: clean(item?.title) || "eBay Listing",
        price: Number(item?.price?.value ?? 0),
        currency: clean(item?.price?.currency) || "USD",
        itemWebUrl: clean(item?.itemWebUrl) || null,
        itemOriginDate: clean(item?.itemOriginDate) || new Date().toISOString(),
        condition: normalizeCondition(item),
        marketplaceId,
        marketSegment: classification.marketSegment,
        classificationConfidence: classification.classificationConfidence,
        classificationReason: classification.classificationReason,
        wasOutlierFiltered: false,
        outlierFilterReason: null
      };
    });

  const grouped = buildSegments(listings);
  const filteredSegments = {
    raw: filterSegmentListings(grouped.raw, options.referenceValue).filter((listing) => !listing.wasOutlierFiltered),
    psa9: filterSegmentListings(grouped.psa9, options.referenceValue).filter((listing) => !listing.wasOutlierFiltered),
    psa10: filterSegmentListings(grouped.psa10, options.referenceValue).filter((listing) => !listing.wasOutlierFiltered),
    otherGraded: filterSegmentListings(grouped.otherGraded, options.referenceValue).filter((listing) => !listing.wasOutlierFiltered),
    excluded: grouped.excluded
  };

  return {
    listings,
    segments: grouped,
    filteredSegments,
    marketSummary: {
      raw_avg_ask: average(filteredSegments.raw),
      psa9_avg_ask: average(filteredSegments.psa9),
      psa10_avg_ask: average(filteredSegments.psa10),
      listing_count_raw: filteredSegments.raw.length,
      listing_count_psa9: filteredSegments.psa9.length,
      listing_count_psa10: filteredSegments.psa10.length
    },
    queryCount: plans.length
  };
}
