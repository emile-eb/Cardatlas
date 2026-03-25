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
  const points = useMemo(() => toChartPoints(visibleValues, chartWidth, chartHeight), [visibleValues, chartWidth]);

  const onChartLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  return (
    <Panel style={styles.panel}>
      <ResultsModuleHeader
        title="Price History"
        trailingLabel={onOpenDetails ? undefined : "Market trend"}
        onPressAction={onOpenDetails}
      />

      {premium ? (
        <View style={styles.chartWrap} onLayout={onChartLayout}>
          <View style={styles.chartTone} />
          <View style={styles.chartGlow} pointerEvents="none" />
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
                  opacity: chartAnim.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] }),
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
                        opacity: 0.88
                      }
                    ]}
                  />
                ))}
              </View>
            </Animated.View>
          )}
        </View>
      ) : (
        <View style={styles.lockStandaloneCard}>
          <View style={styles.lockPromptIconWrap}>
            <Ionicons name="trending-up-outline" size={16} color={colors.accentPrimary} />
          </View>
          <Text style={styles.lockPromptTitle}>Unlock Price History</Text>
          <Text style={styles.lockPromptSubtitle}>
            See how this card's value moves over time and spot trends before you buy, hold, or sell.
          </Text>
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
      )}

      {!loading && premium ? (
        <View style={styles.supportCard}>
          <Text style={styles.supportText}>
            {historyError
              ? "Price history couldn't be loaded right now."
              : getHistorySupportCopy(visiblePoints.length)}
          </Text>
        </View>
      ) : null}

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
    borderColor: "#E5E9F0",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FCFDFE",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 2
  },
  chartWrap: {
    position: "relative",
    height: 144,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    marginTop: 10
  },
  chartTone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FBFCFE"
  },
  chartGlow: {
    position: "absolute",
    top: -32,
    right: -18,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(225, 6, 0, 0.06)"
  },
  axisY: {
    position: "absolute",
    left: 14,
    top: 16,
    bottom: 14,
    width: 1,
    backgroundColor: "#D8E0EA"
  },
  axisX: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    height: 1,
    backgroundColor: "#D8E0EA"
  },
  lineLayer: {
    ...StyleSheet.absoluteFillObject
  },
  chartBarsRow: {
    ...StyleSheet.absoluteFillObject
  },
  chartBar: {
    position: "absolute",
    bottom: 15,
    width: 4,
    marginLeft: -2,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: "#C7D2E1"
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
  lockStandaloneCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#E8EDF4",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
    shadowColor: "#111827",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1
  },
  lockPromptIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0D0CD",
    backgroundColor: "#FFF7F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  lockPromptTitle: {
    ...typography.BodyLarge,
    color: "#11151D",
    fontFamily: "Inter-SemiBold",
    textAlign: "center",
    lineHeight: 24
  },
  lockPromptSubtitle: {
    ...typography.BodyMedium,
    color: "#697385",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 260
  },
  lockPromptBtn: {
    marginTop: 6,
    minWidth: 188,
    borderRadius: 10,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 22,
    paddingVertical: 11
  },
  lockPromptBtnPressed: {
    opacity: 0.82
  },
  lockPromptBtnText: {
    ...typography.bodySmall,
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  supportCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E9EDF3",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  supportText: {
    ...typography.bodySmall,
    color: "#657082",
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
