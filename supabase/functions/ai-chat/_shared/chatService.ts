// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { buildPromptPackage } from "./promptBuilder.ts";
import { createChatProvider } from "./providers.ts";
import type {
  ChatContextBundle,
  ChatFailure,
  ChatHistoryItem,
  ChatRequestBody,
  ChatResponse,
  ChatSuccess,
  ThreadType
} from "./types.ts";

const AI_PREMIUM_MESSAGE_LIMIT = Number(Deno.env.get("AI_PREMIUM_MESSAGE_LIMIT") ?? 40);
const MAX_MESSAGE_LENGTH = Number(Deno.env.get("AI_MAX_MESSAGE_LENGTH") ?? 1200);
const DUPLICATE_WINDOW_SECONDS = Number(Deno.env.get("AI_DUPLICATE_WINDOW_SECONDS") ?? 20);
const RAPID_WINDOW_SECONDS = Number(Deno.env.get("AI_RAPID_WINDOW_SECONDS") ?? 2);
const MAX_CONTEXT_MESSAGES = Number(Deno.env.get("AI_CONTEXT_MESSAGE_COUNT") ?? 6);
const AI_BYPASS_PREMIUM = Deno.env.get("AI_BYPASS_PREMIUM") === "true";

function nowIso() {
  return new Date().toISOString();
}

function makeFailure(failure: ChatFailure["error"]): ChatFailure {
  return { ok: false, error: failure };
}

function normalizeMessage(message: string) {
  return message.trim().replace(/\s+/g, " ");
}

function secondsBetween(aIso: string, bIso: string) {
  return Math.abs((Date.parse(aIso) - Date.parse(bIso)) / 1000);
}

function gradingRecommendation(raw: number, psa9: number, psa10: number) {
  const nineRatio = raw > 0 ? psa9 / raw : 1;
  const tenRatio = raw > 0 ? psa10 / raw : 1;
  const tenUpside = psa10 - raw;

  if (nineRatio >= 1.6 && tenRatio >= 2.8 && tenUpside >= 150) {
    return {
      label: "Worth Grading" as const,
      rationale: "PSA 9 shows meaningful upside and PSA 10 materially increases value."
    };
  }
  if (tenRatio >= 2.5 && nineRatio < 1.6) {
    return {
      label: "Only if condition is strong" as const,
      rationale: "Most upside depends on a gem-grade outcome."
    };
  }
  return {
    label: "Probably not worth grading" as const,
    rationale: "Projected grading scenarios do not create enough practical upside."
  };
}

function buildDemoRecentSales(cardId: string, referenceValue: number | null, currency: string | null) {
  const base = Number(referenceValue ?? 0);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 120;
  const rows: Array<{
    source: string;
    price: number;
    currency: string;
    saleDate: string;
    condition: string | null;
    grade: string | null;
  }> = [];

  for (let i = 0; i < 4; i += 1) {
    const noise = (((cardId.charCodeAt(i % cardId.length) || 17) * (i + 3)) % 15 - 7) / 100;
    rows.push({
      source: "demo_market",
      price: Number((safeBase * (1 + noise)).toFixed(2)),
      currency: currency ?? "USD",
      saleDate: new Date(Date.now() - (i + 1) * 86400000 * (i + 1)).toISOString(),
      condition: i % 2 === 0 ? "Near Mint" : "Ungraded",
      grade: null
    });
  }
  return rows;
}

async function getUserIdByAuthUser(service: any, authUserId: string): Promise<string> {
  const { data, error } = await service
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("User not found for auth identity.");
  return data.id;
}

async function isPremiumUser(service: any, userId: string): Promise<boolean> {
  if (AI_BYPASS_PREMIUM) return true;
  const { data, error } = await service
    .from("subscriptions")
    .select("entitlement_status,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  const entitlementStatus = data?.entitlement_status;
  if (entitlementStatus === "active") return true;

  // Legacy fallback for older rows
  const legacyStatus = data?.status;
  return legacyStatus === "active" || legacyStatus === "trialing";
}

async function getOrInitUsage(service: any, userId: string): Promise<{ used: number; limit: number }> {
  let { data, error } = await service
    .from("usage_state")
    .select("ai_messages_used")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: inserted, error: insertErr } = await service
      .from("usage_state")
      .insert({ user_id: userId, ai_messages_used: 0 })
      .select("ai_messages_used")
      .maybeSingle();

    if (!insertErr && inserted) {
      data = inserted;
    } else {
      const fallback = await service
        .from("usage_state")
        .select("ai_messages_used")
        .eq("user_id", userId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      data = fallback.data;
    }
  }

  const used = Number(data?.ai_messages_used ?? 0);
  return { used, limit: AI_PREMIUM_MESSAGE_LIMIT };
}

async function incrementUsageAfterSuccess(service: any, userId: string, limit: number): Promise<number | null> {
  for (let i = 0; i < 3; i += 1) {
    const { data: current, error: currentErr } = await service
      .from("usage_state")
      .select("ai_messages_used")
      .eq("user_id", userId)
      .single();

    if (currentErr) throw currentErr;
    const used = Number(current.ai_messages_used ?? 0);
    if (used >= limit) return null;

    const { data: updated, error: updateErr } = await service
      .from("usage_state")
      .update({ ai_messages_used: used + 1 })
      .eq("user_id", userId)
      .eq("ai_messages_used", used)
      .select("ai_messages_used")
      .maybeSingle();

    if (!updateErr && updated) {
      return Number(updated.ai_messages_used ?? used + 1);
    }
  }

  const { data: latest, error: latestErr } = await service
    .from("usage_state")
    .select("ai_messages_used")
    .eq("user_id", userId)
    .single();

  if (latestErr) throw latestErr;
  return Number(latest.ai_messages_used ?? 0);
}

async function loadProfileContext(service: any, userId: string) {
  const [userRes, onboardingRes] = await Promise.all([
    service
      .from("users")
      .select("display_name,favorite_team,preferred_sport")
      .eq("id", userId)
      .single(),
    service
      .from("onboarding_answers")
      .select("collector_type,sports,goals,collection_size,card_types,brands")
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  if (userRes.error) throw userRes.error;
  if (onboardingRes.error) throw onboardingRes.error;

  return {
    displayName: userRes.data.display_name,
    favoriteTeam: userRes.data.favorite_team,
    preferredSport: userRes.data.preferred_sport,
    onboarding: onboardingRes.data
      ? {
          collectorType: onboardingRes.data.collector_type,
          sports: onboardingRes.data.sports ?? [],
          goals: onboardingRes.data.goals ?? [],
          collectionSize: onboardingRes.data.collection_size,
          cardTypes: onboardingRes.data.card_types ?? [],
          brands: onboardingRes.data.brands ?? []
        }
      : null
  };
}

async function verifyCardAccessAndContext(service: any, userId: string, cardId: string) {
  const [scanAccess, collectionAccess] = await Promise.all([
    service
      .from("scans")
      .select("id")
      .eq("user_id", userId)
      .eq("card_id", cardId)
      .limit(1),
    service
      .from("collection_items")
      .select("id")
      .eq("user_id", userId)
      .eq("card_id", cardId)
      .limit(1)
  ]);

  if (scanAccess.error) throw scanAccess.error;
  if (collectionAccess.error) throw collectionAccess.error;

  const hasAccess = (scanAccess.data?.length ?? 0) > 0 || (collectionAccess.data?.length ?? 0) > 0;
  if (!hasAccess) {
    return null;
  }

  const [cardRes, valuationRes, salesRes, gradingRowsRes] = await Promise.all([
    service
      .from("cards")
      .select(
        "id,sport,player_name,card_title,year,brand,set_name,card_number,team,position,rarity_label,description,player_info"
      )
      .eq("id", cardId)
      .single(),
    service
      .from("valuation_snapshots")
      .select("reference_value,currency,condition_basis,fetched_at")
      .eq("card_id", cardId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("card_sales")
      .select("source,price,currency,sale_date,condition,grade")
      .eq("card_id", cardId)
      .order("sale_date", { ascending: false })
      .limit(5),
    service
      .from("card_grading_scenarios")
      .select("assumed_grade,estimated_value,source")
      .eq("card_id", cardId)
      .eq("grading_company", "PSA")
      .in("assumed_grade", ["Raw", "9", "10"])
  ]);

  if (cardRes.error) throw cardRes.error;
  if (valuationRes.error) throw valuationRes.error;
  if (salesRes.error) throw salesRes.error;
  if (gradingRowsRes.error) throw gradingRowsRes.error;

  const c = cardRes.data;
  const v = valuationRes.data;
  const mappedSales = (salesRes.data ?? []).map((row: any) => ({
    source: row.source,
    price: Number(row.price ?? 0),
    currency: row.currency ?? "USD",
    saleDate: row.sale_date,
    condition: row.condition ?? null,
    grade: row.grade ?? null
  }));
  const recentSales = mappedSales.length
    ? mappedSales
    : buildDemoRecentSales(cardId, v?.reference_value ?? null, v?.currency ?? "USD");
  const gradingRows = gradingRowsRes.data ?? [];
  const rawScenario = gradingRows.find((row: any) => String(row.assumed_grade) === "Raw");
  const psa9Scenario = gradingRows.find((row: any) => String(row.assumed_grade) === "9");
  const psa10Scenario = gradingRows.find((row: any) => String(row.assumed_grade) === "10");
  const rawValue = Number(rawScenario?.estimated_value ?? v?.reference_value ?? 0);
  const psa9Value = Number(psa9Scenario?.estimated_value ?? rawValue * 2.0);
  const psa10Value = Number(psa10Scenario?.estimated_value ?? rawValue * 4.5);
  const rec = gradingRecommendation(rawValue, psa9Value, psa10Value);

  return {
    id: c.id,
    sport: c.sport,
    playerName: c.player_name,
    cardTitle: c.card_title,
    year: c.year,
    brand: c.brand,
    setName: c.set_name,
    cardNumber: c.card_number,
    team: c.team,
    position: c.position,
    rarityLabel: c.rarity_label,
    description: c.description,
    playerInfo: c.player_info,
    latestConditionEstimate: v?.condition_basis ?? null,
    referenceValue: v?.reference_value ?? null,
    currency: v?.currency ?? "USD",
    recentSales,
    gradingOutlook: {
      recommendation: rec.label,
      rationale: rec.rationale,
      rawValue,
      psa9Value,
      psa10Value,
      potentialUpside: Math.max(0, psa10Value - rawValue)
    }
  };
}

async function getOrCreateThread(service: any, input: {
  userId: string;
  mode: ThreadType;
  cardId: string | null;
}) {
  let query = service
    .from("ai_chat_threads")
    .select("id,thread_type,card_id")
    .eq("user_id", input.userId)
    .eq("thread_type", input.mode)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(1);

  query = input.cardId ? query.eq("card_id", input.cardId) : query.is("card_id", null);

  const { data: existingRows, error: existingErr } = await query;
  if (existingErr) throw existingErr;

  const existing = existingRows?.[0];
  if (existing?.id) return existing.id;

  const title = input.mode === "general" ? "General Collector Session" : "Card Session";
  const { data: created, error: createErr } = await service
    .from("ai_chat_threads")
    .insert({
      user_id: input.userId,
      card_id: input.cardId,
      title,
      thread_type: input.mode,
      last_message_at: nowIso(),
      archived: false
    })
    .select("id")
    .single();

  if (createErr) throw createErr;
  return created.id;
}

async function getRecentHistory(service: any, threadId: string): Promise<ChatHistoryItem[]> {
  const { data, error } = await service
    .from("ai_chat_messages")
    .select("role,content")
    .eq("thread_id", threadId)
    .in("role", ["user", "assistant"])
    .is("error_state", null)
    .order("created_at", { ascending: false })
    .limit(MAX_CONTEXT_MESSAGES);

  if (error) throw error;
  return (data ?? [])
    .reverse()
    .map((row: any) => ({ role: row.role, content: row.content })) as ChatHistoryItem[];
}

async function enforceNoDuplicateOrRapid(service: any, threadId: string, message: string): Promise<ChatFailure | null> {
  const { data, error } = await service
    .from("ai_chat_messages")
    .select("role,content,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) throw error;

  const latest = data?.[0];
  if (!latest?.created_at) return null;

  const elapsed = secondsBetween(nowIso(), latest.created_at);
  if (elapsed < RAPID_WINDOW_SECONDS) {
    return makeFailure({
      code: "RATE_LIMITED",
      message: "You're sending messages too quickly. Try again in a moment.",
      retryAfterSeconds: Math.ceil(RAPID_WINDOW_SECONDS - elapsed)
    });
  }

  const latestUser = data?.find((row: any) => row.role === "user");
  if (latestUser?.created_at && latestUser?.content) {
    const sameMessage = normalizeMessage(latestUser.content).toLowerCase() === normalizeMessage(message).toLowerCase();
    const duplicateElapsed = secondsBetween(nowIso(), latestUser.created_at);
    if (sameMessage && duplicateElapsed < DUPLICATE_WINDOW_SECONDS) {
      return makeFailure({
        code: "DUPLICATE_MESSAGE",
        message: "That message was already sent. Try a new question or wait a few seconds.",
        retryAfterSeconds: Math.ceil(DUPLICATE_WINDOW_SECONDS - duplicateElapsed)
      });
    }
  }

  return null;
}

async function persistMessage(service: any, input: {
  threadId: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  metadata?: Record<string, unknown> | null;
  errorState?: string | null;
}) {
  const { data, error } = await service
    .from("ai_chat_messages")
    .insert({
      thread_id: input.threadId,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      metadata: input.metadata ?? null,
      error_state: input.errorState ?? null
    })
    .select("id,thread_id,role,content,metadata,model,error_state,created_at")
    .single();

  if (error) throw error;
  return data;
}

async function touchThread(service: any, threadId: string) {
  await service
    .from("ai_chat_threads")
    .update({
      last_message_at: nowIso(),
      updated_at: nowIso()
    })
    .eq("id", threadId);
}

function toUnexpectedError(error: unknown): ChatFailure {
  const message = error instanceof Error ? error.message : "Unexpected AI chat error.";
  return makeFailure({ code: "UNKNOWN", message });
}

export async function handleAiChat(input: {
  authUserId: string;
  body: ChatRequestBody;
}): Promise<ChatResponse> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return makeFailure({ code: "UNKNOWN", message: "Missing Supabase server environment variables." });
    }

    const service = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const mode = input.body.mode;
    const rawMessage = input.body.message ?? "";
    const message = normalizeMessage(rawMessage).slice(0, MAX_MESSAGE_LENGTH);

    if (!message) {
      return makeFailure({ code: "EMPTY_MESSAGE", message: "Message cannot be empty." });
    }

    if (mode !== "general" && mode !== "card") {
      return makeFailure({ code: "UNKNOWN", message: "Invalid chat mode." });
    }

    const userId = await getUserIdByAuthUser(service, input.authUserId);

    const premium = await isPremiumUser(service, userId);
    if (!premium) {
      return makeFailure({
        code: "PREMIUM_REQUIRED",
        message: "Collector AI is a CardAtlas Pro feature. Upgrade to continue."
      });
    }

    const usage = await getOrInitUsage(service, userId);
    if (usage.used >= usage.limit) {
      return makeFailure({
        code: "LIMIT_REACHED",
        message: `You reached your AI message limit (${usage.limit}).`
      });
    }

    const cardId = mode === "card" ? input.body.cardId ?? null : null;
    let cardContext = null;
    if (mode === "card") {
      if (!cardId) {
        return makeFailure({ code: "INVALID_CARD", message: "Card chat requires a valid card id." });
      }

      cardContext = await verifyCardAccessAndContext(service, userId, cardId);
      if (!cardContext) {
        return makeFailure({ code: "INVALID_CARD", message: "Card not found or not accessible for this user." });
      }
    }

    const threadId = await getOrCreateThread(service, {
      userId,
      mode,
      cardId
    });

    const duplicateOrRapid = await enforceNoDuplicateOrRapid(service, threadId, message);
    if (duplicateOrRapid) {
      return duplicateOrRapid;
    }

    await persistMessage(service, {
      threadId,
      role: "user",
      content: message,
      metadata: { mode, cardId }
    });

    const profile = await loadProfileContext(service, userId);
    const prompt = buildPromptPackage({
      mode,
      context: {
        profile,
        card: cardContext
      } as ChatContextBundle
    });

    const history = await getRecentHistory(service, threadId);
    const provider = createChatProvider();

    let providerResult;
    try {
      providerResult = await provider.generateResponse({
        systemPrompt: prompt.systemPrompt,
        contextBlock: prompt.contextBlock,
        history,
        userMessage: message
      });
    } catch (providerErr) {
      const errText = providerErr instanceof Error ? providerErr.message : "Model call failed.";
      await persistMessage(service, {
        threadId,
        role: "assistant",
        content: "I couldn't process that request right now. Please retry.",
        model: null,
        metadata: { mode, cardId, failed: true },
        errorState: errText
      });
      await touchThread(service, threadId);
      return makeFailure({ code: "PROVIDER_ERROR", message: errText });
    }

    const assistantContent = providerResult.text.trim();
    if (!assistantContent) {
      return makeFailure({ code: "PROVIDER_ERROR", message: "Model returned an empty response." });
    }

    const nextUsed = await incrementUsageAfterSuccess(service, userId, usage.limit);
    if (nextUsed == null) {
      return makeFailure({
        code: "LIMIT_REACHED",
        message: `You reached your AI message limit (${usage.limit}).`
      });
    }

    const assistantRow = await persistMessage(service, {
      threadId,
      role: "assistant",
      content: assistantContent,
      model: providerResult.model,
      metadata: {
        mode,
        cardId,
        provider: provider.providerName,
        usageUsed: nextUsed,
        usageLimit: usage.limit
      }
    });

    await touchThread(service, threadId);

    const response: ChatSuccess = {
      ok: true,
      threadId,
      threadType: mode,
      cardId,
      model: providerResult.model,
      usage: {
        aiMessagesUsed: nextUsed,
        aiMessagesLimit: usage.limit,
        aiMessagesRemaining: Math.max(0, usage.limit - nextUsed)
      },
      assistant: {
        id: assistantRow.id,
        threadId: assistantRow.thread_id,
        role: "assistant",
        content: assistantRow.content,
        metadata: assistantRow.metadata,
        model: assistantRow.model,
        errorState: assistantRow.error_state,
        createdAt: assistantRow.created_at
      }
    };

    return response;
  } catch (error) {
    return toUnexpectedError(error);
  }
}
