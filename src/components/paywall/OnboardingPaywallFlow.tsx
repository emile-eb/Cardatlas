import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingPaywallCTA } from "@/components/paywall/onboarding/OnboardingPaywallCTA";
import { OnboardingPaywallHeroPlaceholder } from "@/components/paywall/onboarding/OnboardingPaywallHeroPlaceholder";
import { OnboardingPaywallPlanSelector } from "@/components/paywall/onboarding/OnboardingPaywallPlanSelector";
import type { PaywallPlanViewModel } from "@/types";
import { standardTopInset } from "@/theme/safeArea";
import { layout, typography } from "@/theme/tokens";

type OnboardingPaywallFlowProps = {
  loading: boolean;
  plans: PaywallPlanViewModel[];
  selectedPackageId: string | null;
  onSelectPackage: (packageId: string) => void;
  selectedPlan: PaywallPlanViewModel | null;
  busy: boolean;
  statusText?: string | null;
  onPurchase: () => void;
  onRestore: () => void;
  onClose: () => void;
};

function OnboardingPaywallStepOne({
  heroHeight,
  stepIndex,
  onContinue
}: {
  heroHeight: number;
  stepIndex: number;
  onContinue: () => void;
}) {
  return (
    <View style={styles.step}>
      <OnboardingPaywallHeroPlaceholder variant="product" minHeight={heroHeight} />

      <View style={styles.copyBlock}>
        <Text style={styles.eyebrow}>CARDATLAS PRO</Text>
        <Text style={styles.heroHeadline}>Unlock Unlimited Card Scans</Text>
        <Text style={styles.heroSubheadline}>
          Scan cards, reveal rarity, and instantly understand what you&apos;re holding.
        </Text>
      </View>
      <OnboardingPaywallProgress stepIndex={stepIndex} />
      <OnboardingPaywallCTA title="Continue" onPress={onContinue} />
    </View>
  );
}

function OnboardingPaywallStepTwo({
  heroHeight,
  stepIndex,
  onContinue
}: {
  heroHeight: number;
  stepIndex: number;
  onContinue: () => void;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.trustCopyWrap}>
        <Text style={styles.heroHeadline}>
          We&apos;ll <Text style={styles.heroHeadlineAccent}>remind</Text> you before your trial ends
        </Text>
      </View>

      <View style={styles.fullBleedHero}>
        <OnboardingPaywallHeroPlaceholder variant="trust" minHeight={heroHeight} />
      </View>

      <View style={styles.reassuranceRow}>
        <View style={styles.reassuranceDot} />
        <Text style={styles.reassuranceText}>No payment due now</Text>
      </View>

      <OnboardingPaywallProgress stepIndex={stepIndex} />
      <OnboardingPaywallCTA
        title="Continue"
        onPress={onContinue}
        caption="Cancel before renewal in your account settings."
      />
    </View>
  );
}

function OnboardingPaywallProgress({ stepIndex }: { stepIndex: number }) {
  return (
    <View style={styles.progressDotsRow}>
      {[0, 1, 2].map((dotIndex) => (
        <View
          key={dotIndex}
          style={[
            styles.progressDot,
            dotIndex === stepIndex ? styles.progressDotActive : styles.progressDotInactive
          ]}
        />
      ))}
    </View>
  );
}

function OnboardingPaywallStepThree({
  loading,
  plans,
  selectedPackageId,
  onSelectPackage,
  selectedPlan,
  busy,
  statusText,
  onPurchase,
  onRestore
}: Omit<OnboardingPaywallFlowProps, "onClose">) {
  return (
    <View style={styles.step}>
      <View style={styles.pricingHeader}>
        <Text style={styles.pricingHeadline}>Start your 3-day FREE trial to continue</Text>
      </View>

      <OnboardingPaywallPlanSelector
        loading={loading}
        plans={plans}
        selectedPackageId={selectedPackageId}
        onSelect={onSelectPackage}
        selectedPlan={selectedPlan}
        busy={busy}
        statusText={statusText}
        onPurchase={onPurchase}
      />
    </View>
  );
}

export function OnboardingPaywallFlow({
  loading,
  plans,
  selectedPackageId,
  onSelectPackage,
  selectedPlan,
  busy,
  statusText,
  onPurchase,
  onRestore,
  onClose
}: OnboardingPaywallFlowProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [stepIndex, setStepIndex] = useState(0);
  const transition = useRef(new Animated.Value(1)).current;

  const heroHeight = useMemo(() => Math.max(320, Math.round(height * 0.46)), [height]);

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true
    }).start();
  }, [stepIndex, transition]);

  const advance = () => {
    setStepIndex((current) => Math.min(current + 1, 2));
  };
  const goBack = () => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const animatedStepStyle = {
    opacity: transition,
    transform: [
      {
        translateX: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [26, 0]
        })
      }
    ]
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={["#FEFDFC", "#FFFFFF", "#F8F9FB"]} locations={[0, 0.42, 1]} style={styles.background}>
        <View style={[styles.topBar, { paddingTop: standardTopInset(insets.top) + layout.pagePadding }]}>
          <Pressable onPress={goBack} style={styles.navButton} disabled={stepIndex === 0}>
            <Ionicons
              name="chevron-back"
              size={18}
              color={stepIndex === 0 ? "rgba(21,27,36,0.28)" : "#151B24"}
            />
          </Pressable>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={18} color="#151B24" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View style={[styles.stepWrap, animatedStepStyle]}>
            {stepIndex === 0 ? (
              <OnboardingPaywallStepOne heroHeight={heroHeight} stepIndex={stepIndex} onContinue={advance} />
            ) : null}
            {stepIndex === 1 ? (
              <OnboardingPaywallStepTwo
                heroHeight={Math.max(280, heroHeight - 24)}
                stepIndex={stepIndex}
                onContinue={advance}
              />
            ) : null}
            {stepIndex === 2 ? (
              <OnboardingPaywallStepThree
                loading={loading}
                plans={plans}
                selectedPackageId={selectedPackageId}
                onSelectPackage={onSelectPackage}
                selectedPlan={selectedPlan}
                busy={busy}
                statusText={statusText}
                onPurchase={onPurchase}
                onRestore={onRestore}
              />
            ) : null}
          </Animated.View>
        </ScrollView>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 6
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(20,27,37,0.08)"
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(20,27,37,0.08)"
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
  copyBlock: {
    marginTop: 112,
    gap: 10
  },
  trustCopyWrap: {
    paddingTop: 28,
    paddingBottom: 24,
    gap: 10,
    alignItems: "flex-start"
  },
  fullBleedHero: {
    marginHorizontal: -22
  },
  eyebrow: {
    ...typography.Caption,
    color: "#A43D33",
    fontFamily: "Inter-SemiBold",
    letterSpacing: 0.7
  },
  heroHeadline: {
    ...typography.H1,
    color: "#10161F",
    fontFamily: "Inter-Bold",
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -0.8
  },
  heroHeadlineAccent: {
    color: "#C13E34"
  },
  heroSubheadline: {
    ...typography.BodyMedium,
    color: "#5B6473",
    fontSize: 17,
    lineHeight: 24
  },
  reassuranceRow: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  reassuranceDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#C13E34"
  },
  reassuranceText: {
    ...typography.BodyMedium,
    color: "#4E5868",
    fontFamily: "Inter-Medium"
  },
  progressDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: "auto",
    marginBottom: 10,
    paddingTop: 18
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  progressDotActive: {
    backgroundColor: "#C13E34"
  },
  progressDotInactive: {
    backgroundColor: "rgba(16,22,31,0.14)"
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
