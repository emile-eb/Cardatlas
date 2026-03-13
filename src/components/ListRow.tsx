import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  label: string;
  value: string;
  divider?: boolean;
  emphasis?: boolean;
  variant?: "default" | "scoreboard";
};

export function ListRow({ label, value, divider = true, emphasis, variant = "default" }: Props) {
  const scoreboard = variant === "scoreboard";
  return (
    <View style={[styles.row, scoreboard && styles.rowScoreboard, divider && styles.divider]}>
      <Text style={[styles.label, emphasis && styles.labelStrong, scoreboard && styles.labelScoreboard]}>{label}</Text>
      <Text style={[styles.value, emphasis && styles.valueStrong, scoreboard && styles.valueScoreboard]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  rowScoreboard: {
    paddingVertical: 6
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE"
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  labelStrong: {
    color: colors.textPrimary,
    fontFamily: "Inter-Medium"
  },
  labelScoreboard: {
    fontFamily: "Inter-Medium",
    color: colors.textPrimary
  },
  value: {
    ...typography.bodyMedium,
    textAlign: "right",
    minWidth: 74,
    fontVariant: ["tabular-nums"]
  },
  valueStrong: {
    color: colors.accentPrimary,
    fontFamily: "Inter-Bold"
  },
  valueScoreboard: {
    fontFamily: "Inter-Bold",
    fontSize: 14,
    lineHeight: 18,
    color: colors.accentPrimary
  }
});
