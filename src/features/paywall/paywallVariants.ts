export type PaywallEntryPoint =
  | "discovery"
  | "scan_limit"
  | "session_gate"
  | "ai_gate"
  | "settings_upgrade"
  | "premium_feature_gate"
  | "onboarding"
  | "startup";

export type PaywallVariantKey =
  | "discovery"
  | "scan_limit"
  | "session_gate"
  | "ai_gate"
  | "settings_upgrade"
  | "premium_feature_gate";

export type PaywallVariantContent = {
  headline: string;
  subheadline: string;
  heroKicker: string;
  urgencyLabel?: string;
};

export const PAYWALL_VARIANTS: Record<PaywallVariantKey, PaywallVariantContent> = {
  discovery: {
    heroKicker: "CARDATLAS PRO",
    headline: "Upgrade to CardAtlas Pro",
    subheadline:
      "Unlimited scans, collection tools, market context, and Collector AI."
  },
  scan_limit: {
    heroKicker: "CARDATLAS PRO",
    headline: "Keep scanning with CardAtlas Pro",
    subheadline: "Unlimited scans plus the premium collector workflow.",
    urgencyLabel: "Continue scanning"
  },
  session_gate: {
    heroKicker: "CARDATLAS PRO",
    headline: "Unlock the serious collector workflow",
    subheadline: "Collection tools, market visibility, grading insight, and Collector AI."
  },
  ai_gate: {
    heroKicker: "COLLECTOR AI",
    headline: "Unlock Collector AI",
    subheadline: "Card-aware market context and grading guidance inside CardAtlas Pro."
  },
  settings_upgrade: {
    heroKicker: "CARDATLAS PRO",
    headline: "Upgrade to CardAtlas Pro",
    subheadline: "Unlimited scans, collection tracking, market tools, and Collector AI."
  },
  premium_feature_gate: {
    heroKicker: "CARDATLAS PRO",
    headline: "Unlock premium collector intelligence",
    subheadline: "Live market visibility, price history, grading context, and Collector AI."
  }
};

export function resolvePaywallEntryPoint(source?: string): PaywallEntryPoint {
  const normalized = String(source ?? "discovery").toLowerCase().trim();
  if (normalized === "scan" || normalized === "scan_limit") return "scan_limit";
  if (normalized === "session_gate" || normalized === "returning_free_user") return "session_gate";
  if (normalized === "ai" || normalized === "ai-general" || normalized === "ai_gate") return "ai_gate";
  if (normalized === "settings" || normalized === "settings_upgrade") return "settings_upgrade";
  if (normalized === "results_price_history" || normalized === "premium_feature_gate") return "premium_feature_gate";
  if (normalized === "onboarding") return "onboarding";
  if (normalized === "startup") return "startup";
  return "discovery";
}

export function resolvePaywallVariant(source?: string): PaywallVariantKey {
  const entryPoint = resolvePaywallEntryPoint(source);
  if (entryPoint === "onboarding" || entryPoint === "startup" || entryPoint === "discovery") {
    return "discovery";
  }
  return entryPoint;
}

export function analyticsLabelForPaywallEntryPoint(entryPoint: PaywallEntryPoint): string {
  if (entryPoint === "onboarding" || entryPoint === "startup") return "onboarding";
  return entryPoint;
}
