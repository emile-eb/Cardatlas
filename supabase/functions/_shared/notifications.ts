// @ts-nocheck
export function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function nowIso() {
  return new Date().toISOString();
}

export function resolveNotificationsAdminToken() {
  return clean(Deno.env.get("NOTIFICATIONS_ADMIN_TOKEN")) || clean(Deno.env.get("TRACKING_ADMIN_TOKEN"));
}

export function ensureNotificationsAdmin(req: Request) {
  const expectedToken = resolveNotificationsAdminToken();
  if (!expectedToken) {
    throw new Error("Missing NOTIFICATIONS_ADMIN_TOKEN.");
  }

  const providedToken = clean(req.headers.get("x-admin-token"));
  return Boolean(providedToken && providedToken === expectedToken);
}

export async function reserveNotificationEvent(
  service: any,
  input: {
    userId: string;
    cardId?: string | null;
    notificationType: string;
    dedupeKey: string;
    payloadJson?: Record<string, unknown> | null;
  }
) {
  const { data, error } = await service
    .from("notification_events")
    .insert({
      user_id: input.userId,
      card_id: input.cardId ?? null,
      notification_type: input.notificationType,
      dedupe_key: input.dedupeKey,
      payload_json: input.payloadJson ?? null,
      status: "queued"
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return null;
    }
    throw error;
  }

  return data?.id ?? null;
}

export async function updateNotificationEvent(
  service: any,
  eventId: string,
  patch: { status: string; sentAt?: string | null; payloadJson?: Record<string, unknown> | null }
) {
  const payload: Record<string, unknown> = {
    status: patch.status,
    updated_at: nowIso()
  };
  if (Object.prototype.hasOwnProperty.call(patch, "sentAt")) {
    payload.sent_at = patch.sentAt ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "payloadJson")) {
    payload.payload_json = patch.payloadJson ?? null;
  }

  const { error } = await service.from("notification_events").update(payload).eq("id", eventId);
  if (error) throw error;
}

export async function markPushTokenInvalid(service: any, deviceRowId: string, reason: string) {
  const { error } = await service
    .from("user_devices")
    .update({
      push_token_status: "invalid",
      last_error_text: reason,
      updated_at: nowIso()
    })
    .eq("id", deviceRowId);

  if (error) throw error;
}

export async function markPushTokenHealthy(service: any, deviceRowId: string) {
  const { error } = await service
    .from("user_devices")
    .update({
      push_token_status: "active",
      last_error_text: null,
      updated_at: nowIso()
    })
    .eq("id", deviceRowId);

  if (error) throw error;
}

export async function sendExpoPushNotification(input: {
  expoPushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      to: input.expoPushToken,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      sound: null
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Expo push request failed (${response.status}).`);
  }

  const result = Array.isArray(payload?.data) ? payload.data[0] : payload?.data ?? null;
  return result ?? null;
}

export async function deliverNotificationToDevices(
  service: any,
  input: {
    eventId: string;
    devices: Array<{ id: string; expo_push_token: string }>;
    title: string;
    body: string;
    data: Record<string, unknown>;
    payloadJson?: Record<string, unknown> | null;
  }
) {
  let sentCount = 0;
  const failures: string[] = [];

  for (const device of input.devices) {
    try {
      const result = await sendExpoPushNotification({
        expoPushToken: device.expo_push_token,
        title: input.title,
        body: input.body,
        data: input.data
      });

      const status = clean(result?.status).toLowerCase();
      if (status && status !== "ok") {
        const reason = clean(result?.details?.error) || clean(result?.message) || "expo_push_failed";
        failures.push(reason);
        if (reason === "DeviceNotRegistered") {
          await markPushTokenInvalid(service, device.id, reason);
        }
        continue;
      }

      await markPushTokenHealthy(service, device.id);
      sentCount += 1;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  await updateNotificationEvent(service, input.eventId, {
    status: sentCount > 0 ? "sent" : "failed",
    sentAt: sentCount > 0 ? nowIso() : null,
    payloadJson: {
      ...(input.payloadJson ?? {}),
      delivery: {
        sentCount,
        failures
      }
    }
  });

  return {
    sentCount,
    failures
  };
}
