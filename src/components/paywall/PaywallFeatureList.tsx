import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography } from "@/theme/tokens";

const FEATURES = [
  {
    title: "Unlimited card scans",
    detail: "Scan as often as you collect."
  },
  {
    title: "Collector workflow",
    detail: "Track cards, value, and portfolio context."
  },
  {
    title: "Collector AI",
    detail: "Get market and grading guidance built in."
  }
];

export function PaywallFeatureList({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      {FEATURES.map((feature) => (
        <View key={feature.title} style={[styles.row, compact ? styles.rowCompact : null]}>
          <View style={[styles.iconWrap, compact ? styles.iconWrapCompact : null]}>
            <Ionicons name="checkmark" size={14} color={colors.accentPrimary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, compact ? styles.titleCompact : null]}>{feature.title}</Text>
            <Text numberOfLines={1} style={[styles.detail, compact ? styles.detailCompact : null]}>{feature.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8
  },
  wrapCompact: {
    gap: 6
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  rowCompact: {
    gap: 8
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F3C9C7",
    backgroundColor: "#FFF6F5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1
  },
  iconWrapCompact: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginTop: 0
  },
  copy: {
    flex: 1,
    gap: 0
  },
  title: {
    ...typography.BodyLarge,
    color: "#121925",
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    lineHeight: 17
  },
  titleCompact: {
    fontSize: 12,
    lineHeight: 15
  },
  detail: {
    ...typography.BodyMedium,
    color: "#667183",
    fontSize: 11,
    lineHeight: 14
  },
  detailCompact: {
    fontSize: 10,
    lineHeight: 12
  }
});
