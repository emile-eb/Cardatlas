// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { clean, nowIso } from "../_shared/notifications.ts";
import { getUserIdByAuth } from "../_shared/trackedCards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, error: "Missing required Supabase server environment variables." }, { status: 500 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return json({ ok: false, error: "Missing bearer token." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const userId = await getUserIdByAuth(service, userData.user.id);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const deviceId = clean(String(body?.deviceId ?? ""));
    if (!deviceId) {
      return json({ ok: false, error: "deviceId is required." }, { status: 400 });
    }

    const expoPushToken = clean(String(body?.expoPushToken ?? "")) || null;
    const permissionStatus = clean(String(body?.permissionStatus ?? "undetermined")) || "undetermined";
    const notificationsEnabled = Boolean(body?.notificationsEnabled);
    const marketActivityEnabled = Boolean(body?.marketActivityEnabled);
    const collectionUpdatesEnabled = Boolean(body?.collectionUpdatesEnabled);
    const remindersEnabled = Boolean(body?.remindersEnabled);
    const now = nowIso();

    const payload = {
      user_id: userId,
      device_id: deviceId,
      platform: clean(String(body?.platform ?? "web")) || "web",
      device_name: clean(String(body?.deviceName ?? "")) || null,
      app_version: clean(String(body?.appVersion ?? "")) || null,
      expo_push_token: expoPushToken,
      notifications_enabled: notificationsEnabled,
      market_activity_enabled: marketActivityEnabled,
      collection_updates_enabled: collectionUpdatesEnabled,
      reminders_enabled: remindersEnabled,
      permission_status: permissionStatus,
      push_token_status: expoPushToken ? "active" : "missing",
      push_token_registered_at: expoPushToken ? now : null,
      last_error_text: null,
      last_seen_at: now,
      updated_at: now
    };

    const { data: deviceRow, error: deviceError } = await service
      .from("user_devices")
      .upsert(payload, { onConflict: "user_id,device_id" })
      .select("id,expo_push_token,notifications_enabled,permission_status")
      .single();
    if (deviceError) throw deviceError;

    const { error: userUpdateError } = await service
      .from("users")
      .update({
        notifications_enabled: notificationsEnabled,
        updated_at: now
      })
      .eq("id", userId);
    if (userUpdateError) throw userUpdateError;

    return json({
      ok: true,
      userId,
      deviceId,
      expoPushToken: deviceRow?.expo_push_token ?? null,
      notificationsEnabled: deviceRow?.notifications_enabled ?? notificationsEnabled,
      permissionStatus: deviceRow?.permission_status ?? permissionStatus
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
