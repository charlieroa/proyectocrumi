// Registro público de Contador (desde landing / #contador)
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { api } from '../../services/api';
import { setToken } from '../../services/auth';
import logoWhite from '../../assets/images/logo/logowhite.png';

const RegisterContador = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    companyName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Nombre obligatorio';
    if (!form.email.trim()) e.email = 'Email obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
    if (!form.password) e.password = 'Contraseña obligatoria';
    else if (form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/register-contador', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
        companyName: form.companyName.trim() || undefined,
      });

      if (res.data?.token) {
        setToken(res.data.token);
        const authUser = {
          message: "Login Successful",
          token: res.data.token,
          user: res.data.user || { email: form.email },
          setup_complete: false
        };
        sessionStorage.setItem("authUser", JSON.stringify(authUser));
        await Swal.fire({
          icon: 'success',
          title: '¡Cuenta creada!',
          text: 'Bienvenido a Bolti. Serás redirigido a configuración.',
          confirmButtonColor: '#667eea',
          timer: 2000,
          timerProgressBar: true,
        });
        window.location.replace('/settings');
        return;
      }

      await Swal.fire({
        icon: 'success',
        title: '¡Cuenta creada!',
        text: 'Ya puedes iniciar sesión. Serás redirigido al login.',
        confirmButtonColor: '#667eea',
        timer: 3000,
        timerProgressBar: true,
      });
      navigate('/login');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Error al crear la cuenta. Intenta de nuevo.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#667eea' });
    } finally {
      setLoading(false);
    }
  };

  document.title = 'Registro Contador | Bolti';

  return (
    <div className="crumi-auth-page">
      <style>{authCSS}</style>
      <div className="crumi-auth-container">
        <div className="crumi-auth-form-side">
          <div className="crumi-auth-form-content">
            <Link to="/" className="crumi-auth-logo">
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '1rem', display: 'inline-block' }}>Bolti</span>
            </Link>
            <div className="crumi-auth-header">
              <h1>Registro para contadores</h1>
              <p>Gestiona varias empresas, marca blanca y más. Crea tu cuenta y empieza.</p>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="crumi-form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  placeholder="Ej. Juan"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className={errors.firstName ? 'error' : ''}
                />
                {errors.firstName && <span className="crumi-form-error">{errors.firstName}</span>}
              </div>
              <div className="crumi-form-group">
                <label>Apellido</label>
                <input
                  type="text"
                  placeholder="Ej. Pérez"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
              <div className="crumi-form-group">
                <label>Correo electrónico *</label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && <span className="crumi-form-error">{errors.email}</span>}
              </div>
              <div className="crumi-form-group">
                <label>Contraseña *</label>
                <div className="crumi-password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className={errors.password ? 'error' : ''}
                  />
                  <button type="button" className="crumi-password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && <span className="crumi-form-error">{errors.password}</span>}
              </div>
              <div className="crumi-form-group">
                <label>Nombre de tu primera empresa (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Mi Contaduría"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                />
              </div>
              <button type="submit" className="crumi-btn-primary" disabled={loading}>
                {loading ? <><span className="crumi-spinner" /> Creando cuenta...</> : 'Registrarme'}
              </button>
              <div className="crumi-auth-footer">
                <p>¿Ya tienes cuenta? <Link to="/login">Ingresar</Link></p>
                <p><Link to="/#contador">Volver a Contador</Link> · <Link to="/">Inicio</Link></p>
              </div>
            </form>
          </div>
        </div>
        <div className="crumi-auth-visual-side">
          <div className="crumi-auth-bg">
            <div className="crumi-auth-orb crumi-auth-orb-1" />
            <div className="crumi-auth-orb crumi-auth-orb-2" />
            <div className="crumi-auth-orb crumi-auth-orb-3" />
          </div>
          <div className="crumi-auth-visual-content">
            <div className="crumi-auth-feature-card">
              <div className="crumi-auth-feature-icon">📊</div>
              <h3>Para contadores</h3>
              <p>Varias empresas, marca blanca, equipo y documentos. Todo en un solo lugar.</p>
            </div>
            <div className="crumi-auth-stats">
              <div className="crumi-auth-stat"><div className="crumi-auth-stat-value">Multi</div><div className="crumi-auth-stat-label">Empresas</div></div>
              <div className="crumi-auth-stat"><div className="crumi-auth-stat-value">24/7</div><div className="crumi-auth-stat-label">Disponible</div></div>
              <div className="crumi-auth-stat"><div className="crumi-auth-stat-value">IA</div><div className="crumi-auth-stat-label">Inteligente</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const authCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .crumi-auth-page { font-family: 'Inter', -apple-system, sans-serif; min-height: 100vh; background: #0a0a0a; color: #fff; }
  .crumi-auth-container { display: grid; grid-template-columns: 1fr 1fr; min-height: 100vh; }
  @media (max-width: 968px) { .crumi-auth-container { grid-template-columns: 1fr; } .crumi-auth-visual-side { display: none; } }
  .crumi-auth-form-side { display: flex; align-items: center; justify-content: center; padding: 2rem; background: #0a0a0a; }
  .crumi-auth-form-content { width: 100%; max-width: 420px; }
  .crumi-auth-logo { display: inline-block; text-decoration: none; margin-bottom: 1rem; }
  .crumi-auth-header { margin-bottom: 2rem; }
  .crumi-auth-header h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
  .crumi-auth-header p { color: rgba(255,255,255,0.6); font-size: 0.95rem; }
  .crumi-form-group { margin-bottom: 1.5rem; }
  .crumi-form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; color: rgba(255,255,255,0.9); }
  .crumi-form-group input { width: 100%; padding: 0.75rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #fff; font-size: 0.95rem; outline: none; }
  .crumi-form-group input:focus { background: rgba(255,255,255,0.08); border-color: #667eea; }
  .crumi-form-group input.error { border-color: #f46a6a; }
  .crumi-form-error { display: block; margin-top: 0.35rem; font-size: 0.8rem; color: #f46a6a; }
  .crumi-password-input { position: relative; }
  .crumi-password-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0.25rem; font-size: 1.2rem; opacity: 0.6; }
  .crumi-btn-primary { width: 100%; padding: 0.85rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
  .crumi-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(102,126,234,0.4); }
  .crumi-btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
  .crumi-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: crumi-spin 0.6s linear infinite; }
  @keyframes crumi-spin { to { transform: rotate(360deg); } }
  .crumi-auth-footer { margin-top: 2rem; text-align: center; }
  .crumi-auth-footer p { font-size: 0.875rem; color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; }
  .crumi-auth-footer a { color: #667eea; text-decoration: none; font-weight: 600; }
  .crumi-auth-footer a:hover { color: #764ba2; }
  .crumi-auth-visual-side { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 3rem; }
  .crumi-auth-bg { position: absolute; inset: 0; pointer-events: none; }
  .crumi-auth-orb { position: absolute; border-radius: 999px; filter: blur(80px); opacity: 0.3; }
  .crumi-auth-orb-1 { width: 500px; height: 500px; background: radial-gradient(circle, #667eea, transparent 70%); top: -200px; left: -100px; }
  .crumi-auth-orb-2 { width: 400px; height: 400px; background: radial-gradient(circle, #764ba2, transparent 70%); bottom: -150px; right: -100px; }
  .crumi-auth-orb-3 { width: 300px; height: 300px; background: radial-gradient(circle, #667eea, transparent 70%); top: 50%; left: 50%; transform: translate(-50%, -50%); }
  .crumi-auth-visual-content { position: relative; z-index: 1; }
  .crumi-auth-feature-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 2.5rem; text-align: center; margin-bottom: 2rem; }
  .crumi-auth-feature-icon { font-size: 3rem; margin-bottom: 1rem; }
  .crumi-auth-feature-card h3 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; }
  .crumi-auth-feature-card p { color: rgba(255,255,255,0.7); font-size: 0.95rem; line-height: 1.5; }
  .crumi-auth-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
  .crumi-auth-stat { text-align: center; padding: 1.5rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
  .crumi-auth-stat-value { font-size: 2rem; font-weight: 700; background: linear-gradient(90deg, #667eea, #764ba2); -webkit-background-clip: text; background-clip: text; color: transparent; margin-bottom: 0.35rem; }
  .crumi-auth-stat-label { font-size: 0.875rem; color: rgba(255,255,255,0.6); }
`;

export default RegisterContador;
