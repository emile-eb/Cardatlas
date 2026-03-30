import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingPaywallFlow } from "@/components/paywall/OnboardingPaywallFlow";
import { OnboardingPaywallPlanSelector } from "@/components/paywall/onboarding/OnboardingPaywallPlanSelector";
import { useAppState } from "@/state/AppState";
import { PaywallFooterLinks } from "@/components/paywall/PaywallFooterLinks";
import {
  analyticsLabelForPaywallEntryPoint,
  resolvePaywallEntryPoint,
  resolvePaywallVariant
} from "@/features/paywall/paywallVariants";
import type { PaywallPlanViewModel } from "@/types";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { standardTopInset } from "@/theme/safeArea";
import { layout, shadows, typography } from "@/theme/tokens";
import { orderPlans } from "@/components/paywall/PaywallPlanSelector";

function preferredPlan(plans: PaywallPlanViewModel[]): PaywallPlanViewModel | null {
  return plans.find((plan) => plan.isRecommended) ?? plans[0] ?? null;
}

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ source?: string; cardId?: string }>();
  const insets = useSafeAreaInsets();
  const {
    dismissOnboardingPaywall,
    loadPaywall,
    purchasePlan,
    restoreBilling,
    premium
  } = useAppState();

  const entryPoint = resolvePaywallEntryPoint(params.source);
  const variantKey = resolvePaywallVariant(params.source);
  const fromOnboarding = entryPoint === "onboarding" || entryPoint === "startup";

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PaywallPlanViewModel[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [wantsFreeTrial, setWantsFreeTrial] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const pageEntrance = useRef(new Animated.Value(0)).current;

  const trialToggleEnabled = useMemo(() => {
    const trialCount = plans.filter((plan) => plan.hasTrial).length;
    const noTrialCount = plans.filter((plan) => !plan.hasTrial).length;
    return trialCount > 0 && noTrialCount > 0;
  }, [plans]);

  const visiblePlans = useMemo(() => {
    if (!trialToggleEnabled) return plans;
    const filtered = plans.filter((plan) => Boolean(plan.hasTrial) === wantsFreeTrial);
    return filtered.length > 0 ? filtered : plans;
  }, [plans, trialToggleEnabled, wantsFreeTrial]);

  const selectedPlan = useMemo(
    () => visiblePlans.find((plan) => plan.packageId === selectedPackageId) ?? visiblePlans[0] ?? null,
    [visiblePlans, selectedPackageId]
  );

  useEffect(() => {
    pageEntrance.setValue(0);
    Animated.timing(pageEntrance, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true
    }).start();
  }, [pageEntrance, variantKey]);

  useEffect(() => {
    setLoading(true);
    setStatusText(null);

    loadPaywall()
      .then((model) => {
        const ordered = orderPlans(model.plans ?? []);
        setPlans(ordered);
        const trialRecommended = preferredPlan(ordered.filter((plan) => plan.hasTrial));
        const recommended = preferredPlan(ordered);
        setSelectedPackageId(trialRecommended?.packageId ?? recommended?.packageId ?? null);
      })
      .catch((error) => {
        setPlans([]);
        setSelectedPackageId(null);
        const message = error instanceof Error ? error.message : "Unable to load plans right now.";
        setStatusText(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [entryPoint, loadPaywall]);

  useEffect(() => {
    if (visiblePlans.length === 0) {
      setSelectedPackageId(null);
      return;
    }
    if (selectedPackageId && visiblePlans.some((plan) => plan.packageId === selectedPackageId)) return;
    const recommended = preferredPlan(visiblePlans);
    setSelectedPackageId(recommended?.packageId ?? visiblePlans[0]?.packageId ?? null);
  }, [selectedPackageId, visiblePlans]);

  useEffect(() => {
    if (!premium) return;
    if (params.cardId) {
      router.replace(`/chat/${params.cardId}`);
      return;
    }
    if (entryPoint === "ai_gate" && !params.cardId) {
      router.replace("/chat/general");
      return;
    }
    router.replace("/(tabs)/home");
  }, [entryPoint, params.cardId, premium]);

  useEffect(() => {
    if (!__DEV__) return;
    console.log("[paywall] state", {
      entryPoint,
      variantKey,
      isPremium: premium,
      planCount: plans.length,
      selectedPackageId,
      hasTrial: selectedPlan?.hasTrial ?? null
    });
  }, [entryPoint, variantKey, premium, plans.length, selectedPackageId, selectedPlan?.hasTrial]);

  const closePaywall = () => {
    analyticsService.track(ANALYTICS_EVENTS.paywallDismissed, {
      source: analyticsLabelForPaywallEntryPoint(entryPoint),
      variant: variantKey
    });
    if (fromOnboarding) {
      dismissOnboardingPaywall();
      router.replace("/(tabs)/home");
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/home");
  };

  const handlePurchase = async () => {
    if (!selectedPlan) {
      setStatusText("No plans are currently available.");
      return;
    }

    setBusy(true);
    setStatusText(null);
    analyticsService.track(ANALYTICS_EVENTS.paywallPurchaseStarted, {
      source: analyticsLabelForPaywallEntryPoint(entryPoint),
      variant: variantKey,
      packageId: selectedPlan.packageId,
      productId: selectedPlan.productId,
      billingPeriod: selectedPlan.billingPeriod ?? "unknown",
      hasTrial: Boolean(selectedPlan.hasTrial)
    });

    const result = await purchasePlan(selectedPlan.packageId);

    setBusy(false);
    if (result.status === "success") {
      setStatusText("Pro unlocked.");
      if (__DEV__) {
        console.log("[paywall] purchase_success", {
          entryPoint,
          variantKey,
          packageId: selectedPlan.packageId,
          productId: selectedPlan.productId
        });
      }
      return;
    }
    if (result.status === "cancelled") {
      setStatusText("Purchase cancelled.");
      return;
    }

    analyticsService.track(ANALYTICS_EVENTS.paywallPurchaseFailed, {
      source: analyticsLabelForPaywallEntryPoint(entryPoint),
      variant: variantKey,
      packageId: selectedPlan.packageId,
      productId: selectedPlan.productId
    });
    setStatusText(result.message);
  };

  const handleRestore = async () => {
    setBusy(true);
    setStatusText(null);

    const result = await restoreBilling(analyticsLabelForPaywallEntryPoint(entryPoint));

    setBusy(false);
    if (result.status === "restored") {
      setStatusText("Purchases restored.");
      return;
    }
    if (result.status === "no_purchases") {
      setStatusText("No purchases found.");
      return;
    }

    analyticsService.track(ANALYTICS_EVENTS.paywallRestoreFailed, {
      source: analyticsLabelForPaywallEntryPoint(entryPoint),
      variant: variantKey
    });
    setStatusText(result.message);
  };

  const pageStyle = {
    opacity: pageEntrance,
    transform: [
      {
        translateY: pageEntrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] })
      }
    ]
  };

  if (entryPoint === "onboarding") {
    return (
      <OnboardingPaywallFlow
        loading={loading}
        plans={visiblePlans}
        selectedPackageId={selectedPackageId}
        onSelectPackage={setSelectedPackageId}
        selectedPlan={selectedPlan}
        trialToggleEnabled={trialToggleEnabled}
        wantsFreeTrial={wantsFreeTrial}
        onChangeTrialMode={setWantsFreeTrial}
        busy={busy}
        statusText={statusText}
        onPurchase={handlePurchase}
        onRestore={handleRestore}
        onClose={closePaywall}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={["#FEFDFC", "#FFFFFF", "#F8F9FB"]} locations={[0, 0.42, 1]} style={styles.background}>
      <Animated.View style={[styles.page, pageStyle]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(insets.bottom + 18, 30)
            }
          ]}
        >
          <View style={[styles.topBar, { paddingTop: standardTopInset(insets.top) + layout.pagePadding }]}>
            <View style={styles.navSpacer} />
            <Pressable onPress={closePaywall} style={styles.closeButton}>
              <Ionicons name="close" size={18} color="#151B24" />
            </Pressable>
          </View>

          <View style={styles.stepWrap}>
            <View style={styles.step}>
              <View style={styles.pricingHeader}>
                <Text style={styles.pricingHeadline}>
                  {selectedPlan?.hasTrial ? "Start your 3-day FREE trial to continue" : "Choose your plan to continue"}
                </Text>
              </View>

              <OnboardingPaywallPlanSelector
                loading={loading}
                plans={visiblePlans}
                selectedPackageId={selectedPackageId}
                onSelect={setSelectedPackageId}
                selectedPlan={selectedPlan}
                trialToggleEnabled={trialToggleEnabled}
                wantsFreeTrial={wantsFreeTrial}
                onChangeTrialMode={setWantsFreeTrial}
                busy={busy}
                statusText={statusText}
                onPurchase={handlePurchase}
              />

              <PaywallFooterLinks
                onRestore={handleRestore}
                restoreBusy={busy}
                tone="light"
                showLegal={false}
              />
            </View>
          </View>
        </ScrollView>
      </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  background: {
    flex: 1
  },
  page: {
    flex: 1
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 6
  },
  navSpacer: {
    width: 36,
    height: 36
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(20,27,37,0.08)",
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.cardShadow
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 30
  },
  stepWrap: {
    flex: 1
  },
  step: {
    flex: 1,
    minHeight: "100%"
  },
  pricingHeader: {
    paddingTop: 26,
    gap: 10,
    alignItems: "center"
  },
  pricingHeadline: {
    ...typography.H1,
    color: "#10161F",
    fontFamily: "Inter-Bold",
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.7,
    textAlign: "center"
  }
});
