import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import type {
  PurchaseResult,
  RestoreResult,
  RevenueCatCustomerSnapshot,
  RevenueCatOfferingModel,
  RevenueCatPackageModel
} from "@/types";

const REVENUECAT_ENTITLEMENT_ID = "pro";

function getNativePurchasesModule(): any | null {
  if (Platform.OS === "web") return null;
  return Purchases;
}

function getNativePurchasesModuleOrThrow() {
  const purchases = getNativePurchasesModule();
  if (!purchases) {
    throw new Error(
      "react-native-purchases native module is unavailable on this build. Regenerate iOS with `npx expo prebuild --platform ios --clean`, run `pod install`, and rebuild from the Xcode workspace."
    );
  }
  return purchases;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const text = String(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function mapPeriod(productId: string): RevenueCatPackageModel["billingPeriod"] {
  const id = productId.toLowerCase();
  if (id.includes("week")) return "weekly";
  if (id.includes("month")) return "monthly";
  if (id.includes("year") || id.includes("annual")) return "yearly";
  return "unknown";
}

function mapPackage(rcPackage: any): RevenueCatPackageModel {
  const product = rcPackage?.product ?? {};
  const identifier = String(rcPackage?.identifier ?? "");
  const productId = String(product.identifier ?? "");
  const period = mapPeriod(productId || identifier);
  const title =
    period === "weekly"
      ? "Weekly"
      : period === "monthly"
        ? "Monthly"
        : period === "yearly"
          ? "Yearly"
          : product.title || identifier || "Plan";

  const intro = product?.introPrice;
  const trialDescription = intro?.periodNumberOfUnits
    ? `${intro.periodNumberOfUnits} ${String(intro.periodUnit || "day").toLowerCase()} free trial`
    : null;

  return {
    packageId: identifier,
    identifier,
    productId,
    title,
    priceString: String(product.priceString ?? ""),
    billingPeriod: period,
    trialDescription,
    isRecommended: period === "yearly"
  };
}

function mapOffering(offering: any): RevenueCatOfferingModel {
  const packages = Array.isArray(offering?.availablePackages)
    ? offering.availablePackages.map(mapPackage)
    : [];

  const packageOrder = ["yearly", "monthly", "weekly", "unknown"];
  packages.sort(
    (a: RevenueCatPackageModel, b: RevenueCatPackageModel) =>
      packageOrder.indexOf(a.billingPeriod) - packageOrder.indexOf(b.billingPeriod)
  );

  return {
    offeringId: String(offering?.identifier ?? "default"),
    serverDescription: offering?.serverDescription ? String(offering.serverDescription) : null,
    packages
  };
}

function getCustomerId(info: any): string | null {
  return (
    info?.originalAppUserId ??
    info?.entitlements?.verification ??
    info?.requestDate ??
    null
  );
}

function mapCustomerInfo(info: any): RevenueCatCustomerSnapshot {
  const ent = info?.entitlements?.all?.[REVENUECAT_ENTITLEMENT_ID] ?? null;

  return {
    appUserId: String(info?.originalAppUserId ?? ""),
    originalAppUserId: info?.originalAppUserId ? String(info.originalAppUserId) : null,
    revenueCatCustomerId: getCustomerId(info),
    activeEntitlements: Object.keys(info?.entitlements?.active ?? {}),
    pro: {
      entitlementId: "pro",
      isActive: Boolean(ent?.isActive),
      willRenew: Boolean(ent?.willRenew),
      periodType:
        ent?.periodType === "trial" || ent?.periodType === "intro" || ent?.periodType === "normal"
          ? ent.periodType
          : "unknown",
      productIdentifier: ent?.productIdentifier ? String(ent.productIdentifier) : null,
      latestPurchaseDate: toIso(ent?.latestPurchaseDate),
      originalPurchaseDate: toIso(ent?.originalPurchaseDate),
      expirationDate: toIso(ent?.expirationDate),
      store: ent?.store ? String(ent.store) : null,
      managementURL: info?.managementURL ? String(info.managementURL) : null
    },
    raw: (info ?? {}) as Record<string, unknown>
  };
}

export interface RevenueCatService {
  isAvailable(): boolean;
  configure(appUserId: string): Promise<void>;
  getOfferings(): Promise<RevenueCatOfferingModel | null>;
  getCustomerSnapshot(): Promise<RevenueCatCustomerSnapshot | null>;
  purchasePackage(packageIdentifier: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
}

class RevenueCatServiceImpl implements RevenueCatService {
  private configuredForUser: string | null = null;

  isAvailable() {
    return Platform.OS !== "web" && Boolean(getNativePurchasesModule());
  }

  async configure(appUserId: string): Promise<void> {
    const purchases = getNativePurchasesModuleOrThrow();

    if (this.configuredForUser === appUserId) {
      if (__DEV__) {
        console.log("[revenuecat] configure_skipped_already_configured", { appUserId });
      }
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    if (!apiKey) {
      throw new Error("Missing EXPO_PUBLIC_REVENUECAT_API_KEY in env.");
    }

    await purchases.configure({
      apiKey,
      appUserID: appUserId
    });

    if (__DEV__) {
      console.log("[revenuecat] configured", {
        appUserId,
        hasApiKey: Boolean(apiKey)
      });
    }

    this.configuredForUser = appUserId;
  }

  async getOfferings(): Promise<RevenueCatOfferingModel | null> {
    const purchases = getNativePurchasesModuleOrThrow();

    const offerings = await purchases.getOfferings();
    const current = offerings?.current;
    if (__DEV__) {
      console.log("[revenuecat] offerings_loaded", {
        hasCurrentOffering: Boolean(current),
        offeringKeys: Object.keys(offerings?.all ?? {}),
        packageCount: Array.isArray(current?.availablePackages) ? current.availablePackages.length : 0
      });
    }
    if (!current) {
      throw new Error("RevenueCat returned no current offering for this user/build.");
    }

    return mapOffering(current);
  }

  async getCustomerSnapshot(): Promise<RevenueCatCustomerSnapshot | null> {
    const purchases = getNativePurchasesModuleOrThrow();

    const info = await purchases.getCustomerInfo();
    if (__DEV__) {
      console.log("[revenuecat] customer_info_loaded", {
        originalAppUserId: info?.originalAppUserId ?? null,
        activeEntitlements: Object.keys(info?.entitlements?.active ?? {})
      });
    }
    return mapCustomerInfo(info);
  }

  async purchasePackage(packageIdentifier: string): Promise<PurchaseResult> {
    const purchases = getNativePurchasesModuleOrThrow();

    try {
      const offerings = await purchases.getOfferings();
      const pkg = offerings?.current?.availablePackages?.find((p: any) => String(p.identifier) === packageIdentifier);
      if (!pkg) {
        return { status: "failed", message: "Selected package is unavailable." };
      }

      const result = await purchases.purchasePackage(pkg);
      const info = result?.customerInfo ?? (await purchases.getCustomerInfo());
      return { status: "success", snapshot: mapCustomerInfo(info) };
    } catch (error: any) {
      const cancelled = Boolean(error?.userCancelled);
      if (cancelled) return { status: "cancelled" };
      return { status: "failed", message: error?.message ?? "Purchase failed." };
    }
  }

  async restorePurchases(): Promise<RestoreResult> {
    const purchases = getNativePurchasesModuleOrThrow();

    try {
      const info = await purchases.restorePurchases();
      const snapshot = mapCustomerInfo(info);
      if (!snapshot.pro.isActive) {
        return { status: "no_purchases" };
      }
      return { status: "restored", snapshot };
    } catch (error: any) {
      return { status: "failed", message: error?.message ?? "Restore failed." };
    }
  }
}

export const revenueCatService: RevenueCatService = new RevenueCatServiceImpl();
