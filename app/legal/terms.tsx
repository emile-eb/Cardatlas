import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, layout, typography } from "@/theme/tokens";

const sections = [
  {
    title: "Using CardAtlas",
    body: "CardAtlas is provided to help you scan cards, track your collection, review card data, and access CardAtlas Pro features when available."
  },
  {
    title: "Account and purchases",
    body: "CardAtlas may operate through an anonymous app session on this device. Purchases and restorations are handled through the app store account connected to CardAtlas Pro."
  },
  {
    title: "Collection information",
    body: "Card values, grading outlooks, and market signals in CardAtlas are informational tools. You remain responsible for collection, buying, selling, and grading decisions."
  }
];

export default function TermsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>This in-app summary outlines the current CardAtlas product terms for using the app, CardAtlas Pro, and the decision-support tools provided inside the experience.</Text>
      </View>

      <View style={styles.card}>
        {sections.map((section, index) => (
          <View key={section.title} style={[styles.section, index > 0 && styles.sectionDivider]}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
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
    lineHeight: 20
  },
  card: {
    borderWidth: 1,
    borderColor: "#E8EDF3",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    overflow: "hidden"
  },
  section: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: "#EFF3F7"
  },
  sectionTitle: {
    ...typography.BodyLarge,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary
  },
  sectionBody: {
    ...typography.BodyMedium,
    color: "#586375",
    lineHeight: 20
  }
});
