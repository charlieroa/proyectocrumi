// Environment variable bridge: CRA (process.env.REACT_APP_*) -> Vite (import.meta.env.VITE_*)

export const env = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3002/api',
  DEFAULTAUTH: import.meta.env.VITE_DEFAULTAUTH || 'jwt',
  OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY || '',
  NODE_ENV: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
};

// Global shim so legacy code using process.env.REACT_APP_* still works
// This avoids having to update 30+ files that reference process.env directly
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = {
    ...((window as any).process?.env || {}),
    NODE_ENV: import.meta.env.MODE,
    REACT_APP_API_URL: env.API_URL,
    REACT_APP_DEFAULTAUTH: env.DEFAULTAUTH,
    REACT_APP_OPENAI_API_KEY: env.OPENAI_API_KEY,
    PUBLIC_URL: '',
  };
}

export default env;
