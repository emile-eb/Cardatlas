import { StyleSheet, Text, View } from "react-native";
import { typography } from "@/theme/tokens";

const FEATURES = [
  "Unlimited card scans",
  "AI collector expert",
  "Real recent sales data",
  "Track your collection value"
];

export function PaywallFeatureList() {
  return (
    <View style={styles.wrap}>
      {FEATURES.map((feature) => (
        <Text key={feature} style={styles.text}>{feature}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 2,
    gap: 16
  },
  text: {
    ...typography.BodyMedium,
    color: "#DCE2EC",
    letterSpacing: 0.1
  }
});
