import type { ModuleSidebarSection } from '../../../Components/Common/ModuleSidebar';

export const buildPilaSidebarSections = (): ModuleSidebarSection[] => [
  {
    id: 'general',
    title: 'General',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
  },
  {
    id: 'operacion',
    title: 'Operacion',
    items: [{ id: 'calculo', label: 'Calculo PILA', icon: 'ri-file-chart-line' }],
  },
];
