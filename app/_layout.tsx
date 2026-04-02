import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppStateProvider } from "@/state/AppState";
import { AuthProvider, useAuth } from "@/features/auth";
import { AppPreferencesProvider } from "@/features/settings/AppPreferencesProvider";
import { NotificationsProvider } from "@/features/notifications/NotificationsProvider";
import { TrackingProvider } from "@/features/tracking/TrackingProvider";
import { colors, typography } from "@/theme/tokens";
import { standardTopInset } from "@/theme/safeArea";
import { useEffect } from "react";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { FullScreenLoading } from "@/components/loading/FullScreenLoading";

function AppRootNavigator() {
  const { status, error, bootstrap, session } = useAuth();
  const insets = useSafeAreaInsets();

  if (status === "idle" || status === "loading") {
    return (
      <FullScreenLoading
        title="Preparing CardAtlas"
        message="Loading your collector workspace and account state."
        icon="layers-outline"
      />
    );
  }

  if (status === "error") {
    return (
      <View style={styles.errorScreen}>
        <View style={styles.errorCard}>
          <Text style={styles.errorEyebrow}>CARDATLAS AUTH</Text>
          <Text style={styles.errorTitle}>Session bootstrap failed</Text>
          <Text style={styles.errorCopy}>
            CardAtlas could not create or restore the app session required for scans, paywalls, and Market Pulse.
          </Text>
          <View style={styles.errorDebugBlock}>
            <Text style={styles.errorDebugLine}>auth status: {status}</Text>
            <Text style={styles.errorDebugLine}>app user id: {session?.appUserId ?? "none"}</Text>
            <Text style={styles.errorDebugLine}>user id: {session?.userId ?? "none"}</Text>
            <Text style={styles.errorDebugLine}>auth error: {error ?? "none"}</Text>
          </View>
          <Pressable onPress={() => void bootstrap()} style={styles.errorRetryButton}>
            <Text style={styles.errorRetryText}>Retry Session Bootstrap</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.bg,
          paddingTop: standardTopInset(insets.top)
        }
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="splash" options={{ contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }} />
      <Stack.Screen name="onboarding" options={{ contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }} />
      <Stack.Screen
        name="paywall"
        options={{ presentation: "fullScreenModal", contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }}
      />
      <Stack.Screen
        name="processing"
        options={{ presentation: "transparentModal", contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }}
      />
      <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }} />
      <Stack.Screen name="results/[id]" />
      <Stack.Screen name="results/active-market/[id]" options={{ contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }} />
      <Stack.Screen name="results/price-history/[id]" options={{ contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }} />
      <Stack.Screen name="results/grading-outlook/[id]" options={{ contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }} />
      <Stack.Screen name="chat/[id]" options={{ contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }} />
      <Stack.Screen name="card/[id]" />
      <Stack.Screen name="collection-search" />
      <Stack.Screen name="collection/view/[id]" options={{ contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }} />
      <Stack.Screen name="collection/history" />
      <Stack.Screen name="collection/settings" />
      <Stack.Screen name="help-center" />
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/terms" />
      <Stack.Screen name="scan/review" options={{ contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    analyticsService.initialize();
  }, []);

  const [fontsLoaded] = useFonts({
    "Inter-Regular": Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <FullScreenLoading
          title="Loading CardAtlas"
          message="Preparing the interface and collector tools."
          icon="sparkles-outline"
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppStateProvider>
          <AppPreferencesProvider>
            <TrackingProvider>
              <NotificationsProvider>
                <StatusBar style="dark" />
                <AppRootNavigator />
              </NotificationsProvider>
            </TrackingProvider>
          </AppPreferencesProvider>
        </AppStateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  errorCard: {
    borderWidth: 1,
    borderColor: "#E5E8EE",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 10
  },
  errorEyebrow: {
    ...typography.Caption,
    color: "#8A93A3",
    fontFamily: "Inter-Medium",
    letterSpacing: 0.6
  },
  errorTitle: {
    ...typography.H2,
    color: "#121821",
    fontFamily: "Inter-SemiBold"
  },
  errorCopy: {
    ...typography.BodyMedium,
    color: "#667080"
  },
  errorDebugBlock: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#E2E6EC",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3
  },
  errorDebugLine: {
    ...typography.Caption,
    color: "#243041",
    fontFamily: "Inter-Medium"
  },
  errorRetryButton: {
    marginTop: 4,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center"
  },
  errorRetryText: {
    ...typography.BodyMedium,
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold"
  }
});
