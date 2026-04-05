import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

export interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "member";
}

interface AuthState {
  user: User | null;
  loading: boolean;
  bootstrapped: boolean;      // has the very first admin account been created?
  registrationLocked: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; name: string; password: string; inviteToken?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(true);
  const [registrationLocked, setRegistrationLocked] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const status = await api<{ bootstrapped: boolean; registrationLocked: boolean }>(
        "/api/auth/status"
      );
      setBootstrapped(status.bootstrapped);
      setRegistrationLocked(status.registrationLocked);
    } catch {}
    try {
      const me = await api<User>("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const u = await api<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(u);
  };

  const register = async (data: {
    email: string;
    name: string;
    password: string;
    inviteToken?: string;
  }) => {
    const u = await api<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setUser(u);
    await refresh();
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, bootstrapped, registrationLocked, refresh, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
