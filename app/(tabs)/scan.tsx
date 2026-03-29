import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraCapturedPicture, FlashMode } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppState } from "@/state/AppState";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";
import { standardTopInset } from "@/theme/safeArea";
import { pickImageFromDevice } from "@/utils/pickImage";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { useAppPreferences } from "@/features/settings/AppPreferencesProvider";

type ScanSide = "front" | "back";

function sideLabel(side: ScanSide) {
  return side === "front" ? "Front" : "Back";
}

function CornerBrackets() {
  return (
    <View style={styles.bracketWrap} pointerEvents="none">
      <View style={[styles.bracket, styles.bracketTopLeft]} />
      <View style={[styles.bracket, styles.bracketTopRight]} />
      <View style={[styles.bracket, styles.bracketBottomLeft]} />
      <View style={[styles.bracket, styles.bracketBottomRight]} />
    </View>
  );
}

function SideProgressPill({
  side,
  active,
  captured,
  onPress
}: {
  side: ScanSide;
  active: boolean;
  captured: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.sidePill, active && styles.sidePillActive]}>
      <Text style={[styles.sidePillText, active && styles.sidePillTextActive]}>{sideLabel(side)}</Text>
      {captured ? (
        <View style={styles.sideCheck}>
          <Ionicons name="checkmark" size={10} color="#111111" />
        </View>
      ) : null}
    </Pressable>
  );
}

function PhotoTipsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalWrap}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Photo Tips</Text>
          <Text style={styles.modalTip}>Fill the frame with the card.</Text>
          <Text style={styles.modalTip}>Avoid glare and hard reflections.</Text>
          <Text style={styles.modalTip}>Keep the card flat and in focus.</Text>
          <Text style={styles.modalTip}>Use bright, even lighting.</Text>
          <Text style={styles.modalTip}>Capture all edges clearly.</Text>
          <Pressable onPress={onClose} style={styles.modalButton}>
            <Text style={styles.modalButtonText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CameraPermissionState({
  deniedPermanently,
  onRequest,
  onClose,
  onOpenSettings
}: {
  deniedPermanently: boolean;
  onRequest: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <View style={styles.stateScreen}>
      <View style={styles.stateCard}>
        <View style={styles.stateIconWrap}>
          <Ionicons name="camera-outline" size={22} color={colors.textPrimary} />
        </View>
        <Text style={styles.stateTitle}>Camera access is required</Text>
        <Text style={styles.stateCopy}>
          CardAtlas needs camera access to scan the front and back of your card directly in the app.
        </Text>
        <View style={styles.stateActions}>
          {deniedPermanently ? (
            <Pressable onPress={onOpenSettings} style={styles.statePrimaryAction}>
              <Text style={styles.statePrimaryText}>Open Settings</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onRequest} style={styles.statePrimaryAction}>
              <Text style={styles.statePrimaryText}>Allow Camera Access</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={styles.stateSecondaryAction}>
            <Text style={styles.stateSecondaryText}>Close Scan</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CameraFailureState({
  message,
  onRetry,
  onClose
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.stateScreen}>
      <View style={styles.stateCard}>
        <View style={styles.stateIconWrap}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.textPrimary} />
        </View>
        <Text style={styles.stateTitle}>Camera unavailable</Text>
        <Text style={styles.stateCopy}>{message}</Text>
        <View style={styles.stateActions}>
          <Pressable onPress={onRetry} style={styles.statePrimaryAction}>
            <Text style={styles.statePrimaryText}>Retry Camera</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.stateSecondaryAction}>
            <Text style={styles.stateSecondaryText}>Close Scan</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ScanCameraTab() {
  const params = useLocalSearchParams<{ origin?: string; side?: string }>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const origin = typeof params.origin === "string" ? params.origin : null;
  const preferredSideParam: ScanSide = params.side === "back" ? "back" : "front";
  const isNativeCamera = Platform.OS !== "web";

  const [activeSide, setActiveSide] = useState<ScanSide>(preferredSideParam);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [flashMode, setFlashMode] = useState<FlashMode>("off");
  const [pickerMessage, setPickerMessage] = useState<string | null>(null);
  const [scanErrorDetail, setScanErrorDetail] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraInstanceKey, setCameraInstanceKey] = useState(0);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHandedOffRef = useRef(false);
  const hasTrackedOpenRef = useRef(false);
  const hasRequestedPermissionRef = useRef(false);
  const hasShownTipsOnOpenRef = useRef(false);

  const { scanDraft, setScanDraftImage, clearScanDraft } = useAppState();
  const { preferences, loaded: preferencesLoaded } = useAppPreferences();
  const frontDone = Boolean(scanDraft.frontUri);
  const backDone = Boolean(scanDraft.backUri);
  const ready = frontDone && backDone;
  const currentPreviewUri = activeSide === "front" ? scanDraft.frontUri : scanDraft.backUri;
  const currentSideCaptured = Boolean(currentPreviewUri);
  const guidanceTitle = `${sideLabel(activeSide)} of Card`;
  const permissionDenied = isNativeCamera && permission != null && !permission.granted;
  const deniedPermanently = Boolean(permissionDenied && !permission?.canAskAgain);
  const shouldMountCameraView =
    isNativeCamera &&
    isFocused &&
    Boolean(permission?.granted) &&
    !currentSideCaptured &&
    !cameraError;

  const helperText = useMemo(() => {
    if (pickerMessage) return pickerMessage;
    if (ready) return "Captured. Preparing analysis…";
    if (currentSideCaptured) return `${sideLabel(activeSide)} captured. You can retake it or continue to the next side.`;
    return isNativeCamera
      ? "Align the card corners with the frame, or choose a photo from your library."
      : "";
  }, [activeSide, currentSideCaptured, isNativeCamera, pickerMessage, ready]);

  const clearPendingHandoff = () => {
    if (handoffTimerRef.current) {
      clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
  };

  const closeToOrigin = () => {
    clearPendingHandoff();
    clearScanDraft();
    hasHandedOffRef.current = false;

    if (origin) {
      router.replace(origin as never);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/home");
  };

  useEffect(() => {
    if (!isNativeCamera) return;
    if (permission?.granted || hasRequestedPermissionRef.current) return;
    if (!permission || permission.canAskAgain) {
      hasRequestedPermissionRef.current = true;
      void requestPermission();
    }
  }, [isNativeCamera, permission, requestPermission]);

  useEffect(() => {
    if (hasTrackedOpenRef.current) return;
    hasTrackedOpenRef.current = true;
    analyticsService.track(ANALYTICS_EVENTS.cameraOpened, {
      platform: Platform.OS,
      path: isNativeCamera ? "native" : "fallback"
    });
    if (__DEV__) {
      console.log("[scan_camera] opened", { platform: Platform.OS, path: isNativeCamera ? "native" : "fallback" });
    }
  }, [isNativeCamera]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    if (!preferences.scanTipsEnabled) return;
    if (hasShownTipsOnOpenRef.current) return;
    hasShownTipsOnOpenRef.current = true;
    setTipsOpen(true);
  }, [preferences.scanTipsEnabled, preferencesLoaded]);

  useEffect(() => {
    if (!isNativeCamera || !permissionDenied) return;
    analyticsService.track(ANALYTICS_EVENTS.cameraPermissionDenied, {
      canAskAgain: Boolean(permission?.canAskAgain),
      status: permission?.status ?? "unknown"
    });
    if (__DEV__) {
      console.log("[scan_camera] permission_denied", {
        canAskAgain: permission?.canAskAgain,
        status: permission?.status
      });
    }
  }, [isNativeCamera, permissionDenied, permission?.canAskAgain, permission?.status]);

  useEffect(() => {
    if (!__DEV__) return;
    console.log("[scan_camera] focus_change", {
      isFocused,
      currentSideCaptured,
      cameraReady,
      hasPermission: permission?.granted ?? null,
      cameraError: cameraError ?? null
    });
  }, [cameraError, cameraReady, currentSideCaptured, isFocused, permission?.granted]);

  useEffect(() => {
    if (!__DEV__) return;
    if (!shouldMountCameraView) return;
    console.log("[scan_camera] mounted_camera_view", {
      isFocused,
      side: activeSide,
      hasPermission: permission?.granted ?? null
    });
  }, [activeSide, isFocused, permission?.granted, shouldMountCameraView]);

  useEffect(() => {
    if (!ready) {
      clearPendingHandoff();
      hasHandedOffRef.current = false;
      return;
    }

    clearPendingHandoff();
    handoffTimerRef.current = setTimeout(() => {
      if (hasHandedOffRef.current) return;
      hasHandedOffRef.current = true;
      analyticsService.track(ANALYTICS_EVENTS.scanHandoffToProcessing, {
        path: isNativeCamera ? "native_camera" : "fallback",
        hasFront: frontDone,
        hasBack: backDone
      });
      if (__DEV__) {
        console.log("[scan_flow] handoff_to_processing", {
          entryRoute: "/(tabs)/scan",
          source: isNativeCamera ? "native_camera" : "fallback_upload",
          origin
        });
      }
      router.replace({
        pathname: "/processing",
        params: { source: isNativeCamera ? "native_camera" : "fallback_upload" }
      });
    }, 650);

    return () => {
      clearPendingHandoff();
    };
  }, [ready, isNativeCamera, frontDone, backDone, origin]);

  useEffect(() => {
    if (frontDone && !backDone) {
      setActiveSide("back");
    }
  }, [frontDone, backDone]);

  const toggleFlash = () => {
    setFlashMode((prev) => (prev === "on" ? "off" : "on"));
  };

  const setSideWithCancel = (side: ScanSide) => {
    clearPendingHandoff();
    setActiveSide(side);
  };

  const trackCapture = (side: ScanSide) => {
    analyticsService.track(side === "front" ? ANALYTICS_EVENTS.frontCaptured : ANALYTICS_EVENTS.backCaptured, {
      path: isNativeCamera ? "native_camera" : "fallback",
      platform: Platform.OS
    });
    if (__DEV__) {
      console.log("[scan_camera] captured", {
        side,
        path: isNativeCamera ? "native_camera" : "fallback",
        hasFront: side === "front" ? true : frontDone,
        hasBack: side === "back" ? true : backDone
      });
    }
  };

  const applyCapturedPhoto = (side: ScanSide, uri: string) => {
    clearPendingHandoff();
    setPickerMessage(null);
    setScanErrorDetail(null);
    setScanDraftImage(side, uri);
    trackCapture(side);

    if (side === "front" && !backDone) {
      setActiveSide("back");
    }
  };

  const captureNativePhoto = async () => {
    if (!isNativeCamera || !cameraRef.current || capturing || currentSideCaptured || permissionDenied) return;

    try {
      setCapturing(true);
      setPickerMessage(null);
      setScanErrorDetail(null);
      const capture =
        typeof cameraRef.current.takePictureAsync === "function"
          ? cameraRef.current.takePictureAsync.bind(cameraRef.current)
          : typeof cameraRef.current.takePicture === "function"
            ? cameraRef.current.takePicture.bind(cameraRef.current)
            : null;

      if (!capture) {
        throw new Error("Camera capture method is unavailable.");
      }

      const result = (await capture({
        quality: 0.82,
        skipProcessing: false,
        shutterSound: false
      })) as CameraCapturedPicture | undefined;

      if (!result?.uri) {
        throw new Error("No photo URI was returned.");
      }

      applyCapturedPhoto(activeSide, result.uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Capture failed.";
      setPickerMessage("We couldn't capture that photo. Please try again.");
      setScanErrorDetail(message);
      analyticsService.track(ANALYTICS_EVENTS.cameraCaptureFailed, {
        side: activeSide,
        path: "native_camera"
      });
      if (__DEV__) {
        console.log("[scan_camera] capture_failed", {
          side: activeSide,
          message
        });
      }
    } finally {
      setCapturing(false);
    }
  };

  const pickFallbackImage = async (preferCamera: boolean) => {
    setPickerMessage(null);
    setScanErrorDetail(null);
    try {
      const uri = await pickImageFromDevice({ preferCamera });
      if (!uri) {
        setPickerMessage(preferCamera ? "No photo captured." : "No image selected.");
        return;
      }
      applyCapturedPhoto(activeSide, uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image selection failed.";
      setPickerMessage(preferCamera ? "We couldn't capture a photo." : "We couldn't open your photo library.");
      setScanErrorDetail(message);
    }
  };

  const retakeSide = () => {
    clearPendingHandoff();
    analyticsService.track(activeSide === "front" ? ANALYTICS_EVENTS.retakeFront : ANALYTICS_EVENTS.retakeBack, {
      path: isNativeCamera ? "native_camera" : "fallback"
    });
    setScanDraftImage(activeSide, "");
    setPickerMessage(null);
    setScanErrorDetail(null);
    hasHandedOffRef.current = false;
  };

  const retryCamera = () => {
    setCameraError(null);
    setScanErrorDetail(null);
    setCameraReady(false);
    setCameraInstanceKey((prev) => prev + 1);
  };

  const openSystemSettings = () => {
    void Linking.openSettings();
  };

  if (isNativeCamera && permissionDenied) {
    return (
      <>
        <CameraPermissionState
          deniedPermanently={deniedPermanently}
          onRequest={() => {
            hasRequestedPermissionRef.current = true;
            void requestPermission();
          }}
          onOpenSettings={openSystemSettings}
          onClose={closeToOrigin}
        />
        <PhotoTipsModal visible={tipsOpen} onClose={() => setTipsOpen(false)} />
      </>
    );
  }

  if (isNativeCamera && cameraError) {
    return (
      <>
        <CameraFailureState message={cameraError} onRetry={retryCamera} onClose={closeToOrigin} />
        <PhotoTipsModal visible={tipsOpen} onClose={() => setTipsOpen(false)} />
      </>
    );
  }

  return (
    <View style={styles.liveScreen}>
      <View style={[styles.liveTopBar, { paddingTop: standardTopInset(insets.top) + layout.pagePadding }]}>
        <Pressable style={styles.liveIconBtn} onPress={closeToOrigin}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.liveUtilities}>
          <Pressable style={styles.liveIconBtn} onPress={() => setTipsOpen(true)}>
            <Ionicons name="help-circle-outline" size={20} color="#FFFFFF" />
          </Pressable>
          {isNativeCamera ? (
            <Pressable style={styles.liveIconBtn} onPress={toggleFlash}>
              <Ionicons name={flashMode === "on" ? "flash" : "flash-outline"} size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.liveCenterArea}>
        <View style={styles.previewFrameShell}>
          <View style={styles.previewFrame}>
            {shouldMountCameraView ? (
              <CameraView
                key={cameraInstanceKey}
                ref={cameraRef}
                style={styles.cameraView}
                mode="picture"
                facing="back"
                active={isFocused}
                flash={flashMode}
                enableTorch={flashMode === "on"}
                animateShutter={false}
                onCameraReady={() => {
                  setCameraReady(true);
                  if (__DEV__) {
                    console.log("[scan_camera] on_camera_ready", {
                      side: activeSide,
                      flashMode,
                      isFocused
                    });
                  }
                }}
                onMountError={(event) => {
                  const message = event.message || "The camera couldn't start on this device.";
                  setCameraError("CardAtlas couldn't start the camera. Please try again.");
                  analyticsService.track(ANALYTICS_EVENTS.cameraCaptureFailed, {
                    side: activeSide,
                    path: "native_camera_mount",
                    reason: message
                  });
                  if (__DEV__) {
                    console.log("[scan_camera] on_mount_error", {
                      error: message,
                      isFocused,
                      side: activeSide,
                      hasPermission: permission?.granted ?? null
                    });
                  }
                }}
              />
            ) : currentPreviewUri ? (
              <Image source={{ uri: currentPreviewUri }} style={styles.capturedImage} resizeMode="cover" />
            ) : (
              <View style={styles.previewFallback}>
                <Ionicons name="scan-outline" size={22} color="rgba(255,255,255,0.65)" />
              </View>
            )}

            <View style={styles.cameraShadeTop} pointerEvents="none" />
            <View style={styles.cameraShadeBottom} pointerEvents="none" />
            <CornerBrackets />
          </View>
        </View>

        <Text style={styles.liveGuideTitle}>{guidanceTitle}</Text>
        <Text style={styles.liveGuideSub}>
          {currentSideCaptured ? `${sideLabel(activeSide)} captured` : ""}
        </Text>

        <View style={styles.liveSideRow}>
          <SideProgressPill side="front" active={activeSide === "front"} captured={frontDone} onPress={() => setSideWithCancel("front")} />
          <SideProgressPill side="back" active={activeSide === "back"} captured={backDone} onPress={() => setSideWithCancel("back")} />
        </View>

        <View style={styles.captureStatePill}>
          <Text style={styles.captureStateText}>{helperText}</Text>
        </View>
        {scanErrorDetail ? (
          <View style={styles.errorPill}>
            <Text style={styles.errorPillText}>{scanErrorDetail}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottomTray, { paddingBottom: Math.max(insets.bottom + spacing.sm, 18) }]}>
        {currentSideCaptured ? (
          <Pressable style={styles.secondaryTrayBtn} onPress={retakeSide}>
            <Ionicons name="refresh-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.secondaryTrayText}>Retake</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.secondaryTrayBtn, isNativeCamera && styles.secondaryTrayBtnMuted]}
            onPress={() => {
              void pickFallbackImage(false);
            }}
          >
            <Ionicons name="images-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.secondaryTrayText}>{isNativeCamera ? "Library" : "Upload"}</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.shutterOuter, (capturing || currentSideCaptured || (isNativeCamera && !cameraReady)) && styles.shutterOuterDisabled]}
          onPress={() => {
            if (isNativeCamera) {
              void captureNativePhoto();
              return;
            }
            void pickFallbackImage(true);
          }}
          disabled={capturing || currentSideCaptured || (isNativeCamera && !cameraReady)}
        >
          <View style={[styles.shutterInner, capturing && styles.shutterInnerBusy]} />
        </Pressable>

        <View style={styles.doneWrap}>
          <Text style={styles.doneHint}>{ready ? "Preparing" : backDone ? "Ready" : "Capture both sides"}</Text>
          <Text style={styles.doneValue}>{ready ? "Analysis" : frontDone ? "Back next" : "Front first"}</Text>
        </View>
      </View>

      <PhotoTipsModal visible={tipsOpen} onClose={() => setTipsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  liveScreen: {
    flex: 1,
    backgroundColor: "#0A0A0A"
  },
  liveTopBar: {
    paddingTop: spacing.xl,
    paddingHorizontal: layout.pagePadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  liveUtilities: {
    flexDirection: "row",
    gap: 10
  },
  liveIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center"
  },
  liveCenterArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: layout.pagePadding,
    gap: 12
  },
  previewFrameShell: {
    width: "100%",
    maxWidth: 310,
    aspectRatio: 0.72
  },
  previewFrame: {
    flex: 1,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  cameraView: {
    ...StyleSheet.absoluteFillObject
  },
  capturedImage: {
    ...StyleSheet.absoluteFillObject
  },
  previewFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111214"
  },
  cameraShadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 84,
    backgroundColor: "rgba(0,0,0,0.18)"
  },
  cameraShadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 92,
    backgroundColor: "rgba(0,0,0,0.16)"
  },
  bracketWrap: {
    position: "absolute",
    top: "10%",
    left: "10%",
    right: "10%",
    bottom: "10%"
  },
  bracket: {
    position: "absolute",
    width: 40,
    height: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    borderRadius: 10
  },
  bracketTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0
  },
  bracketTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0
  },
  bracketBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0
  },
  bracketBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0
  },
  liveGuideTitle: {
    ...typography.H3,
    color: "#FFFFFF",
    marginTop: 2
  },
  liveGuideSub: {
    ...typography.Caption,
    color: "rgba(255,255,255,0.74)"
  },
  liveSideRow: {
    width: "100%",
    maxWidth: 300,
    flexDirection: "row",
    gap: 8,
    marginTop: 4
  },
  sidePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sidePillActive: {
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  sidePillText: {
    ...typography.Caption,
    color: "rgba(255,255,255,0.82)",
    fontFamily: "Inter-Medium"
  },
  sidePillTextActive: {
    color: "#FFFFFF"
  },
  sideCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  captureStatePill: {
    maxWidth: 310,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  captureStateText: {
    ...typography.Caption,
    color: "rgba(255,255,255,0.76)",
    textAlign: "center"
  },
  errorPill: {
    width: "100%",
    maxWidth: 310,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(143, 32, 24, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(226, 118, 106, 0.55)"
  },
  errorPillText: {
    ...typography.Caption,
    color: "#FFD8D4",
    textAlign: "center"
  },
  bottomTray: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#FFFFFF",
    paddingTop: 14,
    paddingBottom: Math.max(spacing.lg, 18),
    paddingHorizontal: layout.pagePadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  secondaryTrayBtn: {
    minWidth: 72,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 10
  },
  secondaryTrayBtnMuted: {
    backgroundColor: "#F7F8FA"
  },
  secondaryTrayText: {
    ...typography.Caption,
    color: colors.textPrimary,
    fontFamily: "Inter-Medium"
  },
  secondaryTrayTextMuted: {
    color: "#A1A9B8"
  },
  shutterOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  shutterOuterDisabled: {
    borderColor: "#D3D7DE"
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentPrimary
  },
  shutterInnerBusy: {
    opacity: 0.6
  },
  doneWrap: {
    minWidth: 78,
    alignItems: "flex-end",
    gap: 1
  },
  doneHint: {
    ...typography.Caption,
    color: "#8C94A2"
  },
  doneValue: {
    ...typography.BodyMedium,
    color: "#11151D",
    fontFamily: "Inter-SemiBold"
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.34)"
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: spacing.lg,
    gap: 8
  },
  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DEDEDE",
    marginBottom: 6
  },
  modalTitle: {
    ...typography.H2
  },
  modalTip: {
    ...typography.BodyMedium,
    color: colors.textSecondary
  },
  modalButton: {
    marginTop: spacing.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center"
  },
  modalButtonText: {
    ...typography.BodyMedium,
    color: colors.white,
    fontFamily: "Inter-SemiBold"
  },
  stateScreen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    justifyContent: "center",
    paddingHorizontal: layout.pagePadding
  },
  stateCard: {
    borderWidth: 1,
    borderColor: "#E7EBF1",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 10,
    alignItems: "center"
  },
  stateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ECEFF4",
    backgroundColor: "#FAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  stateTitle: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  stateCopy: {
    ...typography.BodyMedium,
    color: "#657082",
    textAlign: "center",
    lineHeight: 20
  },
  stateActions: {
    width: "100%",
    gap: 10,
    marginTop: 4
  },
  statePrimaryAction: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center"
  },
  statePrimaryText: {
    ...typography.BodyMedium,
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold"
  },
  stateSecondaryAction: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3E8EF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  stateSecondaryText: {
    ...typography.BodyMedium,
    color: "#1A2230",
    fontFamily: "Inter-SemiBold"
  }
});
