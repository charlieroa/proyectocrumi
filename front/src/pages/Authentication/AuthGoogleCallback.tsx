import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { setAuthorization } from "../../helpers/api_helper";
import { setToken } from "../../services/auth";
import axios from "axios";
import config from "../../config";
import { env } from '../../env';

const AuthGoogleCallback = () => {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');

        console.log('[AuthGoogleCallback] Token recibido:', token ? 'Sí' : 'No');

        if (token) {
            // 1. Guardar token en localStorage para que getToken(), getRoleFromToken() y decodeTenantId() funcionen (sidebar + Settings)
            setToken(token);
            // 2. Setear header axios globalmente
            setAuthorization(token);
            console.log('[AuthGoogleCallback] Token guardado en localStorage y configurado en headers');

            // 2. Obtener datos del usuario
            const apiUrl = config.api.API_URL || env.API_URL;
            
            // Asegurar que la URL termine correctamente
            const authMeUrl = apiUrl.endsWith('/api') 
                ? `${apiUrl}/auth/me` 
                : apiUrl.endsWith('/auth/me') 
                    ? apiUrl 
                    : `${apiUrl}/auth/me`;
            
            console.log('[AuthGoogleCallback] Llamando a:', authMeUrl);
            
            axios.get(authMeUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(response => {
                    console.log('[AuthGoogleCallback] Respuesta de /auth/me:', response.data);
                    
                    // Manejar diferentes formatos de respuesta
                    const data = response.data?.data || response.data || response;
                    const user = data.user || data;
                    // Por defecto, asumimos que la configuración NO está completa (más seguro para usuarios nuevos)
                    const setup_complete = data.setup_complete !== undefined ? data.setup_complete : false;

                    console.log('[AuthGoogleCallback] setup_complete:', setup_complete);
                    console.log('[AuthGoogleCallback] user:', user);

                    if (!user) {
                        console.warn('[AuthGoogleCallback] Usuario no encontrado en la respuesta, pero continuando con el token');
                    }

                    const authUser = {
                        message: "Login Successful",
                        token: token,
                        user: user || { email: 'user@example.com' }, // Fallback: debe incluir tenant_id y role_id para sidebar y Settings
                        setup_complete: setup_complete
                    };

                    // Guardar en sessionStorage (fallback para tenant_id si el JWT no se decodifica)
                    sessionStorage.setItem('authUser', JSON.stringify(authUser));
                    console.log('[AuthGoogleCallback] Usuario guardado en sessionStorage');

                    // 3. Redirigir según el estado del usuario
                    // Usar replace: true para evitar que el usuario pueda volver atrás al callback
                    // Si setup_complete es false (o no está definido), redirigir a settings
                    if (setup_complete === false) {
                        console.log('[AuthGoogleCallback] Redirigiendo a /settings (setup incompleto)');
                        navigate("/settings", { replace: true });
                    } else {
                        console.log('[AuthGoogleCallback] Redirigiendo a /dashboard (setup completo)');
                        navigate("/dashboard", { replace: true });
                    }
                })
                .catch(err => {
                    console.error("[AuthGoogleCallback] Error fetching profile:", err);
                    console.error("[AuthGoogleCallback] Error details:", err.response?.data || err.message);
                    
                    // Si hay error al obtener el perfil, asumimos que es un usuario nuevo
                    // y redirigimos a settings para completar la configuración
                    setToken(token);
                    const authUser = {
                        message: "Login Successful",
                        token: token,
                        user: { email: 'user@example.com' },
                        setup_complete: false
                    };
                    sessionStorage.setItem('authUser', JSON.stringify(authUser));
                    console.log('[AuthGoogleCallback] Usuario guardado en sessionStorage (modo error)');
                    
                    // Redirigir a settings para completar la configuración
                    console.log('[AuthGoogleCallback] Redirigiendo a /settings (error al obtener perfil)');
                    navigate("/settings", { replace: true });
                });

        } else {
            // No hay token, redirigir al login con error
            console.error('[AuthGoogleCallback] No se encontró token en la URL');
            navigate('/login?error=Invalid+google+token', { replace: true });
        }
    }, [location, navigate]);

    return (
        <div className="d-flex justify-content-center align-items-center vh-100 flex-column">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Autenticando con Google...</p>
        </div>
    );
};

export default AuthGoogleCallback;
