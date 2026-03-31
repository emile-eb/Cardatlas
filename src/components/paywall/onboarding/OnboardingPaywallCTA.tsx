import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors, typography } from "@/theme/tokens";

export function OnboardingPaywallCTA({
  title,
  onPress,
  caption,
  disabled,
  pending,
  pendingLabel
}: {
  title: string;
  onPress: () => void;
  caption?: string;
  disabled?: boolean;
  pending?: boolean;
  pendingLabel?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <PrimaryButton
        title={title}
        onPress={onPress}
        style={styles.button}
        disabled={disabled}
        pending={pending}
        pendingLabel={pendingLabel}
      />
      <View style={styles.captionSlot}>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 22,
    minHeight: 104
  },
  button: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: colors.accentPrimary,
    shadowColor: colors.accentPrimary,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 }
  },
  captionSlot: {
    minHeight: 28,
    justifyContent: "flex-start"
  },
  caption: {
    ...typography.Caption,
    marginTop: 10,
    textAlign: "center",
    color: "#7B8492"
  }
});
