import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { typography } from "@/theme/tokens";

const TERMS_URL = "https://www.cardatlas.app/terms";
const PRIVACY_URL = "https://www.cardatlas.app/privacy";

async function openUrl(url: string) {
  const supported = await Linking.canOpenURL(url);
  if (!supported) return;
  await Linking.openURL(url);
}

export function PaywallFooterLinks({
  onRestore,
  tone = "dark"
}: {
  onRestore: () => void;
  tone?: "dark" | "light";
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onRestore}>
        <Text style={[styles.link, tone === "light" ? styles.linkLight : null]}>Restore Purchases</Text>
      </Pressable>
      <Pressable onPress={() => void openUrl(TERMS_URL)}>
        <Text style={[styles.link, tone === "light" ? styles.linkLight : null]}>Terms of Use</Text>
      </Pressable>
      <Pressable onPress={() => void openUrl(PRIVACY_URL)}>
        <Text style={[styles.link, tone === "light" ? styles.linkLight : null]}>Privacy Policy</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 14
  },
  link: {
    ...typography.Caption,
    color: "#9EA8B9"
  },
  linkLight: {
    color: "#70798A"
  }
});
