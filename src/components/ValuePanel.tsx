import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { useRarityVisuals } from "@/hooks/useRarityVisuals";
import { formatGradeScore, normalizeGradeScore } from "@/utils/gradeScore";

type Props = {
  value: number;
  condition: string;
  trend?: string;
  borderless?: boolean;
  animateValue?: boolean;
  rarityLabel?: "Common" | "Notable" | "Rare" | "Elite" | "Grail";
  rarityLevel?: 1 | 2 | 3 | 4 | 5;
  gradeScore?: number | null;
  enableRarityReveal?: boolean;
  rarityRevealDelayMs?: number;
  onRarityRevealed?: () => void;
};

export function ValuePanel({
  value,
  condition,
  trend,
  borderless = false,
  animateValue = true,
  rarityLabel,
  gradeScore,
  enableRarityReveal = false,
  onRarityRevealed
}: Props) {
  const isFocused = useIsFocused();
  const normalizedCondition = condition.trim();
  const shouldShowCondition =
    normalizedCondition.length > 0 &&
    normalizedCondition.toLowerCase() !== "unspecified" &&
    normalizedCondition.toLowerCase() !== "condition unspecified";
  const formattedValue = useMemo(
    () =>
      `$${value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`,
    [value]
  );
  const chars = useMemo(() => formattedValue.split(""), [formattedValue]);
  const decimalIndex = formattedValue.indexOf(".");
  const digitAnimRefs = useRef<Animated.Value[]>([]);
  const resolvedGradeScore = normalizeGradeScore(gradeScore);
  const rarityVisuals = useRarityVisuals(rarityLabel ?? "Common");

  useEffect(() => {
    console.log("[grade_score][value_panel]", {
      rawGradeScore: gradeScore ?? null,
      resolvedGradeScore,
      rarityLabel: rarityLabel ?? null,
      value
    });
  }, [gradeScore, rarityLabel, resolvedGradeScore, value]);

  useEffect(() => {
    digitAnimRefs.current = chars.map((_, index) => digitAnimRefs.current[index] ?? new Animated.Value(0));
  }, [chars]);

  useEffect(() => {
    if (!animateValue || !isFocused || digitAnimRefs.current.length === 0) return;

    digitAnimRefs.current.forEach((anim) => anim.setValue(0));
    const animations = digitAnimRefs.current.map((anim) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    );
    Animated.stagger(35, animations).start();
  }, [animateValue, isFocused, formattedValue]);

  useEffect(() => {
    if (!enableRarityReveal || !rarityLabel) return;
    onRarityRevealed?.();
  }, [enableRarityReveal, rarityLabel, onRarityRevealed]);

  return (
    <View style={[styles.panel, borderless && styles.panelBorderless]}>
      <View style={styles.topRule} />
      <Text style={styles.label}>REFERENCE VALUE</Text>

      <View style={styles.valueRow}>
        {chars.map((char, index) => {
          const digitAnim = digitAnimRefs.current[index];
          const isDecimalPart = decimalIndex !== -1 && index >= decimalIndex;
          const animatedStyle = digitAnim
            ? {
                opacity: digitAnim,
                transform: [
                  {
                    translateY: digitAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-14, 0]
                    })
                  }
                ]
              }
            : null;

          return (
            <Animated.Text
              key={`${formattedValue}-${index}`}
              style={[
                styles.valueChar,
                isDecimalPart && styles.valueDecimal,
                animateValue ? animatedStyle : styles.valueCharStatic
              ]}
            >
              {char}
            </Animated.Text>
          );
        })}
      </View>

      <View style={styles.metaRow}>
        {shouldShowCondition ? <Text style={styles.sub}>{condition}</Text> : <View />}
        {trend ? <Text style={styles.trend}>+ {trend}</Text> : null}
      </View>

      {resolvedGradeScore != null || rarityLabel ? (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Grade Score</Text>
            <Text style={styles.statValue}>{formatGradeScore(resolvedGradeScore)}</Text>
          </View>
          <View
            style={[
              styles.statCard,
              styles.rarityCard,
              rarityLabel
                ? {
                    borderColor: rarityVisuals.rarityBorderColor,
                    backgroundColor: rarityVisuals.rarityTint
                  }
                : null
            ]}
          >
            <Text style={styles.statLabel}>Rarity</Text>
            <Text
              style={[
                styles.statValue,
                styles.rarityValue,
                rarityLabel ? { color: rarityVisuals.accentColor } : null
              ]}
            >
              {rarityLabel ?? "-"}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: "#D9D9D9",
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: 1
  },
  panelBorderless: {
    borderWidth: 2,
    borderColor: "#ECECEC",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18
  },
  topRule: {
    width: 38,
    height: 3,
    backgroundColor: colors.accentPrimary,
    marginBottom: 6
  },
  label: {
    ...typography.Caption,
    color: "#7A7A7A",
    fontSize: 10,
    lineHeight: 12,
    marginBottom: 1
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end"
  },
  valueChar: {
    ...typography.DisplayValue,
    fontSize: 56,
    lineHeight: 58
  },
  valueDecimal: {
    color: "#B8B8B8"
  },
  valueCharStatic: {
    opacity: 1,
    transform: [{ translateY: 0 }]
  },
  metaRow: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#EFEFEF",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sub: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  trend: {
    ...typography.Caption,
    color: colors.success,
    fontFamily: "Inter-Bold",
    fontVariant: ["tabular-nums"]
  },
  statsRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EFEFEF",
    flexDirection: "row",
    gap: 10
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E9EDF3",
    borderRadius: 12,
    backgroundColor: "#FBFCFE",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3
  },
  statLabel: {
    ...typography.Caption,
    color: "#7A8392",
    textTransform: "uppercase",
    letterSpacing: 0.45,
    fontFamily: "Inter-Medium"
  },
  statValue: {
    ...typography.H2,
    color: "#141A24",
    fontFamily: "Inter-SemiBold"
  },
  rarityCard: {
    shadowColor: "transparent"
  },
  rarityValue: {
    letterSpacing: 0.1
  }
});
