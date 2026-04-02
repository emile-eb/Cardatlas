import { Platform } from "react-native";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
  type PermissionResponse
} from "expo-tracking-transparency";
import type { TrackingPermissionStatus } from "@/types";

function normalizeTrackingStatus(status: PermissionResponse["status"]): TrackingPermissionStatus {
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

export interface TrackingConsentService {
  getPermissionStatus(): Promise<TrackingPermissionStatus>;
  requestPermission(): Promise<TrackingPermissionStatus>;
  isTrackingAllowed(status: TrackingPermissionStatus): boolean;
}

class TrackingConsentServiceImpl implements TrackingConsentService {
  async getPermissionStatus(): Promise<TrackingPermissionStatus> {
    if (Platform.OS !== "ios") {
      return "granted";
    }

    const response = await getTrackingPermissionsAsync();
    const status = normalizeTrackingStatus(response.status);
    logTracking("att_status", {
      source: "get",
      status
    });
    return status;
  }

  async requestPermission(): Promise<TrackingPermissionStatus> {
    if (Platform.OS !== "ios") {
      return "granted";
    }

    const response = await requestTrackingPermissionsAsync();
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
