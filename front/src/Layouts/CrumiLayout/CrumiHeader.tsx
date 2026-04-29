import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Menu, Moon, Sun, Search, LogIn, PanelLeftClose, PanelLeftOpen, CalendarDays, Puzzle, type LucideIcon } from 'lucide-react';
import { isAuthenticated } from '../../services/auth';
import TenantSwitcher from '../../Components/Common/TenantSwitcher';
import ProfileDropdown from '../../Components/Common/ProfileDropdown';
import { openAuthModal } from '../../slices/authModal/authModalSlice';
import CalendarPanel from '../../Components/Reminders/CalendarPanel';
import AlarmBellDropdown from '../../Components/Reminders/AlarmBellDropdown';
import { useTenantLogo } from '../../hooks/useTenantLogo';

interface CrumiHeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onToggleMobileSidebar: () => void;
  sidebarExpanded?: boolean;
  onToggleSidebar?: () => void;
}

// Route title mapping
const routeTitles: Record<string, string> = {
  '/dashboard': 'Chat',
  '/chat': 'Chat',
  '/ingresos/documentos': 'Documentos',
  '/ingresos/factura-venta': 'Documentos',
  '/ingresos/nuevo': 'Nuevo Documento',
  '/ingresos/factura-venta/crear': 'Nuevo Documento',
  '/clientes': 'Clientes',
  '/contabilidad': 'Contabilidad',
  '/nomina': 'Nómina',
  '/mi-portal': 'Mi Portal',
  '/settings': 'Configuración',
  '/tasks/kanban': 'Kanban',
  '/payroll': 'Nómina',
  '/empresas': 'Empresas',
  '/contadores': 'Espacios Contador',
  '/calendar': 'Calendario',
  '/inventory': 'Productos y servicios',
  '/contabilidad/productos-servicios': 'Productos y servicios',
  '/checkout': 'Punto de Venta',
  '/onboarding': 'Asistente IA',
};

const getPageTitle = (pathname: string): string => {
  // Exact match first
  if (routeTitles[pathname]) return routeTitles[pathname];
  // Prefix match
  for (const [route, title] of Object.entries(routeTitles)) {
    if (pathname.startsWith(route)) return title;
  }
  return '';
};

type HeaderTab = 'calendario' | 'extensiones';

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 3).trimEnd() + '...';
}

const CrumiHeader: React.FC<CrumiHeaderProps> = ({
  darkMode,
  onToggleDarkMode,
  onToggleMobileSidebar,
  sidebarExpanded,
  onToggleSidebar,
}) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const pageTitle = getPageTitle(location.pathname);
  const loggedIn = isAuthenticated();
  const { tenantName } = useTenantLogo();
  const [activeTab, setActiveTab] = useState<HeaderTab | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Click-outside to close panels
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setActiveTab(null);
      }
    };
    if (activeTab) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activeTab]);

  const toggleTab = (key: HeaderTab) => {
    setActiveTab(prev => (prev === key ? null : key));
  };

  return (
    <header
      className={`
        relative flex items-center justify-between h-header px-6 shrink-0
        transition-colors
        ${darkMode
          ? 'bg-crumi-surface-dark border-b border-crumi-border-dark'
          : 'bg-white border-b border-crumi-border-light'
        }
      `}
    >
      {/* Left side - Brand */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Mobile hamburger */}
        <button
          onClick={onToggleMobileSidebar}
          className={`lg:hidden p-2 rounded-xl transition-colors
            ${darkMode ? 'hover:bg-crumi-surface-dark-hover text-crumi-text-dark-muted' : 'hover:bg-crumi-bg-light text-crumi-text-muted'}
          `}
        >
          <Menu size={20} />
        </button>

        {/* Sidebar toggle */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`hidden lg:flex p-2 rounded-xl transition-colors
              ${darkMode ? 'hover:bg-crumi-surface-dark-hover text-crumi-text-dark-muted' : 'hover:bg-crumi-bg-light text-crumi-text-muted'}
            `}
            title={sidebarExpanded ? 'Contraer sidebar' : 'Expandir sidebar'}
          >
            {sidebarExpanded ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
        )}

        {/* Page title on mobile */}
        {pageTitle && (
          <span className={`text-sm font-semibold sm:hidden ${darkMode ? 'text-white' : 'text-crumi-text-primary'}`}>
            {pageTitle}
          </span>
        )}
      </div>

      {/* Center - Pill tabs */}
      <div ref={panelRef} className="hidden md:flex items-center justify-center flex-1">
        <div className="relative">
          <div className={`flex items-center gap-1 p-1 rounded-full ${darkMode ? 'bg-crumi-bg-dark' : 'bg-crumi-bg-light'}`}>
            {([
              { key: 'calendario' as HeaderTab, label: `Calendario${tenantName ? ` (${truncateName(tenantName, 16)})` : ''}`, icon: CalendarDays },
              { key: 'extensiones' as HeaderTab, label: 'Extensiones', icon: Puzzle },
            ]).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => toggleTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200
                    ${activeTab === tab.key
                      ? 'bg-[#1A1D1F] text-white'
                      : darkMode
                        ? 'text-gray-500 hover:text-gray-300'
                        : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Calendar panel */}
          {activeTab === 'calendario' && <CalendarPanel darkMode={darkMode} />}

          {/* Extensions placeholder */}
          {activeTab === 'extensiones' && (
            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 border rounded-2xl shadow-xl px-8 py-6 text-center
              ${darkMode ? 'bg-crumi-surface-dark border-crumi-border-dark' : 'bg-white border-crumi-border-light'}
            `}>
              <Puzzle size={28} className={darkMode ? 'text-crumi-text-dark-muted mx-auto mb-2' : 'text-crumi-text-muted mx-auto mb-2'} />
              <p className={`text-sm font-semibold ${darkMode ? 'text-crumi-text-dark-primary' : 'text-crumi-text-primary'}`}>
                Próximamente
              </p>
              <p className={`text-xs mt-1 ${darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted'}`}>
                Las extensiones estarán disponibles pronto.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Search + controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search bar */}
        <div className="hidden lg:flex">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors
            ${darkMode
              ? 'bg-crumi-bg-dark border-crumi-border-dark'
              : 'bg-crumi-bg-light border-crumi-border-light'
            }
          `}>
            <Search size={14} className={darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted'} />
            <input
              type="text"
              placeholder="Buscar..."
              className={`w-36 bg-transparent border-none outline-none text-sm
                ${darkMode ? 'text-crumi-text-dark-primary placeholder:text-crumi-text-dark-muted' : 'text-crumi-text-primary placeholder:text-crumi-text-muted'}
              `}
            />
          </div>
        </div>

        {/* Alarm bell */}
        <AlarmBellDropdown darkMode={darkMode} />

        {/* Dark mode toggle */}
        <button
          onClick={onToggleDarkMode}
          className={`p-2.5 rounded-xl transition-colors
            ${darkMode
              ? 'hover:bg-crumi-surface-dark-hover text-crumi-text-dark-muted'
              : 'hover:bg-crumi-bg-light text-crumi-text-muted'
            }
          `}
          title={darkMode ? 'Modo claro' : 'Modo oscuro'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {loggedIn ? (
          <>
            {/* Tenant Switcher */}
            <div className="legacy-wrapper">
              <TenantSwitcher />
            </div>
            {/* Profile dropdown */}
            <div className="legacy-wrapper">
              <ProfileDropdown />
            </div>
          </>
        ) : (
          /* Login button */
          <button
            onClick={() => dispatch(openAuthModal('login'))}
            className="flex items-center gap-2 px-4 py-2 rounded-full
              bg-crumi-primary text-white text-sm font-semibold
              hover:shadow-crumi-lg active:scale-95
              transition-all duration-200"
          >
            <LogIn size={16} />
            <span>Iniciar sesión</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default CrumiHeader;
