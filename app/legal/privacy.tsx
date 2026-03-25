import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, layout, typography } from "@/theme/tokens";

const sections = [
  {
    title: "What CardAtlas stores",
    body: "CardAtlas stores the card records, scan history, collection data, onboarding answers, and subscription state needed to operate your account and restore your experience."
  },
  {
    title: "Device preferences",
    body: "Settings such as notifications, scan tips, and Collector AI visibility are stored locally on this device so your app experience stays consistent between launches."
  },
  {
    title: "Support and billing",
    body: "Purchase restoration and subscription management use the platform billing systems connected to CardAtlas Pro. Support requests you send by email are handled outside the app."
  }
];

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>Updated for the current CardAtlas app build. This in-app summary explains how CardAtlas uses the core data required to power your collection experience.</Text>
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
