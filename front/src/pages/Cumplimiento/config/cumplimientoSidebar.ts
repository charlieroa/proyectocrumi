import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildCumplimientoSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'obligaciones',
    title: 'Obligaciones',
    items: [
      { id: 'obligaciones', label: 'Listado', icon: 'ri-file-list-3-line' },
      { id: 'nueva-obligacion', label: 'Nueva', icon: 'ri-file-add-line' },
    ],
  },
  {
    id: 'calendario',
    title: 'Calendario',
    items: [
      { id: 'presentaciones', label: 'Presentaciones', icon: 'ri-calendar-check-line' },
    ],
  },
  {
    id: 'riesgos',
    title: 'Riesgos',
    items: [
      { id: 'matriz-riesgos', label: 'Matriz de Riesgos', icon: 'ri-shield-check-line' },
    ],
  },
];
