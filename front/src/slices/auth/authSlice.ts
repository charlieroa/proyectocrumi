import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { jwtDecode } from "jwt-decode";

interface DecodedUser { id: string; tenant_id: string; email: string }
interface JWTPayload { user: DecodedUser; exp?: number }
interface AuthState { token: string|null; user: DecodedUser|null; exp?: number|null }

const readInit = (): AuthState => {
  const t = localStorage.getItem("token");
  if (!t) return { token: null, user: null, exp: null };
  try {
    const { user, exp } = jwtDecode<JWTPayload>(t);
    if (exp && exp * 1000 < Date.now()) {
      localStorage.removeItem("token");
      return { token: null, user: null, exp: null };
    }
    return { token: t, user, exp: exp ?? null };
  } catch {
    return { token: null, user: null, exp: null };
  }
};

const initialState: AuthState = readInit();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ token: string }>) => {
      state.token = action.payload.token;
      localStorage.setItem("token", action.payload.token);
      try {
        const { user, exp } = jwtDecode<JWTPayload>(action.payload.token);
        state.user = user ?? null;
        state.exp = exp ?? null;
      } catch {
        state.user = null;
        state.exp = null;
      }
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.exp = null;
      localStorage.removeItem("token");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

// Selectores
export const selectToken    = (s: any) => s.auth.token as string|null;
export const selectUser     = (s: any) => s.auth.user as DecodedUser|null;
export const selectTenantId = (s: any) => s.auth.user?.tenant_id ?? null;
export const selectExp      = (s: any) => s.auth.exp as number|null;
