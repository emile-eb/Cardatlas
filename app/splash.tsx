import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { colors, typography } from "@/theme/tokens";
import { useAuth } from "@/features/auth";
import { useAppState } from "@/state/AppState";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";

export default function SplashScreen() {
  const { status } = useAuth();
  const { startupRoute } = useAppState();

  useEffect(() => {
    analyticsService.track(ANALYTICS_EVENTS.appOpened);
  }, []);

  useEffect(() => {
    if (status === "idle" || status === "loading") {
      return;
    }

    const t = setTimeout(() => {
      const nextRoute = startupRoute === "/splash" ? "/onboarding" : startupRoute;
      router.replace(nextRoute);
    }, 1100);
    return () => clearTimeout(t);
  }, [status, startupRoute]);

  return (
    <View style={styles.wrap}>
      <View style={styles.stitch} />
      <Text style={styles.logo}>CardAtlas</Text>
      <Text style={styles.tag}>SCAN. VALUE. DECIDE.</Text>
      <ActivityIndicator color={colors.accentPrimary} style={{ marginTop: 18 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    justifyContent: "center",
    alignItems: "center"
  },
  stitch: {
    width: 124,
    height: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F5CCCA",
    marginBottom: 24
  },
  logo: {
    ...typography.H1,
    fontSize: 38,
    lineHeight: 42
  },
  tag: {
    marginTop: 6,
    ...typography.Caption,
    color: colors.textSecondary
  }
});
