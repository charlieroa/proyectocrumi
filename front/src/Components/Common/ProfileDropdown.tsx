import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle, Spinner } from 'reactstrap';
import { User, LogOut, Settings } from 'lucide-react';

// Importamos nuestros helpers de autenticación
import { getDecodedToken, logout } from '../../services/auth';
import api from '../../services/api';

import logoWhite from "../../assets/images/logo/logowhite.png";

const roleMap: { [key: number]: string } = {
    1: "Administrador",
    2: "Cajero",
    3: "Estilista"
};

const ProfileDropdown = () => {
    const navigate = useNavigate();

    const [user, setUser] = useState<any | null>(null);
    const [tenantLogo, setTenantLogo] = useState<string>(logoWhite);
    const [, setCashSession] = useState<any | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [isProfileDropdown, setIsProfileDropdown] = useState<boolean>(false);

    // --- MODIFICADO: Función de carga de datos más robusta ---
    const fetchProfileData = async () => {
        setLoading(true);
        const decodedToken = getDecodedToken();
        const userId = decodedToken?.user?.id;
        const tenantId = decodedToken?.user?.tenant_id;

        if (userId) {
            try {
                const [userRes, tenantRes, cashRes] = await Promise.allSettled([
                    api.get(`/users/${userId}`),
                    tenantId ? api.get(`/tenants/${tenantId}`) : Promise.reject({ noTenant: true }),
                    api.get('/cash/current').catch(() => null)
                ]);

                if (userRes.status === 'fulfilled') {
                    setUser(userRes.value.data);
                    try {
                        sessionStorage.setItem('crumi-user-profile', JSON.stringify({
                            first_name: userRes.value.data.first_name,
                            last_name: userRes.value.data.last_name,
                            email: userRes.value.data.email,
                        }));
                    } catch {}
                }

                if (tenantRes.status === 'fulfilled' && tenantRes.value.data?.logo_url) {
                    const baseUrl = api.defaults.baseURL || '';
                    const logo = tenantRes.value.data.logo_url;
                    setTenantLogo(logo.startsWith('http') ? logo : `${baseUrl}${logo}`);
                } else {
                    setTenantLogo(logoWhite);
                }

                const cashData = cashRes.status === 'fulfilled' && cashRes.value ? cashRes.value.data : null;
                setCashSession(cashData ?? null);
            } catch (error) {
                console.error("Error al cargar datos para el perfil:", error);
            }
        }
        setLoading(false);
    };
    
    // --- MODIFICADO: useEffect ahora también escucha eventos ---
    useEffect(() => {
        // Carga los datos la primera vez que el componente aparece
        fetchProfileData();

        // Escucha el "anuncio" que envían los modales de caja
        const handleCashSessionChange = () => {
            console.log("Evento 'cashSessionChanged' detectado. Recargando datos...");
            fetchProfileData();
        };
        
        window.addEventListener('cashSessionChanged', handleCashSessionChange);

        // Limpia el listener cuando el componente se desmonta
        return () => {
            window.removeEventListener('cashSessionChanged', handleCashSessionChange);
        };
    }, []);

    // --- Lógica de visualización (sin cambios) ---
    const userName = useMemo(() => user?.first_name || "Usuario", [user]);
    const userRole = useMemo(() => user?.role_id, [user]);
    const roleName = useMemo(() => userRole ? roleMap[userRole] || "Usuario" : "Usuario", [userRole]);

    const toggleProfileDropdown = () => { setIsProfileDropdown(!isProfileDropdown); };
    const handleLogout = () => { logout(); window.location.href = "/"; };

    return (
        <React.Fragment>
            <Dropdown isOpen={isProfileDropdown} toggle={toggleProfileDropdown} className="ms-sm-3 header-item topbar-user">
                <DropdownToggle tag="button" type="button" className="btn shadow-none">
                    <span className="d-flex align-items-center">
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#1C1C36',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            padding: '4px'
                        }}>
                            <img 
                                className="header-profile-user" 
                                src={tenantLogo} 
                                alt="Logo Bolti" 
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain'
                                }}
                            />
                        </div>
                        <span className="text-start ms-xl-2">
                            <span className="d-none d-xl-inline-block ms-1 fw-medium user-name-text">{loading ? <Spinner size="sm"/> : userName}</span>
                            <span className="d-none d-xl-block ms-1 fs-12 text-muted user-name-sub-text">{roleName}</span>
                        </span>
                    </span>
                </DropdownToggle>
                <DropdownMenu className="dropdown-menu-end">
                    <h6 className="dropdown-header">¡Hola, {userName}!</h6>
                    <DropdownItem href="/settings">
                        <User size={16} className="text-muted align-middle me-2" style={{ display: 'inline' }} />
                        <span className="align-middle">Mi Perfil</span>
                    </DropdownItem>
                    <DropdownItem href="/settings">
                        <Settings size={16} className="text-muted align-middle me-2" style={{ display: 'inline' }} />
                        <span className="align-middle">Configuración</span>
                    </DropdownItem>
                    <div className="dropdown-divider"></div>
                    <DropdownItem onClick={handleLogout}>
                        <LogOut size={16} className="text-muted align-middle me-2" style={{ display: 'inline' }} />
                        <span className="align-middle" data-key="t-logout">Cerrar Sesión</span>
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>
        </React.Fragment>
    );
};

export default ProfileDropdown;