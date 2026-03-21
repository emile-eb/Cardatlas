import type { UUID } from "@/types/db";

export type GradingRecommendation =
  | "Worth Grading"
  | "Only if condition is strong"
  | "Probably not worth grading";

export type GradingScenarioSource =
  | "raw_reference"
  | "comp_derived"
  | "heuristic_estimate"
  | "gpt_multiplier"
  | "market_adjusted";

export interface CardGradingScenario {
  id?: UUID;
  cardId: UUID;
  gradingCompany: "PSA" | string;
  assumedGrade: "Raw" | "9" | "10" | string;
  estimatedValue: number;
  source: GradingScenarioSource | string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GradingOutlook {
  cardId: UUID;
  recommendation: GradingRecommendation;
  rationale: string;
  rawValue: number;
  rawReferenceValue: number;
  psa9Value: number;
  psa10Value: number;
  psa9Multiplier: number;
  psa10Multiplier: number;
  psa9AverageAsk: number | null;
  psa10AverageAsk: number | null;
  gradingOutcomePsa9: number;
  gradingOutcomePsa10: number;
  gradingReason: string | null;
  gradingRecommendation: string | null;
  gradingConfidence: "high" | "medium" | "low" | null;
  potentialUpside: number;
  source: "comp_derived" | "heuristic_estimate" | "gpt_multiplier" | "market_adjusted" | "mixed";
  scenarios: CardGradingScenario[];
}
