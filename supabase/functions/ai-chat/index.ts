// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { handleAiChat } from "./_shared/chatService.ts";
import type { ChatRequestBody } from "./_shared/types.ts";

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
    return json({ ok: false, error: { code: "UNKNOWN", message: "Method not allowed" } }, { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return json({ ok: false, error: { code: "UNKNOWN", message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY." } }, { status: 500 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return json({ ok: false, error: { code: "UNKNOWN", message: "Missing bearer token." } }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ ok: false, error: { code: "UNKNOWN", message: "Unauthorized" } }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as ChatRequestBody | null;
    if (!body || typeof body !== "object") {
      return json({ ok: false, error: { code: "UNKNOWN", message: "Invalid request body." } }, { status: 400 });
    }

    const response = await handleAiChat({
      authUserId: userData.user.id,
      body
    });

    // Return structured failures as 200 so supabase-js invoke surfaces payload instead of transport error.
    return json(response, { status: 200 });
  } catch (error) {
    return json(
      {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: error instanceof Error ? error.message : "Unexpected server error"
        }
      },
      { status: 500 }
    );
  }
});
