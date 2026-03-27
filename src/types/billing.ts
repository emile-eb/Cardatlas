import type { ISODateString, UUID } from "@/types/db";

export type BillingPeriod = "weekly" | "monthly" | "yearly" | "unknown";

export interface RevenueCatPackageModel {
  packageId: string;
  identifier: string;
  productId: string;
  title: string;
  priceString: string;
  billingPeriod: BillingPeriod;
  trialDescription?: string | null;
  isRecommended?: boolean;
}

export interface RevenueCatOfferingModel {
  offeringId: string;
  serverDescription: string | null;
  packages: RevenueCatPackageModel[];
}

export interface RevenueCatEntitlementSnapshot {
  entitlementId: "pro";
  isActive: boolean;
  willRenew: boolean;
  periodType: "normal" | "trial" | "intro" | "unknown";
  productIdentifier: string | null;
  latestPurchaseDate: ISODateString | null;
  originalPurchaseDate: ISODateString | null;
  expirationDate: ISODateString | null;
  store: string | null;
  managementURL: string | null;
}

export interface RevenueCatCustomerSnapshot {
  appUserId: string;
  originalAppUserId: string | null;
  revenueCatCustomerId: string | null;
  activeEntitlements: string[];
  pro: RevenueCatEntitlementSnapshot;
  raw: Record<string, unknown>;
}

export interface MirroredSubscriptionState {
  userId: UUID;
  entitlementStatus: "active" | "inactive";
  trialEligible: boolean;
  trialStartedAt: ISODateString | null;
  trialExpiresAt: ISODateString | null;
  subscriptionProductId: string | null;
  subscriptionExpiresAt: ISODateString | null;
  revenuecatCustomerId: string | null;
  originalAppUserId: string | null;
  store: string | null;
  managementUrl: string | null;
  rawCustomerInfo: Record<string, unknown>;
}

export interface PaywallPlanViewModel {
  productId: string;
  packageId: string;
  title: string;
  priceLabel: string;
  billingLabel: string;
  billingPeriod?: BillingPeriod;
  trialLabel?: string | null;
  hasTrial?: boolean;
  isRecommended: boolean;
}

export interface PaywallViewModel {
  loading: boolean;
  unavailable: boolean;
  plans: PaywallPlanViewModel[];
  diagnostics?: {
    hasCurrentOffering: boolean;
    offeringId: string | null;
    serverDescription: string | null;
    rawPackageCount: number;
    rawPackageIds: string[];
    rawProductIds: string[];
    filteredPackageCount: number;
    loadErrorMessage?: string | null;
  };
}

export type PurchaseResult =
  | { status: "success"; snapshot: RevenueCatCustomerSnapshot }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

export type RestoreResult =
  | { status: "restored"; snapshot: RevenueCatCustomerSnapshot }
  | { status: "no_purchases" }
  | { status: "failed"; message: string };
