// services/auth.ts
import { jwtDecode } from "jwt-decode";

export const TOKEN_KEY = "token";
const LEGACY_TOKEN_KEY = "authToken";
const AUTH_USER_KEY = "authUser";

// =============================
// Token helpers
// =============================
export const setToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LEGACY_TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
};

export const isAuthenticated = (): boolean => !!getToken();

export type DecodedToken = {
  exp?: number;
  iat?: number;
  user?: {
    id?: string;
    tenant_id?: string;
    email?: string;
    // --- NUEVO: Definimos explícitamente el rol para mayor claridad ---
    role_id?: number; 
    [k: string]: any;
  };
  tenant_id?: string;
  [k: string]: any;
};

export const getDecodedToken = (): DecodedToken | null => {
  const token = getToken();
  if (!token) return null;
  try {
    return jwtDecode<DecodedToken>(token);
  } catch {
    return null;
  }
};

export const getTenantIdFromToken = (): string | null => {
  const dec = getDecodedToken();
  return dec?.user?.tenant_id || dec?.tenant_id || null;
};

// --- NUEVO: Función centralizada para obtener el rol del usuario ---
export const getRoleFromToken = (): number | null => {
  const dec = getDecodedToken();
  const roleId = dec?.user?.role_id;
  if (roleId == null || String(roleId).trim() === '') return null;
  const n = Number(roleId);
  return Number.isNaN(n) ? null : n;
};


export const isTokenExpired = (): boolean => {
  const dec = getDecodedToken();
  if (!dec?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return dec.exp < now;
};

// =============================
// AuthUser helpers
// =============================
export const setAuthUser = (user: any) => {
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

export const getAuthUser = <T = any>(): T | null => {
  const raw = sessionStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const clearAuthUser = () => {
  sessionStorage.removeItem(AUTH_USER_KEY);
};

export const logout = () => {
  clearToken();
  clearAuthUser();
};

// Modo workspace para Contador: 'contador' = Espacio Contador (full), 'tenant' = Crumi Contabilidad (limitado)
const WORKSPACE_MODE_KEY = 'crumi_workspace_mode';
export type WorkspaceMode = 'contador' | 'tenant';

const getUserKey = (): string | null => {
  const dec = getDecodedToken();
  const uid = dec?.user?.id || dec?.user?.email;
  return uid ? `${WORKSPACE_MODE_KEY}:${uid}` : null;
};

export const getWorkspaceMode = (): WorkspaceMode => {
  const userKey = getUserKey();
  const m = (userKey && localStorage.getItem(userKey))
    || localStorage.getItem(WORKSPACE_MODE_KEY)
    || sessionStorage.getItem(WORKSPACE_MODE_KEY);
  if (m === 'contador' || m === 'tenant') return m;

  // Por defecto: Solo Contadores (rol 4) inician en modo 'contador'
  // Todos los demás (incluyendo empresas creadas por contador) inician en 'tenant'
  const role = getRoleFromToken();
  return role === 4 ? 'contador' : 'tenant';
};

export const setWorkspaceMode = (mode: WorkspaceMode) => {
  const userKey = getUserKey();
  if (userKey) localStorage.setItem(userKey, mode);
  localStorage.setItem(WORKSPACE_MODE_KEY, mode);
  sessionStorage.setItem(WORKSPACE_MODE_KEY, mode);
};

/** Contador (4) o Tenant Admin (1) en modo Espacio Contador: ve Kanban, crear empresas, personal, topbar switcher */
export const isContadorFullMode = (): boolean => {
  const role = getRoleFromToken();
  // Aplica para Contador (4) o Tenant Admin (1) en modo contador
  if (role !== 4 && role !== 1) return false;
  return getWorkspaceMode() === 'contador';
};

/** Retorna true si es un Contador real (rol 4) - no Tenant */
export const isRealContador = (): boolean => {
  return getRoleFromToken() === 4;
};