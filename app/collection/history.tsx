import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SectionHeader } from "@/components/SectionHeader";
import { useAppState } from "@/state/AppState";
import { colors, layout, spacing, typography } from "@/theme/tokens";
import { CardItem } from "@/types/models";
import { PriceText } from "@/components/PriceText";
import { formatGradeScore, normalizeGradeScore } from "@/utils/gradeScore";

function getRelativeScanTime(isoDate: string) {
  const scannedAt = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - scannedAt.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "Scanned just now";
  if (diffHours < 24) return `Scanned ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "Scanned yesterday";
  if (diffDays < 7) return `Scanned ${diffDays} days ago`;
  return `Scanned ${scannedAt.toLocaleDateString()}`;
}

function getGroupLabel(isoDate: string) {
  const scannedAt = new Date(isoDate);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 7);

  if (scannedAt >= todayStart) return "Today";
  if (scannedAt >= weekStart) return "This Week";
  return "Earlier";
}

function HistoryRow({ item }: { item: CardItem }) {
  const gradeScore = normalizeGradeScore(item.gradeScore);

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => router.push(`/results/${item.id}`)}>
      <Image source={{ uri: item.imageFront }} style={styles.image} />
      <View style={styles.rowInfo}>
        <Text numberOfLines={1} style={styles.player}>{item.playerName}</Text>
        <Text numberOfLines={1} style={styles.meta}>{item.year} {item.brand} {item.cardNumber}</Text>
        <Text numberOfLines={1} style={styles.team}>{item.team}</Text>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={11} color="#A1A1AA" />
          <Text numberOfLines={1} style={styles.timeMeta}>{getRelativeScanTime(item.dateScanned)}</Text>
        </View>
      </View>
      <View style={styles.valueWrap}>
        <PriceText value={item.referenceValue} style={styles.value} />
        {gradeScore != null ? <Text style={styles.gradeScore}>GS {formatGradeScore(gradeScore)}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function CollectionHistoryScreen() {
  const { history, startScanOrPaywall } = useAppState();
  const isEmpty = history.length === 0;
  const grouped = history.reduce<Record<"Today" | "This Week" | "Earlier", CardItem[]>>(
    (acc, item) => {
      const label = getGroupLabel(item.dateScanned) as "Today" | "This Week" | "Earlier";
      acc[label].push(item);
      return acc;
    },
    { Today: [], "This Week": [], Earlier: [] }
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, isEmpty && styles.contentEmpty]}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Scan History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="time-outline" size={20} color="#8C8C92" />
          </View>
          <Text style={styles.emptyTitle}>No scan history yet</Text>
          <Text style={styles.emptyDesc}>
            Your scanned cards will appear here so you can reopen results and revisit collector context anytime.
          </Text>
          <Pressable
            style={styles.emptyAction}
            onPress={() =>
              startScanOrPaywall("history") &&
              router.push({
                pathname: "/(tabs)/scan",
                params: { origin: "/collection/history" }
              })
            }
          >
            <Text style={styles.emptyActionText}>Scan a Card</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryValue}>{history.length} scans</Text>
            <Text style={styles.summaryLabel}>Total Scans</Text>
          </View>

          {(["Today", "This Week", "Earlier"] as const).map((group, index) =>
            grouped[group].length ? (
              <View key={group} style={[styles.section, index === 0 && styles.firstSection]}>
                <SectionHeader title={group.toUpperCase()} />
                <View style={styles.list}>
                  {grouped[group].map((item) => (
                    <HistoryRow key={item.id} item={item} />
                  ))}
                </View>
              </View>
            ) : null
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundPrimary },
  content: { padding: layout.pagePadding, paddingBottom: 140, gap: spacing.sm },
  contentEmpty: {
    flexGrow: 1
  },
  headerRow: {
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
  summary: {
    marginTop: 8,
    marginBottom: 14
  },
  summaryLabel: {
    ...typography.Caption,
    color: "#8B8B8F",
    fontFamily: "Inter-Regular",
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2
  },
  summaryValue: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold",
    fontSize: 22,
    lineHeight: 26
  },
  emptyWrap: {
    flex: 1,
    minHeight: 360,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10
  },
  emptyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#E6E6E8",
    backgroundColor: "#F8F8F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  emptyTitle: {
    ...typography.H3,
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  emptyDesc: {
    ...typography.BodyMedium,
    color: "#7A7A7A",
    textAlign: "center",
    lineHeight: 20
  },
  emptyAction: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  emptyActionText: {
    ...typography.Caption,
    color: colors.textSecondary,
    fontFamily: "Inter-Medium"
  },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  firstSection: {
    marginTop: 30
  },
  list: { gap: 9 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  rowPressed: {
    backgroundColor: "#FCFCFC"
  },
  image: {
    width: 48,
    height: 66,
    borderRadius: 8
  },
  rowInfo: {
    flex: 1,
    gap: 1
  },
  player: {
    ...typography.H3,
    fontSize: 15,
    lineHeight: 18
  },
  meta: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  team: {
    ...typography.BodyMedium,
    color: colors.textSecondary
  },
  timeMeta: {
    ...typography.Caption,
    color: "#A1A1AA",
    fontSize: 10,
    lineHeight: 12
  },
  timeRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  value: {
    ...typography.H3,
    fontFamily: "Inter-SemiBold",
    color: colors.accentPrimary,
    fontVariant: ["tabular-nums"]
  },
  valueWrap: {
    alignItems: "flex-end",
    minWidth: 82
  },
  gradeScore: {
    ...typography.Caption,
    marginTop: 4,
    color: "#6B7280",
    fontFamily: "Inter-SemiBold"
  }
});
