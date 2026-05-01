import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  login as apiLogin,
  me as apiMe,
  setAuthToken,
  setUnauthorizedHandler,
  signup as apiSignup,
  type AuthUser
} from "../api";

const TOKEN_STORAGE_KEY = "pointz.token";
const USER_STORAGE_KEY = "pointz.user";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStored(): { token: string | null; user: AuthUser | null } {
  if (typeof window === "undefined") return { token: null, user: null };
  try {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const userRaw = window.localStorage.getItem(USER_STORAGE_KEY);
    const user = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function persist(token: string | null, user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    if (user) window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = useRef(loadStored());
  const [token, setToken] = useState<string | null>(initial.current.token);
  const [user, setUser] = useState<AuthUser | null>(initial.current.user);
  const [initializing, setInitializing] = useState<boolean>(Boolean(initial.current.token));

  // Keep the api module in sync with the current token.
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    persist(null, null);
    setAuthToken(null);
  }, []);

  // Register a global 401 handler so any request that comes back with an
  // expired/invalid token forces a logout.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // On boot, if we have a stored token, validate it against /auth/me.
  useEffect(() => {
    if (!token) {
      setInitializing(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const fresh = await apiMe();
        if (cancelled) return;
        setUser(fresh);
        persist(token, fresh);
      } catch {
        // The 401 handler above already cleared state; nothing to do.
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.token);
    setUser(res.user);
    persist(res.token, res.user);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const res = await apiSignup(email, password);
    setToken(res.token);
    setUser(res.user);
    persist(res.token, res.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, initializing, login, signup, logout }),
    [user, token, initializing, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
