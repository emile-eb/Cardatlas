import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { AppStateProvider } from "@/state/AppState";
import { AuthProvider, useAuth } from "@/features/auth";
import { AppPreferencesProvider } from "@/features/settings/AppPreferencesProvider";
import { NotificationsProvider } from "@/features/notifications/NotificationsProvider";
import { colors } from "@/theme/tokens";
import { standardTopInset } from "@/theme/safeArea";
import { useEffect } from "react";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { FullScreenLoading } from "@/components/loading/FullScreenLoading";

function AppRootNavigator() {
  const { status } = useAuth();
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
        options={{ presentation: "modal", contentStyle: { backgroundColor: colors.bg, paddingTop: 0 } }}
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
            <NotificationsProvider>
              <StatusBar style="dark" />
              <AppRootNavigator />
            </NotificationsProvider>
          </AppPreferencesProvider>
        </AppStateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
