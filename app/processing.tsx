import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppState } from "@/state/AppState";
import { guidedFlowTopInset } from "@/theme/safeArea";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";
import { scansService } from "@/services/scans/ScansService";
import { scanProcessingService } from "@/services/scans/ScanProcessingService";
import { useAuth } from "@/features/auth";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useScanStatusPolling } from "@/hooks/useScanStatusPolling";
import { subscriptionsService } from "@/services/subscriptions/SubscriptionsService";

const ANALYSIS_STEPS = [
  "Detecting card edges",
  "Reading printed details",
  "Matching collector database",
  "Searching market activity",
  "Determining rarity tier",
  "Preparing collector results"
] as const;

const MIN_ANALYSIS_EXPERIENCE_MS = 1200;
const PROCESSING_TIMEOUT_MS = 45000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function formatScanError(message?: string | null, fallback = "We couldn’t finish analyzing this card. Please try again."): string {
  const normalized = `${message ?? ""}`.trim();
  if (!normalized) return fallback;
  if (/session/i.test(normalized)) return "Your session expired before analysis finished. Please try again.";
  if (/front and back/i.test(normalized)) return "Capture both sides of the card before starting analysis.";
  if (/upload/i.test(normalized)) return "We couldn’t upload your card photos. Please try again.";
  if (/poll/i.test(normalized) || /timeout/i.test(normalized)) return "Analysis is taking longer than expected. Please try again.";
  return normalized;
}

export default function ProcessingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ source?: string; scanId?: string }>();
  const { scanDraft, clearScanDraft, refreshFromBackend } = useAppState();
  const { session } = useAuth();
  const [scanId, setScanId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [targetStep, setTargetStep] = useState(0);
  const [visibleStep, setVisibleStep] = useState(0);
  const [attemptKey, setAttemptKey] = useState(0);
  const startedAtRef = useRef(Date.now());
  const hasNavigatedRef = useRef(false);
  const cardEnter = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const scanLineProgress = useRef(new Animated.Value(0)).current;

  const frontUri = scanDraft.frontUri;
  const backUri = scanDraft.backUri;
  const requestedScanId = typeof params.scanId === "string" ? params.scanId : null;
  const processingSource = typeof params.source === "string" ? params.source : "unknown";
  const { status, error: pollingError } = useScanStatusPolling(scanId, Boolean(scanId), 1200);
  const scanLineTranslateY = scanLineProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 242]
  });

  useEffect(() => {
    cardEnter.setValue(0);
    scanLineProgress.setValue(0);
    const animations = Animated.parallel([
      Animated.timing(cardEnter, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.loop(
        Animated.timing(scanLineProgress, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      )
    ]);
    animations.start();
    return () => {
      animations.stop();
    };
  }, [attemptKey, cardEnter, scanLineProgress]);

  useEffect(() => {
    if (targetStep <= visibleStep) return;
    const id = setTimeout(() => {
      setVisibleStep((prev) => Math.min(prev + 1, targetStep));
    }, 180);
    return () => clearTimeout(id);
  }, [targetStep, visibleStep]);

  useEffect(() => {
    const completeAndNavigate = async () => {
      if (!scanId || hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      setTargetStep(ANALYSIS_STEPS.length - 1);

      const elapsed = Date.now() - startedAtRef.current;
      const holdFor = Math.max(0, MIN_ANALYSIS_EXPERIENCE_MS - elapsed);
      await wait(holdFor + 180);

      await refreshFromBackend().catch(() => undefined);
      clearScanDraft();
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }).start(() => {
        router.replace(`/results/${scanId}`);
      });
    };

    if (!scanId || !status) return;
    if (status === "completed" || status === "needs_review") {
      void completeAndNavigate();
      return;
    }
    if (status === "failed") {
      setLocalError("We couldn’t finish analyzing this card. Please retry.");
      return;
    }
    if (status === "processing") {
      setTargetStep(4);
      return;
    }
    if (status === "uploaded") {
      setTargetStep(3);
      return;
    }
  }, [scanId, status, clearScanDraft, refreshFromBackend, contentOpacity]);

  useEffect(() => {
    if (!scanId || localError || status === "completed" || status === "needs_review" || status === "failed") return;
    const timer = setTimeout(() => {
      setLocalError("Analysis is taking longer than expected. Please try again.");
    }, PROCESSING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [scanId, status, localError, attemptKey]);

  useEffect(() => {
    if (!pollingError || localError) return;
    setLocalError(formatScanError(pollingError));
  }, [pollingError, localError]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      startedAtRef.current = Date.now();
      hasNavigatedRef.current = false;
      setTargetStep(0);
      setVisibleStep(0);
      setLocalError(null);
      setScanId(requestedScanId);

      if (requestedScanId) {
        setTargetStep(4);
        if (__DEV__) {
          console.log("[scan_flow] resume_processing", {
            scanId: requestedScanId,
            source: processingSource
          });
        }
        return;
      }

      if (!frontUri || !backUri) {
        setLocalError("Capture both sides of the card before starting analysis.");
        return;
      }

      let createdScanId: string | null = null;
      let failureStage = "create";

      try {
        const dbUserId = session?.appUserId ?? session?.userId;
        const authUserId = session?.userId ?? undefined;
        if (!dbUserId) {
          setLocalError("Your session expired before analysis started. Please try again.");
          return;
        }

        const job = await scansService.createScanJob({ userId: dbUserId });
        if (!active) return;
        createdScanId = job.id;
        setScanId(job.id);
        if (__DEV__) {
          console.log("[scan_flow] processing_started", {
            scanId: job.id,
            source: processingSource
          });
        }

        failureStage = "front_upload";
        setTargetStep(1);
        await scansService.attachFrontImage({
          scanId: job.id,
          userId: dbUserId,
          storageOwnerId: authUserId,
          localUri: frontUri
        });

        failureStage = "back_upload";
        setTargetStep(2);
        await scansService.attachBackImage({
          scanId: job.id,
          userId: dbUserId,
          storageOwnerId: authUserId,
          localUri: backUri
        });

        failureStage = "mark_uploaded";
        await scansService.markUploaded(job.id);
        analyticsService.track(ANALYTICS_EVENTS.scanUploaded, { scanJobId: job.id });
        await subscriptionsService.incrementFreeScansUsed(dbUserId, 1);
        await refreshFromBackend();

        failureStage = "invoke_processing";
        setTargetStep(4);
        await scanProcessingService.startProcessing(job.id);
      } catch (error) {
        if (!active) return;
        const rawMessage = error instanceof Error ? error.message : "Scan processing failed.";
        const friendlyMessage = formatScanError(
          failureStage === "front_upload" || failureStage === "back_upload"
            ? "Upload failed."
            : failureStage === "invoke_processing"
              ? "Processing failed."
              : rawMessage
        );

        if (createdScanId) {
          try {
            await scansService.markFailed({
              scanId: createdScanId,
              errorMessage: rawMessage
            });
          } catch {
            // Best-effort cleanup only.
          }
        }

        if (__DEV__) {
          console.log("[scan_flow] processing_error", {
            scanId: createdScanId,
            source: processingSource,
            stage: failureStage,
            message: rawMessage
          });
        }
        setLocalError(friendlyMessage);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [attemptKey, session?.appUserId, session?.userId, frontUri, backUri, requestedScanId, processingSource]);

  const canRetry = useMemo(() => Boolean(scanId) && status === "failed", [scanId, status]);
  const canRestart = useMemo(() => Boolean(frontUri && backUri), [frontUri, backUri]);

  const retry = async () => {
    if (!scanId) {
      setAttemptKey((prev) => prev + 1);
      return;
    }
    try {
      setIsRetrying(true);
      setLocalError(null);
      setTargetStep(4);
      await scanProcessingService.retryScanProcessing(scanId);
      if (__DEV__) {
        console.log("[scan_flow] retry_processing", { scanId });
      }
    } catch (error) {
      setLocalError(formatScanError(error instanceof Error ? error.message : "Retry failed."));
    } finally {
      setIsRetrying(false);
    }
  };

  const restartCapture = () => {
    clearScanDraft();
    router.replace("/(tabs)/scan");
  };

  const progressRatio = useMemo(() => {
    const capped = Math.max(0, Math.min(visibleStep + 1, ANALYSIS_STEPS.length));
    return capped / ANALYSIS_STEPS.length;
  }, [visibleStep]);

  const activeStepLabel = ANALYSIS_STEPS[Math.min(visibleStep, ANALYSIS_STEPS.length - 1)];
  const showRetryButton = canRetry || (Boolean(localError) && canRestart);
  const showRetakeButton = Boolean(localError);
  const retryLabel = canRetry ? "Retry Processing" : "Try Again";

  return (
    <Animated.View style={[styles.screen, { opacity: contentOpacity, paddingTop: guidedFlowTopInset(insets.top) }]}>
      <View style={styles.heroBlock}>
        <View style={styles.cardGlow} />
        <Animated.View
          style={[
            styles.cardShell,
            {
              opacity: cardEnter,
              transform: [
                {
                  translateY: cardEnter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0]
                  })
                },
                {
                  scale: cardEnter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1]
                  })
                }
              ]
            }
          ]}
        >
          {frontUri ? <Image source={{ uri: frontUri }} style={styles.image} /> : <View style={styles.imageFallback} />}
          <View style={styles.analysisOverlay} pointerEvents="none">
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]} />
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
      </View>

      <View style={styles.timelineWrap}>
        <Text style={styles.title}>Analyzing Card</Text>
        <Text style={styles.subtitle}>
          {localError ? "We hit a problem while preparing your collector results." : activeStepLabel}
        </Text>

        <View style={styles.stepsList}>
          {ANALYSIS_STEPS.map((step, index) => {
            const isDone = index < visibleStep;
            const isActive = index === visibleStep && !localError;
            return (
              <View key={step} style={styles.stepRow}>
                <View style={[styles.stepMarker, isDone && styles.stepDone, isActive && styles.stepActive]}>
                  {isDone ? <Ionicons name="checkmark" size={10} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.stepText, isDone && styles.stepTextDone, isActive && styles.stepTextActive]}>{step}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {localError ? <Text style={styles.error}>{localError}</Text> : null}
      {showRetryButton || showRetakeButton ? (
        <View style={styles.errorActions}>
          {showRetryButton ? (
            <PrimaryButton
              title={isRetrying ? "Retrying..." : retryLabel}
              onPress={retry}
              disabled={isRetrying}
            />
          ) : null}
          <SecondaryButton title="Retake Photos" onPress={restartCapture} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: layout.pagePadding
  },
  heroBlock: {
    width: "100%",
    alignItems: "center",
    marginBottom: 32
  },
  cardGlow: {
    position: "absolute",
    width: 244,
    height: 244,
    borderRadius: 122,
    backgroundColor: "rgba(225,6,0,0.06)",
    top: 18
  },
  cardShell: {
    width: 210,
    height: 286,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F1F4F8",
    borderWidth: 1,
    borderColor: "#E4E8EF",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10
  },
  image: {
    width: "100%",
    height: "100%"
  },
  imageFallback: {
    flex: 1,
    backgroundColor: "#EEF2F7"
  },
  analysisOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  scanLine: {
    position: "absolute",
    left: 14,
    right: 14,
    height: 2,
    backgroundColor: "rgba(225,6,0,0.42)"
  },
  cornerTL: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 18,
    height: 18,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: "rgba(255,255,255,0.75)"
  },
  cornerTR: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 18,
    height: 18,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: "rgba(255,255,255,0.75)"
  },
  cornerBL: {
    position: "absolute",
    bottom: 12,
    left: 12,
    width: 18,
    height: 18,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: "rgba(255,255,255,0.75)"
  },
  cornerBR: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 18,
    height: 18,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderColor: "rgba(255,255,255,0.75)"
  },
  timelineWrap: {
    width: "100%",
    marginTop: 20,
    gap: 16
  },
  title: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold",
    color: "#11151D"
  },
  subtitle: {
    ...typography.bodyMedium,
    color: "#6B7382"
  },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E5EAF1",
    overflow: "hidden",
    marginBottom: 20
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accentPrimary
  },
  stepsList: {
    gap: 11
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  stepMarker: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 1,
    borderColor: "#CDD4DF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  stepDone: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimary
  },
  stepActive: {
    borderColor: "#C44B47",
    backgroundColor: "#FFF1F0"
  },
  stepText: {
    ...typography.Caption,
    color: "#8A92A1",
    fontSize: 12,
    lineHeight: 15
  },
  stepTextDone: {
    color: "#6D7686"
  },
  stepTextActive: {
    color: "#181E2B",
    fontFamily: "Inter-SemiBold"
  },
  error: {
    ...typography.bodyMedium,
    color: "#8F2018",
    textAlign: "center",
    marginTop: 14
  },
  errorActions: {
    width: "100%",
    gap: 10,
    marginTop: 14
  }
});
