import { appConfig, validateRequiredRuntimeConfig } from "@/lib/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

let cachedClient: any | null = null;

function loadSupabaseSdk() {
  try {
    return require("@supabase/supabase-js");
  } catch {
    throw new Error("Missing @supabase/supabase-js. Install it with: npm install @supabase/supabase-js");
  }
}

export async function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const runtimeConfig = validateRequiredRuntimeConfig();
  if (!runtimeConfig.isValid) {
    throw new Error(`Missing required runtime config: ${runtimeConfig.missing.join(", ")}`);
  }

  const sdk = loadSupabaseSdk();
  const client = sdk.createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      storage: Platform.OS === "web" ? undefined : AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  cachedClient = client;
  return client;
}

export async function getRequiredSupabaseClient() {
  return getSupabaseClient();
}
