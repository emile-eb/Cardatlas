import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  current: number;
  total: number;
  showStepText?: boolean;
};

export function OnboardingProgress({ current, total, showStepText = true }: Props) {
  const progress = Math.max(0, Math.min(1, current / total));
  return (
    <View style={styles.wrap}>
      {showStepText ? <Text style={styles.stepText}>Step {current} of {total}</Text> : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs
  },
  stepText: {
    ...typography.Caption,
    fontFamily: "Inter-Medium",
    color: colors.textSecondary
  },
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#EFEFEF",
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    backgroundColor: colors.accentPrimary,
    borderRadius: 999
  }
});
