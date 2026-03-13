import { StyleSheet, Text, View } from "react-native";
import { typography } from "@/theme/tokens";

const STATS = [
  { value: "1M+", label: "scans" },
  { value: "175", label: "countries" },
  { value: "4.9", label: "rating" }
];

export function PaywallTrustStats() {
  return (
    <View style={styles.row}>
      {STATS.map((stat) => (
        <View key={stat.label} style={styles.item}>
          <Text style={styles.value}>
            {stat.value} {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 6
  },
  value: {
    ...typography.Caption,
    color: "rgba(226,232,244,0.74)",
    fontFamily: "Inter-Medium"
  }
});
