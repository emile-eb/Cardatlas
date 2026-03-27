import { ENV_KEYS } from "@/constants/env";

type AppConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  expoProjectId?: string;
  revenueCatIosKey?: string;
  metaAppId?: string;
  bundleIdentifier: string;
};

function normalizeEnv(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readSupabaseUrl(): string | undefined {
  const value = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return normalizeEnv(value);
}

function readSupabaseAnonKey(): string | undefined {
  const value = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return normalizeEnv(value);
}

function readExpoProjectId(): string | undefined {
  const value = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;
  return normalizeEnv(value);
}

function readRevenueCatIosKey(): string | undefined {
  const value = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  return normalizeEnv(value);
}

function readMetaAppId(): string | undefined {
  const value = process.env.EXPO_PUBLIC_META_APP_ID;
  return normalizeEnv(value);
}

function readBundleIdentifier(): string | undefined {
  const value = process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER;
  return normalizeEnv(value);
}

function readMarketPulseProvider(): string | undefined {
  const value = process.env.EXPO_PUBLIC_MARKET_PULSE_PROVIDER;
  return value ? value : undefined;
}

export function getAppConfig(): AppConfig {
  return {
    // Supabase runtime endpoints for auth/data/storage.
    supabaseUrl: readSupabaseUrl(),
    supabaseAnonKey: readSupabaseAnonKey(),
    expoProjectId: readExpoProjectId(),
    // RevenueCat iOS public SDK key (future subscription integration).
    revenueCatIosKey: readRevenueCatIosKey(),
    // Meta app id for event attribution (future integration).
    metaAppId: readMetaAppId(),
    bundleIdentifier: readBundleIdentifier() ?? "com.cardatlas.app"
  };
}

export const appConfig = getAppConfig();

export function validateRequiredRuntimeConfig() {
  const missing: string[] = [];
  if (!appConfig.supabaseUrl) missing.push(ENV_KEYS.supabaseUrl);
  if (!appConfig.supabaseAnonKey) missing.push(ENV_KEYS.supabaseAnonKey);

  return {
    isValid: missing.length === 0,
    missing
  };
}
