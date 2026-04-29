import React, { useState, useEffect } from 'react';
import ProductosServicios from './sections/ProductosServicios';
import { getFeStatus, FeStatus } from '../../services/feStatusApi';
import NuevoTerceroModal from '../../Components/Common/NuevoTerceroModal';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Container,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Nav,
  NavItem,
  NavLink,
  Row,
  TabContent,
  TabPane,
} from 'reactstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownCircle,
  ArrowRight,
  Book,
  BookMarked,
  BookOpen,
  Box,
  Building,
  Building2,
  Calculator,
  CheckCheck,
  ChevronDown,
  Clock,
  Contact,
  Copy,
  CreditCard,
  FileDown,
  FileMinus,
  FilePlus,
  FileText,
  HandCoins,
  Landmark,
  Layers,
  LineChart,
  ListChecks,
  Pencil,
  Percent,
  PieChart,
  Plus,
  Printer,
  Receipt,
  Scale,
  Scissors,
  Settings as SettingsIcon,
  ShoppingCart,
  Sparkles,
  Truck,
  UserMinus,
  UserPlus,
  Wallet,
  Wand2,
  Zap,
} from 'lucide-react';

// Mapeo de nombres Remix Icons a componentes Lucide — más robusto que depender del CDN.
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'ri-bill-line': Receipt,
  'ri-arrow-down-circle-line': ArrowDownCircle,
  'ri-hand-coin-line': HandCoins,
  'ri-file-minus-line': FileMinus,
  'ri-file-add-line': FilePlus,
  'ri-truck-line': Truck,
  'ri-file-paper-line': FileText,
  'ri-shopping-cart-2-line': ShoppingCart,
  'ri-file-text-line': FileText,
  'ri-bank-card-line': CreditCard,
  'ri-bank-line': Landmark,
  'ri-box-3-line': Box,
  'ri-stack-line': Layers,
  'ri-building-3-line': Building,
  'ri-scales-3-line': Scale,
  'ri-line-chart-line': LineChart,
  'ri-pie-chart-line': PieChart,
  'ri-book-open-line': BookOpen,
  'ri-book-2-line': Book,
  'ri-book-3-line': BookMarked,
  'ri-check-double-line': CheckCheck,
  'ri-user-received-line': UserPlus,
  'ri-user-shared-line': UserMinus,
  'ri-time-line': Clock,
  'ri-percent-line': Percent,
  'ri-scissors-cut-line': Scissors,
  'ri-file-download-line': FileDown,
  'ri-government-line': Building2,
  'ri-pencil-line': Pencil,
  'ri-building-line': Building,
  'ri-list-check-2': ListChecks,
  'ri-contacts-book-line': Contact,
  'ri-calculator-line': Calculator,
  'ri-magic-line': Wand2,
  'ri-settings-3-line': SettingsIcon,
  'ri-file-copy-2-line': Copy,
  'ri-wallet-3-line': Wallet,
  'ri-printer-line': Printer,
  'ri-sparkling-line': Sparkles,
};

type MainTab = 'ventas' | 'compras' | 'productos' | 'reportes' | 'configuracion';

type Tile = {
  path: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  featured?: boolean;
};

/* ============================================================
 * VENTAS
 * ============================================================ */
const VENTAS_TILES: Tile[] = [
  { path: '/contabilidad/factura-venta', title: 'Factura de venta', desc: 'Emitir y consultar facturas electrónicas DIAN', icon: 'ri-bill-line', color: 'success' },
  { path: '/contabilidad/recibos-caja', title: 'Recibos de caja', desc: 'Cobros recibidos aplicados a facturas de venta', icon: 'ri-hand-coin-line', color: 'success' },
  { path: '/contabilidad/notas/credito', title: 'Notas de crédito', desc: 'Anular o ajustar facturas emitidas', icon: 'ri-file-minus-line', color: 'success' },
  { path: '/contabilidad/notas/debito', title: 'Notas de débito', desc: 'Aumentar valor de facturas emitidas', icon: 'ri-file-add-line', color: 'warning' },
  { path: '/contabilidad/remisiones', title: 'Remisiones', desc: 'Notas de entrega de mercancía antes de facturar', icon: 'ri-truck-line', color: 'info' },
  { path: '/comercial/cotizaciones', title: 'Cotizaciones', desc: 'Propuestas comerciales antes de facturar', icon: 'ri-file-paper-line', color: 'info' },
];

/* ============================================================
 * COMPRAS
 * ============================================================ */
const COMPRAS_TILES: Tile[] = [
  { path: '/contabilidad/compras', title: 'Factura de compra', desc: 'Registrar facturas recibidas de proveedores', icon: 'ri-shopping-cart-2-line', color: 'warning' },
  { path: '/contabilidad/pagos', title: 'Pagos a proveedores', desc: 'Registrar pagos emitidos a proveedores', icon: 'ri-bank-card-line', color: 'danger' },
  { path: '/contabilidad/documentos-soporte', title: 'Documento soporte (DSA)', desc: 'Soporte de gastos a no obligados a facturar', icon: 'ri-file-text-line', color: 'info' },
  { path: '/contabilidad/bancos', title: 'Conciliación bancaria', desc: 'Cruzar extractos con movimientos contables', icon: 'ri-bank-line', color: 'primary' },
];

/* ============================================================
 * PRODUCTOS Y SERVICIOS
 * ============================================================ */
const PRODUCTOS_FEATURED: Tile[] = [
  { path: '/contabilidad/productos-servicios', title: 'Productos y servicios', desc: 'Catálogo de productos y servicios que facturas. Códigos, precios, IVA y unidades. Empieza aquí para que la facturación fluya.', icon: 'ri-box-3-line', color: 'primary', featured: true },
];

const PRODUCTOS_TILES: Tile[] = [
  { path: '/contabilidad/kardex', title: 'Kardex (inventario)', desc: 'Movimientos de inventario costeados con promedio ponderado', icon: 'ri-stack-line', color: 'info' },
  { path: '/contabilidad/activos-fijos', title: 'Activos fijos', desc: 'Registro y depreciación mensual de equipos, vehículos y muebles', icon: 'ri-building-3-line', color: 'warning' },
];

/* ============================================================
 * REPORTES
 * ============================================================ */
const REPORTES_TILES: Tile[] = [
  // Financieros
  { path: '/contabilidad/consultas?view=balance', title: 'Balance general', desc: 'Activos, pasivos y patrimonio', icon: 'ri-scales-3-line', color: 'primary' },
  { path: '/contabilidad/consultas?view=pyg', title: 'Estado de resultados', desc: 'Ingresos, costos, gastos y utilidad', icon: 'ri-line-chart-line', color: 'success' },
  { path: '/contabilidad/consultas?view=flujo', title: 'Flujo de efectivo', desc: 'Entradas y salidas de caja', icon: 'ri-exchange-funds-line', color: 'info' },
  { path: '/contabilidad/consultas?view=patrimonio', title: 'Patrimonio', desc: 'Estado de cambios en el patrimonio', icon: 'ri-pie-chart-line', color: 'info' },
  // Oficiales
  { path: '/contabilidad/consultas?view=diario', title: 'Libro diario', desc: 'Cronológico de todos los asientos', icon: 'ri-book-open-line', color: 'primary' },
  { path: '/contabilidad/consultas?view=mayor', title: 'Libro mayor', desc: 'Movimientos agrupados por cuenta', icon: 'ri-book-2-line', color: 'secondary' },
  { path: '/contabilidad/consultas?view=auxiliar', title: 'Libro auxiliar', desc: 'Movimientos detallados por tercero', icon: 'ri-book-3-line', color: 'info' },
  { path: '/contabilidad/consultas?view=trial', title: 'Balance de comprobación', desc: 'Cuadre de saldos débito/crédito', icon: 'ri-check-double-line', color: 'success' },
  // Libros oficiales específicos
  { path: '/contabilidad/consultas?view=libro-ventas', title: 'Libro de ventas', desc: 'Registro oficial de ventas del período', icon: 'ri-store-2-line', color: 'success' },
  { path: '/contabilidad/consultas?view=libro-compras', title: 'Libro de compras', desc: 'Registro oficial de compras del período', icon: 'ri-shopping-cart-2-line', color: 'warning' },
  { path: '/contabilidad/consultas?view=libro-inventarios', title: 'Libro de inventarios', desc: 'Inventario físico valorado', icon: 'ri-stack-line', color: 'info' },
  // Cartera (sin view específico todavía, usa diario como fallback)
  { path: '/contabilidad/consultas?view=diario', title: 'Cartera por cliente', desc: 'Saldos pendientes de cobro', icon: 'ri-user-received-line', color: 'warning' },
  { path: '/contabilidad/consultas?view=diario', title: 'Cartera por proveedor', desc: 'Saldos pendientes de pago', icon: 'ri-user-shared-line', color: 'danger' },
  { path: '/contabilidad/consultas?view=diario', title: 'Vencimientos por edades', desc: '30/60/90/+90 días', icon: 'ri-time-line', color: 'warning' },
  // Impuestos
  { path: '/contabilidad/impuestos', title: 'Liquidación IVA', desc: 'IVA generado y descontable del período', icon: 'ri-percent-line', color: 'primary' },
  { path: '/contabilidad/impuestos', title: 'Retenciones (Rte Fuente/ICA)', desc: 'Bases, tarifas y totales', icon: 'ri-scissors-cut-line', color: 'warning' },
  { path: '/contabilidad/exogena', title: 'Medios magnéticos (exógena)', desc: 'Formatos DIAN 1001, 1003, 1007, 1008, 1009', icon: 'ri-file-download-line', color: 'dark' },
  // Facturación
  { path: '/contabilidad/dian', title: 'Estado DIAN', desc: 'Facturación electrónica y nómina electrónica', icon: 'ri-government-line', color: 'dark' },
  // Asientos (contabilidad pura)
  { path: '/contabilidad/capturar', title: 'Capturar asiento manual', desc: 'Registrar un comprobante contable manualmente', icon: 'ri-pencil-line', color: 'primary' },
];

/* ============================================================
 * CONFIGURACIÓN
 * ============================================================ */
const CONFIG_FEATURED: Tile[] = [
  { path: '/contabilidad/config/empresa', title: 'Datos de la Empresa', desc: 'NIT, razón social, dirección, logo, contacto. Esto va en todas las facturas.', icon: 'ri-building-line', color: 'primary', featured: true },
  { path: '/contabilidad/puc', title: 'Plan de cuentas (PUC)', desc: 'PUC Colombia 2025 precargado. Edita, agrega o desactiva cuentas. Base de toda la contabilidad.', icon: 'ri-list-check-2', color: 'info', featured: true },
  { path: '/contabilidad/centros-costo', title: 'Centros de costo', desc: 'Crea y gestiona los CC para clasificar ventas, compras y movimientos de inventario.', icon: 'ri-pie-chart-line', color: 'warning', featured: true },
  { path: '/contabilidad/config/terceros', title: 'Terceros', desc: 'Clientes, proveedores, empleados, socios. Una sola lista con filtros e importación masiva.', icon: 'ri-contacts-book-line', color: 'success', featured: true },
];

const CONFIG_TILES: Tile[] = [
  { path: '/contabilidad/config/contabilidad-maestra', title: 'Contabilidad maestra', desc: 'Cuentas por defecto, prefijos, año fiscal', icon: 'ri-calculator-line', color: 'primary' },
  { path: '/contabilidad/config/facturacion-electronica', title: 'Facturación electrónica (DIAN)', desc: 'Certificado, resolución, prefijos y radicación DIAN', icon: 'ri-government-line', color: 'success' },
  { path: '/contabilidad/configurar-fe', title: 'Asistente FE paso a paso', desc: 'Wizard guiado de configuración DIAN', icon: 'ri-magic-line', color: 'warning' },
  { path: '/contable/alegra', title: 'Configuración avanzada DIAN', desc: 'Integración técnica del proveedor de facturación electrónica', icon: 'ri-settings-3-line', color: 'dark' },
  { path: '/contabilidad/plantillas', title: 'Plantillas de asientos', desc: 'Asientos recurrentes reutilizables', icon: 'ri-file-copy-2-line', color: 'secondary' },
  { path: '/contabilidad/impuestos', title: 'Impuestos aplicables', desc: 'IVA, ReteFuente, ReteICA por ciudad', icon: 'ri-percent-line', color: 'info' },
];

/* ============================================================
 * TILE CARD
 * ============================================================ */
type TileCardProps = {
  tile: Tile;
  onClick: () => void;
  large?: boolean;
  extraBadge?: React.ReactNode;
};

const TileCard: React.FC<TileCardProps> = ({ tile, onClick, large, extraBadge }) => {
  const IconComp = ICON_MAP[tile.icon] || FileText;
  const avatarSize = large ? 72 : 60;
  const iconSize = large ? 36 : 30;
  return (
    <Card
      className="shadow-sm h-100"
      role="button"
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}
    >
      <CardBody className="d-flex align-items-start">
        <div
          className={`rounded-3 bg-${tile.color}-subtle d-flex align-items-center justify-content-center me-3`}
          style={{ width: avatarSize, height: avatarSize, flexShrink: 0 }}
        >
          <IconComp size={iconSize} className={`text-${tile.color}`} strokeWidth={1.75} />
        </div>
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <h6 className={`mb-0 ${large ? 'fs-17' : ''}`}>{tile.title}</h6>
            {tile.featured && (
              <Badge color="success" pill className="fs-11 d-inline-flex align-items-center gap-1">
                <Sparkles size={11} strokeWidth={2} />
                Empieza aquí
              </Badge>
            )}
            {extraBadge}
          </div>
          <div className="text-muted fs-13">{tile.desc}</div>
        </div>
        <ArrowRight size={20} className="text-muted ms-2 shrink-0" />
      </CardBody>
    </Card>
  );
};

/* ============================================================
 * HUB
 * ============================================================ */
const ContabilidadHub: React.FC = () => {
  document.title = 'Contabilidad | Bolti';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  const initialTab = ((): MainTab => {
    const q = searchParams.get('tab');
    const valid: MainTab[] = ['ventas', 'compras', 'productos', 'reportes', 'configuracion'];
    return (valid as string[]).includes(q || '') ? (q as MainTab) : 'ventas';
  })();
  const [activeTab, setActiveTab] = useState<MainTab>(initialTab);

  // Modal "Agregar tercero" desde Atajos rápidos
  const [addTpOpen, setAddTpOpen] = useState(false);

  const [feStatus, setFeStatus] = useState<FeStatus | null>(null);
  useEffect(() => {
    getFeStatus().then((r) => setFeStatus(r.data)).catch(() => {});
  }, []);

  const feBadge = (path: string): React.ReactNode => {
    if (!feStatus) return null;
    if (path !== '/contabilidad/config/facturacion-electronica' && path !== '/contabilidad/configurar-fe') return null;
    if (feStatus.ready) {
      return <Badge color="success" pill className="fs-11">FE lista</Badge>;
    }
    const labels: Record<string, string> = {
      company: 'falta empresa',
      test_set: 'falta set pruebas',
      resolution: 'falta resolución',
      resolution_muisca: 'falta vincular en MUISCA',
      fe_enabled: 'no habilitada',
    };
    return (
      <Badge color="warning" pill className="fs-11">
        {feStatus.missing.map((m) => labels[m] || m).join(' · ')}
      </Badge>
    );
  };

  const changeTab = (t: MainTab) => {
    setActiveTab(t);
    setSearchParams(t === 'ventas' ? {} : { tab: t }, { replace: true });
  };

  const TABS: Array<{ id: MainTab; label: string; Icon: React.ComponentType<any> }> = [
    { id: 'ventas', label: 'Ventas', Icon: Receipt },
    { id: 'compras', label: 'Compras', Icon: ShoppingCart },
    { id: 'productos', label: 'Productos y servicios', Icon: Box },
    { id: 'reportes', label: 'Reportes', Icon: LineChart },
    { id: 'configuracion', label: 'Configuración', Icon: SettingsIcon },
  ];

  return (
    <Container fluid className="py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-0">Contabilidad</h4>
          <div className="text-muted fs-13">Ventas, compras, inventario, reportes y configuración — todo en un solo lugar.</div>
        </div>
        <Dropdown isOpen={newOpen} toggle={() => setNewOpen(v => !v)}>
          <DropdownToggle color="primary" size="lg" className="d-inline-flex align-items-center gap-2">
            <Zap size={18} strokeWidth={2} />
            Atajos rápidos
            <ChevronDown size={16} strokeWidth={2} className="ms-1" />
          </DropdownToggle>
          <DropdownMenu end>
            <DropdownItem onClick={() => navigate('/contabilidad/factura-venta?nuevo=1')} className="d-flex align-items-center gap-2">
              <Receipt size={16} className="text-success" /> Factura de venta
            </DropdownItem>
            <DropdownItem onClick={() => navigate('/cotizaciones?nuevo=1')} className="d-flex align-items-center gap-2">
              <FileText size={16} className="text-info" /> Cotización
            </DropdownItem>
            <DropdownItem onClick={() => navigate('/contabilidad/soporte-venta')} className="d-flex align-items-center gap-2">
              <FileText size={16} className="text-info" /> Soporte de venta
            </DropdownItem>
            <DropdownItem onClick={() => navigate('/contabilidad/compras')} className="d-flex align-items-center gap-2">
              <ShoppingCart size={16} className="text-warning" /> Factura de compra
            </DropdownItem>
            <DropdownItem onClick={() => navigate('/contabilidad/capturar')} className="d-flex align-items-center gap-2">
              <Pencil size={16} className="text-primary" /> Capturar comprobante
            </DropdownItem>
            <DropdownItem onClick={() => navigate('/contabilidad/notas/credito')} className="d-flex align-items-center gap-2">
              <FileMinus size={16} className="text-success" /> Nota crédito
            </DropdownItem>
            <DropdownItem onClick={() => navigate('/contabilidad/notas/debito')} className="d-flex align-items-center gap-2">
              <FilePlus size={16} className="text-warning" /> Nota débito
            </DropdownItem>
            <DropdownItem divider />
            <DropdownItem onClick={() => setAddTpOpen(true)} className="d-flex align-items-center gap-2">
              <UserPlus size={16} className="text-info" /> Agregar tercero
            </DropdownItem>
            <DropdownItem onClick={() => navigate('/contabilidad/centros-costo')} className="d-flex align-items-center gap-2">
              <PieChart size={16} className="text-warning" /> Centro de costo
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      {/* Modal "Agregar tercero" — componente reutilizable */}
      <NuevoTerceroModal isOpen={addTpOpen} onClose={() => setAddTpOpen(false)} />

      {/* Estado de configuración electrónica (visible al entrar) */}
      {feStatus && (!feStatus.ready || !feStatus.payroll.ready) && (
        <Card className="shadow-sm mb-3 border-warning" style={{ borderLeftWidth: 4 }}>
          <CardBody className="py-3">
            <div className="d-flex align-items-start gap-3 flex-wrap">
              <div
                className="rounded-3 bg-warning-subtle d-flex align-items-center justify-content-center"
                style={{ width: 48, height: 48, flexShrink: 0 }}
              >
                <i className="ri-government-line fs-22 text-warning" />
              </div>
              <div className="flex-grow-1" style={{ minWidth: 280 }}>
                <div className="fw-semibold mb-1">Configuración electrónica DIAN</div>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <Badge color={feStatus.ready ? 'success' : 'warning'} className="fs-12 px-2 py-1">
                    <i className={feStatus.ready ? 'ri-check-line me-1' : 'ri-error-warning-line me-1'} />
                    Facturación: {feStatus.ready ? 'lista' : (feStatus.missing || []).map(m => ({company: 'falta empresa', test_set: 'falta set pruebas', resolution: 'falta resolución', resolution_muisca: 'falta vincular en MUISCA', fe_enabled: 'no habilitada'} as Record<string,string>)[m] || m).join(' · ')}
                  </Badge>
                  <Badge color={feStatus.payroll.ready ? 'success' : 'warning'} className="fs-12 px-2 py-1">
                    <i className={feStatus.payroll.ready ? 'ri-check-line me-1' : 'ri-error-warning-line me-1'} />
                    Nómina: {feStatus.payroll.ready ? 'lista' : (feStatus.payroll.missing || []).map(m => ({company:'falta empresa',test_set:'falta set pruebas',alegra_token:'falta token',payroll_api:'falta endpoint',employees:'sin empleados'} as Record<string,string>)[m] || m).join(' · ').replace(/Alegra/gi, '')}
                  </Badge>
                </div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                {!feStatus.ready && (
                  <Button color="warning" size="sm" onClick={() => navigate('/contabilidad/configurar-fe')}>
                    <i className="ri-magic-line me-1" /> Configurar FE
                  </Button>
                )}
                {!feStatus.payroll.ready && (
                  <Button color="warning" outline size="sm" onClick={() => navigate('/nomina-hub/nomina-electronica')}>
                    <i className="ri-government-line me-1" /> Configurar nómina
                  </Button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Main tabs — 5 top-level */}
      <Nav tabs className="mb-3 nav-tabs-custom">
        {TABS.map(t => (
          <NavItem key={t.id}>
            <NavLink
              role="button"
              active={activeTab === t.id}
              onClick={() => changeTab(t.id)}
              className="fs-15 px-3 py-2 d-inline-flex align-items-center gap-2"
            >
              <t.Icon size={18} strokeWidth={1.75} />
              {t.label}
            </NavLink>
          </NavItem>
        ))}
      </Nav>

      <TabContent activeTab={activeTab}>
        {/* VENTAS */}
        <TabPane tabId="ventas">
          <Row className="g-3">
            {VENTAS_TILES.map((t, i) => (
              <Col md={6} xl={4} key={`${t.path}-${i}`}>
                <TileCard tile={t} onClick={() => navigate(t.path)} />
              </Col>
            ))}
          </Row>
        </TabPane>

        {/* COMPRAS */}
        <TabPane tabId="compras">
          <Row className="g-3">
            {COMPRAS_TILES.map((t, i) => (
              <Col md={6} xl={4} key={`${t.path}-${i}`}>
                <TileCard tile={t} onClick={() => navigate(t.path)} />
              </Col>
            ))}
          </Row>
        </TabPane>

        {/* PRODUCTOS Y SERVICIOS */}
        <TabPane tabId="productos">
          <ProductosServicios />
        </TabPane>

        {/* REPORTES */}
        <TabPane tabId="reportes">
          <Row className="g-3">
            {REPORTES_TILES.map((t, i) => (
              <Col md={6} xl={4} key={`${t.path}-${t.title}-${i}`}>
                <TileCard tile={t} onClick={() => navigate(t.path)} />
              </Col>
            ))}
          </Row>
        </TabPane>

        {/* CONFIGURACIÓN */}
        <TabPane tabId="configuracion">
          <Row className="g-3">
            {[...CONFIG_FEATURED, ...CONFIG_TILES].map((t, i) => (
              <Col md={6} xl={4} key={`${t.path}-${t.title}-${i}`}>
                <TileCard tile={t} onClick={() => navigate(t.path)} extraBadge={feBadge(t.path)} />
              </Col>
            ))}
          </Row>
        </TabPane>
      </TabContent>
    </Container>
  );
};

export default ContabilidadHub;
