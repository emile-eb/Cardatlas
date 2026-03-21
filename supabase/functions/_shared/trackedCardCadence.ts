// @ts-nocheck
import { clean, nowIso } from "./trackedCards.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function addMs(iso: string, ms: number) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function parseIso(value: unknown): string | null {
  const text = clean(typeof value === "string" ? value : "");
  if (!text) return null;
  const time = Date.parse(text);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function hoursBetween(from: string | null, to: string) {
  if (!from) return null;
  return (Date.parse(to) - Date.parse(from)) / HOUR;
}

function isWarmupTracker(tracker: any, now: string) {
  const firstTrackedAt = parseIso(tracker?.first_tracked_at) ?? parseIso(tracker?.created_at);
  const ageHours = hoursBetween(firstTrackedAt, now);
  return ageHours != null && ageHours <= 7 * 24;
}

function previousFailureCountHint(tracker: any) {
  const status = clean(tracker?.last_refresh_status).toLowerCase();
  if (status !== "failed") return 0;
  const lastRefreshedAt = parseIso(tracker?.last_refreshed_at);
  if (!lastRefreshedAt) return 1;
  const ageHours = hoursBetween(lastRefreshedAt, nowIso());
  if (ageHours != null && ageHours < 12) return 2;
  return 1;
}

export function getTrackerCadenceUpdate(
  tracker: any,
  input:
    | { kind: "created"; now?: string }
    | { kind: "reactivated"; now?: string }
    | { kind: "refresh_success"; now?: string }
    | { kind: "refresh_failed"; now?: string }
) {
  const now = input.now ?? nowIso();

  if (input.kind === "created") {
    return {
      nextRefreshAt: now,
      cadenceReason: "initial_tracking"
    };
  }

  if (input.kind === "reactivated") {
    return {
      nextRefreshAt: now,
      cadenceReason: "reactivated_tracker"
    };
  }

  if (input.kind === "refresh_success") {
    if (isWarmupTracker(tracker, now)) {
      return {
        nextRefreshAt: addMs(now, 12 * HOUR),
        cadenceReason: "warmup_recently_tracked"
      };
    }

    return {
      nextRefreshAt: addMs(now, DAY),
      cadenceReason: "success_standard"
    };
  }

  const failureHint = previousFailureCountHint(tracker);
  if (failureHint >= 2) {
    return {
      nextRefreshAt: addMs(now, 12 * HOUR),
      cadenceReason: "retry_after_repeated_failure"
    };
  }

  return {
    nextRefreshAt: addMs(now, 6 * HOUR),
    cadenceReason: "retry_after_failure"
  };
}
