import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import { activeListingsService } from "@/services/activeListings/ActiveListingsService";
import type {
  CardGradingScenario,
  GradingOutlook,
  GradingRecommendation,
  GradingScenarioSource,
  StructuredCardIdentification,
  UUID
} from "@/types";
import type { ActiveMarketDebugTrace } from "@/services/activeListings/types";

const PSA9_HEURISTIC_MULTIPLIER = 2.0;
const PSA10_HEURISTIC_MULTIPLIER = 4.5;
const MIN_GRADING_MULTIPLIER = 0.75;
const MAX_GRADING_MULTIPLIER = 12;
const ACTIVE_MARKET_WINDOW = 24;
const DEBUG_CARD_ID = "3d41362f-4033-4cc7-9077-5ef9a7cec50e";

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log(`[grading_outlook] ${label}`, payload);
}

type GradingPayload = Pick<
  StructuredCardIdentification,
  "psa9Multiplier" | "psa10Multiplier" | "gradingReason" | "gradingRecommendation" | "gradingConfidence"
>;

type RecommendationDecision = {
  recommendation: GradingRecommendation;
  rationale: string;
};

type MultiplierResolution = {
  value: number;
  source: "gpt" | "heuristic";
  wasClamped: boolean;
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function asFinitePositiveNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeRecommendation(value?: string | null): GradingRecommendation | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("worth")) return "Worth Grading";
  if (normalized.includes("only") && normalized.includes("condition")) return "Only if condition is strong";
  if (normalized.includes("not worth") || normalized.includes("probably not")) return "Probably not worth grading";
  return null;
}

function resolveMultiplier(input: unknown, fallback: number): MultiplierResolution {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return {
      value: fallback,
      source: "heuristic",
      wasClamped: false
    };
  }

  const clamped = Math.min(MAX_GRADING_MULTIPLIER, Math.max(MIN_GRADING_MULTIPLIER, parsed));
  return {
    value: clamped,
    source: "gpt",
    wasClamped: clamped !== parsed
  };
}

function computeOutcome(rawReferenceValue: number, multiplier: number, activeAverageAsk: number | null) {
  const base = rawReferenceValue * multiplier;
  if (!activeAverageAsk || activeAverageAsk <= 0) {
    return {
      baseValue: round2(base),
      outcomeValue: round2(base),
      usedActiveAverage: false
    };
  }

  const thirdDifference = (base - activeAverageAsk) / 3;
  const outcome = base - thirdDifference;
  return {
    baseValue: round2(base),
    outcomeValue: round2(outcome),
    usedActiveAverage: true
  };
}

function decideFormulaRecommendation(raw: number, psa9: number, psa10: number): RecommendationDecision {
  const nineUpside = psa9 - raw;
  const tenUpside = psa10 - raw;
  const nineRatio = raw > 0 ? psa9 / raw : 1;
  const tenRatio = raw > 0 ? psa10 / raw : 1;

  if (nineRatio >= 1.6 && tenRatio >= 2.8 && tenUpside >= 150) {
    return {
      recommendation: "Worth Grading",
      rationale: "The projected PSA 9 and PSA 10 outcomes both clear the current CardAtlas baseline with real upside."
    };
  }

  if (tenRatio >= 2.5 && nineRatio < 1.6) {
    return {
      recommendation: "Only if condition is strong",
      rationale: "Most of the expected upside is concentrated in a gem-grade outcome, so card quality needs to be exceptional."
    };
  }

  return {
    recommendation: "Probably not worth grading",
    rationale: "The projected PSA 9 and PSA 10 outcomes do not create enough dependable spread over the current CardAtlas value."
  };
}

function mergeRecommendation(
  raw: number,
  psa9: number,
  psa10: number,
  gradingReason: string | null,
  aiRecommendation: string | null
): RecommendationDecision {
  const formulaDecision = decideFormulaRecommendation(raw, psa9, psa10);
  const aiDecision = normalizeRecommendation(aiRecommendation);

  let finalRecommendation = formulaDecision.recommendation;
  if (aiDecision) {
    if (formulaDecision.recommendation === "Only if condition is strong") {
      finalRecommendation = aiDecision;
    } else if (
      formulaDecision.recommendation === "Worth Grading" &&
      aiDecision === "Probably not worth grading"
    ) {
      finalRecommendation = "Only if condition is strong";
    } else if (
      formulaDecision.recommendation === "Probably not worth grading" &&
      aiDecision === "Worth Grading"
    ) {
      finalRecommendation = "Only if condition is strong";
    }
  }

  const rationale = gradingReason?.trim()
    ? `${gradingReason.trim()} ${formulaDecision.rationale}`
    : formulaDecision.rationale;

  return {
    recommendation: finalRecommendation,
    rationale
  };
}

function toScenario(
  cardId: UUID,
  assumedGrade: "Raw" | "9" | "10",
  estimatedValue: number,
  source: GradingScenarioSource,
  metadata?: Record<string, unknown> | null
): CardGradingScenario {
  return {
    cardId,
    gradingCompany: "PSA",
    assumedGrade,
    estimatedValue: round2(estimatedValue),
    source,
    metadata: metadata ?? null
  };
}

async function tryPersistScenarios(cardId: UUID, scenarios: CardGradingScenario[]) {
  const supabase = await getRequiredSupabaseClient();
  const payload = scenarios.map((scenario) => ({
    card_id: cardId,
    grading_company: scenario.gradingCompany,
    assumed_grade: scenario.assumedGrade,
    estimated_value: scenario.estimatedValue,
    source: scenario.source,
    metadata: scenario.metadata ?? null,
    updated_at: new Date().toISOString()
  }));

  const { error: deleteError } = await supabase
    .from("card_grading_scenarios")
    .delete()
    .eq("card_id", cardId)
    .eq("grading_company", "PSA")
    .in("assumed_grade", ["Raw", "9", "10"]);

  if (deleteError) return;
  const { error: insertError } = await supabase.from("card_grading_scenarios").insert(payload);
  if (insertError) return;
}

async function readGradingPayload(cardId: UUID, sourceScanId?: UUID | null): Promise<GradingPayload | null> {
  const supabase = await getRequiredSupabaseClient();

  if (sourceScanId) {
    const { data, error } = await supabase
      .from("scans")
      .select("identified_payload")
      .eq("id", sourceScanId)
      .maybeSingle();
    if (!error && data?.identified_payload) {
      return data.identified_payload as GradingPayload;
    }
  }

  const { data, error } = await supabase
    .from("scans")
    .select("identified_payload")
    .eq("card_id", cardId)
    .not("identified_payload", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.identified_payload) return null;
  return data.identified_payload as GradingPayload;
}

function summarizeSegmentAverage(prices: number[]): number | null {
  return avg(prices.map((value) => round2(value)).filter((value) => value > 0));
}

function toOutlook(input: {
  cardId: UUID;
  rawReferenceValue: number;
  psa9Multiplier: MultiplierResolution;
  psa10Multiplier: MultiplierResolution;
  psa9AverageAsk: number | null;
  psa10AverageAsk: number | null;
  gradingReason: string | null;
  gradingRecommendation: string | null;
  gradingConfidence: "high" | "medium" | "low" | null;
}): GradingOutlook {
  const rawScenario = toScenario(input.cardId, "Raw", input.rawReferenceValue, "raw_reference", {
    rawReferenceValue: round2(input.rawReferenceValue)
  });

  const psa9Computed = computeOutcome(input.rawReferenceValue, input.psa9Multiplier.value, input.psa9AverageAsk);
  const psa10Computed = computeOutcome(input.rawReferenceValue, input.psa10Multiplier.value, input.psa10AverageAsk);

  const psa9Source: GradingScenarioSource = psa9Computed.usedActiveAverage
    ? "market_adjusted"
    : input.psa9Multiplier.source === "gpt"
      ? "gpt_multiplier"
      : "heuristic_estimate";
  const psa10Source: GradingScenarioSource = psa10Computed.usedActiveAverage
    ? "market_adjusted"
    : input.psa10Multiplier.source === "gpt"
      ? "gpt_multiplier"
      : "heuristic_estimate";

  const psa9Scenario = toScenario(input.cardId, "9", psa9Computed.outcomeValue, psa9Source, {
    rawReferenceValue: round2(input.rawReferenceValue),
    multiplier: input.psa9Multiplier.value,
    multiplierSource: input.psa9Multiplier.source,
    multiplierWasClamped: input.psa9Multiplier.wasClamped,
    activeAverageAsk: input.psa9AverageAsk ? round2(input.psa9AverageAsk) : null,
    baseValue: psa9Computed.baseValue,
    usedMarketAverage: psa9Computed.usedActiveAverage
  });
  const psa10Scenario = toScenario(input.cardId, "10", psa10Computed.outcomeValue, psa10Source, {
    rawReferenceValue: round2(input.rawReferenceValue),
    multiplier: input.psa10Multiplier.value,
    multiplierSource: input.psa10Multiplier.source,
    multiplierWasClamped: input.psa10Multiplier.wasClamped,
    activeAverageAsk: input.psa10AverageAsk ? round2(input.psa10AverageAsk) : null,
    baseValue: psa10Computed.baseValue,
    usedMarketAverage: psa10Computed.usedActiveAverage
  });

  const decision = mergeRecommendation(
    input.rawReferenceValue,
    psa9Computed.outcomeValue,
    psa10Computed.outcomeValue,
    input.gradingReason,
    input.gradingRecommendation
  );

  const nonRawSources = new Set([psa9Source, psa10Source]);
  const source =
    nonRawSources.size > 1
      ? "mixed"
      : (nonRawSources.values().next().value as GradingOutlook["source"]) || "heuristic_estimate";

  return {
    cardId: input.cardId,
    recommendation: decision.recommendation,
    rationale: decision.rationale,
    rawValue: round2(input.rawReferenceValue),
    rawReferenceValue: round2(input.rawReferenceValue),
    psa9Value: psa9Computed.outcomeValue,
    psa10Value: psa10Computed.outcomeValue,
    psa9Multiplier: input.psa9Multiplier.value,
    psa10Multiplier: input.psa10Multiplier.value,
    psa9AverageAsk: input.psa9AverageAsk ? round2(input.psa9AverageAsk) : null,
    psa10AverageAsk: input.psa10AverageAsk ? round2(input.psa10AverageAsk) : null,
    gradingOutcomePsa9: psa9Computed.outcomeValue,
    gradingOutcomePsa10: psa10Computed.outcomeValue,
    gradingReason: input.gradingReason,
    gradingRecommendation: input.gradingRecommendation,
    gradingConfidence: input.gradingConfidence,
    potentialUpside: round2(Math.max(0, psa10Computed.outcomeValue - input.rawReferenceValue)),
    source,
    scenarios: [rawScenario, psa9Scenario, psa10Scenario]
  };
}

export interface GradingOutlookService {
  getGradingOutlook(cardId: UUID, options?: { rawValue?: number; sourceScanId?: UUID | null }): Promise<GradingOutlook>;
}

class GradingOutlookServiceImpl implements GradingOutlookService {
  async getGradingOutlook(cardId: UUID, options?: { rawValue?: number; sourceScanId?: UUID | null }): Promise<GradingOutlook> {
    const supabase = await getRequiredSupabaseClient();

    const valuationRes = await supabase
      .from("valuation_snapshots")
      .select("reference_value")
      .eq("card_id", cardId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseRaw = Number(options?.rawValue ?? valuationRes.data?.reference_value ?? 0);
    const rawReferenceValue = Number.isFinite(baseRaw) && baseRaw > 0 ? baseRaw : 0;

    const debugTrace: ActiveMarketDebugTrace | undefined =
      cardId === DEBUG_CARD_ID
        ? {
            requestId: `amg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            enabled: true,
            inspectRejected: true,
            requestOrigin: "grading"
          }
        : undefined;

    const gradingPayloadPromise = readGradingPayload(cardId, options?.sourceScanId);
    const activeMarketPromise = activeListingsService
      .getDisplayActiveListings(cardId, {
        referenceValue: rawReferenceValue,
        maxItems: ACTIVE_MARKET_WINDOW,
        debugTrace
      })
      .catch((error) => {
        debugLog("active_market_unavailable", {
          requestId: debugTrace?.requestId,
          cardId,
          reason: error instanceof Error ? error.message : "active_market_unavailable"
        });
        return null;
      });

    const [gradingPayload, activeMarket] = await Promise.all([gradingPayloadPromise, activeMarketPromise]);

    const psa9AverageAsk = summarizeSegmentAverage((activeMarket?.filteredSegments.psa9 ?? []).map((listing) => listing.price));
    const psa10AverageAsk = summarizeSegmentAverage((activeMarket?.filteredSegments.psa10 ?? []).map((listing) => listing.price));

    const psa9Multiplier = resolveMultiplier(gradingPayload?.psa9Multiplier, PSA9_HEURISTIC_MULTIPLIER);
    const psa10Multiplier = resolveMultiplier(gradingPayload?.psa10Multiplier, PSA10_HEURISTIC_MULTIPLIER);

    const outlook = toOutlook({
      cardId,
      rawReferenceValue,
      psa9Multiplier,
      psa10Multiplier,
      psa9AverageAsk,
      psa10AverageAsk,
      gradingReason: gradingPayload?.gradingReason?.trim() || null,
      gradingRecommendation: gradingPayload?.gradingRecommendation?.trim() || null,
      gradingConfidence: gradingPayload?.gradingConfidence ?? null
    });

    await tryPersistScenarios(cardId, outlook.scenarios);
    return outlook;
  }
}

export const gradingOutlookService: GradingOutlookService = new GradingOutlookServiceImpl();
