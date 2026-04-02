export type TrackingPermissionStatus = "undetermined" | "granted" | "denied" | "restricted" | "unavailable";

export type TrackingRuntimeState = {
  permissionStatus: TrackingPermissionStatus;
  trackingAllowed: boolean;
  metaTrackingEnabled: boolean;
  metaInitialized: boolean;
};
