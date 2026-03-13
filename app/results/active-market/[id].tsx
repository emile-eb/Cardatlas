import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { ResultsDetailScaffold } from "@/components/results/ResultsDetailScaffold";
import { ResultsDetailStatusState } from "@/components/results/ResultsDetailStatusState";
import { useAppState } from "@/state/AppState";
import { activeListingsService } from "@/services/activeListings/ActiveListingsService";
import { scanProcessingService, type ProcessedScanResult } from "@/services/scans/ScanProcessingService";
import { colors, typography } from "@/theme/tokens";
import type { ActiveListing } from "@/types";
import type { CardItem } from "@/types/models";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { findCollectionCard, resolveResultsDetailBackHref } from "@/features/results/detailRoute";

const ebayLogoImage = require("../../../assets/Ebay Logo.png");

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

function sourceLabel(source: string) {
  if (source === "ebay") return "eBay";
  return source || "Market";
}

function normalizePosition(value: number, min: number, max: number) {
  if (max <= min) return 0.5;
  const ratio = (value - min) / (max - min);
  return Math.max(0.06, Math.min(0.94, ratio));
}

function getInsight(referenceValue: number, listings: ActiveListing[]) {
  const prices = listings.map((item) => item.price).filter((item) => Number.isFinite(item));
  if (!prices.length || referenceValue <= 0) {
    return "This page shows the live ask market around the current CardAtlas Reference Value.";
  }

  const average = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  const spread = Math.max(...prices) - Math.min(...prices);
  const variance = Math.abs(average - referenceValue) / referenceValue;

  if (variance < 0.05) {
    return "Current asks are tightly clustered around the CardAtlas Reference Value.";
  }

  if (average > referenceValue && spread / referenceValue > 0.25) {
    return "Active asks sit above reference value, but the spread is wide enough to suggest uneven seller conviction.";
  }

  if (average > referenceValue) {
    return "The live ask market is leaning above CardAtlas Reference Value, which suggests sellers are pricing optimistically.";
  }

  return "Current asks are leaning below CardAtlas Reference Value, which suggests the live market is pricing more conservatively.";
}

export default function ActiveMarketDetailScreen() {
  const { id, from, collectionItemId, backTo } = useLocalSearchParams<{ id: string; from?: string; collectionItemId?: string; backTo?: string }>();
  const { cards } = useAppState();
  const [result, setResult] = useState<ProcessedScanResult | null>(null);
  const [card, setCard] = useState<CardItem | null>(null);
  const [rows, setRows] = useState<ActiveListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const isCollectionContext = from === "collection";
  const backHref = resolveResultsDetailBackHref({ backTo, isCollectionContext, collectionItemId, resultId: id });

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        setErrorText("We couldn't open this market view because the card context is missing.");
        setLoading(false);
        analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
          page: "active_market",
          reason: "missing_id"
        });
        return;
      }

      try {
        setLoading(true);
        setErrorText(null);

        let nextCard: CardItem | null = null;
        let referenceValue = 0;
        let lookupCardId: string | null | undefined = null;

        if (isCollectionContext) {
          nextCard = findCollectionCard(cards, id, collectionItemId);
        } else {
          const nextResult = await scanProcessingService.getProcessedScanResult(id);
          if (!active) return;
          if (!nextResult?.card) {
            setErrorText("We couldn't find the scan result behind this market view.");
            analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
              page: "active_market",
              reason: "missing_scan_result",
              resultId: id
            });
            return;
          }
          setResult(nextResult);
          nextCard = nextResult.card;
        }

        if (!active) return;
        if (!nextCard) {
          setErrorText("We couldn't load the card behind this market view.");
          analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
            page: "active_market",
            reason: isCollectionContext ? "missing_collection_card" : "missing_card",
            resultId: id
          });
          return;
        }
        setCard(nextCard);
        if (isCollectionContext) setResult(null);

        referenceValue = Number(nextCard.referenceValue ?? 0);
        lookupCardId = nextCard.sourceCardId ?? nextCard.correctedCardId ?? nextCard.id;

        if (!lookupCardId) {
          setRows([]);
          return;
        }

        const response = await activeListingsService.getDisplayActiveListings(lookupCardId, {
          referenceValue,
          maxItems: 12
        });

        if (!active) return;
        setRows(response.listings);
        if (response.error && __DEV__) {
          console.log("[active_market] detail_response_warning", {
            resultId: id,
            error: response.error
          });
        }
      } catch (error) {
        if (!active) return;
        setErrorText("We couldn't load the active market right now. Please try again.");
        analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
          page: "active_market",
          reason: "load_failed",
          resultId: id
        });
        if (__DEV__) {
          console.log("[active_market] detail_load_failed", error);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [cards, collectionItemId, id, isCollectionContext]);

  const summary = useMemo(() => {
    const prices = rows.map((item) => item.price).filter((item) => Number.isFinite(item));
    if (!prices.length) return null;

    return {
      average: prices.reduce((sum, value) => sum + value, 0) / prices.length,
      low: Math.min(...prices),
      high: Math.max(...prices),
      count: prices.length,
      currency: rows[0]?.currency || "USD"
    };
  }, [rows]);

  if (loading) {
    return (
      <ResultsDetailStatusState
        title="Loading active market"
        message="Preparing the live ask market around this card."
        backHref={backHref}
        actionLabel="Back"
      />
    );
  }

  if (!card || errorText) {
    return <ResultsDetailStatusState title="Active Market Unavailable" message={errorText ?? "We couldn't load this market view."} backHref={backHref} />;
  }

  const referenceValue = Number(card.referenceValue ?? result?.card?.referenceValue ?? 0);
  const low = summary?.low ?? referenceValue;
  const high = summary?.high ?? referenceValue;
  const average = summary?.average ?? referenceValue;
  const referencePos = normalizePosition(referenceValue, low, high);
  const averagePos = normalizePosition(average, low, high);

  return (
    <ResultsDetailScaffold
      card={card}
      referenceValue={referenceValue}
      title="Active Market"
      subtitle="The live ask market around the current CardAtlas Reference Value."
      resultId={id}
      backHref={backHref}
    >
      <View style={styles.heroSurface}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Live ask market</Text>
            <Text style={styles.heroValue}>{summary ? money(summary.average, summary.currency) : "-"}</Text>
            <Text style={styles.heroSubcopy}>Average active ask relative to CardAtlas Reference Value</Text>
          </View>
          <View style={styles.heroCount}>
            <Text style={styles.heroCountLabel}>Listings</Text>
            <Text style={styles.heroCountValue}>{summary?.count ?? 0}</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Lowest ask</Text>
            <Text style={styles.metricValue}>{summary ? money(summary.low, summary.currency) : "-"}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Ask range</Text>
            <Text style={styles.metricValue}>
              {summary ? `${money(summary.low, summary.currency)} - ${money(summary.high, summary.currency)}` : "-"}
            </Text>
          </View>
        </View>

        <View style={styles.scaleSection}>
          <View style={styles.scaleHeader}>
            <Text style={styles.scaleTitle}>Price position</Text>
            <Text style={styles.scaleMeta}>Ask market around reference value</Text>
          </View>

          <View style={styles.scaleTrackWrap}>
            <View style={styles.scaleTrack} />
            <View style={styles.scaleBand} />
            <View style={[styles.referenceMarker, { left: `${referencePos * 100}%` }]} />
            <View style={[styles.averageMarker, { left: `${averagePos * 100}%` }]} />
            <View style={[styles.markerTag, styles.referenceTag, { left: `${referencePos * 100}%` }]}>
              <Text style={styles.referenceTagText}>Ref</Text>
            </View>
            <View style={[styles.markerTag, styles.averageTag, { left: `${averagePos * 100}%` }]}>
              <Text style={styles.averageTagText}>Avg Ask</Text>
            </View>
          </View>

          <View style={styles.scaleFooter}>
            <Text style={styles.scaleValue}>{money(low)}</Text>
            <Text style={styles.scaleValue}>{money(high)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <Ionicons name="pulse-outline" size={14} color={colors.accentPrimary} />
          <Text style={styles.sectionTitle}>Live listings</Text>
        </View>
        <Text style={styles.sectionMeta}>Current ask feed</Text>
      </View>

      <View style={styles.feedSurface}>
        {rows.map((listing, index) => (
          <Pressable
            key={`${listing.id || listing.sourceListingId || index}`}
            style={({ pressed }) => [styles.feedRow, pressed && styles.feedRowPressed]}
          >
            <View style={styles.feedPrimary}>
              <Text style={styles.feedPrice}>{money(listing.price, listing.currency)}</Text>
              <Text style={styles.feedCondition}>{listing.condition ?? "Active listing"}</Text>
            </View>

            <View style={styles.feedSecondary}>
              {listing.source === "ebay" ? (
                <Image source={ebayLogoImage} style={styles.feedSourceLogo} resizeMode="contain" />
              ) : (
                <Text style={styles.feedSource}>{sourceLabel(listing.source)}</Text>
              )}
              <Ionicons name="chevron-forward" size={15} color="#9099A8" />
            </View>
          </Pressable>
        ))}

        {!rows.length ? <Text style={styles.empty}>No active listings are available right now.</Text> : null}
      </View>

      <View style={styles.readBlock}>
        <Text style={styles.readLabel}>CardAtlas read</Text>
        <Text style={styles.readCopy}>{getInsight(referenceValue, rows)}</Text>
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
  heroSurface: {
    borderWidth: 1,
    borderColor: "#E9EDF2",
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 18
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  heroCopy: {
    flex: 1,
    gap: 4
  },
  heroKicker: {
    ...typography.Caption,
    color: "#8891A0",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Inter-Medium"
  },
  heroValue: {
    ...typography.H1,
    color: "#0F1620",
    fontFamily: "Inter-Bold",
    fontSize: 42,
    lineHeight: 44
  },
  heroSubcopy: {
    ...typography.BodyMedium,
    color: "#5C6676",
    lineHeight: 21,
    maxWidth: 240
  },
  heroCount: {
    minWidth: 86,
    alignItems: "flex-end",
    gap: 2
  },
  heroCountLabel: {
    ...typography.Caption,
    color: "#8B94A3"
  },
  heroCountValue: {
    ...typography.H3,
    color: "#10161F",
    fontFamily: "Inter-SemiBold"
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: "#EEF2F6",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
    paddingVertical: 14
  },
  metric: {
    flex: 1,
    gap: 3
  },
  metricDivider: {
    width: 1,
    backgroundColor: "#EEF2F6",
    marginHorizontal: 14
  },
  metricLabel: {
    ...typography.Caption,
    color: "#7D8695"
  },
  metricValue: {
    ...typography.BodyLarge,
    color: "#11161E",
    fontFamily: "Inter-SemiBold"
  },
  scaleSection: {
    gap: 12
  },
  scaleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  scaleTitle: {
    ...typography.BodyLarge,
    color: "#11161E",
    fontFamily: "Inter-SemiBold"
  },
  scaleMeta: {
    ...typography.Caption,
    color: "#7D8695"
  },
  scaleTrackWrap: {
    position: "relative",
    height: 58,
    justifyContent: "center"
  },
  scaleTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: "#EDF1F6"
  },
  scaleBand: {
    position: "absolute",
    left: "7%",
    right: "7%",
    top: 20,
    height: 14,
    borderRadius: 999,
    backgroundColor: "rgba(17, 21, 29, 0.08)"
  },
  referenceMarker: {
    position: "absolute",
    top: 15,
    width: 16,
    height: 24,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary
  },
  averageMarker: {
    position: "absolute",
    top: 17,
    width: 16,
    height: 20,
    marginLeft: -8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#11161E",
    backgroundColor: "#FFFFFF"
  },
  markerTag: {
    position: "absolute",
    top: -2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: -25
  },
  referenceTag: {
    backgroundColor: "#FFF2F0",
    marginLeft: -20
  },
  averageTag: {
    backgroundColor: "#F3F5F8",
    top: 34,
    marginLeft: -30
  },
  referenceTagText: {
    ...typography.Caption,
    color: colors.accentPrimary,
    fontFamily: "Inter-SemiBold"
  },
  averageTagText: {
    ...typography.Caption,
    color: "#11161E",
    fontFamily: "Inter-SemiBold"
  },
  scaleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  scaleValue: {
    ...typography.Caption,
    color: "#6C7584",
    fontFamily: "Inter-Medium"
  },
  sectionHeader: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sectionTitle: {
    ...typography.H2,
    color: "#121821",
    fontFamily: "Inter-SemiBold"
  },
  sectionMeta: {
    ...typography.Caption,
    color: "#7E8796"
  },
  feedSurface: {
    borderTopWidth: 1,
    borderTopColor: "#E9EDF2",
    borderBottomWidth: 1,
    borderBottomColor: "#E9EDF2"
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F4F7"
  },
  feedRowPressed: {
    opacity: 0.7
  },
  feedPrimary: {
    flex: 1,
    gap: 3
  },
  feedPrice: {
    ...typography.BodyLarge,
    color: "#11161E",
    fontFamily: "Inter-SemiBold"
  },
  feedCondition: {
    ...typography.Caption,
    color: "#677181"
  },
  feedSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  feedSource: {
    ...typography.Caption,
    color: "#7D8695",
    fontFamily: "Inter-Medium"
  },
  feedSourceLogo: {
    width: 22,
    height: 10
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
  empty: {
    ...typography.BodyMedium,
    color: "#66707F",
    paddingVertical: 10
  }
});
