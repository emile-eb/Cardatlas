import { Pressable, StyleSheet, Text } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function QuestionOption({ label, selected, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    borderWidth: 1,
    borderColor: "#E4E4E4",
    borderRadius: 14,
    backgroundColor: colors.white,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  optionSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: "#FFF2F1"
  },
  optionPressed: {
    opacity: 0.9
  },
  optionText: {
    ...typography.BodyLarge,
    fontFamily: "Inter-Medium",
    color: colors.textPrimary,
    flex: 1
  },
  optionTextSelected: {
    color: "#B10C06"
  }
});
