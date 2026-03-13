import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = { label: string };

export function PremiumFeatureRow({ label }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>+</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0"
  },
  icon: {
    ...typography.bodyLarge,
    color: colors.accentPrimary,
    fontWeight: "800",
    width: 16
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textPrimary
  }
});
