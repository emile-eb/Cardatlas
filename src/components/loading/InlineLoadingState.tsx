import { Animated, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { typography } from "@/theme/tokens";

type Props = {
  title: string;
  message: string;
  tone?: "light" | "dark";
  minHeight?: number;
};

export function InlineLoadingState({
  title,
  message,
  tone = "light",
  minHeight = 120
}: Props) {
  const shimmer = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.55, duration: 900, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [shimmer]);

  const dark = tone === "dark";

  return (
    <View
      style={[
        styles.shell,
        dark ? styles.shellDark : styles.shellLight,
        { minHeight }
      ]}
    >
      <Text style={[styles.title, dark ? styles.titleDark : null]}>{title}</Text>
      <Text style={[styles.message, dark ? styles.messageDark : null]}>{message}</Text>
      <Animated.View style={[styles.barLarge, dark ? styles.barDark : styles.barLight, { opacity: shimmer }]} />
      <View style={styles.row}>
        <Animated.View style={[styles.barSmall, dark ? styles.barDark : styles.barLight, { opacity: shimmer }]} />
        <Animated.View style={[styles.barSmall, dark ? styles.barDark : styles.barLight, { opacity: shimmer }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: "center"
  },
  shellLight: {
    borderColor: "rgba(20,27,37,0.08)",
    backgroundColor: "#FAFBFC"
  },
  shellDark: {
    borderColor: "rgba(227,235,247,0.16)",
    backgroundColor: "rgba(18,24,38,0.92)"
  },
  title: {
    ...typography.BodyMedium,
    color: "#141B25",
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  titleDark: {
    color: "#E6ECF6"
  },
  message: {
    ...typography.Caption,
    color: "#6E7786",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 12
  },
  messageDark: {
    color: "#A6B1C3"
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  barLarge: {
    height: 36,
    borderRadius: 12
  },
  barSmall: {
    flex: 1,
    height: 12,
    borderRadius: 999
  },
  barLight: {
    backgroundColor: "#EAEFF5"
  },
  barDark: {
    backgroundColor: "rgba(231,238,248,0.12)"
  }
});
