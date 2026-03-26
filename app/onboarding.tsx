import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onboardingSteps } from "@/data/onboardingQuestions";
import { useAppState } from "@/state/AppState";
import { guidedFlowBodyTopInset, standardTopInset } from "@/theme/safeArea";
import { colors, layout, spacing, typography } from "@/theme/tokens";
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress";
import { QuestionOption } from "@/components/onboarding/QuestionOption";
import { MultiSelectOption } from "@/components/onboarding/MultiSelectOption";
import { OnboardingFooterCTA } from "@/components/onboarding/OnboardingFooterCTA";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { useAppPreferences } from "@/features/settings/AppPreferencesProvider";
import { useNotifications } from "@/features/notifications/NotificationsProvider";

type AnswerMap = Record<string, string[]>;

function applyAnswerToProfile(stepId: string, values: string[]) {
  if (stepId === "collectorType") return { collectorType: values[0] };
  if (stepId === "sports") return { sports: values };
  if (stepId === "goals") return { goals: values };
  if (stepId === "collectionSize") return { collectionSize: values[0] };
  if (stepId === "cardTypes") return { cardTypes: values };
  if (stepId === "brands") return { brands: values };
  if (stepId === "alerts") return { alerts: values[0] };
  return {};
}

function shouldRequestNotifications(alertsAnswer?: string) {
  return Boolean(alertsAnswer && alertsAnswer !== "No alerts for now");
}

function IntroScanGraphic() {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  const scanLineStyle = {
    transform: [
      {
        translateY: scanAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-44, 44]
        })
      }
    ],
    opacity: scanAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.35, 0.75, 0.35]
    })
  };

  return (
    <View style={styles.scanGraphicWrap}>
      <View style={styles.scanCard}>
        <Animated.View style={[styles.scanLine, scanLineStyle]} />
      </View>
      <View style={[styles.bracket, styles.bracketTL]} />
      <View style={[styles.bracket, styles.bracketTR]} />
      <View style={[styles.bracket, styles.bracketBL]} />
      <View style={[styles.bracket, styles.bracketBR]} />
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const {
    completeOnboarding,
    saveOnboardingProfile,
    onboardingProfile,
    presentPaywall
  } = useAppState();
  const {
    setNotificationsEnabled,
    setMarketActivityEnabled,
    setCollectionUpdatesEnabled,
    setRemindersEnabled,
    setHasPromptedForNotifications
  } = useAppPreferences();
  const { requestPermissionInContext } = useNotifications();

  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({
    collectorType: onboardingProfile.collectorType ? [onboardingProfile.collectorType] : [],
    sports: onboardingProfile.sports,
    goals: onboardingProfile.goals,
    collectionSize: onboardingProfile.collectionSize ? [onboardingProfile.collectionSize] : [],
    cardTypes: onboardingProfile.cardTypes,
    brands: onboardingProfile.brands,
    alerts: onboardingProfile.alerts ? [onboardingProfile.alerts] : []
  });

  const introStep = onboardingSteps.find((s) => s.id === "intro")!;
  const flowSteps = onboardingSteps.filter((s) => s.id !== "intro");
  const step = started ? flowSteps[index] : introStep;
  const isIntro = !started;
  const isLastFlowStep = started && index === flowSteps.length - 1;
  const transition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [index, started, transition]);

  const selected = answers[step.id] ?? [];
  const requiresAnswer = step.type === "single" || step.type === "multi";
  const canContinue = !requiresAnswer || selected.length > 0;

  const animatedStepStyle = {
    opacity: transition,
    transform: [
      {
        translateY: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0]
        })
      }
    ]
  };

  const icon = useMemo(() => {
    if (step.type === "intro") return <IntroScanGraphic />;
    return null;
  }, [step.type]);

  const onSelectOption = (option: string) => {
    setAnswers((prev) => {
      const current = prev[step.id] ?? [];
      if (step.type === "single") {
        return { ...prev, [step.id]: [option] };
      }
      if (step.type === "multi") {
        const next = current.includes(option) ? current.filter((x) => x !== option) : [...current, option];
        return { ...prev, [step.id]: next };
      }
      return prev;
    });
  };

  const onContinue = async () => {
    if (!canContinue) return;

    if (!started) {
      analyticsService.track(ANALYTICS_EVENTS.onboardingStarted);
      setStarted(true);
      setIndex(0);
      return;
    }

    if (requiresAnswer) {
      saveOnboardingProfile(applyAnswerToProfile(step.id, selected));
    }

    if (isLastFlowStep) {
      const alertsAnswer = step.id === "alerts" ? selected[0] : undefined;
      if (shouldRequestNotifications(alertsAnswer)) {
        await setNotificationsEnabled(true);
        await setMarketActivityEnabled(true);
        await setCollectionUpdatesEnabled(true);
        await setRemindersEnabled(true);
        const permission = await requestPermissionInContext("onboarding");
        if (permission !== "granted") {
          await setNotificationsEnabled(false);
        }
      } else if (step.id === "alerts") {
        await setNotificationsEnabled(false);
        await setHasPromptedForNotifications(true);
      }

      completeOnboarding();
      presentPaywall("onboarding", { replace: true });
      return;
    }

    setIndex((prev) => Math.min(prev + 1, flowSteps.length - 1));
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: standardTopInset(insets.top) + layout.pagePadding }]}>
        {started ? (
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              if (index === 0) {
                setStarted(false);
                return;
              }
              setIndex((prev) => Math.max(prev - 1, 0));
            }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View style={styles.progressWrap}>
          {started ? (
            <OnboardingProgress current={index + 1} total={flowSteps.length} showStepText={false} />
          ) : (
            <View style={styles.progressHidden} />
          )}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingTop: guidedFlowBodyTopInset(insets.top) },
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
          isIntro && styles.bodyContentIntro
        ]}
      >
        <Animated.View
          style={[
            styles.stepContent,
            isIntro && styles.stepContentIntro,
            animatedStepStyle
          ]}
        >
          <Text style={[styles.title, isIntro && styles.titleIntro]}>{step.title}</Text>
          {step.subtitle ? <Text style={[styles.subtitle, isIntro && styles.subtitleIntro]}>{step.subtitle}</Text> : null}
          {step.helper ? <Text style={styles.helper}>{step.helper}</Text> : null}
          {step.type === "intro" && icon ? (
            <View style={[styles.heroIconWrap, isIntro && styles.heroIconWrapIntro]}>{icon}</View>
          ) : null}

          {step.options?.length ? (
            <View style={styles.optionsArea}>
              <View style={styles.optionsWrap}>
                {step.options.map((option) => {
                  const isSelected = selected.includes(option);
                  if (step.type === "multi") {
                    return (
                      <MultiSelectOption
                        key={option}
                        label={option}
                        selected={isSelected}
                        onPress={() => onSelectOption(option)}
                      />
                    );
                  }
                  return (
                    <QuestionOption
                      key={option}
                      label={option}
                      selected={isSelected}
                      onPress={() => onSelectOption(option)}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <OnboardingFooterCTA label={step.ctaLabel} disabled={!canContinue} onPress={onContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary
  },
  topBar: {
    paddingHorizontal: layout.pagePadding,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  backBtn: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    borderRadius: 20,
    backgroundColor: "#FCFCFC"
  },
  backSpacer: {
    width: 80,
    height: 40
  },
  progressWrap: {
    flex: 1
  },
  progressHidden: {
    height: 4
  },
  body: {
    flex: 1
  },
  bodyContent: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl
  },
  bodyContentIntro: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.md
  },
  stepContent: {
    gap: spacing.md
  },
  stepContentIntro: {
    alignItems: "center",
    gap: spacing.lg
  },
  heroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "#F2D0CD",
    backgroundColor: "#FFF7F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs
  },
  heroIconWrapIntro: {
    width: "100%",
    height: 170,
    borderWidth: 0,
    backgroundColor: "transparent",
    marginBottom: 0
  },
  scanGraphicWrap: {
    width: 160,
    height: 176,
    alignItems: "center",
    justifyContent: "center"
  },
  scanCard: {
    width: 124,
    height: 148,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D9D9D9",
    backgroundColor: "#FCFCFC",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  scanLine: {
    width: 96,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentPrimary
  },
  bracket: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: colors.accentPrimary
  },
  bracketTL: {
    left: 8,
    top: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 6
  },
  bracketTR: {
    right: 8,
    top: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 6
  },
  bracketBL: {
    left: 8,
    bottom: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 6
  },
  bracketBR: {
    right: 8,
    bottom: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 6
  },
  title: {
    ...typography.H1,
    fontSize: 30,
    lineHeight: 34,
    fontFamily: "Inter-SemiBold"
  },
  titleIntro: {
    textAlign: "center"
  },
  subtitle: {
    ...typography.BodyLarge,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: 2
  },
  subtitleIntro: {
    textAlign: "center",
    maxWidth: 320
  },
  helper: {
    ...typography.Caption,
    color: colors.textSecondary,
    fontFamily: "Inter-Medium",
    marginTop: -4
  },
  optionsArea: {
    width: "100%"
  },
  optionsWrap: {
    marginTop: spacing.sm,
    gap: spacing.sm
  }
});
