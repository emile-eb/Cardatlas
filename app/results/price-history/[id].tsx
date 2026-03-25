import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ResultsDetailScaffold } from "@/components/results/ResultsDetailScaffold";
import { ResultsDetailStatusState } from "@/components/results/ResultsDetailStatusState";
import { useAppState } from "@/state/AppState";
import { scanProcessingService, type ProcessedScanResult } from "@/services/scans/ScanProcessingService";
import { colors, typography } from "@/theme/tokens";
import {
  PRICE_HISTORY_TIMEFRAMES,
  filterHistoryPoints,
  formatMoney,
  getHistoryDensity,
  getHistoryRangeStats,
  getHistorySupportCopy,
  getTrendInsight,
  toChartPoints
} from "@/features/results/priceHistory";
import type { CardItem } from "@/types/models";
import type { PriceHistoryPoint, PriceHistoryTimeframe } from "@/types";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { findCollectionCard, resolveResultsDetailBackHref } from "@/features/results/detailRoute";
import { priceHistoryService } from "@/services/priceHistory/PriceHistoryService";

export default function PriceHistoryDetailScreen() {
  const { id, from, collectionItemId, backTo } = useLocalSearchParams<{ id: string; from?: string; collectionItemId?: string; backTo?: string }>();
  const { cards, premium, presentPaywall } = useAppState();
  const [result, setResult] = useState<ProcessedScanResult | null>(null);
  const [card, setCard] = useState<CardItem | null>(null);
  const [timeframe, setTimeframe] = useState<PriceHistoryTimeframe>("30D");
  const [chartWidth, setChartWidth] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyPoints, setHistoryPoints] = useState<PriceHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const isCollectionContext = from === "collection";
  const backHref = resolveResultsDetailBackHref({ backTo, isCollectionContext, collectionItemId, resultId: id });

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        setErrorText("We couldn't open this price history view because the card context is missing.");
        analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
          page: "price_history",
          reason: "missing_id"
        });
        return;
      }

      try {
        setErrorText(null);
        if (isCollectionContext) {
          const nextCard = findCollectionCard(cards, id, collectionItemId);
          if (!active) return;
          if (!nextCard) {
            setErrorText("We couldn't find the card behind this price history view.");
            analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
              page: "price_history",
              reason: "missing_collection_card",
              resultId: id
            });
            return;
          }
          setCard(nextCard);
          setResult(null);
          return;
        }

        const next = await scanProcessingService.getProcessedScanResult(id);
        if (!active) return;
        if (!next?.card) {
          setErrorText("We couldn't find the scan result behind this price history view.");
          analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
            page: "price_history",
            reason: "missing_scan_result",
            resultId: id
          });
          return;
        }
        setResult(next);
        setCard(next.card);
      } catch (error) {
        if (!active) return;
        setErrorText("We couldn't load price history right now. Please try again.");
        analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
          page: "price_history",
          reason: "load_failed",
          resultId: id
        });
        if (__DEV__) {
          console.log("[price_history] detail_load_failed", error);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [cards, collectionItemId, id, isCollectionContext]);

  const priceHistoryCardId = card?.sourceCardId ?? card?.id ?? null;

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!priceHistoryCardId) {
        if (!active) return;
        setHistoryPoints([]);
        setHistoryLoading(false);
        return;
      }

      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const next = await priceHistoryService.getCardHistory(priceHistoryCardId);
        if (!active) return;
        setHistoryPoints(next.points);
      } catch (error) {
        if (!active) return;
        setHistoryPoints([]);
        setHistoryError("We couldn't load stored price history right now. Please try again.");
        if (__DEV__) {
          console.log("[price_history] history_load_failed", error);
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();
    return () => {
      active = false;
    };
  }, [priceHistoryCardId]);

  const referenceValue = Number(card?.referenceValue ?? 0);
  const visibleHistory = useMemo(() => filterHistoryPoints(historyPoints, timeframe), [historyPoints, timeframe]);
  const visibleSeries = useMemo(() => visibleHistory.map((point) => point.referenceValue), [visibleHistory]);
  const points = useMemo(() => toChartPoints(visibleSeries, chartWidth, 260), [visibleSeries, chartWidth]);
  const stats = useMemo(() => getHistoryRangeStats(visibleHistory), [visibleHistory]);
  const density = getHistoryDensity(visibleHistory.length);
  const deltaPct = stats?.deltaPct ?? 0;
  const high = stats?.max ?? referenceValue;
  const low = stats?.min ?? referenceValue;
  const current = stats?.last ?? referenceValue;
  const isLocked = !premium;

  if (!card && !errorText) {
    return (
      <ResultsDetailStatusState
        title="Loading price history"
        message="Preparing market history behind this card's current value."
        backHref={backHref}
        actionLabel="Back"
      />
    );
  }

  if (!card || (errorText && premium)) {
    return <ResultsDetailStatusState title="Price History Unavailable" message={errorText ?? "We couldn't load this price history view."} backHref={backHref} />;
  }

  const onChartLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  return (
    <ResultsDetailScaffold
      card={card}
      referenceValue={referenceValue}
      title="Price History"
      subtitle="Historical market movement behind the current CardAtlas Reference Value."
      resultId={id}
      backHref={backHref}
    >
      <View style={styles.chartHero}>
        <View style={styles.chartTopRow}>
          <View style={styles.chartCopy}>
            <Text style={styles.chartKicker}>Historical market</Text>
            <Text style={styles.chartValue}>
              {isLocked
                ? "Track price movement"
                : density === "empty" || density === "single"
                  ? "Building"
                  : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`}
            </Text>
            <Text style={styles.chartSupport}>
              {isLocked
                ? "See how this card's market value changes over time across different windows."
                : density === "empty"
                  ? "CardAtlas will fill this view as tracked snapshots accumulate."
                  : "Period change leading into the current CardAtlas Reference Value"}
            </Text>
          </View>
        </View>

        <View style={styles.chartStage} onLayout={onChartLayout}>
          <View style={styles.gridLineTop} />
          <View style={styles.gridLineMid} />
          <View style={styles.gridLineBottom} />
          <View style={styles.referenceGuide} />

          {historyLoading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator size="small" color={colors.accentPrimary} />
              <Text style={styles.stateTitle}>Preparing tracked history</Text>
              <Text style={styles.stateCopy}>Loading stored reference points for this card.</Text>
            </View>
          ) : historyError && !isLocked ? (
            <View style={styles.stateWrap}>
              <Text style={styles.stateTitle}>History unavailable</Text>
              <Text style={styles.stateCopy}>{historyError}</Text>
            </View>
          ) : density === "empty" ? (
            <View style={styles.stateWrap}>
              <Text style={styles.stateTitle}>No tracked history yet</Text>
              <Text style={styles.stateCopy}>This card has not accumulated enough saved snapshots to chart yet.</Text>
            </View>
          ) : (
            points.map((point, index) => (
              <View
                key={`${timeframe}-${index}`}
                style={[
                  styles.chartBar,
                  {
                    left: point.x,
                    height: Math.max(28, 260 - point.y),
                    opacity: isLocked
                      ? index > points.length - 6 ? 0.34 : 0.2
                      : index > points.length - 6 ? 0.96 : 0.62
                  }
                ]}
              />
            ))
          )}

          {isLocked && !historyLoading ? (
            <View style={styles.lockOverlay}>
              <View style={styles.lockCard}>
                <View style={styles.lockIconWrap}>
                  <Ionicons name="trending-up-outline" size={18} color={colors.accentPrimary} />
                </View>
                <Text style={styles.lockTitle}>Unlock Price History</Text>
                <Text style={styles.lockCopy}>
                  Price History shows how this card's market value moves over time so you can spot trends, compare short-term swings, and make better buy, hold, or sell decisions. Upgrade to CardAtlas Pro to unlock it.
                </Text>
                <Pressable
                  onPress={() => {
                    analyticsService.track(ANALYTICS_EVENTS.priceHistoryUpgradeTapped, {
                      cardId: priceHistoryCardId ?? undefined,
                      timeframe
                    });
                    presentPaywall("premium_feature_gate", priceHistoryCardId ? { cardId: priceHistoryCardId } : undefined);
                  }}
                  style={({ pressed }) => [styles.lockButton, pressed && styles.lockButtonPressed]}
                >
                  <Text style={styles.lockButtonText}>Upgrade to Pro</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>High</Text>
            <Text style={[styles.statValue, isLocked && styles.statValueLocked]}>
              {density === "empty" ? "-" : isLocked ? "Locked" : formatMoney(high)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Low</Text>
            <Text style={[styles.statValue, isLocked && styles.statValueLocked]}>
              {density === "empty" ? "-" : isLocked ? "Locked" : formatMoney(low)}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={[styles.statValue, isLocked && styles.statValueLocked]}>
              {density === "empty" ? "-" : isLocked ? "Locked" : formatMoney(current)}
            </Text>
          </View>
        </View>

        <View style={styles.timeframeWrap}>
          {PRICE_HISTORY_TIMEFRAMES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setTimeframe(item)}
              style={({ pressed }) => [
                styles.timeframePill,
                timeframe === item && styles.timeframePillActive,
                pressed && styles.timeframePillPressed
              ]}
            >
              <Text style={[styles.timeframeText, timeframe === item && styles.timeframeTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.readBlock}>
        <Text style={styles.readLabel}>{isLocked ? "Why it matters" : "CardAtlas read"}</Text>
        <Text style={styles.readCopy}>
          {isLocked
            ? "Price History helps collectors understand whether a card is strengthening, cooling off, or staying flat before making a move."
            : getTrendInsight(deltaPct, visibleHistory.length)}
        </Text>
        <Text style={styles.readSupport}>
          {isLocked
            ? "Upgrade to Pro to unlock full historical trend visibility across every supported timeframe."
            : getHistorySupportCopy(visibleHistory.length)}
        </Text>
      </View>
    </ResultsDetailScaffold>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundPrimary
  },
  loading: {
    ...typography.BodyMedium,
    color: "#66707F"
  },
  chartHero: {
    borderWidth: 1,
    borderColor: "#E9EDF2",
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 18
  },
  chartTopRow: {
    gap: 16
  },
  chartCopy: {
    gap: 4
  },
  chartKicker: {
    ...typography.Caption,
    color: "#8B94A3",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Inter-Medium"
  },
  chartValue: {
    ...typography.H1,
    color: "#10161F",
    fontFamily: "Inter-Bold",
    fontSize: 42,
    lineHeight: 44
  },
  chartSupport: {
    ...typography.BodyMedium,
    color: "#5B6575",
    lineHeight: 21,
    maxWidth: 280
  },
  timeframeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  timeframePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F6F8FB"
  },
  timeframePillActive: {
    backgroundColor: "#FFF2F0"
  },
  timeframePillPressed: {
    opacity: 0.78
  },
  timeframeText: {
    ...typography.Caption,
    color: "#6D7787",
    fontFamily: "Inter-SemiBold"
  },
  timeframeTextActive: {
    color: colors.accentPrimary
  },
  chartStage: {
    position: "relative",
    height: 260,
    overflow: "hidden",
    justifyContent: "flex-end"
  },
  gridLineTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 14,
    height: 1,
    backgroundColor: "#F0F3F7"
  },
  gridLineMid: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 130,
    height: 1,
    backgroundColor: "#F2F5F8"
  },
  gridLineBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: "#D6DEE8"
  },
  referenceGuide: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "74%",
    width: 1,
    backgroundColor: "rgba(225, 6, 0, 0.18)"
  },
  chartBar: {
    position: "absolute",
    bottom: 1,
    width: 6,
    marginLeft: -3,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    backgroundColor: "#1A2230"
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  lockCard: {
    width: "100%",
    maxWidth: 292,
    borderWidth: 1,
    borderColor: "#ECEFF4",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
  },
  lockIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#F0D0CD",
    backgroundColor: "#FFF7F6",
    alignItems: "center",
    justifyContent: "center"
  },
  lockTitle: {
    ...typography.BodyLarge,
    color: "#10161F",
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  lockCopy: {
    ...typography.BodyMedium,
    color: "#5B6575",
    textAlign: "center",
    lineHeight: 20
  },
  lockButton: {
    minWidth: 124,
    borderRadius: 999,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  lockButtonPressed: {
    opacity: 0.88
  },
  lockButtonText: {
    ...typography.BodyMedium,
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  stateWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8
  },
  stateTitle: {
    ...typography.BodyLarge,
    color: "#10161F",
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  stateCopy: {
    ...typography.BodyMedium,
    color: "#5B6575",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: "#EEF2F6",
    paddingTop: 15
  },
  stat: {
    flex: 1,
    gap: 3
  },
  statDivider: {
    width: 1,
    backgroundColor: "#EEF2F6",
    marginHorizontal: 14
  },
  statLabel: {
    ...typography.Caption,
    color: "#7D8695"
  },
  statValue: {
    ...typography.BodyLarge,
    color: "#10161F",
    fontFamily: "Inter-SemiBold"
  },
  statValueLocked: {
    color: "#8A93A1"
  },
  readBlock: {
    gap: 4,
    paddingTop: 2
  },
  readLabel: {
    ...typography.Caption,
    color: "#8B94A3",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Inter-Medium"
  },
  readCopy: {
    ...typography.BodyMedium,
    color: "#465162",
    lineHeight: 22
  },
  readSupport: {
    ...typography.bodySmall,
    color: "#6D7686",
    lineHeight: 19
  }
});
