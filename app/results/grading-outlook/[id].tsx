import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { ResultsDetailScaffold } from "@/components/results/ResultsDetailScaffold";
import { ResultsDetailStatusState } from "@/components/results/ResultsDetailStatusState";
import { useAppState } from "@/state/AppState";
import { gradingOutlookService } from "@/services/grading/GradingOutlookService";
import { scanProcessingService, type ProcessedScanResult } from "@/services/scans/ScanProcessingService";
import { colors, typography } from "@/theme/tokens";
import type { CardItem } from "@/types/models";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { findCollectionCard, resolveResultsDetailBackHref } from "@/features/results/detailRoute";

function money(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getDecisionSummary(recommendation: string) {
  if (recommendation === "Worth Grading") {
    return "Grade if the card presents cleanly and you want to maximize long-term value.";
  }

  if (recommendation === "Only if condition is strong") {
    return "Grade only if the card looks exceptionally strong in hand. Otherwise the margin is thin.";
  }

  return "Hold raw unless you have strong condition confidence or a specific collector reason to slab it.";
}

function getRecommendationTone(recommendation: string) {
  if (recommendation === "Worth Grading") {
    return {
      label: "Grade signal",
      icon: "arrow-up-circle" as const,
      value: "Strong grading case",
      color: colors.success,
      backgroundColor: "#EFFAF3"
    };
  }

  if (recommendation === "Only if condition is strong") {
    return {
      label: "Grade signal",
      icon: "scan-circle" as const,
      value: "Condition-sensitive upside",
      color: colors.accentPrimary,
      backgroundColor: "#FFF4F2"
    };
  }

  return {
    label: "Grade signal",
    icon: "remove-circle" as const,
    value: "Thin grading edge",
    color: colors.accentPrimary,
    backgroundColor: "#FFF4F2"
  };
}

export default function GradingOutlookDetailScreen() {
  const { id, from, collectionItemId, backTo } = useLocalSearchParams<{ id: string; from?: string; collectionItemId?: string; backTo?: string }>();
  const { cards } = useAppState();
  const [result, setResult] = useState<ProcessedScanResult | null>(null);
  const [card, setCard] = useState<CardItem | null>(null);
  const [outlook, setOutlook] = useState<any>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const isCollectionContext = from === "collection";
  const backHref = resolveResultsDetailBackHref({ backTo, isCollectionContext, collectionItemId, resultId: id });

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        setErrorText("We couldn't open this grading view because the card context is missing.");
        analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
          page: "grading_outlook",
          reason: "missing_id"
        });
        return;
      }

      try {
        setErrorText(null);
        let nextCard: CardItem | null = null;

        if (isCollectionContext) {
          nextCard = findCollectionCard(cards, id, collectionItemId);
        } else {
          const next = await scanProcessingService.getProcessedScanResult(id);
          if (!active) return;
          if (!next?.card) {
            setErrorText("We couldn't find the scan result behind this grading view.");
            analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
              page: "grading_outlook",
              reason: "missing_scan_result",
              resultId: id
            });
            return;
          }
          setResult(next);
          nextCard = next.card;
        }

        if (!active) return;
        if (!nextCard) {
          setErrorText("We couldn't find the card behind this grading view.");
          analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
            page: "grading_outlook",
            reason: isCollectionContext ? "missing_collection_card" : "missing_card",
            resultId: id
          });
          return;
        }
        setCard(nextCard);
        if (isCollectionContext) setResult(null);

        const cardId = nextCard.sourceCardId ?? nextCard.correctedCardId ?? nextCard.id;
        if (!cardId) {
          setErrorText("We couldn't find enough card context to calculate a grading outlook.");
          return;
        }
        const nextOutlook = await gradingOutlookService.getGradingOutlook(cardId, {
          rawValue: Number(nextCard.baseReferenceValue ?? nextCard.referenceValue ?? 0),
          sourceScanId: nextCard.sourceScanId ?? null
        });
        if (!active) return;
        setOutlook(nextOutlook);
      } catch (error) {
        if (!active) return;
        setErrorText("We couldn't load the grading outlook right now. Please try again.");
        analyticsService.track(ANALYTICS_EVENTS.resultsDetailRouteFailed, {
          page: "grading_outlook",
          reason: "load_failed",
          resultId: id
        });
        if (__DEV__) {
          console.log("[grading_outlook] detail_load_failed", error);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [cards, collectionItemId, id, isCollectionContext]);

  const tone = useMemo(
    () => getRecommendationTone(outlook?.recommendation ?? ""),
    [outlook?.recommendation]
  );

  if ((!card || !outlook) && !errorText) {
    return (
      <ResultsDetailStatusState
        title="Loading grading outlook"
        message="Preparing grading scenarios from the current CardAtlas value."
        backHref={backHref}
        actionLabel="Back"
      />
    );
  }

  if (!card || !outlook || errorText) {
    return <ResultsDetailStatusState title="Grading Outlook Unavailable" message={errorText ?? "We couldn't load this grading view."} backHref={backHref} />;
  }

  const referenceValue = Number(card.baseReferenceValue ?? card.referenceValue ?? result?.card?.referenceValue ?? 0);

  return (
    <ResultsDetailScaffold
      card={card}
      referenceValue={referenceValue}
      title="Grading Outlook"
      subtitle="Grading outcomes from CardAtlas value, GPT gradeability reads, and live PSA asks."
      resultId={id}
      backHref={backHref}
      referenceVariant="integrated"
      showIdentity={false}
      showReferenceStrip={false}
    >
      <View style={styles.recommendationHero}>
        <View style={styles.signalRow}>
          <View style={[styles.signalChip, { backgroundColor: tone.backgroundColor }]}>
            <Ionicons name={tone.icon} size={14} color={tone.color} />
            <Text style={[styles.signalLabel, { color: tone.color }]}>{tone.value}</Text>
          </View>
        </View>

        <Text style={styles.recommendationTitle}>{outlook.recommendation}</Text>
        <Text style={styles.recommendationBody}>{outlook.rationale}</Text>

        <View style={styles.upsideRow}>
          <Text style={styles.upsideLabel}>Potential upside</Text>
          <Text style={styles.upsideValue}>+{money(outlook.potentialUpside)}</Text>
        </View>
      </View>

      <View style={styles.scenarioSurface}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Scenario model</Text>
          <Text style={styles.sectionMeta}>From current raw value</Text>
        </View>

        <View style={styles.scenarioList}>
          <View style={styles.scenarioRow}>
            <Text style={styles.scenarioLabel}>Raw value</Text>
            <Text style={styles.scenarioValue}>{money(outlook.rawReferenceValue)}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <View style={styles.scenarioCopy}>
              <Text style={styles.scenarioLabel}>PSA 9 outcome</Text>
            </View>
            <Text style={styles.scenarioValue}>{money(outlook.gradingOutcomePsa9)}</Text>
          </View>
          <View style={styles.scenarioRow}>
            <View style={styles.scenarioCopy}>
              <Text style={styles.scenarioLabel}>PSA 10 outcome</Text>
            </View>
            <Text style={styles.scenarioValue}>{money(outlook.gradingOutcomePsa10)}</Text>
          </View>
          <View style={[styles.scenarioRow, styles.scenarioRowAccent]}>
            <Text style={styles.scenarioLabelStrong}>Potential upside</Text>
            <Text style={styles.scenarioValueAccent}>+{money(outlook.potentialUpside)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.contextSurface}>
        <View style={styles.contextBlock}>
          <Text style={styles.contextLabel}>CardAtlas explanation</Text>
          <Text style={styles.contextCopy}>
            {outlook.recommendation === "Worth Grading"
              ? "CardAtlas sees enough upside above the current reference value to justify grading consideration."
              : outlook.recommendation === "Only if condition is strong"
                ? "CardAtlas sees upside only if the card's corners, edges, and surface are strong enough to support a high grade."
                : "CardAtlas sees limited grading leverage relative to the current reference value, so staying raw is the cleaner baseline."}
          </Text>
        </View>

        {outlook.gradingReason ? (
          <>
            <View style={styles.contextDivider} />
            <View style={styles.contextBlock}>
              <Text style={styles.contextLabel}>
                GPT grading read{outlook.gradingConfidence ? ` · ${outlook.gradingConfidence}` : ""}
              </Text>
              <Text style={styles.contextCopy}>{outlook.gradingReason}</Text>
            </View>
          </>
        ) : null}

        <View style={styles.contextDivider} />

        <View style={styles.contextBlock}>
          <Text style={styles.contextLabel}>Decision summary</Text>
          <Text style={styles.contextCopy}>{getDecisionSummary(outlook.recommendation)}</Text>
        </View>
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
  recommendationHero: {
    borderWidth: 1,
    borderColor: "#E7ECF2",
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 10,
    marginTop: 8
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  signalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start"
  },
  signalLabel: {
    ...typography.Caption,
    fontFamily: "Inter-SemiBold",
    letterSpacing: 0.2
  },
  recommendationTitle: {
    ...typography.H1,
    color: "#10161F",
    fontFamily: "Inter-Bold",
    fontSize: 38,
    lineHeight: 40,
    marginTop: 2
  },
  recommendationBody: {
    ...typography.bodySmall,
    color: "#556173",
    lineHeight: 18,
    maxWidth: 292
  },
  upsideRow: {
    borderTopWidth: 1,
    borderTopColor: "#EEF2F6",
    paddingTop: 13,
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  upsideLabel: {
    ...typography.Caption,
    color: "#7B8493",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Inter-Medium"
  },
  upsideValue: {
    ...typography.H2,
    color: colors.success,
    fontFamily: "Inter-Bold",
    letterSpacing: -0.2
  },
  scenarioSurface: {
    gap: 12
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sectionTitle: {
    ...typography.H2,
    color: "#121821",
    fontFamily: "Inter-SemiBold"
  },
  sectionMeta: {
    ...typography.Caption,
    color: "#7C8594"
  },
  scenarioList: {
    borderWidth: 1,
    borderColor: "#E8EDF3",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    overflow: "hidden"
  },
  scenarioRow: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  scenarioCopy: {
    flex: 1
  },
  scenarioRowAccent: {
    borderBottomWidth: 0,
    backgroundColor: "#F5F7FA"
  },
  scenarioLabel: {
    ...typography.BodyMedium,
    color: "#5B6677",
    fontFamily: "Inter-Medium"
  },
  scenarioLabelStrong: {
    ...typography.BodyMedium,
    color: "#11161E",
    fontFamily: "Inter-SemiBold"
  },
  scenarioValue: {
    ...typography.BodyLarge,
    color: "#10161F",
    fontFamily: "Inter-SemiBold"
  },
  scenarioValueAccent: {
    ...typography.H3,
    color: colors.success,
    fontFamily: "Inter-Bold"
  },
  contextSurface: {
    borderWidth: 1,
    borderColor: "#E9EDF2",
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14
  },
  contextBlock: {
    gap: 5
  },
  contextDivider: {
    height: 1,
    backgroundColor: "#EEF2F6"
  },
  contextLabel: {
    ...typography.Caption,
    color: "#8A93A3",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Inter-Medium"
  },
  contextCopy: {
    ...typography.BodyMedium,
    color: "#465162",
    lineHeight: 21
  }
});
