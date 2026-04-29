import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { createSelector } from 'reselect';
import Swal from 'sweetalert2';
import { Eye, EyeOff } from 'lucide-react';

import { loginUser, resetLoginFlag } from '../../slices/thunks';
import { closeAuthModal, setAuthModalView } from '../../slices/authModal/authModalSlice';
import { env } from '../../env';

const LoginForm: React.FC = () => {
  const dispatch: any = useDispatch();
  const navigate = useNavigate();

  const loginpageData = createSelector(
    (state: any) => state,
    (state) => ({
      error: state.Login.error,
      errorMsg: state.Login.errorMsg,
    })
  );

  const { error, errorMsg } = useSelector(loginpageData);

  const [showPassword, setShowPassword] = useState(false);
  const [loader, setLoader] = useState(false);

  // Clear any stale login errors on mount
  useEffect(() => {
    dispatch(resetLoginFlag());
  }, [dispatch]);

  const validation = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: Yup.object({
      email: Yup.string().required('Por favor ingresa tu email'),
      password: Yup.string().required('Por favor ingresa tu contraseña'),
    }),
    onSubmit: (values) => {
      setLoader(true);
      // The navigate callback: close modal + reload so the app picks up the token
      const onNavigate = (path: string) => {
        dispatch(closeAuthModal());
        window.location.replace(path || '/dashboard');
      };
      dispatch(loginUser(values, onNavigate));
    },
  });

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => {
        dispatch(resetLoginFlag());
        setLoader(false);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [dispatch, errorMsg]);

  useEffect(() => {
    if (errorMsg) {
      setLoader(false);
      let msg = typeof error === 'string' ? error : (error?.error || error?.message || 'Error al iniciar sesión');
      if (typeof errorMsg === 'string') msg = errorMsg;

      Swal.fire({
        icon: 'error',
        title: 'Error de Inicio de Sesión',
        text: msg,
        confirmButtonColor: '#7F3AFB',
      });
    }
  }, [error, errorMsg]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }} className="space-y-4">
      {/* Email */}
      <div>
        <label htmlFor="login-email" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Correo electrónico
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          className={`w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors
            bg-white dark:bg-crumi-bg-dark
            text-gray-900 dark:text-white
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            ${validation.touched.email && validation.errors.email
              ? 'border-red-400 focus:border-red-500'
              : 'border-gray-200 dark:border-gray-700 focus:border-crumi-accent'
            }
          `}
          onChange={validation.handleChange}
          onBlur={validation.handleBlur}
          value={validation.values.email}
        />
        {validation.touched.email && validation.errors.email && (
          <span className="text-xs text-red-400 mt-0.5 block">{validation.errors.email}</span>
        )}
      </div>

      {/* Password */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="login-password" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Contraseña
          </label>
          <button
            type="button"
            className="text-xs text-crumi-accent hover:underline"
            onClick={() => {
              dispatch(closeAuthModal());
              navigate('/forgot-password');
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className={`w-full px-3 py-2 pr-10 rounded-lg text-sm border outline-none transition-colors
              bg-white dark:bg-crumi-bg-dark
              text-gray-900 dark:text-white
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              ${validation.touched.password && validation.errors.password
                ? 'border-red-400 focus:border-red-500'
                : 'border-gray-200 dark:border-gray-700 focus:border-crumi-accent'
              }
            `}
            onChange={validation.handleChange}
            onBlur={validation.handleBlur}
            value={validation.values.password}
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {validation.touched.password && validation.errors.password && (
          <span className="text-xs text-red-400 mt-0.5 block">{validation.errors.password}</span>
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
        {loader ? 'Ingresando...' : 'Iniciar sesión'}
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
          window.location.href = `${env.API_URL || 'http://localhost:5000'}/auth/google`;
        }}
      >
        <svg width="16" height="16" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
          <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
        Continuar con Google
      </button>

      {/* Switch to register */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
        ¿No tienes una cuenta?{' '}
        <button
          type="button"
          className="text-crumi-accent font-semibold hover:underline"
          onClick={() => dispatch(setAuthModalView('register'))}
        >
          Regístrate gratis
        </button>
      </p>
    </form>
  );
};

export default LoginForm;
