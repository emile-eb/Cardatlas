import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState as RNAppState, Platform } from "react-native";
import { useAuth } from "@/features/auth";
import { useAppPreferences } from "@/features/settings/AppPreferencesProvider";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { trackingConsentService } from "@/services/tracking/TrackingConsentService";
import type { TrackingPermissionStatus, TrackingRuntimeState } from "@/types";

type TrackingContextValue = TrackingRuntimeState & {
  requestPermission: (source: "app_launch" | "post_onboarding" | "settings") => Promise<TrackingPermissionStatus>;
};

const TrackingContext = createContext<TrackingContextValue | null>(null);

function buildDefaultTrackingState(): TrackingRuntimeState {
  if (Platform.OS === "ios") {
    return {
      permissionStatus: "undetermined",
      trackingAllowed: false,
      metaTrackingEnabled: false,
      metaInitialized: false
    };
  }

  if (Platform.OS === "web") {
    return {
      permissionStatus: "unavailable",
      trackingAllowed: false,
      metaTrackingEnabled: false,
      metaInitialized: false
    };
  }

  return {
    permissionStatus: "granted",
    trackingAllowed: true,
    metaTrackingEnabled: false,
    metaInitialized: false
  };
}

export function TrackingProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const { loaded, preferences, setTrackingPermissionStatus, setHasPromptedForTracking } = useAppPreferences();
  const [trackingState, setTrackingState] = useState<TrackingRuntimeState>(buildDefaultTrackingState);
  const requestInFlightRef = useRef<Promise<TrackingPermissionStatus> | null>(null);

  useEffect(() => {
    if (!loaded) return;

    const syncExistingPermission = async () => {
      const permissionStatus =
        Platform.OS === "web"
          ? "unavailable"
          : await trackingConsentService.getPermissionStatus();
      await setTrackingPermissionStatus(permissionStatus);
    };

    void syncExistingPermission();
  }, [loaded, setTrackingPermissionStatus]);

  useEffect(() => {
    if (!loaded) return;
    if (Platform.OS !== "ios") return;

    const subscription = RNAppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      void trackingConsentService.getPermissionStatus().then((nextStatus) => {
        void setTrackingPermissionStatus(nextStatus);
      });
    });

    return () => subscription.remove();
  }, [loaded, setTrackingPermissionStatus]);

  useEffect(() => {
    if (!loaded) return;

    const permissionStatus =
      Platform.OS === "web"
        ? "unavailable"
        : preferences.trackingPermissionStatus;
    const trackingAllowed =
      Platform.OS !== "web" && trackingConsentService.isTrackingAllowed(permissionStatus);
    const reason =
      Platform.OS === "ios"
        ? trackingAllowed
          ? "att_granted"
          : preferences.hasPromptedForTracking
            ? "att_not_granted"
            : "awaiting_att_prompt"
        : Platform.OS === "android"
          ? "android_enabled"
          : "web_disabled";

    void analyticsService
      .configureTracking({
        enabled: trackingAllowed,
        reason,
        permissionStatus
      })
      .then((next) => {
        setTrackingState({
          ...next,
          permissionStatus,
          trackingAllowed
        });
      });
  }, [loaded, preferences.hasPromptedForTracking, preferences.trackingPermissionStatus]);

  const requestPermission = async (source: "app_launch" | "post_onboarding" | "settings"): Promise<TrackingPermissionStatus> => {
    if (requestInFlightRef.current) {
      return requestInFlightRef.current;
    }

    requestInFlightRef.current = (async () => {
      if (Platform.OS !== "ios") {
        return "granted";
      }

      const nextStatus = await trackingConsentService.requestPermission();
      await setHasPromptedForTracking(true);
      await setTrackingPermissionStatus(nextStatus);

      if (__DEV__) {
        console.log("[tracking] att_request_completed", {
          source,
          status: nextStatus
        });
      }

      return nextStatus;
    })().finally(() => {
      requestInFlightRef.current = null;
    });

    return requestInFlightRef.current;
  };

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!loaded) return;
    if (status !== "authenticated") return;
    if (preferences.hasPromptedForTracking) return;
    if (preferences.trackingPermissionStatus !== "undetermined") return;

    void requestPermission("app_launch");
  }, [
    loaded,
    preferences.hasPromptedForTracking,
    preferences.trackingPermissionStatus,
    status
  ]);

  const value = useMemo<TrackingContextValue>(
    () => ({
      ...trackingState,
      requestPermission
    }),
    [trackingState]
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error("useTracking must be used inside TrackingProvider");
  }
  return context;
}
