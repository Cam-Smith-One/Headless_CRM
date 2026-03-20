"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthContextValue {
  token: string;
  adminKey: string;
  setToken: (t: string) => void;
  setAdminKey: (k: string) => void;
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
  const [token, setTokenState] = useState("");
  const [adminKey, setAdminKeyState] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTokenState(localStorage.getItem("hcrm_token") ?? "");
    setAdminKeyState(localStorage.getItem("hcrm_admin_key") ?? "");
    setMounted(true);
  }, []);

  function setToken(t: string) {
    setTokenState(t);
    localStorage.setItem("hcrm_token", t);
  }

  function setAdminKey(k: string) {
    setAdminKeyState(k);
    localStorage.setItem("hcrm_admin_key", k);
  }

  if (!mounted) return <>{children}</>;

  return (
    <AuthContext.Provider value={{ token, adminKey, setToken, setAdminKey, isConfigured: !!(token || adminKey) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
