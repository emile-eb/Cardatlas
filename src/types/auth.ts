export type AuthBootstrapStatus = "idle" | "loading" | "authenticated" | "error";

export interface AuthSession {
  userId: string;
  appUserId?: string;
  accessToken?: string;
  refreshToken?: string;
  isAnonymous: boolean;
  expiresAt?: number;
}

export interface AuthState {
  status: AuthBootstrapStatus;
  session: AuthSession | null;
  error: string | null;
}
