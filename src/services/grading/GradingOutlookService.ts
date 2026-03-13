import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { CardGradingScenario, GradingOutlook, GradingRecommendation, GradingScenarioSource, UUID } from "@/types";

const PSA9_HEURISTIC_MULTIPLIER = 2.0;
const PSA10_HEURISTIC_MULTIPLIER = 4.5;

function inferGrade(value?: string | null): "9" | "10" | null {
  const v = (value ?? "").toUpperCase();
  if (!v) return null;
  if (v.includes("10") || v.includes("GEM")) return "10";
  if (v.includes("9")) return "9";
  return null;
}

function inferGradeFromSaleRow(row: any): "9" | "10" | null {
  const fromGrade = inferGrade(row?.grade ?? null);
  if (fromGrade) return fromGrade;
  return inferGrade(row?.title ?? null);
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function decideRecommendation(raw: number, psa9: number, psa10: number): { recommendation: GradingRecommendation; rationale: string } {
  const nineUpside = psa9 - raw;
  const tenUpside = psa10 - raw;
  const nineRatio = raw > 0 ? psa9 / raw : 1;
  const tenRatio = raw > 0 ? psa10 / raw : 1;

  if (nineRatio >= 1.6 && tenRatio >= 2.8 && tenUpside >= 150) {
    return {
      recommendation: "Worth Grading",
      rationale: "PSA 9 already shows meaningful upside, and PSA 10 materially improves value further."
    };
  }

  if (tenRatio >= 2.5 && nineRatio < 1.6) {
    return {
      recommendation: "Only if condition is strong",
      rationale: "Most of the upside is concentrated in a gem-grade outcome, so condition quality is critical."
    };
  }

  return {
    recommendation: "Probably not worth grading",
    rationale: "The projected PSA 9 and PSA 10 scenarios do not show enough practical upside relative to raw value."
  };
}

function toScenario(cardId: UUID, assumedGrade: "Raw" | "9" | "10", estimatedValue: number, source: GradingScenarioSource): CardGradingScenario {
  return {
    cardId,
    gradingCompany: "PSA",
    assumedGrade,
    estimatedValue: round2(estimatedValue),
    source,
    metadata: null
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
  await supabase.from("card_grading_scenarios").insert(payload);
}

async function readStoredScenarios(cardId: UUID): Promise<CardGradingScenario[] | null> {
  const supabase = await getRequiredSupabaseClient();
  const { data, error } = await supabase
    .from("card_grading_scenarios")
    .select("id,card_id,grading_company,assumed_grade,estimated_value,source,metadata,created_at,updated_at")
    .eq("card_id", cardId)
    .eq("grading_company", "PSA")
    .in("assumed_grade", ["Raw", "9", "10"]);

  if (error || !data?.length) return null;
  return data.map((row: any) => ({
    id: row.id,
    cardId: row.card_id,
    gradingCompany: row.grading_company,
    assumedGrade: row.assumed_grade,
    estimatedValue: Number(row.estimated_value ?? 0),
    source: row.source ?? "heuristic_estimate",
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

function toOutlook(cardId: UUID, scenarios: CardGradingScenario[]): GradingOutlook {
  const raw = scenarios.find((s) => s.assumedGrade === "Raw")?.estimatedValue ?? 0;
  const nine = scenarios.find((s) => s.assumedGrade === "9")?.estimatedValue ?? raw;
  const ten = scenarios.find((s) => s.assumedGrade === "10")?.estimatedValue ?? raw;

  const recommendation = decideRecommendation(raw, nine, ten);
  const sources = new Set(scenarios.map((s) => String(s.source)));
  const source = sources.size > 1 ? "mixed" : (sources.values().next().value as GradingOutlook["source"]) || "heuristic_estimate";

  return {
    cardId,
    recommendation: recommendation.recommendation,
    rationale: recommendation.rationale,
    rawValue: round2(raw),
    psa9Value: round2(nine),
    psa10Value: round2(ten),
    potentialUpside: round2(Math.max(0, ten - raw)),
    source,
    scenarios
  };
}

export interface GradingOutlookService {
  getGradingOutlook(cardId: UUID, rawValue?: number): Promise<GradingOutlook>;
}

class GradingOutlookServiceImpl implements GradingOutlookService {
  async getGradingOutlook(cardId: UUID, rawValue?: number): Promise<GradingOutlook> {
    const stored = await readStoredScenarios(cardId);
    if (stored?.length === 3) {
      return toOutlook(cardId, stored);
    }

    const supabase = await getRequiredSupabaseClient();

    const [valuationRes, salesRes] = await Promise.all([
      supabase
        .from("valuation_snapshots")
        .select("reference_value")
        .eq("card_id", cardId)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("card_sales")
        .select("price,grade,title,source")
        .eq("card_id", cardId)
        .order("sale_date", { ascending: false })
        .limit(40)
    ]);

    const baseRaw = Number(rawValue ?? valuationRes.data?.reference_value ?? 0);
    const safeRaw = Number.isFinite(baseRaw) && baseRaw > 0 ? baseRaw : 0;

    const sales = salesRes.data ?? [];
    const psa9Comps = sales.filter((row: any) => inferGradeFromSaleRow(row) === "9").map((row: any) => Number(row.price ?? 0)).filter((v: number) => v > 0);
    const psa10Comps = sales.filter((row: any) => inferGradeFromSaleRow(row) === "10").map((row: any) => Number(row.price ?? 0)).filter((v: number) => v > 0);

    const psa9CompAvg = avg(psa9Comps);
    const psa10CompAvg = avg(psa10Comps);

    const rawScenario = toScenario(cardId, "Raw", safeRaw, "raw_reference");
    const psa9Scenario = toScenario(
      cardId,
      "9",
      psa9CompAvg ?? safeRaw * PSA9_HEURISTIC_MULTIPLIER,
      psa9CompAvg ? "comp_derived" : "heuristic_estimate"
    );
    const psa10Scenario = toScenario(
      cardId,
      "10",
      psa10CompAvg ?? safeRaw * PSA10_HEURISTIC_MULTIPLIER,
      psa10CompAvg ? "comp_derived" : "heuristic_estimate"
    );

    const scenarios = [rawScenario, psa9Scenario, psa10Scenario];
    await tryPersistScenarios(cardId, scenarios);

    return toOutlook(cardId, scenarios);
  }
}

export const gradingOutlookService: GradingOutlookService = new GradingOutlookServiceImpl();
