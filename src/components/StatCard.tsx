import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type Props = {
  label: string;
  value: string | number;
  accent?: boolean;
};

export function StatCard({ label, value, accent }: Props) {
  return (
    <View style={[styles.card, accent && styles.accent]}>
      <Text style={[styles.value, accent && styles.valueAccent]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: radius.md,
    backgroundColor: colors.white,
    gap: 3
  },
  accent: {
    borderColor: "#F0C8C6"
  },
  label: {
    ...typography.Caption,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 12
  },
  value: {
    ...typography.DisplayValue,
    fontSize: 38,
    lineHeight: 40,
    fontFamily: "Inter-Bold",
    fontVariant: ["tabular-nums"]
  },
  valueAccent: {
    color: colors.accentPrimary
  }
});
