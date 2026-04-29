// src/pages/Authentication/ResetPassword.tsx
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useFormik } from "formik";
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import logoWhite from "../../assets/images/logo/logowhite.png";
import { env } from '../../env';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [loader, setLoader] = useState<boolean>(false);
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [verifying, setVerifying] = useState<boolean>(true);

    // Verificar token al cargar
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setTokenValid(false);
                setVerifying(false);
                return;
            }

            try {
                const response = await fetch(`${env.API_URL}/auth/verify-reset-token/${token}`);
                const data = await response.json();
                setTokenValid(data.valid === true);
            } catch (error) {
                setTokenValid(false);
            } finally {
                setVerifying(false);
            }
        };

        verifyToken();
    }, [token]);

    const validation = useFormik({
        initialValues: {
            password: '',
            confirmPassword: '',
        },
        validationSchema: Yup.object({
            password: Yup.string()
                .required("Por favor ingresa una contraseña")
                .min(6, "La contraseña debe tener al menos 6 caracteres"),
            confirmPassword: Yup.string()
                .required("Por favor confirma tu contraseña")
                .oneOf([Yup.ref('password')], "Las contraseñas no coinciden"),
        }),
        onSubmit: async (values) => {
            setLoader(true);
            try {
                const response = await fetch(`${env.API_URL}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, password: values.password }),
                });

                const data = await response.json();

                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Contraseña actualizada!',
                        text: 'Tu contraseña ha sido cambiada exitosamente.',
                        confirmButtonColor: '#667eea',
                        timer: 3000,
                        timerProgressBar: true,
                    }).then(() => {
                        navigate('/login');
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.error || 'Ocurrió un error al restablecer tu contraseña.',
                        confirmButtonColor: '#667eea'
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudo conectar con el servidor.',
                    confirmButtonColor: '#667eea'
                });
            } finally {
                setLoader(false);
            }
        },
    });

    document.title = "Restablecer Contraseña | Bolti";

    // Loading state
    if (verifying) {
        return (
            <div className="crumi-auth-page">
                <style>{authCSS}</style>
                <div className="crumi-auth-container">
                    <div className="crumi-auth-form-side">
                        <div className="crumi-auth-form-content" style={{ textAlign: 'center' }}>
                            <div className="crumi-spinner-large"></div>
                            <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '1rem' }}>Verificando enlace...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Invalid token
    if (!tokenValid) {
        return (
            <div className="crumi-auth-page">
                <style>{authCSS}</style>
                <div className="crumi-auth-container">
                    <div className="crumi-auth-form-side">
                        <div className="crumi-auth-form-content">
                            <Link to="/" className="crumi-auth-logo">
                                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '1rem', display: 'inline-block' }}>Bolti</span>
                            </Link>

                            <div className="crumi-error-box">
                                <div className="crumi-error-icon">⚠️</div>
                                <h3>Enlace inválido o expirado</h3>
                                <p>Este enlace de recuperación ya no es válido. Por favor solicita uno nuevo.</p>
                                <Link to="/forgot-password" className="crumi-btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                                    Solicitar nuevo enlace
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="crumi-auth-page">
            <style>{authCSS}</style>

            <div className="crumi-auth-container">
                {/* Left Side - Form */}
                <div className="crumi-auth-form-side">
                    <div className="crumi-auth-form-content">
                        {/* Logo */}
                        <Link to="/" className="crumi-auth-logo">
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '1rem', display: 'inline-block' }}>Bolti</span>
                        </Link>

                        {/* Header */}
                        <div className="crumi-auth-header">
                            <h1>Nueva contraseña</h1>
                            <p>Crea una nueva contraseña para tu cuenta</p>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }}>
                            <div className="crumi-form-group">
                                <label htmlFor="password">Nueva contraseña</label>
                                <div className="crumi-password-input">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className={validation.touched.password && validation.errors.password ? 'error' : ''}
                                        onChange={validation.handleChange}
                                        onBlur={validation.handleBlur}
                                        value={validation.values.password || ""}
                                    />
                                    <button
                                        type="button"
                                        className="crumi-password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? '👁️' : '👁️‍🗨️'}
                                    </button>
                                </div>
                                {validation.touched.password && validation.errors.password && (
                                    <span className="crumi-form-error">{validation.errors.password}</span>
                                )}
                            </div>

                            <div className="crumi-form-group">
                                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className={validation.touched.confirmPassword && validation.errors.confirmPassword ? 'error' : ''}
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    value={validation.values.confirmPassword || ""}
                                />
                                {validation.touched.confirmPassword && validation.errors.confirmPassword && (
                                    <span className="crumi-form-error">{validation.errors.confirmPassword}</span>
                                )}
                            </div>

                            <button type="submit" className="crumi-btn-primary" disabled={loader}>
                                {loader ? (
                                    <>
                                        <span className="crumi-spinner"></span>
                                        Actualizando...
                                    </>
                                ) : (
                                    'Actualizar contraseña'
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Side - Visual */}
                <div className="crumi-auth-visual-side">
                    <div className="crumi-auth-bg">
                        <div className="crumi-auth-orb crumi-auth-orb-1"></div>
                        <div className="crumi-auth-orb crumi-auth-orb-2"></div>
                        <div className="crumi-auth-orb crumi-auth-orb-3"></div>
                    </div>

                    <div className="crumi-auth-visual-content">
                        <div className="crumi-auth-feature-card">
                            <div className="crumi-auth-feature-icon">🔑</div>
                            <h3>Crea una contraseña segura</h3>
                            <p>Usa al menos 6 caracteres combinando letras y números</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const authCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  .crumi-auth-page {
    font-family: 'Inter', -apple-system, sans-serif;
    min-height: 100vh;
    background: #0a0a0a;
    color: #fff;
  }

  .crumi-auth-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 100vh;
  }

  @media (max-width: 968px) {
    .crumi-auth-container {
      grid-template-columns: 1fr;
    }
    .crumi-auth-visual-side {
      display: none;
    }
  }

  .crumi-auth-form-side {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #0a0a0a;
  }

  .crumi-auth-form-content {
    width: 100%;
    max-width: 420px;
  }

  .crumi-auth-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: #fff;
    font-weight: 600;
    font-size: 1.25rem;
    margin-bottom: 3rem;
  }

  .crumi-auth-logo-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: grid;
    place-items: center;
    font-size: 18px;
  }

  .crumi-auth-header {
    margin-bottom: 2rem;
  }

  .crumi-auth-header h1 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    letter-spacing: -0.02em;
  }

  .crumi-auth-header p {
    color: rgba(255,255,255,0.6);
    font-size: 0.95rem;
  }

  .crumi-form-group {
    margin-bottom: 1.5rem;
  }

  .crumi-form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(255,255,255,0.9);
  }

  .crumi-form-group input[type="email"],
  .crumi-form-group input[type="password"],
  .crumi-form-group input[type="text"] {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: #fff;
    font-size: 0.95rem;
    transition: all 0.2s;
    outline: none;
  }

  .crumi-form-group input:focus {
    background: rgba(255,255,255,0.08);
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
  }

  .crumi-form-group input.error {
    border-color: #f46a6a;
  }

  .crumi-form-error {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.8rem;
    color: #f46a6a;
  }

  .crumi-password-input {
    position: relative;
  }

  .crumi-password-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1.2rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .crumi-password-toggle:hover {
    opacity: 1;
  }

  .crumi-btn-primary {
    width: 100%;
    padding: 0.85rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .crumi-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(102,126,234,0.4);
  }

  .crumi-btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .crumi-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .crumi-spinner-large {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255,255,255,0.2);
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .crumi-error-box {
    background: rgba(244,106,106,0.1);
    border: 1px solid rgba(244,106,106,0.3);
    border-radius: 16px;
    padding: 2rem;
    text-align: center;
  }

  .crumi-error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .crumi-error-box h3 {
    font-size: 1.25rem;
    margin-bottom: 0.75rem;
  }

  .crumi-error-box p {
    color: rgba(255,255,255,0.7);
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
  }

  /* RIGHT SIDE - VISUAL */
  .crumi-auth-visual-side {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }

  .crumi-auth-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .crumi-auth-orb {
    position: absolute;
    border-radius: 999px;
    filter: blur(80px);
    opacity: 0.3;
  }

  .crumi-auth-orb-1 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, #667eea, transparent 70%);
    top: -200px;
    left: -100px;
  }

  .crumi-auth-orb-2 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, #764ba2, transparent 70%);
    bottom: -150px;
    right: -100px;
  }

  .crumi-auth-orb-3 {
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, #667eea, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .crumi-auth-visual-content {
    position: relative;
    z-index: 1;
  }

  .crumi-auth-feature-card {
    background: rgba(255,255,255,0.05);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 2.5rem;
    text-align: center;
    margin-bottom: 2rem;
  }

  .crumi-auth-feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .crumi-auth-feature-card h3 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .crumi-auth-feature-card p {
    color: rgba(255,255,255,0.7);
    font-size: 0.95rem;
    line-height: 1.5;
  }
`;

export default ResetPassword;
