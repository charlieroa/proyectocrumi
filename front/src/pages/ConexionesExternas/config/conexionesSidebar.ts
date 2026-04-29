import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildConexionesSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'proveedores',
    title: 'Proveedores',
    items: [
      { id: 'conexiones', label: 'Conexiones', icon: 'ri-links-line' },
      { id: 'nueva', label: 'Nueva Conexion', icon: 'ri-add-circle-line' },
    ],
  },
  {
    id: 'sincronizacion',
    title: 'Sincronizacion',
    items: [
      { id: 'sync-history', label: 'Historial Sync', icon: 'ri-history-line' },
      { id: 'logs', label: 'Logs', icon: 'ri-file-list-2-line' },
    ],
  },
];
