import { api } from '../../../services/api';
import { setToken } from '../../../services/auth';
import { loginSuccess } from '../login/reducer';

import {
  registerTenantSuccessful,
  registerTenantFailed,
} from './reducer';


export const registerTenant = (tenantData: any) => async (dispatch: any) => {
  try {
    const response = await api.post("/auth/register-tenant", tenantData);
    const data = response.data;

    // Auto-login si el backend devolvió token
    if (data.token) {
      setToken(data.token);
      const authUser = {
        message: "Login Successful",
        token: data.token,
        user: data.user || { email: tenantData.adminEmail },
        setup_complete: data.setup_complete ?? false
      };
      sessionStorage.setItem("authUser", JSON.stringify(authUser));
      dispatch(loginSuccess(authUser));
      dispatch(registerTenantSuccessful(data));
      // Redirigir directamente a settings
      window.location.replace('/settings');
      return;
    }

    dispatch(registerTenantSuccessful(data));
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || "Ocurrió un error inesperado en el registro.";
    dispatch(registerTenantFailed(errorMessage));
  }
};