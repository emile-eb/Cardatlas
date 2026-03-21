// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
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

function missingEnvResponse(variableName: string) {
  console.error("[ebay-account-deletion] missing_env", { variableName });
  return json(
    {
      ok: false,
      error: `Missing required environment variable: ${variableName}`
    },
    { status: 500 }
  );
}

async function sha256Hex(input: string) {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safePayloadPreview(payload: unknown) {
  try {
    const raw = JSON.stringify(payload);
    if (!raw) return null;
    return raw.length > 2000 ? `${raw.slice(0, 2000)}...` : raw;
  } catch {
    return "[unserializable payload]";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const challengeCode = url.searchParams.get("challenge_code");

    console.log("[ebay-account-deletion] challenge_received", {
      hasChallengeCode: Boolean(challengeCode)
    });

    if (!challengeCode) {
      return json({ ok: false, error: "Missing challenge_code query parameter." }, { status: 400 });
    }

    const verificationToken = Deno.env.get("EBAY_VERIFICATION_TOKEN");
    if (!verificationToken) {
      return missingEnvResponse("EBAY_VERIFICATION_TOKEN");
    }

    const endpoint = Deno.env.get("EBAY_ENDPOINT_URL");
    if (!endpoint) {
      return missingEnvResponse("EBAY_ENDPOINT_URL");
    }

    const challengeResponse = await sha256Hex(`${challengeCode}${verificationToken}${endpoint}`);
    return json({ challengeResponse }, { status: 200 });
  }

  if (req.method === "POST") {
    console.log("[ebay-account-deletion] notification_received");

    const payload = await req.json().catch(() => null);
    console.log("[ebay-account-deletion] notification_payload", {
      preview: safePayloadPreview(payload)
    });

    return json(
      {
        ok: true,
        received: true
      },
      { status: 200 }
    );
  }

  return json({ ok: false, error: "Method not allowed" }, { status: 405 });
});
