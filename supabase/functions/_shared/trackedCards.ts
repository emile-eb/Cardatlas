// @ts-nocheck
import { getTrackerCadenceUpdate } from "./trackedCardCadence.ts";

export function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function nowIso() {
  return new Date().toISOString();
}

async function getTrackedCardsColumns(service: any): Promise<Set<string>> {
  const { data, error } = await service.from("tracked_cards").select("*").limit(1);
  if (error) throw error;
  const sample = Array.isArray(data) ? data[0] : null;
  return new Set(Object.keys(sample ?? {}));
}

function assignIfPresent(columns: Set<string>, payload: Record<string, unknown>, key: string, value: unknown) {
  if (columns.has(key)) {
    payload[key] = value;
  }
}

type EnsureTrackedCardResult = {
  cardId: string;
  action: "created" | "already_tracked" | "reactivated";
};

export async function getUserIdByAuth(service: any, authUserId: string): Promise<string> {
  const { data, error } = await service.from("users").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("User not found for auth identity.");
  return data.id;
}

export async function userCanAccessCard(service: any, userId: string, cardId: string): Promise<boolean> {
  const [scanRes, collectionRes] = await Promise.all([
    service.from("scans").select("id").eq("user_id", userId).eq("card_id", cardId).limit(1),
    service.from("collection_items").select("id").eq("user_id", userId).eq("card_id", cardId).limit(1)
  ]);

  if (scanRes.error) throw scanRes.error;
  if (collectionRes.error) throw collectionRes.error;

  return (scanRes.data?.length ?? 0) > 0 || (collectionRes.data?.length ?? 0) > 0;
}

export async function ensureTrackedCard(service: any, cardId: string, trackingSource = "scan_auto"): Promise<EnsureTrackedCardResult> {
  const normalizedCardId = clean(cardId);
  if (!normalizedCardId) throw new Error("Missing card id for tracking.");

  const trackedCardColumns = await getTrackedCardsColumns(service);

  const { data: existing, error: existingError } = await service.from("tracked_cards").select("*").eq("card_id", normalizedCardId).maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const patch: Record<string, unknown> = {};
    let action: EnsureTrackedCardResult["action"] = "already_tracked";

    if ("is_active" in existing && existing.is_active === false) {
      patch.is_active = true;
      action = "reactivated";
    }

    if ("tracking_status" in existing && clean(existing.tracking_status).toLowerCase() !== "active") {
      patch.tracking_status = "active";
      action = "reactivated";
    }

    if ("updated_at" in existing) {
      patch.updated_at = nowIso();
    }

    if (action === "reactivated") {
      const cadence = getTrackerCadenceUpdate(existing, { kind: "reactivated" });
      if ("next_refresh_at" in existing) {
        patch.next_refresh_at = cadence.nextRefreshAt;
      }
      if ("cadence_reason" in existing) {
        patch.cadence_reason = cadence.cadenceReason;
      }
    }

    if (Object.keys(patch).length) {
      const { error: updateError } = await service.from("tracked_cards").update(patch).eq("id", existing.id);
      if (updateError) throw updateError;
    }

    return { cardId: normalizedCardId, action };
  }

  const insertPayload: Record<string, unknown> = {
    card_id: normalizedCardId
  };

  const now = nowIso();
  const cadence = getTrackerCadenceUpdate(null, { kind: "created", now });
  assignIfPresent(trackedCardColumns, insertPayload, "tracking_source", trackingSource);
  assignIfPresent(trackedCardColumns, insertPayload, "tracking_status", "active");
  assignIfPresent(trackedCardColumns, insertPayload, "is_active", true);
  assignIfPresent(trackedCardColumns, insertPayload, "first_tracked_at", now);
  assignIfPresent(trackedCardColumns, insertPayload, "next_refresh_at", cadence.nextRefreshAt);
  assignIfPresent(trackedCardColumns, insertPayload, "cadence_reason", cadence.cadenceReason);

  const { error: insertError } = await service.from("tracked_cards").upsert(insertPayload, {
    onConflict: "card_id",
    ignoreDuplicates: true
  });
  if (insertError) throw insertError;

  return { cardId: normalizedCardId, action: "created" };
}
