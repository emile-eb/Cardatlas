import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingPaywallFlow } from "@/components/paywall/OnboardingPaywallFlow";
import { useAppState } from "@/state/AppState";
import { PaywallHero } from "@/components/paywall/PaywallHero";
import { PaywallPlanSelector, orderPlans } from "@/components/paywall/PaywallPlanSelector";
import { PaywallCTA } from "@/components/paywall/PaywallCTA";
import { PaywallFooterLinks } from "@/components/paywall/PaywallFooterLinks";
import {
  PAYWALL_VARIANTS,
  analyticsLabelForPaywallEntryPoint,
  resolvePaywallEntryPoint,
  resolvePaywallVariant
} from "@/features/paywall/paywallVariants";
import { colors } from "@/theme/tokens";
import type { PaywallPlanViewModel } from "@/types";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { InlineLoadingState } from "@/components/loading/InlineLoadingState";

function preferredPlan(plans: PaywallPlanViewModel[]): PaywallPlanViewModel | null {
  return plans.find((plan) => plan.isRecommended) ?? plans[0] ?? null;
}

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ source?: string; cardId?: string }>();
  const { height } = useWindowDimensions();
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
  const variant = PAYWALL_VARIANTS[variantKey];
  const fromOnboarding = entryPoint === "onboarding" || entryPoint === "startup";

  const heroHeight = useMemo(() => Math.max(320, Math.round(height * 0.58)), [height]);

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PaywallPlanViewModel[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const heroFade = useRef(new Animated.Value(0)).current;
  const sheetEntrance = useRef(new Animated.Value(0)).current;

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.packageId === selectedPackageId) ?? plans[0] ?? null,
    [plans, selectedPackageId]
  );
  const trialMessage = selectedPlan?.hasTrial
    ? selectedPlan.trialLabel ?? "Free trial included with this plan."
    : selectedPlan
      ? `No free trial on the ${selectedPlan.title.toLowerCase()} plan.`
      : null;

  useEffect(() => {
    heroFade.setValue(0);
    sheetEntrance.setValue(0);
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(sheetEntrance, {
        toValue: 1,
        duration: 280,
        delay: 60,
        useNativeDriver: true
      })
    ]).start();
  }, [heroFade, sheetEntrance, variantKey]);

  useEffect(() => {
    setLoading(true);
    setStatusText(null);

    loadPaywall()
      .then((model) => {
        const ordered = orderPlans(model.plans ?? []);
        setPlans(ordered);
        const recommended = preferredPlan(ordered);
        setSelectedPackageId(recommended?.packageId ?? null);
      })
      .catch((error) => {
        setPlans([]);
        setSelectedPackageId(null);
        setStatusText(error instanceof Error ? error.message : "Unable to load plans right now.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loadPaywall]);

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

  const sheetStyle = {
    opacity: sheetEntrance,
    transform: [
      {
        translateY: sheetEntrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] })
      }
    ]
  };

  if (entryPoint === "onboarding") {
    return (
      <OnboardingPaywallFlow
        loading={loading}
        plans={plans}
        selectedPackageId={selectedPackageId}
        onSelectPackage={setSelectedPackageId}
        selectedPlan={selectedPlan}
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
      <Animated.View style={[styles.heroSection, { height: heroHeight, opacity: heroFade }]}>
        <PaywallHero variant={variant} onClose={closePaywall} />
      </Animated.View>

      <Animated.View style={[styles.contentSection, sheetStyle]}>
        <LinearGradient
          colors={["rgba(7,10,16,0.06)", "rgba(10,14,22,0.80)", "rgba(10,14,22,0.96)"]}
          locations={[0, 0.36, 1]}
          style={styles.contentSurface}
        >
            <ScrollView
              contentContainerStyle={[styles.contentScroll, { paddingBottom: Math.max(insets.bottom + 18, 30) }]}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.trialPill}>
                <View style={styles.trialCopyWrap}>
                  <Text style={styles.trialPillText}>
                    {selectedPlan?.hasTrial ? "Free trial available" : "Trial availability"}
                  </Text>
                  <Text style={styles.trialPillSubtext}>
                    {trialMessage ?? "Select a plan to see trial details."}
                  </Text>
                </View>
                <View style={[styles.trialStateBadge, selectedPlan?.hasTrial ? styles.trialStateBadgeOn : styles.trialStateBadgeOff]}>
                  <Text style={[styles.trialStateText, selectedPlan?.hasTrial ? styles.trialStateTextOn : styles.trialStateTextOff]}>
                    {selectedPlan?.hasTrial ? "Included" : "None"}
                  </Text>
                </View>
              </View>

              <View style={styles.planBlock}>
                <Text style={styles.planLabel}>Choose your plan</Text>
              {loading ? (
                <InlineLoadingState
                  tone="dark"
                  title="Loading live plans"
                  message="Preparing your current CardAtlas Pro options."
                  minHeight={108}
                />
              ) : plans.length === 0 ? (
                <InlineLoadingState
                  tone="dark"
                  title="Plans unavailable"
                  message="We couldn't load pricing right now. Try again shortly."
                  minHeight={108}
                />
              ) : (
                <PaywallPlanSelector
                  plans={plans}
                  selectedPackageId={selectedPackageId}
                  onSelect={setSelectedPackageId}
                  disabled={busy}
                />
              )}
            </View>

            <PaywallCTA selectedPlan={selectedPlan} busy={busy} statusText={statusText} onPurchase={handlePurchase} />
            <PaywallFooterLinks onRestore={handleRestore} restoreBusy={busy} />
          </ScrollView>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#070A11"
  },
  heroSection: {
    position: "relative"
  },
  contentSection: {
    flex: 1,
    marginTop: -26,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10
  },
  contentSurface: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#0D121B",
    borderTopWidth: 1,
    borderTopColor: "rgba(225,232,244,0.14)"
  },
  contentScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30
  },
  planBlock: {
    marginTop: 12,
    gap: 9
  },
  trialPill: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(227,235,247,0.18)",
    backgroundColor: "rgba(18,24,38,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  trialCopyWrap: {
    flex: 1,
    paddingRight: 12
  },
  trialPillText: {
    color: "#E9EFF9",
    fontSize: 13,
    fontFamily: "Inter-Medium"
  },
  trialPillSubtext: {
    color: "#A5B0C2",
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
    fontFamily: "Inter-Regular"
  },
  trialStateBadge: {
    minWidth: 64,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  trialStateBadgeOn: {
    backgroundColor: "rgba(225,6,0,0.14)",
    borderColor: "rgba(225,6,0,0.34)"
  },
  trialStateBadgeOff: {
    backgroundColor: "#121826",
    borderColor: "rgba(238,244,255,0.16)"
  },
  trialStateText: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold"
  },
  trialStateTextOn: {
    color: "#FFD7D4"
  },
  trialStateTextOff: {
    color: "#A5B0C2"
  },
  planLabel: {
    color: "#DEE4EF",
    fontSize: 13,
    fontFamily: "Inter-Medium"
  },
});
