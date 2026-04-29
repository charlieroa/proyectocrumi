import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildContratosSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'gestion',
    title: 'Gestion',
    items: [
      { id: 'listado', label: 'Listado', icon: 'ri-file-list-3-line' },
      { id: 'nuevo', label: 'Nuevo Contrato', icon: 'ri-file-add-line' },
    ],
  },
  {
    id: 'seguimiento',
    title: 'Seguimiento',
    items: [
      { id: 'alertas', label: 'Alertas', icon: 'ri-alarm-warning-line' },
      { id: 'enmiendas', label: 'Enmiendas', icon: 'ri-edit-2-line' },
    ],
  },
];
