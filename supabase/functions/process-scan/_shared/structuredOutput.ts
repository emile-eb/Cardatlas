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

  return {
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
    confidence,
    description: asRequiredString(payload.description, "description"),
    playerInfo: {
      era: asRequiredString(playerInfoRaw.era, "playerInfo.era"),
      careerNote: asRequiredString(playerInfoRaw.careerNote, "playerInfo.careerNote")
    },
    referenceValue: asNumber(payload.referenceValue, "referenceValue"),
    gradedUpside: asOptionalNumber(payload.gradedUpside),
    valueSource: asRequiredString(payload.valueSource, "valueSource"),
    reviewNeeded: Boolean(payload.reviewNeeded),
    reviewReason: asNullableString(payload.reviewReason)
  };
}
