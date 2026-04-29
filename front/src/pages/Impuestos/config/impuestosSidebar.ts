import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildImpuestosSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'impuestos',
    title: 'Impuestos',
    items: [
      { id: 'iva', label: 'Resumen IVA', icon: 'ri-percent-line' },
      { id: 'retenciones', label: 'Retenciones', icon: 'ri-hand-coin-line' },
      { id: 'configuracion', label: 'Configuracion', icon: 'ri-settings-3-line' },
    ],
  },
  {
    id: 'calendario',
    title: 'Calendario',
    items: [
      { id: 'calendario', label: 'Calendario Fiscal', icon: 'ri-calendar-check-line' },
    ],
  },
  {
    id: 'cierre',
    title: 'Cierre',
    items: [
      { id: 'cierre-fiscal', label: 'Cierre de Ano', icon: 'ri-lock-line' },
    ],
  },
];
