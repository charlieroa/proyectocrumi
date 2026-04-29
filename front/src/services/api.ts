// services/api.ts
import axios, { AxiosError } from "axios";
import { getToken, clearToken } from "./auth";
import { env } from "../env";

const API_BASE_URL = env.API_URL;

/** Instancia única de Axios para toda la app */
export const api = axios.create({
  // --- USO CORREGIDO ---
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    // No fijamos "Content-Type" aquí para no romper FormData; lo seteamos en el request si hace falta.
  },
});

/** Rutas de auth que NO deben enviar Authorization (login, register, etc.) */
const NO_TOKEN_AUTH_ROUTES = ["/auth/login", "/auth/register-tenant", "/auth/register-contador", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-reset-token"];
const isAuthRouteNoToken = (url?: string): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url, api.defaults.baseURL || API_BASE_URL);
    const path = u.pathname.replace(/\/$/, "");
    return NO_TOKEN_AUTH_ROUTES.some((r) => path === r || path.startsWith(r + "/"));
  } catch {
    return NO_TOKEN_AUTH_ROUTES.some((r) => url === r || url.startsWith(r + "/"));
  }
};

/** Interceptor de REQUEST: agrega Authorization salvo rutas /auth/* y cuida Content-Type */
api.interceptors.request.use((config) => {
  // Asegurar headers como objeto mutable
  config.headers = config.headers ?? {};

  // Establecer Content-Type solo cuando NO sea FormData y no esté ya definido
  const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData;
  if (!isFormData && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }

  // Token en todas las rutas excepto login/register/etc. (/auth/switch-tenant sí lleva token)
  const token = getToken();
  const skipToken = isAuthRouteNoToken(config.url);
  if (token && !skipToken) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  } else if (skipToken && (config.headers as any).Authorization) {
    delete (config.headers as any).Authorization;
  }

  return config;
});

/** Interceptor de RESPONSE: manejo global de 401 y log de errores 4xx */
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err?.response?.status;
    const data = err?.response?.data as any;

    if (status === 401) {
      // Token inválido/expirado → limpiar y redirigir a login
      clearToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    // Log en consola el mensaje real del servidor (evita solo ver "400 Bad Request")
    if (status && status >= 400 && status < 500 && data) {
      const msg = data?.error || data?.message || (Array.isArray(data?.errors) ? data.errors[0]?.message : null);
      if (msg) {
        console.warn(`[API ${status}]`, typeof msg === "string" ? msg : data);
      }
    }

    return Promise.reject(err);
  }
);

/** (Opcional) cambiar baseURL en runtime si lo necesitas */
export const setApiBaseURL = (baseURL: string) => {
  api.defaults.baseURL = baseURL;
};

export default api;