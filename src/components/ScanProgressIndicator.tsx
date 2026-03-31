import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/theme/tokens";
import { ScanPhase } from "@/types/models";

type Props = {
  phase: ScanPhase;
  frontDone: boolean;
  backDone: boolean;
};

function Dot({ done, active }: { done: boolean; active: boolean }) {
  return <View style={[styles.dot, done && styles.done, active && styles.active]} />;
}

export function ScanProgressIndicator({ phase, frontDone, backDone }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Dot done={frontDone} active={phase === "front"} />
      </View>
      <View style={styles.row}>
        <Dot done={backDone} active={phase === "back"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  row: {
    flexDirection: "row",
    alignItems: "center"
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: "#E5E7EB"
  },
  done: {
    backgroundColor: colors.red
  },
  active: {
    borderWidth: 2,
    borderColor: colors.black
  }
});
