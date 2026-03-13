import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function FilterChip({ label, selected, onPress, style }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed, style]}>
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: radius.xs,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    minHeight: 32
  },
  selected: {
    borderColor: colors.accentPrimary,
    backgroundColor: "#FFF6F6"
  },
  pressed: {
    opacity: 0.82
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700"
  },
  selectedLabel: {
    color: colors.accentPrimary
  }
});
