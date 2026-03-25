import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CARDATLAS_SUPPORT_EMAIL, CARDATLAS_SUPPORT_SUBJECT } from "@/constants/settings";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";

const helpItems = [
  {
    title: "Scanning cards",
    body: "Use the scanner to capture the front and back of each card. CardAtlas works best when the card fills the frame and all edges are visible."
  },
  {
    title: "Collection tracking",
    body: "Cards you add to your collection are available in Collection, can be updated with notes and attributes, and can be exported from Settings."
  },
  {
    title: "CardAtlas Pro",
    body: "CardAtlas Pro unlocks unlimited scans and Collector AI. Purchase and restore flows are available directly from Settings."
  }
];

export default function HelpCenterScreen() {
  const openSupport = async () => {
    const url = `mailto:${CARDATLAS_SUPPORT_EMAIL}?subject=${encodeURIComponent(CARDATLAS_SUPPORT_SUBJECT)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) return;
    await Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>Help Center</Text>
        <Text style={styles.subtitle}>Support for scanning, collection tracking, subscriptions, and everyday CardAtlas use.</Text>
      </View>

      <View style={styles.section}>
        {helpItems.map((item) => (
          <View key={item.title} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.supportCard}>
        <Text style={styles.supportTitle}>Need more help?</Text>
        <Text style={styles.supportBody}>Contact CardAtlas support and include any card details, screenshots, or subscription questions that would help us investigate.</Text>
        <Pressable style={styles.supportButton} onPress={() => void openSupport()}>
          <Text style={styles.supportButtonText}>Email Support</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundPrimary },
  content: { padding: layout.pagePadding, paddingBottom: 48, gap: 20 },
  header: { paddingTop: 8 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E6EAF0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF"
  },
  backText: {
    ...typography.Caption,
    color: colors.textPrimary,
    fontFamily: "Inter-Medium"
  },
  hero: { gap: 6, marginTop: 4 },
  title: {
    ...typography.H1,
    fontSize: 30,
    lineHeight: 34,
    fontFamily: "Inter-SemiBold"
  },
  subtitle: {
    ...typography.BodyMedium,
    color: "#5B6677",
    lineHeight: 20,
    maxWidth: 320
  },
  section: { gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: "#E8EDF3",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6
  },
  cardTitle: {
    ...typography.BodyLarge,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary,
    textTransform: "none"
  },
  cardBody: {
    ...typography.BodyMedium,
    color: "#586375",
    lineHeight: 20
  },
  supportCard: {
    borderWidth: 1,
    borderColor: "#E8EDF3",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10
  },
  supportTitle: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold"
  },
  supportBody: {
    ...typography.BodyMedium,
    color: "#586375",
    lineHeight: 20
  },
  supportButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  supportButtonText: {
    ...typography.BodyMedium,
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold"
  }
});
