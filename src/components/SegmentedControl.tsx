import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

type SegmentOption = {
  key: string;
  label: string;
};

type Props = {
  options: SegmentOption[];
  value: string;
  onChange: (key: string) => void;
};

export function SegmentedControl({ options, value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable key={option.key} style={[styles.segment, active && styles.segmentActive]} onPress={() => onChange(option.key)}>
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E3E3E3",
    padding: 3,
    backgroundColor: "#FAFAFA"
  },
  segment: {
    flex: 1,
    borderRadius: 0,
    paddingVertical: spacing.xs,
    alignItems: "center"
  },
  segmentActive: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E8E8E8"
  },
  label: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary
  },
  labelActive: {
    color: colors.accentPrimary
  }
});
