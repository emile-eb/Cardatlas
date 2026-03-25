export type UUID = string;
export type ISODateString = string;

export type SubscriptionPlan = "free" | "pro";
export type SubscriptionStatus = "inactive" | "trialing" | "active" | "past_due" | "canceled";
export type NotificationPreference = "all" | "important_only" | "none";

export interface UsersRow {
  id: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
  auth_user_id: UUID;
  display_name: string | null;
  favorite_team: string | null;
  preferred_sport: string | null;
  is_onboarding_complete: boolean;
  default_currency: string;
  notifications_enabled: boolean;
}

export interface UsageStateRow {
  id: UUID;
  user_id: UUID;
  free_scan_limit: number;
  free_scans_used: number;
  ai_messages_used?: number;
  updated_at: ISODateString;
}

export interface UserDevicesRow {
  id: UUID;
  user_id: UUID;
  device_id: string | null;
  platform: "ios" | "android" | "web";
  device_name: string | null;
  app_version: string | null;
  expo_push_token: string | null;
  notifications_enabled: boolean;
  market_activity_enabled: boolean;
  collection_updates_enabled: boolean;
  reminders_enabled: boolean;
  permission_status: "undetermined" | "granted" | "denied" | "unsupported" | string;
  push_token_status: "active" | "invalid" | "missing" | string;
  push_token_registered_at: ISODateString | null;
  last_error_text: string | null;
  last_seen_at: ISODateString;
  created_at: ISODateString;
  updated_at?: ISODateString | null;
}

export interface NotificationEventsRow {
  id: UUID;
  user_id: UUID;
  card_id: UUID | null;
  notification_type: string;
  dedupe_key: string;
  payload_json: Record<string, unknown> | null;
  status: "queued" | "sent" | "failed" | "skipped" | string;
  sent_at: ISODateString | null;
  created_at: ISODateString;
  updated_at?: ISODateString | null;
}

export interface OnboardingAnswersRow {
  id: UUID;
  user_id: UUID;
  collector_type: string;
  sports: string[];
  goals: string[];
  collection_size: string;
  card_types: string[];
  brands: string[];
  alerts_preference: string;
  completed_at: ISODateString;
  updated_at: ISODateString;
}

export interface ScansRow {
  id: UUID;
  user_id: UUID;
  front_image_path: string | null;
  back_image_path: string | null;
  status: "pending_upload" | "uploaded" | "processing" | "completed" | "failed" | "needs_review";
  card_id: UUID | null;
  valuation_snapshot_id: UUID | null;
  processing_started_at: ISODateString | null;
  processing_finished_at: ISODateString | null;
  completed_at: ISODateString | null;
  identified_payload: unknown | null;
  confidence_label: "high" | "medium" | "low" | null;
  review_reason: string | null;
  was_corrected?: boolean | null;
  correction_source?: "manual_edit" | "manual_search" | "likely_match" | "report_only" | string | null;
  correction_reason?: string | null;
  corrected_card_id?: UUID | null;
  suggested_matches?: unknown | null;
  reported_incorrect?: boolean | null;
  reported_reason?: string | null;
  error_message: string | null;
  scanned_at: ISODateString;
}

export interface CardsRow {
  id: UUID;
  created_at: ISODateString;
  updated_at: ISODateString;
  sport: string | null;
  player_name: string;
  card_title: string;
  year: number | null;
  brand: string | null;
  set_name: string | null;
  card_number: string | null;
  team: string | null;
  position: string | null;
  rarity_level?: 1 | 2 | 3 | 4 | 5 | null;
  rarity_label: "Common" | "Notable" | "Rare" | "Elite" | "Grail" | string | null;
  era: string | null;
  description: string | null;
  player_info: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  canonical_front_image_path: string | null;
  canonical_back_image_path: string | null;
}

export interface ValuationSnapshotsRow {
  id: UUID;
  card_id: UUID | null;
  source_scan_id?: UUID | null;
  reference_value: number;
  value_low: number | null;
  value_high: number | null;
  source: string | null;
  condition_basis: string | null;
  fetched_at: ISODateString;
  currency: string | null;
  source_confidence: number | null;
  metadata: Record<string, unknown> | null;
  created_at: ISODateString | null;
}

export interface CollectionItemsRow {
  id: UUID;
  user_id: UUID;
  card_id: UUID;
  source_scan_id: UUID | null;
  latest_valuation_snapshot_id: UUID | null;
  acquired_at: ISODateString | null;
  notes: string | null;
  is_favorite: boolean;
  is_autograph?: boolean;
  is_memorabilia?: boolean;
  is_parallel?: boolean;
  parallel_name?: string | null;
  serial_number?: string | null;
  is_graded?: boolean;
  grading_company?: string | null;
  grade?: string | null;
  attributes_updated_at?: ISODateString | null;
  adjusted_value?: number | null;
  valuation_source?: string | null;
  valuation_updated_at?: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface SubscriptionsRow {
  id: UUID;
  user_id: UUID;
  revenuecat_customer_id: string | null;
  entitlement_status: "active" | "inactive" | null;
  trial_eligible: boolean | null;
  trial_started_at: ISODateString | null;
  trial_expires_at: ISODateString | null;
  subscription_product_id: string | null;
  subscription_expires_at: ISODateString | null;
  original_app_user_id: string | null;
  store: string | null;
  management_url: string | null;
  raw_customer_info: Record<string, unknown> | null;
  // Legacy compatibility fields if still present.
  plan?: SubscriptionPlan | null;
  status?: SubscriptionStatus | null;
  entitlement_id?: string | null;
  trial_ends_at?: ISODateString | null;
  current_period_ends_at?: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface AIChatThreadsRow {
  id: UUID;
  user_id: UUID;
  card_id: UUID | null;
  title: string | null;
  thread_type: "general" | "card";
  last_message_at: ISODateString | null;
  archived: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface AIChatMessagesRow {
  id: UUID;
  thread_id: UUID;
  role: "system" | "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  model: string | null;
  error_state: string | null;
  created_at: ISODateString;
}

export interface CardSalesRow {
  id: UUID;
  card_id: UUID;
  source: string;
  source_listing_id: string | null;
  title: string | null;
  price: number;
  currency: string;
  sale_date: ISODateString;
  condition: string | null;
  grade: string | null;
  url: string | null;
  raw_payload: Record<string, unknown> | null;
  normalized_confidence: "high" | "medium" | "low" | string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface CardGradingScenariosRow {
  id: UUID;
  card_id: UUID;
  grading_company: string;
  assumed_grade: string;
  estimated_value: number;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface CardPriceHistorySnapshotsRow {
  id: UUID;
  card_id: UUID;
  snapshot_date: ISODateString;
  reference_value: number | null;
  raw_avg_ask: number | null;
  psa9_avg_ask: number | null;
  psa10_avg_ask: number | null;
  listing_count_raw: number | null;
  listing_count_psa9: number | null;
  listing_count_psa10: number | null;
  created_at?: ISODateString | null;
  updated_at?: ISODateString | null;
}

export interface MarketPulseItemsRow {
  id: UUID;
  source: string;
  source_listing_id: string | null;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  item_web_url: string | null;
  price: number | null;
  currency: string;
  item_origin_date: ISODateString | null;
  buying_options: Record<string, unknown> | null;
  marketplace_id: string | null;
  card_id: UUID | null;
  sport: string | null;
  player_name: string | null;
  team: string | null;
  pulse_reason: string | null;
  is_mock: boolean;
  sort_order: number | null;
  raw_payload: Record<string, unknown> | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
