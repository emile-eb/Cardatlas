import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors, typography } from "@/theme/tokens";

export function OnboardingPaywallCTA({
  title,
  onPress,
  caption
}: {
  title: string;
  onPress: () => void;
  caption?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <PrimaryButton title={title} onPress={onPress} style={styles.button} />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: "auto",
    paddingTop: 22
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
  caption: {
    ...typography.Caption,
    marginTop: 10,
    textAlign: "center",
    color: "#7B8492"
  }
});
