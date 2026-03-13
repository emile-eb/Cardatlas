import { TextStyle } from "react-native";

export const colors = {
  backgroundPrimary: "#FFFFFF",
  textPrimary: "#111111",
  textSecondary: "#555555",
  border: "#E6E6E6",
  surface: "#F8F8F8",
  accentPrimary: "#E10600",
  accentSecondary: "#FF3B30",
  success: "#16A34A",
  neutral900: "#111111",
  neutral700: "#555555",
  neutral400: "#BDBDBD",
  neutral200: "#E6E6E6",
  white: "#FFFFFF",
  black: "#000000",
  bg: "#FFFFFF",
  text: "#111111",
  muted: "#555555",
  red: "#E10600",
  redDark: "#C80500"
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48
};

export const radius = {
  xs: 6,
  sm: 12,
  md: 14,
  lg: 14,
  pill: 999
};

const interRegular = "Inter-Regular";
const interMedium = "Inter-Medium";
const interSemiBold = "Inter-SemiBold";
const interBold = "Inter-Bold";
const t = (style: TextStyle) => style;

export const typography = {
  DisplayValue: t({
    fontFamily: interBold,
    fontSize: 54,
    lineHeight: 56,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"]
  }),
  H1: t({
    fontFamily: interSemiBold,
    fontSize: 28,
    lineHeight: 32,
    color: colors.textPrimary
  }),
  H2: t({
    fontFamily: interMedium,
    fontSize: 18,
    lineHeight: 22,
    color: colors.textPrimary
  }),
  H3: t({
    fontFamily: interMedium,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary
  }),
  BodyLarge: t({
    fontFamily: interRegular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary
  }),
  BodyMedium: t({
    fontFamily: interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary
  }),
  Caption: t({
    fontFamily: interRegular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary
  }),
  displayLarge: t({
    fontFamily: interBold,
    fontSize: 54,
    lineHeight: 56,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"]
  }),
  displayMedium: t({
    fontFamily: interBold,
    fontSize: 30,
    lineHeight: 32,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"]
  }),
  h1: t({
    fontFamily: interSemiBold,
    fontSize: 28,
    lineHeight: 32,
    color: colors.textPrimary
  }),
  h2: t({
    fontFamily: interMedium,
    fontSize: 18,
    lineHeight: 22,
    color: colors.textPrimary
  }),
  h3: t({
    fontFamily: interMedium,
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary
  }),
  bodyLarge: t({
    fontFamily: interRegular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary
  }),
  bodyMedium: t({
    fontFamily: interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary
  }),
  bodySmall: t({
    fontFamily: interRegular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary
  }),
  caption: t({
    fontFamily: interRegular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary
  }),
  value: t({
    fontFamily: interBold,
    fontSize: 54,
    lineHeight: 56,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"]
  }),
  body: t({
    fontFamily: interRegular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary
  })
};

export const shadows = {
  cardShadow: {
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2
  },
  elevatedShadow: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 6
  }
};

export const shadow = {
  ios: shadows.cardShadow,
  android: { elevation: 2 }
};

export const layout = {
  pagePadding: spacing.lg,
  sectionGap: spacing.xxl,
  cardPadding: spacing.md
};
