import type { StructuredCardIdentification } from "./types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function asRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid structured output: ${fieldName} must be a non-empty string.`);
  }
  return value.trim();
}

function asNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid structured output: ${fieldName} must be numeric.`);
  }
  return num;
}

function asOptionalYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const year = Number(value);
  if (!Number.isInteger(year)) {
    throw new Error("Invalid structured output: year must be an integer or null.");
  }
  return year;
}

function asOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error("Invalid structured output: optional numeric field must be numeric or null.");
  }
  return num;
}

function normalizeGradeScore(value: unknown): number | null {
  const num = asOptionalNumber(value);
  if (num == null) return null;
  const clamped = Math.min(10, Math.max(0, num));
  return Number(clamped.toFixed(2));
}

function asOptionalConfidence(value: unknown): "high" | "medium" | "low" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return null;
}

export function parseStructuredIdentification(payload: unknown): StructuredCardIdentification {
  if (!isObject(payload)) {
    throw new Error("Invalid structured output: payload must be an object.");
  }

  const playerInfoRaw = payload.playerInfo;
  if (!isObject(playerInfoRaw)) {
    throw new Error("Invalid structured output: playerInfo must be an object.");
  }

  const confidence = asNumber(payload.confidence, "confidence");
  if (confidence < 0 || confidence > 1) {
    throw new Error("Invalid structured output: confidence must be between 0 and 1.");
  }

  const parsed = {
    sport: asRequiredString(payload.sport, "sport"),
    playerName: asRequiredString(payload.playerName, "playerName"),
    cardTitle: asRequiredString(payload.cardTitle, "cardTitle"),
    year: asOptionalYear(payload.year),
    brand: asNullableString(payload.brand),
    setName: asNullableString(payload.setName),
    cardNumber: asNullableString(payload.cardNumber),
    team: asNullableString(payload.team),
    position: asNullableString(payload.position),
    rarityLabel: asNullableString(payload.rarityLabel),
    conditionEstimate: asRequiredString(payload.conditionEstimate, "conditionEstimate"),
    gradeScore: normalizeGradeScore(payload.gradeScore),
    gradeScoreReason: asNullableString(payload.gradeScoreReason),
    confidence,
    description: asRequiredString(payload.description, "description"),
    playerInfo: {
      era: asRequiredString(playerInfoRaw.era, "playerInfo.era"),
      careerNote: asRequiredString(playerInfoRaw.careerNote, "playerInfo.careerNote")
    },
    referenceValue: asNumber(payload.referenceValue, "referenceValue"),
    gradedUpside: asOptionalNumber(payload.gradedUpside),
    psa10Multiplier: asOptionalNumber(payload.psa10Multiplier),
    psa9Multiplier: asOptionalNumber(payload.psa9Multiplier),
    gradingReason: asNullableString(payload.gradingReason),
    gradingRecommendation: asNullableString(payload.gradingRecommendation),
    gradingConfidence: asOptionalConfidence(payload.gradingConfidence),
    valueSource: asRequiredString(payload.valueSource, "valueSource"),
    reviewNeeded: Boolean(payload.reviewNeeded),
    reviewReason: asNullableString(payload.reviewReason)
  };

  console.log(
    "[grade_score][structured_output]",
    JSON.stringify({
      playerName: parsed.playerName,
      cardTitle: parsed.cardTitle,
      rawGradeScore: payload.gradeScore ?? null,
      parsedGradeScore: parsed.gradeScore,
      gradeScoreReason: parsed.gradeScoreReason ?? null
    })
  );

  return parsed;
}
