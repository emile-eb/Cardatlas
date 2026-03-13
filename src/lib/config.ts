import { ENV_KEYS } from "@/constants/env";

type AppConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  revenueCatIosKey?: string;
  metaAppId?: string;
  bundleIdentifier: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getAppConfig(): AppConfig {
  return {
    // Supabase runtime endpoints for auth/data/storage.
    supabaseUrl: readEnv(ENV_KEYS.supabaseUrl),
    supabaseAnonKey: readEnv(ENV_KEYS.supabaseAnonKey),
    // RevenueCat iOS public SDK key (future subscription integration).
    revenueCatIosKey: readEnv(ENV_KEYS.revenueCatIosKey),
    // Meta app id for event attribution (future integration).
    metaAppId: readEnv(ENV_KEYS.metaAppId),
    bundleIdentifier: readEnv(ENV_KEYS.bundleIdentifier) ?? "com.cardatlas.app"
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
