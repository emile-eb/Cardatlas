export function normalizeGradeScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  const clamped = Math.min(10, Math.max(0, next));
  return Number(clamped.toFixed(2));
}

export function formatGradeScore(value: number | null | undefined): string {
  const normalized = normalizeGradeScore(value);
  return normalized == null ? "-" : normalized.toFixed(2);
}
