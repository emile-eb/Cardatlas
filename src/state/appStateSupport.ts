import type { CardItem } from "@/types/models";
import type { EntitlementState, FreeTrialState, HomeDashboardResponse, UsageState } from "@/types";
import type { StartupRoute } from "@/features/startup/startupGuard";

type ScanDraftState = {
  frontUri?: string;
  backUri?: string;
};

export function collectionFingerprint(card: CardItem): string {
  return [card.playerName, card.year, card.brand, card.set, card.cardNumber].join("|").toLowerCase().trim();
}

export function mergeCollectionCards(primary: CardItem[], secondary: CardItem[]): CardItem[] {
  const byKey = new Map<string, CardItem>();
  [...primary, ...secondary].forEach((item) => {
    const key = collectionFingerprint(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      return;
    }

    const existingHasImage = Boolean(existing.imageFront?.trim());
    const currentHasImage = Boolean(item.imageFront?.trim());
    if (!existingHasImage && currentHasImage) {
      byKey.set(key, item);
      return;
    }

    if (existingHasImage === currentHasImage && Date.parse(item.dateScanned) > Date.parse(existing.dateScanned)) {
      byKey.set(key, item);
    }
  });

  return Array.from(byKey.values()).sort((a, b) => Date.parse(b.dateScanned) - Date.parse(a.dateScanned));
}

function isGenericCard(item: CardItem) {
  return item.playerName === "Scanned Card" || item.cardTitle === "Scanned Card" || item.cardTitle === "Pending Card Identification";
}

export function mergeCardItemsById(primary: CardItem[], secondary: CardItem[]): CardItem[] {
  const byId = new Map<string, CardItem>();
  [...primary, ...secondary].forEach((item) => {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      return;
    }

    const existingGeneric = isGenericCard(existing);
    const currentGeneric = isGenericCard(item);

    if (existingGeneric && !currentGeneric) {
      byId.set(item.id, item);
      return;
    }

    if (existingGeneric === currentGeneric && Date.parse(item.dateScanned) > Date.parse(existing.dateScanned)) {
      byId.set(item.id, item);
    }
  });

  const byFrontImage = new Map<string, CardItem>();
  Array.from(byId.values()).forEach((item) => {
    const imageKey = item.imageFront?.trim();
    if (!imageKey) return;

    const existing = byFrontImage.get(imageKey);
    if (!existing) {
      byFrontImage.set(imageKey, item);
      return;
    }

    const existingGeneric = isGenericCard(existing);
    const currentGeneric = isGenericCard(item);
    if (existingGeneric && !currentGeneric) {
      byFrontImage.set(imageKey, item);
      return;
    }

    if (existingGeneric === currentGeneric && Date.parse(item.dateScanned) > Date.parse(existing.dateScanned)) {
      byFrontImage.set(imageKey, item);
    }
  });

  const sorted = Array.from(byFrontImage.values()).sort((a, b) => Date.parse(b.dateScanned) - Date.parse(a.dateScanned));
  const final: CardItem[] = [];
  const windowMs = 5 * 60 * 1000;

  sorted.forEach((item) => {
    if (!isGenericCard(item)) {
      final.push(item);
      return;
    }

    const itemTs = Date.parse(item.dateScanned);
    const hasNearbyRichItem = final.some((existing) => !isGenericCard(existing) && Math.abs(Date.parse(existing.dateScanned) - itemTs) <= windowMs);

    if (!hasNearbyRichItem) {
      final.push(item);
    }
  });

  return final.sort((a, b) => Date.parse(b.dateScanned) - Date.parse(a.dateScanned));
}

export function buildDefaultUsageState(): UsageState {
  return {
    scanLimit: 3,
    scansUsed: 0,
    scansRemaining: 3
  };
}

export function buildDefaultEntitlementState(): EntitlementState {
  return {
    isPremium: false,
    source: "none",
    expiresAt: null
  };
}

export function buildDefaultFreeTrialState(): FreeTrialState {
  return {
    isEligible: true,
    hasStarted: false,
    durationDays: 3
  };
}

export function buildDefaultHomeDashboard(
  userId: string,
  usage: UsageState,
  entitlement: EntitlementState,
  freeTrial: FreeTrialState
): HomeDashboardResponse {
  return {
    userId,
    portfolioValue: 0,
    cardCount: 0,
    teamCount: 0,
    usage,
    entitlement,
    freeTrial,
    scansRemaining: usage.scansRemaining,
    canUseAI: false,
    subscription: {
      entitlementStatus: "inactive",
      trialEligible: true,
      trialStartedAt: null,
      trialExpiresAt: null,
      subscriptionProductId: null,
      subscriptionExpiresAt: null,
      managementUrl: null,
      store: null,
      revenueCatCustomerId: null,
      isPremium: false
    },
    recentScans: [],
    collectionHighlights: []
  };
}

export function shouldShowSessionPaywall(input: {
  status: string;
  hasBackendUser: boolean;
  hasHydratedBootstrapState: boolean;
  onboardingDone: boolean;
  completedOnboardingThisSession: boolean;
  scanDraft: ScanDraftState;
  startupRoute: StartupRoute;
  isPremium: boolean;
  hasShownSessionPaywall: boolean;
}) {
  return (
    input.status === "authenticated" &&
    input.hasBackendUser &&
    input.hasHydratedBootstrapState &&
    input.onboardingDone &&
    !input.completedOnboardingThisSession &&
    !input.scanDraft.frontUri &&
    !input.scanDraft.backUri &&
    input.startupRoute === "/(tabs)/home" &&
    !input.isPremium &&
    !input.hasShownSessionPaywall
  );
}

export function shouldSuppressDuplicatePaywall(
  previous: { key: string; at: number } | null,
  nextKey: string,
  now = Date.now(),
  windowMs = 700
) {
  return Boolean(previous && previous.key === nextKey && now - previous.at < windowMs);
}
