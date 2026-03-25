import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { CollectionCardItem } from "@/components/CollectionCardItem";
import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { setCollectionViewerContext } from "@/features/collection/viewerContext";
import { useAppState } from "@/state/AppState";
import { colors, layout, spacing, typography } from "@/theme/tokens";

type SortMode = "recent" | "value_desc" | "value_asc" | "name_asc" | "year_desc" | "year_asc";

const sortOptions: Array<{ key: SortMode; label: string }> = [
  { key: "recent", label: "Recently Added" },
  { key: "value_desc", label: "Value: High to Low" },
  { key: "value_asc", label: "Value: Low to High" },
  { key: "name_asc", label: "Player Name: A to Z" },
  { key: "year_desc", label: "Year: Newest First" },
  { key: "year_asc", label: "Year: Oldest First" }
];

export default function CollectionTab() {
  const isFocused = useIsFocused();
  const { cards, startScanOrPaywall } = useAppState();

  const [sort, setSort] = useState<SortMode>("recent");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [autographOnly, setAutographOnly] = useState(false);
  const [parallelOnly, setParallelOnly] = useState(false);
  const [serialOnly, setSerialOnly] = useState(false);
  const [gradedOnly, setGradedOnly] = useState(false);

  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const totalValue = cards.reduce((sum, card) => sum + card.referenceValue, 0);
  const formattedTotalValue = useMemo(
    () =>
      `$${totalValue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`,
    [totalValue]
  );
  const totalChars = useMemo(() => formattedTotalValue.split(""), [formattedTotalValue]);
  const decimalIndex = formattedTotalValue.indexOf(".");
  const totalAnimRefs = useRef<Animated.Value[]>([]);
  const teamCount = new Set(cards.map((c) => c.team)).size;

  const sports = useMemo(
    () => ["all", ...Array.from(new Set(cards.map((c) => c.sport).filter(Boolean) as string[])).sort()],
    [cards]
  );
  const teams = useMemo(() => ["all", ...Array.from(new Set(cards.map((c) => c.team).filter(Boolean))).sort()], [cards]);
  const brands = useMemo(() => ["all", ...Array.from(new Set(cards.map((c) => c.brand).filter(Boolean))).sort()], [cards]);

  useEffect(() => {
    totalAnimRefs.current = totalChars.map((_, index) => totalAnimRefs.current[index] ?? new Animated.Value(0));
  }, [totalChars]);

  useEffect(() => {
    if (!isFocused || totalAnimRefs.current.length === 0) return;
    totalAnimRefs.current.forEach((anim) => anim.setValue(0));
    const animations = totalAnimRefs.current.map((anim) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    );
    Animated.stagger(26, animations).start();
  }, [isFocused, formattedTotalValue]);

  const activeFilterCount =
    (favoritesOnly ? 1 : 0) + (sportFilter !== "all" ? 1 : 0) + (teamFilter !== "all" ? 1 : 0) + (brandFilter !== "all" ? 1 : 0);

  const attributeFilterCount = (autographOnly ? 1 : 0) + (parallelOnly ? 1 : 0) + (serialOnly ? 1 : 0) + (gradedOnly ? 1 : 0);
  const hasActiveFilters = activeFilterCount + attributeFilterCount > 0 || query.trim().length > 0 || sort !== "recent";

  const filteredAndSorted = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let result = cards.filter((card) => {
      if (favoritesOnly && !card.isFavorite) return false;
      if (sportFilter !== "all" && (card.sport ?? "").toLowerCase() !== sportFilter.toLowerCase()) return false;
      if (teamFilter !== "all" && card.team.toLowerCase() !== teamFilter.toLowerCase()) return false;
      if (brandFilter !== "all" && card.brand.toLowerCase() !== brandFilter.toLowerCase()) return false;
      if (autographOnly && !card.isAutograph) return false;
      if (parallelOnly && !card.isParallel) return false;
      if (serialOnly && !card.serialNumber?.trim()) return false;
      if (gradedOnly && !card.isGraded) return false;

      if (!normalizedQuery) return true;
      return [
        card.playerName,
        card.cardTitle,
        card.team,
        card.brand,
        card.set,
        card.cardNumber,
        `${card.year}`,
        card.notes ?? ""
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    result = [...result].sort((a, b) => {
      if (sort === "value_desc") return b.referenceValue - a.referenceValue;
      if (sort === "value_asc") return a.referenceValue - b.referenceValue;
      if (sort === "name_asc") return a.playerName.localeCompare(b.playerName);
      if (sort === "year_desc") return b.year - a.year;
      if (sort === "year_asc") return a.year - b.year;
      const aTs = Date.parse(a.addedAt ?? a.dateScanned);
      const bTs = Date.parse(b.addedAt ?? b.dateScanned);
      return bTs - aTs;
    });

    return result;
  }, [cards, query, favoritesOnly, sportFilter, teamFilter, brandFilter, autographOnly, parallelOnly, serialOnly, gradedOnly, sort]);

  const clearAll = () => {
    setQuery("");
    setFavoritesOnly(false);
    setSportFilter("all");
    setTeamFilter("all");
    setBrandFilter("all");
    setAutographOnly(false);
    setParallelOnly(false);
    setSerialOnly(false);
    setGradedOnly(false);
    setSort("recent");
  };

  const sortLabel = sortOptions.find((option) => option.key === sort)?.label ?? "Recently Added";

  const renderFilterGroup = (title: string, options: string[], selected: string, onSelect: (next: string) => void, allLabel: string) => (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      <View style={styles.filterChipWrap}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.filterChip, selected === option && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selected === option && styles.filterChipTextActive]}>
              {option === "all" ? allLabel : option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.title}>Collection</Text>
            <Text style={styles.subtitle}>Collector Portfolio</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerBtn} onPress={() => router.push("/collection/history")}>
              <Ionicons name="time-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.headerBtnText}>History</Text>
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={() => router.push("/collection/settings")}>
              <Ionicons name="settings-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.headerBtnText}>Settings</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Portfolio Value</Text>
          <View style={styles.summaryValueRow}>
            {totalChars.map((char, index) => {
              const digitAnim = totalAnimRefs.current[index];
              const isDecimalPart = decimalIndex !== -1 && index >= decimalIndex;
              return (
                <Animated.Text
                  key={`${formattedTotalValue}-${index}`}
                  style={[
                    styles.summaryValue,
                    isDecimalPart && styles.summaryDecimal,
                    digitAnim
                      ? {
                          opacity: digitAnim,
                          transform: [
                            {
                              translateY: digitAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-12, 0]
                              })
                            }
                          ]
                        }
                      : null
                  ]}
                >
                  {char}
                </Animated.Text>
              );
            })}
          </View>
          <Text style={styles.summaryMeta}>{cards.length} Cards • {teamCount} Teams</Text>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#8A8A8A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search player, title, team, brand, set, year"
            placeholderTextColor="#8A8A8A"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.controlBar}>
          <Pressable style={styles.controlBtn} onPress={() => setSortOpen(true)}>
            <Text style={styles.controlBtnLabel}>Sort</Text>
            <Text style={styles.controlBtnValue} numberOfLines={1}>
              {sortLabel}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.controlRight}>
            <Pressable
              style={[styles.toggleBtn, favoritesOnly && styles.toggleBtnActive]}
              onPress={() => setFavoritesOnly((prev) => !prev)}
            >
              <Ionicons name={favoritesOnly ? "star" : "star-outline"} size={14} color={favoritesOnly ? colors.accentPrimary : colors.textSecondary} />
              <Text style={[styles.toggleText, favoritesOnly && styles.toggleTextActive]}>Favorites</Text>
            </Pressable>

            <Pressable style={styles.filterBtn} onPress={() => setFilterOpen(true)}>
              <Ionicons name="options-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.filterBtnText}>Filters</Text>
              {activeFilterCount + attributeFilterCount > 0 ? <Text style={styles.filterCount}>{activeFilterCount + attributeFilterCount}</Text> : null}
            </Pressable>
          </View>
        </View>

        {hasActiveFilters ? (
          <View style={styles.activeStateRow}>
            <Text style={styles.activeStateText}>
              Showing {filteredAndSorted.length} of {cards.length} cards
            </Text>
            <Pressable onPress={clearAll}>
              <Text style={styles.clearText}>Clear all</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.inventoryScroll} contentContainerStyle={styles.inventoryContent} showsVerticalScrollIndicator={false}>
        <View style={styles.inventoryList}>
          {cards.length === 0 ? (
            <View style={styles.firstScanEmptyCard}>
              <View style={styles.firstScanIconWrap}>
                <Ionicons name="scan-outline" size={22} color={colors.accentPrimary} />
              </View>
              <Text style={styles.firstScanTitle}>Scan Your First Card</Text>
              <Text style={styles.firstScanDesc}>
                Start building your collection by scanning a card. We&apos;ll identify it, estimate value, and track it here.
              </Text>
              <PrimaryButton
                title="Scan a Card"
                onPress={() => {
                  if (!startScanOrPaywall("collection")) return;
                  router.push({
                    pathname: "/(tabs)/scan",
                    params: { origin: "/(tabs)/collection" }
                  });
                }}
                style={styles.firstScanCta}
              />
            </View>
          ) : filteredAndSorted.length === 0 ? (
            <EmptyState title="No cards match these filters" subtitle="Try adjusting your filters or search." />
          ) : (
            filteredAndSorted.map((item) => (
              <CollectionCardItem
                key={item.collectionItemId ?? item.id}
                item={item}
                onPress={() => {
                  setCollectionViewerContext(filteredAndSorted.map((card) => card.collectionItemId ?? card.id));
                  router.push({
                    pathname: "/collection/view/[id]",
                    params: { id: item.collectionItemId ?? item.id }
                  });
                }}
                onManage={() => {
                  if (!item.collectionItemId) return;
                  router.push({
                    pathname: "/collection/manage/[id]",
                    params: { id: item.collectionItemId }
                  });
                }}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortOpen(false)}>
          <View style={styles.sortMenu}>
            {sortOptions.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => {
                  setSort(option.key);
                  setSortOpen(false);
                }}
                style={styles.sortRow}
              >
                <Text style={[styles.sortRowText, sort === option.key && styles.sortRowTextActive]}>{option.label}</Text>
                {sort === option.key ? <Ionicons name="checkmark" size={14} color={colors.accentPrimary} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetDismissZone} onPress={() => setFilterOpen(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>
              <Pressable onPress={() => setFilterOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent}>
              {renderFilterGroup("Sport", sports, sportFilter, setSportFilter, "All Sports")}
              {renderFilterGroup("Team", teams, teamFilter, setTeamFilter, "All Teams")}
              {renderFilterGroup("Brand", brands, brandFilter, setBrandFilter, "All Brands")}
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Attributes</Text>
                <View style={styles.filterChipWrap}>
                  <Pressable onPress={() => setAutographOnly((prev) => !prev)} style={[styles.filterChip, autographOnly && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, autographOnly && styles.filterChipTextActive]}>Autograph</Text>
                  </Pressable>
                  <Pressable onPress={() => setParallelOnly((prev) => !prev)} style={[styles.filterChip, parallelOnly && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, parallelOnly && styles.filterChipTextActive]}>Parallel</Text>
                  </Pressable>
                  <Pressable onPress={() => setSerialOnly((prev) => !prev)} style={[styles.filterChip, serialOnly && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, serialOnly && styles.filterChipTextActive]}>Serial</Text>
                  </Pressable>
                  <Pressable onPress={() => setGradedOnly((prev) => !prev)} style={[styles.filterChip, gradedOnly && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, gradedOnly && styles.filterChipTextActive]}>Graded</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable onPress={clearAll}>
                <Text style={styles.clearText}>Clear all</Text>
              </Pressable>
              <PrimaryButton title="Apply Filters" onPress={() => setFilterOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  inventoryScroll: {
    flex: 1
  },
  inventoryContent: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: 18,
    paddingBottom: 140
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16
  },
  headerTitleBlock: {
    flex: 1,
    gap: 4,
    paddingTop: 2
  },
  title: {
    ...typography.H1,
    fontSize: 32,
    lineHeight: 36,
    fontFamily: "Inter-SemiBold"
  },
  subtitle: {
    ...typography.BodyMedium,
    color: "#747D8C"
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 2
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#E7EBF1",
    borderRadius: 11,
    backgroundColor: "#FCFCFC"
  },
  headerBtnText: {
    ...typography.Caption,
    color: "#2A3140",
    fontFamily: "Inter-Medium"
  },
  summary: {
    marginTop: 28
  },
  summaryLabel: {
    ...typography.Caption,
    fontFamily: "Inter-Medium",
    color: "#7B8493",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  summaryValue: {
    ...typography.DisplayValue
  },
  summaryValueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 1
  },
  summaryDecimal: {
    color: "#AEB5C1"
  },
  summaryMeta: {
    ...typography.Caption,
    color: "#6B7483",
    marginTop: 8,
    fontFamily: "Inter-Medium",
    letterSpacing: 0.2
  },
  searchWrap: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#E7EBF1",
    borderRadius: 14,
    backgroundColor: "#FCFCFC",
    paddingHorizontal: 13,
    paddingVertical: 12
  },
  searchInput: {
    flex: 1,
    ...typography.BodyMedium,
    color: colors.textPrimary,
    fontFamily: "Inter-Medium"
  },
  controlBar: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  controlBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E7EBF1",
    backgroundColor: "#FCFCFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  controlBtnLabel: {
    ...typography.Caption,
    color: "#7A8392",
    fontFamily: "Inter-Medium"
  },
  controlBtnValue: {
    ...typography.Caption,
    color: "#1E2533",
    fontFamily: "Inter-SemiBold",
    flex: 1
  },
  controlRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#E7EBF1",
    backgroundColor: "#FCFCFC",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 38
  },
  toggleBtnActive: {
    borderColor: "#F2D0CD",
    backgroundColor: "#FFF4F3"
  },
  toggleText: {
    ...typography.Caption,
    color: "#657082",
    fontFamily: "Inter-Medium"
  },
  toggleTextActive: {
    color: colors.accentPrimary
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#E7EBF1",
    backgroundColor: "#FCFCFC",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 38
  },
  filterBtnText: {
    ...typography.Caption,
    color: "#657082",
    fontFamily: "Inter-Medium"
  },
  filterCount: {
    ...typography.Caption,
    color: colors.accentPrimary,
    fontFamily: "Inter-SemiBold"
  },
  activeStateRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  activeStateText: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  clearText: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  inventoryList: {
    gap: 9
  },
  firstScanEmptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 34,
    gap: 12
  },
  firstScanIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F0D0CD",
    backgroundColor: "#FFF7F6",
    alignItems: "center",
    justifyContent: "center"
  },
  firstScanTitle: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  firstScanDesc: {
    ...typography.BodyMedium,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20
  },
  firstScanCta: {
    marginTop: 4,
    width: "100%"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingTop: 220,
    paddingHorizontal: layout.pagePadding
  },
  sortMenu: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden"
  },
  sortRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sortRowText: {
    ...typography.BodyMedium,
    color: colors.textPrimary
  },
  sortRowTextActive: {
    color: colors.accentPrimary,
    fontFamily: "Inter-Medium"
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)"
  },
  sheetDismissZone: {
    flex: 1
  },
  filterSheet: {
    maxHeight: "76%",
    backgroundColor: colors.backgroundPrimary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingHorizontal: layout.pagePadding,
    paddingBottom: 16
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8
  },
  sheetTitle: {
    ...typography.H3,
    fontFamily: "Inter-SemiBold"
  },
  sheetContent: {
    paddingBottom: 16,
    gap: 14
  },
  filterGroup: {
    gap: 8
  },
  filterGroupTitle: {
    ...typography.Caption,
    color: colors.textSecondary,
    fontFamily: "Inter-Medium"
  },
  filterChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#EAEAEA",
    backgroundColor: "#F8F8F8",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  filterChipActive: {
    backgroundColor: "#FFF4F3",
    borderColor: "#F2D0CD"
  },
  filterChipText: {
    ...typography.Caption,
    color: "#6F6F6F",
    fontFamily: "Inter-Medium"
  },
  filterChipTextActive: {
    color: colors.accentPrimary
  },
  sheetFooter: {
    borderTopWidth: 1,
    borderTopColor: "#EFEFEF",
    paddingTop: 10,
    gap: 10
  }
});
