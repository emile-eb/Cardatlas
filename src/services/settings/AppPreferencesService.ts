import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppPreferences = {
  notificationsEnabled: boolean;
  marketActivityEnabled: boolean;
  collectionUpdatesEnabled: boolean;
  remindersEnabled: boolean;
  notificationPermissionStatus: "undetermined" | "granted" | "denied" | "unsupported";
  hasPromptedForNotifications: boolean;
  pushTokenRegistered: boolean;
  scanTipsEnabled: boolean;
  collectorAiEnabled: boolean;
};

const STORAGE_KEY = "cardatlas:app-preferences:v1";

const DEFAULT_PREFERENCES: AppPreferences = {
  notificationsEnabled: true,
  marketActivityEnabled: true,
  collectionUpdatesEnabled: true,
  remindersEnabled: true,
  notificationPermissionStatus: "undetermined",
  hasPromptedForNotifications: false,
  pushTokenRegistered: false,
  scanTipsEnabled: true,
  collectorAiEnabled: true
};

function preferencesEqual(left: AppPreferences, right: AppPreferences) {
  return (
    left.notificationsEnabled === right.notificationsEnabled &&
    left.marketActivityEnabled === right.marketActivityEnabled &&
    left.collectionUpdatesEnabled === right.collectionUpdatesEnabled &&
    left.remindersEnabled === right.remindersEnabled &&
    left.notificationPermissionStatus === right.notificationPermissionStatus &&
    left.hasPromptedForNotifications === right.hasPromptedForNotifications &&
    left.pushTokenRegistered === right.pushTokenRegistered &&
    left.scanTipsEnabled === right.scanTipsEnabled &&
    left.collectorAiEnabled === right.collectorAiEnabled
  );
}

function sanitizePreferences(value: Partial<AppPreferences> | null | undefined): AppPreferences {
  return {
    notificationsEnabled:
      typeof value?.notificationsEnabled === "boolean"
        ? value.notificationsEnabled
        : DEFAULT_PREFERENCES.notificationsEnabled,
    marketActivityEnabled:
      typeof value?.marketActivityEnabled === "boolean"
        ? value.marketActivityEnabled
        : DEFAULT_PREFERENCES.marketActivityEnabled,
    collectionUpdatesEnabled:
      typeof value?.collectionUpdatesEnabled === "boolean"
        ? value.collectionUpdatesEnabled
        : DEFAULT_PREFERENCES.collectionUpdatesEnabled,
    remindersEnabled:
      typeof value?.remindersEnabled === "boolean"
        ? value.remindersEnabled
        : DEFAULT_PREFERENCES.remindersEnabled,
    notificationPermissionStatus:
      value?.notificationPermissionStatus === "granted" ||
      value?.notificationPermissionStatus === "denied" ||
      value?.notificationPermissionStatus === "unsupported" ||
      value?.notificationPermissionStatus === "undetermined"
        ? value.notificationPermissionStatus
        : DEFAULT_PREFERENCES.notificationPermissionStatus,
    hasPromptedForNotifications:
      typeof value?.hasPromptedForNotifications === "boolean"
        ? value.hasPromptedForNotifications
        : DEFAULT_PREFERENCES.hasPromptedForNotifications,
    pushTokenRegistered:
      typeof value?.pushTokenRegistered === "boolean"
        ? value.pushTokenRegistered
        : DEFAULT_PREFERENCES.pushTokenRegistered,
    scanTipsEnabled:
      typeof value?.scanTipsEnabled === "boolean"
        ? value.scanTipsEnabled
        : DEFAULT_PREFERENCES.scanTipsEnabled,
    collectorAiEnabled:
      typeof value?.collectorAiEnabled === "boolean"
        ? value.collectorAiEnabled
        : DEFAULT_PREFERENCES.collectorAiEnabled
  };
}

class AppPreferencesService {
  async load(): Promise<AppPreferences> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_PREFERENCES;
      return sanitizePreferences(JSON.parse(raw));
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  async save(next: AppPreferences): Promise<AppPreferences> {
    const sanitized = sanitizePreferences(next);
    const current = await this.load();
    if (preferencesEqual(current, sanitized)) {
      return current;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return sanitized;
  }

  async patch(partial: Partial<AppPreferences>): Promise<AppPreferences> {
    const current = await this.load();
    return this.save({
      ...current,
      ...sanitizePreferences({
        ...current,
        ...partial
      })
    });
  }
}

export const appPreferencesService = new AppPreferencesService();
export const defaultAppPreferences = DEFAULT_PREFERENCES;
