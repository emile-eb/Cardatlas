import { ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAppState } from "@/state/AppState";
import { useAuth } from "@/features/auth";
import { useAppPreferences } from "@/features/settings/AppPreferencesProvider";
import { useNotifications } from "@/features/notifications/NotificationsProvider";
import { collectionExportService } from "@/services/settings/CollectionExportService";
import {
  CARDATLAS_APP_VERSION,
  CARDATLAS_SUPPORT_EMAIL,
  CARDATLAS_SUPPORT_SUBJECT,
  SETTINGS_COPY,
  SETTINGS_LINKS
} from "@/constants/settings";
import { colors, layout, radius, shadows, spacing, typography } from "@/theme/tokens";

type RowProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
};

type StatusTone = "success" | "error" | "neutral";

function SettingsRow({ title, subtitle, right, onPress, danger = false, divider = true, disabled = false }: RowProps) {
  const pressable = Boolean(onPress) && !disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={!pressable}
      style={({ pressed }) => [
        styles.row,
        divider && styles.rowDivider,
        disabled && styles.rowDisabled,
        pressable && pressed && styles.rowPressed
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger && styles.rowDanger, disabled && styles.rowTitleDisabled]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, disabled && styles.rowSubDisabled]}>{subtitle}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        {right ?? (pressable ? <Ionicons name="chevron-forward" size={16} color="#9CA3AF" /> : null)}
      </View>
    </Pressable>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.groupWrap}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

function SettingsToggle({
  value,
  onToggle,
  disabled = false
}: {
  value: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => !disabled && onToggle(!value)}
      style={[
        styles.toggleTrack,
        value ? styles.toggleTrackOn : styles.toggleTrackOff,
        disabled && styles.toggleTrackDisabled
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <View style={[styles.toggleThumb, value ? styles.toggleThumbOn : styles.toggleThumbOff]} />
    </Pressable>
  );
}

function StatusBanner({ tone, text }: { tone: StatusTone; text: string }) {
  return (
    <View
      style={[
        styles.statusBanner,
        tone === "success" ? styles.statusBannerSuccess : tone === "error" ? styles.statusBannerError : styles.statusBannerNeutral
      ]}
    >
      <Ionicons
        name={tone === "success" ? "checkmark-circle" : tone === "error" ? "alert-circle" : "information-circle"}
        size={16}
        color={tone === "success" ? colors.success : tone === "error" ? colors.accentPrimary : "#475467"}
      />
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

export default function CollectionSettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    premium,
    freeScansRemaining,
    clearLocalData,
    restoreBilling,
    openManageSubscription,
    entitlementState,
    presentPaywall,
    cards
  } = useAppState();
  const { signOut } = useAuth();
  const {
    preferences,
    loaded,
    setNotificationsEnabled,
    setMarketActivityEnabled,
    setCollectionUpdatesEnabled,
    setRemindersEnabled,
    setScanTipsEnabled,
    setCollectorAiEnabled
  } = useAppPreferences();
  const { permissionStatus, pushSupported, requestPermissionInContext, openSystemSettings } = useNotifications();

  const [status, setStatus] = useState<{ tone: StatusTone; text: string } | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [manageBusy, setManageBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const planLabel = premium ? "CardAtlas Pro" : "Free Plan";
  const membershipSummary = premium
    ? "Unlimited scans and Collector AI are active on this device."
    : "Upgrade to CardAtlas Pro for unlimited scans and Collector AI.";
  const scanPillLabel = premium ? "Unlimited scans" : `${freeScansRemaining} scans remaining`;

  const planBadge = useMemo(
    () => (
      <View style={[styles.badge, premium ? styles.badgePro : styles.badgeFree]}>
        <Text style={[styles.badgeText, premium ? styles.badgeTextPro : styles.badgeTextFree]}>{planLabel}</Text>
      </View>
    ),
    [planLabel, premium]
  );

  const clearStatus = () => setStatus(null);
  const notificationCategoriesEnabled =
    loaded && preferences.notificationsEnabled && permissionStatus === "granted";
  const notificationsSubtitle =
    !pushSupported
      ? "Push notifications are unavailable on web."
      : permissionStatus === "denied"
        ? SETTINGS_COPY.notificationPermissionDeniedSubtitle
        : SETTINGS_COPY.notificationsSubtitle;

  const handleManageSubscription = async () => {
    clearStatus();
    setManageBusy(true);
    try {
      const opened = await openManageSubscription();
      setStatus({
        tone: opened ? "neutral" : "error",
        text: opened ? "Opened subscription management." : "Subscription management is unavailable right now."
      });
    } finally {
      setManageBusy(false);
    }
  };

  const handleRestorePurchases = async () => {
    clearStatus();
    setRestoreBusy(true);
    try {
      const result = await restoreBilling("settings");
      if (result.status === "restored") {
        setStatus({ tone: "success", text: "Purchases restored successfully." });
        return;
      }
      if (result.status === "no_purchases") {
        setStatus({ tone: "neutral", text: "No purchases were found to restore." });
        return;
      }
      setStatus({ tone: "error", text: result.message });
    } finally {
      setRestoreBusy(false);
    }
  };

  const handleNotificationsToggle = async (next: boolean) => {
    clearStatus();

    if (!pushSupported) {
      setStatus({ tone: "neutral", text: "Push notifications are only available on device builds." });
      return;
    }

    if (!next) {
      await setNotificationsEnabled(false);
      setStatus({ tone: "neutral", text: "Notifications are off for this device." });
      return;
    }

    await setNotificationsEnabled(true);
    const result = await requestPermissionInContext("settings");
    if (result === "granted") {
      setStatus({ tone: "success", text: "Notifications are enabled for this device." });
      return;
    }

    await setNotificationsEnabled(false);
    setStatus({
      tone: "neutral",
      text:
        result === "unsupported"
          ? "Push notifications are unavailable on this platform."
          : "Notifications stay off until you enable them in system settings."
    });
  };

  const handleExportCollection = async () => {
    clearStatus();
    if (cards.length === 0) {
      setStatus({ tone: "neutral", text: "Add cards to your collection before exporting." });
      return;
    }

    setExportBusy(true);
    try {
      const result = await collectionExportService.export(cards);
      setStatus({ tone: "success", text: result.message });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Collection export failed."
      });
    } finally {
      setExportBusy(false);
    }
  };

  const confirmClearLocalData = () => {
    const message =
      "This clears CardAtlas data stored on this device, removes your saved preferences, signs out the current session, and restarts onboarding. It does not delete backend records already stored in CardAtlas.";

    const performClear = async () => {
      clearStatus();
      setClearBusy(true);
      try {
        clearLocalData();
        await signOut();
        router.replace("/splash");
      } finally {
        setClearBusy(false);
      }
    };

    if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
      const confirmed = globalThis.confirm(`${message}\n\nClear local data?`);
      if (confirmed) {
        void performClear();
      }
      return;
    }

    Alert.alert("Clear local data?", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: clearBusy ? "Clearing..." : "Clear Local Data",
        style: "destructive",
        onPress: () => {
          void performClear();
        }
      }
    ]);
  };

  const openSupportEmail = async () => {
    clearStatus();
    const url = `mailto:${CARDATLAS_SUPPORT_EMAIL}?subject=${encodeURIComponent(CARDATLAS_SUPPORT_SUBJECT)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      setStatus({ tone: "error", text: "No mail app is available on this device." });
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(140, insets.bottom + 96) }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerTop}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/(tabs)/collection");
          }}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.membershipCard}>
        <View style={styles.membershipTop}>
          <Text style={styles.membershipKicker}>CARDATLAS PRO</Text>
          <View style={styles.scanPill}>
            <Text style={styles.scanPillText}>{scanPillLabel}</Text>
          </View>
        </View>

        <View style={styles.membershipHeadingRow}>
          <View style={styles.membershipCopy}>
            <Text style={styles.planTitle}>{planLabel}</Text>
            <Text style={styles.planSub}>{membershipSummary}</Text>
          </View>
          {planBadge}
        </View>

        {!premium ? (
          <PrimaryButton title="Upgrade to CardAtlas Pro" onPress={() => presentPaywall("settings_upgrade")} style={styles.membershipBtn} />
        ) : (
          <Pressable style={styles.manageLink} onPress={() => void handleManageSubscription()}>
            {manageBusy ? <ActivityIndicator size="small" color={colors.accentPrimary} /> : null}
            <Text style={styles.manageLinkText}>Manage Subscription</Text>
          </Pressable>
        )}
      </View>

      {status ? <StatusBanner tone={status.tone} text={status.text} /> : null}

      <SettingsGroup title="Account">
        <SettingsRow
          title="Account Status"
          subtitle={SETTINGS_COPY.accountStatusSubtitle}
          right={
            <View style={styles.inlinePill}>
              <Text style={styles.inlinePillText}>Active</Text>
            </View>
          }
        />
        <SettingsRow
          title="Subscription"
          subtitle={premium ? "CardAtlas Pro is active." : "You are on the free plan."}
          right={planBadge}
        />
        <SettingsRow
          title="Restore Purchases"
          subtitle={SETTINGS_COPY.restoreSubtitle}
          divider={false}
          onPress={() => void handleRestorePurchases()}
          right={
            restoreBusy ? <ActivityIndicator size="small" color={colors.accentPrimary} /> : <Ionicons name="refresh" size={16} color={colors.accentPrimary} />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingsRow
          title="Notifications"
          subtitle={notificationsSubtitle}
          right={
            <SettingsToggle
              value={preferences.notificationsEnabled}
              onToggle={(next) => void handleNotificationsToggle(next)}
              disabled={!loaded}
            />
          }
        />
        {permissionStatus === "denied" ? (
          <SettingsRow
            title="Open System Settings"
            subtitle="Allow notifications for CardAtlas at the device level."
            onPress={() => void openSystemSettings()}
            right={<Ionicons name="open-outline" size={16} color={colors.textSecondary} />}
          />
        ) : null}
        <SettingsRow
          title="Market Activity"
          subtitle={SETTINGS_COPY.marketActivitySubtitle}
          right={
            <SettingsToggle
              value={preferences.marketActivityEnabled}
              onToggle={(next) => void setMarketActivityEnabled(next)}
              disabled={!notificationCategoriesEnabled}
            />
          }
        />
        <SettingsRow
          title="Collection Updates"
          subtitle={SETTINGS_COPY.collectionUpdatesSubtitle}
          right={
            <SettingsToggle
              value={preferences.collectionUpdatesEnabled}
              onToggle={(next) => void setCollectionUpdatesEnabled(next)}
              disabled={!notificationCategoriesEnabled}
            />
          }
        />
        <SettingsRow
          title="Reminders"
          subtitle={SETTINGS_COPY.remindersSubtitle}
          right={
            <SettingsToggle
              value={preferences.remindersEnabled}
              onToggle={(next) => void setRemindersEnabled(next)}
              disabled={!notificationCategoriesEnabled}
            />
          }
        />
        <SettingsRow
          title="Scan Tips"
          subtitle={SETTINGS_COPY.scanTipsSubtitle}
          right={
            <SettingsToggle
              value={preferences.scanTipsEnabled}
              onToggle={(next) => void setScanTipsEnabled(next)}
              disabled={!loaded}
            />
          }
        />
        <SettingsRow
          title="Collector AI"
          subtitle={premium ? SETTINGS_COPY.collectorAiSubtitleEnabled : SETTINGS_COPY.collectorAiSubtitleDisabled}
          divider={false}
          right={
            <SettingsToggle
              value={premium && preferences.collectorAiEnabled}
              onToggle={(next) => void setCollectorAiEnabled(next)}
              disabled={!premium || !loaded}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title="Collection & Data">
        <SettingsRow
          title="Export Collection"
          subtitle={cards.length > 0 ? SETTINGS_COPY.exportSubtitle : "Add cards to export your collection."}
          onPress={() => void handleExportCollection()}
          disabled={exportBusy}
          right={exportBusy ? <ActivityIndicator size="small" color={colors.accentPrimary} /> : <Ionicons name="share-outline" size={16} color={colors.textSecondary} />}
        />
        <SettingsRow
          title="Scan History"
          subtitle={SETTINGS_COPY.scanHistorySubtitle}
          onPress={() => router.push("/collection/history")}
        />
        <SettingsRow
          title="Clear Local Data"
          subtitle={SETTINGS_COPY.clearLocalDataSubtitle}
          divider={false}
          danger
          onPress={confirmClearLocalData}
          disabled={clearBusy}
          right={clearBusy ? <ActivityIndicator size="small" color={colors.accentPrimary} /> : <Ionicons name="trash-outline" size={16} color={colors.accentPrimary} />}
        />
      </SettingsGroup>

      <SettingsGroup title="Support & Legal">
        <SettingsRow
          title="Help Center"
          subtitle="Browse help, account guidance, and support options."
          onPress={() => router.push(SETTINGS_LINKS.helpCenterRoute)}
        />
        <SettingsRow
          title="Contact Support"
          subtitle={`Email ${CARDATLAS_SUPPORT_EMAIL}`}
          onPress={() => void openSupportEmail()}
        />
        <SettingsRow
          title="Privacy Policy"
          subtitle="Read how CardAtlas handles app data and usage."
          onPress={() => router.push(SETTINGS_LINKS.privacyRoute)}
        />
        <SettingsRow
          title="Terms of Service"
          subtitle="Review the terms for using CardAtlas."
          divider={false}
          onPress={() => router.push(SETTINGS_LINKS.termsRoute)}
        />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow title="App Version" subtitle="Current build on this device." divider={false} right={<Text style={styles.versionValue}>v{CARDATLAS_APP_VERSION}</Text>} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary
  },
  content: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: layout.pagePadding
  },
  headerTop: {
    marginBottom: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF"
  },
  backText: {
    ...typography.Caption,
    color: colors.textPrimary,
    fontFamily: "Inter-Medium"
  },
  title: {
    ...typography.H2,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  headerSpacer: {
    width: 72
  },
  membershipCard: {
    borderWidth: 1,
    borderColor: "#E7ECF2",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
    marginBottom: 16,
    ...shadows.cardShadow
  },
  membershipTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  membershipKicker: {
    ...typography.Caption,
    fontFamily: "Inter-SemiBold",
    color: "#8A93A3",
    letterSpacing: 0.6
  },
  scanPill: {
    borderWidth: 1,
    borderColor: "#E4EAF2",
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  scanPillText: {
    ...typography.Caption,
    color: "#445062",
    fontFamily: "Inter-Medium"
  },
  membershipHeadingRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  membershipCopy: {
    flex: 1,
    gap: 4
  },
  planTitle: {
    ...typography.H1,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: "Inter-SemiBold"
  },
  planSub: {
    ...typography.BodyMedium,
    color: "#586375",
    lineHeight: 20,
    maxWidth: 320
  },
  membershipBtn: {
    marginTop: 2
  },
  manageLink: {
    marginTop: 2,
    alignSelf: "flex-start",
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  manageLinkText: {
    ...typography.BodyMedium,
    color: colors.accentPrimary,
    fontFamily: "Inter-SemiBold"
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeFree: {
    borderColor: "#E5EAF1",
    backgroundColor: "#F8FAFC"
  },
  badgePro: {
    borderColor: "#CDEAD6",
    backgroundColor: "#F3FAF5"
  },
  badgeText: {
    ...typography.Caption,
    fontFamily: "Inter-SemiBold"
  },
  badgeTextFree: {
    color: "#475467"
  },
  badgeTextPro: {
    color: colors.success
  },
  statusBanner: {
    marginBottom: 18,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  statusBannerSuccess: {
    backgroundColor: "#F3FAF5",
    borderColor: "#CDEAD6"
  },
  statusBannerError: {
    backgroundColor: "#FFF5F4",
    borderColor: "#F7D7D3"
  },
  statusBannerNeutral: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E4EAF2"
  },
  statusText: {
    ...typography.BodyMedium,
    color: "#445062",
    flex: 1
  },
  groupWrap: {
    marginBottom: 22,
    gap: 8
  },
  groupTitle: {
    ...typography.Caption,
    fontFamily: "Inter-SemiBold",
    color: "#8A93A3",
    letterSpacing: 0.5
  },
  groupCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EDF3",
    borderRadius: 18,
    overflow: "hidden"
  },
  row: {
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    gap: 12
  },
  rowPressed: {
    backgroundColor: "#FAFBFD"
  },
  rowDisabled: {
    opacity: 0.65
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EFF3F7"
  },
  rowCopy: {
    flex: 1,
    gap: 3
  },
  rowTitle: {
    ...typography.BodyLarge,
    fontFamily: "Inter-Medium",
    color: colors.textPrimary
  },
  rowTitleDisabled: {
    color: "#7E8796"
  },
  rowDanger: {
    color: colors.accentPrimary
  },
  rowSub: {
    ...typography.Caption,
    color: "#677285",
    lineHeight: 16
  },
  rowSubDisabled: {
    color: "#97A1AF"
  },
  rowRight: {
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  versionValue: {
    ...typography.BodyMedium,
    color: "#586375",
    fontFamily: "Inter-Medium"
  },
  inlinePill: {
    borderWidth: 1,
    borderColor: "#DDE4ED",
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  inlinePillText: {
    ...typography.Caption,
    color: "#475467",
    fontFamily: "Inter-Medium"
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 2
  },
  toggleTrackOn: {
    backgroundColor: "#FBE7E6",
    borderColor: "#F2C8C5"
  },
  toggleTrackOff: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D8DADD"
  },
  toggleTrackDisabled: {
    opacity: 0.45
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10
  },
  toggleThumbOn: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentPrimary
  },
  toggleThumbOff: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#D1D5DB"
  }
});
