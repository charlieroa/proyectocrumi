import React from 'react';
import NominaHubLayout from './NominaHubLayout';
import Empleados from './sections/Empleados';
import Liquidar from './sections/Liquidar';
import Periodos from './sections/Periodos';
import NominaElectronica from './sections/NominaElectronica';
import Pila from './sections/Pila';
import Reportes from './sections/Reportes';

export const EmpleadosPage: React.FC = () => (
  <NominaHubLayout title="Empleados" subtitle="Listado y búsqueda de colaboradores" icon="ri-team-line" iconColor="primary">
    <Empleados />
  </NominaHubLayout>
);

export const LiquidarPage: React.FC = () => (
  <NominaHubLayout title="Liquidar período" subtitle="Calcula devengado, deducciones y neto del período" icon="ri-calculator-line" iconColor="success">
    <Liquidar />
  </NominaHubLayout>
);

export const PeriodosPage: React.FC = () => (
  <NominaHubLayout title="Períodos" subtitle="Draft, liquidados, aprobados y cerrados" icon="ri-calendar-2-line" iconColor="info">
    <Periodos />
  </NominaHubLayout>
);

export const NominaElectronicaPage: React.FC = () => (
  <NominaHubLayout title="Nómina electrónica" subtitle="Preparar y sincronizar con la DIAN" icon="ri-government-line" iconColor="dark">
    <NominaElectronica />
  </NominaHubLayout>
);

export const PilaPage: React.FC = () => (
  <NominaHubLayout title="PILA" subtitle="Aportes a seguridad social y parafiscales" icon="ri-heart-pulse-line" iconColor="warning">
    <Pila />
  </NominaHubLayout>
);

export const ReportesPage: React.FC = () => (
  <NominaHubLayout title="Reportes" subtitle="Resumen, certificados y exportes" icon="ri-line-chart-line" iconColor="secondary">
    <Reportes />
  </NominaHubLayout>
);
