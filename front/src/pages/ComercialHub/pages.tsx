import React from 'react';
import ComercialHubLayout from './ComercialHubLayout';
import EmbudoVentas from './sections/EmbudoVentas';
import Oportunidades from './sections/Oportunidades';
import Cotizaciones from './sections/Cotizaciones';
import Facturacion from './sections/Facturacion';
import Clientes from './sections/Clientes';

export const EmbudoPage: React.FC = () => (
  <ComercialHubLayout title="Embudo de ventas" subtitle="Leads y oportunidades por etapa" icon="ri-funnel-line" iconColor="primary">
    <EmbudoVentas />
  </ComercialHubLayout>
);

export const OportunidadesPage: React.FC = () => (
  <ComercialHubLayout title="Oportunidades" subtitle="Negocios en curso" icon="ri-briefcase-line" iconColor="info">
    <Oportunidades />
  </ComercialHubLayout>
);

export const CotizacionesPage: React.FC = () => (
  <ComercialHubLayout title="Cotizaciones" subtitle="Propuestas comerciales emitidas" icon="ri-file-list-3-line" iconColor="success">
    <Cotizaciones />
  </ComercialHubLayout>
);

export const FacturacionPage: React.FC = () => (
  <ComercialHubLayout title="Facturación" subtitle="Facturas de venta emitidas" icon="ri-bill-line" iconColor="warning">
    <Facturacion />
  </ComercialHubLayout>
);

export const ClientesPage: React.FC = () => (
  <ComercialHubLayout title="Clientes" subtitle="Cartera de clientes" icon="ri-user-star-line" iconColor="secondary">
    <Clientes />
  </ComercialHubLayout>
);
