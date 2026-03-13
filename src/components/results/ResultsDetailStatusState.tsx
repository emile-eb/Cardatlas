import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, layout, spacing, typography } from "@/theme/tokens";

type Props = {
  title: string;
  message: string;
  backHref?: string;
  actionLabel?: string;
};

export function ResultsDetailStatusState({ title, message, backHref, actionLabel = "Back to Results" }: Props) {
  const goBack = () => {
    if (backHref) {
      router.replace(backHref as any);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/home");
  };

  return (
    <View style={styles.screen}>
      <View style={styles.iconWrap}>
        <Ionicons name="analytics-outline" size={20} color="#7B8596" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable onPress={goBack} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: layout.pagePadding,
    gap: 10
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    backgroundColor: "#FAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  title: {
    ...typography.H3,
    fontFamily: "Inter-SemiBold",
    textAlign: "center",
    color: "#151C28"
  },
  message: {
    ...typography.BodyMedium,
    color: "#657082",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320
  },
  action: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#E2E7EE",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  actionPressed: {
    opacity: 0.84
  },
  actionText: {
    ...typography.Caption,
    color: colors.textPrimary,
    fontFamily: "Inter-SemiBold"
  }
});
