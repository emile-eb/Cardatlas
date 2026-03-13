import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  title: string;
  subtitle: string;
};

export function EmptyState({ title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: "#E4E4E4",
    padding: spacing.lg,
    backgroundColor: "#FCFCFC",
    gap: spacing.xs
  },
  bar: {
    width: 26,
    height: 2,
    backgroundColor: colors.accentPrimary
  },
  title: {
    ...typography.h3,
    fontSize: 17
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary
  }
});
