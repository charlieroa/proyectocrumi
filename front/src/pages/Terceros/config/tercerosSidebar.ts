import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildTercerosSidebarSections = (): ModuleSidebarSection[] => [
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
      { id: 'nuevo', label: 'Nuevo Tercero', icon: 'ri-user-add-line' },
    ],
  },
  {
    id: 'filtros',
    title: 'Filtros',
    items: [
      { id: 'clientes', label: 'Clientes', icon: 'ri-user-star-line' },
      { id: 'proveedores', label: 'Proveedores', icon: 'ri-truck-line' },
      { id: 'empleados', label: 'Empleados', icon: 'ri-team-line' },
    ],
  },
];
