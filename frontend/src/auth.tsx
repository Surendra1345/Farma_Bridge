import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, configureApi } from "./api";
import type { Role, User } from "./types";

const STORAGE_KEY = "agrilink.session";
type Session = { token: string; user: User };

type AuthValue = {
  user: User | null;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  /** Replace the stored profile (e.g. after editing it). */
  updateUser: (user: User) => void;
  /** Make sure the signed-in user holds `role`, adding it if needed. */
  ensureRole: (role: Role) => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);

function load(): Session | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(load);

  const signIn = useCallback((token: string, user: User) => {
    const next = { token, user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);
  const signOut = useCallback(() => { localStorage.removeItem(STORAGE_KEY); setSession(null); }, []);

  // Wire the API client to this session (synchronously, so the first requests carry the token).
  configureApi({ getToken: () => session?.token ?? null, onUnauthorized: signOut });

  // Refresh the profile (roles may have changed) and drop dead sessions on startup.
  useEffect(() => {
    if (!session) return;
    authApi.me().then((user) => signIn(session.token, user)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureRole = useCallback(async (role: Role) => {
    if (!session || session.user.roles.includes(role)) return;
    await authApi.addRole(role);
    signIn(session.token, { ...session.user, roles: [...session.user.roles, role] });
  }, [session, signIn]);

  const updateUser = useCallback((user: User) => { if (session) signIn(session.token, user); }, [session, signIn]);

  const value = useMemo(() => ({ user: session?.user ?? null, signIn, signOut, updateUser, ensureRole }), [session, signIn, signOut, updateUser, ensureRole]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
