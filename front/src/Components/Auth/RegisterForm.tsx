import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { createSelector } from 'reselect';
import Swal from 'sweetalert2';
import { Eye, EyeOff } from 'lucide-react';

import { registerTenant } from '../../slices/auth/tenantRegister/thunk';
import { resetTenantRegisterFlag } from '../../slices/auth/tenantRegister/reducer';
import { api } from '../../services/api';
import { setToken } from '../../services/auth';
import { loginSuccess } from '../../slices/auth/login/reducer';
import { setAuthModalView } from '../../slices/authModal/authModalSlice';
import { env } from '../../env';

type AccountType = 'empresa' | 'contador';

const RegisterForm: React.FC = () => {
  const dispatch: any = useDispatch();

  const registerData = createSelector(
    (state: any) => state.tenantRegister,
    (state) => ({
      success: state.registrationSuccess,
      error: state.registrationError,
    })
  );

  const { success, error } = useSelector(registerData);

  const [showPassword, setShowPassword] = useState(false);
  const [loader, setLoader] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('empresa');

  const validation = useFormik({
    enableReinitialize: true,
    initialValues: {
      tenantName: '',
      companyName: '',
      firstName: '',
      lastName: '',
      adminEmail: '',
      adminPassword: '',
    },
    validationSchema: Yup.object().shape({
      tenantName: Yup.string().when([], {
        is: () => accountType === 'empresa',
        then: (s) => s.required('Por favor ingresa el nombre de tu empresa'),
        otherwise: (s) => s.notRequired(),
      }),
      companyName: Yup.string().when([], {
        is: () => accountType === 'contador',
        then: (s) => s.required('Por favor ingresa el nombre de tu empresa'),
        otherwise: (s) => s.notRequired(),
      }),
      firstName: Yup.string().when([], {
        is: () => accountType === 'contador',
        then: (s) => s.required('Por favor ingresa tu nombre'),
        otherwise: (s) => s.notRequired(),
      }),
      adminEmail: Yup.string().required('Por favor ingresa tu email').email('Email inválido'),
      adminPassword: Yup.string().required('Por favor ingresa una contraseña').min(6, 'La contraseña debe tener al menos 6 caracteres'),
    }),
    onSubmit: async (values) => {
      setLoader(true);
      try {
        if (accountType === 'contador') {
          const res = await api.post('/auth/register-contador', {
            firstName: (values.firstName || values.adminEmail.split('@')[0]).trim(),
            lastName: (values.lastName || '').trim() || undefined,
            email: values.adminEmail.trim(),
            password: values.adminPassword,
            companyName: (values.companyName || values.tenantName || '').trim() || undefined,
          });

          if (res.data?.token) {
            setToken(res.data.token);
            const authUser = {
              message: "Login Successful",
              token: res.data.token,
              user: res.data.user || { email: values.adminEmail },
              setup_complete: false
            };
            sessionStorage.setItem("authUser", JSON.stringify(authUser));
            dispatch(loginSuccess(authUser));
            dispatch(setAuthModalView(null as any));
            window.location.replace('/settings');
            return;
          }

          Swal.fire({
            icon: 'success',
            title: 'Cuenta creada!',
            text: 'Ya puedes iniciar sesión.',
            confirmButtonColor: '#7F3AFB',
            timer: 3000,
            timerProgressBar: true,
          }).then(() => dispatch(setAuthModalView('login')));
        } else {
          const dataToSend = {
            tenantName: values.tenantName || values.companyName,
            adminEmail: values.adminEmail,
            adminPassword: values.adminPassword,
            adminFirstName: values.firstName || values.adminEmail.split('@')[0],
          };
          dispatch(registerTenant(dataToSend));
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error || 'Error al crear la cuenta.';
        Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#7F3AFB' });
      } finally {
        setLoader(false);
      }
    },
  });

  useEffect(() => {
    if (success) {
      setLoader(false);
      // Si la respuesta del backend incluye token, ir directo a settings (auto-login)
      if (success.token) {
        dispatch(setAuthModalView(null as any));
        window.location.replace('/settings');
        return;
      }
      // Fallback: sin token, enviar a login
      Swal.fire({
        icon: 'success',
        title: '¡Registro Exitoso!',
        text: 'Tu cuenta ha sido creada. Ahora puedes iniciar sesión.',
        confirmButtonColor: '#7F3AFB',
        timer: 3000,
        timerProgressBar: true,
      }).then(() => dispatch(setAuthModalView('login')));
    }
  }, [success, dispatch]);

  useEffect(() => {
    if (error) {
      setLoader(false);
      const msg = typeof error === 'string' ? error : (error?.error || error?.message || 'Error al registrar la cuenta');
      Swal.fire({
        icon: 'error',
        title: 'Error de Registro',
        text: msg,
        confirmButtonColor: '#7F3AFB',
      });
      dispatch(resetTenantRegisterFlag());
    }
  }, [error, dispatch]);

  const inputCls = (touched: boolean | undefined, err: string | undefined) =>
    `w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors
     bg-white dark:bg-crumi-bg-dark text-gray-900 dark:text-white
     placeholder:text-gray-400 dark:placeholder:text-gray-500
     ${touched && err ? 'border-red-400 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-crumi-accent'}`;

  return (
    <form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }} className="space-y-4">
      {/* Account type toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Tipo de cuenta
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAccountType('empresa')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors
              ${accountType === 'empresa'
                ? 'border-crumi-accent bg-crumi-accent/10 text-crumi-accent'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
              }
            `}
          >
            Empresa
          </button>
          <button
            type="button"
            onClick={() => setAccountType('contador')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors
              ${accountType === 'contador'
                ? 'border-crumi-accent bg-crumi-accent/10 text-crumi-accent'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
              }
            `}
          >
            Espacio Contador
          </button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          {accountType === 'empresa' ? 'Facturación, documentos y gestión de tu empresa' : 'Gestión de múltiples clientes y empresas'}
        </p>
      </div>

      {/* Contador-specific: first name, last name */}
      {accountType === 'contador' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
            <input
              name="firstName"
              type="text"
              placeholder="Ej: Juan"
              className={inputCls(validation.touched.firstName, validation.errors.firstName)}
              onChange={validation.handleChange}
              onBlur={validation.handleBlur}
              value={validation.values.firstName}
            />
            {validation.touched.firstName && validation.errors.firstName && (
              <span className="text-xs text-red-400 mt-0.5 block">{validation.errors.firstName}</span>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Apellido</label>
            <input
              name="lastName"
              type="text"
              placeholder="Ej: Perez"
              className={inputCls(false, undefined)}
              onChange={validation.handleChange}
              value={validation.values.lastName}
            />
          </div>
        </>
      )}

      {/* Company/Tenant name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {accountType === 'empresa' ? 'Nombre de tu empresa' : 'Nombre de tu primera empresa'}
        </label>
        <input
          name={accountType === 'empresa' ? 'tenantName' : 'companyName'}
          type="text"
          placeholder="Ej: Mi Empresa S.A.S"
          className={inputCls(
            accountType === 'empresa' ? validation.touched.tenantName : validation.touched.companyName,
            accountType === 'empresa' ? validation.errors.tenantName : validation.errors.companyName
          )}
          onChange={validation.handleChange}
          onBlur={validation.handleBlur}
          value={accountType === 'empresa' ? validation.values.tenantName : validation.values.companyName}
        />
        {accountType === 'empresa' && validation.touched.tenantName && validation.errors.tenantName && (
          <span className="text-xs text-red-400 mt-0.5 block">{validation.errors.tenantName}</span>
        )}
        {accountType === 'contador' && validation.touched.companyName && validation.errors.companyName && (
          <span className="text-xs text-red-400 mt-0.5 block">{validation.errors.companyName}</span>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Correo electrónico</label>
        <input
          name="adminEmail"
          type="email"
          placeholder="tu@email.com"
          className={inputCls(validation.touched.adminEmail, validation.errors.adminEmail)}
          onChange={validation.handleChange}
          onBlur={validation.handleBlur}
          value={validation.values.adminEmail}
        />
        {validation.touched.adminEmail && validation.errors.adminEmail && (
          <span className="text-xs text-red-400 mt-0.5 block">{validation.errors.adminEmail}</span>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
        <div className="relative">
          <input
            name="adminPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className={`${inputCls(validation.touched.adminPassword, validation.errors.adminPassword)} pr-10`}
            onChange={validation.handleChange}
            onBlur={validation.handleBlur}
            value={validation.values.adminPassword}
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {validation.touched.adminPassword && validation.errors.adminPassword && (
          <span className="text-xs text-red-400 mt-0.5 block">{validation.errors.adminPassword}</span>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loader}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold
          bg-gradient-to-r from-crumi-accent to-purple-500 text-white
          hover:shadow-lg hover:shadow-crumi-accent/25 active:scale-[0.98]
          transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loader && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {loader ? 'Creando cuenta...' : accountType === 'contador' ? 'Crear Espacio Contador' : 'Crear mi cuenta'}
      </button>

      {/* Divider */}
      <div className="relative flex items-center my-3">
        <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
        <span className="px-3 text-xs text-gray-400 dark:text-gray-500">o continúa con</span>
        <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
      </div>

      {/* Google OAuth */}
      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
          border border-gray-200 dark:border-gray-700
          bg-white dark:bg-crumi-bg-dark
          text-gray-700 dark:text-gray-300
          hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => {
          window.location.href = `${env.API_URL}/auth/google`;
        }}
      >
        <svg width="16" height="16" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
          <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
        Registrarse con Google
      </button>

      {/* Switch to login */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
        ¿Ya tienes una cuenta?{' '}
        <button
          type="button"
          className="text-crumi-accent font-semibold hover:underline"
          onClick={() => dispatch(setAuthModalView('login'))}
        >
          Inicia sesión
        </button>
      </p>
    </form>
  );
};

export default RegisterForm;
