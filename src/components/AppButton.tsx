import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
  leftIcon?: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  style,
  disabled,
  leftIcon,
  pending,
  pendingLabel
}: Props) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const resolvedDisabled = disabled || pending;
  const spinnerColor = isPrimary ? colors.white : variant === "ghost" ? colors.textPrimary : colors.textSecondary;
  const label = pending ? pendingLabel ?? title : title;

  return (
    <Pressable
      onPress={onPress}
      disabled={resolvedDisabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        variant === "ghost" && styles.ghost,
        pressed && !resolvedDisabled && styles.pressed,
        resolvedDisabled && styles.disabled,
        style
      ]}
    >
      <View style={styles.content}>
        {pending ? (
          <View style={styles.pendingWrap}>
            <ActivityIndicator size="small" color={spinnerColor} />
          </View>
        ) : leftIcon ? (
          <View style={styles.iconWrap}>{leftIcon}</View>
        ) : null}
        <Text style={[styles.text, isPrimary && styles.primaryText, isSecondary && styles.secondaryText]}>{label}</Text>
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
  pendingWrap: {
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
