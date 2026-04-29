import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildAlegraSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'configuracion',
    title: 'Configuracion',
    items: [
      { id: 'config', label: 'Configuracion API', icon: 'ri-settings-3-line' },
      { id: 'empresa', label: 'Empresa', icon: 'ri-building-line' },
    ],
  },
  {
    id: 'dian',
    title: 'DIAN',
    items: [
      { id: 'test-set', label: 'Set de Pruebas', icon: 'ri-test-tube-line' },
      { id: 'estado', label: 'Estado Proveedor', icon: 'ri-signal-tower-line' },
    ],
  },
  {
    id: 'documentos',
    title: 'Documentos',
    items: [
      { id: 'facturas', label: 'Facturas', icon: 'ri-file-text-line' },
      { id: 'notas', label: 'Notas Cr/Db', icon: 'ri-file-copy-2-line' },
    ],
  },
  {
    id: 'datos',
    title: 'Datos DIAN',
    items: [
      { id: 'tablas-dian', label: 'Tablas DIAN', icon: 'ri-database-2-line' },
    ],
  },
];
