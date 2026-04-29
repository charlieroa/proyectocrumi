import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildAprobacionesSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'operacion',
    title: 'Operacion',
    items: [
      { id: 'pendientes', label: 'Pendientes', icon: 'ri-time-line' },
      { id: 'solicitudes', label: 'Solicitudes', icon: 'ri-file-list-3-line' },
      { id: 'flujos', label: 'Flujos', icon: 'ri-git-branch-line' },
    ],
  },
  {
    id: 'control',
    title: 'Control',
    items: [{ id: 'historial', label: 'Historial', icon: 'ri-history-line' }],
  },
];
