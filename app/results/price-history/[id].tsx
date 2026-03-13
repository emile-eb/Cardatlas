import { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ResultsDetailScaffold } from "@/components/results/ResultsDetailScaffold";
import { ResultsDetailStatusState } from "@/components/results/ResultsDetailStatusState";
import { useAppState } from "@/state/AppState";
import { scanProcessingService, type ProcessedScanResult } from "@/services/scans/ScanProcessingService";
import { colors, typography } from "@/theme/tokens";
import {
  PRICE_HISTORY_TIMEFRAMES,
  enforceUpwardTrend,
  formatMoney,
  generateSeries,
  smoothSeries,
  toChartPoints,
  type PriceHistoryTimeframe
} from "@/features/results/priceHistory";
import type { CardItem } from "@/types/models";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { findCollectionCard, resolveResultsDetailBackHref } from "@/features/results/detailRoute";

function getTrendInsight(deltaPct: number) {
  if (Math.abs(deltaPct) < 4) {
    return "Historical movement has stayed relatively stable, which supports the current CardAtlas Reference Value.";
  }

  if (deltaPct > 0) {
    return "Recent price movement has climbed into the current CardAtlas Reference Value and still shows constructive momentum.";
  }

  return "Recent movement has cooled into the current CardAtlas Reference Value, which suggests softer momentum around the current range.";
}

export default function PriceHistoryDetailScreen() {
  const { id, from, collectionItemId, backTo } = useLocalSearchParams<{ id: string; from?: string; collectionItemId?: string; backTo?: string }>();
  const { cards } = useAppState();
  const [result, setResult] = useState<ProcessedScanResult | null>(null);
  const [card, setCard] = useState<CardItem | null>(null);
  const [timeframe, setTimeframe] = useState<PriceHistoryTimeframe>("1M");
  const [chartWidth, setChartWidth] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);

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

  const referenceValue = Number(card?.referenceValue ?? 0);
  const rawSeries = useMemo(
    () => generateSeries(card?.sourceCardId ?? card?.id ?? "cardatlas", referenceValue, timeframe),
    [card?.id, card?.sourceCardId, referenceValue, timeframe]
  );
  const visibleSeries = useMemo(() => smoothSeries(enforceUpwardTrend(rawSeries)), [rawSeries]);
  const points = useMemo(() => toChartPoints(visibleSeries, chartWidth, 260), [visibleSeries, chartWidth]);
  const first = visibleSeries[0] ?? referenceValue;
  const last = visibleSeries[visibleSeries.length - 1] ?? referenceValue;
  const deltaPct = first > 0 ? ((last - first) / first) * 100 : 0;
  const high = Math.max(...visibleSeries);
  const low = Math.min(...visibleSeries);

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

  if (!card || errorText) {
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
            <Text style={styles.chartValue}>{deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}%</Text>
            <Text style={styles.chartSupport}>Period change leading into the current CardAtlas Reference Value</Text>
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

        <View style={styles.chartStage} onLayout={onChartLayout}>
          <View style={styles.gridLineTop} />
          <View style={styles.gridLineMid} />
          <View style={styles.gridLineBottom} />
          <View style={styles.referenceGuide} />

          {points.map((point, index) => (
            <View
              key={`${timeframe}-${index}`}
              style={[
                styles.chartBar,
                {
                  left: point.x,
                  height: Math.max(28, 260 - point.y),
                  opacity: index > points.length - 6 ? 0.96 : 0.62
                }
              ]}
            />
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>High</Text>
            <Text style={styles.statValue}>{formatMoney(high)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Low</Text>
            <Text style={styles.statValue}>{formatMoney(low)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statValue}>{formatMoney(last)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.readBlock}>
        <Text style={styles.readLabel}>CardAtlas read</Text>
        <Text style={styles.readCopy}>{getTrendInsight(deltaPct)}</Text>
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
    maxWidth: 260
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
  }
});
