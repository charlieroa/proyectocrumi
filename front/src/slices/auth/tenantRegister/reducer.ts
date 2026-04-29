// Contenido para: src/slices/auth/tenantRegister/reducer.ts

import { createSlice } from "@reduxjs/toolkit";

export const initialState = {
  registrationSuccess: null,
  registrationError: null,
};

const tenantRegisterSlice = createSlice({
  name: "tenantRegister",
  initialState,
  reducers: {
    registerTenantSuccessful(state, action) {
      state.registrationSuccess = action.payload;
      state.registrationError = null;
    },
    registerTenantFailed(state, action) {
      // --- AÑADE ESTE CONSOLE.LOG ---


      state.registrationSuccess = null;
      state.registrationError = action.payload;
    },
    resetTenantRegisterFlag(state) {
      state.registrationSuccess = null;
      state.registrationError = null;
    }
  },
});

export const {
  registerTenantSuccessful,
  registerTenantFailed,
  resetTenantRegisterFlag,
} = tenantRegisterSlice.actions;

export default tenantRegisterSlice.reducer;