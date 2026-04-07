"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "@headless-crm/auth-web/client";

interface AuthContextValue {
  /** CRM API agent token — stored in localStorage, used by apiFetch() */
  token: string;
  /** Admin key for bootstrap provisioning (power-user override) */
  adminKey: string;
  setToken: (t: string) => void;
  setAdminKey: (k: string) => void;
  /** True if a token or admin key is available for API calls */
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  token: "",
  adminKey: "",
  setToken: () => {},
  setAdminKey: () => {},
  isConfigured: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const [token, setTokenState] = useState("");
  const [adminKey, setAdminKeyState] = useState("");
  const [mounted, setMounted] = useState(false);

  // On mount, load any cached tokens from localStorage
  useEffect(() => {
    setTokenState(localStorage.getItem("hcrm_token") ?? "");
    setAdminKeyState(localStorage.getItem("hcrm_admin_key") ?? "");
    setMounted(true);
  }, []);

  // When a Better Auth session is present, ensure we have a fresh agent token.
  // The session-token endpoint resolves/creates a dashboard agent and returns
  // its JWT — stored in localStorage as hcrm_token for use by apiFetch().
  useEffect(() => {
    if (!session?.user || isPending) return;

    const cached = localStorage.getItem("hcrm_token");
    if (cached) return; // already have a token

    fetch("/api/auth/session-token")
      .then((r) => r.json())
      .then(({ token: agentToken }) => {
        if (agentToken) {
          setTokenState(agentToken);
          localStorage.setItem("hcrm_token", agentToken);
        }
      })
      .catch(() => {});
  }, [session, isPending]);

  const setToken = useCallback((t: string) => {
    setTokenState(t);
    localStorage.setItem("hcrm_token", t);
  }, []);

  const setAdminKey = useCallback((k: string) => {
    setAdminKeyState(k);
    localStorage.setItem("hcrm_admin_key", k);
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <AuthContext.Provider
      value={{
        token,
        adminKey,
        setToken,
        setAdminKey,
        isConfigured: !!(token || adminKey),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
