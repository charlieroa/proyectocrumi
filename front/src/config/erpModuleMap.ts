export type AppRoleId = 1 | 2 | 3 | 4 | 99;

export type ErpDomainId =
  | 'base'
  | 'comercial'
  | 'contable'
  | 'nomina'
  | 'legal'
  | 'administrativo'
  | 'chat';

export interface ErpModuleItem {
  id: string;
  label: string;
  path?: string;
  icon: string;
  roles: AppRoleId[];
  chatEnabled: boolean;
  status: 'active' | 'planned';
  visibleInSidebar?: boolean;
  requiresMainTenant?: boolean;
  requiresAccountantMode?: boolean;
}

export interface ErpDomain {
  id: ErpDomainId;
  label: string;
  description: string;
  order: number;
  path: string;
  icon: string;
  items: ErpModuleItem[];
  disabled?: boolean;
}

export interface ErpSidebarEntry {
  id: string;
  label: string;
  icon?: string;
  link?: string;
  roles?: AppRoleId[];
  isHeader?: boolean;
  domainId?: ErpDomainId;
  status?: 'active' | 'planned';
  chatEnabled?: boolean;
  requiresMainTenant?: boolean;
  requiresAccountantMode?: boolean;
}

// ============================================================
// MAPA DE MODULOS - Sidebar con modulos desplegables
// ============================================================

export const ERP_MODULE_MAP: ErpDomain[] = [
  {
    id: 'comercial',
    label: 'Comercial',
    description: 'CRM, clientes, cotizaciones, facturas y mensajeria.',
    order: 1,
    path: '/comercial',
    icon: 'ri-briefcase-4-line',
    disabled: true,
    items: [
      { id: 'comercial-hub', label: 'Comercial', path: '/comercial-hub', icon: 'ri-briefcase-4-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'comercial-embudo', label: 'Embudo de ventas', path: '/comercial-hub/embudo', icon: 'ri-funnel-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'comercial-cotizaciones', label: 'Cotizaciones', path: '/comercial-hub/cotizaciones', icon: 'ri-file-list-3-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'comercial-facturacion', label: 'Facturas de venta', path: '/comercial-hub/facturacion', icon: 'ri-bill-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'terceros-hub', label: 'Terceros', path: '/terceros-hub', icon: 'ri-contacts-book-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'crm-leads-legacy', label: 'CRM (clásico)', path: '/crm', icon: 'ri-customer-service-2-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
    ],
  },
  {
    id: 'contable',
    label: 'Contabilidad',
    description: 'Ventas, compras, productos, reportes y configuración.',
    order: 2,
    path: '/contabilidad',
    icon: 'ri-calculator-line',
    items: [
      { id: 'accounting-hub', label: 'Contabilidad', path: '/contabilidad', icon: 'ri-book-2-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'accounting-puc', label: 'Plan de cuentas (PUC)', path: '/contabilidad/puc', icon: 'ri-list-check-2', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-terceros', label: 'Terceros', path: '/terceros-hub', icon: 'ri-contacts-book-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-capture', label: 'Capturar asiento', path: '/contabilidad/capturar', icon: 'ri-pencil-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-compras', label: 'Facturas de compra', path: '/contabilidad/compras', icon: 'ri-shopping-cart-2-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-ds', label: 'Documentos soporte', path: '/contabilidad/documentos-soporte', icon: 'ri-file-text-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-pagos', label: 'Pagos a proveedores', path: '/contabilidad/pagos', icon: 'ri-bank-card-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-cobros', label: 'Cobros de clientes', path: '/contabilidad/cobros', icon: 'ri-hand-coin-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-kardex', label: 'Kardex inventario', path: '/contabilidad/kardex', icon: 'ri-stack-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-cost-centers', label: 'Centros de costo', path: '/contabilidad/centros-costo', icon: 'ri-pie-chart-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-assets', label: 'Activos fijos', path: '/contabilidad/activos-fijos', icon: 'ri-building-3-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-templates', label: 'Plantillas asientos', path: '/contabilidad/plantillas', icon: 'ri-file-copy-2-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-exogena', label: 'Información exógena', path: '/contabilidad/exogena', icon: 'ri-file-download-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-queries', label: 'Consultas y libros', path: '/contabilidad/consultas', icon: 'ri-search-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-taxes', label: 'Impuestos', path: '/contabilidad/impuestos', icon: 'ri-percent-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-dian', label: 'Estado DIAN', path: '/contabilidad/dian', icon: 'ri-government-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'accounting-banks', label: 'Bancos', path: '/contabilidad/bancos', icon: 'ri-bank-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'config-fe-wizard', label: 'Configurar FE (asistente)', path: '/contabilidad/configurar-fe', icon: 'ri-magic-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'fe-advanced', label: 'Config. avanzada DIAN', path: '/contable/alegra', icon: 'ri-settings-3-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
    ],
  },
  {
    id: 'nomina',
    label: 'Nomina',
    description: 'Empleados, liquidacion, nomina electronica, PILA.',
    order: 3,
    path: '/nomina/workspace',
    icon: 'ri-money-dollar-box-line',
    disabled: true,
    items: [
      { id: 'nomina-hub', label: 'Nómina', path: '/nomina-hub', icon: 'ri-money-dollar-box-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'nomina-empleados', label: 'Empleados', path: '/nomina-hub/empleados', icon: 'ri-team-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'nomina-liquidar', label: 'Liquidar período', path: '/nomina-hub/liquidar', icon: 'ri-calculator-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'nomina-periodos', label: 'Períodos', path: '/nomina-hub/periodos', icon: 'ri-calendar-2-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'nomina-ne', label: 'Nómina electrónica', path: '/nomina-hub/nomina-electronica', icon: 'ri-government-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'nomina-pila', label: 'PILA', path: '/nomina-hub/pila', icon: 'ri-heart-pulse-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'mi-portal', label: 'Mi Portal', path: '/mi-portal', icon: 'ri-user-star-line', roles: [1, 3, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
    ],
  },
  {
    id: 'legal',
    label: 'Legal',
    description: 'Cumplimiento, contratos y evidencia.',
    order: 4,
    path: '/legal',
    icon: 'ri-scales-3-line',
    disabled: true,
    items: [
      { id: 'contracts', label: 'Contratos', path: '/legal/contratos', icon: 'ri-file-paper-2-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'compliance', label: 'Cumplimiento', path: '/legal/cumplimiento', icon: 'ri-scales-3-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'evidence', label: 'Evidencia', path: '/legal/evidencia', icon: 'ri-folder-shield-2-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
    ],
  },
  {
    id: 'administrativo',
    label: 'Configuracion',
    description: 'Ajustes, multiempresa, usuarios.',
    order: 5,
    path: '/administrativo',
    icon: 'ri-settings-3-line',
    items: [
      { id: 'settings', label: 'Configuracion', path: '/settings', icon: 'ri-settings-3-line', roles: [1, 3, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'companies', label: 'Empresas', path: '/empresas', icon: 'ri-building-2-line', roles: [99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'new-company', label: 'Nueva Empresa', path: '/empresas/nueva', icon: 'ri-building-line', roles: [1, 4, 99], chatEnabled: false, status: 'active', visibleInSidebar: true, requiresAccountantMode: true },
      { id: 'kpis', label: 'KPIs de Uso', path: '/admin/kpis', icon: 'ri-file-chart-line', roles: [99], chatEnabled: true, status: 'active', visibleInSidebar: true },
      { id: 'provider-connections', label: 'Conexiones', path: '/administrativo/conexiones', icon: 'ri-links-line', roles: [99], chatEnabled: true, status: 'active', visibleInSidebar: true },
    ],
  },
  // Hidden items accessible via routes but not in sidebar modules
  {
    id: 'chat',
    label: 'Chat',
    description: 'Chat y asistente IA.',
    order: 99,
    path: '/chat',
    icon: 'ri-message-3-line',
    items: [
      { id: 'dashboard-chat', label: 'Dashboard', path: '/dashboard', icon: 'ri-layout-grid-line', roles: [1, 2, 3, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'chat-general', label: 'Chat', path: '/chat', icon: 'ri-message-3-line', roles: [1, 2, 3, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'onboarding-ai', label: 'Asistente IA', path: '/onboarding', icon: 'ri-sparkling-line', roles: [1, 4], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'omnichannel', label: 'Mensajeria', path: '/mensajeria', icon: 'ri-message-2-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'kanban', label: 'Kanban', path: '/tasks/kanban', icon: 'ri-layout-column-line', roles: [2, 3, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'profile', label: 'Perfil', path: '/profile', icon: 'ri-user-line', roles: [1, 2, 3, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'approvals', label: 'Aprobaciones', path: '/base/aprobaciones', icon: 'ri-checkbox-circle-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'audit-core', label: 'Auditoria', path: '/base/auditoria', icon: 'ri-shield-check-line', roles: [1, 4, 99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'contadores', label: 'Espacios Contador', path: '/contadores', icon: 'ri-user-search-line', roles: [99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'internal-employees', label: 'Empleados Internos', path: '/empleados-internos', icon: 'ri-team-line', roles: [99], chatEnabled: true, status: 'active', visibleInSidebar: false },
      { id: 'registered-users', label: 'Usuarios', path: '/usuarios-registrados', icon: 'ri-group-line', roles: [99], chatEnabled: true, status: 'active', visibleInSidebar: false },
    ],
  },
];

export const ERP_ROLE_LABELS: Record<AppRoleId, string> = {
  1: 'Admin Tenant',
  2: 'Coordinador',
  3: 'Perfil Limitado',
  4: 'Contador',
  99: 'Superadmin',
};

export const getDomainsForRole = (roleId: AppRoleId | null | undefined): ErpDomain[] => {
  if (!roleId) return [];
  return ERP_MODULE_MAP
    .map((domain) => ({
      ...domain,
      items: domain.items.filter((item) => item.roles.includes(roleId)),
    }))
    .filter((domain) => domain.items.length > 0)
    .sort((a, b) => a.order - b.order);
};

/** Domains that appear as collapsible modules in the sidebar (order < 99) */
export const getSidebarDomains = (roleId: AppRoleId | null | undefined, activeModules?: string[]): ErpDomain[] => {
  return getDomainsForRole(roleId).filter((d) => {
    if (d.order >= 99) return false;
    // Only 'contable' is gated by active_modules; everything else always visible
    if (activeModules && d.id === 'contable') {
      return activeModules.includes('contable');
    }
    return true;
  });
};

// Keep legacy exports for compatibility
export const getSidebarEntriesForRole = (roleId: AppRoleId | null | undefined): ErpSidebarEntry[] => {
  const domains = getDomainsForRole(roleId)
    .filter((d) => d.order < 99)
    .map((domain) => ({
      ...domain,
      items: domain.items.filter((item) => item.visibleInSidebar !== false),
    }))
    .filter((domain) => domain.items.length > 0);

  return domains.flatMap((domain) => [
    {
      id: 'header-' + domain.id,
      label: domain.label,
      isHeader: true,
      domainId: domain.id,
      link: domain.path,
    },
    ...domain.items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      link: item.path,
      roles: item.roles,
      domainId: domain.id,
      status: item.status,
      chatEnabled: item.chatEnabled,
      requiresMainTenant: item.requiresMainTenant,
      requiresAccountantMode: item.requiresAccountantMode,
    })),
  ]);
};

export const getAdvancedSidebarEntriesForRole = (roleId: AppRoleId | null | undefined): ErpSidebarEntry[] => {
  return [];
};

export const getDomainById = (domainId: ErpDomainId): ErpDomain | undefined => {
  return ERP_MODULE_MAP.find((domain) => domain.id === domainId);
};

export const getModuleById = (moduleId: string): (ErpModuleItem & { domain: ErpDomain }) | undefined => {
  for (const domain of ERP_MODULE_MAP) {
    const module = domain.items.find((item) => item.id === moduleId);
    if (module) return { ...module, domain };
  }
  return undefined;
};

export const getAllDomainPaths = (): string[] => ERP_MODULE_MAP.map((domain) => domain.path);

export const getPlannedModules = (): Array<ErpModuleItem & { domain: ErpDomain }> => {
  return ERP_MODULE_MAP.flatMap((domain) =>
    domain.items
      .filter((item) => item.status === 'planned')
      .map((item) => ({ ...item, domain }))
  );
};
