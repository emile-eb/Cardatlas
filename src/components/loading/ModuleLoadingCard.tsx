import { Animated, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { colors, typography } from "@/theme/tokens";

type Props = {
  title: string;
  subtitle: string;
  compact?: boolean;
};

export function ModuleLoadingCard({ title, subtitle, compact = false }: Props) {
  const shimmer = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true
        }),
        Animated.timing(shimmer, {
          toValue: 0.5,
          duration: 850,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [shimmer]);

  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <View style={styles.kickerDot} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Animated.View style={[styles.tag, { opacity: shimmer }]}>
          <Text style={styles.tagText}>Loading</Text>
        </Animated.View>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Animated.View style={[styles.primaryBar, { opacity: shimmer }]} />
      <View style={styles.row}>
        <Animated.View style={[styles.statBlock, { opacity: shimmer }]} />
        <Animated.View style={[styles.statBlock, { opacity: shimmer }]} />
      </View>
      {!compact ? (
        <View style={styles.row}>
          <Animated.View style={[styles.line, styles.lineWide, { opacity: shimmer }]} />
          <Animated.View style={[styles.line, styles.lineShort, { opacity: shimmer }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderColor: "#E7EBF1",
    borderRadius: 14,
    backgroundColor: "#FBFCFE",
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  shellCompact: {
    paddingVertical: 11
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  titleBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  kickerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accentPrimary
  },
  title: {
    ...typography.BodyMedium,
    color: "#131A24",
    fontFamily: "Inter-SemiBold"
  },
  tag: {
    borderWidth: 1,
    borderColor: "#ECEFF4",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  tagText: {
    ...typography.Caption,
    color: "#7B8391",
    fontFamily: "Inter-Medium"
  },
  subtitle: {
    ...typography.Caption,
    color: "#67707F",
    marginTop: 8,
    marginBottom: 10
  },
  primaryBar: {
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EEF2F7",
    marginBottom: 10
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  statBlock: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F0F3F7"
  },
  line: {
    marginTop: 8,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F0F3F7"
  },
  lineWide: {
    flex: 1.15
  },
  lineShort: {
    flex: 0.75
  }
});
