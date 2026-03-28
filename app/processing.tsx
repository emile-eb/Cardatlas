import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppState } from "@/state/AppState";
import { guidedFlowTopInset } from "@/theme/safeArea";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";
import { scansService } from "@/services/scans/ScansService";
import { scanProcessingService } from "@/services/scans/ScanProcessingService";
import { getLatestScanUploadDebug } from "@/services/storage/StorageService";
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
const SCAN_ERROR_LOG_KEY = "cardatlas.scanErrorLog";
const MAX_STORED_SCAN_ERRORS = 8;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type StoredScanError = {
  at: string;
  stage: string;
  status: string | null;
  friendlyMessage: string;
  rawMessage: string | null;
  scanId: string | null;
};

async function appendStoredScanError(entry: StoredScanError): Promise<StoredScanError[]> {
  try {
    const existingRaw = await AsyncStorage.getItem(SCAN_ERROR_LOG_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as StoredScanError[]) : [];
    const next = [entry, ...existing].slice(0, MAX_STORED_SCAN_ERRORS);
    await AsyncStorage.setItem(SCAN_ERROR_LOG_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [entry];
  }
}

type ScanDiagnostics = {
  scanId: string | null;
  frontLocalUri: string | null;
  backLocalUri: string | null;
  frontUploadPath: string | null;
  backUploadPath: string | null;
  frontNormalizedUri: string | null;
  backNormalizedUri: string | null;
  frontNormalizationApplied: boolean;
  backNormalizationApplied: boolean;
  frontOriginalSizeBytes: number | null;
  backOriginalSizeBytes: number | null;
  frontNormalizedSizeBytes: number | null;
  backNormalizedSizeBytes: number | null;
  frontContentType: string | null;
  backContentType: string | null;
  processingError: string | null;
  confidenceLabel: string | null;
  reviewReason: string | null;
};

async function loadStoredScanErrors(): Promise<StoredScanError[]> {
  try {
    const raw = await AsyncStorage.getItem(SCAN_ERROR_LOG_KEY);
    return raw ? (JSON.parse(raw) as StoredScanError[]) : [];
  } catch {
    return [];
  }
}

function formatScanError(message?: string | null, fallback = "We couldn’t finish analyzing this card. Please try again."): string {
  const normalized = `${message ?? ""}`.trim();
  if (!normalized) return fallback;
  if (/session/i.test(normalized)) return "Your session expired before analysis finished. Please try again.";
  if (/front and back/i.test(normalized)) return "Capture both sides of the card before starting analysis.";
  if (/failed to read image at uri/i.test(normalized)) return "We couldn’t read one of the photos on this device. Please retake or reselect it.";
  if (/storage upload failed/i.test(normalized)) return "We couldn’t upload your card photos. Please try again.";
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
  const [rawError, setRawError] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState("Preparing scan");
  const [savedErrors, setSavedErrors] = useState<StoredScanError[]>([]);
  const [diagnostics, setDiagnostics] = useState<ScanDiagnostics>({
    scanId: null,
    frontLocalUri: null,
    backLocalUri: null,
    frontUploadPath: null,
    backUploadPath: null,
    frontNormalizedUri: null,
    backNormalizedUri: null,
    frontNormalizationApplied: false,
    backNormalizationApplied: false,
    frontOriginalSizeBytes: null,
    backOriginalSizeBytes: null,
    frontNormalizedSizeBytes: null,
    backNormalizedSizeBytes: null,
    frontContentType: null,
    backContentType: null,
    processingError: null,
    confidenceLabel: null,
    reviewReason: null
  });
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
    void loadStoredScanErrors().then(setSavedErrors);
  }, []);

  useEffect(() => {
    setDiagnostics((prev) => ({
      ...prev,
      frontLocalUri: frontUri ?? null,
      backLocalUri: backUri ?? null
    }));
  }, [frontUri, backUri]);

  const persistError = async (friendlyMessage: string, rawMessage?: string | null, statusValue?: string | null) => {
    const next = await appendStoredScanError({
      at: new Date().toISOString(),
      stage: processingStage,
      status: statusValue ?? status ?? null,
      friendlyMessage,
      rawMessage: rawMessage ?? null,
      scanId
    });
    setSavedErrors(next);
  };

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
      setProcessingStage("Opening results");

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
      setProcessingStage("Processing failed");
      void (async () => {
        const result = scanId ? await scanProcessingService.getProcessedScanResult(scanId).catch(() => null) : null;
        const backendMessage = result?.errorMessage ?? result?.reviewReason ?? null;
        const friendly = formatScanError(backendMessage, "We couldn’t finish analyzing this card. Please retry.");
        setDiagnostics((prev) => ({
          ...prev,
          processingError: result?.errorMessage ?? null,
          confidenceLabel: result?.confidenceLabel ?? null,
          reviewReason: result?.reviewReason ?? null
        }));
        setRawError(backendMessage);
        setLocalError(friendly);
        await persistError(friendly, backendMessage, "failed");
      })();
      return;
    }
    if (status === "processing") {
      setProcessingStage("Processing card");
      setTargetStep(4);
      return;
    }
    if (status === "uploaded") {
      setProcessingStage("Upload complete");
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
    setRawError(pollingError);
    setProcessingStage("Polling failed");
    const friendly = formatScanError(pollingError);
    setLocalError(friendly);
    void persistError(friendly, pollingError, "polling_failed");
  }, [pollingError, localError]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      startedAtRef.current = Date.now();
      hasNavigatedRef.current = false;
      setTargetStep(0);
      setVisibleStep(0);
      setLocalError(null);
      setRawError(null);
      setProcessingStage("Preparing scan");
      setDiagnostics({
        scanId: requestedScanId,
        frontLocalUri: frontUri ?? null,
        backLocalUri: backUri ?? null,
        frontUploadPath: null,
        backUploadPath: null,
        frontNormalizedUri: null,
        backNormalizedUri: null,
        frontNormalizationApplied: false,
        backNormalizationApplied: false,
        frontOriginalSizeBytes: null,
        backOriginalSizeBytes: null,
        frontNormalizedSizeBytes: null,
        backNormalizedSizeBytes: null,
        frontContentType: null,
        backContentType: null,
        processingError: null,
        confidenceLabel: null,
        reviewReason: null
      });
      setScanId(requestedScanId);

      if (requestedScanId) {
        setProcessingStage("Resuming processing");
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
        setProcessingStage("Waiting for photos");
        const friendly = "Capture both sides of the card before starting analysis.";
        setLocalError(friendly);
        void persistError(friendly, "missing_front_or_back", "missing_photos");
        return;
      }

      let createdScanId: string | null = null;
      let failureStage = "create";

      try {
        const dbUserId = session?.appUserId ?? session?.userId;
        const authUserId = session?.userId ?? undefined;
        if (!dbUserId) {
          setProcessingStage("Session unavailable");
          const friendly = "Your session expired before analysis started. Please try again.";
          setLocalError(friendly);
          void persistError(friendly, "missing_app_user_id", "session_unavailable");
          return;
        }

        setProcessingStage("Creating scan job");
        const job = await scansService.createScanJob({ userId: dbUserId });
        if (!active) return;
        createdScanId = job.id;
        setScanId(job.id);
        setDiagnostics((prev) => ({ ...prev, scanId: job.id }));
        if (__DEV__) {
          console.log("[scan_flow] processing_started", {
            scanId: job.id,
            source: processingSource
          });
        }

        failureStage = "front_upload";
        setProcessingStage("Uploading front photo");
        setTargetStep(1);
        await scansService.attachFrontImage({
          scanId: job.id,
          userId: dbUserId,
          storageOwnerId: authUserId,
          localUri: frontUri
        });
        const frontUploadDebug = getLatestScanUploadDebug("front");
        const frontJob = await scansService.fetchScanJobById(job.id);
        if (frontJob) {
          setDiagnostics((prev) => ({
            ...prev,
            frontUploadPath: frontJob.uploads.frontImagePath ?? null,
            backUploadPath: frontJob.uploads.backImagePath ?? null,
            frontNormalizedUri: frontUploadDebug?.normalizedUri ?? null,
            frontNormalizationApplied: frontUploadDebug?.normalizationApplied ?? false,
            frontOriginalSizeBytes: frontUploadDebug?.originalSizeBytes ?? null,
            frontNormalizedSizeBytes: frontUploadDebug?.normalizedSizeBytes ?? null,
            frontContentType: frontUploadDebug?.contentType ?? null
          }));
        }

        failureStage = "back_upload";
        setProcessingStage("Uploading back photo");
        setTargetStep(2);
        await scansService.attachBackImage({
          scanId: job.id,
          userId: dbUserId,
          storageOwnerId: authUserId,
          localUri: backUri
        });
        const backUploadDebug = getLatestScanUploadDebug("back");
        const backJob = await scansService.fetchScanJobById(job.id);
        if (backJob) {
          setDiagnostics((prev) => ({
            ...prev,
            frontUploadPath: backJob.uploads.frontImagePath ?? null,
            backUploadPath: backJob.uploads.backImagePath ?? null,
            backNormalizedUri: backUploadDebug?.normalizedUri ?? null,
            backNormalizationApplied: backUploadDebug?.normalizationApplied ?? false,
            backOriginalSizeBytes: backUploadDebug?.originalSizeBytes ?? null,
            backNormalizedSizeBytes: backUploadDebug?.normalizedSizeBytes ?? null,
            backContentType: backUploadDebug?.contentType ?? null
          }));
        }

        failureStage = "mark_uploaded";
        setProcessingStage("Finalizing upload");
        await scansService.markUploaded(job.id);
        analyticsService.track(ANALYTICS_EVENTS.scanUploaded, { scanJobId: job.id });
        await subscriptionsService.incrementFreeScansUsed(dbUserId, 1);
        await refreshFromBackend();

        failureStage = "invoke_processing";
        setProcessingStage("Starting search");
        setTargetStep(4);
        await scanProcessingService.startProcessing(job.id);
      } catch (error) {
        if (!active) return;
        const rawMessage = error instanceof Error ? error.message : "Scan processing failed.";
        setRawError(rawMessage);
        setProcessingStage(
          failureStage === "front_upload"
            ? "Front upload failed"
            : failureStage === "back_upload"
              ? "Back upload failed"
              : failureStage === "invoke_processing"
                ? "Search failed to start"
                : "Processing failed"
        );
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
        await persistError(friendlyMessage, rawMessage, failureStage);
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
      setRawError(null);
      setProcessingStage("Retrying search");
      setTargetStep(4);
      await scanProcessingService.retryScanProcessing(scanId);
      if (__DEV__) {
        console.log("[scan_flow] retry_processing", { scanId });
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Retry failed.";
      const friendly = formatScanError(rawMessage);
      setRawError(rawMessage);
      setLocalError(friendly);
      await persistError(friendly, rawMessage, "retry_failed");
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
        <Text style={styles.statusLine}>
          Stage: {processingStage}
          {status ? ` · Status: ${status}` : ""}
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
      {rawError ? <Text style={styles.errorDetail}>{rawError}</Text> : null}
      {savedErrors.length ? (
        <View style={styles.errorLogCard}>
          <Text style={styles.errorLogTitle}>Latest Scan Errors</Text>
          {savedErrors.slice(0, 3).map((entry) => (
            <View key={`${entry.at}:${entry.stage}`} style={styles.errorLogEntry}>
              <Text style={styles.errorLogStage}>
                {entry.stage}
                {entry.status ? ` · ${entry.status}` : ""}
              </Text>
              <Text style={styles.errorLogMessage}>{entry.friendlyMessage}</Text>
              {entry.rawMessage ? <Text style={styles.errorLogRaw}>{entry.rawMessage}</Text> : null}
              <Text style={styles.errorLogTime}>{new Date(entry.at).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.diagnosticsCard}>
        <Text style={styles.diagnosticsTitle}>Scan Diagnostics</Text>
        <Text style={styles.diagnosticsLine}>scan id: {diagnostics.scanId ?? scanId ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>stage: {processingStage}</Text>
        <Text style={styles.diagnosticsLine}>status: {status ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>front local uri: {diagnostics.frontLocalUri ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>back local uri: {diagnostics.backLocalUri ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>front upload path: {diagnostics.frontUploadPath ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>back upload path: {diagnostics.backUploadPath ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>front normalized uri: {diagnostics.frontNormalizedUri ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>back normalized uri: {diagnostics.backNormalizedUri ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>front normalized: {diagnostics.frontNormalizationApplied ? "yes" : "no"}</Text>
        <Text style={styles.diagnosticsLine}>back normalized: {diagnostics.backNormalizationApplied ? "yes" : "no"}</Text>
        <Text style={styles.diagnosticsLine}>front original bytes: {diagnostics.frontOriginalSizeBytes ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>back original bytes: {diagnostics.backOriginalSizeBytes ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>front normalized bytes: {diagnostics.frontNormalizedSizeBytes ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>back normalized bytes: {diagnostics.backNormalizedSizeBytes ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>front content type: {diagnostics.frontContentType ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>back content type: {diagnostics.backContentType ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>raw error: {rawError ?? diagnostics.processingError ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>review reason: {diagnostics.reviewReason ?? "none"}</Text>
        <Text style={styles.diagnosticsLine}>confidence: {diagnostics.confidenceLabel ?? "none"}</Text>
      </View>
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
      </ScrollView>
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
  scroll: {
    width: "100%"
  },
  scrollContent: {
    paddingBottom: 28
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
  statusLine: {
    ...typography.Caption,
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
  errorDetail: {
    ...typography.Caption,
    color: "#8F2018",
    textAlign: "center",
    marginTop: 8
  },
  errorLogCard: {
    width: "100%",
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "#FFF3F1",
    borderWidth: 1,
    borderColor: "#E9B8B2",
    padding: 14,
    gap: 12
  },
  errorLogTitle: {
    ...typography.H3,
    color: "#8F2018",
    fontFamily: "Inter-SemiBold"
  },
  errorLogEntry: {
    gap: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1D0CB"
  },
  errorLogStage: {
    ...typography.BodyMedium,
    color: "#5C1A16",
    fontFamily: "Inter-SemiBold"
  },
  errorLogMessage: {
    ...typography.BodyMedium,
    color: "#8F2018",
    fontFamily: "Inter-SemiBold"
  },
  errorLogRaw: {
    ...typography.Caption,
    color: "#7B342E"
  },
  errorLogTime: {
    ...typography.Caption,
    color: "#8A6D69"
  },
  diagnosticsCard: {
    width: "100%",
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#D8E0EA",
    padding: 14,
    gap: 6
  },
  diagnosticsTitle: {
    ...typography.H3,
    color: "#1A2230",
    fontFamily: "Inter-SemiBold"
  },
  diagnosticsLine: {
    ...typography.BodyMedium,
    color: "#334155"
  },
  errorActions: {
    width: "100%",
    gap: 10,
    marginTop: 14
  }
});
