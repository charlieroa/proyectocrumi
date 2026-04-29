// src/pages/Authentication/ForgotPassword.tsx
import React, { useState } from 'react';
import { Link } from "react-router-dom";
import * as Yup from "yup";
import { useFormik } from "formik";
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import logoWhite from "../../assets/images/logo/logowhite.png";
import { env } from '../../env';

const ForgotPassword = () => {
    const [loader, setLoader] = useState<boolean>(false);
    const [emailSent, setEmailSent] = useState<boolean>(false);

    const validation = useFormik({
        initialValues: {
            email: '',
        },
        validationSchema: Yup.object({
            email: Yup.string().required("Por favor ingresa tu email").email("Email inválido"),
        }),
        onSubmit: async (values) => {
            setLoader(true);
            try {
                const response = await fetch(`${env.API_URL}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: values.email }),
                });

                const data = await response.json();

                if (response.ok) {
                    setEmailSent(true);
                    Swal.fire({
                        icon: 'success',
                        title: '¡Correo enviado!',
                        text: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.',
                        confirmButtonColor: '#667eea'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.error || 'Ocurrió un error al procesar tu solicitud.',
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

    document.title = "Recuperar Contraseña | Bolti";

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
                            <h1>Recuperar contraseña</h1>
                            <p>Te enviaremos un enlace para restablecer tu contraseña</p>
                        </div>

                        {emailSent ? (
                            <div className="crumi-success-box">
                                <div className="crumi-success-icon">✉️</div>
                                <h3>¡Revisa tu correo!</h3>
                                <p>Si el email está registrado, recibirás un enlace para restablecer tu contraseña.</p>
                                <Link to="/login" className="crumi-btn-secondary">
                                    Volver al inicio de sesión
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={(e) => { e.preventDefault(); validation.handleSubmit(); }}>
                                <div className="crumi-form-group">
                                    <label htmlFor="email">Correo electrónico</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="tu@email.com"
                                        className={validation.touched.email && validation.errors.email ? 'error' : ''}
                                        onChange={validation.handleChange}
                                        onBlur={validation.handleBlur}
                                        value={validation.values.email || ""}
                                    />
                                    {validation.touched.email && validation.errors.email && (
                                        <span className="crumi-form-error">{validation.errors.email}</span>
                                    )}
                                </div>

                                <button type="submit" className="crumi-btn-primary" disabled={loader}>
                                    {loader ? (
                                        <>
                                            <span className="crumi-spinner"></span>
                                            Enviando...
                                        </>
                                    ) : (
                                        'Enviar enlace de recuperación'
                                    )}
                                </button>

                                <div className="crumi-auth-footer">
                                    <p><Link to="/login">← Volver al inicio de sesión</Link></p>
                                </div>
                            </form>
                        )}
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
                            <div className="crumi-auth-feature-icon">🔐</div>
                            <h3>Tu seguridad es importante</h3>
                            <p>Te enviaremos un enlace seguro para que puedas crear una nueva contraseña</p>
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

  .crumi-btn-secondary {
    display: inline-block;
    padding: 0.85rem 1.5rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #fff;
    text-decoration: none;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .crumi-btn-secondary:hover {
    background: rgba(255,255,255,0.1);
  }

  .crumi-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .crumi-auth-footer {
    margin-top: 2rem;
    text-align: center;
  }

  .crumi-auth-footer p {
    font-size: 0.875rem;
    color: rgba(255,255,255,0.6);
  }

  .crumi-auth-footer a {
    color: #667eea;
    text-decoration: none;
    font-weight: 600;
  }

  .crumi-auth-footer a:hover {
    color: #764ba2;
  }

  .crumi-success-box {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 2rem;
    text-align: center;
  }

  .crumi-success-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .crumi-success-box h3 {
    font-size: 1.25rem;
    margin-bottom: 0.75rem;
  }

  .crumi-success-box p {
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

export default ForgotPassword;
