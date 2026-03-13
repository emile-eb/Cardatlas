import { Platform } from "react-native";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/constants/analyticsEvents";

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

type SafeValue = string | number | boolean;
type SafePayload = Record<string, SafeValue>;

type DedupeRule = {
  ttlMs: number;
  keyFields?: string[];
  once?: boolean;
};

const VALID_EVENTS = new Set<AnalyticsEventName>(Object.values(ANALYTICS_EVENTS));

const META_EVENT_MAP: Record<AnalyticsEventName, string> = {
  [ANALYTICS_EVENTS.appOpened]: "app_opened",
  [ANALYTICS_EVENTS.bootstrapHydrated]: "bootstrap_hydrated",
  [ANALYTICS_EVENTS.onboardingStarted]: "onboarding_started",
  [ANALYTICS_EVENTS.onboardingCompleted]: "onboarding_completed",
  [ANALYTICS_EVENTS.scanStarted]: "scan_started",
  [ANALYTICS_EVENTS.cameraOpened]: "camera_opened",
  [ANALYTICS_EVENTS.cameraPermissionDenied]: "camera_permission_denied",
  [ANALYTICS_EVENTS.frontCaptured]: "front_captured",
  [ANALYTICS_EVENTS.backCaptured]: "back_captured",
  [ANALYTICS_EVENTS.retakeFront]: "retake_front",
  [ANALYTICS_EVENTS.retakeBack]: "retake_back",
  [ANALYTICS_EVENTS.cameraCaptureFailed]: "camera_capture_failed",
  [ANALYTICS_EVENTS.scanHandoffToProcessing]: "scan_handoff_to_processing",
  [ANALYTICS_EVENTS.scanUploaded]: "scan_uploaded",
  [ANALYTICS_EVENTS.scanCompleted]: "scan_completed",
  [ANALYTICS_EVENTS.cardAddedToCollection]: "card_added_to_collection",
  [ANALYTICS_EVENTS.aiChatOpened]: "ai_chat_opened",
  [ANALYTICS_EVENTS.aiMessageSent]: "ai_message_sent",
  [ANALYTICS_EVENTS.aiMessageFailed]: "ai_message_failed",
  [ANALYTICS_EVENTS.aiSuggestedPromptTapped]: "ai_suggested_prompt_tapped",
  [ANALYTICS_EVENTS.priceHistoryUpgradeTapped]: "price_history_upgrade_tapped",
  [ANALYTICS_EVENTS.activeMarketItemTapped]: "active_market_item_tapped",
  [ANALYTICS_EVENTS.activeMarketPreviewOpened]: "active_market_preview_opened",
  [ANALYTICS_EVENTS.priceHistoryPreviewOpened]: "price_history_preview_opened",
  [ANALYTICS_EVENTS.gradingOutlookPreviewOpened]: "grading_outlook_preview_opened",
  [ANALYTICS_EVENTS.resultsDetailRouteFailed]: "results_detail_route_failed",
  [ANALYTICS_EVENTS.askAiFromResults]: "ask_ai_from_results",
  [ANALYTICS_EVENTS.askAiFromHome]: "ask_ai_from_home",
  [ANALYTICS_EVENTS.askAiFromManageCard]: "ask_ai_from_manage_card",
  [ANALYTICS_EVENTS.addToCollectionFromResults]: "add_to_collection_from_results",
  [ANALYTICS_EVENTS.marketPulseViewed]: "market_pulse_viewed",
  [ANALYTICS_EVENTS.marketPulseItemOpened]: "market_pulse_item_opened",
  [ANALYTICS_EVENTS.providerFallbackUsed]: "provider_fallback_used",
  [ANALYTICS_EVENTS.paywallViewed]: "paywall_viewed",
  [ANALYTICS_EVENTS.paywallDismissed]: "paywall_dismissed",
  [ANALYTICS_EVENTS.paywallPurchaseStarted]: "paywall_purchase_started",
  [ANALYTICS_EVENTS.paywallPurchaseFailed]: "paywall_purchase_failed",
  [ANALYTICS_EVENTS.paywallRestoreFailed]: "paywall_restore_failed",
  [ANALYTICS_EVENTS.trialStarted]: "trial_started",
  [ANALYTICS_EVENTS.subscriptionStarted]: "subscription_started",
  [ANALYTICS_EVENTS.subscriptionRestored]: "subscription_restored"
};

const DEDUPE_RULES: Partial<Record<AnalyticsEventName, DedupeRule>> = {
  [ANALYTICS_EVENTS.appOpened]: { ttlMs: 30_000 },
  [ANALYTICS_EVENTS.bootstrapHydrated]: { ttlMs: 30_000 },
  [ANALYTICS_EVENTS.onboardingCompleted]: { ttlMs: Number.MAX_SAFE_INTEGER, once: true },
  [ANALYTICS_EVENTS.scanCompleted]: { ttlMs: 86_400_000, keyFields: ["scanId", "scanJobId", "cardId"] },
  [ANALYTICS_EVENTS.marketPulseViewed]: { ttlMs: 10 * 60_000 },
  [ANALYTICS_EVENTS.marketPulseItemOpened]: { ttlMs: 2_000, keyFields: ["listingId"] },
  [ANALYTICS_EVENTS.subscriptionStarted]: { ttlMs: 10_000, keyFields: ["productId", "packageId"] },
  [ANALYTICS_EVENTS.trialStarted]: { ttlMs: 10_000, keyFields: ["productId", "packageId"] },
  [ANALYTICS_EVENTS.subscriptionRestored]: { ttlMs: 10_000 }
};

function getMetaModule(): any | null {
  if (Platform.OS === "web") return null;
  try {
    const dynamicRequire = Function("return require")();
    const mod = dynamicRequire("react-native-fbsdk-next");
    return mod;
  } catch {
    return null;
  }
}

function sanitizePayload(payload?: AnalyticsPayload): SafePayload {
  if (!payload) return {};

  const safe: SafePayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      safe[key] = value.slice(0, 120);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  }
  return safe;
}

function dedupeKeyFor(event: AnalyticsEventName, payload: SafePayload): string {
  const rule = DEDUPE_RULES[event];
  if (!rule) return event;

  if (rule.once) return `${event}:once`;

  if (rule.keyFields?.length) {
    const fieldValue = rule.keyFields
      .map((field) => (payload[field] != null ? String(payload[field]) : ""))
      .find(Boolean);
    if (fieldValue) return `${event}:${fieldValue}`;
  }

  return event;
}

export interface AnalyticsService {
  initialize(): void;
  track(event: AnalyticsEventName, payload?: AnalyticsPayload): void;
  identify(userId: string, traits?: AnalyticsPayload): void;
  reset(): void;
}

class CentralAnalyticsService implements AnalyticsService {
  private initialized = false;
  private seen = new Map<string, number>();

  initialize() {
    if (this.initialized) return;
    this.initialized = true;

    const meta = getMetaModule();
    if (!meta) return;

    try {
      if (meta.Settings?.setAutoLogAppEventsEnabled) {
        meta.Settings.setAutoLogAppEventsEnabled(true);
      }
      if (meta.Settings?.setAdvertiserTrackingEnabled) {
        meta.Settings.setAdvertiserTrackingEnabled(true);
      }
      if (meta.Settings?.initializeSDK) {
        meta.Settings.initializeSDK();
      }
    } catch (error) {
      if (__DEV__) {
        console.log("[analytics] meta init skipped", error);
      }
    }
  }

  private shouldTrack(event: AnalyticsEventName, payload: SafePayload): boolean {
    const rule = DEDUPE_RULES[event];
    if (!rule) return true;

    const key = dedupeKeyFor(event, payload);
    const now = Date.now();
    const previous = this.seen.get(key);

    if (previous && now - previous < rule.ttlMs) {
      return false;
    }

    this.seen.set(key, now);
    return true;
  }

  track(event: AnalyticsEventName, payload?: AnalyticsPayload) {
    if (!VALID_EVENTS.has(event)) {
      if (__DEV__) console.log("[analytics] invalid event", event);
      return;
    }

    const safePayload = sanitizePayload(payload);
    if (!this.shouldTrack(event, safePayload)) {
      if (__DEV__) console.log(`[analytics] deduped ${event}`, safePayload);
      return;
    }

    if (__DEV__) {
      console.log(`[analytics] ${event}`, safePayload);
    }

    const meta = getMetaModule();
    if (!meta?.AppEventsLogger) return;

    try {
      const mappedName = META_EVENT_MAP[event] ?? event;
      meta.AppEventsLogger.logEvent(mappedName, undefined, safePayload);
    } catch (error) {
      if (__DEV__) {
        console.log("[analytics] meta log failed", error);
      }
    }
  }

  identify(userId: string, traits?: AnalyticsPayload) {
    const safeTraits = sanitizePayload(traits);
    if (__DEV__) {
      console.log("[analytics] identify", { userId, ...safeTraits });
    }
  }

  reset() {
    this.seen.clear();
    if (__DEV__) {
      console.log("[analytics] reset");
    }
  }
}

export const analyticsService: AnalyticsService = new CentralAnalyticsService();
