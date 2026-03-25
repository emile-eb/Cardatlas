import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  appPreferencesService,
  defaultAppPreferences,
  type AppPreferences
} from "@/services/settings/AppPreferencesService";

type AppPreferencesContextValue = {
  preferences: AppPreferences;
  loaded: boolean;
  setNotificationsEnabled: (next: boolean) => Promise<void>;
  setMarketActivityEnabled: (next: boolean) => Promise<void>;
  setCollectionUpdatesEnabled: (next: boolean) => Promise<void>;
  setRemindersEnabled: (next: boolean) => Promise<void>;
  setNotificationPermissionStatus: (next: AppPreferences["notificationPermissionStatus"]) => Promise<void>;
  setHasPromptedForNotifications: (next: boolean) => Promise<void>;
  setPushTokenRegistered: (next: boolean) => Promise<void>;
  setScanTipsEnabled: (next: boolean) => Promise<void>;
  setCollectorAiEnabled: (next: boolean) => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<AppPreferences>(defaultAppPreferences);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    appPreferencesService.load().then((next) => {
      if (!active) return;
      setPreferences(next);
      setLoaded(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const setNotificationsEnabled = useCallback(async (next: boolean) => {
    const updated = await appPreferencesService.patch({ notificationsEnabled: next });
    setPreferences(updated);
  }, []);

  const setMarketActivityEnabled = useCallback(async (next: boolean) => {
    const updated = await appPreferencesService.patch({ marketActivityEnabled: next });
    setPreferences(updated);
  }, []);

  const setCollectionUpdatesEnabled = useCallback(async (next: boolean) => {
    const updated = await appPreferencesService.patch({ collectionUpdatesEnabled: next });
    setPreferences(updated);
  }, []);

  const setRemindersEnabled = useCallback(async (next: boolean) => {
    const updated = await appPreferencesService.patch({ remindersEnabled: next });
    setPreferences(updated);
  }, []);

  const setNotificationPermissionStatus = useCallback(async (next: AppPreferences["notificationPermissionStatus"]) => {
    const updated = await appPreferencesService.patch({ notificationPermissionStatus: next });
    setPreferences(updated);
  }, []);

  const setHasPromptedForNotifications = useCallback(async (next: boolean) => {
    const updated = await appPreferencesService.patch({ hasPromptedForNotifications: next });
    setPreferences(updated);
  }, []);

  const setPushTokenRegistered = useCallback(async (next: boolean) => {
    const updated = await appPreferencesService.patch({ pushTokenRegistered: next });
    setPreferences(updated);
  }, []);

  const setScanTipsEnabled = useCallback(async (next: boolean) => {
    const updated = await appPreferencesService.patch({ scanTipsEnabled: next });
    setPreferences(updated);
  }, []);

  const setCollectorAiEnabled = useCallback(async (next: boolean) => {
    const updated = await appPreferencesService.patch({ collectorAiEnabled: next });
    setPreferences(updated);
  }, []);

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      preferences,
      loaded,
      setNotificationsEnabled,
      setMarketActivityEnabled,
      setCollectionUpdatesEnabled,
      setRemindersEnabled,
      setNotificationPermissionStatus,
      setHasPromptedForNotifications,
      setPushTokenRegistered,
      setScanTipsEnabled,
      setCollectorAiEnabled
    }),
    [
      preferences,
      loaded,
      setNotificationsEnabled,
      setMarketActivityEnabled,
      setCollectionUpdatesEnabled,
      setRemindersEnabled,
      setNotificationPermissionStatus,
      setHasPromptedForNotifications,
      setPushTokenRegistered,
      setScanTipsEnabled,
      setCollectorAiEnabled
    ]
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used inside AppPreferencesProvider");
  }
  return context;
}
