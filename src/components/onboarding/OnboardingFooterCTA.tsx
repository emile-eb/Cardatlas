import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors, layout, spacing } from "@/theme/tokens";

type Props = {
  label: string;
  disabled?: boolean;
  onPress: () => void;
};

export function OnboardingFooterCTA({ label, disabled, onPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <PrimaryButton title={label} onPress={onPress} disabled={disabled} style={styles.ctaBlack} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: "#EFEFEF",
    backgroundColor: colors.backgroundPrimary,
    paddingTop: spacing.md,
    paddingHorizontal: layout.pagePadding
  },
  ctaBlack: {
    backgroundColor: colors.textPrimary
  }
});
