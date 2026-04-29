import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildEvidenciaSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'repositorio',
    title: 'Repositorio',
    items: [
      { id: 'documentos', label: 'Documentos', icon: 'ri-folder-open-line' },
      { id: 'faltantes', label: 'Faltantes', icon: 'ri-alert-line' },
    ],
  },
];
