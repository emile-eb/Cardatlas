export type NotificationPermissionStatus = "undetermined" | "granted" | "denied" | "unsupported";

export type NotificationCategory = "market_activity" | "collection_updates" | "reminders";

export type NotificationRoute =
  | { route: "scan_tab" }
  | { route: "result"; scanId: string }
  | { route: "collection_card"; collectionItemId: string }
  | { route: "chat"; cardId: string }
  | { route: "home" };

export type CardAtlasNotificationPayload = {
  type: "market_move" | "new_market" | "collection_new_market" | "scan_reminder";
  source?: "tracked_card_refresh" | "reminder_job" | "manual";
  cardId?: string;
  category?: NotificationCategory;
} & NotificationRoute;
