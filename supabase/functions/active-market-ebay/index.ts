// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const DEFAULT_FETCH_LIMIT = 12;
const MAX_FETCH_LIMIT = 24;
const DEFAULT_EXCLUDED_KEYWORDS = ["lot", "reprint", "custom", "digital", "proxy"];
const RAW_STRONG_SCORE = 12;
const RAW_FLEX_SCORE = 9;
const GRADED_STRONG_SCORE = 14;
const GRADED_FLEX_SCORE = 11;

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init?.headers ?? {})
    }
  });
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeLimit(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_FETCH_LIMIT);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_FETCH_LIMIT;
  return Math.min(Math.max(Math.round(parsed), 1), MAX_FETCH_LIMIT);
}

function resolveExcludedKeywords(): string[] {
  const fromEnv = clean(Deno.env.get("EBAY_ACTIVE_EXCLUDED_KEYWORDS"));
  if (!fromEnv) return DEFAULT_EXCLUDED_KEYWORDS;
  return fromEnv
    .split(",")
    .map((part) => clean(part).toLowerCase())
    .filter(Boolean);
}

function shouldDebugLog(): boolean {
  return (Deno.env.get("ACTIVE_MARKET_DEBUG") ?? "").toLowerCase() === "true" || !Deno.env.get("DENO_DEPLOYMENT_ID");
}

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!shouldDebugLog()) return;
  console.log(`[active-market-ebay] ${label}`, payload);
}

function getMarketplaceId(): string {
  return clean(Deno.env.get("EBAY_MARKETPLACE_ID")) || clean(Deno.env.get("EXPO_PUBLIC_EBAY_MARKETPLACE_ID")) || "EBAY_US";
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

async function getUserIdByAuth(service: any, authUserId: string): Promise<string> {
  const { data, error } = await service.from("users").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("User not found for auth identity.");
  return data.id;
}

async function userCanAccessCard(service: any, userId: string, cardId: string): Promise<boolean> {
  const [scanRes, collectionRes] = await Promise.all([
    service.from("scans").select("id").eq("user_id", userId).eq("card_id", cardId).limit(1),
    service.from("collection_items").select("id").eq("user_id", userId).eq("card_id", cardId).limit(1)
  ]);

  if (scanRes.error) throw scanRes.error;
  if (collectionRes.error) throw collectionRes.error;

  return (scanRes.data?.length ?? 0) > 0 || (collectionRes.data?.length ?? 0) > 0;
}

async function loadIdentity(service: any, cardId: string) {
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
    .replace(/\s+/g, " ")
    .trim();
}

function pickPrimarySetTokens(identity: any): string[] {
  const stopWords = new Set(["trading", "card", "cards", "edition", "series", "baseball", "basketball", "football", "soccer", "hockey"]);
  const brandTokens = new Set(tokenize(identity.brand));
  return tokenize(identity.setName).filter((token) => !stopWords.has(token) && !brandTokens.has(token)).slice(0, 2);
}

function pickStrongestSetToken(identity: any): string {
  return pickPrimarySetTokens(identity)[0] ?? "";
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
  return buildQuery([
    identity.year ? String(identity.year) : "",
    identity.playerName,
    identity.brand,
    identity.setName,
    identity.cardNumber
  ]);
}

function buildRawQueryPlans(identity: any) {
  const strongestSetToken = pickStrongestSetToken(identity);
  return [
    {
      key: "raw_precision_tier1",
      tier: 1,
      targetSegment: "raw",
      breadth: "precision",
      query: buildGeneralQuery(identity)
    },
    {
      key: "raw_identity_tier2",
      tier: 2,
      targetSegment: "raw",
      breadth: "identity",
      query: buildQuery([identity.year ? String(identity.year) : "", identity.playerName, identity.brand, identity.setName])
    },
    {
      key: "raw_identity_tier3",
      tier: 3,
      targetSegment: "raw",
      breadth: "identity",
      query: buildQuery([identity.playerName, identity.brand, identity.setName])
    },
    {
      key: "raw_identity_tier4",
      tier: 4,
      targetSegment: "raw",
      breadth: "identity",
      query: buildQuery([identity.year ? String(identity.year) : "", identity.playerName, strongestSetToken || identity.brand])
    }
  ].filter((plan) => Boolean(plan.query));
}

function buildGradedQueryPlans(identity: any, gradeSegment: "psa9" | "psa10") {
  const gradeToken = gradeSegment === "psa10" ? "PSA 10" : "PSA 9";
  const strongestSetToken = pickStrongestSetToken(identity);
  const brandOrSet = clean(identity.brand) || strongestSetToken;

  return [
    {
      key: `${gradeSegment}_tier1`,
      tier: 1,
      targetSegment: gradeSegment,
      breadth: "precision",
      query: buildQuery([
        identity.year ? String(identity.year) : "",
        identity.playerName,
        identity.brand,
        identity.setName,
        identity.cardNumber,
        gradeToken
      ])
    },
    {
      key: `${gradeSegment}_tier2`,
      tier: 2,
      targetSegment: gradeSegment,
      breadth: "precision",
      query: buildQuery([
        identity.playerName,
        identity.brand,
        identity.setName,
        identity.cardNumber,
        gradeToken
      ])
    },
    {
      key: `${gradeSegment}_tier3`,
      tier: 3,
      targetSegment: gradeSegment,
      breadth: "identity",
      query: buildQuery([
        identity.year ? String(identity.year) : "",
        identity.playerName,
        identity.brand,
        identity.setName,
        gradeToken
      ])
    },
    {
      key: `${gradeSegment}_tier4`,
      tier: 4,
      targetSegment: gradeSegment,
      breadth: "identity",
      query: buildQuery([
        identity.playerName,
        clean(identity.brand) || strongestSetToken,
        gradeToken
      ])
    },
    {
      key: `${gradeSegment}_tier5`,
      tier: 5,
      targetSegment: gradeSegment,
      breadth: "identity",
      query: buildQuery([
        identity.playerName,
        strongestSetToken || brandOrSet,
        gradeToken
      ])
    }
  ].filter((plan) => Boolean(plan.query));
}

function buildQueryPlans(identity: any) {
  return [
    ...buildRawQueryPlans(identity),
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

function hasWrongExplicitCardNumber(normalizedTitle: string, identityCardNumberTokens: string[]): boolean {
  if (!identityCardNumberTokens.length) return false;
  const explicitTokens = Array.from(normalizedTitle.matchAll(/(?:^|\s|#)([a-z]{0,3}\d{1,4}[a-z]{0,3})(?=\s|$)/gi))
    .map((match) => clean(match[1]).toLowerCase())
    .filter(Boolean);
  if (!explicitTokens.length) return false;
  const normalizedIdentity = new Set(identityCardNumberTokens.map((token) => token.toLowerCase()));
  return explicitTokens.some((token) => !normalizedIdentity.has(token.replace(/[^a-z0-9]/g, "")) && !normalizedIdentity.has(token));
}

function getDifferentExplicitYear(normalizedTitle: string, year: number | null | undefined): boolean {
  if (!year) return false;
  const years = Array.from(normalizedTitle.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((match) => Number(match[1]));
  if (!years.length) return false;
  return years.some((value) => value !== year);
}

function getGradeSignal(normalizedTitle: string, targetSegment: "raw" | "psa9" | "psa10") {
  const hasPsa9 = normalizedTitle.includes("psa 9");
  const hasPsa10 = normalizedTitle.includes("psa 10");

  if (targetSegment === "raw") {
    return {
      positive: !hasPsa9 && !hasPsa10,
      contradiction: false,
      reason: "raw_segment"
    };
  }

  if (targetSegment === "psa9") {
    return {
      positive: hasPsa9,
      contradiction: hasPsa10,
      reason: hasPsa9 ? "matched_exact_psa9" : hasPsa10 ? "contradictory_psa10" : "missing_grade"
    };
  }

  return {
    positive: hasPsa10,
    contradiction: hasPsa9,
    reason: hasPsa10 ? "matched_exact_psa10" : hasPsa9 ? "contradictory_psa9" : "missing_grade"
  };
}

function getSetSignal(normalizedTitle: string, setTokens: string[]) {
  const matches = countTokenMatches(normalizedTitle, setTokens);
  return {
    matches,
    positive: matches > 0,
    contradiction: false
  };
}

function getBrandSignal(normalizedTitle: string, brandTokens: string[]) {
  const matches = countTokenMatches(normalizedTitle, brandTokens);
  return {
    matches,
    positive: matches > 0,
    contradiction: false
  };
}

function getPlayerSignal(normalizedTitle: string, playerTokens: string[]) {
  const matches = countTokenMatches(normalizedTitle, playerTokens);
  const strong = playerTokens.length > 0 && matches >= Math.min(2, playerTokens.length);
  return {
    matches,
    strong,
    contradiction: false
  };
}

function scoreCandidate(item: any, identity: any, targetSegment: "raw" | "psa9" | "psa10", excludedKeywords: string[]) {
  const title = clean(item?.title);
  const normalizedTitle = normalizeListingTitle(title);

  if (!normalizedTitle) {
    return {
      accepted: false,
      score: -100,
      qualityBand: "weak",
      reason: "missing_title",
      strongGradeMatch: false
    };
  }

  if (hasExcludedKeyword(normalizedTitle, excludedKeywords)) {
    return {
      accepted: false,
      score: -100,
      qualityBand: "weak",
      reason: "excluded_keyword",
      strongGradeMatch: false
    };
  }

  const playerTokens = tokenize(identity.playerName);
  const brandTokens = tokenize(identity.brand);
  const setTokens = pickPrimarySetTokens(identity);
  const teamTokens = tokenize(identity.team);
  const cardNumberTokens = parseCardNumberTokens(identity.cardNumber);

  const playerSignal = getPlayerSignal(normalizedTitle, playerTokens);
  const brandSignal = getBrandSignal(normalizedTitle, brandTokens);
  const setSignal = getSetSignal(normalizedTitle, setTokens);
  const teamMatches = countTokenMatches(normalizedTitle, teamTokens);
  const cardNumberMatch = hasExactCardNumber(normalizedTitle, cardNumberTokens);
  const wrongCardNumber = hasWrongExplicitCardNumber(normalizedTitle, cardNumberTokens);
  const yearMatch = identity.year ? normalizedTitle.includes(String(identity.year)) : false;
  const wrongYear = getDifferentExplicitYear(normalizedTitle, identity.year);
  const gradeSignal = getGradeSignal(normalizedTitle, targetSegment);

  const contradictionSignals = [
    wrongCardNumber ? "wrong_card_number" : null,
    wrongYear ? "wrong_year" : null,
    gradeSignal.contradiction ? "wrong_grade" : null
  ].filter(Boolean) as string[];

  if (contradictionSignals.length) {
    return {
      accepted: false,
      score: -25,
      qualityBand: "weak",
      reason: "contradictory_identity_signal",
      strongGradeMatch: gradeSignal.positive,
      matchedSignals: [],
      missingSignals: [],
      contradictionSignals,
      signals: {
        playerMatches: playerSignal.matches,
        brandMatches: brandSignal.matches,
        setMatches: setSignal.matches,
        teamMatches,
        cardNumberMatch,
        wrongCardNumber,
        yearMatch,
        wrongYear,
        strongGradeMatch: gradeSignal.positive
      }
    };
  }

  let score = 0;
  if (isFixedPriceListing(item)) score += 2;
  score += Math.min(playerSignal.matches, playerTokens.length || 0) * 4;
  score += brandSignal.matches * 2;
  score += setSignal.matches * 2;
  score += teamMatches;
  if (cardNumberMatch) score += 5;
  if (yearMatch) score += 3;
  if (targetSegment === "psa9" || targetSegment === "psa10") {
    if (gradeSignal.positive) score += 8;
    if (normalizedTitle.includes("graded") || normalizedTitle.includes("slabbed")) score += 1;
  }

  const matchedSignals = [
    playerSignal.matches > 0 ? "player" : null,
    brandSignal.positive ? "brand" : null,
    setSignal.positive ? "set" : null,
    teamMatches > 0 ? "team" : null,
    cardNumberMatch ? "card_number" : null,
    yearMatch ? "year" : null,
    gradeSignal.positive ? "grade" : null
  ].filter(Boolean) as string[];

  const missingSignals = [
    !cardNumberMatch ? "card_number" : null,
    !yearMatch ? "year" : null,
    !setSignal.positive ? "set" : null,
    !brandSignal.positive ? "brand" : null,
    targetSegment !== "raw" && !gradeSignal.positive ? "grade" : null
  ].filter(Boolean) as string[];

  let accepted = false;
  let qualityBand = "weak";
  let reason = "below_threshold";

  if (targetSegment === "raw") {
    const strongIdentity = playerSignal.strong && (brandSignal.positive || setSignal.positive) && (yearMatch || cardNumberMatch);
    const flexibleIdentity = playerSignal.strong && brandSignal.positive && setSignal.positive;
    const meetsStrongThreshold = score >= RAW_STRONG_SCORE && strongIdentity;
    const meetsFlexibleThreshold = score >= RAW_FLEX_SCORE && flexibleIdentity;
    accepted = meetsStrongThreshold || meetsFlexibleThreshold;
    qualityBand = meetsStrongThreshold ? "strong" : accepted ? "medium" : "weak";
    reason = accepted
      ? meetsStrongThreshold
        ? "accepted_raw_strong_identity"
        : "accepted_raw_missing_card_number"
      : "rejected_raw_threshold";
  } else {
    const strongIdentity = playerSignal.strong && (brandSignal.positive || setSignal.positive) && (yearMatch || cardNumberMatch);
    const flexibleIdentity = playerSignal.strong && brandSignal.positive && setSignal.positive;
    const meetsStrongThreshold = gradeSignal.positive && score >= GRADED_STRONG_SCORE && strongIdentity;
    const meetsMediumThreshold =
      gradeSignal.positive &&
      score >= GRADED_FLEX_SCORE &&
      (strongIdentity || flexibleIdentity);

    accepted = meetsStrongThreshold || meetsMediumThreshold;
    qualityBand = meetsStrongThreshold ? "strong" : meetsMediumThreshold ? "medium" : "weak";
    reason = accepted
      ? qualityBand === "strong"
        ? "accepted_strong_graded_match"
        : "accepted_medium_graded_match"
      : gradeSignal.positive
        ? "rejected_identity_threshold"
        : "rejected_grade_signal";
  }

  return {
    accepted,
    score,
    qualityBand,
    reason,
    strongGradeMatch: gradeSignal.positive,
    matchedSignals,
    missingSignals,
    contradictionSignals,
    signals: {
      playerMatches: playerSignal.matches,
      brandMatches: brandSignal.matches,
      setMatches: setSignal.matches,
      teamMatches,
      cardNumberMatch,
      wrongCardNumber,
      yearMatch,
      wrongYear,
      strongGradeMatch: gradeSignal.positive
    }
  };
}

function buildBrowseSearchUrl(query: string, limit: number) {
  const base = "https://api.ebay.com/buy/browse/v1/item_summary/search";
  const qs = new URLSearchParams({
    q: query,
    limit: String(limit),
    sort: "newlyListed"
  });
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

function pickImageUrl(item: any): string | null {
  const direct = clean(item?.image?.imageUrl);
  if (direct) return direct;
  const thumbnails = Array.isArray(item?.thumbnailImages) ? item.thumbnailImages : [];
  const thumb = thumbnails.find((entry: any) => clean(entry?.imageUrl));
  return clean(thumb?.imageUrl) || null;
}

function normalizeCondition(item: any): string | null {
  return clean(item?.condition) || clean(item?.conditionId) || null;
}

function mapItemToRow(item: any, marketplaceId: string, debugMeta: Record<string, unknown>) {
  return {
    id: clean(item?.itemId) || crypto.randomUUID(),
    source: "ebay",
    title: clean(item?.title) || "eBay Listing",
    price: Number(item?.price?.value ?? 0),
    currency: clean(item?.price?.currency) || "USD",
    itemWebUrl: clean(item?.itemWebUrl) || null,
    imageUrl: pickImageUrl(item),
    itemOriginDate: clean(item?.itemOriginDate) || new Date().toISOString(),
    condition: normalizeCondition(item),
    marketplaceId,
    rawPayload: {
      ebayItem: item ?? null,
      activeMarketDebug: debugMeta
    }
  };
}

async function getEbayAccessToken() {
  const clientId = clean(Deno.env.get("EBAY_CLIENT_ID"));
  const clientSecret = clean(Deno.env.get("EBAY_CLIENT_SECRET"));
  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET.");
  }

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

async function fetchActiveListings(identity: any, limit: number) {
  const plans = buildQueryPlans(identity);
  if (!plans.length) {
    throw new Error("Card identity is too weak for active market query.");
  }

  const marketplaceId = getMarketplaceId();
  const token = await getEbayAccessToken();
  const excludedKeywords = resolveExcludedKeywords();
  const precisionQueryLimit = Math.min(Math.max(limit * 2, 18), 32);
  const identityQueryLimit = Math.min(Math.max(limit * 3, 24), 44);
  const maxAccepted = Math.min(Math.max(limit * 3, 24), 48);

  const results = await Promise.all(
    plans.map(async (plan) => {
      const fetchLimit = plan.breadth === "identity" ? identityQueryLimit : precisionQueryLimit;
      const items = await fetchBrowseCandidates(plan.query, fetchLimit, token, marketplaceId);
      return { plan, items };
    })
  );

  const deduped = new Map<string, any>();

  for (const result of results) {
    debugLog("query_tier_response", {
      cardId: identity.cardId,
        queryKey: result.plan.key,
        tier: result.plan.tier,
        breadth: result.plan.breadth,
        targetSegment: result.plan.targetSegment,
        query: result.plan.query,
        returned: result.items.length
    });

    for (const item of result.items) {
      const itemId = clean(item?.itemId);
      const price = Number(item?.price?.value ?? 0);
      if (!itemId || !Number.isFinite(price) || price <= 0) continue;

      const evaluation = scoreCandidate(item, identity, result.plan.targetSegment, excludedKeywords);
      if (!evaluation.accepted) continue;

      const existing = deduped.get(itemId);
      const entry = existing ?? {
        item,
        bestScore: -1,
        targetSegments: new Set<string>(),
        queryKeys: new Set<string>(),
        tiers: new Set<number>(),
        bestQueryTier: null,
        bestBreadth: null,
        qualityBand: "weak",
        acceptanceReason: null,
        matchedSignals: [],
        missingSignals: [],
        contradictionSignals: [],
        signals: null
      };

      entry.item = item;
      entry.targetSegments.add(result.plan.targetSegment);
      entry.queryKeys.add(result.plan.key);
      entry.tiers.add(result.plan.tier);

      if (evaluation.score > entry.bestScore) {
        entry.bestScore = evaluation.score;
        entry.bestQueryTier = result.plan.tier;
        entry.bestBreadth = result.plan.breadth;
        entry.qualityBand = evaluation.qualityBand;
        entry.acceptanceReason = evaluation.reason;
        entry.matchedSignals = evaluation.matchedSignals;
        entry.missingSignals = evaluation.missingSignals;
        entry.contradictionSignals = evaluation.contradictionSignals;
        entry.signals = evaluation.signals;
      }

      deduped.set(itemId, entry);
    }
  }

  const ranked = Array.from(deduped.values())
    .sort((a, b) => {
      if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
      return clean(b.item?.itemOriginDate).localeCompare(clean(a.item?.itemOriginDate));
    })
    .slice(0, maxAccepted)
    .map((entry) =>
      mapItemToRow(entry.item, marketplaceId, {
        queryKeys: Array.from(entry.queryKeys),
        queryTiers: Array.from(entry.tiers).sort((a, b) => a - b),
        targetSegments: Array.from(entry.targetSegments),
        bestQueryTier: entry.bestQueryTier,
        bestBreadth: entry.bestBreadth,
        bestMatchScore: entry.bestScore,
        qualityBand: entry.qualityBand,
        acceptanceReason: entry.acceptanceReason,
        matchedSignals: entry.matchedSignals,
        missingSignals: entry.missingSignals,
        contradictionSignals: entry.contradictionSignals,
        matchSignals: entry.signals
      })
    );

  debugLog("candidate_merge_complete", {
    cardId: identity.cardId,
    plans: plans.map((plan) => plan.key),
    dedupedAccepted: ranked.length,
    maxAccepted
  });

  return {
    items: ranked,
    queries: plans.map((plan) => ({ key: plan.key, tier: plan.tier, targetSegment: plan.targetSegment, query: plan.query }))
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, error: "Missing required Supabase server environment variables." }, { status: 500 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return json({ ok: false, error: "Missing bearer token." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { cardId?: string; maxItems?: number } | null;
    const cardId = clean(body?.cardId);
    if (!cardId) {
      return json({ ok: false, error: "cardId is required." }, { status: 400 });
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const userId = await getUserIdByAuth(service, userData.user.id);
    const hasAccess = await userCanAccessCard(service, userId, cardId);
    if (!hasAccess) {
      return json({ ok: false, error: "Card not found or not accessible for this user." }, { status: 403 });
    }

    const identity = await loadIdentity(service, cardId);
    const result = await fetchActiveListings(identity, normalizeLimit(body?.maxItems));

    return json(
      {
        ok: true,
        provider: "ebay",
        usedMock: false,
        query: buildGeneralQuery(identity),
        queries: result.queries,
        items: result.items
      },
      { status: 200 }
    );
  } catch (error) {
    debugLog("request_failed", {
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected active market server error"
      },
      { status: 500 }
    );
  }
});
