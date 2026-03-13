import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { useRarityVisuals } from "@/hooks/useRarityVisuals";

type Props = {
  value: number;
  condition: string;
  trend?: string;
  borderless?: boolean;
  animateValue?: boolean;
  rarityLabel?: "Common" | "Notable" | "Rare" | "Elite" | "Grail";
  rarityLevel?: 1 | 2 | 3 | 4 | 5;
  enableRarityReveal?: boolean;
  rarityRevealDelayMs?: number;
  onRarityRevealed?: () => void;
};

const rarityLabels = ["Common", "Notable", "Rare", "Elite", "Grail"] as const;
const DEFAULT_RARITY_REVEAL_DELAY_MS = 620;

export function ValuePanel({
  value,
  condition,
  trend,
  borderless = false,
  animateValue = true,
  rarityLabel,
  rarityLevel,
  enableRarityReveal = false,
  rarityRevealDelayMs,
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
  const rarityProgress = rarityLevel ? ((rarityLevel - 1) / 4) * 100 : 0;
  const digitAnimRefs = useRef<Animated.Value[]>([]);
  const revealPulseAnim = useRef(new Animated.Value(0)).current;
  const revealShimmerAnim = useRef(new Animated.Value(0)).current;
  const placeholderShimmerAnim = useRef(new Animated.Value(0)).current;
  const [isRarityRevealing, setIsRarityRevealing] = useState(false);
  const [isRarityVisible, setIsRarityVisible] = useState(Boolean(rarityLabel && rarityLevel));
  const rarityVisuals = useRarityVisuals(rarityLabel);
  const resolvedRevealDelayMs = rarityRevealDelayMs ?? rarityVisuals.revealDelayMs ?? DEFAULT_RARITY_REVEAL_DELAY_MS;
  const topAccentColor = rarityLabel ? rarityVisuals.accentColor : colors.accentPrimary;

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
    if (!rarityLabel || !rarityLevel) {
      setIsRarityRevealing(false);
      setIsRarityVisible(false);
      return;
    }

    if (!enableRarityReveal) {
      setIsRarityRevealing(false);
      setIsRarityVisible(true);
      return;
    }

    setIsRarityRevealing(true);
    setIsRarityVisible(false);
    placeholderShimmerAnim.setValue(0);

    const placeholderShimmerLoop = Animated.loop(
      Animated.timing(placeholderShimmerAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    placeholderShimmerLoop.start();

    const revealTimer = setTimeout(() => {
      placeholderShimmerLoop.stop();
      setIsRarityRevealing(false);
      setIsRarityVisible(true);
      onRarityRevealed?.();
      revealPulseAnim.setValue(0);
      revealShimmerAnim.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(revealPulseAnim, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(revealPulseAnim, {
            toValue: 0,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ]),
        Animated.sequence([
          Animated.delay(110),
          Animated.timing(revealShimmerAnim, {
            toValue: 1,
            duration: 620,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ])
      ]).start(() => {
        revealShimmerAnim.setValue(0);
      });
    }, Math.max(400, Math.min(800, resolvedRevealDelayMs)));

    return () => {
      clearTimeout(revealTimer);
      placeholderShimmerLoop.stop();
    };
  }, [
    enableRarityReveal,
    rarityLabel,
    rarityLevel,
    resolvedRevealDelayMs,
    placeholderShimmerAnim,
    revealPulseAnim,
    revealShimmerAnim,
    onRarityRevealed
  ]);

  return (
    <View style={[styles.panel, borderless && styles.panelBorderless]}>
      <View style={[styles.topRule, { backgroundColor: topAccentColor }]} />
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
      {rarityLabel && rarityLevel ? (
        <View style={styles.rarityWrap}>
          {isRarityRevealing ? (
            <View style={styles.rarityRevealShell}>
              <Text style={styles.rarityRevealEyebrow}>Rarity</Text>
              <View style={styles.revealBadgeShell} />
              <Text style={styles.revealCopy}>Revealing rarity</Text>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.revealShellShimmer,
                  {
                    transform: [
                      {
                        translateX: placeholderShimmerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-220, 220]
                        })
                      }
                    ]
                  }
                ]}
              />
            </View>
          ) : null}

          {isRarityVisible ? (
            <View
              style={[
                styles.rarityCard,
                {
                  backgroundColor: rarityVisuals.rarityTint,
                  borderColor: rarityVisuals.rarityBorderColor
                }
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.rarityGlow,
                  {
                    backgroundColor: rarityVisuals.rarityGlowColor,
                    opacity: revealPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.52]
                    }),
                    transform: [
                      {
                        scale: revealPulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.92, 1.05]
                        })
                      }
                    ]
                  }
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.rarityShimmer,
                  {
                    opacity: revealShimmerAnim.interpolate({
                      inputRange: [0, 0.15, 1],
                      outputRange: [0, 0.24, 0]
                    }),
                    transform: [
                      {
                        translateX: revealShimmerAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-260, 260]
                        })
                      }
                    ]
                  }
                ]}
              />
              <View style={[styles.rarityCardTopAccent, { backgroundColor: rarityVisuals.accentColor }]} />
              <Text style={[styles.rarityCardEyebrow, { color: rarityVisuals.accentColor }]}>Rarity</Text>
              <Text style={[styles.rarityCardTier, { color: rarityVisuals.accentColor }]}>{rarityLabel}</Text>
              <Text style={styles.rarityCardInterpretation}>{rarityVisuals.interpretation}</Text>

              <View style={styles.rarityLadderWrap}>
                <View style={styles.trackWrap}>
                  <View style={styles.trackBase} />
                  <View
                    style={[
                      styles.trackFill,
                      {
                        width: `${rarityProgress}%`,
                        backgroundColor: rarityVisuals.ladderActiveColor
                      }
                    ]}
                  />
                  <View
                    style={[
                      styles.trackMarker,
                      {
                        left: `${rarityProgress}%`,
                        borderColor: rarityVisuals.ladderActiveColor
                      }
                    ]}
                  >
                    <View style={[styles.trackMarkerCore, { backgroundColor: rarityVisuals.ladderActiveColor }]} />
                  </View>
                </View>
                <View style={styles.rarityLabels}>
                  {rarityLabels.map((label) => (
                    <Text
                      key={label}
                      style={[
                        styles.rarityLabel,
                        label === rarityLabel && {
                          color: rarityVisuals.accentColor,
                          fontFamily: "Inter-SemiBold"
                        }
                      ]}
                    >
                      {label}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          ) : null}
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
  rarityWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EFEFEF"
  },
  rarityRevealShell: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EA",
    borderRadius: 12,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 13,
    paddingVertical: 12,
    gap: 7
  },
  rarityRevealEyebrow: {
    ...typography.Caption,
    color: "#6C7480",
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  revealBadgeShell: {
    width: 128,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#E3E7ED"
  },
  revealCopy: {
    ...typography.BodyMedium,
    color: "#5F6672",
    fontFamily: "Inter-Medium"
  },
  revealShellShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: "rgba(255,255,255,0.45)"
  },
  rarityCard: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 11
  },
  rarityCardTopAccent: {
    width: 40,
    height: 2.5,
    borderRadius: 2,
    marginBottom: 8
  },
  rarityGlow: {
    position: "absolute",
    left: 9,
    right: 9,
    top: 9,
    bottom: 9,
    borderRadius: 10
  },
  rarityShimmer: {
    position: "absolute",
    top: -12,
    bottom: -12,
    width: 96,
    backgroundColor: "rgba(255,255,255,0.92)"
  },
  rarityCardEyebrow: {
    ...typography.Caption,
    textTransform: "uppercase",
    letterSpacing: 0.65,
    fontSize: 10,
    lineHeight: 12,
    fontFamily: "Inter-Medium"
  },
  rarityCardTier: {
    ...typography.H1,
    marginTop: 4,
    fontSize: 35,
    lineHeight: 37,
    letterSpacing: -0.35,
    fontFamily: "Inter-Bold"
  },
  rarityCardInterpretation: {
    ...typography.BodyMedium,
    color: "#3F4652",
    marginTop: 3
  },
  rarityLadderWrap: {
    marginTop: 11
  },
  trackWrap: {
    position: "relative",
    height: 22,
    justifyContent: "center"
  },
  trackBase: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(30,35,42,0.22)"
  },
  trackFill: {
    position: "absolute",
    left: 0,
    top: 9.5,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#2563EB"
  },
  trackMarker: {
    position: "absolute",
    top: 5,
    width: 11,
    height: 11,
    marginLeft: -5.5,
    borderRadius: 5.5,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  trackMarkerCore: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25
  },
  rarityLabels: {
    marginTop: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    alignItems: "center"
  },
  rarityLabel: {
    ...typography.Caption,
    color: "#6E7682",
    fontSize: 9.5,
    lineHeight: 12
  }
});
