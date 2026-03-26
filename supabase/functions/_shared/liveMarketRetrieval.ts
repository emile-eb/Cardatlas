// @ts-nocheck
const DEFAULT_EXCLUDED_KEYWORDS = ["lot", "reprint", "custom", "digital", "proxy"];

export type LiveMarketIdentity = {
  cardId: string;
  sport: string | null;
  playerName: string;
  cardTitle: string;
  year: number | null;
  brand: string | null;
  setName: string | null;
  cardNumber: string | null;
  team: string | null;
};

type QueryTargetSegment = "raw" | "psa9" | "psa10";
type QueryBreadth = "precision" | "identity";

export type LiveMarketQueryPlan = {
  key: string;
  tier: number;
  targetSegment: QueryTargetSegment;
  breadth: QueryBreadth;
  query: string;
};

export type LiveMarketCandidate = {
  id: string;
  source: "ebay";
  title: string;
  price: number;
  currency: string;
  itemWebUrl: string | null;
  imageUrl: string | null;
  itemOriginDate: string;
  condition: string | null;
  marketplaceId: string;
  rawPayload: Record<string, unknown> | null;
};

export type LiveMarketDebugContext = {
  requestId?: string;
  enabled?: boolean;
  inspectRejected?: boolean;
  requestOrigin?: string;
  onTrace?: (label: string, payload: Record<string, unknown>) => void;
};

type LiveMarketStage =
  | "query_plan_build"
  | "ebay_token"
  | "ebay_fetch"
  | "candidate_normalization"
  | "scoring"
  | "acceptance"
  | "final_return_shape";

export type LiveMarketRetrievalResult = {
  generalQuery: string;
  queries: Array<Pick<LiveMarketQueryPlan, "key" | "tier" | "targetSegment" | "query">>;
  items: LiveMarketCandidate[];
  counts: {
    totalRawRetrievedCount: number;
    totalDedupedCount: number;
    countAfterExcludedKeywordFiltering: number;
    acceptedCount: number;
    rejectedCount: number;
    rejectionCounts: Record<string, number>;
  };
  rejectedSamples: Array<Record<string, unknown>>;
  debugSummary?: {
    requestId: string;
    cardId: string;
    requestOrigin: string;
    dominantRejectionReason: string | null;
    thresholds: {
      raw: { minIdentityPoints: number };
      psa9: { minIdentityPoints: number; requireExplicitGrade: boolean };
      psa10: { minIdentityPoints: number; requireExplicitGrade: boolean };
    };
    identity: {
      player_name: string;
      year: number | null;
      brand: string | null;
      set_name: string | null;
      card_number: string | null;
      team: string | null;
      sport: string | null;
    };
    queryPlan: Array<{ key: string; query: string; targetSegment: QueryTargetSegment }>;
    queryResults: Array<{ key: string; returnedCount: number }>;
    totalRetrievedBeforeDedupe: number;
    totalRetrievedAfterDedupe: number;
    acceptedCount: number;
    rejectedCount: number;
    rejectionReasonBuckets: Record<string, number>;
    topRejectedCandidates: Array<{
      title: string;
      score: number;
      rejectionReason: string;
      matchedSignals: string[];
      contradictionSignals: string[];
      queryKey: string;
      targetSegment: QueryTargetSegment;
      cardNumberStatus: string;
      cardNumberReason: string | null;
      conflictingCardNumber: string | null;
    }>;
    finalReturnedCount: number;
  };
};

const REJECTION_BUCKETS = [
  "excluded_keyword",
  "wrong_card_number",
  "wrong_year",
  "wrong_grade",
  "missing_grade_signal",
  "weak_identity",
  "conflicting_set",
  "other"
];
const DEBUG_CARD_ID = "3d41362f-4033-4cc7-9077-5ef9a7cec50e";
const ACCEPTANCE_THRESHOLDS = {
  raw: {
    minIdentityPoints: 1
  },
  psa9: {
    minIdentityPoints: 2,
    requireExplicitGrade: true
  },
  psa10: {
    minIdentityPoints: 2,
    requireExplicitGrade: true
  }
} as const;

export function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
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

function trace(debug: LiveMarketDebugContext | undefined, label: string, payload: Record<string, unknown>) {
  if (!debug?.enabled || typeof debug.onTrace !== "function") return;
  debug.onTrace(label, {
    requestId: debug.requestId,
    ...payload
  });
}

export async function loadCardIdentity(service: any, cardId: string): Promise<LiveMarketIdentity> {
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

function pickPrimarySetTokens(identity: LiveMarketIdentity): string[] {
  const stopWords = new Set(["trading", "card", "cards", "edition", "series", "baseball", "basketball", "football", "soccer", "hockey"]);
  const brandTokens = new Set(tokenize(identity.brand));
  return tokenize(identity.setName).filter((token) => !stopWords.has(token) && !brandTokens.has(token)).slice(0, 2);
}

function pickStrongestSetToken(identity: LiveMarketIdentity): string {
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

export function buildGeneralQuery(identity: LiveMarketIdentity): string {
  return buildQuery([
    identity.year ? String(identity.year) : "",
    identity.playerName,
    identity.brand,
    identity.setName,
    identity.cardNumber
  ]);
}

function buildRawQueryPlans(identity: LiveMarketIdentity): LiveMarketQueryPlan[] {
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

function buildGradedQueryPlans(identity: LiveMarketIdentity, gradeSegment: "psa9" | "psa10"): LiveMarketQueryPlan[] {
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

export function buildLiveMarketQueryPlans(identity: LiveMarketIdentity): LiveMarketQueryPlan[] {
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

type CardNumberStatus = {
  status: "match" | "missing" | "ambiguous" | "conflict";
  extractedValue: string | null;
  confidenceReason: string;
};

function normalizeCardNumberToken(value: string | null | undefined): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractExplicitCardNumberCandidates(title: string): string[] {
  const rawTitle = clean(title).toLowerCase();
  if (!rawTitle) return [];

  const patterns = [
    /(?:^|[\s([{-])#\s*([a-z]{0,3}\d{1,4}[a-z]{0,3})(?=$|[\s)\]}.,;:!?-])/gi,
    /\b(?:no|number|card(?:\s*no|\s*number)?)\.?\s*#?\s*([a-z]{0,3}\d{1,4}[a-z]{0,3})\b/gi
  ];

  const candidates = patterns.flatMap((pattern) =>
    Array.from(rawTitle.matchAll(pattern))
      .map((match) => normalizeCardNumberToken(match[1]))
      .filter(Boolean)
  );

  return dedupeTokens(candidates);
}

function hasAmbiguousCardNumberNoise(title: string): boolean {
  const rawTitle = clean(title).toLowerCase();
  if (!rawTitle) return false;
  return /\b\d{1,4}[/-]\d{1,4}\b/.test(rawTitle) || /\b[a-z]{0,2}\d{1,4}[a-z]{0,2}\b/.test(rawTitle);
}

function getCardNumberStatus(title: string, normalizedTitle: string, identityCardNumberTokens: string[]): CardNumberStatus {
  if (!identityCardNumberTokens.length) {
    return {
      status: "missing",
      extractedValue: null,
      confidenceReason: "no_identity_card_number"
    };
  }

  const normalizedIdentity = new Set(identityCardNumberTokens.map((token) => normalizeCardNumberToken(token)).filter(Boolean));

  if (hasExactCardNumber(normalizedTitle, identityCardNumberTokens)) {
    return {
      status: "match",
      extractedValue: clean(identityCardNumberTokens[0]) || null,
      confidenceReason: "exact_card_number_match"
    };
  }

  const explicitCandidates = extractExplicitCardNumberCandidates(title);
  if (!explicitCandidates.length) {
    return {
      status: hasAmbiguousCardNumberNoise(title) ? "ambiguous" : "missing",
      extractedValue: null,
      confidenceReason: hasAmbiguousCardNumberNoise(title) ? "numeric_noise_without_explicit_card_marker" : "no_explicit_card_number_signal"
    };
  }

  const matchingCandidate = explicitCandidates.find((candidate) => normalizedIdentity.has(candidate));
  if (matchingCandidate) {
    return {
      status: "match",
      extractedValue: matchingCandidate,
      confidenceReason: "explicit_card_number_match"
    };
  }

  return {
    status: "conflict",
    extractedValue: explicitCandidates[0] ?? null,
    confidenceReason: "explicit_conflicting_card_number"
  };
}

function getDifferentExplicitYear(normalizedTitle: string, year: number | null | undefined): boolean {
  if (!year) return false;
  const years = Array.from(normalizedTitle.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((match) => Number(match[1]));
  if (!years.length) return false;
  return years.some((value) => value !== year);
}

function getGradeSignal(normalizedTitle: string, targetSegment: QueryTargetSegment) {
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
    partial: matches >= 1,
    contradiction: false
  };
}

function getIdentityPoints(signals: {
  playerSignal: { strong: boolean; partial: boolean };
  brandSignal: { positive: boolean };
  setSignal: { positive: boolean };
  teamMatches: number;
  cardNumberMatch: boolean;
  yearMatch: boolean;
}) {
  let points = 0;
  if (signals.playerSignal.strong) {
    points += 3;
  } else if (signals.playerSignal.partial) {
    points += 2;
  }
  if (signals.cardNumberMatch) points += 3;
  if (signals.brandSignal.positive) points += 1;
  if (signals.setSignal.positive) points += 1;
  if (signals.yearMatch) points += 1;
  if (signals.teamMatches > 0) points += 1;
  return points;
}

function safeCardNumberStatus(value: Partial<CardNumberStatus> | null | undefined): CardNumberStatus {
  const status = value?.status;
  return {
    status: status === "match" || status === "missing" || status === "ambiguous" || status === "conflict" ? status : "missing",
    extractedValue: clean(value?.extractedValue) || null,
    confidenceReason: clean(value?.confidenceReason) || "unknown_card_number_status"
  };
}

function createStageError(stage: LiveMarketStage, error: unknown, extra: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error ?? "unknown_error");
  const stageError = new Error(message);
  if (error instanceof Error && error.stack) {
    stageError.stack = error.stack;
  }
  (stageError as Error & { stage?: string; context?: Record<string, unknown> }).stage = stage;
  (stageError as Error & { stage?: string; context?: Record<string, unknown> }).context = extra;
  return stageError;
}

function scoreCandidate(item: any, identity: LiveMarketIdentity, targetSegment: QueryTargetSegment, excludedKeywords: string[]) {
  const title = clean(item?.title);
  const normalizedTitle = normalizeListingTitle(title);

  if (!normalizedTitle) {
    return {
      accepted: false,
      score: -100,
      qualityBand: "weak",
      reason: "missing_title",
      rejectionBucket: "other",
      strongGradeMatch: false
    };
  }

  if (hasExcludedKeyword(normalizedTitle, excludedKeywords)) {
    return {
      accepted: false,
      score: -100,
      qualityBand: "weak",
      reason: "excluded_keyword",
      rejectionBucket: "excluded_keyword",
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
  const cardNumberStatus = safeCardNumberStatus(getCardNumberStatus(title, normalizedTitle, cardNumberTokens));
  const cardNumberMatch = cardNumberStatus.status === "match";
  const wrongCardNumber = cardNumberStatus.status === "conflict";
  const yearMatch = identity.year ? normalizedTitle.includes(String(identity.year)) : false;
  const wrongYear = getDifferentExplicitYear(normalizedTitle, identity.year);
  const gradeSignal = getGradeSignal(normalizedTitle, targetSegment);
  const rawConflictRelaxed =
    targetSegment === "raw" &&
    wrongCardNumber &&
    /^\d+$/.test(cardNumberStatus.extractedValue ?? "") &&
    playerSignal.strong &&
    (brandSignal.positive || setSignal.positive);

  const contradictionSignals = [
    wrongCardNumber && !rawConflictRelaxed ? "wrong_card_number" : null,
    wrongYear ? "wrong_year" : null,
    gradeSignal.contradiction ? "wrong_grade" : null
  ].filter(Boolean) as string[];

  if (contradictionSignals.length) {
    const rejectionBucket = contradictionSignals.includes("wrong_card_number")
      ? "wrong_card_number"
      : contradictionSignals.includes("wrong_year")
        ? "wrong_year"
        : contradictionSignals.includes("wrong_grade")
          ? "wrong_grade"
          : "other";
    return {
      accepted: false,
      score: -25,
      qualityBand: "weak",
      reason: "contradictory_identity_signal",
      rejectionBucket,
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
        cardNumberStatus: cardNumberStatus.status,
        cardNumberReason: cardNumberStatus.confidenceReason,
        conflictingCardNumber: cardNumberStatus.extractedValue,
        wrongCardNumber,
        rawConflictRelaxed,
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

  const identityPoints = getIdentityPoints({
    playerSignal,
    brandSignal,
    setSignal,
    teamMatches,
    cardNumberMatch,
    yearMatch
  });
  const thresholds = ACCEPTANCE_THRESHOLDS[targetSegment];
  const rawAccepted = identityPoints >= thresholds.minIdentityPoints;
  const gradedAccepted = gradeSignal.positive && identityPoints >= thresholds.minIdentityPoints;
  const accepted = targetSegment === "raw" ? rawAccepted : gradedAccepted;
  const qualityBand = accepted
    ? cardNumberMatch && (gradeSignal.positive || yearMatch || brandSignal.positive || setSignal.positive)
      ? "strong"
      : identityPoints >= thresholds.minIdentityPoints + 2
        ? "strong"
        : "medium"
    : "weak";
  const reason = accepted
    ? targetSegment === "raw"
      ? identityPoints >= thresholds.minIdentityPoints + 2
        ? "accepted_raw_strong_identity_support"
        : "accepted_raw_threshold_support"
      : identityPoints >= thresholds.minIdentityPoints + 2
        ? "accepted_graded_strong_identity_support"
        : "accepted_graded_threshold_support"
    : targetSegment === "raw"
      ? "rejected_raw_identity_threshold_gate"
      : "rejected_graded_identity_threshold_gate";
  const rejectionBucket: string | null = accepted ? null : "weak_identity";

  return {
    accepted,
    score,
    qualityBand,
    reason,
    rejectionBucket,
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
      cardNumberStatus: cardNumberStatus.status,
      cardNumberReason: cardNumberStatus.confidenceReason,
      conflictingCardNumber: cardNumberStatus.extractedValue,
      wrongCardNumber,
      rawConflictRelaxed,
      identityPoints,
      thresholdUsed: thresholds.minIdentityPoints,
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

function mapItemToCandidate(item: any, marketplaceId: string, debugMeta: Record<string, unknown>): LiveMarketCandidate {
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

export async function retrieveAcceptedEbayMarketListings(
  identity: LiveMarketIdentity,
  options: { limit?: number; debug?: LiveMarketDebugContext } = {}
): Promise<LiveMarketRetrievalResult> {
  const debug = options.debug;
  let currentStage: LiveMarketStage = "query_plan_build";

  try {
    const queryPlans = buildLiveMarketQueryPlans(identity);
    if (!queryPlans.length) {
      throw new Error("Card identity is too weak for active market query.");
    }

    const marketplaceId = getMarketplaceId();
    currentStage = "ebay_token";
    const token = await getEbayAccessToken();
    const excludedKeywords = resolveExcludedKeywords();
    const limit = Number(options.limit ?? 12);
    const precisionQueryLimit = Math.min(Math.max(limit * 2, 18), 32);
    const identityQueryLimit = Math.min(Math.max(limit * 3, 24), 44);
    const maxAccepted = 20;
    const rejectionCounts = Object.fromEntries(REJECTION_BUCKETS.map((bucket) => [bucket, 0])) as Record<string, number>;
    const rejectedSamples: Array<Record<string, unknown>> = [];
    const queryResults: Array<{ key: string; returnedCount: number }> = [];
    let rawRetrievedCount = 0;
    let keywordEligibleCount = 0;
    const shouldReturnDebugSummary = debug?.enabled === true && identity.cardId === DEBUG_CARD_ID;

    trace(debug, "request_start", {
      requestId: debug?.requestId,
      cardId: identity.cardId,
      requestOrigin: debug?.requestOrigin ?? "unknown",
      maxItems: limit,
      targetMode: "live_ebay_market"
    });

    trace(debug, "identity_loaded", {
      requestId: debug?.requestId,
      cardId: identity.cardId,
      player_name: identity.playerName,
      year: identity.year,
      brand: identity.brand,
      set_name: identity.setName,
      card_number: identity.cardNumber,
      team: identity.team,
      sport: identity.sport
    });

    trace(debug, "query_plan_built", {
      cardId: identity.cardId,
      requestOrigin: debug?.requestOrigin ?? "unknown",
      totalQueryCount: queryPlans.length,
      queries: queryPlans.map((plan) => ({
        key: plan.key,
        tier: plan.tier,
        breadth: plan.breadth,
        targetSegment: plan.targetSegment,
        query: plan.query
      }))
    });

    currentStage = "ebay_fetch";
    const results = await Promise.all(
      queryPlans.map(async (plan) => {
        const fetchLimit = plan.breadth === "identity" ? identityQueryLimit : precisionQueryLimit;
        const items = await fetchBrowseCandidates(plan.query, fetchLimit, token, marketplaceId);
        return { plan, items: Array.isArray(items) ? items : [] };
      })
    );

    const deduped = new Map<string, any>();

    for (const result of results) {
      const resultItems = Array.isArray(result?.items) ? result.items : [];
      const resultPlan = result?.plan;
      rawRetrievedCount += resultItems.length;
      queryResults.push({
        key: String(resultPlan?.key ?? "unknown"),
        returnedCount: resultItems.length
      });
      trace(debug, "ebay_fetch_results", {
        cardId: identity.cardId,
        queryKey: resultPlan?.key,
        tier: resultPlan?.tier,
        breadth: resultPlan?.breadth,
        targetSegment: resultPlan?.targetSegment,
        query: resultPlan?.query,
        returned: resultItems.length
      });

      for (const item of resultItems) {
        const itemId = clean(item?.itemId);
        const price = Number(item?.price?.value ?? 0);
        if (!itemId || !Number.isFinite(price) || price <= 0) continue;

        currentStage = "scoring";
        const evaluation = scoreCandidate(
          item,
          identity,
          resultPlan?.targetSegment === "psa9" || resultPlan?.targetSegment === "psa10" ? resultPlan.targetSegment : "raw",
          excludedKeywords
        );
        if (evaluation.reason !== "excluded_keyword") {
          keywordEligibleCount += 1;
        }
        currentStage = "acceptance";
        if (!evaluation.accepted) {
          const bucket = evaluation.rejectionBucket ?? "other";
          rejectionCounts[bucket] = (rejectionCounts[bucket] ?? 0) + 1;
          if (debug?.inspectRejected) {
            rejectedSamples.push({
              title: clean(item?.title),
              score: Number(evaluation.score ?? 0),
              queryKey: String(resultPlan?.key ?? "unknown"),
              targetSegment: resultPlan?.targetSegment ?? "raw",
              matchedSignals: Array.isArray(evaluation.matchedSignals) ? evaluation.matchedSignals : [],
              missingSignals: Array.isArray(evaluation.missingSignals) ? evaluation.missingSignals : [],
              contradictionSignals: Array.isArray(evaluation.contradictionSignals) ? evaluation.contradictionSignals : [],
              rejectionReason: clean(evaluation.reason) || "unknown_rejection_reason",
              rejectionBucket: bucket,
              cardNumberStatus: evaluation.signals?.cardNumberStatus ?? null,
              cardNumberReason: evaluation.signals?.cardNumberReason ?? null,
              conflictingCardNumber: evaluation.signals?.conflictingCardNumber ?? null
            });
          }
          continue;
        }

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
        entry.targetSegments.add(String(resultPlan?.targetSegment ?? "raw"));
        entry.queryKeys.add(String(resultPlan?.key ?? "unknown"));
        if (typeof resultPlan?.tier === "number") {
          entry.tiers.add(resultPlan.tier);
        }

        if (Number(evaluation.score ?? -1) > entry.bestScore) {
          entry.bestScore = Number(evaluation.score ?? -1);
          entry.bestQueryTier = typeof resultPlan?.tier === "number" ? resultPlan.tier : null;
          entry.bestBreadth = resultPlan?.breadth ?? null;
          entry.qualityBand = clean(evaluation.qualityBand) || "weak";
          entry.acceptanceReason = clean(evaluation.reason) || null;
          entry.matchedSignals = Array.isArray(evaluation.matchedSignals) ? evaluation.matchedSignals : [];
          entry.missingSignals = Array.isArray(evaluation.missingSignals) ? evaluation.missingSignals : [];
          entry.contradictionSignals = Array.isArray(evaluation.contradictionSignals) ? evaluation.contradictionSignals : [];
          entry.signals = evaluation.signals ?? null;
        }

        deduped.set(itemId, entry);
      }
    }

    trace(debug, "ebay_fetch_results", {
      cardId: identity.cardId,
      totalRawRetrievedCount: rawRetrievedCount,
      totalDedupedCount: deduped.size,
      countAfterExcludedKeywordFiltering: keywordEligibleCount
    });

    currentStage = "final_return_shape";
    const items = Array.from(deduped.values())
      .sort((a, b) => {
        if (Number(b.bestScore ?? -1) !== Number(a.bestScore ?? -1)) return Number(b.bestScore ?? -1) - Number(a.bestScore ?? -1);
        return clean(b.item?.itemOriginDate).localeCompare(clean(a.item?.itemOriginDate));
      })
      .slice(0, maxAccepted)
      .map((entry) =>
        mapItemToCandidate(entry.item, marketplaceId, {
          queryKeys: Array.from(entry.queryKeys ?? []),
          queryTiers: Array.from(entry.tiers ?? []).sort((a, b) => a - b),
          targetSegments: Array.from(entry.targetSegments ?? []),
          bestQueryTier: entry.bestQueryTier,
          bestBreadth: entry.bestBreadth,
          bestMatchScore: entry.bestScore,
          qualityBand: entry.qualityBand,
          acceptanceReason: entry.acceptanceReason,
          matchedSignals: Array.isArray(entry.matchedSignals) ? entry.matchedSignals : [],
          missingSignals: Array.isArray(entry.missingSignals) ? entry.missingSignals : [],
          contradictionSignals: Array.isArray(entry.contradictionSignals) ? entry.contradictionSignals : [],
          matchSignals: entry.signals ?? null
        })
      );

    trace(debug, "scoring_summary", {
      cardId: identity.cardId,
      acceptedCount: items.length,
      rejectedCount: Object.values(rejectionCounts).reduce((sum, value) => sum + value, 0),
      rejectionCounts
    });

    if (debug?.inspectRejected) {
      trace(debug, "top_rejected_candidates", {
        cardId: identity.cardId,
        candidates: rejectedSamples.sort((a, b) => Number(b.score ?? -999) - Number(a.score ?? -999)).slice(0, 8)
      });
    }

    const topRejectedCandidates = rejectedSamples
    .sort((a, b) => Number(b.score ?? -999) - Number(a.score ?? -999))
    .slice(0, 8)
    .map((candidate) => ({
      title: String(candidate.title ?? ""),
      score: Number(candidate.score ?? 0),
      rejectionReason: String(candidate.rejectionReason ?? candidate.rejectionBucket ?? "other"),
      matchedSignals: Array.isArray(candidate.matchedSignals) ? candidate.matchedSignals.map((value) => String(value)) : [],
      contradictionSignals: Array.isArray(candidate.contradictionSignals) ? candidate.contradictionSignals.map((value) => String(value)) : [],
      queryKey: String(candidate.queryKey ?? ""),
      targetSegment: String(candidate.targetSegment ?? "raw") as QueryTargetSegment,
      cardNumberStatus: String(candidate.cardNumberStatus ?? "missing"),
      cardNumberReason: candidate.cardNumberReason == null ? null : String(candidate.cardNumberReason),
      conflictingCardNumber: candidate.conflictingCardNumber == null ? null : String(candidate.conflictingCardNumber)
    }));

    const dominantRejectionReason =
      Object.entries(rejectionCounts)
        .sort((a, b) => b[1] - a[1])
        .find((entry) => entry[1] > 0)?.[0] ?? null;

    trace(debug, "before_return", {
      cardId: identity.cardId,
      requestOrigin: debug?.requestOrigin ?? "unknown",
      finalReturnedCount: items.length,
      firstTitles: items.slice(0, 5).map((entry) => entry.title),
      firstAcceptance: items.slice(0, 5).map((entry) => ({
        title: entry.title,
        score: entry.rawPayload?.activeMarketDebug?.bestMatchScore,
        acceptanceReason: entry.rawPayload?.activeMarketDebug?.acceptanceReason
      }))
    });

    return {
      generalQuery: buildGeneralQuery(identity),
      queries: queryPlans.map((plan) => ({
        key: plan.key,
        tier: plan.tier,
        targetSegment: plan.targetSegment,
        query: plan.query
      })),
      items,
      counts: {
        totalRawRetrievedCount: rawRetrievedCount,
        totalDedupedCount: deduped.size,
        countAfterExcludedKeywordFiltering: keywordEligibleCount,
        acceptedCount: items.length,
        rejectedCount: Object.values(rejectionCounts).reduce((sum, value) => sum + value, 0),
        rejectionCounts
      },
      rejectedSamples,
      debugSummary: shouldReturnDebugSummary
        ? {
            requestId: String(debug?.requestId ?? ""),
            cardId: identity.cardId,
            requestOrigin: String(debug?.requestOrigin ?? "unknown"),
            dominantRejectionReason,
            thresholds: {
              raw: { minIdentityPoints: ACCEPTANCE_THRESHOLDS.raw.minIdentityPoints },
              psa9: {
                minIdentityPoints: ACCEPTANCE_THRESHOLDS.psa9.minIdentityPoints,
                requireExplicitGrade: ACCEPTANCE_THRESHOLDS.psa9.requireExplicitGrade
              },
              psa10: {
                minIdentityPoints: ACCEPTANCE_THRESHOLDS.psa10.minIdentityPoints,
                requireExplicitGrade: ACCEPTANCE_THRESHOLDS.psa10.requireExplicitGrade
              }
            },
            identity: {
              player_name: identity.playerName,
              year: identity.year,
              brand: identity.brand,
              set_name: identity.setName,
              card_number: identity.cardNumber,
              team: identity.team,
              sport: identity.sport
            },
            queryPlan: queryPlans.map((plan) => ({
              key: plan.key,
              query: plan.query,
              targetSegment: plan.targetSegment
            })),
            queryResults,
            totalRetrievedBeforeDedupe: rawRetrievedCount,
            totalRetrievedAfterDedupe: deduped.size,
            acceptedCount: items.length,
            rejectedCount: Object.values(rejectionCounts).reduce((sum, value) => sum + value, 0),
            rejectionReasonBuckets: rejectionCounts,
            topRejectedCandidates,
            finalReturnedCount: items.length
          }
        : undefined
    };
  } catch (error) {
    trace(debug, "crash", {
      cardId: identity.cardId,
      requestOrigin: debug?.requestOrigin ?? "unknown",
      stage: currentStage,
      message: error instanceof Error ? error.message : String(error ?? "unknown_error")
    });
    throw createStageError(currentStage, error, {
      cardId: identity.cardId,
      requestOrigin: debug?.requestOrigin ?? "unknown"
    });
  }
}
