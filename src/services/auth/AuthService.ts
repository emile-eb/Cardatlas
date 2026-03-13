import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { AuthSession } from "@/types/auth";

function mapSupabaseSession(session: any): AuthSession {
  return {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    isAnonymous: Boolean(session.user?.is_anonymous)
  };
}

async function ensureUserBootstrap(authUserId: string): Promise<string> {
  const supabase = await getRequiredSupabaseClient();

  const { data: userRow, error: upsertUserError } = await supabase
    .from("users")
    .upsert(
      {
        auth_user_id: authUserId,
        notifications_enabled: true,
        default_currency: "USD"
      },
      { onConflict: "auth_user_id" }
    )
    .select("id")
    .single();

  if (upsertUserError) {
    throw upsertUserError;
  }

  const appUserId = userRow.id as string;

  const { error: subscriptionError } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: appUserId,
        entitlement_status: "inactive",
        trial_eligible: true
      },
      { onConflict: "user_id" }
    );

  if (subscriptionError) {
    throw subscriptionError;
  }

  const { error: usageStateError } = await supabase
    .from("usage_state")
    .upsert(
      {
        user_id: appUserId,
        free_scan_limit: 3,
        free_scans_used: 0
      },
      { onConflict: "user_id" }
    );

  if (usageStateError) {
    throw usageStateError;
  }

  return appUserId;
}

export class AuthService {
  async restoreOrCreateAnonymousSession(): Promise<AuthSession> {
    const supabase = await getRequiredSupabaseClient();

    const { data: currentSessionResult, error: currentSessionError } = await supabase.auth.getSession();
    if (currentSessionError) {
      throw currentSessionError;
    }

    let session = currentSessionResult?.session;

    if (!session) {
      const { data: anonymousResult, error: anonymousError } = await supabase.auth.signInAnonymously();
      if (anonymousError) {
        throw anonymousError;
      }

      if (!anonymousResult?.session) {
        throw new Error("Anonymous session was not returned by Supabase.");
      }

      session = anonymousResult.session;
    }

    const mapped = mapSupabaseSession(session);
    mapped.appUserId = await ensureUserBootstrap(mapped.userId);

    return mapped;
  }

  async signOut(): Promise<void> {
    const supabase = await getRequiredSupabaseClient();
    await supabase.auth.signOut();
  }
}

export const authService = new AuthService();
