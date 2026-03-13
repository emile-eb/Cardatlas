export interface AttributeValuationInput {
  baseReferenceValue: number;
  isAutograph?: boolean;
  isMemorabilia?: boolean;
  isParallel?: boolean;
  parallelName?: string | null;
  serialNumber?: string | null;
  isGraded?: boolean;
  grade?: string | null;
}

export interface AttributeValuationResult {
  adjustedValue: number;
  totalMultiplier: number;
}

const MAX_TOTAL_MULTIPLIER = 12;

function parseSerialDenominator(serial?: string | null): number | null {
  if (!serial) return null;
  const value = serial.trim();
  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  const denominator = Number(match[2]);
  return Number.isFinite(denominator) && denominator > 0 ? denominator : null;
}

function serialMultiplier(serial?: string | null): number {
  if (!serial?.trim()) return 1;
  const denominator = parseSerialDenominator(serial);
  if (!denominator) return 1.3;
  if (denominator === 1) return 10.0;
  if (denominator <= 5) return 6.0;
  if (denominator <= 10) return 4.0;
  if (denominator <= 25) return 2.5;
  if (denominator <= 50) return 2.0;
  if (denominator <= 99) return 1.6;
  if (denominator <= 199) return 1.4;
  return 1.2;
}

function gradedMultiplier(isGraded?: boolean, grade?: string | null): number {
  if (!isGraded) return 1;
  const value = Number((grade ?? "").trim());
  if (!Number.isFinite(value)) return 1.2;
  if (value >= 10) return 5.0;
  if (value >= 9.5) return 3.5;
  if (value >= 9) return 2.5;
  if (value >= 8) return 1.8;
  if (value >= 7) return 1.4;
  if (value >= 6) return 1.2;
  return 1.0;
}

function parallelMultiplier(isParallel?: boolean, parallelName?: string | null): number {
  if (!isParallel) return 1;
  const name = (parallelName ?? "").toLowerCase();
  if (!name.trim()) return 1.3;
  if (name.includes("gold") || name.includes("black") || name.includes("superfractor") || name.includes("1/1")) return 1.6;
  if (name.includes("red") || name.includes("orange")) return 1.45;
  if (name.includes("blue") || name.includes("green") || name.includes("silver")) return 1.35;
  return 1.3;
}

export function calculateAttributeAdjustedValue(input: AttributeValuationInput): AttributeValuationResult {
  const base = Number(input.baseReferenceValue ?? 0);
  if (!Number.isFinite(base) || base <= 0) {
    return { adjustedValue: 0, totalMultiplier: 1 };
  }

  const multipliers = [
    input.isAutograph ? 2.2 : 1,
    input.isMemorabilia ? 1.5 : 1,
    parallelMultiplier(input.isParallel, input.parallelName),
    serialMultiplier(input.serialNumber),
    gradedMultiplier(input.isGraded, input.grade)
  ];

  const rawMultiplier = multipliers.reduce((acc, value) => acc * value, 1);
  const totalMultiplier = Math.min(rawMultiplier, MAX_TOTAL_MULTIPLIER);
  const adjustedValue = Number((base * totalMultiplier).toFixed(2));

  return {
    adjustedValue,
    totalMultiplier: Number(totalMultiplier.toFixed(4))
  };
}
