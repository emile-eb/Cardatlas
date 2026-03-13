import { ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAppState } from "@/state/AppState";
import { useAuth } from "@/features/auth";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";

type RowProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  divider?: boolean;
};

function SettingsRow({ title, subtitle, right, onPress, danger, divider = true }: RowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.row, divider && styles.rowDivider]}>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger && styles.rowDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <View style={styles.rowRight}>{right ?? <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />}</View>
    </Pressable>
  );
}

type GroupProps = {
  title: string;
  children: ReactNode;
};

function SettingsGroup({ title, children }: GroupProps) {
  return (
    <View style={styles.groupWrap}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

type ToggleProps = {
  value: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
};

function SettingsToggle({ value, onToggle, disabled = false }: ToggleProps) {
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

export default function CollectionSettingsScreen() {
  const { premium, freeScansRemaining, clearLocalData, restoreBilling, openManageSubscription, entitlementState, presentPaywall } = useAppState();
  const { signOut } = useAuth();
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [scanTipsOn, setScanTipsOn] = useState(true);
  const [aiChatOn, setAiChatOn] = useState(premium);
  const [statusText, setStatusText] = useState<string | null>(null);

  const handleClearLocalData = async () => {
    clearLocalData();
    await signOut();
    router.replace("/splash");
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerTop}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.membershipCard}>
        <View style={styles.membershipTop}>
          <Text style={styles.membershipKicker}>MEMBERSHIP</Text>
          <View style={styles.scanPill}>
            <Text style={styles.scanPillText}>{freeScansRemaining} scans remaining</Text>
          </View>
        </View>
        <Text style={styles.planTitle}>{premium ? "CardAtlas Pro" : "Free Plan"}</Text>
        <Text style={styles.planSub}>{premium ? "Unlimited scans and Collector AI unlocked" : "Upgrade for unlimited scans, Collector AI, and deeper card intelligence"}</Text>
        {!premium ? (
          <PrimaryButton title="Upgrade to CardAtlas Pro" onPress={() => presentPaywall("settings_upgrade")} style={styles.membershipBtn} />
        ) : (
          <Pressable style={styles.manageLink} onPress={() => void openManageSubscription()}>
            <Text style={styles.manageLinkText}>Manage Subscription</Text>
          </Pressable>
        )}
      </View>
      {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}

      <SettingsGroup title="Account">
        <SettingsRow title="Account Status" subtitle="Your CardAtlas account is active on this device" />
        <SettingsRow title="Subscription" subtitle={premium ? "CardAtlas Pro Active" : "Free Plan"} />
        <SettingsRow
          title="Restore Purchases"
          divider={false}
          onPress={async () => {
            const result = await restoreBilling("settings");
            if (result.status === "restored") {
              setStatusText("Purchases restored successfully.");
              return;
            }
            if (result.status === "no_purchases") {
              setStatusText("No purchases found to restore.");
              return;
            }
            setStatusText(result.message);
          }}
        />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingsRow
          title="Notifications"
          right={<SettingsToggle value={notificationsOn} onToggle={setNotificationsOn} />}
        />
        <SettingsRow
          title="Scan Preferences"
          subtitle="Show quality tips before scan"
          right={<SettingsToggle value={scanTipsOn} onToggle={setScanTipsOn} />}
        />
        <SettingsRow
          title="Collector AI"
          subtitle={entitlementState.isPremium ? "Enabled" : "Requires Pro"}
          right={<SettingsToggle value={aiChatOn} onToggle={setAiChatOn} disabled={!premium} />}
          divider={false}
        />
      </SettingsGroup>

      <SettingsGroup title="Collection & Data">
        <SettingsRow title="Export Collection" />
        <SettingsRow title="Scan History" />
        <SettingsRow title="Clear Local Data" danger divider={false} onPress={handleClearLocalData} />
      </SettingsGroup>

      <SettingsGroup title="Support">
        <SettingsRow title="Help Center" />
        <SettingsRow title="Contact Support" />
        <SettingsRow title="Rate CardAtlas" divider={false} />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow title="Privacy Policy" />
        <SettingsRow title="Terms of Service" />
        <SettingsRow title="App Version" right={<Text style={styles.versionValue}>v1.0.0</Text>} divider={false} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundPrimary },
  content: { padding: layout.pagePadding, paddingBottom: 140 },
  headerTop: {
    marginBottom: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 10,
    backgroundColor: "#FCFCFC"
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
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: 16,
    gap: 10,
    marginBottom: 24
  },
  membershipTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  membershipKicker: {
    ...typography.Caption,
    fontFamily: "Inter-Medium",
    color: colors.textSecondary
  },
  scanPill: {
    borderWidth: 1,
    borderColor: "#CDEAD6",
    backgroundColor: "#F3FAF5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  scanPillText: {
    ...typography.Caption,
    color: colors.success,
    fontFamily: "Inter-Medium"
  },
  planTitle: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold"
  },
  planSub: {
    ...typography.BodyMedium,
    color: colors.textSecondary
  },
  membershipBtn: {
    marginTop: 2
  },
  manageLink: {
    marginTop: 2,
    alignSelf: "flex-start",
    paddingVertical: 4
  },
  manageLinkText: {
    ...typography.BodyMedium,
    color: colors.accentPrimary,
    fontFamily: "Inter-SemiBold"
  },
  statusText: {
    ...typography.BodyMedium,
    color: colors.textSecondary
  },
  groupWrap: {
    marginBottom: 20,
    gap: 8
  },
  groupTitle: {
    ...typography.Caption,
    fontFamily: "Inter-Medium",
    color: colors.textSecondary
  },
  groupCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden"
  },
  row: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    gap: 10
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0"
  },
  rowCopy: {
    flex: 1,
    gap: 2
  },
  rowTitle: {
    ...typography.BodyLarge,
    fontFamily: "Inter-Medium",
    color: colors.textPrimary
  },
  rowDanger: {
    color: colors.accentPrimary
  },
  rowSub: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  rowRight: {
    minWidth: 72,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  versionValue: {
    ...typography.BodyMedium,
    color: colors.textSecondary,
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
    opacity: 0.5
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
