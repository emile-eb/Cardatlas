export const CARDATLAS_APP_VERSION = "1.0.0";

export const CARDATLAS_SUPPORT_EMAIL = "support@cardatlas.app";
export const CARDATLAS_SUPPORT_SUBJECT = "CardAtlas Support";

export const SETTINGS_LINKS = {
  helpCenterRoute: "/help-center",
  privacyRoute: "/legal/privacy",
  termsRoute: "/legal/terms"
} as const;

export const SETTINGS_COPY = {
  notificationsSubtitle: "Control collector alerts on this device and keep category preferences in sync.",
  notificationPermissionDeniedSubtitle: "Notifications are disabled at the device level. Re-enable them in system settings.",
  marketActivitySubtitle: "Meaningful market moves and notable live ask changes for cards you follow.",
  collectionUpdatesSubtitle: "New usable live market for cards already in your collection.",
  remindersSubtitle: "Occasional re-engagement reminders when you have been inactive for a while.",
  scanTipsSubtitle: "Show photo tips when opening the scanner.",
  collectorAiSubtitleEnabled: "Show Collector AI entry points across CardAtlas.",
  collectorAiSubtitleDisabled: "Requires CardAtlas Pro.",
  exportSubtitle: "Share your collection as a CSV export.",
  scanHistorySubtitle: "Review recent scans and reopen results.",
  clearLocalDataSubtitle: "Remove saved app data from this device and restart this CardAtlas session.",
  accountStatusSubtitle: "Active on this device.",
  restoreSubtitle: "Recover CardAtlas Pro purchases linked to this app store account."
} as const;
