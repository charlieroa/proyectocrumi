import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  BookOpen,
  Building2,
  Calendar,
  Copy,
  CreditCard,
  Factory,
  FileDown,
  FileMinus,
  FilePlus,
  Filter,
  HeartPulse,
  Layers,
  Pencil,
  Search,
  Wand2,
  ChevronDown,
  ChevronRight,
  Calculator,
  CheckCircle2,
  Columns3,
  Contact,
  DollarSign,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Gavel,
  HandCoins,
  Headset,
  Landmark,
  LayoutGrid,
  Link2,
  LineChart,
  MessageSquarePlus,
  MessagesSquare,
  Receipt,
  ReceiptText,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  User,
  UserRoundCheck,
  UserSearch,
  Users,
  Users2,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import {
  getDecodedToken,
  getRoleFromToken,
  getWorkspaceMode,
  isAuthenticated,
  isContadorFullMode,
  isRealContador,
  setWorkspaceMode,
} from '../../services/auth';
import { createConversation } from '../../slices/crumiChat/chatSlice';
import { openAuthModal } from '../../slices/authModal/authModalSlice';
import { getSidebarDomains, type AppRoleId, type ErpDomain } from '../../config/erpModuleMap';

interface CrumiSidebarProps {
  isMobileOpen: boolean;
  darkMode: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onMobileClose: () => void;
  onToggleConversationPanel: () => void;
  conversationPanelOpen: boolean;
  testSetApproved?: boolean;
}

const iconMap: Record<string, React.FC<any>> = {
  'ri-layout-grid': LayoutGrid,
  'ri-layout-grid-line': LayoutGrid,
  'ri-folder-3-line': FolderOpen,
  'ri-building-2-line': Building2,
  'ri-user-search-line': UserSearch,
  'ri-team-line': UsersRound,
  'ri-group-line': Contact,
  'ri-building-line': Users,
  'ri-layout-column-line': Columns3,
  'ri-calculator-line': Calculator,
  'ri-money-dollar-box-line': DollarSign,
  'ri-settings-3-line': Settings,
  'ri-message-line': MessagesSquare,
  'ri-message-2-line': MessagesSquare,
  'ri-message-3-line': MessagesSquare,
  'ri-sparkling-line': Sparkles,
  'ri-user-line': User,
  'ri-contacts-book-line': Contact,
  'ri-checkbox-circle-line': CheckCircle2,
  'ri-shield-check-line': ShieldCheck,
  'ri-briefcase-4-line': Briefcase,
  'ri-file-list-3-line': Receipt,
  'ri-wallet-3-line': Wallet,
  'ri-links-line': Link2,
  'ri-bank-line': Landmark,
  'ri-percent-line': FileSpreadsheet,
  'ri-bill-line': ReceiptText,
  'ri-shopping-cart-2-line': ShoppingCart,
  'ri-book-2-line': BookOpen,
  'ri-government-line': Landmark,
  'ri-hand-coin-line': HandCoins,
  'ri-exchange-funds-line': TrendingUp,
  'ri-line-chart-line': LineChart,
  'ri-customer-service-2-line': Headset,
  'ri-user-star-line': UserRoundCheck,
  'ri-file-chart-line': BarChart3,
  'ri-file-paper-2-line': FileText,
  'ri-scales-3-line': Gavel,
  'ri-folder-shield-2-line': Shield,
  'ri-pencil-line': Pencil,
  'ri-search-line': Search,
  'ri-file-minus-line': FileMinus,
  'ri-file-add-line': FilePlus,
  'ri-file-text-line': FileText,
  'ri-bank-card-line': CreditCard,
  'ri-magic-line': Wand2,
  'ri-stack-line': Layers,
  'ri-building-3-line': Factory,
  'ri-file-copy-2-line': Copy,
  'ri-file-download-line': FileDown,
  'ri-calendar-2-line': Calendar,
  'ri-heart-pulse-line': HeartPulse,
  'ri-funnel-line': Filter,
};

const CrumiSidebar: React.FC<CrumiSidebarProps> = ({
  isMobileOpen,
  darkMode,
  expanded,
  onToggleExpand,
  onMobileClose,
  onToggleConversationPanel,
  conversationPanelOpen,
  testSetApproved,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const loggedIn = isAuthenticated();
  const userRole = getRoleFromToken();
  const decoded = getDecodedToken();
  const userObj = decoded?.user;
  const cachedProfile = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('crumi-user-profile') || 'null');
    } catch {
      return null;
    }
  })();

  const userName = cachedProfile?.first_name
    ? `${cachedProfile.first_name}${cachedProfile.last_name ? ` ${cachedProfile.last_name}` : ''}`
    : userObj?.first_name
      ? `${userObj.first_name}${userObj.last_name ? ` ${userObj.last_name}` : ''}`
      : userObj?.name || userObj?.email || 'Usuario';
  const userInitial = userName.charAt(0).toUpperCase();

  const canToggleWorkspace = userRole === 1 || userRole === 4;
  const workspaceMode = canToggleWorkspace ? getWorkspaceMode() : 'tenant';
  const isContador = workspaceMode === 'contador';

  const [showContadorModal, setShowContadorModal] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});
  const [modulesVersion, setModulesVersion] = useState(0);

  // Listen for active_modules changes from Settings page
  useEffect(() => {
    const handler = () => setModulesVersion((v) => v + 1);
    window.addEventListener('crumi-modules-changed', handler);
    return () => window.removeEventListener('crumi-modules-changed', handler);
  }, []);

  const domains = useMemo(() => {
    const effectiveRole = (userRole || 1) as AppRoleId;
    // Superadmin and Contador mode see everything (no module filtering)
    if (effectiveRole === 99 || isContador) return getSidebarDomains(effectiveRole);
    // Tenant mode: filter by active_modules
    try {
      const stored = localStorage.getItem('crumi-active-modules');
      const activeModules: string[] = stored ? JSON.parse(stored) : ['comercial'];
      return getSidebarDomains(effectiveRole, activeModules);
    } catch {
      return getSidebarDomains(effectiveRole, ['comercial']);
    }
  }, [userRole, isContador, modulesVersion]);

  const handleToggleWorkspace = () => {
    if (isContador) {
      setWorkspaceMode('tenant');
      window.location.reload();
      return;
    }
    if (isRealContador()) {
      setWorkspaceMode('contador');
      window.location.reload();
      return;
    }
    setShowContadorModal(true);
  };

  const confirmSwitchToContador = () => {
    setShowContadorModal(false);
    setWorkspaceMode('contador');
    window.location.reload();
  };

  const handleNewChat = () => {
    const id = `conv_${Date.now()}`;
    dispatch(createConversation({ id }));
    navigate('/dashboard');
    onMobileClose();
  };

  const toggleDomain = (domainId: string) => {
    setExpandedDomains((prev) => ({ ...prev, [domainId]: !prev[domainId] }));
  };

  const isDomainActive = (domain: ErpDomain): boolean => {
    return domain.items.some((item) => item.path && location.pathname.startsWith(item.path));
  };

  const mobileSidebarClasses = isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0';

  return (
    <>
      <aside
        style={{ width: expanded ? 240 : 80 }}
        className={`
          fixed lg:relative z-50 h-full flex flex-col shrink-0
          ${mobileSidebarClasses}
          transition-all duration-300 ease-in-out
          ${darkMode
            ? 'bg-crumi-surface-dark border-r border-crumi-border-dark'
            : 'bg-white border-r border-crumi-border-light'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center justify-center shrink-0 ${expanded ? 'px-4 py-2' : 'py-2'}`}>
          <Link to="/dashboard" className="no-underline shrink-0 flex items-center justify-center">
            <img
              src={new URL('../../assets/images/logo/logowhite.png', import.meta.url).href}
              alt="Bolti"
              style={{ height: expanded ? 40 : 32, width: 'auto', objectFit: 'contain', maxWidth: expanded ? 180 : 48 }}
            />
          </Link>
        </div>

        {/* Nuevo Mensaje = Chat IA */}
        <div className={`mb-1 shrink-0 ${expanded ? 'px-4' : 'flex justify-center'}`}>
          <button
            onClick={handleNewChat}
            className={`flex items-center justify-center rounded-2xl font-medium transition-all duration-200
              bg-crumi-primary text-white hover:shadow-crumi-lg dark:bg-crumi-accent
              ${expanded ? 'w-full h-11 gap-2 text-sm' : 'w-12 h-12'}
            `}
            title="Nuevo Mensaje"
          >
            <MessageSquarePlus size={20} />
            {expanded && <span>Nuevo Mensaje</span>}
          </button>
        </div>

        <div className={`mb-2 ${expanded ? 'mx-4' : 'mx-auto w-8'} border-t ${darkMode ? 'border-crumi-border-dark' : 'border-crumi-border-light'}`} />

        {/* Modulos desplegables */}
        <nav className={`flex-1 overflow-y-auto crumi-scrollbar flex flex-col gap-0.5 ${expanded ? 'px-3' : 'items-center px-4'}`}>
          {domains.map((domain) => {
            const DomainIcon = iconMap[domain.icon] || LayoutGrid;
            const isOpen = expandedDomains[domain.id] ?? false;
            const isActive = isDomainActive(domain);
            const visibleItems = domain.items.filter((item) => item.visibleInSidebar !== false);
            const isDisabled = domain.disabled === true;

            return (
              <div key={domain.id} className={isDisabled ? 'opacity-40 pointer-events-none select-none' : ''} title={isDisabled ? 'Módulo deshabilitado' : undefined}>
                {/* Domain header - clickable to expand */}
                <button
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    if (!loggedIn) {
                      dispatch(openAuthModal('login'));
                      return;
                    }
                    // Si el dominio tiene UN solo item visible, navegar directo
                    // (evita doble-click tipo "Contable > Contabilidad").
                    if (visibleItems.length === 1 && visibleItems[0].path) {
                      navigate(visibleItems[0].path);
                      onMobileClose();
                      return;
                    }
                    if (expanded) {
                      toggleDomain(domain.id);
                    } else {
                      // Collapsed: navigate to first item
                      const firstItem = visibleItems[0];
                      if (firstItem?.path) {
                        navigate(firstItem.path);
                        onMobileClose();
                      }
                    }
                  }}
                  className={`
                    flex items-center w-full transition-all duration-200 shrink-0
                    ${expanded
                      ? `h-11 gap-3 px-3 rounded-xl text-sm font-semibold
                        ${isActive
                          ? darkMode
                            ? 'text-white bg-crumi-surface-dark-hover'
                            : 'text-crumi-text-primary bg-crumi-bg-light'
                          : darkMode
                            ? 'text-crumi-text-dark-muted hover:bg-crumi-surface-dark-hover'
                            : 'text-crumi-text-muted hover:bg-crumi-bg-light'}`
                      : `w-12 h-12 justify-center
                        ${isActive
                          ? 'rounded-2xl bg-crumi-primary text-white dark:bg-crumi-accent'
                          : darkMode
                            ? 'rounded-full text-crumi-text-dark-muted hover:bg-crumi-surface-dark-hover'
                            : 'rounded-full text-crumi-text-muted hover:bg-crumi-bg-light'}`}
                  `}
                  title={expanded ? undefined : domain.label}
                >
                  <DomainIcon size={20} className="shrink-0" />
                  {expanded && (
                    <>
                      <span className="flex-1 text-left truncate">{domain.label}</span>
                      {visibleItems.length > 1 && (
                        <ChevronRight
                          size={14}
                          className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                        />
                      )}
                    </>
                  )}
                </button>

                {/* Subitems — solo si hay más de 1 item visible */}
                {expanded && isOpen && visibleItems.length > 1 && (
                  <div className="ml-3 mt-0.5 mb-1 flex flex-col gap-0.5 border-l-2 border-crumi-border-light dark:border-crumi-border-dark pl-2">
                    {visibleItems.map((item) => {
                      const ItemIcon = iconMap[item.icon] || LayoutGrid;
                      const itemActive = item.path ? location.pathname.startsWith(item.path) : false;

                      return (
                        <Link
                          key={item.id}
                          to={loggedIn ? item.path || '/dashboard' : '#'}
                          onClick={(e) => {
                            if (!loggedIn) {
                              e.preventDefault();
                              dispatch(openAuthModal('login'));
                              return;
                            }
                            onMobileClose();
                          }}
                          className={`
                            flex items-center no-underline h-9 gap-2.5 px-2.5 rounded-lg text-[13px] font-medium transition-all duration-150
                            ${itemActive
                              ? 'bg-crumi-primary text-white dark:bg-crumi-accent'
                              : darkMode
                                ? 'text-crumi-text-dark-muted hover:bg-crumi-surface-dark-hover'
                                : 'text-crumi-text-muted hover:bg-crumi-bg-light'}
                          `}
                        >
                          <ItemIcon size={16} className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`shrink-0 pb-4 pt-2 flex flex-col gap-2 ${expanded ? 'px-3' : 'items-center'}`}>
          {canToggleWorkspace && (
            <div className={`${expanded ? 'mx-1' : 'mx-auto w-8'} border-t ${darkMode ? 'border-crumi-border-dark' : 'border-crumi-border-light'}`} />
          )}

          {canToggleWorkspace && (
            <button
              onClick={loggedIn ? handleToggleWorkspace : () => dispatch(openAuthModal('login'))}
              className={`flex items-center transition-colors
                ${expanded ? 'h-10 gap-3 px-3 rounded-xl text-sm w-full' : 'w-12 h-12 justify-center rounded-full'}
                ${isContador
                  ? 'bg-crumi-accent/10 text-crumi-accent hover:bg-crumi-accent/20'
                  : darkMode
                    ? 'hover:bg-crumi-surface-dark-hover text-crumi-text-dark-muted'
                    : 'hover:bg-crumi-bg-light text-crumi-text-muted'}
              `}
              title={isContador ? 'Modo Contador - Cambiar a Empresa' : 'Cambiar a Modo Contador'}
            >
              <ArrowLeftRight size={18} className="shrink-0" />
              {expanded && <span className="truncate">Modo Contador</span>}
            </button>
          )}

          <div className={`flex items-center gap-3 ${expanded ? 'px-2' : 'justify-center'}`}>
            {loggedIn ? (
              <>
                <div
                  className="w-10 h-10 rounded-full bg-crumi-primary flex items-center justify-center text-white font-semibold text-sm shrink-0"
                  title={userName}
                >
                  {userInitial}
                </div>
                {expanded && (
                  <span className={`text-sm font-medium truncate ${darkMode ? 'text-crumi-text-dark-primary' : 'text-crumi-text-primary'}`}>
                    {userName}
                  </span>
                )}
              </>
            ) : (
              <button
                onClick={() => dispatch(openAuthModal('login'))}
                className={`flex items-center transition-colors
                  ${expanded ? 'h-10 gap-3 px-3 rounded-xl text-sm w-full' : 'w-12 h-12 justify-center rounded-full'}
                  ${darkMode
                    ? 'hover:bg-crumi-surface-dark-hover text-crumi-text-dark-muted'
                    : 'hover:bg-crumi-bg-light text-crumi-text-muted'}
                `}
                title="Iniciar sesion"
              >
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold text-sm shrink-0">
                  ?
                </div>
                {expanded && <span className="truncate">Iniciar sesion</span>}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Modal Espacio Contador */}
      {showContadorModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowContadorModal(false)}
        >
          <div
            className={`relative w-[380px] rounded-2xl shadow-2xl p-6 ${darkMode ? 'bg-crumi-surface-dark text-crumi-text-dark-primary' : 'bg-white text-crumi-text-primary'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowContadorModal(false)}
              className={`absolute top-3 right-3 p-1 rounded-lg transition-colors ${darkMode ? 'hover:bg-crumi-surface-dark-hover text-crumi-text-dark-muted' : 'hover:bg-crumi-bg-light text-crumi-text-muted'}`}
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-crumi-primary/10 flex items-center justify-center">
                <Briefcase size={20} className="text-crumi-primary" />
              </div>
              <h3 className="text-base font-semibold">Cambiar a Espacio Contador</h3>
            </div>

            <p className={`text-sm mb-4 ${darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted'}`}>
              Al activar el Espacio Contador tendras acceso a herramientas avanzadas:
            </p>

            <ul className="space-y-2.5 mb-5">
              <li className="flex items-start gap-2.5 text-sm">
                <Users2 size={16} className="text-crumi-primary shrink-0 mt-0.5" />
                <span>Gestionar multiples empresas desde un solo lugar</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm">
                <Columns3 size={16} className="text-crumi-primary shrink-0 mt-0.5" />
                <span>Tablero Kanban para organizar tareas entre empresas</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm">
                <BarChart3 size={16} className="text-crumi-primary shrink-0 mt-0.5" />
                <span>Reportes y vista consolidada de contabilidad</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm">
                <Shield size={16} className="text-crumi-primary shrink-0 mt-0.5" />
                <span>Control de acceso y permisos por empresa</span>
              </li>
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => setShowContadorModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${darkMode ? 'border-crumi-border-dark hover:bg-crumi-surface-dark-hover' : 'border-crumi-border-light hover:bg-crumi-bg-light'}`}
              >
                Cancelar
              </button>
              <button
                onClick={confirmSwitchToContador}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-crumi-primary text-white hover:shadow-crumi-lg transition-all"
              >
                Si, cambiar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CrumiSidebar;
