import { StyleSheet } from "react-native";
import { colors, layout, spacing } from "./tokens";

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary
  },
  container: {
    paddingHorizontal: layout.pagePadding
  },
  card: {
    backgroundColor: colors.backgroundPrimary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  }
});
