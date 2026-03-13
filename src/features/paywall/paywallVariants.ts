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
    headline: "Unlock Unlimited Card Scans",
    subheadline:
      "Reveal rarity, track your collection, and unlock the full collector intelligence experience."
  },
  scan_limit: {
    heroKicker: "SCAN LIMIT REACHED",
    headline: "You've used all your free scans",
    subheadline: "Unlock unlimited scanning and continue discovering cards.",
    urgencyLabel: "Continue scanning now"
  },
  session_gate: {
    heroKicker: "WELCOME BACK",
    headline: "Unlock deeper collector intelligence",
    subheadline: "Get unlimited scans, premium market reads, and AI guidance built for returning collectors."
  },
  ai_gate: {
    heroKicker: "AI COLLECTOR EXPERT",
    headline: "Unlock CardAtlas AI",
    subheadline: "Get card-aware grading guidance, market interpretation, and collector decision support built into every scan."
  },
  settings_upgrade: {
    heroKicker: "CARDATLAS PRO",
    headline: "Upgrade your collector toolkit",
    subheadline: "Unlock unlimited scans, deeper market data, and premium features across your collection."
  },
  premium_feature_gate: {
    heroKicker: "PREMIUM FEATURE",
    headline: "Unlock deeper market intelligence",
    subheadline: "Access premium charts, advanced insights, and the full CardAtlas collector workflow."
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
