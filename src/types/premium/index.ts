import type { ISODateString } from "@/types/db";

export interface FreeTrialState {
  isEligible: boolean;
  hasStarted: boolean;
  startedAt?: ISODateString;
  endsAt?: ISODateString;
  durationDays: number;
}

export interface EntitlementState {
  isPremium: boolean;
  source: "none" | "trial" | "subscription";
  productId?: string;
  expiresAt?: ISODateString | null;
}

export interface UsageState {
  scanLimit: number;
  scansUsed: number;
  scansRemaining: number;
  aiMessagesRemaining?: number;
}

export interface PremiumGateContext {
  usage: UsageState;
  entitlement: EntitlementState;
  freeTrial: FreeTrialState;
  onboardingCompleted: boolean;
  onboardingPaywallSeen: boolean;
}
