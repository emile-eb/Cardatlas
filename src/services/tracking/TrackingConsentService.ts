import { Platform } from "react-native";
import type { TrackingPermissionStatus } from "@/types";

type NativeTrackingPermissionStatus = "granted" | "denied" | "undetermined" | "unavailable" | "restricted";

type TrackingTransparencyModule = {
  getTrackingPermissionsAsync: () => Promise<{ status: NativeTrackingPermissionStatus }>;
  requestTrackingPermissionsAsync: () => Promise<{ status: NativeTrackingPermissionStatus }>;
};

function normalizeTrackingStatus(status: NativeTrackingPermissionStatus): TrackingPermissionStatus {
  if (status === "granted" || status === "denied" || status === "undetermined") {
    return status;
  }

  if (status === "unavailable") {
    return "unavailable";
  }

  return "restricted";
}

function logTracking(label: string, payload: Record<string, unknown>) {
  if (__DEV__) {
    console.log(`[tracking] ${label}`, payload);
  }
}

async function loadTrackingTransparencyModule(): Promise<TrackingTransparencyModule | null> {
  if (Platform.OS !== "ios") {
    return null;
  }

  try {
    const mod = await import("expo-tracking-transparency");
    return {
      getTrackingPermissionsAsync: mod.getTrackingPermissionsAsync,
      requestTrackingPermissionsAsync: mod.requestTrackingPermissionsAsync
    };
  } catch (error) {
    logTracking("att_module_unavailable", {
      platform: Platform.OS,
      error: error instanceof Error ? error.message : "unknown_error"
    });
    return null;
  }
}

export interface TrackingConsentService {
  getPermissionStatus(): Promise<TrackingPermissionStatus>;
  requestPermission(): Promise<TrackingPermissionStatus>;
  isTrackingAllowed(status: TrackingPermissionStatus): boolean;
}

class TrackingConsentServiceImpl implements TrackingConsentService {
  async getPermissionStatus(): Promise<TrackingPermissionStatus> {
    if (Platform.OS !== "ios") {
      return Platform.OS === "web" ? "unavailable" : "granted";
    }

    const trackingModule = await loadTrackingTransparencyModule();
    if (!trackingModule) {
      return "unavailable";
    }

    const response = await trackingModule.getTrackingPermissionsAsync();
    const status = normalizeTrackingStatus(response.status);
    logTracking("att_status", {
      source: "get",
      status
    });
    return status;
  }

  async requestPermission(): Promise<TrackingPermissionStatus> {
    if (Platform.OS !== "ios") {
      return Platform.OS === "web" ? "unavailable" : "granted";
    }

    const trackingModule = await loadTrackingTransparencyModule();
    if (!trackingModule) {
      return "unavailable";
    }

    const response = await trackingModule.requestTrackingPermissionsAsync();
    const status = normalizeTrackingStatus(response.status);
    logTracking("att_status", {
      source: "request",
      status
    });
    return status;
  }

  isTrackingAllowed(status: TrackingPermissionStatus): boolean {
    if (Platform.OS !== "ios") {
      return true;
    }
    return status === "granted";
  }
}

export const trackingConsentService: TrackingConsentService = new TrackingConsentServiceImpl();
