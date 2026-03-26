import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import { Platform } from "react-native";
import {
  FREE_SCAN_LIMIT,
  FREE_TRIAL_DAYS,
  remainingFreeScans
} from "@/services/subscriptions/gating";
import { revenueCatService } from "@/services/subscriptions/RevenueCatService";
import type {
  EntitlementState,
  FreeTrialState,
  MirroredSubscriptionState,
  PaywallViewModel,
  PurchaseResult,
  RestoreResult,
  RevenueCatCustomerSnapshot,
  RevenueCatOfferingModel,
  SubscriptionState,
  UsageState,
  UUID
} from "@/types";

function getWebPreviewPaywall(): PaywallViewModel {
  return {
    loading: false,
    unavailable: false,
    plans: [
      {
        productId: "pro_yearly",
        packageId: "$rc_annual",
        title: "Yearly",
        priceLabel: "$59.99",
        billingLabel: "Per year",
        billingPeriod: "yearly",
        trialLabel: "3-day free trial",
        hasTrial: true,
        isRecommended: true
      },
      {
        productId: "pro_monthly",
        packageId: "$rc_monthly",
        title: "Monthly",
        priceLabel: "$9.99",
        billingLabel: "Per month",
        billingPeriod: "monthly",
        trialLabel: "3-day free trial",
        hasTrial: true,
        isRecommended: false
      }
    ]
  };
}

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapSubscriptionState(row: any): SubscriptionState {
  const entitlementStatus = (row.entitlement_status ?? "inactive") as SubscriptionState["entitlementStatus"];
  return {
    entitlementStatus,
    trialEligible: row.trial_eligible ?? true,
    trialStartedAt: row.trial_started_at ?? null,
    trialExpiresAt: row.trial_expires_at ?? null,
    subscriptionProductId: row.subscription_product_id ?? null,
    subscriptionExpiresAt: row.subscription_expires_at ?? null,
    managementUrl: row.management_url ?? null,
    store: row.store ?? null,
    revenueCatCustomerId: row.revenuecat_customer_id ?? null,
    isPremium: entitlementStatus === "active"
  };
}

function mapEntitlementFromState(state: SubscriptionState): EntitlementState {
  return {
    isPremium: state.isPremium,
    source: state.isPremium
      ? state.trialExpiresAt && new Date(state.trialExpiresAt).getTime() > Date.now()
        ? "trial"
        : "subscription"
      : "none",
    expiresAt: state.subscriptionExpiresAt ?? state.trialExpiresAt,
    productId: state.subscriptionProductId ?? undefined
  };
}

function mapSnapshotToMirror(userId: UUID, snapshot: RevenueCatCustomerSnapshot): MirroredSubscriptionState {
  const trialStartedAt = snapshot.pro.originalPurchaseDate;
  const trialExpiresAt = snapshot.pro.expirationDate;
  return {
    userId,
    entitlementStatus: snapshot.pro.isActive ? "active" : "inactive",
    trialEligible: !snapshot.pro.isActive,
    trialStartedAt: trialStartedAt,
    trialExpiresAt,
    subscriptionProductId: snapshot.pro.productIdentifier,
    subscriptionExpiresAt: snapshot.pro.expirationDate,
    revenuecatCustomerId: snapshot.revenueCatCustomerId,
    originalAppUserId: snapshot.originalAppUserId,
    store: snapshot.pro.store,
    managementUrl: snapshot.pro.managementURL,
    rawCustomerInfo: snapshot.raw
  };
}

function mapOfferingToPaywall(offer: RevenueCatOfferingModel | null): PaywallViewModel {
  if (!offer) {
    return {
      loading: false,
      unavailable: true,
      plans: []
    };
  }

  const plans = offer.packages
    .filter((pkg) => pkg.billingPeriod !== "weekly")
    .map((pkg) => {
    const billingLabel =
      pkg.billingPeriod === "weekly"
        ? "Per week"
        : pkg.billingPeriod === "monthly"
          ? "Per month"
          : pkg.billingPeriod === "yearly"
            ? "Per year"
            : "Subscription";

    return {
      productId: pkg.productId,
      packageId: pkg.packageId,
      title: pkg.title,
      priceLabel: pkg.priceString,
      billingLabel,
      billingPeriod: pkg.billingPeriod,
      trialLabel: pkg.trialDescription ?? null,
      hasTrial: Boolean(pkg.trialDescription),
      isRecommended: Boolean(pkg.isRecommended)
    };
    });

  return {
    loading: false,
    unavailable: plans.length === 0,
    plans
  };
}

export interface SubscriptionsService {
  initializeBilling(appUserId: UUID): Promise<void>;
  refreshBillingState(userId: UUID): Promise<EntitlementState>;
  loadPaywall(userId: UUID): Promise<PaywallViewModel>;
  purchasePackage(userId: UUID, packageId: string): Promise<PurchaseResult>;
  restorePurchases(userId: UUID): Promise<RestoreResult>;
  getState(userId: UUID): Promise<SubscriptionState>;
  getEntitlements(userId: UUID): Promise<EntitlementState>;
  refreshEntitlements(userId: UUID): Promise<EntitlementState>;
  startTrialEligibilityCheck(userId: UUID): Promise<FreeTrialState>;
  getUsageState(userId: UUID): Promise<UsageState>;
  incrementFreeScansUsed(userId: UUID, amount?: number): Promise<UsageState>;
  buildUsageState(scansUsed: number, scanLimit?: number): UsageState;
  getManagementUrl(userId: UUID): Promise<string | null>;
}

class SubscriptionsServiceImpl implements SubscriptionsService {
  async initializeBilling(appUserId: UUID): Promise<void> {
    if (Platform.OS === "web") return;
    await revenueCatService.configure(appUserId);
  }

  private async syncSnapshot(userId: UUID, snapshot: RevenueCatCustomerSnapshot): Promise<void> {
    const supabase = await getRequiredSupabaseClient();
    const mirror = mapSnapshotToMirror(userId, snapshot);

    const { error } = await supabase.from("subscriptions").upsert(
      {
        user_id: mirror.userId,
        revenuecat_customer_id: mirror.revenuecatCustomerId,
        entitlement_status: mirror.entitlementStatus,
        trial_eligible: mirror.trialEligible,
        trial_started_at: mirror.trialStartedAt,
        trial_expires_at: mirror.trialExpiresAt,
        subscription_product_id: mirror.subscriptionProductId,
        subscription_expires_at: mirror.subscriptionExpiresAt,
        original_app_user_id: mirror.originalAppUserId,
        store: mirror.store,
        management_url: mirror.managementUrl,
        raw_customer_info: mirror.rawCustomerInfo
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;
  }

  async refreshBillingState(userId: UUID): Promise<EntitlementState> {
    if (Platform.OS !== "web") {
      await revenueCatService.configure(userId);
      const snapshot = await revenueCatService.getCustomerSnapshot();
      if (snapshot) {
        await this.syncSnapshot(userId, snapshot);
      }
    }
    return this.getEntitlements(userId);
  }

  async loadPaywall(userId: UUID): Promise<PaywallViewModel> {
    if (Platform.OS === "web") {
      return getWebPreviewPaywall();
    }

    await revenueCatService.configure(userId);
    const offering = await revenueCatService.getOfferings();
    return mapOfferingToPaywall(offering);
  }

  async purchasePackage(userId: UUID, packageId: string): Promise<PurchaseResult> {
    await this.initializeBilling(userId);
    const result = await revenueCatService.purchasePackage(packageId);

    if (result.status === "success") {
      await this.syncSnapshot(userId, result.snapshot);
    }

    return result;
  }

  async restorePurchases(userId: UUID): Promise<RestoreResult> {
    await this.initializeBilling(userId);
    const result = await revenueCatService.restorePurchases();

    if (result.status === "restored") {
      await this.syncSnapshot(userId, result.snapshot);
    }

    return result;
  }

  async getState(userId: UUID): Promise<SubscriptionState> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .select(
        "entitlement_status,trial_eligible,trial_started_at,trial_expires_at,subscription_product_id,subscription_expires_at,management_url,store,revenuecat_customer_id"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return mapSubscriptionState({});
    }

    return mapSubscriptionState(data);
  }

  async getEntitlements(userId: UUID): Promise<EntitlementState> {
    const state = await this.getState(userId);
    return mapEntitlementFromState(state);
  }

  async refreshEntitlements(userId: UUID): Promise<EntitlementState> {
    return this.refreshBillingState(userId);
  }

  async startTrialEligibilityCheck(userId: UUID): Promise<FreeTrialState> {
    const state = await this.getState(userId);

    const hasStarted = Boolean(state.trialStartedAt || state.trialExpiresAt);
    return {
      isEligible: Boolean(state.trialEligible),
      hasStarted,
      durationDays: FREE_TRIAL_DAYS,
      startedAt: state.trialStartedAt ?? undefined,
      endsAt: state.trialExpiresAt ?? undefined
    };
  }

  async getUsageState(userId: UUID): Promise<UsageState> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("usage_state")
      .select("free_scan_limit, free_scans_used, ai_messages_used")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return this.buildUsageState(0);
    }

    return this.buildUsageState(data.free_scans_used, data.free_scan_limit);
  }

  async incrementFreeScansUsed(userId: UUID, amount = 1): Promise<UsageState> {
    const entitlement = await this.getEntitlements(userId);
    if (entitlement.isPremium) {
      return this.getUsageState(userId);
    }

    const supabase = await getRequiredSupabaseClient();
    const { data: current, error: currentError } = await supabase
      .from("usage_state")
      .select("free_scan_limit, free_scans_used")
      .eq("user_id", userId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) {
      const initialState = this.buildUsageState(amount);
      const { error: insertError } = await supabase.from("usage_state").insert({
        user_id: userId,
        free_scan_limit: initialState.scanLimit,
        free_scans_used: initialState.scansUsed
      });
      if (insertError) throw insertError;
      return initialState;
    }

    const nextUsed = Math.max(0, (current.free_scans_used ?? 0) + amount);

    const { data: updated, error: updateError } = await supabase
      .from("usage_state")
      .update({ free_scans_used: nextUsed })
      .eq("user_id", userId)
      .select("free_scan_limit, free_scans_used")
      .single();

    if (updateError) throw updateError;

    return this.buildUsageState(updated.free_scans_used, updated.free_scan_limit);
  }

  buildUsageState(scansUsed: number, scanLimit = FREE_SCAN_LIMIT): UsageState {
    return {
      scanLimit,
      scansUsed,
      scansRemaining: remainingFreeScans(scansUsed, scanLimit)
    };
  }

  async getManagementUrl(userId: UUID): Promise<string | null> {
    const state = await this.getState(userId);
    return state.managementUrl ?? null;
  }
}

export const subscriptionsService: SubscriptionsService = new SubscriptionsServiceImpl();
