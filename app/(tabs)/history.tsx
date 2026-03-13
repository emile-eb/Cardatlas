import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { CollectionCardItem } from "@/components/CollectionCardItem";
import { SectionHeader } from "@/components/SectionHeader";
import { useAppState } from "@/state/AppState";
import { colors, layout, spacing, typography } from "@/theme/tokens";

export default function HistoryTab() {
  const { history } = useAppState();
  const visibleHistory = history.filter((item) => Boolean(item.imageFront?.trim()));
  const recent = visibleHistory.slice(0, 3);
  const older = visibleHistory.slice(3);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Scan History</Text>
      <Text style={styles.sub}>Reopen past scans and revisit collector context</Text>

      <View style={styles.section}>
        <SectionHeader title="Recent" rightText={`${recent.length} scans`} />
        <View style={styles.list}>
          {recent.map((item) => (
            <CollectionCardItem key={item.id} item={item} onPress={() => router.push(`/results/${item.id}`)} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Older" />
        <View style={styles.list}>
          {older.map((item) => (
            <CollectionCardItem key={item.id} item={item} onPress={() => router.push(`/results/${item.id}`)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundPrimary },
  content: { padding: layout.pagePadding, paddingBottom: 140, gap: spacing.sm },
  title: { ...typography.h1 },
  sub: { ...typography.bodySmall, marginTop: 2 },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  list: { gap: spacing.sm }
});
