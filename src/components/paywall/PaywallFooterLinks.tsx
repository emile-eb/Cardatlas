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
  restoreBusy = false,
  tone = "dark",
  showLegal = true
}: {
  onRestore: () => void;
  restoreBusy?: boolean;
  tone?: "dark" | "light";
  showLegal?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onRestore} disabled={restoreBusy} style={({ pressed }) => [pressed && !restoreBusy ? styles.linkPressed : null]}>
        <Text style={[styles.link, tone === "light" ? styles.linkLight : null, restoreBusy ? styles.linkBusy : null]}>
          {restoreBusy ? "Restoring..." : "Restore Purchases"}
        </Text>
      </Pressable>
      {showLegal ? (
        <>
          <Pressable onPress={() => void openUrl(TERMS_URL)}>
            <Text style={[styles.link, tone === "light" ? styles.linkLight : null]}>Terms of Use</Text>
          </Pressable>
          <Pressable onPress={() => void openUrl(PRIVACY_URL)}>
            <Text style={[styles.link, tone === "light" ? styles.linkLight : null]}>Privacy Policy</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12
  },
  link: {
    ...typography.Caption,
    color: "#8A94A4"
  },
  linkPressed: {
    opacity: 0.68
  },
  linkBusy: {
    opacity: 0.72
  },
  linkLight: {
    color: "#7B8596"
  }
});
