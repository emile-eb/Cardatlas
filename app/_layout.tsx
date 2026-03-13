import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { AppStateProvider } from "@/state/AppState";
import { AuthProvider, useAuth } from "@/features/auth";
import { View, ActivityIndicator } from "react-native";
import { colors } from "@/theme/tokens";
import { useEffect } from "react";
import { analyticsService } from "@/services/analytics/AnalyticsService";

function AppRootNavigator() {
  const { status } = useAuth();

  if (status === "idle" || status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="small" color={colors.red} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="splash" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      <Stack.Screen name="processing" options={{ presentation: "transparentModal" }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="results/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="card/[id]" />
      <Stack.Screen name="collection-search" />
      <Stack.Screen name="collection/history" />
      <Stack.Screen name="collection/settings" />
      <Stack.Screen name="scan/review" />
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

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <AppStateProvider>
        <StatusBar style="dark" />
        <AppRootNavigator />
      </AppStateProvider>
    </AuthProvider>
  );
}
