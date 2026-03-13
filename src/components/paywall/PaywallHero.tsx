import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { typography } from "@/theme/tokens";
import type { PaywallVariantContent } from "@/features/paywall/paywallVariants";

const HERO_IMAGE = require("../../../assets/New Paywall Hero.png");

export function PaywallHero({
  variant,
  onClose
}: {
  variant: PaywallVariantContent;
  onClose: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.surface}>
        <Image source={HERO_IMAGE} style={styles.image} resizeMode="contain" />
        <LinearGradient
          colors={["rgba(7,9,13,0.14)", "rgba(7,9,13,0.38)", "rgba(7,9,13,0.92)"]}
          locations={[0, 0.48, 1]}
          style={styles.overlay}
        >
          <View style={styles.topRow}>
            <Text style={styles.brandText}>CardAtlas</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="#E4E8EF" />
            </Pressable>
          </View>
          <View style={styles.copyWrap}>
            <Text style={styles.kicker}>{variant.heroKicker}</Text>
            <Text style={styles.headline}>{variant.headline}</Text>
            <Text style={styles.subheadline}>{variant.subheadline}</Text>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1
  },
  surface: {
    flex: 1,
    backgroundColor: "#0A0D13",
    overflow: "hidden"
  },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14
  },
  brandText: {
    ...typography.Caption,
    color: "rgba(236,240,248,0.88)",
    letterSpacing: 0.7
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(227,233,244,0.30)",
    backgroundColor: "rgba(12,16,23,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  copyWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 40,
    maxWidth: "92%"
  },
  kicker: {
    ...typography.Caption,
    color: "#F3B8B4",
    fontFamily: "Inter-Medium",
    letterSpacing: 0.7,
    marginBottom: 8
  },
  headline: {
    ...typography.H1,
    color: "#F7FAFF",
    fontFamily: "Inter-Bold",
    fontSize: 34,
    lineHeight: 38
  },
  subheadline: {
    ...typography.BodyMedium,
    marginTop: 8,
    color: "#D0D8E6",
    lineHeight: 20
  }
});
