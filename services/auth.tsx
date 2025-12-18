// services/auth.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadJSON, saveJSON, removeKey } from './storage';
import { getAppSettings } from './settingsApi';
import { roleApi } from './roleApi';
import { subscribe } from './bus';
import type { Role, Capability, User, AppSettings } from '../types';
import { DEFAULT_ROLE_POLICIES, ALL_CAPS } from '../constants';

type AuthContextValue = {
  currentUser: User | null;
  appSettings: AppSettings | null;
  can: (cap: Capability | Capability[]) => boolean;
  hasRole: (role: Role | Role[]) => boolean;

  // Новый реальный login(email, password)
  login: (email: string, password: string) => Promise<void>;

  // Старый dev-метод, остаётся для DevRoleSwitcher / тестов
  loginAs: (user: User) => Promise<void>;
  logout: () => Promise<void>;

  allCaps: Capability[];
  rolePolicies: Record<Role, Capability[]>;
  refreshPolicies: () => Promise<void>;
};
const CURRENT_USER_KEY = '__current_user__';
const TOKEN_KEY = '__auth_token__';
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

// ---------- API helpers ----------

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiError {
  success: false;
  error?: { code?: string; message?: string; details?: any };
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

async function apiLogin(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  let json: ApiResponse<{ token: string; user: User }>;
  try {
    json = await res.json();
  } catch {
    throw new Error('Не удалось разобрать ответ сервера при входе');
  }

  if (!json.success) {
    const error = json as ApiError;
    throw new Error(error.error?.message || 'Неверный email или пароль');
  }

  return json.data;
}

async function apiMe(token: string): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let json: ApiResponse<{ user: User }>;  // ← Изменили тип!
  try {
    json = await res.json();
  } catch {
    throw new Error('Не удалось разобрать ответ сервера при загрузке профиля');
  }

  if (!json.success) {
    const error = json as ApiError;
    throw new Error(error.error?.message || 'Не удалось получить данные пользователя');
  }

  return json.data.user;  // ← ИСПРАВЛЕНО!
}

async function apiLogout(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // для минимального варианта игнорируем ошибку
  }
}

// ---------- AuthContext ----------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [rolePolicies, setRolePolicies] =
    useState<Record<Role, Capability[]>>(DEFAULT_ROLE_POLICIES);

  //console.log('🔍 rolePolicies initialized:', DEFAULT_ROLE_POLICIES.admin);

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  });

  const fetchPolicies = useCallback(async () => {
    const policies = await roleApi.getRolePolicies();
    setRolePolicies(policies);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      // AppSettings
      getAppSettings()
        .then((settings) => {
          if (alive) setAppSettings(settings);
        })
        .catch(() => { });

      // Политики ролей
      fetchPolicies().catch(() => { });

      // Пытаемся загрузить пользователя по токену с backend
      if (token) {
        try {
          const user = await apiMe(token);
          if (!alive) return;
          setCurrentUser(user);
          await saveJSON(CURRENT_USER_KEY, user);
          return;
        } catch {
          if (!alive) return;
          setCurrentUser(null);
          setToken(null);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(TOKEN_KEY);
          }
        }
      }

      // DISABLED FOR E2E: Auto-login as dev-driver blocks Playwright tests
      setCurrentUser(null);
    })();

    const unsubscribe = subscribe((msg) => {
      if (msg.topic === 'policies') {
        //fetchPolicies();
      }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [fetchPolicies, token]);

  const roleCaps = useMemo(() => {
    const role = currentUser?.role || 'user';
    const caps = rolePolicies[role] || [];
    // console.log('🔍 roleCaps computed:', { role, capsCount: caps.length, hasAdminPanel: caps.includes('admin.panel') });
    return caps;
  }, [currentUser?.role, rolePolicies]);

  const can = useCallback(
    (cap: Capability | Capability[]) => {
      const list = Array.isArray(cap) ? cap : [cap];
      const extras = currentUser?.extraCaps || [];
      const result = list.every((c) => roleCaps.includes(c) || extras.includes(c));
      // console.log('🔍 can() check:', { cap, roleCaps: roleCaps.slice(0, 5) + '...', result });
      return result;
    },
    [roleCaps, currentUser?.extraCaps],
  );

  const hasRole = useCallback(
    (role: Role | Role[]) => {
      const r = Array.isArray(role) ? role : [role];
      return currentUser ? r.includes(currentUser.role) : false;
    },
    [currentUser],
  );

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await apiLogin(email, password);
    // console.log('🔐 Login response:', { user, role: user.role, token: token.substring(0, 20) + '...' });
    setCurrentUser(user);
    setToken(token);
    await saveJSON(CURRENT_USER_KEY, user);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
  }, []);

  // Старый dev-метод
  const loginAs = useCallback(async (user: User) => {
    setCurrentUser(user);
    await saveJSON(CURRENT_USER_KEY, user);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout(token);
    setCurrentUser(null);
    setToken(null);
    await removeKey(CURRENT_USER_KEY);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  const value: AuthContextValue = {
    currentUser,
    appSettings,
    can,
    hasRole,
    login,
    loginAs,
    logout,
    allCaps: ALL_CAPS,
    rolePolicies,
    refreshPolicies: fetchPolicies,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Обёртки для UI

export const RequireCapability: React.FC<{
  cap: Capability | Capability[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ cap, fallback = null, children }) => {
  const { can } = useAuth();
  if (!can(cap)) return <>{fallback}</>;
  return <>{children}</>;
};

export const RequireRole: React.FC<{
  role: Role | Role[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ role, fallback = null, children }) => {
  const { hasRole } = useAuth();
  if (!hasRole(role)) return <>{fallback}</>;
  return <>{children}</>;
};

// DevRoleSwitcher: в PROD не показываем
export const DevRoleSwitcher: React.FC = () => {
  if (!import.meta.env.DEV) return null;

  const { currentUser, loginAs, rolePolicies } = useAuth();
  const roles: Role[] = [
    'admin',
    'auditor',
    'user',
    'driver',
    'reviewer',
    'accountant',
    'mechanic',
    'viewer',
  ];

  return (
    <div className="text-xs flex items-center gap-2 p-1 rounded bg-gray-100 dark:bg-gray-800">
      <span>Роль:</span>
      <select
        value={currentUser?.role || 'user'}
        onChange={(e) => {
          const role = e.target.value as Role;
          const displayName = role.charAt(0).toUpperCase() + role.slice(1);
          loginAs({ id: `dev-${role}`, role, displayName });
        }}
        className="px-1 py-0.5 rounded border dark:border-gray-700 dark:bg-gray-900"
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <span className="text-gray-500">
        прав: {rolePolicies[currentUser?.role || 'user']?.length || 0}
      </span>
    </div>
  );
};