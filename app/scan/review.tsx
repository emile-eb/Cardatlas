import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAppState } from "@/state/AppState";
import { immersiveTopChromeInset } from "@/theme/safeArea";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";
import { pickImageFromDevice } from "@/utils/pickImage";
import { FullScreenLoading } from "@/components/loading/FullScreenLoading";

type ScanSide = "front" | "back";

function sideLabel(side: ScanSide): string {
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
          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
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
          <PrimaryButton title="Got it" onPress={onClose} style={styles.modalButton} />
        </View>
      </View>
    </Modal>
  );
}

export default function ScanReviewScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ origin?: string; legacy?: string }>();
  const origin = typeof params.origin === "string" ? params.origin : null;
  const legacyMode = params.legacy === "1";

  const [tipsOpen, setTipsOpen] = useState(false);
  const [pickerMessage, setPickerMessage] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<ScanSide>("front");

  const { scanDraft, setScanDraftImage, clearScanDraft } = useAppState();

  const frontDone = Boolean(scanDraft.frontUri);
  const backDone = Boolean(scanDraft.backUri);
  const ready = frontDone && backDone;

  useEffect(() => {
    // Legacy-only fallback review surface. Normal scan flow should always redirect
    // back into the active camera-first route unless this screen is opened explicitly.
    if (legacyMode) return;
    if (__DEV__) {
      console.log("[scan_flow] redirected_legacy_review", {
        route: "/scan/review",
        destination: "/(tabs)/scan"
      });
    }
    router.replace({
      pathname: "/(tabs)/scan",
      params: {
        ...(origin ? { origin } : {})
      }
    });
  }, [legacyMode, origin]);

  useEffect(() => {
    if (!legacyMode) return;
    if (!frontDone) {
      setActiveSide("front");
      return;
    }
    if (!backDone) {
      setActiveSide("back");
    }
  }, [frontDone, backDone, legacyMode]);

  if (!legacyMode) {
    return (
      <FullScreenLoading
        title="Returning to scanner"
        message="Opening the active capture flow for this scan."
        eyebrow="SCAN"
        icon="camera-outline"
      />
    );
  }

  const guidanceTitle = useMemo(() => `${sideLabel(activeSide)} of Card`, [activeSide]);

  const closeToOrigin = () => {
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

  const pickImage = async (side: ScanSide, preferCamera: boolean) => {
    setPickerMessage(null);
    const uri = await pickImageFromDevice({ preferCamera });

    if (!uri) {
      if (Platform.OS !== "web") {
        setPickerMessage("Native camera integration is coming next. Use web capture for now.");
      } else {
        setPickerMessage("No image selected.");
      }
      return;
    }

    setScanDraftImage(side, uri);

    if (side === "front" && !backDone) {
      setActiveSide("back");
    }
  };

  const retakeWithCamera = () => {
    router.replace({
      pathname: "/(tabs)/scan",
      params: {
        ...(origin ? { origin } : {}),
        side: activeSide
      }
    });
  };

  const analyze = () => {
    if (!ready) return;
    router.push("/processing");
  };

  return (
    <View style={[styles.screen, { paddingTop: immersiveTopChromeInset(insets.top) }]}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={closeToOrigin}>
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Scan</Text>
        <Pressable style={styles.tipsBtn} onPress={() => setTipsOpen(true)}>
          <Text style={styles.tipsText}>Photo Tips</Text>
        </Pressable>
      </View>

      <View style={styles.stageCard}>
        <View style={styles.stageGuideArea}>
          <CornerBrackets />
          {(activeSide === "front" && scanDraft.frontUri) || (activeSide === "back" && scanDraft.backUri) ? (
            <Image source={{ uri: activeSide === "front" ? scanDraft.frontUri : scanDraft.backUri }} style={styles.stagePreview} />
          ) : null}
        </View>
        <Text style={styles.stageTitle}>{guidanceTitle}</Text>
        <Text style={styles.stageSub}>Keep all card edges inside the frame</Text>

        <View style={styles.sideRow}>
          <SideProgressPill side="front" active={activeSide === "front"} captured={frontDone} onPress={() => setActiveSide("front")} />
          <SideProgressPill side="back" active={activeSide === "back"} captured={backDone} onPress={() => setActiveSide("back")} />
        </View>
      </View>

      {pickerMessage ? <Text style={styles.helper}>{pickerMessage}</Text> : null}

      <View style={styles.buttons}>
        <PrimaryButton title={`Retake ${sideLabel(activeSide)} Photo`} onPress={retakeWithCamera} />
        <SecondaryButton title="Upload from Camera Roll" onPress={() => pickImage(activeSide, false)} />
        <PrimaryButton title="Analyze Card" onPress={analyze} disabled={!ready} style={styles.analyzeBtn} />
      </View>

      {(frontDone || backDone) ? <SecondaryButton title="Reset Images" onPress={clearScanDraft} /> : null}

      <PhotoTipsModal visible={tipsOpen} onClose={() => setTipsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: spacing.lg,
    gap: spacing.md
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  title: {
    ...typography.H1
  },
  tipsBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  tipsText: {
    ...typography.Caption,
    color: colors.textSecondary,
    fontFamily: "Inter-Medium"
  },
  stageCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: 14,
    gap: 10
  },
  stageGuideArea: {
    height: 360,
    borderRadius: 14,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#ECECEC",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center"
  },
  stagePreview: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%"
  },
  bracketWrap: {
    width: 230,
    height: 318,
    position: "relative"
  },
  bracket: {
    position: "absolute",
    width: 38,
    height: 38,
    borderWidth: 4,
    borderColor: "#111111",
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
  stageTitle: {
    ...typography.H3,
    textAlign: "center"
  },
  stageSub: {
    ...typography.Caption,
    color: colors.textSecondary,
    textAlign: "center"
  },
  sideRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2
  },
  sidePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E3E3E3",
    borderRadius: 999,
    backgroundColor: "#F7F7F7",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sidePillActive: {
    borderColor: "#E8B5B0",
    backgroundColor: "#FFF5F4"
  },
  sidePillText: {
    ...typography.Caption,
    color: colors.textSecondary,
    fontFamily: "Inter-Medium"
  },
  sidePillTextActive: {
    color: colors.accentPrimary
  },
  sideCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center"
  },
  helper: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  buttons: {
    gap: 10
  },
  analyzeBtn: {
    marginTop: 2
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
    marginTop: spacing.sm
  }
});
