import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Panel } from "@/components/Panel";
import { ResultsModuleHeader } from "@/components/results/ResultsModuleHeader";
import { gradingOutlookService } from "@/services/grading/GradingOutlookService";
import type { GradingOutlook, UUID } from "@/types";
import { colors, typography } from "@/theme/tokens";

type Props = {
  cardId?: UUID | null;
  rawValue?: number;
  compact?: boolean;
  onOpenDetails?: () => void;
};

function money(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function recommendationText(outlook: GradingOutlook) {
  if (outlook.potentialUpside >= 200) return "Strong grading upside";
  if (outlook.potentialUpside >= 75) return "Worth reviewing for grading";
  return "Limited grading upside";
}

export function GradingOutlookPanel({ cardId, rawValue, compact = false, onOpenDetails }: Props) {
  const [outlook, setOutlook] = useState<GradingOutlook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!cardId) {
        setOutlook(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const next = await gradingOutlookService.getGradingOutlook(cardId, rawValue);
        if (!active) return;
        setOutlook(next);
      } catch {
        if (!active) return;
        setOutlook(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [cardId, rawValue]);

  if (loading) {
    return (
      <Panel>
        <Text style={styles.loading}>Loading grading outlook...</Text>
      </Panel>
    );
  }

  if (!outlook) {
    return (
      <Panel>
        <Text style={styles.empty}>Grading outlook unavailable right now.</Text>
      </Panel>
    );
  }

  return (
    <Panel style={styles.panel}>
      <ResultsModuleHeader
        title="Grading Outlook"
        trailingLabel={onOpenDetails ? undefined : "Decision support"}
        onPressAction={onOpenDetails}
      />

      <View style={styles.recommendationStrip}>
        <View style={styles.recommendationDot} />
        <View style={styles.recommendationCopy}>
          <Text style={styles.recommendationTitle}>{recommendationText(outlook)}</Text>
          <Text style={styles.recommendationBody}>PSA outcomes compared with current raw value.</Text>
        </View>
        <Text style={styles.recommendationValue}>+{money(outlook.potentialUpside)}</Text>
      </View>

      <View style={styles.scenarioRows}>
        <View style={styles.scenarioRow}>
          <Text style={styles.scenarioLabel}>Raw</Text>
          <Text style={styles.scenarioValue}>{money(outlook.rawValue)}</Text>
        </View>
        <View style={styles.scenarioRow}>
          <Text style={styles.scenarioLabel}>PSA 9</Text>
          <Text style={styles.scenarioValue}>{money(outlook.psa9Value)}</Text>
        </View>
        <View style={[styles.scenarioRow, styles.scenarioRowLast]}>
          <Text style={styles.scenarioLabel}>PSA 10</Text>
          <Text style={styles.scenarioValue}>{money(outlook.psa10Value)}</Text>
        </View>
      </View>

      {!compact ? <Text style={styles.rationale} numberOfLines={onOpenDetails ? 2 : undefined}>{outlook.rationale}</Text> : null}
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
  loading: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  empty: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  recommendationStrip: {
    borderWidth: 1,
    borderColor: "#E9EDF2",
    borderRadius: 12,
    backgroundColor: "#FBFCFE",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12
  },
  recommendationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentPrimary
  },
  recommendationCopy: {
    flex: 1,
    gap: 2
  },
  recommendationTitle: {
    ...typography.BodyMedium,
    color: "#121821",
    fontFamily: "Inter-SemiBold"
  },
  recommendationBody: {
    ...typography.Caption,
    color: "#6B7483"
  },
  recommendationValue: {
    ...typography.BodyMedium,
    color: colors.success,
    fontFamily: "Inter-SemiBold"
  },
  scenarioRows: {
    borderWidth: 1,
    borderColor: "#E9EDF2",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF"
  },
  scenarioRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  scenarioRowLast: {
    borderBottomWidth: 0
  },
  scenarioLabel: {
    ...typography.BodyMedium,
    color: colors.textSecondary
  },
  scenarioValue: {
    ...typography.BodyMedium,
    color: colors.textPrimary,
    fontFamily: "Inter-SemiBold"
  },
  rationale: {
    marginTop: 10,
    ...typography.Caption,
    color: colors.textSecondary,
    lineHeight: 18
  }
});
