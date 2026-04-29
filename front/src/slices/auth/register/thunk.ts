// Contenido FINAL y COMPLEto para: src/slices/auth/register/thunk.ts

import {
  registerUserSuccessful,
  registerUserFailed,
  resetRegisterFlagChange, // Usamos el nombre correcto
} from './reducer';

// Importamos la función correcta de nuestro helper
import { postJwtRegister } from '../../../helpers/fakebackend_helper';

// Este es el thunk que se llama desde la página de Registro
export const registerUser = (user: any) => async (dispatch: any) => {
  try {
    const response = await postJwtRegister(user);
    dispatch(registerUserSuccessful(response));
  } catch (error) {
    // CORRECCIÓN: Usamos la acción 'registerUserFailed' que sí existe en el reducer
    dispatch(registerUserFailed(error));
  }
};

// Mantenemos el nombre 'resetRegisterFlag' en la exportación para compatibilidad
// con el componente Register.tsx, pero dentro usamos la acción correcta.
export const resetRegisterFlag = () => (dispatch: any) => {
  dispatch(resetRegisterFlagChange());
};