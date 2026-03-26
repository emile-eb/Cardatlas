import { Image, StyleSheet, View } from "react-native";

const HERO_IMAGE = require("../../../assets/New Hero Paywall.png");
const HERO_ASPECT_RATIO = 1500 / 2000;

export function PaywallHero() {
  return (
    <View style={styles.wrap}>
      <Image source={HERO_IMAGE} style={styles.image} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#FFFFFF"
  },
  image: {
    width: "100%",
    aspectRatio: HERO_ASPECT_RATIO
  }
});
