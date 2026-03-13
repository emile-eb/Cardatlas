import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  title: string;
  rightText?: string;
  kicker?: string;
};

export function SectionHeader({ title, rightText, kicker }: Props) {
  return (
    <View style={styles.wrap}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {rightText ? <Text style={styles.right}>{rightText}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0
  },
  kicker: {
    ...typography.Caption,
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 12
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8
  },
  title: {
    ...typography.H2,
    fontSize: 18,
    lineHeight: 21
  },
  right: {
    ...typography.Caption,
    color: colors.accentPrimary,
    fontFamily: "Inter-Medium",
    fontSize: 10,
    lineHeight: 12
  }
});
