// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { processScan } from "./_shared/scanProcessingService.ts";

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
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY." }, { status: 500 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return json({ error: "Missing bearer token." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as { scanId?: string; retry?: boolean } | null;
    if (!body?.scanId || typeof body.scanId !== "string") {
      return json({ error: "scanId is required." }, { status: 400 });
    }

    const response = await processScan({
      scanId: body.scanId,
      retry: Boolean(body.retry),
      authUserId: userData.user.id
    });

    return json(response, { status: 200 });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unexpected server error"
      },
      { status: 500 }
    );
  }
});
