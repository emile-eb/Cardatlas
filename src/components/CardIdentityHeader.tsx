import { useEffect, useMemo, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { CardItem } from "@/types/models";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  card: CardItem;
  auraColor?: string;
  auraBaseOpacity?: number;
  auraPulseOpacity?: number;
  revealPulseToken?: number;
  revealPulseDurationMs?: number;
};

export function CardIdentityHeader({
  card,
  auraColor,
  auraBaseOpacity = 0,
  auraPulseOpacity = 0,
  revealPulseToken = 0,
  revealPulseDurationMs = 400
}: Props) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const imageSource = useMemo(() => ({ uri: card.imageFront }), [card.imageFront]);

  useEffect(() => {
    if (!auraColor || auraBaseOpacity <= 0 || auraPulseOpacity <= 0) return;
    if (revealPulseToken <= 0) return;

    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: Math.round(revealPulseDurationMs * 0.45),
        useNativeDriver: true
      }),
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: Math.round(revealPulseDurationMs * 0.55),
        useNativeDriver: true
      })
    ]).start();
  }, [auraBaseOpacity, auraColor, auraPulseOpacity, pulseAnim, revealPulseDurationMs, revealPulseToken]);

  const auraOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [auraBaseOpacity, auraBaseOpacity + auraPulseOpacity]
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.heroWrap}>
        <View style={styles.blurLayer}>
          <Image source={imageSource} style={styles.imageBackdrop} resizeMode="cover" blurRadius={30} />
          <View style={styles.imageBackdropScrim} />
        </View>

        {auraColor && auraBaseOpacity > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.auraLayer, { opacity: auraOpacity }]}>
            <View style={[styles.auraCore, { backgroundColor: auraColor }]} />
            <View style={[styles.auraHalo, { backgroundColor: auraColor }]} />
            <View style={[styles.auraOuter, { backgroundColor: auraColor }]} />
          </Animated.View>
        ) : null}

        <View style={styles.cardLayer}>
          <Image source={imageSource} style={styles.image} resizeMode="contain" />
        </View>
      </View>

      <View style={styles.meta}>
        <Text style={styles.kicker}>IDENTITY MATCHED</Text>
        <Text style={styles.title}>{card.cardTitle}</Text>
        <Text style={styles.subtitle}>{card.playerName} | {card.team}</Text>
        <Text style={styles.detail}>{card.year} {card.brand} {card.set} #{card.cardNumber}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm
  },
  heroWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E4E4E4",
    backgroundColor: colors.surface
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1
  },
  imageBackdrop: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    transform: [{ scale: 1.16 }],
    opacity: 0.78
  },
  imageBackdropScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,10,10,0.12)"
  },
  auraLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  auraCore: {
    position: "absolute",
    width: "66%",
    height: "66%",
    borderRadius: 999,
    opacity: 0.78
  },
  auraHalo: {
    position: "absolute",
    width: "88%",
    height: "88%",
    borderRadius: 999,
    opacity: 0.44
  },
  auraOuter: {
    position: "absolute",
    width: "108%",
    height: "108%",
    borderRadius: 999,
    opacity: 0.2
  },
  cardLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center"
  },
  image: {
    width: "84%",
    height: "96%",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6
  },
  meta: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accentPrimary,
    paddingLeft: spacing.sm,
    gap: 2
  },
  kicker: {
    ...typography.Caption
  },
  title: {
    ...typography.H3,
    fontSize: 20,
    lineHeight: 24
  },
  subtitle: {
    ...typography.BodyMedium,
    fontFamily: "Inter-Medium"
  },
  detail: {
    ...typography.Caption
  }
});
