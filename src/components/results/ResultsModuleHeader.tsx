import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { typography } from "@/theme/tokens";

export function ResultsModuleHeader({
  title,
  eyebrow,
  trailingLabel,
  onPressAction,
  actionLabel = "View details"
}: {
  title: string;
  eyebrow?: string;
  trailingLabel?: string;
  onPressAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <View style={styles.accent} />
          <View style={styles.copy}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
      </View>
      {onPressAction ? (
        <Pressable onPress={onPressAction} hitSlop={8} style={({ pressed }) => [styles.actionWrap, pressed && styles.actionWrapPressed]}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={12} color="#6F7888" />
        </Pressable>
      ) : trailingLabel ? (
        <Text style={styles.trailingLabel}>{trailingLabel}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12
  },
  left: {
    flex: 1
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  accent: {
    width: 3,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#E10600"
  },
  copy: {
    flex: 1,
    gap: 1
  },
  eyebrow: {
    ...typography.Caption,
    color: "#8A93A3",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: "Inter-Medium"
  },
  title: {
    ...typography.H3,
    color: "#11151D",
    fontFamily: "Inter-SemiBold"
  },
  trailingLabel: {
    ...typography.Caption,
    color: "#7C8494",
    fontFamily: "Inter-Medium"
  },
  actionWrap: {
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  actionWrapPressed: {
    opacity: 0.68
  },
  actionLabel: {
    ...typography.Caption,
    color: "#6F7888",
    fontFamily: "Inter-SemiBold"
  }
});
