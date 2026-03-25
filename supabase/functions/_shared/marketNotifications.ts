// @ts-nocheck
import {
  clean,
  deliverNotificationToDevices,
  nowIso,
  reserveNotificationEvent
} from "./notifications.ts";

function hasUsableLiveMarket(snapshot: any) {
  const listingCount = Number(snapshot?.listing_count_raw ?? 0);
  const averageAsk = Number(snapshot?.raw_avg_ask ?? 0);
  return listingCount >= 3 && averageAsk >= 20;
}

function buildCardLabel(card: any) {
  return [card?.year ? String(card.year) : "", card?.brand ?? "", card?.card_title ?? card?.cardTitle ?? "", card?.card_number ? `#${card.card_number}` : "", card?.player_name ?? card?.playerName ?? ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysBucket(timestamp: string, days: number) {
  const ms = Math.floor(Date.parse(timestamp) / (1000 * 60 * 60 * 24 * days));
  return String(ms);
}

async function loadPreviousSnapshot(service: any, cardId: string, snapshotAt: string) {
  const { data, error } = await service
    .from("card_price_history_snapshots")
    .select("id,snapshot_date,raw_avg_ask,listing_count_raw")
    .eq("card_id", cardId)
    .lt("snapshot_date", snapshotAt)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

async function loadNotificationAudience(service: any, cardId: string) {
  const [{ data: cardRow, error: cardError }, { data: collectionRows, error: collectionError }, { data: scanRows, error: scanError }] =
    await Promise.all([
      service.from("cards").select("id,player_name,card_title,year,brand,card_number").eq("id", cardId).maybeSingle(),
      service.from("collection_items").select("id,user_id,created_at").eq("card_id", cardId),
      service
        .from("scans")
        .select("id,user_id,scanned_at")
        .or(`card_id.eq.${cardId},corrected_card_id.eq.${cardId}`)
        .in("status", ["completed", "needs_review"])
    ]);

  if (cardError) throw cardError;
  if (collectionError) throw collectionError;
  if (scanError) throw scanError;

  const audience = new Map<string, { userId: string; collectionItemId?: string; scanId?: string }>();
  for (const row of collectionRows ?? []) {
    const existing = audience.get(row.user_id) ?? { userId: row.user_id };
    if (!existing.collectionItemId) existing.collectionItemId = row.id;
    audience.set(row.user_id, existing);
  }
  for (const row of scanRows ?? []) {
    const existing = audience.get(row.user_id) ?? { userId: row.user_id };
    if (!existing.scanId) existing.scanId = row.id;
    audience.set(row.user_id, existing);
  }

  return {
    card: cardRow ?? null,
    audience: Array.from(audience.values())
  };
}

async function loadActiveDevices(service: any, userIds: string[]) {
  if (!userIds.length) return [];

  const { data, error } = await service
    .from("user_devices")
    .select("id,user_id,expo_push_token,notifications_enabled,market_activity_enabled,collection_updates_enabled,permission_status,push_token_status")
    .in("user_id", userIds)
    .eq("notifications_enabled", true)
    .eq("permission_status", "granted")
    .eq("push_token_status", "active")
    .not("expo_push_token", "is", null);

  if (error) throw error;
  return data ?? [];
}

export async function evaluateMarketNotificationsForSnapshot(
  service: any,
  params: {
    cardId: string;
    snapshotAt: string;
    latestSnapshot: {
      raw_avg_ask: number | null;
      listing_count_raw: number | null;
    };
  }
) {
  const previousSnapshot = await loadPreviousSnapshot(service, params.cardId, params.snapshotAt);
  if (!previousSnapshot) {
    return { sentCount: 0, evaluatedUsers: 0, reason: "missing_previous_snapshot" };
  }

  const previousUsable = hasUsableLiveMarket(previousSnapshot);
  const currentUsable = hasUsableLiveMarket(params.latestSnapshot);
  const previousAsk = Number(previousSnapshot.raw_avg_ask ?? 0);
  const currentAsk = Number(params.latestSnapshot.raw_avg_ask ?? 0);
  const absoluteDelta = Math.abs(currentAsk - previousAsk);
  const percentDelta = previousAsk > 0 ? absoluteDelta / previousAsk : 0;
  const direction = currentAsk >= previousAsk ? "up" : "down";

  const qualifiesNewMarket = !previousUsable && currentUsable;
  const qualifiesMarketMove =
    previousUsable &&
    currentUsable &&
    previousAsk > 0 &&
    currentAsk > 0 &&
    absoluteDelta >= 25 &&
    percentDelta >= 0.15;

  if (!qualifiesNewMarket && !qualifiesMarketMove) {
    return { sentCount: 0, evaluatedUsers: 0, reason: "threshold_not_met" };
  }

  const { card, audience } = await loadNotificationAudience(service, params.cardId);
  if (!audience.length) {
    return { sentCount: 0, evaluatedUsers: 0, reason: "no_audience" };
  }

  const cardLabel = buildCardLabel(card) || "This card";
  const devices = await loadActiveDevices(
    service,
    audience.map((entry) => entry.userId)
  );
  const devicesByUser = new Map<string, any[]>();
  for (const device of devices) {
    const list = devicesByUser.get(device.user_id) ?? [];
    list.push(device);
    devicesByUser.set(device.user_id, list);
  }

  let sentCount = 0;
  for (const target of audience) {
    const userDevices = devicesByUser.get(target.userId) ?? [];
    if (!userDevices.length) continue;

    const isCollectionTarget = Boolean(target.collectionItemId);
    const categoryEnabled = qualifiesNewMarket
      ? isCollectionTarget
        ? userDevices.some((device) => Boolean(device.collection_updates_enabled))
        : userDevices.some((device) => Boolean(device.market_activity_enabled))
      : userDevices.some((device) => Boolean(device.market_activity_enabled));
    if (!categoryEnabled) continue;

    const eventType = qualifiesNewMarket
      ? isCollectionTarget
        ? "collection_new_market"
        : "new_market"
      : "market_move";
    const bucket = qualifiesNewMarket ? "market_open" : `${direction}:${daysBucket(params.snapshotAt, 3)}`;
    const dedupeKey = `${eventType}:${target.userId}:${params.cardId}:${bucket}`;

    const routeData = isCollectionTarget
      ? {
          route: "collection_card",
          collectionItemId: target.collectionItemId
        }
      : target.scanId
        ? {
            route: "result",
            scanId: target.scanId
          }
        : {
            route: "home"
          };

    const title = qualifiesNewMarket
      ? isCollectionTarget
        ? "Live market now available"
        : "New live market activity"
      : `${card?.player_name ?? "Card"} market move`;
    const body = qualifiesNewMarket
      ? `CardAtlas is now seeing usable live market for ${cardLabel}.`
      : `Live asks are ${direction} ${Math.round(percentDelta * 100)}% to about $${currentAsk.toFixed(0)} for ${cardLabel}.`;

    const payloadJson = {
      title,
      body,
      routeData,
      category: qualifiesNewMarket && isCollectionTarget ? "collection_updates" : "market_activity",
      cardId: params.cardId,
      previousAsk,
      currentAsk,
      snapshotAt: params.snapshotAt
    };

    const eventId = await reserveNotificationEvent(service, {
      userId: target.userId,
      cardId: params.cardId,
      notificationType: eventType,
      dedupeKey,
      payloadJson
    });
    if (!eventId) continue;

    const eligibleDevices = userDevices.filter((device) =>
      qualifiesNewMarket && isCollectionTarget ? Boolean(device.collection_updates_enabled) : Boolean(device.market_activity_enabled)
    );
    if (!eligibleDevices.length) continue;

    const result = await deliverNotificationToDevices(service, {
      eventId,
      devices: eligibleDevices.map((device) => ({ id: device.id, expo_push_token: device.expo_push_token })),
      title,
      body,
      data: {
        ...routeData,
        type: eventType,
        category: qualifiesNewMarket && isCollectionTarget ? "collection_updates" : "market_activity",
        cardId: params.cardId,
        source: "tracked_card_refresh"
      },
      payloadJson
    });
    sentCount += result.sentCount;
  }

  return {
    sentCount,
    evaluatedUsers: audience.length,
    reason: qualifiesNewMarket ? "new_market" : "market_move"
  };
}

export async function runReminderNotifications(service: any, now = nowIso()) {
  const { data: devices, error } = await service
    .from("user_devices")
    .select("id,user_id,expo_push_token,notifications_enabled,reminders_enabled,permission_status,push_token_status")
    .eq("notifications_enabled", true)
    .eq("reminders_enabled", true)
    .eq("permission_status", "granted")
    .eq("push_token_status", "active")
    .not("expo_push_token", "is", null);

  if (error) throw error;

  const devicesByUser = new Map<string, any[]>();
  for (const device of devices ?? []) {
    const list = devicesByUser.get(device.user_id) ?? [];
    list.push(device);
    devicesByUser.set(device.user_id, list);
  }

  let sentCount = 0;
  for (const [userId, userDevices] of devicesByUser.entries()) {
    const [{ data: scanRows, error: scanError }, { data: collectionRows, error: collectionError }, { data: recentReminder, error: reminderError }] =
      await Promise.all([
        service.from("scans").select("id,scanned_at").eq("user_id", userId).order("scanned_at", { ascending: false }).limit(25),
        service.from("collection_items").select("id").eq("user_id", userId),
        service
          .from("notification_events")
          .select("created_at")
          .eq("user_id", userId)
          .eq("notification_type", "scan_reminder")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

    if (scanError) throw scanError;
    if (collectionError) throw collectionError;
    if (reminderError) throw reminderError;

    const latestScanAt = clean(scanRows?.[0]?.scanned_at) || null;
    if (!latestScanAt) continue;

    const daysSinceLastScan = (Date.parse(now) - Date.parse(latestScanAt)) / (1000 * 60 * 60 * 24);
    const daysSinceLastReminder = recentReminder?.created_at
      ? (Date.parse(now) - Date.parse(recentReminder.created_at)) / (1000 * 60 * 60 * 24)
      : Number.POSITIVE_INFINITY;
    if (daysSinceLastReminder < 7) continue;

    const collectionCount = collectionRows?.length ?? 0;
    let body = "";
    if (collectionCount <= 5 && daysSinceLastScan >= 10) {
      body = "You have cards worth adding. Scan another card to keep building your collection.";
    } else if (daysSinceLastScan >= 21) {
      body = "It has been a while since your last scan. Open CardAtlas when you are ready to add another card.";
    }

    if (!body) continue;

    const dedupeKey = `scan_reminder:${userId}:${daysBucket(now, 7)}`;
    const payloadJson = {
      title: "Keep your collection moving",
      body,
      route: "scan_tab",
      userId
    };

    const eventId = await reserveNotificationEvent(service, {
      userId,
      notificationType: "scan_reminder",
      dedupeKey,
      payloadJson
    });
    if (!eventId) continue;

    const result = await deliverNotificationToDevices(service, {
      eventId,
      devices: userDevices.map((device) => ({ id: device.id, expo_push_token: device.expo_push_token })),
      title: "Keep your collection moving",
      body,
      data: {
        route: "scan_tab",
        type: "scan_reminder",
        category: "reminders",
        source: "reminder_job"
      },
      payloadJson
    });
    sentCount += result.sentCount;
  }

  return { sentCount };
}
