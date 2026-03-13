import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography } from "@/theme/tokens";

const FIRST_PAYWALL_HERO = require("../../../../assets/New Pg 1 Hero.png");
const SECOND_PAYWALL_HERO = require("../../../../assets/New pg 2 hero.png");

export function OnboardingPaywallHeroPlaceholder({
  variant,
  minHeight
}: {
  variant: "product" | "trust";
  minHeight: number;
}) {
  if (variant === "trust") {
    return (
      <View style={[styles.frame, styles.frameTrust, { minHeight }]}>
        <LinearGradient colors={["#FFFFFF", "#F8F9FB"]} style={styles.gradient}>
          {/*
            Reserved trust-focused hero art surface for future onboarding visuals.
            This image can be replaced later without changing the trust-step layout.
          */}
          <View style={styles.trustImageWrap}>
            <Image source={SECOND_PAYWALL_HERO} style={styles.trustImage} resizeMode="cover" />
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.frame, styles.frameProduct, { minHeight }]}>
      <LinearGradient colors={["#FFFFFF", "#FFFFFF"]} style={styles.gradient}>
        {/*
          Reserved hero art surface for future onboarding visuals.
          The current image can be replaced later with a more polished custom hero
          without changing the surrounding onboarding layout.
        */}
        <View style={styles.productImageWrap}>
          <Image source={FIRST_PAYWALL_HERO} style={styles.productImage} resizeMode="contain" />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    backgroundColor: "#FBFBFC"
  },
  frameProduct: {
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24
  },
  frameTrust: {
    borderRadius: 0
  },
  gradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  productImageWrap: {
    width: "100%",
    height: "100%",
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  productImage: {
    width: "114%",
    height: "114%",
    transform: [{ translateY: 18 }]
  },
  trustImageWrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  trustImage: {
    width: "100%",
    height: "100%"
  }
});
