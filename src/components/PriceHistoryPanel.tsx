import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Panel } from "./Panel";
import { useAppState } from "@/state/AppState";
import { ResultsModuleHeader } from "@/components/results/ResultsModuleHeader";
import { colors, typography } from "@/theme/tokens";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import {
  PRICE_HISTORY_TIMEFRAMES,
  enforceUpwardTrend,
  formatMoney as money,
  generateSeries,
  smoothSeries,
  toChartPoints,
  type PriceHistoryTimeframe
} from "@/features/results/priceHistory";

type Props = {
  cardId?: string | null;
  referenceValue: number;
  onOpenDetails?: () => void;
};
export function PriceHistoryPanel({ cardId, referenceValue, onOpenDetails }: Props) {
  const { premium, presentPaywall } = useAppState();
  const [timeframe, setTimeframe] = useState<PriceHistoryTimeframe>("1M");
  const [chartWidth, setChartWidth] = useState(0);
  const chartHeight = 144;
  const chartAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    chartAnim.setValue(0);
    Animated.timing(chartAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true
    }).start();
  }, [timeframe, chartAnim]);

  const values = useMemo(() => generateSeries(cardId ?? "cardatlas", referenceValue, timeframe), [cardId, referenceValue, timeframe]);
  const visibleValues = useMemo(() => {
      const upward = enforceUpwardTrend(values);
    return premium ? upward : smoothSeries(upward);
  }, [premium, values]);
  const first = values[0] ?? referenceValue;
  const last = values[values.length - 1] ?? referenceValue;
  const deltaPct = first > 0 ? ((last - first) / first) * 100 : 0;
  const deltaText = `+${Math.abs(deltaPct).toFixed(1)}%`;
  const deltaColor = "#1F7A45";
  const points = useMemo(() => toChartPoints(visibleValues, chartWidth, chartHeight), [visibleValues, chartWidth]);

  const onChartLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };
  const minValue = Math.min(...visibleValues);
  const maxValue = Math.max(...visibleValues);

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
          <Text style={styles.marketSummaryValue}>{money(referenceValue)}</Text>
        </View>
        <View style={[styles.marketSummaryCell, styles.marketSummaryDivider]}>
          <Text style={styles.marketSummaryLabel}>Range</Text>
          <Text style={styles.marketSummaryValue}>
            {money(minValue)} - {money(maxValue)}
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

        {!premium ? (
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
