import type { PremiumGateContext } from "@/types/premium";

export const FREE_SCAN_LIMIT = 3;
export const FREE_TRIAL_DAYS = 3;

export function remainingFreeScans(scansUsed: number, scanLimit = FREE_SCAN_LIMIT) {
  return Math.max(0, scanLimit - scansUsed);
}

export function canScan(context: PremiumGateContext) {
  if (context.entitlement.isPremium) return true;
  return context.usage.scansRemaining > 0;
}

export function canUseAI(context: PremiumGateContext) {
  return context.entitlement.isPremium;
}

export function shouldShowPaywallAfterOnboarding(context: PremiumGateContext) {
  return context.onboardingCompleted && !context.onboardingPaywallSeen && !context.entitlement.isPremium;
}

export function shouldShowPaywallForScans(context: PremiumGateContext) {
  return !canScan(context);
}

export function shouldShowPaywallForAI(context: PremiumGateContext) {
  return !canUseAI(context);
}
