import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState as RNAppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/features/auth";
import { useAppPreferences } from "@/features/settings/AppPreferencesProvider";
import { notificationService } from "@/services/notifications/NotificationService";
import type { NotificationPermissionStatus } from "@/types";

type NotificationsContextValue = {
  permissionStatus: NotificationPermissionStatus;
  pushSupported: boolean;
  requestPermissionInContext: (source: "onboarding" | "settings") => Promise<NotificationPermissionStatus>;
  syncNotifications: () => Promise<void>;
  openSystemSettings: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { session, status } = useAuth();
  const {
    preferences,
    loaded,
    setNotificationsEnabled,
    setNotificationPermissionStatus,
    setHasPromptedForNotifications,
    setPushTokenRegistered
  } = useAppPreferences();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>("undetermined");
  const hasHandledInitialResponseRef = useRef(false);
  const syncInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!loaded) return;
    setPermissionStatus(preferences.notificationPermissionStatus);
  }, [loaded, preferences.notificationPermissionStatus]);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (preferences.notificationPermissionStatus !== "unsupported") {
        void setNotificationPermissionStatus("unsupported");
      }
      if (permissionStatus !== "unsupported") {
        setPermissionStatus("unsupported");
      }
      return;
    }

    let active = true;
    void notificationService.getPermissionStatus().then((next) => {
      if (!active) return;
      if (permissionStatus !== next) {
        setPermissionStatus(next);
      }
      if (preferences.notificationPermissionStatus !== next) {
        void setNotificationPermissionStatus(next);
      }
    });
    return () => {
      active = false;
    };
  }, [permissionStatus, preferences.notificationPermissionStatus, setNotificationPermissionStatus]);

  const syncNotifications = async () => {
    if (Platform.OS === "web") return;
    if (!loaded || status !== "authenticated" || !session?.appUserId) return;
    if (syncInFlightRef.current) return syncInFlightRef.current;

    syncInFlightRef.current = (async () => {
      const currentPermissionStatus = await notificationService.getPermissionStatus();
      setPermissionStatus(currentPermissionStatus);
      await setNotificationPermissionStatus(currentPermissionStatus);

      if (currentPermissionStatus !== "granted" || !preferences.notificationsEnabled) {
        await notificationService.syncDevice({
          preferences,
          expoPushToken: null,
          permissionStatus: currentPermissionStatus
        });
        await setPushTokenRegistered(false);
        return;
      }

      const registration = await notificationService.registerPushToken();
      await notificationService.syncDevice({
        preferences,
        expoPushToken: registration.token,
        permissionStatus: registration.permissionStatus
      });
      await setPushTokenRegistered(Boolean(registration.token && registration.permissionStatus === "granted"));
    })()
      .finally(() => {
        syncInFlightRef.current = null;
      });

    return syncInFlightRef.current;
  };

  const requestPermissionInContext = async (source: "onboarding" | "settings") => {
    const nextStatus = await notificationService.requestPermission();
    setPermissionStatus(nextStatus);
    await setHasPromptedForNotifications(true);
    await setNotificationPermissionStatus(nextStatus);

    if (nextStatus === "granted") {
      await setNotificationsEnabled(true);
      await syncNotifications();
      return nextStatus;
    }

    if (source === "onboarding") {
      await setNotificationsEnabled(false);
      await setPushTokenRegistered(false);
    }

    return nextStatus;
  };

  useEffect(() => {
    if (!loaded || status !== "authenticated" || !session?.appUserId) return;
    void syncNotifications();
  }, [
    loaded,
    preferences.notificationsEnabled,
    preferences.marketActivityEnabled,
    preferences.collectionUpdatesEnabled,
    preferences.remindersEnabled,
    session?.appUserId,
    status
  ]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let receivedSubscription: { remove: () => void } | null = null;
    let responseSubscription: { remove: () => void } | null = null;

    receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      notificationService.handleNotificationReceived(notification);
    });
    responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      notificationService.handleNotificationResponse(response);
    });

    if (!hasHandledInitialResponseRef.current) {
      hasHandledInitialResponseRef.current = true;
      void notificationService.handleInitialNotificationResponse();
    }

    return () => {
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = RNAppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && loaded && status === "authenticated" && session?.appUserId) {
        void syncNotifications();
      }
    });
    return () => subscription.remove();
  }, [loaded, session?.appUserId, status]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      permissionStatus,
      pushSupported: Platform.OS !== "web",
      requestPermissionInContext,
      syncNotifications,
      openSystemSettings: () => notificationService.openSystemSettings()
    }),
    [permissionStatus]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used inside NotificationsProvider");
  }
  return context;
}
