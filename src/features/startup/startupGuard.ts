import type { AuthBootstrapStatus } from "@/types";
import type { PremiumGateContext } from "@/types/premium";

export type StartupRoute = "/splash" | "/onboarding" | "/paywall?source=startup" | "/(tabs)/home";

export interface StartupDecisionInput {
  authStatus: AuthBootstrapStatus;
  gateContext: PremiumGateContext;
}

export function resolveStartupRoute(input: StartupDecisionInput): StartupRoute {
  if (input.authStatus === "idle" || input.authStatus === "loading") {
    return "/splash";
  }

  if (!input.gateContext.onboardingCompleted) {
    return "/onboarding";
  }

  return "/(tabs)/home";
}
