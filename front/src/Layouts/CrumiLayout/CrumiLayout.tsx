import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CrumiSidebar from './CrumiSidebar';
import CrumiHeader from './CrumiHeader';
import ComplianceBanner from '../../Components/Common/ComplianceBanner';
import ConversationPanel from './ConversationPanel';
import FloatingChat from './FloatingChat';
import { ErrorBoundary } from '../../Components/Common/ErrorBoundary';
import AuthModal from '../../Components/Auth/AuthModal';
import { api } from '../../services/api';
import { getToken, isAuthenticated } from '../../services/auth';
import { jwtDecode } from 'jwt-decode';
import Swal from 'sweetalert2';

interface CrumiLayoutProps {
  children: React.ReactNode;
}

// Routes where the main area should have no padding (chat fills 100%)
const noPaddingRoutes = ['/dashboard', '/chat', '/mensajeria'];

const CrumiLayout: React.FC<CrumiLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Track if Set de Pruebas DIAN is approved (skip setup nag)
  const [testSetApproved, setTestSetApproved] = useState(false);

  // Sidebar expanded/collapsed
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const stored = localStorage.getItem('crumi-sidebar-expanded');
    return stored === 'true';
  });

  // Conversation panel state
  const [conversationPanelOpen, setConversationPanelOpen] = useState(false);

  // Dark mode persisted in localStorage
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('crumi-dark-mode');
    return stored !== null ? stored === 'true' : false; // default light
  });

  // Mobile sidebar
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Persist sidebar expanded
  useEffect(() => {
    localStorage.setItem('crumi-sidebar-expanded', String(sidebarExpanded));
  }, [sidebarExpanded]);

  // Persist and apply dark mode
  useEffect(() => {
    localStorage.setItem('crumi-dark-mode', String(darkMode));
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      document.body.setAttribute('data-bs-theme', 'dark');
    } else {
      root.classList.remove('dark');
      document.body.setAttribute('data-bs-theme', 'light');
    }
  }, [darkMode]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Cache active_modules on every authenticated page load
  useEffect(() => {
    if (!isAuthenticated()) return;
    const fetchModules = async () => {
      try {
        const token = getToken();
        if (!token) return;
        const decoded: any = jwtDecode(token);
        const tenantId = decoded?.user?.tenant_id || decoded?.tenant_id;
        if (!tenantId) return;
        const tenantRes = await api.get(`/tenants/${tenantId}`);
        if (tenantRes.data?.active_modules) {
          localStorage.setItem('crumi-active-modules', JSON.stringify(tenantRes.data.active_modules));
          window.dispatchEvent(new Event('crumi-modules-changed'));
        }
      } catch { /* silent */ }
    };
    fetchModules();
  }, []);

  // Setup check (migrated from old Layout) - skip when not authenticated
  useEffect(() => {
    if (!isAuthenticated()) return;

    const exemptRoutes = ['/settings', '/login', '/register', '/register-tenant', '/register-contador', '/forgot-password', '/auth-google-callback', '/empresas', '/contadores', '/tasks/kanban'];
    if (exemptRoutes.some(r => location.pathname.startsWith(r))) return;

    try {
      const token = getToken();
      if (token) {
        const decoded: any = jwtDecode(token);
        const roleId = Number(decoded?.user?.role_id);
        if (roleId === 99 || roleId === 3 || roleId === 4) return;
      }
    } catch (e) { /* ignore */ }

    const checkSetup = async () => {
      try {
        // Primero verificar si el Set de Pruebas ya fue aprobado
        try {
          const testSetRes = await api.get('/aliaddo/test-set/status');
          if (testSetRes.data?.success && (testSetRes.data.status === 'APROBADO' || testSetRes.data.status === 'ENVIADO')) {
            setTestSetApproved(testSetRes.data.status === 'APROBADO');
            return; // No forzar configuración si ya pasó el set de pruebas
          }
        } catch { /* si falla, continuar con el check normal */ }

        // También verificar si el tenant optó por no necesitar facturación electrónica
        try {
          const token = getToken();
          if (token) {
            const decoded: any = jwtDecode(token);
            const tenantId = decoded?.user?.tenant_id || decoded?.tenant_id;
            if (tenantId) {
              const tenantRes = await api.get(`/tenants/${tenantId}`);
              // Cache active_modules for sidebar filtering
              if (tenantRes.data?.active_modules) {
                localStorage.setItem('crumi-active-modules', JSON.stringify(tenantRes.data.active_modules));
              }
              if (tenantRes.data?.needs_electronic_invoice === false) {
                return; // No forzar configuración si no necesita facturación electrónica
              }
            }
          }
        } catch { /* silent */ }

        const { data } = await api.get('/tenants/setup-status');
        if (data && data.isConfigured === false) {
          Swal.fire({
            title: 'Configuración Incompleta',
            text: 'Debes completar la información de tu empresa antes de continuar.',
            icon: 'info',
            confirmButtonText: 'Completar ahora',
            allowOutsideClick: false,
            allowEscapeKey: false
          }).then(() => navigate('/settings'));
        }
      } catch { /* silent */ }
    };
    checkSetup();
  }, [location.pathname, navigate]);

  const toggleDarkMode = useCallback(() => setDarkMode(prev => !prev), []);
  const toggleMobileSidebar = useCallback(() => setMobileSidebarOpen(prev => !prev), []);
  const toggleConversationPanel = useCallback(() => setConversationPanelOpen(prev => !prev), []);
  const toggleSidebarExpanded = useCallback(() => setSidebarExpanded(prev => !prev), []);

  const isChatRoute = noPaddingRoutes.some(r => location.pathname === r);

  return (
    <div className={`flex h-screen h-[100dvh] overflow-hidden font-sans ${darkMode ? 'dark bg-crumi-bg-dark' : 'bg-crumi-bg-light'}`}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <CrumiSidebar
        isMobileOpen={mobileSidebarOpen}
        darkMode={darkMode}
        expanded={sidebarExpanded}
        onToggleExpand={toggleSidebarExpanded}
        onMobileClose={() => setMobileSidebarOpen(false)}
        onToggleConversationPanel={toggleConversationPanel}
        conversationPanelOpen={conversationPanelOpen}
        testSetApproved={testSetApproved}
      />

      {/* Conversation Panel */}
      <ConversationPanel
        isOpen={conversationPanelOpen}
        darkMode={darkMode}
        onClose={() => setConversationPanelOpen(false)}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <CrumiHeader
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onToggleMobileSidebar={toggleMobileSidebar}
          sidebarExpanded={sidebarExpanded}
          onToggleSidebar={toggleSidebarExpanded}
        />

        {/* Banner de cumplimiento (FE / Nómina) */}
        <ComplianceBanner />

        {/* Page content */}
        <main className={`flex-1 min-h-0 ${isChatRoute ? 'flex flex-col overflow-hidden' : 'overflow-y-auto crumi-scrollbar p-4'} ${darkMode ? 'bg-crumi-bg-dark' : 'bg-crumi-bg-light'}`}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* Floating chat - only when NOT on dashboard/chat */}
      {!isChatRoute && <FloatingChat darkMode={darkMode} />}

      {/* Auth Modal (login/register) */}
      <AuthModal />
    </div>
  );
};

export default CrumiLayout;
