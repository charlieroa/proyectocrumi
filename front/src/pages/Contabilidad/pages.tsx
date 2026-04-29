import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SectionPage from './SectionPage';
import Captura from './sections/Captura';
import Notas from './sections/Notas';
import Consultas from './sections/Consultas';
import Impuestos from './sections/Impuestos';
import DianStatus from './sections/DianStatus';
import ConfigFacturacion from './sections/ConfigFacturacion';
import Compras from './sections/Compras';
import DocumentosSoporte from './sections/DocumentosSoporte';
import Pagos from './sections/Pagos';
import Cobros from './sections/Cobros';
import Bancos from './sections/Bancos';
import Exogena from './sections/Exogena';
import Kardex from './sections/Kardex';
import ActivosFijos from './sections/ActivosFijos';
import PlantillasAsiento from './sections/PlantillasAsiento';
import Puc from './sections/Puc';
import SoporteVenta from './sections/SoporteVenta';
import DocumentoIngreso from './sections/DocumentoIngreso';
import ProductosServicios from './sections/ProductosServicios';
import RemisionesComp from './sections/Remisiones';
import EmpresaConfig from './sections/EmpresaConfig';
import FacturacionElectronicaConfig from './sections/FacturacionElectronicaConfig';
import ContabilidadMaestraConfig from './sections/ContabilidadMaestraConfig';
import TercerosConfig from './sections/TercerosConfig';
import CentrosCosto from './sections/CentrosCosto';
import FacturaTab from '../income/SalesInvoice/tabs/FacturaTab';
import type { DocumentConfig } from '../income/SalesInvoice/Create';
import FacturaVentaLista from '../income/SalesInvoice/FacturaVentaLista';

export const CapturaPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <SectionPage title="Capturar asiento" subtitle="Registra un comprobante manual" icon="ri-pencil-line" iconColor="primary" parentTab="reportes">
      <Captura onSaved={() => { /* quedarse en la misma pantalla para capturar el siguiente */ void navigate; }} />
    </SectionPage>
  );
};

export const NotasPage: React.FC = () => {
  const { kind } = useParams<{ kind: 'credito' | 'debito' }>();
  const initialKind: 'credit' | 'debit' = kind === 'debito' ? 'debit' : 'credit';
  const title = initialKind === 'credit' ? 'Notas crédito' : 'Notas débito';
  const icon = initialKind === 'credit' ? 'ri-file-minus-line' : 'ri-file-add-line';
  const color = initialKind === 'credit' ? 'success' : 'warning';
  return (
    <SectionPage title={title} subtitle="Emitir y consultar notas" icon={icon} iconColor={color}>
      <Notas initialKind={initialKind} />
    </SectionPage>
  );
};

export const ConsultasPage: React.FC = () => (
  <SectionPage title="Consultas y libros" subtitle="Diario, mayor, auxiliar, balances y estados financieros" icon="ri-search-line" iconColor="info" parentTab="reportes">
    <Consultas />
  </SectionPage>
);

export const ImpuestosPage: React.FC = () => (
  <SectionPage title="Impuestos" subtitle="IVA, retenciones, ICA y conceptos DIAN" icon="ri-percent-line" iconColor="secondary" parentTab="reportes">
    <Impuestos />
  </SectionPage>
);

export const DianStatusPage: React.FC = () => (
  <SectionPage title="Estado DIAN" subtitle="Facturación y nómina electrónica (solo monitoreo)" icon="ri-government-line" iconColor="dark" parentTab="reportes">
    <DianStatus />
  </SectionPage>
);

export const ConfigFacturacionPage: React.FC = () => (
  <SectionPage title="Configurar facturación electrónica" subtitle="Wizard guiado paso a paso" icon="ri-magic-line" iconColor="primary" parentTab="configuracion">
    <ConfigFacturacion />
  </SectionPage>
);

export const ComprasPage: React.FC = () => (
  <SectionPage title="Facturas de compra" subtitle="Registra facturas que recibes de proveedores" icon="ri-shopping-cart-2-line" iconColor="warning" parentTab="compras">
    <Compras />
  </SectionPage>
);

export const DocumentosSoportePage: React.FC = () => (
  <SectionPage title="Documentos soporte" subtitle="Gastos pagados a no obligados a facturar (contratistas, prestadores)" icon="ri-file-text-line" iconColor="info" parentTab="compras">
    <DocumentosSoporte />
  </SectionPage>
);

export const PagosPage: React.FC = () => (
  <SectionPage title="Pagos a proveedores" subtitle="Registra los pagos que emite tu empresa" icon="ri-bank-card-line" iconColor="danger" parentTab="compras">
    <Pagos />
  </SectionPage>
);

export const CobrosPage: React.FC = () => (
  <SectionPage title="Cobros de clientes" subtitle="Registra los cobros que recibes" icon="ri-hand-coin-line" iconColor="success">
    <Cobros />
  </SectionPage>
);

export const BancosPage: React.FC = () => (
  <SectionPage title="Bancos" subtitle="Movimientos bancarios y conciliación" icon="ri-bank-line" iconColor="primary" parentTab="compras">
    <Bancos />
  </SectionPage>
);

export const ExogenaPage: React.FC = () => (
  <SectionPage title="Información exógena DIAN" subtitle="Medios magnéticos — formatos 1001, 1003, 1007, 1008, 1009" icon="ri-file-download-line" iconColor="dark" parentTab="reportes">
    <Exogena />
  </SectionPage>
);

export const KardexPage: React.FC = () => (
  <SectionPage title="Kardex" subtitle="Inventario costeado con costo promedio ponderado" icon="ri-stack-line" iconColor="info" parentTab="productos">
    <Kardex />
  </SectionPage>
);

export const ActivosFijosPage: React.FC = () => (
  <SectionPage title="Activos fijos" subtitle="Registro y depreciación mensual automática" icon="ri-building-3-line" iconColor="warning" parentTab="productos">
    <ActivosFijos />
  </SectionPage>
);

export const PlantillasAsientoPage: React.FC = () => (
  <SectionPage title="Plantillas de asientos" subtitle="Asientos recurrentes reutilizables" icon="ri-file-copy-2-line" iconColor="secondary" parentTab="configuracion">
    <PlantillasAsiento />
  </SectionPage>
);

export const PucPage: React.FC = () => (
  <SectionPage title="Plan de cuentas (PUC)" subtitle="Cuentas contables, jerarquía y clases 1-7 del PUC colombiano" icon="ri-list-check-2" iconColor="primary" parentTab="configuracion">
    <Puc />
  </SectionPage>
);

export const SoporteVentaPage: React.FC = () => (
  <SectionPage
    title="Soporte de venta"
    subtitle="Registros internos de venta sin emisión DIAN (efectivo, transferencias, POS manual)"
    icon="ri-receipt-line"
    iconColor="success"
  >
    <SoporteVenta />
  </SectionPage>
);

export const DocumentoIngresoPage: React.FC = () => (
  <SectionPage
    title="Documento de ingreso"
    subtitle="Consulta de ingresos registrados con filtros avanzados"
    icon="ri-arrow-down-circle-line"
    iconColor="success"
  >
    <DocumentoIngreso />
  </SectionPage>
);

export const ProductosServiciosPage: React.FC = () => (
  <SectionPage
    title="Productos y servicios"
    subtitle="Catálogo de lo que facturas"
    icon="ri-box-3-line"
    iconColor="primary"
    parentTab="productos"
  >
    <ProductosServicios />
  </SectionPage>
);

export const CentrosCostoPage: React.FC = () => (
  <SectionPage
    title="Centros de costo"
    subtitle="Clasifica ingresos, gastos y movimientos de inventario por área"
    icon="ri-pie-chart-line"
    iconColor="info"
    parentTab="configuracion"
  >
    <CentrosCosto />
  </SectionPage>
);

const FACTURA_VENTA_CONFIG: DocumentConfig = {
  title: 'Factura de venta',
  subtitle: 'Documento fiscal electrónico DIAN',
  icon: '📄',
  color: '#00BFA5',
  numberLabel: 'Factura No.',
};

export const FacturaVentaPage: React.FC = () => (
  <SectionPage
    title="Factura de venta"
    subtitle="Emitir factura electrónica DIAN"
    icon="ri-bill-line"
    iconColor="success"
    parentTab="ventas"
  >
    <FacturaTab config={FACTURA_VENTA_CONFIG} />
  </SectionPage>
);

export const FacturaVentaListaPage: React.FC = () => (
  <SectionPage
    title="Facturas de venta"
    subtitle="Lista de facturas emitidas"
    icon="ri-bill-line"
    iconColor="success"
    parentTab="ventas"
  >
    <FacturaVentaLista />
  </SectionPage>
);

export const RemisionesPage: React.FC = () => (
  <SectionPage
    title="Remisiones"
    subtitle="Notas de entrega de mercancía antes de facturar"
    icon="ri-truck-line"
    iconColor="info"
  >
    <RemisionesComp />
  </SectionPage>
);

/* ============================================================
 * CONFIGURACIÓN (secciones migradas desde /settings)
 * Cada una monta <Settings singleTab="N" /> para no duplicar lógica.
 * ============================================================ */
export const EmpresaConfigPage: React.FC = () => (
  <SectionPage
    title="Datos de la Empresa"
    subtitle="NIT, razón social, dirección, responsabilidad tributaria"
    icon="ri-building-line"
    iconColor="primary"
    parentTab="configuracion"
  >
    <EmpresaConfig />
  </SectionPage>
);

export const FacturacionElectronicaConfigPage: React.FC = () => (
  <SectionPage
    title="Facturación electrónica (DIAN)"
    subtitle="Certificado, resolución, prefijos y radicación DIAN"
    icon="ri-government-line"
    iconColor="success"
    parentTab="configuracion"
  >
    <FacturacionElectronicaConfig />
  </SectionPage>
);

export const ContabilidadMaestraConfigPage: React.FC = () => (
  <SectionPage
    title="Contabilidad maestra"
    subtitle="Cuentas por defecto, prefijos, centros de costo, año fiscal"
    icon="ri-calculator-line"
    iconColor="primary"
    parentTab="configuracion"
  >
    <ContabilidadMaestraConfig />
  </SectionPage>
);

export const TercerosConfigPage: React.FC = () => (
  <SectionPage
    title="Terceros"
    subtitle="Clientes, proveedores, empleados y otros"
    icon="ri-contacts-book-line"
    iconColor="success"
    parentTab="configuracion"
  >
    <TercerosConfig />
  </SectionPage>
);
