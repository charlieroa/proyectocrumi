import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildBancosSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'movimientos',
    title: 'Movimientos',
    items: [
      { id: 'transacciones', label: 'Extracto Bancario', icon: 'ri-exchange-funds-line' },
      { id: 'nuevo', label: 'Nuevo Movimiento', icon: 'ri-add-circle-line' },
    ],
  },
  {
    id: 'conciliacion',
    title: 'Conciliacion',
    items: [
      { id: 'conciliar', label: 'Conciliar', icon: 'ri-links-line' },
    ],
  },
  {
    id: 'configuracion',
    title: 'Configuracion',
    items: [
      { id: 'cuentas-bancarias', label: 'Cuentas Bancarias', icon: 'ri-bank-line' },
    ],
  },
];
