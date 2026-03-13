import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/theme/tokens";

type Props = PropsWithChildren<{ style?: ViewStyle }>;

export function Panel({ children, style }: Props) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.backgroundPrimary,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: radius.md,
    padding: spacing.sm
  }
});
