import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildCotizacionesSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'gestion',
    title: 'Gestion',
    items: [
      { id: 'listado', label: 'Listado', icon: 'ri-list-check-2' },
    ],
  },
  {
    id: 'acciones',
    title: 'Acciones',
    items: [
      { id: 'convertir', label: 'Convertir a Factura', icon: 'ri-exchange-line' },
    ],
  },
];
