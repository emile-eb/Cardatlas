import { Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback, useState } from "react";
import { CardIdentityHeader } from "./CardIdentityHeader";
import { Panel } from "./Panel";
import { ResultsModuleHeader } from "@/components/results/ResultsModuleHeader";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";
import { ValuePanel } from "./ValuePanel";
import { ActiveListingsPanel } from "./ActiveListingsPanel";
import { PriceHistoryPanel } from "./PriceHistoryPanel";
import { GradingOutlookPanel } from "./GradingOutlookPanel";
import { CardItem } from "@/types/models";
import { colors, layout, spacing, typography } from "@/theme/tokens";
import { useAppState } from "@/state/AppState";
import { useRarityVisuals } from "@/hooks/useRarityVisuals";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { useAppPreferences } from "@/features/settings/AppPreferencesProvider";

type Props = {
  card: CardItem;
  sourceScanId?: string;
  detailBackHref?: string;
  onEditResult?: () => void;
  onReportIncorrect?: () => void;
  isReporting?: boolean;
  hideCloseButton?: boolean;
  topSpacerHeight?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function ResultDetails({
  card,
  sourceScanId,
  detailBackHref,
  onEditResult,
  onReportIncorrect,
  isReporting,
  hideCloseButton = false,
  topSpacerHeight = 0,
  contentContainerStyle
}: Props) {
  const { cards, addCardToCollection, addProcessedScanToCollection, enterAiOrPaywall, premium, presentPaywall } = useAppState();
  const { preferences } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const [heroRevealPulseToken, setHeroRevealPulseToken] = useState(0);
  const rarityVisuals = useRarityVisuals(card.rarityLabel);
  const handleRarityRevealed = useCallback(() => {
    setHeroRevealPulseToken((prev) => prev + 1);
  }, []);
  const isInCollection = cards.some(
    (x) => x.id === (card.sourceCardId ?? card.id) || x.sourceCardId === (card.sourceCardId ?? card.id)
  );
  const linkedCollectionItem = cards.find(
    (x) =>
      (card.sourceCardId && x.sourceCardId === card.sourceCardId) ||
      (card.sourceCardId && x.id === card.sourceCardId) ||
      x.id === card.id
  );
  const displayValue = Number(linkedCollectionItem?.referenceValue ?? card.referenceValue ?? 0);
  const baseReferenceValue = Number(linkedCollectionItem?.baseReferenceValue ?? card.baseReferenceValue ?? displayValue);
  const showsAttributeAdjustedValue =
    (linkedCollectionItem?.valuationSource === "attribute_adjusted" || Number(linkedCollectionItem?.adjustedValue ?? 0) > 0) &&
    baseReferenceValue > 0 &&
    Math.abs(displayValue - baseReferenceValue) >= 0.01;
  const recentSalesCardId =
    linkedCollectionItem?.sourceCardId ??
    card.sourceCardId ??
    card.correctedCardId ??
    (card.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(card.id) ? card.id : null);

  const attributeLines = [
    linkedCollectionItem?.isAutograph ? "Autograph" : null,
    linkedCollectionItem?.isMemorabilia ? "Memorabilia / Patch" : null,
    linkedCollectionItem?.isParallel && linkedCollectionItem?.parallelName ? linkedCollectionItem.parallelName : null,
    linkedCollectionItem?.serialNumber ? `Serial ${linkedCollectionItem.serialNumber}` : null,
    linkedCollectionItem?.isGraded
      ? `${linkedCollectionItem.gradingCompany ?? "Graded"}${linkedCollectionItem.grade ? ` ${linkedCollectionItem.grade}` : ""}`
      : null
  ].filter(Boolean) as string[];
  const specRows = [
    { label: "Year", value: String(card.year) },
    { label: "Brand / Set", value: `${card.brand} ${card.set}` },
    { label: "Card Number", value: card.cardNumber },
    { label: "Team", value: card.team },
    { label: "Position", value: card.position }
  ];
  const marketStory = `Reference value anchors the read. Live asks, price history, and grading add the deeper market context behind this card.`;
  const detailCollectionItem = linkedCollectionItem ?? (card.collectionItemId ? card : undefined);
  const detailRouteParams =
    sourceScanId
      ? { id: sourceScanId, ...(detailBackHref ? { backTo: detailBackHref } : {}) }
      : detailCollectionItem?.collectionItemId
        ? {
            id: detailCollectionItem.sourceScanId ?? detailCollectionItem.collectionItemId,
            from: "collection",
            collectionItemId: detailCollectionItem.collectionItemId,
            ...(detailBackHref ? { backTo: detailBackHref } : {})
          }
        : undefined;

  console.log("[grade_score][result_details]", {
    cardId: card.id,
    sourceCardId: card.sourceCardId ?? null,
    sourceScanId: sourceScanId ?? null,
    playerName: card.playerName,
    gradeScore: card.gradeScore ?? null,
    rarityLabel: card.rarityLabel ?? null,
    referenceValue: card.referenceValue ?? null
  });

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: isInCollection ? 140 : 220 + insets.bottom },
          contentContainerStyle
        ]}
      >
        {topSpacerHeight > 0 ? <View style={{ height: topSpacerHeight }} /> : null}
        {!hideCloseButton ? (
          <Pressable
            onPress={() => {
              router.replace("/(tabs)/collection");
            }}
            hitSlop={10}
            style={styles.backBtn}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        <CardIdentityHeader
          card={card}
          auraColor={rarityVisuals.auraColor}
          auraBaseOpacity={rarityVisuals.auraBaseOpacity}
          auraPulseOpacity={rarityVisuals.auraPulseOpacity}
          revealPulseToken={heroRevealPulseToken}
          revealPulseDurationMs={rarityVisuals.revealPulseDurationMs}
        />
        <SecondaryButton title="Edit Fields" onPress={onEditResult} />

        <ValuePanel
          value={displayValue}
          condition={`Condition ${card.condition}`}
          gradeScore={card.gradeScore}
          rarityLabel={card.rarityLabel}
          rarityLevel={card.rarityLevel}
          enableRarityReveal
          rarityRevealDelayMs={rarityVisuals.revealDelayMs}
          onRarityRevealed={handleRarityRevealed}
        />
        {showsAttributeAdjustedValue ? (
          <Text style={styles.adjustedHelper}>Adjusted for attributes - Base card value ${baseReferenceValue.toFixed(2)}</Text>
        ) : null}

        <View style={styles.marketLayerIntro}>
          <Text style={styles.marketLayerTitle}>Market Intelligence</Text>
          <Text style={styles.marketLayerCopy}>{marketStory}</Text>
        </View>

        <View style={styles.marketPreviewStack}>
          <ActiveListingsPanel
            cardId={recentSalesCardId}
            card={linkedCollectionItem ?? card}
            referenceValue={displayValue}
            maxItems={4}
            onOpenDetails={
              detailRouteParams
                ? () => {
                    analyticsService.track(ANALYTICS_EVENTS.activeMarketPreviewOpened, {
                      cardId: recentSalesCardId ?? card.id,
                      sourceScanId: sourceScanId ?? undefined
                    });
                    router.push({ pathname: "/results/active-market/[id]", params: detailRouteParams });
                  }
                : undefined
            }
          />
          <PriceHistoryPanel
            cardId={recentSalesCardId}
            referenceValue={displayValue}
            onOpenDetails={
              detailRouteParams
                ? () => {
                    analyticsService.track(ANALYTICS_EVENTS.priceHistoryPreviewOpened, {
                      cardId: recentSalesCardId ?? card.id,
                      sourceScanId: sourceScanId ?? undefined
                    });
                    if (!premium) {
                      presentPaywall(
                        "premium_feature_gate",
                        recentSalesCardId ? { cardId: recentSalesCardId } : undefined
                      );
                      return;
                    }
                    router.push({ pathname: "/results/price-history/[id]", params: detailRouteParams });
                  }
                : undefined
            }
          />
          <GradingOutlookPanel
            cardId={recentSalesCardId}
            rawValue={displayValue}
            sourceScanId={detailCollectionItem?.sourceScanId ?? sourceScanId ?? undefined}
            onOpenDetails={
              detailRouteParams
                ? () => {
                    analyticsService.track(ANALYTICS_EVENTS.gradingOutlookPreviewOpened, {
                      cardId: recentSalesCardId ?? card.id,
                      sourceScanId: sourceScanId ?? undefined
                    });
                    router.push({ pathname: "/results/grading-outlook/[id]", params: detailRouteParams });
                  }
                : undefined
            }
          />
        </View>

        <View style={styles.contextStack}>
        <Panel style={styles.intelPanel}>
          <View style={styles.moduleHead}>
            <View style={styles.moduleHeadFill}>
              <ResultsModuleHeader title="Card Specs" eyebrow="Identity details" />
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={11} color={colors.accentPrimary} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>
          {specRows.map((item, index) => (
            <View key={item.label} style={[styles.specRow, index < specRows.length - 1 ? styles.specRowDivider : null]}>
              <Text style={styles.specLabel}>{item.label}</Text>
              <Text style={styles.specValue}>{item.value}</Text>
            </View>
          ))}
        </Panel>

        <Panel style={styles.intelPanel}>
          <ResultsModuleHeader title="Player Context" eyebrow="Collector context" />
          <View style={styles.contextRow}>
            <Text style={styles.contextLabel}>Name</Text>
            <Text style={styles.contextValue}>{card.playerName}</Text>
          </View>
          <View style={[styles.contextRow, styles.contextRowDivider]}>
            <Text style={styles.contextLabel}>Era</Text>
            <Text style={styles.contextValue}>{card.playerInfo.era}</Text>
          </View>
          <View style={styles.careerNoteWrap}>
            <Text style={styles.careerNoteLabel}>Career Note</Text>
            <Text style={styles.careerNoteText}>{card.playerInfo.careerNote}</Text>
          </View>
        </Panel>

        <Panel style={styles.intelPanel}>
          <ResultsModuleHeader title="Collector Context" eyebrow="Why it matters" />
          <View style={styles.collectorInsight}>
            <Text style={styles.collectorCopy}>{card.description}</Text>
          </View>
        </Panel>

        {attributeLines.length ? (
          <Panel style={styles.intelPanel}>
            <ResultsModuleHeader title="Collection Attributes" eyebrow="Saved details" />
            <View style={styles.attributesWrap}>
              {attributeLines.map((line) => (
                <View key={line} style={styles.attributeChip}>
                  <Text style={styles.attributeChipText}>{line}</Text>
                </View>
              ))}
            </View>
          </Panel>
        ) : null}

        {preferences.collectorAiEnabled ? (
          <Panel style={styles.aiPanel}>
            <ResultsModuleHeader title="Next Step" eyebrow="Decision support" />
            <Text style={styles.aiLead}>Ask Collector AI what stands out, whether grading is worth it, or what to do next with this card.</Text>
            <Text style={styles.aiSupportCopy}>Get a grounded collector take built from this card's value, rarity, market context, and grading outlook.</Text>
            <SecondaryButton
              title="Ask Collector AI"
              onPress={() => {
                analyticsService.track(ANALYTICS_EVENTS.askAiFromResults, {
                  cardId: card.id,
                  sourceScanId: sourceScanId ?? undefined
                });
                if (enterAiOrPaywall(card.id)) router.push(`/chat/${card.id}`);
              }}
              style={styles.askAiButton}
            />
          </Panel>
        ) : null}
        </View>
        <Pressable onPress={onReportIncorrect} style={styles.reportWrap}>
          <Text style={styles.report}>{isReporting ? "Reporting..." : "Report Incorrect Result"}</Text>
        </Pressable>
      </ScrollView>

      {!isInCollection && (
        <View style={[styles.stickyWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.stickyInner}>
            <PrimaryButton
              title="Add to Collection"
              onPress={async () => {
                analyticsService.track(ANALYTICS_EVENTS.addToCollectionFromResults, {
                  cardId: card.id,
                  sourceScanId: sourceScanId ?? undefined
                });
                if (sourceScanId) {
                  const result = await addProcessedScanToCollection(sourceScanId);
                  if (result.added || result.alreadyExists) {
                    router.replace("/(tabs)/collection");
                  }
                  return;
                }

                const result = addCardToCollection(card.id);
                if (result.added || result.alreadyExists) {
                  router.replace("/(tabs)/collection");
                }
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundPrimary },
  content: { padding: layout.pagePadding, gap: 14, paddingBottom: 140 },
  backBtn: {
    alignSelf: "flex-start"
  },
  intelPanel: {
    borderColor: "#E6EAF0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 0
  },
  moduleHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0
  },
  moduleHeadFill: {
    flex: 1
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#F0D8D7",
    backgroundColor: "#FFF8F7",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  verifiedText: {
    ...typography.Caption,
    color: colors.accentPrimary,
    fontFamily: "Inter-Medium"
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8
  },
  specRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F5"
  },
  specLabel: {
    ...typography.Caption,
    color: "#646E7E"
  },
  specValue: {
    ...typography.BodyMedium,
    color: "#141923",
    fontFamily: "Inter-SemiBold",
    textAlign: "right",
    flexShrink: 1
  },
  contextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 7
  },
  contextRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F5",
    marginBottom: 10
  },
  contextLabel: {
    ...typography.Caption,
    color: "#646E7E"
  },
  contextValue: {
    ...typography.BodyMedium,
    color: "#141923",
    fontFamily: "Inter-Medium",
    textAlign: "right",
    flexShrink: 1
  },
  careerNoteWrap: {
    borderWidth: 1,
    borderColor: "#ECEFF4",
    backgroundColor: "#FBFCFE",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  careerNoteLabel: {
    ...typography.Caption,
    color: "#6A7281",
    marginBottom: 4
  },
  careerNoteText: {
    ...typography.BodyMedium,
    color: "#1B2230",
    lineHeight: 20
  },
  collectorInsight: {
    borderWidth: 1,
    borderColor: "#ECEFF4",
    backgroundColor: "#FAFBFD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  collectorCopy: {
    ...typography.BodyMedium,
    color: "#202737",
    lineHeight: 21
  },
  adjustedHelper: {
    ...typography.Caption,
    color: colors.textSecondary,
    marginTop: -6
  },
  marketLayerIntro: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 3,
    marginTop: -2
  },
  marketLayerTitle: {
    ...typography.Caption,
    color: "#8A93A3",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Inter-Medium"
  },
  marketLayerCopy: {
    ...typography.BodyMedium,
    color: "#445062",
    lineHeight: 20
  },
  marketPreviewStack: {
    gap: 12
  },
  contextStack: {
    gap: 12,
    marginTop: 4
  },
  attributesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  attributeChip: {
    borderWidth: 1,
    borderColor: "#E7EBF1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#FAFBFD"
  },
  attributeChipText: {
    ...typography.Caption,
    color: "#2B3446",
    fontFamily: "Inter-Medium"
  },
  aiPanel: {
    borderColor: "#E6EAF0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10
  },
  aiLead: {
    ...typography.BodyMedium,
    color: "#1D2430",
    lineHeight: 20,
    fontFamily: "Inter-Medium"
  },
  aiSupportCopy: {
    ...typography.BodyMedium,
    color: "#4F596B",
    lineHeight: 20
  },
  askAiButton: {
    backgroundColor: "#E9EDF3",
    borderColor: "#DAE1EB"
  },
  reportWrap: {
    marginTop: -4,
    paddingVertical: 4
  },
  report: {
    ...typography.Caption,
    textAlign: "center",
    color: "#6C7483",
    fontFamily: "Inter-Medium"
  },
  stickyWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.pagePadding,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.94)"
  },
  stickyInner: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 2
  }
});
