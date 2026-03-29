import { PropsWithChildren } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { immersiveTopChromeInset } from "@/theme/safeArea";
import { colors, layout, typography } from "@/theme/tokens";
import type { CardItem } from "@/types/models";

export function ResultsDetailScaffold({
  card,
  referenceValue,
  title,
  subtitle,
  resultId,
  backHref,
  referenceVariant = "default",
  showIdentity = true,
  showReferenceStrip = true,
  children
}: PropsWithChildren<{
  card: CardItem;
  referenceValue: number;
  title: string;
  subtitle: string;
  resultId: string;
  backHref?: string;
  referenceVariant?: "default" | "integrated";
  showIdentity?: boolean;
  showReferenceStrip?: boolean;
}>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.chrome, { paddingTop: immersiveTopChromeInset(insets.top) }]}>
        <Pressable onPress={() => router.replace((backHref ?? `/results/${resultId}`) as any)} style={styles.chromeBtn}>
          <Ionicons name="chevron-back" size={18} color="#151B24" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(28, insets.bottom + 20) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {showReferenceStrip ? (
          <View style={[styles.referenceStrip, referenceVariant === "integrated" && styles.referenceStripIntegrated]}>
            {referenceVariant === "default" ? <View style={styles.referenceAccent} /> : null}
            <View style={[styles.referenceMainRow, referenceVariant === "integrated" && styles.referenceMainRowIntegrated]}>
              <View style={styles.referenceCopy}>
                <Text style={styles.referenceLabel}>CardAtlas Reference Value</Text>
                <Text style={styles.referenceValue}>
                  ${referenceValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              {showIdentity ? (
                <View style={styles.identityCopy}>
                  <Text style={styles.identityTitle} numberOfLines={2}>
                    {card.cardTitle}
                  </Text>
                  <Text style={styles.identityMeta} numberOfLines={2}>
                    {card.playerName} | {card.year} {card.brand}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary
  },
  chrome: {
    paddingHorizontal: layout.pagePadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  chromeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E8ECF2",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  content: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: 16,
    gap: 16
  },
  heroCopy: {
    alignItems: "center",
    gap: 5,
    marginTop: 12
  },
  title: {
    ...typography.H1,
    color: "#10161F",
    fontFamily: "Inter-Bold",
    textAlign: "center",
    fontSize: 34,
    lineHeight: 38
  },
  subtitle: {
    ...typography.BodyMedium,
    color: "#737C8B",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 320
  },
  referenceStrip: {
    paddingVertical: 2,
    gap: 10
  },
  referenceStripIntegrated: {
    gap: 0,
    paddingTop: 8,
    paddingBottom: 4
  },
  referenceAccent: {
    width: 32,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.accentPrimary
  },
  referenceMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F6",
    paddingTop: 12
  },
  referenceMainRowIntegrated: {
    borderTopWidth: 1,
    borderTopColor: "#F1F4F7",
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: "center",
    minHeight: 64
  },
  referenceCopy: {
    gap: 2,
    minWidth: 138
  },
  referenceLabel: {
    ...typography.Caption,
    color: "#8A93A3",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Inter-Medium"
  },
  referenceValue: {
    ...typography.H3,
    color: "#11151D",
    fontFamily: "Inter-Bold",
    letterSpacing: -0.2
  },
  identityCopy: {
    flex: 1,
    gap: 2,
    alignItems: "flex-end"
  },
  identityTitle: {
    ...typography.BodyMedium,
    color: "#161D27",
    fontFamily: "Inter-SemiBold",
    maxWidth: 184
  },
  identityMeta: {
    ...typography.Caption,
    color: "#66707F",
    textAlign: "right"
  }
});
