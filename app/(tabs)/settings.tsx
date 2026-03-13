import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { Panel } from "@/components/Panel";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionHeader } from "@/components/SectionHeader";
import { useAppState } from "@/state/AppState";
import { colors, layout, spacing, typography } from "@/theme/tokens";

export default function SettingsTab() {
  const { premium, presentPaywall } = useAppState();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.sub}>Membership, preferences, and support</Text>

      <Panel style={{ gap: spacing.xs }}>
        <SectionHeader title="Account" />
        <Text style={styles.itemTitle}>Account Ready</Text>
        <Text style={styles.itemSub}>Your CardAtlas account is active on this device</Text>
      </Panel>

      <Panel style={{ gap: spacing.xs }}>
        <SectionHeader title="Subscription" />
        <Text style={styles.itemTitle}>{premium ? "CardAtlas Pro Active" : "Free Plan"}</Text>
        <Text style={styles.itemSub}>{premium ? "Unlimited scans and collector intelligence unlocked" : "Upgrade for unlimited scans, deeper market reads, and Collector AI"}</Text>
        {!premium ? <PrimaryButton title="Upgrade to CardAtlas Pro" onPress={() => presentPaywall("settings_upgrade")} /> : null}
      </Panel>

      <Panel style={styles.toggleRow}>
        <Text style={styles.itemTitle}>Notifications</Text>
        <Switch value />
      </Panel>

      <Panel><Text style={styles.itemTitle}>Help & Support</Text></Panel>
      <Panel><Text style={styles.itemTitle}>Privacy & Terms</Text></Panel>
      <Panel><Text style={styles.itemTitle}>Restore Purchases</Text></Panel>
      <Panel><Text style={styles.itemTitle}>Sign Out</Text></Panel>
      <Text style={styles.version}>CardAtlas v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundPrimary },
  content: { padding: layout.pagePadding, paddingBottom: 140, gap: spacing.sm },
  title: { ...typography.h1 },
  sub: { ...typography.bodySmall },
  itemTitle: { ...typography.bodyLarge, fontWeight: "700" },
  itemSub: { ...typography.bodySmall },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  version: { ...typography.caption, textAlign: "center", marginTop: spacing.sm }
});
