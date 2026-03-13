import type {
  AIChatMessagesRow,
  AIChatThreadsRow,
  CardsRow,
  CollectionItemsRow,
  OnboardingAnswersRow,
  ScansRow,
  SubscriptionsRow,
  UserDevicesRow,
  UsersRow,
  ValuationSnapshotsRow,
  UUID
} from "@/types/db";
import type { EntitlementState, FreeTrialState, UsageState } from "@/types/premium";
import type { ValuationModel } from "@/types/valuation";

export interface UserProfile {
  id: UsersRow["id"];
  authUserId: UsersRow["auth_user_id"];
  displayName: UsersRow["display_name"];
  favoriteTeam: UsersRow["favorite_team"];
  preferredSport: UsersRow["preferred_sport"];
  onboardingComplete: UsersRow["is_onboarding_complete"];
  notificationsEnabled: UsersRow["notifications_enabled"];
  createdAt: UsersRow["created_at"];
  updatedAt: UsersRow["updated_at"];
}

export interface UserDevice {
  id: UserDevicesRow["id"];
  userId: UserDevicesRow["user_id"];
  platform: UserDevicesRow["platform"];
  deviceName: UserDevicesRow["device_name"];
  appVersion: UserDevicesRow["app_version"];
  expoPushToken: UserDevicesRow["expo_push_token"];
  lastSeenAt: UserDevicesRow["last_seen_at"];
}

export interface OnboardingAnswers {
  collectorType: OnboardingAnswersRow["collector_type"];
  sports: OnboardingAnswersRow["sports"];
  goals: OnboardingAnswersRow["goals"];
  collectionSize: OnboardingAnswersRow["collection_size"];
  cardTypes: OnboardingAnswersRow["card_types"];
  brands: OnboardingAnswersRow["brands"];
  alertsPreference: OnboardingAnswersRow["alerts_preference"];
  completedAt?: OnboardingAnswersRow["completed_at"];
}

export interface SubscriptionState {
  entitlementStatus: SubscriptionsRow["entitlement_status"];
  trialEligible: SubscriptionsRow["trial_eligible"];
  trialStartedAt: SubscriptionsRow["trial_started_at"];
  trialExpiresAt: SubscriptionsRow["trial_expires_at"];
  subscriptionProductId: SubscriptionsRow["subscription_product_id"];
  subscriptionExpiresAt: SubscriptionsRow["subscription_expires_at"];
  managementUrl: SubscriptionsRow["management_url"];
  store: SubscriptionsRow["store"];
  revenueCatCustomerId: SubscriptionsRow["revenuecat_customer_id"];
  isPremium: boolean;
}

export interface Card {
  id: CardsRow["id"];
  sport: CardsRow["sport"];
  playerName: CardsRow["player_name"];
  cardTitle: CardsRow["card_title"];
  year: CardsRow["year"];
  brand: CardsRow["brand"];
  set: CardsRow["set_name"];
  cardNumber: CardsRow["card_number"];
  team: CardsRow["team"];
  position: CardsRow["position"];
  rarityLevel?: CardsRow["rarity_level"];
  rarityLabel: CardsRow["rarity_label"];
  era: CardsRow["era"];
  description: CardsRow["description"];
  playerInfo: CardsRow["player_info"];
  metadata: CardsRow["metadata"];
  imageFront?: CardsRow["canonical_front_image_path"];
  imageBack?: CardsRow["canonical_back_image_path"];
}

export interface ValuationSnapshot {
  id: ValuationSnapshotsRow["id"];
  cardId: ValuationSnapshotsRow["card_id"];
  sourceScanId?: ValuationSnapshotsRow["source_scan_id"];
  referenceValue: ValuationSnapshotsRow["reference_value"];
  lowEstimate?: ValuationSnapshotsRow["value_low"];
  highEstimate?: ValuationSnapshotsRow["value_high"];
  condition: ValuationSnapshotsRow["condition_basis"];
  sourceConfidence: ValuationSnapshotsRow["source_confidence"];
  currency: ValuationSnapshotsRow["currency"];
  source: ValuationSnapshotsRow["source"];
  metadata: ValuationSnapshotsRow["metadata"];
  createdAt: ValuationSnapshotsRow["created_at"];
}

export interface Scan {
  id: ScansRow["id"];
  userId: ScansRow["user_id"];
  status: ScansRow["status"];
  cardId: ScansRow["card_id"];
  valuationSnapshotId: ScansRow["valuation_snapshot_id"];
  frontImagePath: ScansRow["front_image_path"];
  backImagePath: ScansRow["back_image_path"];
  processingStartedAt: ScansRow["processing_started_at"];
  processingFinishedAt: ScansRow["processing_finished_at"];
  completedAt: ScansRow["completed_at"];
  identifiedPayload: ScansRow["identified_payload"];
  confidenceLabel: ScansRow["confidence_label"];
  reviewReason: ScansRow["review_reason"];
  wasCorrected?: ScansRow["was_corrected"];
  correctionSource?: ScansRow["correction_source"];
  correctionReason?: ScansRow["correction_reason"];
  correctedCardId?: ScansRow["corrected_card_id"];
  suggestedMatches?: ScansRow["suggested_matches"];
  reportedIncorrect?: ScansRow["reported_incorrect"];
  reportedReason?: ScansRow["reported_reason"];
  errorMessage: ScansRow["error_message"];
  scannedAt: ScansRow["scanned_at"];
}

export interface CollectionItem {
  id: CollectionItemsRow["id"];
  userId: CollectionItemsRow["user_id"];
  cardId: CollectionItemsRow["card_id"];
  sourceScanId: CollectionItemsRow["source_scan_id"];
  latestValuationSnapshotId: CollectionItemsRow["latest_valuation_snapshot_id"];
  acquiredAt: CollectionItemsRow["acquired_at"];
  notes: CollectionItemsRow["notes"];
  isFavorite?: CollectionItemsRow["is_favorite"];
  isAutograph?: CollectionItemsRow["is_autograph"];
  isMemorabilia?: CollectionItemsRow["is_memorabilia"];
  isParallel?: CollectionItemsRow["is_parallel"];
  parallelName?: CollectionItemsRow["parallel_name"];
  serialNumber?: CollectionItemsRow["serial_number"];
  isGraded?: CollectionItemsRow["is_graded"];
  gradingCompany?: CollectionItemsRow["grading_company"];
  grade?: CollectionItemsRow["grade"];
  attributesUpdatedAt?: CollectionItemsRow["attributes_updated_at"];
  adjustedValue?: CollectionItemsRow["adjusted_value"];
  valuationSource?: CollectionItemsRow["valuation_source"];
  valuationUpdatedAt?: CollectionItemsRow["valuation_updated_at"];
  createdAt: CollectionItemsRow["created_at"];
  updatedAt: CollectionItemsRow["updated_at"];
}

export interface AIChatThread {
  id: AIChatThreadsRow["id"];
  userId: AIChatThreadsRow["user_id"];
  cardId: AIChatThreadsRow["card_id"];
  title: AIChatThreadsRow["title"];
  threadType: AIChatThreadsRow["thread_type"];
  lastMessageAt: AIChatThreadsRow["last_message_at"];
  archived: AIChatThreadsRow["archived"];
  createdAt: AIChatThreadsRow["created_at"];
  updatedAt: AIChatThreadsRow["updated_at"];
}

export interface AIChatMessage {
  id: AIChatMessagesRow["id"];
  threadId: AIChatMessagesRow["thread_id"];
  role: AIChatMessagesRow["role"];
  content: AIChatMessagesRow["content"];
  metadata: AIChatMessagesRow["metadata"];
  model: AIChatMessagesRow["model"];
  errorState: AIChatMessagesRow["error_state"];
  createdAt: AIChatMessagesRow["created_at"];
}

export interface HomeDashboardResponse {
  userId: UUID;
  portfolioValue: number;
  cardCount: number;
  teamCount: number;
  usage: UsageState;
  entitlement: EntitlementState;
  freeTrial: FreeTrialState;
  scansRemaining: number;
  canUseAI: boolean;
  subscription: SubscriptionState;
  recentScans: Scan[];
  latestValuation?: ValuationModel;
  personalization?: {
    favoriteTeam?: string | null;
    collectorType?: string | null;
  };
  collectionHighlights: Array<{
    collectionItemId: UUID;
    isFavorite?: boolean;
    notes?: string | null;
    addedAt?: string;
    isAutograph?: boolean;
    isMemorabilia?: boolean;
    isParallel?: boolean;
    parallelName?: string | null;
    serialNumber?: string | null;
    isGraded?: boolean;
    gradingCompany?: string | null;
    grade?: string | null;
    attributesUpdatedAt?: string | null;
    adjustedValue?: number | null;
    valuationSource?: string | null;
    valuationUpdatedAt?: string | null;
    card: Card;
    latestValue: number;
    baseValue?: number;
  }>;
}
