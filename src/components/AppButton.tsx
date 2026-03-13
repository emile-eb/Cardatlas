import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
  leftIcon?: ReactNode;
};

export function AppButton({ title, onPress, variant = "primary", style, disabled, leftIcon }: Props) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        variant === "ghost" && styles.ghost,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style
      ]}
    >
      <View style={styles.content}>
        {leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
        <Text style={[styles.text, isPrimary && styles.primaryText, isSecondary && styles.secondaryText]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52
  },
  primary: {
    backgroundColor: colors.accentPrimary
  },
  secondary: {
    backgroundColor: "#FCFCFC",
    borderWidth: 1,
    borderColor: "#E7E7E7"
  },
  ghost: {
    backgroundColor: "transparent"
  },
  pressed: {
    opacity: 0.86
  },
  disabled: {
    opacity: 0.55
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrap: {
    marginRight: 8
  },
  text: {
    ...typography.BodyMedium,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary
  },
  primaryText: {
    color: colors.white
  },
  secondaryText: {
    color: colors.textSecondary
  }
});
