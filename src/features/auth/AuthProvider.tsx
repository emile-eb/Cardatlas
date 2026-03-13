import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "@/services/auth/AuthService";
import type { AuthSession, AuthState } from "@/types";

type AuthContextValue = AuthState & {
  bootstrap: () => Promise<void>;
  signOut: () => Promise<void>;
};

const initialState: AuthState = {
  status: "idle",
  session: null,
  error: null
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(initialState);

  const bootstrap = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading", error: null }));

    try {
      const session: AuthSession = await authService.restoreOrCreateAnonymousSession();
      setState({ status: "authenticated", session, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to bootstrap session.";
      setState({ status: "error", session: null, error: message });
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setState(initialState);
    await bootstrap();
  }, [bootstrap]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      bootstrap,
      signOut
    }),
    [state, bootstrap, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
