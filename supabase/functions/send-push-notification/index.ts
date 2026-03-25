// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import {
  clean,
  deliverNotificationToDevices,
  ensureNotificationsAdmin,
  reserveNotificationEvent
} from "../_shared/notifications.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const isAuthorized = ensureNotificationsAdmin(req);
    if (!isAuthorized) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Missing required Supabase server environment variables." }, { status: 500 });
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = clean(String(body?.userId ?? ""));
    const title = clean(String(body?.title ?? ""));
    const message = clean(String(body?.body ?? ""));
    if (!userId || !title || !message) {
      return json({ ok: false, error: "userId, title, and body are required." }, { status: 400 });
    }

    const { data: devices, error: deviceError } = await service
      .from("user_devices")
      .select("id,expo_push_token")
      .eq("user_id", userId)
      .eq("notifications_enabled", true)
      .eq("permission_status", "granted")
      .eq("push_token_status", "active")
      .not("expo_push_token", "is", null);
    if (deviceError) throw deviceError;
    if (!(devices?.length ?? 0)) {
      return json({ ok: true, sentCount: 0, reason: "no_active_devices" });
    }

    const notificationType = clean(String(body?.notificationType ?? "manual_push"));
    const cardId = clean(String(body?.cardId ?? "")) || null;
    const dedupeKey = clean(String(body?.dedupeKey ?? "")) || `${notificationType}:${userId}:${Date.now()}`;
    const payloadJson = {
      title,
      body: message,
      data: typeof body?.data === "object" && body?.data ? body.data : {}
    };

    const eventId = await reserveNotificationEvent(service, {
      userId,
      cardId,
      notificationType,
      dedupeKey,
      payloadJson
    });
    if (!eventId) {
      return json({ ok: true, sentCount: 0, reason: "deduped" });
    }

    const result = await deliverNotificationToDevices(service, {
      eventId,
      devices: (devices ?? []).map((device: any) => ({ id: device.id, expo_push_token: device.expo_push_token })),
      title,
      body: message,
      data: typeof body?.data === "object" && body?.data ? (body.data as Record<string, unknown>) : {},
      payloadJson
    });

    return json({
      ok: true,
      sentCount: result.sentCount,
      failures: result.failures
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
});
