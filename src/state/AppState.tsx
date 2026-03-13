import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { AppState as RNAppState, Linking } from "react-native";
import { CardItem } from "@/types/models";
import type {
  EntitlementState,
  FreeTrialState,
  HomeDashboardResponse,
  PaywallViewModel,
  PurchaseResult,
  RestoreResult,
  UsageState
} from "@/types";
import { useAuth } from "@/features/auth";
import { resolveStartupRoute, type StartupRoute } from "@/features/startup/startupGuard";
import {
  canScan,
  canUseAI,
  shouldShowPaywallForAI,
  shouldShowPaywallForScans
} from "@/services/subscriptions/gating";
import { subscriptionsService } from "@/services/subscriptions/SubscriptionsService";
import { onboardingService } from "@/services/onboarding/OnboardingService";
import { dashboardService } from "@/services/dashboard/DashboardService";
import { collectionService } from "@/services/collection/CollectionService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { rarityFromPrice } from "@/utils/rarity";
import type { PaywallEntryPoint } from "@/features/paywall/paywallVariants";
import { analyticsLabelForPaywallEntryPoint } from "@/features/paywall/paywallVariants";
import {
  buildDefaultEntitlementState,
  buildDefaultFreeTrialState,
  buildDefaultHomeDashboard,
  buildDefaultUsageState,
  collectionFingerprint,
  mergeCardItemsById,
  mergeCollectionCards,
  shouldShowSessionPaywall as shouldShowSessionPaywallState,
  shouldSuppressDuplicatePaywall
} from "@/state/appStateSupport";

export type OnboardingProfile = {
  collectorType?: string;
  sports: string[];
  goals: string[];
  collectionSize?: string;
  cardTypes: string[];
  brands: string[];
  alerts?: string;
};

export type ScanDraft = {
  frontUri?: string;
  backUri?: string;
};

type AppStateValue = {
  cards: CardItem[];
  history: CardItem[];
  scanResultsById: Record<string, CardItem>;
  scanCount: number;
  freeScansRemaining: number;
  premium: boolean;
  onboardingDone: boolean;
  onboardingPaywallSeen: boolean;
  onboardingProfile: OnboardingProfile;
  usageState: UsageState;
  entitlementState: EntitlementState;
  freeTrialState: FreeTrialState;
  startupRoute: StartupRoute;
  homeDashboard: HomeDashboardResponse;
  scanDraft: ScanDraft;
  setScanDraftImage: (side: "front" | "back", uri: string) => void;
  clearScanDraft: () => void;
  completeOnboarding: () => void;
  dismissOnboardingPaywall: () => void;
  saveOnboardingProfile: (partial: Partial<OnboardingProfile>) => void;
  addCardToCollection: (id: string) => { added: boolean; alreadyExists: boolean };
  addProcessedScanToCollection: (scanId: string) => Promise<{ added: boolean; alreadyExists: boolean }>;
  updateCollectionItem: (
    collectionItemId: string,
    input: {
      notes?: string | null;
      isFavorite?: boolean;
      isAutograph?: boolean;
      isMemorabilia?: boolean;
      isParallel?: boolean;
      parallelName?: string | null;
      serialNumber?: string | null;
      isGraded?: boolean;
      gradingCompany?: string | null;
      grade?: string | null;
    }
  ) => Promise<void>;
  removeCollectionItem: (collectionItemId: string) => Promise<void>;
  canUseScan: boolean;
  canUseAI: boolean;
  presentPaywall: (entryPoint: PaywallEntryPoint, options?: { cardId?: string; replace?: boolean }) => boolean;
  startScanOrPaywall: (source?: "home" | "tab" | "collection" | "history") => boolean;
  completeScan: (card: CardItem) => void;
  enterAiOrPaywall: (cardId?: string) => boolean;
  loadPaywall: () => Promise<PaywallViewModel>;
  purchasePlan: (packageId: string) => Promise<PurchaseResult>;
  restoreBilling: (source?: string) => Promise<RestoreResult>;
  openManageSubscription: () => Promise<boolean>;
  clearLocalData: () => void;
  refreshFromBackend: () => Promise<void>;
  shouldShowSessionPaywall: boolean;
  consumeSessionPaywallTrigger: () => boolean;
};

const AppStateContext = createContext<AppStateValue | null>(null);

function toCardItemFromHighlight(highlight: HomeDashboardResponse["collectionHighlights"][number]): CardItem {
  const playerInfo = (highlight.card.playerInfo ?? {}) as Record<string, string>;
  const { rarityLabel, rarityLevel } = rarityFromPrice(highlight.latestValue);
  return {
    id: highlight.card.id,
    collectionItemId: highlight.collectionItemId,
    sourceCardId: highlight.card.id,
    isFavorite: Boolean(highlight.isFavorite),
    notes: highlight.notes ?? null,
    addedAt: highlight.addedAt ?? new Date().toISOString(),
    isAutograph: Boolean(highlight.isAutograph),
    isMemorabilia: Boolean(highlight.isMemorabilia),
    isParallel: Boolean(highlight.isParallel),
    parallelName: highlight.parallelName ?? null,
    serialNumber: highlight.serialNumber ?? null,
    isGraded: Boolean(highlight.isGraded),
    gradingCompany: highlight.gradingCompany ?? null,
    grade: highlight.grade ?? null,
    attributesUpdatedAt: highlight.attributesUpdatedAt ?? null,
    baseReferenceValue: Number(highlight.baseValue ?? highlight.latestValue ?? 0),
    adjustedValue: highlight.adjustedValue ?? null,
    valuationSource: highlight.valuationSource ?? null,
    valuationUpdatedAt: highlight.valuationUpdatedAt ?? null,
    playerName: highlight.card.playerName,
    cardTitle: highlight.card.cardTitle,
    year: highlight.card.year ?? new Date().getFullYear(),
    brand: highlight.card.brand ?? "Unknown",
    set: highlight.card.set ?? "Unknown",
    cardNumber: highlight.card.cardNumber ?? "",
    team: highlight.card.team ?? "Unknown",
    position: highlight.card.position ?? "",
    referenceValue: highlight.latestValue,
    gradedUpside: undefined,
    rarityLevel: highlight.card.rarityLevel ?? rarityLevel,
    rarityLabel,
    condition: "Unspecified",
    description: highlight.card.description ?? "Card record imported from your Supabase collection.",
    playerInfo: {
      era: highlight.card.era ?? playerInfo.era ?? "Unknown",
      careerNote: playerInfo.careerNote ?? ""
    },
    imageFront: highlight.card.imageFront ?? "",
    imageBack: highlight.card.imageBack ?? "",
    dateScanned: highlight.addedAt ?? new Date().toISOString()
  };
}

function toCardItemFromRecentScan(scan: HomeDashboardResponse["recentScans"][number]): CardItem | null {
  if (scan.status !== "completed" && scan.status !== "needs_review") return null;
  const frontImagePath = scan.frontImagePath?.trim();
  if (!frontImagePath) return null;
  const payload = (scan.identifiedPayload ?? {}) as Record<string, any>;

  const referenceValue = Number(payload.referenceValue ?? 0);
  const { rarityLabel, rarityLevel } = rarityFromPrice(referenceValue);
  return {
    id: scan.id,
    sourceScanId: scan.id,
    sourceCardId: (scan.correctedCardId ?? scan.cardId) ?? undefined,
    correctedCardId: scan.correctedCardId ?? null,
    wasCorrected: Boolean(scan.wasCorrected),
    correctionSource: scan.correctionSource ?? null,
    correctionReason: scan.correctionReason ?? null,
    reportedIncorrect: Boolean(scan.reportedIncorrect),
    valuationSnapshotId: scan.valuationSnapshotId ?? undefined,
    scanStatus: scan.status,
    confidenceLabel: scan.confidenceLabel ?? undefined,
    reviewReason: scan.reviewReason ?? null,
    playerName: payload.playerName ?? "Pending Card Identification",
    cardTitle: payload.cardTitle ?? "Pending Card Identification",
    year: Number(payload.year ?? new Date(scan.scannedAt).getFullYear()),
    brand: payload.brand ?? "Unknown",
    set: payload.setName ?? "Unknown",
    cardNumber: payload.cardNumber ?? "",
    team: payload.team ?? "Unknown",
    position: payload.position ?? "",
    referenceValue,
    gradedUpside: Number(payload.gradedUpside ?? (payload.referenceValue ? Number(payload.referenceValue) * 1.35 : 0)),
    rarityLevel,
    rarityLabel,
    condition: payload.conditionEstimate ?? "Unspecified",
    description: payload.description ?? "Recent scan record.",
    playerInfo: {
      era: payload.playerInfo?.era ?? "Unknown",
      careerNote: payload.playerInfo?.careerNote ?? ""
    },
    imageFront: frontImagePath,
    imageBack: scan.backImagePath?.trim() || frontImagePath,
    dateScanned: scan.scannedAt
  };
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const { session, status } = useAuth();
  const appUserId = session?.appUserId ?? null;
  const hasBackendUser = Boolean(appUserId);

  const [cards, setCards] = useState<CardItem[]>([]);
  const [history, setHistory] = useState<CardItem[]>([]);
  const [scanResultsById, setScanResultsById] = useState<Record<string, CardItem>>({});
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [onboardingPaywallSeen, setOnboardingPaywallSeen] = useState(false);
  const [onboardingProfile, setOnboardingProfile] = useState<OnboardingProfile>({
    sports: [],
    goals: [],
    cardTypes: [],
    brands: []
  });
  const [scanDraft, setScanDraft] = useState<ScanDraft>({});

  const [usageState, setUsageState] = useState<UsageState>(buildDefaultUsageState);

  const [entitlementState, setEntitlementState] = useState<EntitlementState>(buildDefaultEntitlementState);

  const [freeTrialState, setFreeTrialState] = useState<FreeTrialState>(buildDefaultFreeTrialState);

  const [homeDashboard, setHomeDashboard] = useState<HomeDashboardResponse>(() =>
    buildDefaultHomeDashboard(appUserId ?? "anonymous", buildDefaultUsageState(), buildDefaultEntitlementState(), buildDefaultFreeTrialState())
  );
  const [hasHydratedBootstrapState, setHasHydratedBootstrapState] = useState(false);
  const [hasShownSessionPaywall, setHasShownSessionPaywall] = useState(false);
  const [completedOnboardingThisSession, setCompletedOnboardingThisSession] = useState(false);
  const lastPaywallPresentationRef = useRef<{ key: string; at: number } | null>(null);

  const gateContext = {
    usage: usageState,
    entitlement: entitlementState,
    freeTrial: freeTrialState,
    onboardingCompleted: onboardingDone,
    onboardingPaywallSeen
  };

  const canUseScan = canScan(gateContext);
  const aiEnabled = canUseAI(gateContext);
  const startupRoute = resolveStartupRoute({ authStatus: status, gateContext });
  const shouldShowSessionPaywall = shouldShowSessionPaywallState({
    status,
    hasBackendUser,
    hasHydratedBootstrapState,
    onboardingDone,
    completedOnboardingThisSession,
    scanDraft,
    startupRoute,
    isPremium: entitlementState.isPremium,
    hasShownSessionPaywall
  });

  const refreshFromBackend = async () => {
    if (!appUserId) return;

    try {
      const [usage, entitlements, trialState, completed, dashboard] = await Promise.all([
        subscriptionsService.getUsageState(appUserId),
        subscriptionsService.getEntitlements(appUserId),
        subscriptionsService.startTrialEligibilityCheck(appUserId),
        onboardingService.isCompleted(appUserId),
        dashboardService.getHomeDashboard(appUserId)
      ]);

      setUsageState(usage);
      setEntitlementState(entitlements);
      setFreeTrialState(trialState);
      setOnboardingDone(completed);
      setHomeDashboard(dashboard);

      const nextCards = dashboard.collectionHighlights.map(toCardItemFromHighlight);
      const nextHistory = dashboard.recentScans.map(toCardItemFromRecentScan).filter(Boolean) as CardItem[];

      setCards((prev) => mergeCollectionCards(nextCards, prev));
      setHistory((prev) => mergeCardItemsById(prev, nextHistory));
      setHasHydratedBootstrapState(true);
      analyticsService.track(ANALYTICS_EVENTS.bootstrapHydrated, {
        isPremium: entitlements.isPremium,
        scansRemaining: usage.scansRemaining
      });
    } catch (error) {
      if (__DEV__) {
        console.log("[app_state] refresh_failed", error);
      }
      throw error;
    }
  };

  useEffect(() => {
    setHasHydratedBootstrapState(false);
    setHasShownSessionPaywall(false);
    setCompletedOnboardingThisSession(false);
  }, [appUserId]);

  useEffect(() => {
    if (!__DEV__) return;
    if (status !== "authenticated") return;
    console.log("[session_paywall]", {
      isPremium: entitlementState.isPremium,
      onboardingDone,
      onboardingPaywallSeen,
      completedOnboardingThisSession,
      startupRoute,
      hasHydratedBootstrapState,
      hasShownSessionPaywall,
      shouldShowSessionPaywall
    });
  }, [
    entitlementState.isPremium,
    onboardingDone,
    onboardingPaywallSeen,
    completedOnboardingThisSession,
    startupRoute,
    hasHydratedBootstrapState,
    hasShownSessionPaywall,
    shouldShowSessionPaywall,
    status
  ]);

  useEffect(() => {
    if (status !== "authenticated" || !appUserId) {
      return;
    }

    subscriptionsService
      .initializeBilling(appUserId)
      .then(() => subscriptionsService.refreshBillingState(appUserId))
      .catch((error) => {
        console.warn("Billing init/refresh skipped:", error);
      })
      .finally(() => {
        refreshFromBackend().catch((error) => {
          console.warn("Failed to refresh app state from backend:", error);
        });
      });
  }, [status, appUserId]);

  useEffect(() => {
    const subscription = RNAppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && status === "authenticated" && appUserId) {
        subscriptionsService
          .refreshBillingState(appUserId)
          .then(() => refreshFromBackend())
          .catch((error) => {
            console.warn("Failed to refresh billing on foreground:", error);
          });
      }
    });
    return () => subscription.remove();
  }, [status, appUserId]);

  const addCardToCollection = (id: string) => {
    const target = scanResultsById[id] ?? history.find((x) => x.id === id) ?? cards.find((x) => x.id === id);
    if (!target) {
      return { added: false, alreadyExists: false };
    }

    const targetKey = collectionFingerprint(target);
    const alreadyExists = cards.some((x) => collectionFingerprint(x) === targetKey);
    if (!alreadyExists) {
      setCards((prev) => mergeCollectionCards([target], prev));
    }

    void (async () => {
      if (!hasBackendUser) return;
      try {
        await collectionService.addItem({
          userId: appUserId as string,
          card: target,
          sourceScanId: (target.sourceScanId as string | undefined) ?? null
        });

        await refreshFromBackend();
      } catch (error) {
        console.warn("Failed to add collection item:", error);
      }
    })();

    if (!alreadyExists) {
      analyticsService.track(ANALYTICS_EVENTS.cardAddedToCollection, { cardId: id });
    }

    return { added: !alreadyExists, alreadyExists };
  };

  const addProcessedScanToCollection = async (scanId: string) => {
    if (!hasBackendUser) {
      return { added: false, alreadyExists: false };
    }

    await collectionService.addProcessedScanItem({
      userId: appUserId as string,
      scanId
    });
    await refreshFromBackend();
    return { added: true, alreadyExists: false };
  };

  const updateCollectionItem = async (
    collectionItemId: string,
    input: {
      notes?: string | null;
      isFavorite?: boolean;
      isAutograph?: boolean;
      isMemorabilia?: boolean;
      isParallel?: boolean;
      parallelName?: string | null;
      serialNumber?: string | null;
      isGraded?: boolean;
      gradingCompany?: string | null;
      grade?: string | null;
    }
  ) => {
    if (!hasBackendUser) return;
    await collectionService.updateItem(appUserId as string, collectionItemId, input);
    await refreshFromBackend();
  };

  const removeCollectionItem = async (collectionItemId: string) => {
    if (!hasBackendUser) return;
    await collectionService.removeItem(appUserId as string, collectionItemId);
    await refreshFromBackend();
  };

  const presentPaywall = (
    entryPoint: PaywallEntryPoint,
    options?: { cardId?: string; replace?: boolean }
  ): boolean => {
    if (entitlementState.isPremium && entryPoint !== "onboarding" && entryPoint !== "startup") {
      return false;
    }

    const key = `${entryPoint}:${options?.cardId ?? ""}:${options?.replace ? "replace" : "push"}`;
    const now = Date.now();
    if (shouldSuppressDuplicatePaywall(lastPaywallPresentationRef.current, key, now)) {
      return false;
    }
    lastPaywallPresentationRef.current = { key, at: now };

    const params = {
      source: entryPoint,
      ...(options?.cardId ? { cardId: options.cardId } : {})
    };
    if (options?.replace) {
      router.replace({ pathname: "/paywall", params });
    } else {
      router.push({ pathname: "/paywall", params });
    }

    analyticsService.track(ANALYTICS_EVENTS.paywallViewed, {
      source: analyticsLabelForPaywallEntryPoint(entryPoint),
      variant: entryPoint
    });
    if (__DEV__) {
      console.log("[paywall] present", {
        entryPoint,
        cardId: options?.cardId ?? null,
        replace: Boolean(options?.replace),
        isPremium: entitlementState.isPremium,
        hasShownSessionPaywall
      });
    }
    return true;
  };

  const startScanOrPaywall = (source: "home" | "tab" | "collection" | "history" = "tab") => {
    analyticsService.track(ANALYTICS_EVENTS.scanStarted, { source });
    if (__DEV__) {
      console.log("[scan_gate]", {
        source,
        isPremium: gateContext.entitlement.isPremium,
        scansRemaining: gateContext.usage.scansRemaining
      });
    }

    if (shouldShowPaywallForScans(gateContext)) {
      presentPaywall("scan_limit");
      return false;
    }
    return true;
  };

  const completeScan = (card: CardItem) => {
    const completedCard = { ...card, dateScanned: new Date().toISOString() };
    setHistory((prev) => [completedCard, ...prev]);
    setScanResultsById((prev) => ({ ...prev, [completedCard.id]: completedCard }));

    void (async () => {
      if (!hasBackendUser) return;
      try {
        const nextUsage = await subscriptionsService.incrementFreeScansUsed(appUserId as string, 1);
        setUsageState(nextUsage);
        await refreshFromBackend();
      } catch (error) {
        console.warn("Failed to update usage state:", error);
      }
    })();

    analyticsService.track(ANALYTICS_EVENTS.scanCompleted, { cardId: card.id });
  };

  const enterAiOrPaywall = (cardId?: string) => {
    analyticsService.track(ANALYTICS_EVENTS.aiChatOpened, {
      mode: cardId ? "card" : "general",
      hasCardContext: Boolean(cardId)
    });
    if (__DEV__) {
      console.log("[ai_gate]", {
        mode: cardId ? "card" : "general",
        isPremium: gateContext.entitlement.isPremium,
        cardId: cardId ?? null
      });
    }

    if (shouldShowPaywallForAI(gateContext)) {
      presentPaywall("ai_gate", cardId ? { cardId } : undefined);
      return false;
    }
    return true;
  };

  const loadPaywall = async (): Promise<PaywallViewModel> => {
    if (!appUserId) return { loading: false, unavailable: true, plans: [] };
    try {
      return await subscriptionsService.loadPaywall(appUserId);
    } catch (error) {
      if (__DEV__) console.log("[paywall] load_failed", error);
      return { loading: false, unavailable: true, plans: [] };
    }
  };

  const purchasePlan = async (packageId: string): Promise<PurchaseResult> => {
    if (!appUserId) return { status: "failed", message: "Missing user session." };
    const wasPremium = entitlementState.isPremium;
    const result = await subscriptionsService.purchasePackage(appUserId, packageId);
    if (result.status === "success") {
      if (!wasPremium) {
        analyticsService.track(ANALYTICS_EVENTS.subscriptionStarted, {
          source: "paywall",
          packageId,
          productId: result.snapshot.pro.productIdentifier ?? undefined
        });
      }
      if (result.snapshot.pro.periodType === "trial") {
        analyticsService.track(ANALYTICS_EVENTS.trialStarted, {
          source: "paywall",
          packageId,
          productId: result.snapshot.pro.productIdentifier ?? undefined
        });
      }
      await refreshFromBackend().catch((error) => {
        if (__DEV__) console.log("[paywall] purchase_refresh_failed", error);
      });
    }
    return result;
  };

  const restoreBilling = async (source = "settings"): Promise<RestoreResult> => {
    if (!appUserId) return { status: "failed", message: "Missing user session." };
    const result = await subscriptionsService.restorePurchases(appUserId);
    if (result.status === "restored") {
      analyticsService.track(ANALYTICS_EVENTS.subscriptionRestored, {
        source,
        productId: result.snapshot.pro.productIdentifier ?? undefined
      });
      await refreshFromBackend().catch((error) => {
        if (__DEV__) console.log("[paywall] restore_refresh_failed", error);
      });
    }
    return result;
  };

  const openManageSubscription = async (): Promise<boolean> => {
    if (!appUserId) return false;
    const url = await subscriptionsService.getManagementUrl(appUserId);
    if (!url) return false;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return false;
    await Linking.openURL(url);
    return true;
  };

  const clearLocalData = () => {
    setCards([]);
    setHistory([]);
    setScanResultsById({});
    setOnboardingDone(false);
    setOnboardingPaywallSeen(false);
    setOnboardingProfile({
      sports: [],
      goals: [],
      cardTypes: [],
      brands: []
    });
    setScanDraft({});
    const nextUsage = buildDefaultUsageState();
    const nextEntitlement = buildDefaultEntitlementState();
    const nextFreeTrial = buildDefaultFreeTrialState();
    setUsageState(nextUsage);
    setEntitlementState(nextEntitlement);
    setFreeTrialState(nextFreeTrial);
    setHomeDashboard(buildDefaultHomeDashboard("anonymous", nextUsage, nextEntitlement, nextFreeTrial));
    setHasHydratedBootstrapState(false);
    setHasShownSessionPaywall(false);
    analyticsService.reset();
  };

  const value = useMemo(
    () => ({
      cards,
      history,
      scanResultsById,
      scanCount: usageState.scansUsed,
      freeScansRemaining: usageState.scansRemaining,
      premium: entitlementState.isPremium,
      onboardingDone,
      onboardingPaywallSeen,
      onboardingProfile,
      usageState,
      entitlementState,
      freeTrialState,
      startupRoute,
      homeDashboard,
      scanDraft,
      setScanDraftImage: (side: "front" | "back", uri: string) =>
        setScanDraft((prev) => ({ ...prev, [`${side}Uri`]: uri })),
      clearScanDraft: () => setScanDraft({}),
      canUseScan,
      canUseAI: aiEnabled,
      saveOnboardingProfile: (partial: Partial<OnboardingProfile>) => {
        setOnboardingProfile((prev) => {
          const merged = { ...prev, ...partial };
          if (!hasBackendUser) return merged;
          void onboardingService.saveAnswers(appUserId as string, merged).catch((error) => {
            console.warn("Failed to persist onboarding answers:", error);
          });
          return merged;
        });
      },
      addCardToCollection,
      addProcessedScanToCollection,
      updateCollectionItem,
      removeCollectionItem,
      presentPaywall,
      startScanOrPaywall,
      completeScan,
      enterAiOrPaywall,
      loadPaywall,
      purchasePlan,
      restoreBilling,
      openManageSubscription,
      completeOnboarding: () => {
        setOnboardingDone(true);
        setCompletedOnboardingThisSession(true);
        if (!hasBackendUser) return;
        void onboardingService.markCompleted(appUserId as string).catch((error) => {
          console.warn("Failed to mark onboarding complete:", error);
        });
        analyticsService.track(ANALYTICS_EVENTS.onboardingCompleted);
      },
      dismissOnboardingPaywall: () => setOnboardingPaywallSeen(true),
      shouldShowSessionPaywall,
      consumeSessionPaywallTrigger: () => {
        if (!shouldShowSessionPaywall) return false;
        setHasShownSessionPaywall(true);
        return true;
      },
      clearLocalData,
      refreshFromBackend
    }),
    [
      cards,
      history,
      scanResultsById,
      usageState,
      entitlementState,
      onboardingDone,
      onboardingPaywallSeen,
      onboardingProfile,
      freeTrialState,
      startupRoute,
      homeDashboard,
      scanDraft,
      canUseScan,
      aiEnabled,
      loadPaywall,
      purchasePlan,
      restoreBilling,
      openManageSubscription,
      addProcessedScanToCollection,
      updateCollectionItem,
      removeCollectionItem,
      presentPaywall,
      clearLocalData,
      appUserId,
      hasBackendUser,
      shouldShowSessionPaywall
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return ctx;
}
