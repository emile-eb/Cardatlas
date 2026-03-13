import type { UUID } from "@/types/db";

export type GradingRecommendation =
  | "Worth Grading"
  | "Only if condition is strong"
  | "Probably not worth grading";

export type GradingScenarioSource = "raw_reference" | "comp_derived" | "heuristic_estimate";

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
  psa9Value: number;
  psa10Value: number;
  potentialUpside: number;
  source: "comp_derived" | "heuristic_estimate" | "mixed";
  scenarios: CardGradingScenario[];
}

