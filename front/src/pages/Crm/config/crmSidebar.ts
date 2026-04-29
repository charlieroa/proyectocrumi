import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildCrmSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'ventas',
    title: 'Ventas',
    items: [
      { id: 'leads', label: 'Leads', icon: 'ri-user-follow-line' },
      { id: 'pipeline', label: 'Pipeline', icon: 'ri-filter-3-line' },
    ],
  },
  {
    id: 'seguimiento',
    title: 'Seguimiento',
    items: [
      { id: 'actividades', label: 'Actividades', icon: 'ri-time-line' },
    ],
  },
  {
    id: 'configuracion',
    title: 'Configuracion',
    items: [
      { id: 'etapas', label: 'Etapas Pipeline', icon: 'ri-settings-3-line' },
    ],
  },
];
