import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CollectionCardItem } from "@/components/CollectionCardItem";
import { EmptyState } from "@/components/EmptyState";
import { FilterChip } from "@/components/FilterChip";
import { useAppState } from "@/state/AppState";
import { colors, layout, spacing, typography } from "@/theme/tokens";

type QuickFilter = "all" | "high" | "mariners" | "bowman";

export default function CollectionSearchScreen() {
  const { cards } = useAppState();
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return cards.filter((c) => {
      const queryPass =
        !q ||
        c.playerName.toLowerCase().includes(q) ||
        c.cardTitle.toLowerCase().includes(q) ||
        c.brand.toLowerCase().includes(q) ||
        c.team.toLowerCase().includes(q);
      const filterPass =
        quickFilter === "all" ||
        (quickFilter === "high" && c.referenceValue >= 700) ||
        (quickFilter === "mariners" && c.team.includes("Mariners")) ||
        (quickFilter === "bowman" && c.brand.includes("Bowman"));
      return queryPass && filterPass;
    });
  }, [cards, query, quickFilter]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Search Collection</Text>
      <Text style={styles.sub}>Find cards by player, set, team, or value</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search player, set, team..."
        style={styles.search}
      />
      <View style={styles.filters}>
        <FilterChip label="All" selected={quickFilter === "all"} onPress={() => setQuickFilter("all")} />
        <FilterChip label="Value > $700" selected={quickFilter === "high"} onPress={() => setQuickFilter("high")} />
        <FilterChip label="Mariners" selected={quickFilter === "mariners"} onPress={() => setQuickFilter("mariners")} />
        <FilterChip label="Bowman" selected={quickFilter === "bowman"} onPress={() => setQuickFilter("bowman")} />
      </View>

      <Text style={styles.count}>{results.length} matches</Text>
      <View style={{ gap: spacing.sm }}>
        {results.length === 0 ? (
          <EmptyState title="No matches yet" subtitle="Try a broader search or remove filters." />
        ) : (
          results.map((item) => <CollectionCardItem key={item.id} item={item} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundPrimary },
  content: { padding: layout.pagePadding, paddingBottom: 120, gap: spacing.md },
  title: { ...typography.h1 },
  sub: { ...typography.bodySmall },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  count: { ...typography.bodySmall, fontWeight: "700", color: colors.textSecondary }
});
