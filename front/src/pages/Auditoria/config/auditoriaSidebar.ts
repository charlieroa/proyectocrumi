import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildAuditoriaSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'analisis',
    title: 'Analisis',
    items: [
      { id: 'eventos', label: 'Eventos', icon: 'ri-list-check-3' },
      { id: 'actividad', label: 'Actividad reciente', icon: 'ri-radar-line' },
    ],
  },
];
