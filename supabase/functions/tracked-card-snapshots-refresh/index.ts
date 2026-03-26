// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { clean, fetchSegmentedActiveMarketSnapshot, loadCardIdentity, loadLatestReferenceValue } from "../_shared/activeMarketSnapshot.ts";
import { evaluateMarketNotificationsForSnapshot } from "../_shared/marketNotifications.ts";
import {
  loadTrackedCardPool,
  normalizePoolLimit,
  normalizeSelectionLimit,
  selectTrackedCardsForRefresh
} from "../_shared/trackedCardRefreshSelector.ts";
import { getTrackerCadenceUpdate } from "../_shared/trackedCardCadence.ts";
import { completeRefreshRunLog, createRefreshRunLog, findActiveRefreshRun } from "../_shared/trackingRefreshRunLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init?.headers ?? {})
    }
  });
}

function shouldDebugLog(): boolean {
  return (Deno.env.get("TRACKING_DEBUG") ?? "").toLowerCase() === "true" || !Deno.env.get("DENO_DEPLOYMENT_ID");
}

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!shouldDebugLog()) return;
  console.log(`[tracked-card-snapshots-refresh] ${label}`, payload);
}

function resolveInvocationSource(req: Request, body: Record<string, unknown>) {
  const explicit = clean(String(body?.invocationSource ?? ""));
  if (explicit) return explicit;
  return req.headers.get("x-scheduled-trigger") === "true" ? "scheduled" : "manual";
}

function resolveEnvironment(body: Record<string, unknown>) {
  return clean(String(body?.environment ?? Deno.env.get("APP_ENVIRONMENT") ?? Deno.env.get("ENVIRONMENT") ?? "")) || "unknown";
}

function startOfUtcDay(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(value?: string | null) {
  const start = startOfUtcDay(value);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function snapshotInsertPayload(cardId: string, snapshotAt: string, referenceValue: number | null, marketSummary: any) {
  return {
    card_id: cardId,
    snapshot_date: snapshotAt,
    reference_value: referenceValue,
    raw_avg_ask: marketSummary.raw_avg_ask,
    psa9_avg_ask: marketSummary.psa9_avg_ask,
    psa10_avg_ask: marketSummary.psa10_avg_ask,
    listing_count_raw: marketSummary.listing_count_raw,
    listing_count_psa9: marketSummary.listing_count_psa9,
    listing_count_psa10: marketSummary.listing_count_psa10
  };
}

async function ensureAdmin(req: Request) {
  const expectedToken = clean(Deno.env.get("TRACKING_ADMIN_TOKEN"));
  if (!expectedToken) {
    throw new Error("Missing TRACKING_ADMIN_TOKEN.");
  }

  const providedToken = clean(req.headers.get("x-admin-token"));
  if (!providedToken || providedToken !== expectedToken) {
    return false;
  }

  return true;
}

async function hasSnapshotForDay(service: any, cardId: string, snapshotAt: string) {
  const start = startOfUtcDay(snapshotAt).toISOString();
  const end = endOfUtcDay(snapshotAt).toISOString();
  const { data, error } = await service
    .from("card_price_history_snapshots")
    .select("id")
    .eq("card_id", cardId)
    .gte("snapshot_date", start)
    .lt("snapshot_date", end)
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function updateTrackerMetadata(service: any, tracker: any, patch: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key in tracker) payload[key] = value;
  }
  if (!Object.keys(payload).length) return;
  const { error } = await service.from("tracked_cards").update(payload).eq("id", tracker.id);
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  let service: any = null;
  let runId: string | null = null;

  try {
    const isAuthorized = await ensureAdmin(req);
    if (!isAuthorized) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Missing required Supabase server environment variables." }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const limit = normalizeSelectionLimit(body?.limit);
    const force = Boolean(body?.force);
    const dryRun = Boolean(body?.dryRun);
    const cardId = clean(body?.cardId) || null;
    const snapshotAt = clean(body?.snapshotAt) || new Date().toISOString();
    const poolLimit = cardId ? 1 : normalizePoolLimit(body?.poolLimit, limit);
    const invocationSource = resolveInvocationSource(req, body);
    const environment = resolveEnvironment(body);

    service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const overlapWindowMinutes = Number(Deno.env.get("TRACKING_REFRESH_OVERLAP_WINDOW_MINUTES") ?? 120);
    const activeRun = await findActiveRefreshRun(service, Number.isFinite(overlapWindowMinutes) ? overlapWindowMinutes : 120);
    if (activeRun && !cardId && !dryRun && !force) {
      const overlapSummary = {
        ok: true,
        status: "skipped_overlap",
        activeRun
      };
      try {
        runId = await createRefreshRunLog(service, {
          invocationSource,
          environment,
          requestedLimit: limit,
          effectiveLimit: 0,
          poolLimit,
          dryRun,
          forceRefresh: force,
          cardId,
          notes: "Skipped because another refresh run is already active."
        });
        await completeRefreshRunLog(service, runId, {
          status: "skipped_overlap",
          notes: "Skipped because another refresh run is already active.",
          summaryJson: overlapSummary
        });
      } catch (_logError) {
        // Best-effort observability only.
      }
      return json(overlapSummary, { status: 409 });
    }

    runId = await createRefreshRunLog(service, {
      invocationSource,
      environment,
      requestedLimit: limit,
      effectiveLimit: limit,
      poolLimit,
      dryRun,
      forceRefresh: force,
      cardId
    });

    const trackedCardPool = await loadTrackedCardPool(service, { cardId, poolLimit });
    const selection = selectTrackedCardsForRefresh(trackedCardPool, { snapshotAt, limit, force });
    const trackedCards = selection.selected.map((row) => row.tracker);
    debugLog("refresh_started", {
      totalTracked: trackedCardPool.length,
      selectedCount: trackedCards.length,
      force,
      dryRun,
      cardId,
      invocationSource,
      environment,
      limit,
      poolLimit
    });

    const summary = {
      ok: true,
      totalTrackedCardsConsidered: trackedCardPool.length,
      totalEligibleCards: force ? trackedCardPool.length : selection.evaluated.filter((row) => row.eligible).length,
      selectedCount: trackedCards.length,
      callBudget: limit,
      poolLimit,
      insertedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      dryRun,
      sampleFailures: [] as Array<Record<string, unknown>>,
      sampleSkipped: [] as Array<Record<string, unknown>>,
      sampleInserted: [] as Array<Record<string, unknown>>,
      sampleSelected: selection.selected.slice(0, 10).map((row) => ({
        trackerId: row.tracker.id,
        cardId: row.tracker.card_id ?? null,
        priorityScore: row.priorityScore,
        selectionReason: row.selectionReason,
        dueStatus: row.dueStatus,
        lastRefreshedAt: row.lastRefreshedAt,
        nextRefreshAt: row.nextRefreshAt,
        lastRefreshStatus: row.lastRefreshStatus
      })),
      invocationSource,
      environment,
      startedAt: snapshotAt
    };

    for (const scoredTracker of selection.selected) {
      const tracker = scoredTracker.tracker;
      try {
        const cardKey = clean(tracker.card_id);
        if (!cardKey) {
          summary.failedCount += 1;
          summary.sampleFailures.push({ trackerId: tracker.id, cardId: null, reason: "missing_card_id" });
          continue;
        }

        if (!force) {
          const alreadySnapshotted = await hasSnapshotForDay(service, cardKey, snapshotAt);
          if (alreadySnapshotted) {
            summary.skippedCount += 1;
            if (summary.sampleSkipped.length < 10) {
              summary.sampleSkipped.push({
                trackerId: tracker.id,
                cardId: cardKey,
                reason: "snapshot_already_exists_for_day",
                selectionReason: scoredTracker.selectionReason,
                dueStatus: scoredTracker.dueStatus
              });
            }
            continue;
          }
        }

        const identity = await loadCardIdentity(service, cardKey);
        const latestReference = await loadLatestReferenceValue(service, cardKey);
        const market = await fetchSegmentedActiveMarketSnapshot(identity, {
          limit: 12,
          referenceValue: latestReference.referenceValue
        });

        const payload = snapshotInsertPayload(cardKey, snapshotAt, latestReference.referenceValue, market.marketSummary);

        if (!dryRun) {
          const { error: insertError } = await service.from("card_price_history_snapshots").insert(payload);
          if (insertError) throw insertError;

          const cadence = getTrackerCadenceUpdate(tracker, { kind: "refresh_success", now: snapshotAt });
          await updateTrackerMetadata(service, tracker, {
            last_refreshed_at: snapshotAt,
            last_refresh_status: "success",
            next_refresh_at: cadence.nextRefreshAt,
            cadence_reason: cadence.cadenceReason
          });

          try {
            await evaluateMarketNotificationsForSnapshot(service, {
              cardId: cardKey,
              snapshotAt,
              latestSnapshot: {
                raw_avg_ask: payload.raw_avg_ask,
                listing_count_raw: payload.listing_count_raw
              }
            });
          } catch (notificationError) {
            debugLog("notification_evaluation_failed", {
              cardId: cardKey,
              reason: notificationError instanceof Error ? notificationError.message : String(notificationError)
            });
          }
        }

        summary.insertedCount += 1;
        if (summary.sampleInserted.length < 10) {
          summary.sampleInserted.push({
            trackerId: tracker.id,
            cardId: cardKey,
            priorityScore: scoredTracker.priorityScore,
            selectionReason: scoredTracker.selectionReason,
            dueStatus: scoredTracker.dueStatus,
            referenceValue: latestReference.referenceValue,
            rawAvgAsk: market.marketSummary.raw_avg_ask,
            psa9AvgAsk: market.marketSummary.psa9_avg_ask,
            psa10AvgAsk: market.marketSummary.psa10_avg_ask,
            listingCountRaw: market.marketSummary.listing_count_raw,
            listingCountPsa9: market.marketSummary.listing_count_psa9,
            listingCountPsa10: market.marketSummary.listing_count_psa10
          });
        }
      } catch (error) {
        summary.failedCount += 1;
        if (!dryRun) {
          try {
            const cadence = getTrackerCadenceUpdate(tracker, { kind: "refresh_failed", now: snapshotAt });
            await updateTrackerMetadata(service, tracker, {
              last_refreshed_at: snapshotAt,
              last_refresh_status: "failed",
              next_refresh_at: cadence.nextRefreshAt,
              cadence_reason: cadence.cadenceReason
            });
          } catch (_trackerUpdateError) {
            // Best-effort tracker failure metadata.
          }
        }

        if (summary.sampleFailures.length < 10) {
          summary.sampleFailures.push({
            trackerId: tracker.id,
            cardId: tracker.card_id ?? null,
            selectionReason: scoredTracker.selectionReason,
            dueStatus: scoredTracker.dueStatus,
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    debugLog("refresh_completed", {
      totalTracked: summary.totalTrackedCardsConsidered,
      selectedCount: summary.selectedCount,
      inserted: summary.insertedCount,
      skipped: summary.skippedCount,
      failed: summary.failedCount
    });

    await completeRefreshRunLog(service, runId, {
      status: "completed",
      candidateCount: summary.totalTrackedCardsConsidered,
      eligibleCount: summary.totalEligibleCards,
      selectedCount: summary.selectedCount,
      successCount: summary.insertedCount,
      failureCount: summary.failedCount,
      skippedCount: summary.skippedCount,
      summaryJson: summary
    });

    return json(summary, { status: 200 });
  } catch (error) {
    debugLog("refresh_failed", { reason: error instanceof Error ? error.message : String(error) });
    if (service && runId) {
      try {
        await completeRefreshRunLog(service, runId, {
          status: "failed",
          errorText: error instanceof Error ? error.message : String(error),
          notes: "Refresh run failed before completion."
        });
      } catch (_runLogError) {
        // Best-effort observability only.
      }
    }
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
