// @ts-nocheck
import { clean } from "./trackedCards.ts";

function nowIso() {
  return new Date().toISOString();
}

function prunePayload(payload: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

export async function findActiveRefreshRun(service: any, windowMinutes = 120) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data, error } = await service
    .from("tracking_refresh_runs")
    .select("id,started_at,status,invocation_source,environment,requested_limit,effective_limit")
    .eq("status", "running")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function createRefreshRunLog(service: any, input: {
  invocationSource: string;
  environment?: string | null;
  requestedLimit?: number | null;
  effectiveLimit?: number | null;
  poolLimit?: number | null;
  dryRun?: boolean;
  forceRefresh?: boolean;
  cardId?: string | null;
  notes?: string | null;
}) {
  const payload = prunePayload({
    started_at: nowIso(),
    status: "running",
    invocation_source: clean(input.invocationSource) || "manual",
    environment: clean(input.environment ?? "") || null,
    requested_limit: input.requestedLimit ?? null,
    effective_limit: input.effectiveLimit ?? null,
    pool_limit: input.poolLimit ?? null,
    dry_run: Boolean(input.dryRun),
    force_refresh: Boolean(input.forceRefresh),
    card_id: clean(input.cardId ?? "") || null,
    notes: clean(input.notes ?? "") || null
  });

  const { data, error } = await service.from("tracking_refresh_runs").insert(payload).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function completeRefreshRunLog(service: any, runId: string, input: {
  status: "completed" | "failed" | "skipped_overlap";
  candidateCount?: number | null;
  eligibleCount?: number | null;
  selectedCount?: number | null;
  successCount?: number | null;
  failureCount?: number | null;
  skippedCount?: number | null;
  errorText?: string | null;
  notes?: string | null;
  summaryJson?: Record<string, unknown> | null;
}) {
  const payload = prunePayload({
    completed_at: nowIso(),
    updated_at: nowIso(),
    status: input.status,
    candidate_count: input.candidateCount ?? null,
    eligible_count: input.eligibleCount ?? null,
    selected_count: input.selectedCount ?? null,
    success_count: input.successCount ?? null,
    failure_count: input.failureCount ?? null,
    skipped_count: input.skippedCount ?? null,
    error_text: clean(input.errorText ?? "") || null,
    notes: clean(input.notes ?? "") || null,
    summary_json: input.summaryJson ?? null
  });

  const { error } = await service.from("tracking_refresh_runs").update(payload).eq("id", runId);
  if (error) throw error;
}
