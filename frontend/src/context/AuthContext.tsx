import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import type { User, UserRole } from "../types";

interface AuthContextType {
  user: User | null;
  roles: UserRole[];
  isLoading: boolean;
  loginUser: (user: User) => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<User>;
  registerUser: (payload: {
    name: string;
    phone_number: string;
    email: string;
    password: string;
    address: string;
    location: string;
    role?: string;
  }) => Promise<User>;
  logout: () => void;
  ensureRole: (role: string) => Promise<void>;
  toggleRole: (role: string, active: boolean) => Promise<void>;
  sendOtp: (email: string) => Promise<string>;
  verifyOtp: (email: string, otp: string) => Promise<User>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "farma_user_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from localStorage on initial load
  useEffect(() => {
    async function initAuth() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as User;
          // Refresh user data from backend
          const fresh = await api.users.get(parsed.id);
          setUser(fresh);
          const userRoles = await api.users.getRoles(fresh.id);
          setRoles(userRoles);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
        }
      } catch (err) {
        console.warn("Failed to restore session:", err);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const loginUser = async (newUser: User) => {
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    try {
      const userRoles = await api.users.getRoles(newUser.id);
      setRoles(userRoles);
    } catch {
      setRoles([]);
    }
  };

  const loginWithCredentials = async (identifier: string, password: string) => {
    const loggedIn = await api.users.login(identifier, password);
    await loginUser(loggedIn);
    return loggedIn;
  };

  const registerUser = async (payload: {
    name: string;
    phone_number: string;
    email: string;
    password: string;
    address: string;
    location: string;
    role?: string;
  }) => {
    const created = await api.users.register({
      name: payload.name,
      phone_number: payload.phone_number,
      email: payload.email,
      password: payload.password,
      address: payload.address,
      location: payload.location,
    });

    if (payload.role) {
      try {
        await api.users.addRole(created.id, payload.role);
      } catch (err) {
        console.warn("Role assignment warning:", err);
      }
    }

    await loginUser(created);
    return created;
  };

  const logout = () => {
    setUser(null);
    setRoles([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const ensureRole = async (roleName: string) => {
    if (!user) throw new Error("Please sign in first.");
    const hasRole = roles.some((r) => r.role_type === roleName && !r.deactivated_at);
    if (!hasRole) {
      try {
        await api.users.addRole(user.id, roleName);
      } catch (err) {
        console.warn("Role already active or added:", err);
      }
      const updatedRoles = await api.users.getRoles(user.id);
      setRoles(updatedRoles);
    }
  };

  const toggleRole = async (roleType: string, active: boolean) => {
    if (!user) throw new Error("Please sign in first.");
    if (active) {
      await api.users.updateRole(user.id, roleType, true);
    } else {
      await api.users.updateRole(user.id, roleType, false);
    }
    const updatedRoles = await api.users.getRoles(user.id);
    setRoles(updatedRoles);
  };

  const sendOtp = async (email: string) => {
    const resp = await api.users.sendOtp(email);
    return resp.message;
  };

  const verifyOtp = async (email: string, otp: string) => {
    const verifiedUser = await api.users.verifyOtp(email, otp);
    await loginUser(verifiedUser);
    return verifiedUser;
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const fresh = await api.users.get(user.id);
      setUser(fresh);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      const freshRoles = await api.users.getRoles(user.id);
      setRoles(freshRoles);
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        isLoading,
        loginUser,
        loginWithCredentials,
        registerUser,
        logout,
        ensureRole,
        toggleRole,
        sendOtp,
        verifyOtp,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
