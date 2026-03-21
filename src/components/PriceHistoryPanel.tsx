import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Panel } from "./Panel";
import { useAppState } from "@/state/AppState";
import { ResultsModuleHeader } from "@/components/results/ResultsModuleHeader";
import { colors, typography } from "@/theme/tokens";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import {
  PRICE_HISTORY_TIMEFRAMES,
  formatMoney as money,
  filterHistoryPoints,
  getHistoryDensity,
  getHistoryRangeStats,
  getHistorySupportCopy,
  toChartPoints
} from "@/features/results/priceHistory";
import type { PriceHistoryPoint, PriceHistoryTimeframe } from "@/types";
import { priceHistoryService } from "@/services/priceHistory/PriceHistoryService";

type Props = {
  cardId?: string | null;
  referenceValue: number;
  onOpenDetails?: () => void;
};
export function PriceHistoryPanel({ cardId, referenceValue, onOpenDetails }: Props) {
  const { premium, presentPaywall } = useAppState();
  const [timeframe, setTimeframe] = useState<PriceHistoryTimeframe>("30D");
  const [chartWidth, setChartWidth] = useState(0);
  const [historyPoints, setHistoryPoints] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const chartHeight = 144;
  const chartAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!cardId) {
        if (!active) return;
        setHistoryPoints([]);
        setHistoryError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setHistoryError(null);
        const next = await priceHistoryService.getCardHistory(cardId);
        if (!active) return;
        setHistoryPoints(next.points);
      } catch (error) {
        if (!active) return;
        setHistoryPoints([]);
        setHistoryError("Price history isn't available right now.");
        if (__DEV__) {
          console.log("[price_history] panel_load_failed", error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [cardId]);

  useEffect(() => {
    chartAnim.setValue(0);
    Animated.timing(chartAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true
    }).start();
  }, [timeframe, historyPoints, chartAnim]);

  const visiblePoints = useMemo(() => filterHistoryPoints(historyPoints, timeframe), [historyPoints, timeframe]);
  const visibleValues = useMemo(() => visiblePoints.map((point) => point.referenceValue), [visiblePoints]);
  const stats = useMemo(() => getHistoryRangeStats(visiblePoints), [visiblePoints]);
  const density = getHistoryDensity(visiblePoints.length);
  const deltaPct = stats?.deltaPct ?? 0;
  const deltaText = density === "empty" || density === "single" ? "Building" : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`;
  const deltaColor = density === "ready" || density === "building" ? (deltaPct >= 0 ? "#1F7A45" : colors.accentPrimary) : "#7B8493";
  const points = useMemo(() => toChartPoints(visibleValues, chartWidth, chartHeight), [visibleValues, chartWidth]);

  const onChartLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };
  const minValue = stats?.min ?? referenceValue;
  const maxValue = stats?.max ?? referenceValue;

  return (
    <Panel style={styles.panel}>
      <ResultsModuleHeader
        title="Price History"
        trailingLabel={onOpenDetails ? undefined : "Market trend"}
        onPressAction={onOpenDetails}
      />

      <View style={styles.marketSummaryStrip}>
        <View style={styles.marketSummaryCell}>
          <Text style={styles.marketSummaryLabel}>Current Ref</Text>
          <Text style={styles.marketSummaryValue}>{money(stats?.last ?? referenceValue)}</Text>
        </View>
        <View style={[styles.marketSummaryCell, styles.marketSummaryDivider]}>
          <Text style={styles.marketSummaryLabel}>Range</Text>
          <Text style={styles.marketSummaryValue}>
            {density === "empty" ? "Not tracked yet" : `${money(minValue)} - ${money(maxValue)}`}
          </Text>
        </View>
        <View style={[styles.marketSummaryCell, styles.marketSummaryDivider]}>
          <Text style={styles.marketSummaryLabel}>{timeframe}</Text>
          <Text style={[styles.marketSummaryValue, { color: deltaColor }]}>{deltaText}</Text>
        </View>
      </View>

      <View style={styles.chartWrap} onLayout={onChartLayout}>
        <View style={styles.chartTone} />
        <View style={styles.axisY} />
        <View style={styles.axisX} />

        {loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator size="small" color={colors.accentPrimary} />
            <Text style={styles.stateTitle}>Preparing tracked history</Text>
            <Text style={styles.stateCopy}>Loading saved reference points for this card.</Text>
          </View>
        ) : historyError ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateTitle}>History unavailable</Text>
            <Text style={styles.stateCopy}>{historyError}</Text>
          </View>
        ) : density === "empty" ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateTitle}>No tracked history yet</Text>
            <Text style={styles.stateCopy}>CardAtlas will start filling this timeline as snapshots accumulate for this card.</Text>
          </View>
        ) : (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lineLayer,
              {
                opacity: chartAnim.interpolate({ inputRange: [0, 1], outputRange: [0.28, premium ? 1 : 0.7] }),
                transform: [
                  {
                    translateX: chartAnim.interpolate({ inputRange: [0, 1], outputRange: [9, 0] })
                  }
                ]
              }
            ]}
          >
            <View style={styles.chartBarsRow}>
              {points.map((point, index) => (
                <View
                  key={`${timeframe}-${index}`}
                  style={[
                    styles.chartBar,
                    {
                      left: point.x,
                      height: Math.max(18, chartHeight - point.y),
                      opacity: premium ? 0.88 : 0.5
                    }
                  ]}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {!premium && density !== "empty" && !loading && !historyError ? (
          <View style={styles.lockOverlay}>
            <View style={styles.lockPromptCard}>
              <View style={styles.lockPromptIconWrap}>
                <Ionicons name="trending-up-outline" size={14} color={colors.accentPrimary} />
              </View>
              <Text style={styles.lockPromptTitle}>Unlock Price History</Text>
              <Text style={styles.lockPromptSubtitle}>View market movement over time for this card.</Text>
              <Pressable
                onPress={() => {
                  analyticsService.track(ANALYTICS_EVENTS.priceHistoryUpgradeTapped, {
                    cardId: cardId ?? undefined,
                    timeframe
                  });
                  presentPaywall("premium_feature_gate", cardId ? { cardId } : undefined);
                }}
                style={({ pressed }) => [styles.lockPromptBtn, pressed && styles.lockPromptBtnPressed]}
              >
                <Text style={styles.lockPromptBtnText}>Upgrade</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {!loading && !historyError ? <Text style={styles.supportText}>{getHistorySupportCopy(visiblePoints.length)}</Text> : null}

      <View style={styles.timeframeRow}>
        {PRICE_HISTORY_TIMEFRAMES.map((tf) => (
          <Pressable
            key={tf}
            onPress={() => setTimeframe(tf)}
            style={({ pressed }) => [
              styles.timeframeControl,
              timeframe === tf && styles.timeframeControlActive,
              pressed && styles.timeframePillPressed
            ]}
          >
            <Text style={[styles.timeframeText, timeframe === tf && styles.timeframeTextActive]}>{tf}</Text>
            {timeframe === tf ? <View style={styles.timeframeActiveLine} /> : <View style={styles.timeframeGhostLine} />}
          </Pressable>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderColor: "#E6EAF0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  marketSummaryStrip: {
    borderWidth: 1,
    borderColor: "#E8ECF2",
    borderRadius: 12,
    flexDirection: "row",
    backgroundColor: "#FBFCFE",
    paddingHorizontal: 4,
    marginBottom: 12
  },
  marketSummaryCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  marketSummaryDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#EEF2F6"
  },
  marketSummaryLabel: {
    ...typography.Caption,
    color: "#727B8B"
  },
  marketSummaryValue: {
    ...typography.BodyMedium,
    color: "#11151D",
    fontFamily: "Inter-SemiBold"
  },
  chartWrap: {
    position: "relative",
    height: 144,
    borderRadius: 0,
    backgroundColor: "transparent",
    overflow: "hidden"
  },
  chartTone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF"
  },
  axisY: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#C7CFDB"
  },
  axisX: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: "#C7CFDB"
  },
  lineLayer: {
    ...StyleSheet.absoluteFillObject
  },
  chartBarsRow: {
    ...StyleSheet.absoluteFillObject
  },
  chartBar: {
    position: "absolute",
    bottom: 1,
    width: 4,
    marginLeft: -2,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: "#C9D2DE"
  },
  stateWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 6
  },
  stateTitle: {
    ...typography.BodyMedium,
    color: "#11151D",
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  stateCopy: {
    ...typography.bodySmall,
    color: "#6D7686",
    textAlign: "center",
    lineHeight: 17
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(251,252,254,0.62)",
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  lockPromptCard: {
    width: "100%",
    maxWidth: 208,
    borderWidth: 1,
    borderColor: "#ECEFF4",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 5
  },
  lockPromptIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F0D0CD",
    backgroundColor: "#FFF7F6",
    alignItems: "center",
    justifyContent: "center"
  },
  lockPromptTitle: {
    ...typography.BodyMedium,
    color: "#11151D",
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  lockPromptSubtitle: {
    ...typography.bodySmall,
    color: "#6D7686",
    textAlign: "center",
    lineHeight: 16
  },
  lockPromptBtn: {
    marginTop: 0,
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  lockPromptBtnPressed: {
    opacity: 0.82
  },
  lockPromptBtnText: {
    ...typography.Caption,
    color: colors.accentPrimary,
    fontFamily: "Inter-SemiBold",
    fontSize: 10
  },
  supportText: {
    ...typography.bodySmall,
    color: "#6D7686",
    marginTop: 10,
    lineHeight: 18
  },
  timeframeRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  timeframeControl: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
    gap: 4
  },
  timeframeControlActive: {
    transform: [{ translateY: -0.5 }]
  },
  timeframePillPressed: {
    opacity: 0.84
  },
  timeframeText: {
    ...typography.Caption,
    color: "#7B8493",
    fontFamily: "Inter-Medium"
  },
  timeframeTextActive: {
    color: "#8E1D17",
    fontFamily: "Inter-SemiBold"
  },
  timeframeActiveLine: {
    width: 20,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.accentPrimary
  },
  timeframeGhostLine: {
    width: 20,
    height: 2,
    borderRadius: 2,
    backgroundColor: "transparent"
  }
});
