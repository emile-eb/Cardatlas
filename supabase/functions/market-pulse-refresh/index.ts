// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 20;
const SOURCE_ID = "cardatlas_pulse";
const DEFAULT_EXCLUDED_KEYWORDS = ["lot", "reprint", "custom", "digital", "proxy"];
const FORCED_DEBUG_PLAYER_NAME = "alex rodriguez";
const RAW_MIN_SCORE = 7;
const GRADED_STRONG_SCORE = 14;
const GRADED_MEDIUM_SCORE = 11;

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

function normalizePersonName(value: string | null | undefined): string {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeLimit(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.round(parsed), 1), MAX_LIMIT);
}

function shouldDebugLog(): boolean {
  return (Deno.env.get("ACTIVE_MARKET_DEBUG") ?? "").toLowerCase() === "true" || !Deno.env.get("DENO_DEPLOYMENT_ID");
}

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!shouldDebugLog()) return;
  console.log(`[market-pulse-refresh] ${label}`, payload);
}

function getMarketplaceId(): string {
  return clean(Deno.env.get("EBAY_MARKETPLACE_ID")) || clean(Deno.env.get("EXPO_PUBLIC_EBAY_MARKETPLACE_ID")) || "EBAY_US";
}

function resolveExcludedKeywords(): string[] {
  const fromEnv = clean(Deno.env.get("EBAY_ACTIVE_EXCLUDED_KEYWORDS"));
  if (!fromEnv) return DEFAULT_EXCLUDED_KEYWORDS;
  return fromEnv
    .split(",")
    .map((part) => clean(part).toLowerCase())
    .filter(Boolean);
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

function buildGradedQueryPlans(identity: any, gradeSegment: "psa9" | "psa10") {
  const gradeToken = gradeSegment === "psa10" ? "PSA 10" : "PSA 9";
  const primarySetTokens = pickPrimarySetTokens(identity);
  const brandOrSet = clean(identity.brand) || primarySetTokens.join(" ");

  return [
    {
      key: `${gradeSegment}_tier1`,
      tier: 1,
      targetSegment: gradeSegment,
      query: buildQuery([identity.year, identity.playerName, identity.brand, identity.setName, identity.cardNumber, gradeToken])
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
    {
      key: "general_raw_anchor",
      tier: 1,
      targetSegment: "raw",
      query: buildGeneralQuery(identity)
    },
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

  return {
    accepted: meetsStrongThreshold || meetsMediumThreshold,
    score
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

async function fetchActiveListingsForIdentity(identity: any, limit: number) {
  const plans = buildQueryPlans(identity);
  const marketplaceId = getMarketplaceId();
  const token = await getEbayAccessToken();
  const excludedKeywords = resolveExcludedKeywords();
  const perQueryLimit = Math.min(Math.max(limit * 2, 20), 40);
  const maxAccepted = Math.min(Math.max(limit * 2, 16), 24);

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
      if (!existing || evaluation.score > existing.score) {
        deduped.set(itemId, {
          item,
          score: evaluation.score,
          debug: {
            queryKey: result.plan.key,
            tier: result.plan.tier,
            targetSegment: result.plan.targetSegment
          }
        });
      }
    }
  }

  const items = Array.from(deduped.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return clean(b.item?.itemOriginDate).localeCompare(clean(a.item?.itemOriginDate));
    })
    .slice(0, maxAccepted)
    .map((entry) => ({
      id: clean(entry.item?.itemId) || crypto.randomUUID(),
      source: "ebay",
      title: clean(entry.item?.title) || "eBay Listing",
      price: Number(entry.item?.price?.value ?? 0),
      currency: clean(entry.item?.price?.currency) || "USD",
      itemWebUrl: clean(entry.item?.itemWebUrl) || null,
      imageUrl: pickImageUrl(entry.item),
      itemOriginDate: clean(entry.item?.itemOriginDate) || nowIso(),
      condition: normalizeCondition(entry.item),
      marketplaceId,
      rawPayload: {
        ebayItem: entry.item ?? null,
        activeMarketDebug: {
          bestMatchScore: entry.score,
          ...entry.debug
        }
      }
    }));

  return items;
}

async function getUserIdByAuth(service: any, authUserId: string): Promise<string> {
  const { data, error } = await service.from("users").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("User not found for auth identity.");
  return data.id;
}

async function loadPulseCandidates(service: any, limit: number) {
  const candidatePoolSize = Math.max(limit * 3, 24);
  const { data: valuations, error } = await service
    .from("valuation_snapshots")
    .select("card_id,reference_value,fetched_at")
    .not("card_id", "is", null)
    .order("fetched_at", { ascending: false })
    .limit(candidatePoolSize * 3);

  if (error) throw error;

  const latestByCard = new Map<string, any>();
  for (const row of valuations ?? []) {
    const cardId = clean(row.card_id);
    const referenceValue = Number(row.reference_value ?? 0);
    if (!cardId || latestByCard.has(cardId) || !Number.isFinite(referenceValue) || referenceValue <= 5) continue;
    latestByCard.set(cardId, row);
    if (latestByCard.size >= candidatePoolSize) break;
  }

  const cardIds = Array.from(latestByCard.keys());
  if (!cardIds.length) return [];

  const { data: cards, error: cardsError } = await service
    .from("cards")
    .select("id,sport,player_name,card_title,year,brand,set_name,card_number,team")
    .in("id", cardIds);

  if (cardsError) throw cardsError;

  return (cards ?? [])
    .map((card: any) => {
      const valuation = latestByCard.get(card.id);
      return {
        cardId: card.id,
        sport: card.sport ?? null,
        playerName: card.player_name ?? "",
        cardTitle: card.card_title ?? "",
        year: card.year ?? null,
        brand: card.brand ?? null,
        setName: card.set_name ?? null,
        cardNumber: card.card_number ?? null,
        team: card.team ?? null,
        referenceValue: Number(valuation?.reference_value ?? 0),
        valuationFetchedAt: valuation?.fetched_at ?? null
      };
    })
    .filter((candidate) => candidate.playerName && candidate.cardNumber)
    .filter((candidate) => normalizePersonName(candidate.playerName) === FORCED_DEBUG_PLAYER_NAME)
    .slice(0, candidatePoolSize);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPulseTitle(candidate: any): string {
  return [candidate.year ? String(candidate.year) : "", candidate.brand, candidate.setName, candidate.cardNumber ? `#${candidate.cardNumber}` : "", candidate.playerName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: value >= 100 ? 0 : 2 })}`;
}

function choosePulseReason(referenceValue: number, averageAsk: number, listingCount: number): string {
  if (listingCount >= 8 && averageAsk > referenceValue * 1.18) return "Strong ask premium";
  if (listingCount >= 10) return "High listing activity";
  if (listingCount >= 6) return "Dense live inventory";
  if (averageAsk > referenceValue * 1.1) return "Active collector market";
  return "Live market snapshot";
}

function computePulseScore(referenceValue: number, averageAsk: number, listingCount: number, latestListingDate: string | null): number {
  const spreadRatio = referenceValue > 0 ? Math.abs(averageAsk - referenceValue) / referenceValue : 0;
  const listingActivityScore = Math.min(listingCount, 12) * 5;
  const spreadScore = Math.min(spreadRatio, 1.5) * 30;
  const freshnessHours = latestListingDate ? Math.max(0, (Date.now() - Date.parse(latestListingDate)) / (1000 * 60 * 60)) : 72;
  const freshnessScore = freshnessHours <= 6 ? 12 : freshnessHours <= 24 ? 8 : freshnessHours <= 48 ? 4 : 0;
  return Number((listingActivityScore + spreadScore + freshnessScore).toFixed(2));
}

async function buildPulseRows(service: any, limit: number) {
  const candidates = await loadPulseCandidates(service, limit);
  const enriched = [];

  for (const candidate of candidates) {
    try {
      const listings = await fetchActiveListingsForIdentity(candidate, 10);
      const prices = listings.map((listing) => Number(listing.price ?? 0)).filter((value) => Number.isFinite(value) && value > 0);
      if (!prices.length) continue;

      const averageAsk = average(prices);
      const lowestAsk = Math.min(...prices);
      const listingCount = prices.length;
      if (!averageAsk || listingCount < 2) continue;

      const freshestListing = listings
        .map((listing) => listing.itemOriginDate)
        .filter(Boolean)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? nowIso();
      const primaryListing = listings[0];
      const pulseScore = computePulseScore(candidate.referenceValue, averageAsk, listingCount, freshestListing);
      const pulseReason = choosePulseReason(candidate.referenceValue, averageAsk, listingCount);

      enriched.push({
        source: SOURCE_ID,
        source_listing_id: candidate.cardId,
        title: formatPulseTitle(candidate),
        subtitle: `${formatCurrency(candidate.referenceValue)} reference · ${listingCount} live asks`,
        image_url: primaryListing?.imageUrl ?? null,
        item_web_url: primaryListing?.itemWebUrl ?? null,
        price: Number(averageAsk.toFixed(2)),
        currency: primaryListing?.currency ?? "USD",
        item_origin_date: freshestListing,
        buying_options: null,
        marketplace_id: primaryListing?.marketplaceId ?? getMarketplaceId(),
        card_id: candidate.cardId,
        sport: candidate.sport ?? null,
        player_name: candidate.playerName,
        team: candidate.team ?? null,
        pulse_reason: pulseReason,
        is_mock: false,
        sort_order: 0,
        raw_payload: {
          cardIdentity: {
            cardId: candidate.cardId,
            playerName: candidate.playerName,
            year: candidate.year,
            brand: candidate.brand,
            setName: candidate.setName,
            cardNumber: candidate.cardNumber,
            sport: candidate.sport,
            team: candidate.team
          },
          marketContext: {
            referenceValue: candidate.referenceValue,
            activeMarketAverageAsk: Number(averageAsk.toFixed(2)),
            lowestAsk: Number(lowestAsk.toFixed(2)),
            listingCount,
            pulseScore,
            refreshedAt: nowIso()
          },
          listingsSample: listings.slice(0, 4).map((listing) => ({
            id: listing.id,
            title: listing.title,
            price: listing.price,
            itemWebUrl: listing.itemWebUrl
          }))
        }
      });
    } catch (error) {
      debugLog("candidate_enrichment_failed", {
        cardId: candidate.cardId,
        error: error instanceof Error ? error.message : "unknown_error"
      });
    }
  }

  const ranked = enriched
    .sort((a, b) => {
      const aScore = Number(a.raw_payload?.marketContext?.pulseScore ?? 0);
      const bScore = Number(b.raw_payload?.marketContext?.pulseScore ?? 0);
      if (bScore !== aScore) return bScore - aScore;
      return Date.parse(b.item_origin_date ?? "") - Date.parse(a.item_origin_date ?? "");
    })
    .slice(0, limit)
    .map((row, index) => ({
      ...row,
      sort_order: index
    }));

  return ranked;
}

function mapRowToProviderListing(row: any) {
  const rawPayload = row.raw_payload ?? {};
  const cardIdentity = rawPayload.cardIdentity ?? {};
  const marketContext = rawPayload.marketContext ?? {};
  return {
    source: row.source,
    sourceListingId: row.source_listing_id ?? null,
    title: row.title,
    subtitle: row.subtitle ?? null,
    imageUrl: row.image_url ?? null,
    itemWebUrl: row.item_web_url ?? null,
    price: row.price != null ? Number(row.price) : null,
    currency: row.currency ?? "USD",
    itemOriginDate: row.item_origin_date ?? null,
    buyingOptions: row.buying_options ?? null,
    marketplaceId: row.marketplace_id ?? null,
    cardId: row.card_id ?? null,
    year: cardIdentity.year ?? null,
    brand: cardIdentity.brand ?? null,
    setName: cardIdentity.setName ?? null,
    cardNumber: cardIdentity.cardNumber ?? null,
    sport: row.sport ?? null,
    playerName: row.player_name ?? null,
    team: row.team ?? null,
    referenceValue: marketContext.referenceValue ?? null,
    activeMarketAverageAsk: marketContext.activeMarketAverageAsk ?? null,
    lowestAsk: marketContext.lowestAsk ?? null,
    listingCount: marketContext.listingCount ?? null,
    pulseReason: row.pulse_reason ?? null,
    signalStrengthScore: marketContext.pulseScore ?? null,
    lastRefreshedAt: marketContext.refreshedAt ?? row.updated_at ?? row.created_at ?? null,
    isMock: Boolean(row.is_mock),
    rawPayload: rawPayload
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

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    await getUserIdByAuth(service, userData.user.id);

    const body = (await req.json().catch(() => null)) as { limit?: number } | null;
    const limit = normalizeLimit(body?.limit);
    const rows = await buildPulseRows(service, limit);
    if (!rows.length) {
      return json({
        ok: true,
        source: "ebay",
        isMock: false,
        items: [],
        itemsWritten: 0,
        refreshedAt: nowIso()
      });
    }

    await service.from("market_pulse_items").delete().eq("source", SOURCE_ID);
    const { data: written, error: writeError } = await service
      .from("market_pulse_items")
      .insert(rows)
      .select("*");

    if (writeError) throw writeError;

    debugLog("refresh_completed", {
      userId: userData.user.id,
      itemsWritten: written?.length ?? rows.length
    });

    return json({
      ok: true,
      source: "ebay",
      isMock: false,
      items: (written ?? rows).map(mapRowToProviderListing),
      itemsWritten: written?.length ?? rows.length,
      refreshedAt: nowIso()
    });
  } catch (error) {
    debugLog("refresh_failed", {
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected market pulse refresh error"
      },
      { status: 500 }
    );
  }
});
