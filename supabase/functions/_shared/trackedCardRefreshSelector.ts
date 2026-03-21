// @ts-nocheck
import { clean } from "./trackedCards.ts";

const DEFAULT_POOL_LIMIT = 200;
const MAX_POOL_LIMIT = 500;
const STALE_HOURS = 24;

function toIso(value: unknown): string | null {
  const text = clean(typeof value === "string" ? value : "");
  if (!text) return null;
  const time = Date.parse(text);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function hoursSince(value: string | null, snapshotAt: string) {
  if (!value) return null;
  return (Date.parse(snapshotAt) - Date.parse(value)) / (1000 * 60 * 60);
}

function sameUtcDay(left: string | null, right: string) {
  if (!left) return false;
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getUTCFullYear() === rightDate.getUTCFullYear() &&
    leftDate.getUTCMonth() === rightDate.getUTCMonth() &&
    leftDate.getUTCDate() === rightDate.getUTCDate()
  );
}

function isTrackerActive(row: any) {
  if ("is_active" in row && row.is_active === false) return false;
  if ("tracking_status" in row && clean(row.tracking_status).toLowerCase() && clean(row.tracking_status).toLowerCase() !== "active") {
    return false;
  }
  return Boolean(row.card_id);
}

function deriveDueStatus(row: any, snapshotAt: string) {
  const lastRefreshedAt = toIso(row.last_refreshed_at);
  const nextRefreshAt = toIso(row.next_refresh_at);

  if (!lastRefreshedAt) return "never_refreshed";
  if (sameUtcDay(lastRefreshedAt, snapshotAt)) return "refreshed_today";
  if (nextRefreshAt && Date.parse(nextRefreshAt) <= Date.parse(snapshotAt)) return "overdue";
  if (nextRefreshAt && Date.parse(nextRefreshAt) > Date.parse(snapshotAt)) return "scheduled_future";

  const ageHours = hoursSince(lastRefreshedAt, snapshotAt);
  if (ageHours != null && ageHours >= STALE_HOURS) return "stale";
  return "recent";
}

function scoreTracker(row: any, snapshotAt: string) {
  const firstTrackedAt = toIso(row.first_tracked_at) ?? toIso(row.created_at);
  const lastRefreshedAt = toIso(row.last_refreshed_at);
  const nextRefreshAt = toIso(row.next_refresh_at);
  const dueStatus = deriveDueStatus(row, snapshotAt);
  const lastRefreshStatus = clean(row.last_refresh_status).toLowerCase() || null;
  const ageHours = hoursSince(lastRefreshedAt, snapshotAt);
  const firstTrackedAgeHours = hoursSince(firstTrackedAt, snapshotAt);

  let priorityScore = 0;
  let selectionReason = "recent_tracker";
  let eligible = true;

  switch (dueStatus) {
    case "never_refreshed":
      priorityScore += 1000;
      selectionReason = "never_refreshed_priority";
      break;
    case "overdue":
      priorityScore += 850;
      selectionReason = "next_refresh_overdue";
      break;
    case "stale":
      priorityScore += 650;
      selectionReason = "stale_last_refreshed";
      break;
    case "scheduled_future":
      priorityScore += 120;
      selectionReason = "scheduled_for_future";
      eligible = false;
      break;
    case "recent":
      priorityScore += 220;
      selectionReason = "recently_refreshed";
      eligible = false;
      break;
    case "refreshed_today":
      priorityScore -= 500;
      selectionReason = "already_refreshed_today";
      eligible = false;
      break;
  }

  if (firstTrackedAgeHours != null && firstTrackedAgeHours <= 24) {
    priorityScore += 120;
    if (dueStatus === "never_refreshed") {
      selectionReason = "newly_tracked_never_refreshed";
    }
  }

  if (ageHours != null && ageHours > 24) {
    priorityScore += Math.min(Math.floor(ageHours), 240);
  }

  if (lastRefreshStatus === "failed") {
    priorityScore += 90;
    if (dueStatus !== "refreshed_today") {
      eligible = true;
      selectionReason = dueStatus === "never_refreshed" ? selectionReason : "retry_after_failed_refresh";
    }
  }

  return {
    tracker: row,
    eligible,
    priorityScore,
    selectionReason,
    dueStatus,
    lastRefreshedAt,
    nextRefreshAt,
    firstTrackedAt,
    lastRefreshStatus
  };
}

export function normalizeSelectionLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(Math.max(Math.round(parsed), 1), 100);
}

export function normalizePoolLimit(value: unknown, selectionLimit: number) {
  const fallback = Math.min(Math.max(selectionLimit * 4, DEFAULT_POOL_LIMIT), MAX_POOL_LIMIT);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(Math.round(parsed), selectionLimit), MAX_POOL_LIMIT);
}

export async function loadTrackedCardPool(service: any, params: { cardId?: string | null; poolLimit: number }) {
  let query = service.from("tracked_cards").select("*").order("created_at", { ascending: true }).limit(params.poolLimit);
  if (params.cardId) query = query.eq("card_id", params.cardId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).filter(isTrackerActive);
}

export function selectTrackedCardsForRefresh(rows: any[], params: { snapshotAt: string; limit: number; force?: boolean }) {
  const evaluated = rows.map((row) => scoreTracker(row, params.snapshotAt));
  const eligible = params.force ? evaluated : evaluated.filter((row) => row.eligible);

  const selected = eligible
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
      const leftNext = left.nextRefreshAt ?? "9999-12-31T00:00:00.000Z";
      const rightNext = right.nextRefreshAt ?? "9999-12-31T00:00:00.000Z";
      if (leftNext !== rightNext) return leftNext.localeCompare(rightNext);
      const leftFirst = left.firstTrackedAt ?? left.tracker.created_at ?? "";
      const rightFirst = right.firstTrackedAt ?? right.tracker.created_at ?? "";
      if (leftFirst !== rightFirst) return leftFirst.localeCompare(rightFirst);
      return clean(left.tracker.card_id).localeCompare(clean(right.tracker.card_id));
    })
    .slice(0, params.limit);

  return {
    evaluated,
    selected
  };
}
