import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import { appConfig } from "@/lib/config";
import { getOrCreateNotificationDeviceId } from "@/services/notifications/storage";
import type { AppPreferences } from "@/services/settings/AppPreferencesService";
import type { CardAtlasNotificationPayload, NotificationPermissionStatus } from "@/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

type SyncNotificationDeviceInput = {
  preferences: AppPreferences;
  expoPushToken: string | null;
  permissionStatus: NotificationPermissionStatus;
};

function normalizePermissionStatus(status?: Notifications.PermissionStatus | null): NotificationPermissionStatus {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

function normalizePayload(data: Record<string, unknown> | undefined): CardAtlasNotificationPayload | null {
  if (!data?.type || typeof data.type !== "string" || !data.route || typeof data.route !== "string") {
    return null;
  }

  const source =
    data.source === "tracked_card_refresh" || data.source === "reminder_job" || data.source === "manual"
      ? data.source
      : undefined;

  const base: Pick<CardAtlasNotificationPayload, "type" | "source" | "cardId" | "category"> = {
    type: data.type as CardAtlasNotificationPayload["type"],
    source,
    cardId: typeof data.cardId === "string" ? data.cardId : undefined,
    category: typeof data.category === "string" ? (data.category as CardAtlasNotificationPayload["category"]) : undefined
  };

  switch (data.route) {
    case "scan_tab":
      return { ...base, route: "scan_tab" };
    case "result":
      return typeof data.scanId === "string" ? { ...base, route: "result", scanId: data.scanId } : null;
    case "collection_card":
      return typeof data.collectionItemId === "string"
        ? { ...base, route: "collection_card", collectionItemId: data.collectionItemId }
        : null;
    case "chat":
      return typeof data.cardId === "string" ? { ...base, route: "chat", cardId: data.cardId } : null;
    case "home":
      return { ...base, route: "home" };
    default:
      return null;
  }
}

class NotificationService {
  async ensureAndroidChannel(): Promise<void> {
    if (Platform.OS !== "android") return;

    await Notifications.setNotificationChannelAsync("cardatlas-default", {
      name: "CardAtlas Alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 150, 200],
      lightColor: "#B3261E"
    });
  }

  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    if (Platform.OS === "web") return "unsupported";
    const permissions = await Notifications.getPermissionsAsync();
    return normalizePermissionStatus(permissions.status);
  }

  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (Platform.OS === "web") return "unsupported";

    await this.ensureAndroidChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "granted") {
      return "granted";
    }

    const next = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false
      }
    });
    return normalizePermissionStatus(next.status);
  }

  async registerPushToken(): Promise<{ token: string | null; permissionStatus: NotificationPermissionStatus }> {
    if (Platform.OS === "web") {
      return { token: null, permissionStatus: "unsupported" };
    }

    await this.ensureAndroidChannel();
    const permissionStatus = await this.getPermissionStatus();
    if (permissionStatus !== "granted") {
      return { token: null, permissionStatus };
    }

    if (!Device.isDevice) {
      return { token: null, permissionStatus };
    }

    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      appConfig.expoProjectId;
    if (!projectId) {
      throw new Error("Missing Expo project id for push registration.");
    }

    const response = await Notifications.getExpoPushTokenAsync({ projectId });
    return {
      token: response.data ?? null,
      permissionStatus
    };
  }

  async syncDevice(input: SyncNotificationDeviceInput): Promise<{ pushTokenRegistered: boolean }> {
    const supabase = await getRequiredSupabaseClient();
    const deviceId = await getOrCreateNotificationDeviceId();
    const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "1.0.0";
    const deviceName = Device.deviceName ?? null;

    const { error } = await supabase.functions.invoke("register-push-token", {
      body: {
        deviceId,
        platform: Platform.OS,
        deviceName,
        appVersion,
        expoPushToken: input.expoPushToken,
        notificationsEnabled: input.preferences.notificationsEnabled && input.permissionStatus === "granted",
        marketActivityEnabled: input.preferences.notificationsEnabled && input.permissionStatus === "granted" && input.preferences.marketActivityEnabled,
        collectionUpdatesEnabled:
          input.preferences.notificationsEnabled &&
          input.permissionStatus === "granted" &&
          input.preferences.collectionUpdatesEnabled,
        remindersEnabled: input.preferences.notificationsEnabled && input.permissionStatus === "granted" && input.preferences.remindersEnabled,
        permissionStatus: input.permissionStatus
      }
    });

    if (error) {
      throw new Error(error.message ?? "Failed to sync notification device.");
    }

    return {
      pushTokenRegistered: Boolean(input.expoPushToken && input.permissionStatus === "granted")
    };
  }

  handleNotificationReceived(notification: Notifications.Notification) {
    if (__DEV__) {
      console.log("[notifications] received_foreground", notification.request.content.data);
    }
  }

  handleNotificationResponse(response: Notifications.NotificationResponse) {
    const payload = normalizePayload(response.notification.request.content.data as Record<string, unknown> | undefined);
    if (!payload) return;

    switch (payload.route) {
      case "scan_tab":
        router.push("/(tabs)/scan");
        break;
      case "result":
        router.push(`/results/${payload.scanId}`);
        break;
      case "collection_card":
        router.push(`/collection/view/${payload.collectionItemId}`);
        break;
      case "chat":
        router.push(`/chat/${payload.cardId}`);
        break;
      case "home":
      default:
        router.push("/(tabs)/home");
        break;
    }
  }

  async handleInitialNotificationResponse() {
    if (Platform.OS === "web") return;
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      this.handleNotificationResponse(response);
      const clearLastResponse = (Notifications as typeof Notifications & {
        clearLastNotificationResponseAsync?: () => Promise<void>;
      }).clearLastNotificationResponseAsync;
      if (typeof clearLastResponse === "function") {
        await clearLastResponse();
      }
    }
  }

  async openSystemSettings() {
    await Linking.openSettings();
  }
}

export const notificationService = new NotificationService();
