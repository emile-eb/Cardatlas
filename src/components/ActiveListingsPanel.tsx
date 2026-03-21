import { useEffect, useMemo, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Panel } from "@/components/Panel";
import { ResultsModuleHeader } from "@/components/results/ResultsModuleHeader";
import { activeListingsService } from "@/services/activeListings/ActiveListingsService";
import type { ActiveListing, UUID } from "@/types";
import { colors, spacing, typography } from "@/theme/tokens";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { ModuleLoadingCard } from "@/components/loading/ModuleLoadingCard";
import type { CardItem } from "@/types/models";
import {
  createEmptyActiveListingsSegments,
  getDefaultActiveMarketSegment,
  getVisibleActiveListings,
  getSegmentLabel,
} from "@/services/activeListings/classification";
import type { ActiveListingsSegments } from "@/types";

const ebayLogoImage = require("../../assets/Ebay Logo.png");

type Props = {
  cardId?: UUID | null;
  card?: CardItem | null;
  referenceValue?: number;
  maxItems?: number;
  onOpenDetails?: () => void;
};

function money(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function freshness(isoDate: string): string {
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return "Newly listed";
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 60) return `New ${Math.max(diffMin, 1)}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function sourceLabel(source: string) {
  if (source === "ebay") return "eBay";
  return source || "Market";
}

function normalizePosition(value: number, min: number, max: number) {
  if (max <= min) return 0.5;
  const ratio = (value - min) / (max - min);
  return Math.max(0, Math.min(1, ratio));
}

function percentDeltaText(value: number, baseline: number) {
  if (!baseline || !Number.isFinite(baseline)) return "0%";
  const pct = ((value - baseline) / baseline) * 100;
  const rounded = Math.round(Math.abs(pct));
  if (rounded === 0) return "0%";
  return `${rounded}%`;
}

function insightLine(listings: ActiveListing[], referenceValue: number | undefined, avg: number, low: number, high: number) {
  if (!listings.length) return null;
  if (!referenceValue || referenceValue <= 0) {
    return `Active market ranges from ${money(low)} to ${money(high)}.`;
  }
  const deltaPct = percentDeltaText(avg, referenceValue);
  if (Math.abs(avg - referenceValue) / referenceValue < 0.05) {
    return `Average ask is near reference value (${deltaPct} difference).`;
  }
  if (avg > referenceValue) {
    return `Average ask is ${deltaPct} above reference value.`;
  }
  return `Average ask is ${deltaPct} below reference value.`;
}

export function ActiveListingsPanel({ cardId, card, referenceValue, maxItems = 5, onOpenDetails }: Props) {
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<ActiveListingsSegments>(createEmptyActiveListingsSegments);
  const [usedFallback, setUsedFallback] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const fetchWindow = Math.max(maxItems * 3, 12);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!cardId) {
        setSegments(createEmptyActiveListingsSegments());
        setServiceError(null);
        setUsedFallback(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await activeListingsService.getDisplayActiveListings(cardId, {
          referenceValue,
          maxItems: fetchWindow
        });
        if (!active) return;
        setSegments({
          raw: response.filteredSegments.raw.slice(0, maxItems),
          psa9: response.filteredSegments.psa9.slice(0, maxItems),
          psa10: response.filteredSegments.psa10.slice(0, maxItems),
          otherGraded: response.filteredSegments.otherGraded.slice(0, maxItems),
          excluded: response.filteredSegments.excluded
        });
        setUsedFallback(response.usedFallback);
        setServiceError(response.error ?? null);
      } catch (error) {
        if (!active) return;
        setSegments(createEmptyActiveListingsSegments());
        setUsedFallback(false);
        setServiceError(error instanceof Error ? error.message : "Active listings unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [cardId, referenceValue, fetchWindow]);

  const segmentedRows = useMemo(() => {
    const defaultSegment = getDefaultActiveMarketSegment(card, segments);
    const selected = segments[defaultSegment];
    const visibleRows = selected.length ? selected : segments.raw.length ? segments.raw : [...segments.psa9, ...segments.psa10, ...segments.otherGraded];
    return {
      defaultSegment,
      visibleRows
    };
  }, [card, segments]);

  const totalVisibleRows = useMemo(() => getVisibleActiveListings(segments).length, [segments]);

  const summary = useMemo(() => {
    const prices = segmentedRows.visibleRows.map((x) => x.price).filter((x) => Number.isFinite(x));
    if (!prices.length) {
      return { avg: 0, low: 0, high: 0, count: 0, currency: "USD" };
    }
    const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
    return {
      avg,
      low: Math.min(...prices),
      high: Math.max(...prices),
      count: prices.length,
      currency: segmentedRows.visibleRows[0]?.currency || "USD"
    };
  }, [segmentedRows.visibleRows]);

  const ladder = useMemo(() => {
    if (!summary.count) return null;
    const min = summary.low;
    const max = Math.max(summary.low, summary.high);
    return {
      min,
      max,
      avgPos: normalizePosition(summary.avg, min, max),
      refPos: referenceValue && referenceValue > 0 ? normalizePosition(referenceValue, min, max) : null
    };
  }, [summary, referenceValue]);

  const comparisonLine = useMemo(
    () => insightLine(segmentedRows.visibleRows, referenceValue, summary.avg, summary.low, summary.high),
    [segmentedRows.visibleRows, referenceValue, summary]
  );

  return (
    <Panel style={styles.panel}>
      <ResultsModuleHeader
        title="Active Market"
        trailingLabel={onOpenDetails ? undefined : `${getSegmentLabel(segmentedRows.defaultSegment)} Ask`}
        onPressAction={onOpenDetails}
      />
      {__DEV__ && usedFallback ? <Text style={styles.devPill}>Preview data</Text> : null}

      {!loading && totalVisibleRows ? (
        <View style={styles.summaryStrip}>
          <View style={[styles.summaryCell, styles.summaryPrimary]}>
            <Text style={styles.summaryLabel}>Average Ask</Text>
            <Text style={styles.summaryValuePrimary}>{money(summary.avg, summary.currency)}</Text>
          </View>
          <View style={[styles.summaryCell, styles.summaryCellDivider]}>
            <Text style={styles.summaryLabel}>Lowest Ask</Text>
            <Text style={styles.summaryValue}>{money(summary.low, summary.currency)}</Text>
          </View>
          <View style={[styles.summaryCell, styles.summaryCellDivider]}>
            <Text style={styles.summaryLabel}>Range</Text>
            <Text style={styles.summaryValue}>{money(summary.low, summary.currency)} - {money(summary.high, summary.currency)}</Text>
          </View>
        </View>
      ) : null}

      {!loading && ladder ? (
        <View style={styles.ladderWrap}>
          <View style={styles.ladderLabelRow}>
            <Text style={styles.ladderLabel}>Range</Text>
          </View>
          <View style={styles.scaleTrackArea}>
            <View style={styles.ladderTrack} />
            <View style={[styles.markerAvg, { left: `${ladder.avgPos * 100}%` }]} />
            <Text style={[styles.markerLabelAvg, { left: `${ladder.avgPos * 100}%` }]}>Avg</Text>
            {ladder.refPos != null ? (
              <>
                <Text style={[styles.markerLabelRef, { left: `${ladder.refPos * 100}%` }]}>Ref</Text>
                <View style={[styles.markerRef, { left: `${ladder.refPos * 100}%` }]} />
              </>
            ) : null}
          </View>
          <View style={styles.scaleEndsRow}>
            <Text style={styles.scaleEndValue}>{money(summary.low, summary.currency)}</Text>
            <Text style={styles.scaleEndValue}>{money(summary.high, summary.currency)}</Text>
          </View>
        </View>
      ) : null}
      {comparisonLine ? (
        <View style={styles.comparisonStrip}>
          <Ionicons name="pulse-outline" size={14} color={colors.accentPrimary} />
          <Text style={styles.comparison}>{comparisonLine}</Text>
        </View>
      ) : null}

      {loading ? (
        <ModuleLoadingCard
          title="Active market loading"
          subtitle="Preparing the current ask market around CardAtlas Reference Value."
        />
      ) : null}
      {!loading && !segmentedRows.visibleRows.length ? (
        <Text style={styles.empty}>
          {serviceError ? "Active listings are temporarily unavailable." : `No ${getSegmentLabel(segmentedRows.defaultSegment).toLowerCase()} active listings are available right now.`}
        </Text>
      ) : null}

      {!loading && segmentedRows.visibleRows.length ? (
        <View style={styles.rows}>
          {segmentedRows.visibleRows.map((listing, index) => {
            const hasUrl = Boolean(listing.itemWebUrl?.trim());
            return (
              <Pressable
                key={listing.id || `${listing.sourceListingId ?? "active"}-${index}`}
                onPress={() => {
                  if (hasUrl && listing.itemWebUrl) {
                    analyticsService.track(ANALYTICS_EVENTS.activeMarketItemTapped, {
                      cardId: cardId ?? undefined,
                      source: listing.source,
                      price: Math.round(listing.price)
                    });
                    void Linking.openURL(listing.itemWebUrl);
                  }
                }}
                disabled={!hasUrl}
                style={({ pressed }) => [styles.row, pressed && hasUrl && styles.rowPressed]}
              >
                <View style={styles.thumbWrap}>
                  {listing.imageUrl ? <Image source={{ uri: listing.imageUrl }} style={styles.thumb} /> : null}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowPrice}>{money(listing.price, listing.currency)}</Text>
                  <View style={styles.rowMetaLine}>
                    {listing.source === "ebay" ? (
                      <Image source={ebayLogoImage} style={styles.rowSourceLogo} resizeMode="contain" />
                    ) : (
                      <Text style={styles.rowMeta}>{sourceLabel(listing.source)}</Text>
                    )}
                    <Text style={styles.rowMeta}>- {freshness(listing.itemOriginDate)}</Text>
                  </View>
                  <Text style={styles.rowCondition} numberOfLines={1}>{listing.condition ?? listing.title}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Ionicons name="open-outline" size={14} color="#8A93A3" />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
  devPill: {
    ...typography.Caption,
    color: "#8A93A3",
    marginBottom: 8
  },
  summaryStrip: {
    borderWidth: 1,
    borderColor: "#E6EAF0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 10,
    paddingHorizontal: 6
  },
  summaryPrimary: {
    flex: 1.28
  },
  summaryCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  summaryCellDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#F0F3F7"
  },
  summaryLabel: {
    ...typography.Caption,
    color: "#6E7686"
  },
  summaryValuePrimary: {
    ...typography.H3,
    color: "#11151D",
    fontFamily: "Inter-SemiBold"
  },
  summaryValue: {
    ...typography.BodyMedium,
    color: "#1C2330",
    fontFamily: "Inter-SemiBold"
  },
  ladderWrap: {
    borderWidth: 1,
    borderColor: "#ECEFF4",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8
  },
  ladderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  ladderLabel: {
    ...typography.Caption,
    color: "#6A7281"
  },
  scaleTrackArea: {
    position: "relative",
    height: 30,
    marginBottom: 4
  },
  ladderTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 14,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E3E8F0"
  },
  markerAvg: {
    position: "absolute",
    top: 11,
    marginLeft: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#10131A"
  },
  markerRef: {
    position: "absolute",
    top: 11,
    marginLeft: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentPrimary
  },
  markerLabelAvg: {
    position: "absolute",
    top: 20,
    marginLeft: -12,
    ...typography.Caption,
    color: "#5F6878",
    fontFamily: "Inter-Medium"
  },
  markerLabelRef: {
    position: "absolute",
    top: -2,
    marginLeft: -10,
    ...typography.Caption,
    color: "#11151D",
    fontFamily: "Inter-SemiBold"
  },
  scaleEndsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  scaleEndValue: {
    ...typography.Caption,
    color: "#4D5666",
    fontFamily: "Inter-Medium"
  },
  comparison: {
    ...typography.Caption,
    color: "#4B5565",
    flex: 1
  },
  comparisonStrip: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    borderWidth: 1,
    borderColor: "#EEF1F5",
    backgroundColor: "#FBFCFE",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  empty: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  rows: {
    gap: 8
  },
  row: {
    borderWidth: 1,
    borderColor: "#E9EDF2",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rowPressed: {
    backgroundColor: "#F7FAFF"
  },
  thumbWrap: {
    width: 44,
    height: 60,
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: "#EFF2F6",
    borderWidth: 1,
    borderColor: "#E6EAF0"
  },
  thumb: {
    width: "100%",
    height: "100%"
  },
  rowBody: {
    flex: 1,
    minWidth: 0
  },
  rowPrice: {
    ...typography.H3,
    color: colors.textPrimary,
    fontFamily: "Inter-SemiBold",
    lineHeight: 19
  },
  rowMeta: {
    ...typography.Caption,
    color: "#6E7686",
    marginTop: 0
  },
  rowMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  rowSourceLogo: {
    width: 22,
    height: 10
  },
  rowCondition: {
    ...typography.Caption,
    color: "#454B57",
    marginTop: 1
  },
  rowRight: {
    alignItems: "flex-end",
    justifyContent: "center"
  }
});

