import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  title: string;
  message: string;
  eyebrow?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function FullScreenLoading({
  title,
  message,
  eyebrow = "CARDATLAS",
  icon = "sparkles-outline"
}: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.shell}>
        <View style={styles.mark}>
          <Ionicons name={icon} size={18} color={colors.accentPrimary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
        <View style={styles.progressRow}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
          <Text style={styles.progressText}>Loading</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28
  },
  shell: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: spacing.md
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4F3",
    borderWidth: 1,
    borderColor: "#F4D5D2"
  },
  copy: {
    alignItems: "center",
    gap: 6
  },
  eyebrow: {
    ...typography.Caption,
    color: "#8A93A3",
    fontFamily: "Inter-Medium",
    letterSpacing: 0.7
  },
  title: {
    ...typography.H2,
    color: "#121821",
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  message: {
    ...typography.BodyMedium,
    color: "#6A7281",
    textAlign: "center",
    maxWidth: 300
  },
  progressRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  progressText: {
    ...typography.Caption,
    color: "#6C7482",
    fontFamily: "Inter-Medium"
  }
});
