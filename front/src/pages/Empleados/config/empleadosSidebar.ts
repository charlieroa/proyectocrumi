import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildEmpleadosSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'gestion',
    title: 'Gestion',
    items: [
      { id: 'directorio', label: 'Directorio', icon: 'ri-contacts-book-line' },
      { id: 'nuevo', label: 'Nuevo Empleado', icon: 'ri-user-add-line' },
    ],
  },
  {
    id: 'detalle',
    title: 'Detalle',
    items: [
      { id: 'afiliaciones', label: 'Afiliaciones', icon: 'ri-hospital-line' },
      { id: 'contratos', label: 'Contratos', icon: 'ri-file-paper-2-line' },
    ],
  },
];
