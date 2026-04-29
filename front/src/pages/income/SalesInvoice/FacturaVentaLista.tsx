import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Card,
  CardBody,
  CardHeader,
  Row as ReactstrapRow,
  Col,
  Label,
  Table,
  Badge,
  Button,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Input,
  Alert,
  Spinner,
  Offcanvas,
  OffcanvasHeader,
  OffcanvasBody,
} from 'reactstrap';
import {
  Plus,
  MoreVertical,
  Download,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  ChevronDown,
  FileText,
  Receipt,
  CheckCheck,
  Clock,
  Send,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { env } from '../../../env';
import { api } from '../../../services/api';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import FacturaNuevaModal from './FacturaNuevaModal';
import NotaFormDrawer, { NotaKind } from './NotaFormDrawer';
import FacturaTab from './tabs/FacturaTab';
import type { DocumentConfig } from './Create';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_identification?: string;
  client_nit?: string;
  client_document_number?: string;
  date_issue: string;
  status: string;
  dian_status: string;
  total: number | string;
  paid?: number | string;
  paid_amount?: number | string;
  balance?: number | string;
  balance_amount?: number | string;
}

interface Row {
  id: string;
  number: string;
  client: string;
  clientNit: string;
  date: string;
  dateRaw: string;
  total: number;
  balance: number | null;
  status: string;
  dianStatus: string;
}

const ITEMS_PER_PAGE = 10;

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const toIso = (d: Date): string => d.toISOString().slice(0, 10);

const todayIso = (): string => toIso(new Date());

const daysAgoIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIso(d);
};

const formatDate = (iso: string): string => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return iso;
  }
};

const formatMoney = (n: number | null | undefined): string => {
  const value = Number(n) || 0;
  return `$${value.toLocaleString('es-CO')}`;
};

// Same visual vocabulary as Compras (success/warning/danger subtle via reactstrap Badge color)
const getStatusBadge = (status: string): { label: string; color: string } => {
  const s = (status || '').toUpperCase();
  if (s === 'PAGADA') return { label: 'Pagada', color: 'success' };
  if (s === 'PENDIENTE') return { label: 'Pendiente', color: 'warning' };
  if (s === 'ANULADA') return { label: 'Anulada', color: 'danger' };
  if (s === 'BORRADOR') return { label: 'Borrador', color: 'secondary' };
  if (s === 'ENVIADA') return { label: 'Enviada', color: 'info' };
  if (s === 'ACEPTADA') return { label: 'Aceptada', color: 'success' };
  if (s === 'RECHAZADA') return { label: 'Rechazada', color: 'danger' };
  return { label: status || 'Desconocida', color: 'secondary' };
};

const getDianBadge = (dianStatus: string): { label: string; color: string } => {
  const s = (dianStatus || '').toUpperCase();
  if (s.startsWith('APROBADA')) {
    return { label: s === 'APROBADA_MOCK' ? 'Aprobada (mock)' : 'Aprobada', color: 'success' };
  }
  if (s.startsWith('RECHAZADA')) return { label: 'Rechazada', color: 'danger' };
  if (s.startsWith('PENDIENTE')) return { label: 'Pendiente', color: 'warning' };
  if (s.startsWith('ENVIADA')) return { label: 'Enviada', color: 'info' };
  if (!dianStatus) return { label: '—', color: 'secondary' };
  return { label: dianStatus, color: 'secondary' };
};

// ──────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────

const FacturaVentaLista: React.FC = () => {
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [notaDrawer, setNotaDrawer] = useState<{ open: boolean; kind: NotaKind; invoiceId: string | null }>({ open: false, kind: 'credit', invoiceId: null });

  // Filters (client-side)
  const [startDate, setStartDate] = useState<string>(daysAgoIso(30));
  const [endDate, setEndDate] = useState<string>(todayIso());
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dianFilter, setDianFilter] = useState<string>('');

  // ── Load invoices (todos los filtros van al backend)
  const loadInvoices = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setNeedsAuth(true);
      setLoading(false);
      return;
    }
    setNeedsAuth(false);
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (startDate) qs.append('startDate', startDate);
      if (endDate) qs.append('endDate', endDate);
      if (statusFilter) qs.append('status', statusFilter);
      if (dianFilter) qs.append('dianStatus', dianFilter);
      const q = searchTerm.trim();
      if (q) qs.append('search', q);
      const response = await fetch(`${env.API_URL}/invoices?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Error al cargar facturas');
      const data = await response.json();
      const mapped: Row[] = (data.invoices || []).map((inv: Invoice) => {
        const total = Number(inv.total) || 0;
        const paid =
          inv.paid_amount != null
            ? Number(inv.paid_amount)
            : inv.paid != null
            ? Number(inv.paid)
            : null;
        const balanceFromBackend =
          inv.balance_amount != null
            ? Number(inv.balance_amount)
            : inv.balance != null
            ? Number(inv.balance)
            : null;
        const balance =
          balanceFromBackend != null
            ? balanceFromBackend
            : paid != null
            ? Math.max(0, total - paid)
            : null;
        const clientNit =
          inv.client_identification ||
          inv.client_nit ||
          inv.client_document_number ||
          '';
        return {
          id: inv.id,
          number: inv.invoice_number,
          client: inv.client_name,
          clientNit,
          date: formatDate(inv.date_issue),
          dateRaw: inv.date_issue,
          total,
          balance,
          status: inv.status,
          dianStatus: inv.dian_status,
        };
      });
      setRows(mapped);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, statusFilter, dianFilter, searchTerm]);

  // Dispara loadInvoices al cambiar cualquier filtro. Debounce de 300 ms
  // para no pegarle al backend en cada tecla del search.
  useEffect(() => {
    const t = setTimeout(() => { loadInvoices(); }, 300);
    return () => clearTimeout(t);
  }, [loadInvoices]);

  // ── Filter (client-side): date range + status + dian + search
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    return rows.filter(r => {
      // Date range
      if (r.dateRaw) {
        const rd = new Date(r.dateRaw);
        if (!Number.isNaN(rd.getTime())) {
          if (start && rd < start) return false;
          if (end && rd > end) return false;
        }
      }
      // Status
      if (statusFilter && (r.status || '').toUpperCase() !== statusFilter) {
        return false;
      }
      // DIAN
      if (dianFilter && (r.dianStatus || '').toUpperCase() !== dianFilter) {
        return false;
      }
      // Search
      if (q) {
        const hay =
          (r.number || '').toLowerCase() +
          ' ' +
          (r.client || '').toLowerCase() +
          ' ' +
          (r.clientNit || '').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, searchTerm, startDate, endDate, statusFilter, dianFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, statusFilter, dianFilter]);

  // ── KPIs computed on the visible (filtered) set
  const kpis = useMemo(() => {
    let total = 0;
    let cobrado = 0;
    let pendiente = 0;
    let rechazadas = 0;
    filtered.forEach(r => {
      const t = Number(r.total) || 0;
      total += t;
      const statusUpper = (r.status || '').toUpperCase();
      if (statusUpper === 'PAGADA') cobrado += t;
      else if (statusUpper === 'PENDIENTE') pendiente += r.balance != null ? r.balance : t;
      if ((r.dianStatus || '').toUpperCase() === 'RECHAZADA') rechazadas += 1;
    });
    return { total, cobrado, pendiente, rechazadas };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageClamped = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (pageClamped - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, pageClamped]);

  // ── Actions
  // Abre el drawer con FacturaTab (mismo patrón que Compras/Offcanvas).
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const goCreate = () => setCreateDrawerOpen(true);

  // Auto-abrir drawer si la URL trae ?nuevo=1 (atajo rápido / redirect /crear)
  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      setCreateDrawerOpen(true);
      // limpiar el query param para que navegar atrás no reabra
      const next = new URLSearchParams(searchParams);
      next.delete('nuevo');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleInvoiceSaved = (_invoice: any) => {
    setModalOpen(false);
    loadInvoices();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStartDate(daysAgoIso(30));
    setEndDate(todayIso());
    setStatusFilter('');
    setDianFilter('');
  };

  const notifyComingSoon = (label: string) => {
    try {
      toast.info(`${label}: próximamente`);
    } catch {
      // eslint-disable-next-line no-alert
      alert(`${label}: próximamente`);
    }
  };

  const handleDownloadXML = async (invoiceId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${env.API_URL}/invoices/${invoiceId}/download-xml`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error('Error al descargar XML');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${invoiceId}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      try {
        toast.error(err?.message || 'Error al descargar XML');
      } catch {
        alert(err?.message || 'Error al descargar XML');
      }
    }
  };

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${env.API_URL}/invoices/${invoiceId}/download-pdf`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error('Error al descargar PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      try {
        toast.error(err?.message || 'Error al descargar PDF');
      } catch {
        alert(err?.message || 'Error al descargar PDF');
      }
    }
  };

  const handleView = async (invoiceId: string) => {
    try {
      // Primero intentamos con el endpoint local (funciona siempre).
      // Si no responde, fallback a /alegra/invoices/:id (solo si la factura fue enviada a DIAN).
      let inv: any = null;
      try {
        const { data } = await api.get(`/invoices/${invoiceId}`);
        inv = data?.invoice || data?.data || data;
      } catch {
        try {
          const { data } = await api.get(`/alegra/invoices/${invoiceId}`);
          inv = data?.data || data?.invoice || data;
        } catch { /* noop */ }
      }
      if (!inv) throw new Error('Factura no encontrada');
      await Swal.fire({
        title: `Factura ${inv?.invoice_number || inv?.number || invoiceId}`,
        html: `
          <div style="text-align:left; font-size:13px; line-height: 1.7;">
            <div><strong>Cliente:</strong> ${inv?.client_name || inv?.clientName || '—'}</div>
            <div><strong>NIT:</strong> ${inv?.client_document_number || inv?.clientNit || '—'}</div>
            <div><strong>Fecha:</strong> ${inv?.date || inv?.issueDate || '—'}</div>
            <div><strong>Estado:</strong> ${inv?.status || '—'}</div>
            <div><strong>DIAN:</strong> ${inv?.dian_status || inv?.dianStatus || '—'}</div>
            <div><strong>Total:</strong> $${Number(inv?.total || 0).toLocaleString('es-CO')}</div>
            <div style="margin-top:8px;"><strong>CUFE:</strong></div>
            <div style="font-family:monospace; font-size:11px; color:#6b7280; word-break:break-all;">${inv?.cufe || '—'}</div>
          </div>
        `,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#1A1D1F',
        width: 560,
      });
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo cargar';
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    }
  };

  const handleEdit = (invoiceId: string) => {
    // Solo es editable si la factura está en BORRADOR y no se envió a DIAN.
    // Por ahora redirige al formulario en modo edición; el backend rechaza con 409 si no aplica.
    navigate(`/ingresos/factura/${invoiceId}/editar`);
  };

  const handleAnular = async (invoiceId: string) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: '¿Anular factura?',
      input: 'textarea',
      inputLabel: 'Motivo (obligatorio)',
      inputPlaceholder: 'Ej: Datos del cliente incorrectos',
      inputValidator: (v) => (!v || v.trim().length < 5) ? 'Indica un motivo (mín. 5 caracteres)' : null,
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      await api.post(`/invoices/${invoiceId}/cancel`, { reason: confirm.value });
      Swal.fire({ icon: 'success', title: 'Factura anulada', timer: 1600, showConfirmButton: false });
      loadInvoices();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo anular';
      Swal.fire({ icon: 'error', title: 'No se anuló', text: msg });
    }
  };

  const handleCreateCreditNote = (invoiceId: string) => {
    setNotaDrawer({ open: true, kind: 'credit', invoiceId });
  };

  const handleCreateDebitNote = (invoiceId: string) => {
    setNotaDrawer({ open: true, kind: 'debit', invoiceId });
  };

  // Enviar/reenviar una factura al DIAN con feedback tipo SweetAlert.
  const handleSendToDian = async (invoiceId: string) => {
    const confirm = await Swal.fire({
      icon: 'question',
      title: '¿Enviar factura a la DIAN?',
      text: 'Se enviará con los datos actualmente guardados. Si el envío es aceptado, la DIAN asignará un CUFE.',
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A1D1F',
    });
    if (!confirm.isConfirmed) return;

    // Modal de progreso
    Swal.fire({
      title: 'Enviando a la DIAN…',
      html: 'No cierres esta ventana. Esto puede tardar unos segundos.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading(null);
      },
    });

    try {
      const { data } = await api.post(`/alegra/invoices/${invoiceId}/send`);
      Swal.close();

      if (data?.success && data?.dian?.sent) {
        const cufe = data.dian.cufe || 'N/A';
        const status = data.dian.dianStatus || 'ENVIADA';
        await Swal.fire({
          icon: 'success',
          title: 'Factura enviada correctamente',
          html: `
            <div style="text-align: left; font-size: 13px;">
              <div><strong>Estado DIAN:</strong> ${status}</div>
              <div style="margin-top: 8px;"><strong>CUFE:</strong></div>
              <div style="word-break: break-all; font-family: monospace; font-size: 11px; color: #6b7280; margin-top: 4px;">${cufe}</div>
            </div>
          `,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#1A1D1F',
        });
        loadInvoices();
      } else {
        throw new Error(data?.error || 'La DIAN no confirmó el envío');
      }
    } catch (e: any) {
      Swal.close();
      const respData = e?.response?.data;
      const msg = respData?.error || e?.message || 'Error desconocido';
      const details = respData?.details
        ? `<pre style="text-align:left; font-size:11px; background:#f9fafb; padding:8px; border-radius:4px; max-height:200px; overflow:auto;">${
            typeof respData.details === 'string'
              ? respData.details
              : JSON.stringify(respData.details, null, 2)
          }</pre>`
        : '';
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo enviar a la DIAN',
        html: `<div style="text-align:left; font-size:13px;"><strong>Mensaje:</strong> ${msg}${details}</div>`,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#dc3545',
      });
      loadInvoices();
    }
  };

  const canSendToDian = (row: Row): boolean => {
    const d = (row.dianStatus || '').toUpperCase();
    const s = (row.status || '').toUpperCase();
    // Se puede enviar si está en borrador, o si ya se intentó y falló, o si nunca se envió.
    return (
      s === 'BORRADOR' ||
      d === 'ERROR' ||
      d === 'PENDIENTE' ||
      d === '' ||
      d === 'NO_APLICA'
    );
  };

  // ──────────────────────────────────────────────────────────────
  // KPI card (Compras-style: avatar-sm rounded bg-{color}-subtle + value in monospace)
  // ──────────────────────────────────────────────────────────────
  const KpiCard: React.FC<{
    label: string;
    value: React.ReactNode;
    Icon: React.ComponentType<any>;
    color: 'primary' | 'success' | 'warning' | 'danger';
  }> = ({ label, value, Icon, color }) => (
    <Card className="border-0 shadow-sm h-100 mb-0">
      <CardBody>
        <div className="d-flex align-items-center gap-3">
          <div
            className={`rounded bg-${color}-subtle d-flex align-items-center justify-content-center flex-shrink-0`}
            style={{ width: 52, height: 52 }}
          >
            <Icon size={26} strokeWidth={1.75} className={`text-${color}`} />
          </div>
          <div className="flex-grow-1 min-w-0">
            <div className="text-muted small mb-1">{label}</div>
            <h5 className="mb-0 font-monospace text-truncate">{value}</h5>
          </div>
        </div>
      </CardBody>
    </Card>
  );

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  const dataReady = !needsAuth && !loading && !error;

  return (
    <Container fluid className="py-3">
      {/* Header tipo Compras: card con título a la izquierda y acciones a la derecha */}
      <Card className="mb-3">
        <CardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 className="mb-0">Facturas de venta</h5>
            <small className="text-muted">Facturas de venta emitidas a clientes (FV)</small>
          </div>
          <div className="d-flex gap-2">
          <UncontrolledDropdown>
            <DropdownToggle caret color="light" className="d-inline-flex align-items-center gap-1">
              <FileText size={14} /> Ver reportes <ChevronDown size={14} />
            </DropdownToggle>
            <DropdownMenu end>
              <DropdownItem tag={Link} to="/contabilidad/documento-ingreso">
                Documentos de venta
              </DropdownItem>
              <DropdownItem onClick={() => notifyComingSoon('Comprobante información diaria')}>
                Comprobante información diaria
              </DropdownItem>
              <DropdownItem onClick={() => notifyComingSoon('Comparativo de ventas por mes')}>
                Comparativo de ventas por mes
              </DropdownItem>
              <DropdownItem onClick={() => notifyComingSoon('Ventas por cliente')}>
                Ventas por cliente
              </DropdownItem>
              <DropdownItem onClick={() => notifyComingSoon('Ventas por vendedor')}>
                Ventas por vendedor
              </DropdownItem>
              <DropdownItem onClick={() => notifyComingSoon('Ventas por producto')}>
                Ventas por producto
              </DropdownItem>
              <DropdownItem divider />
              <DropdownItem tag={Link} to="/contabilidad?tab=reportes">
                Ver más reportes
              </DropdownItem>
            </DropdownMenu>
          </UncontrolledDropdown>

          <Button
            color="primary"
            className="d-inline-flex align-items-center gap-1"
            onClick={goCreate}
          >
            <Plus size={14} /> Nueva factura de venta
          </Button>
          </div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <ReactstrapRow className="g-3 mb-3">
        <Col md={6} xl={3}>
          <KpiCard
            label="Total facturado"
            value={dataReady ? formatMoney(kpis.total) : <Spinner size="sm" />}
            Icon={Receipt}
            color="primary"
          />
        </Col>
        <Col md={6} xl={3}>
          <KpiCard
            label="Cobrado"
            value={dataReady ? formatMoney(kpis.cobrado) : <Spinner size="sm" />}
            Icon={CheckCheck}
            color="success"
          />
        </Col>
        <Col md={6} xl={3}>
          <KpiCard
            label="Pendiente"
            value={dataReady ? formatMoney(kpis.pendiente) : <Spinner size="sm" />}
            Icon={Clock}
            color="warning"
          />
        </Col>
        <Col md={6} xl={3}>
          <KpiCard
            label="DIAN rechazadas"
            value={dataReady ? kpis.rechazadas.toLocaleString('es-CO') : <Spinner size="sm" />}
            Icon={AlertTriangle}
            color="danger"
          />
        </Col>
      </ReactstrapRow>

      {/* Filters bar */}
      <Card className="border-0 shadow-sm mb-3">
        <CardBody>
          <ReactstrapRow className="g-2 align-items-end">
            <Col md={2}>
              <Label className="form-label mb-1 small">Desde</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Label className="form-label mb-1 small">Hasta</Label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Label className="form-label mb-1 small">Estado</Label>
              <Input
                type="select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="PAGADA">Pagada</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="ANULADA">Anulada</option>
                <option value="BORRADOR">Borrador</option>
              </Input>
            </Col>
            <Col md={2}>
              <Label className="form-label mb-1 small">Estado DIAN</Label>
              <Input
                type="select"
                value={dianFilter}
                onChange={e => setDianFilter(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="APROBADA">Aprobada</option>
                <option value="RECHAZADA">Rechazada</option>
                <option value="PENDIENTE">Pendiente</option>
              </Input>
            </Col>
            <Col md={3}>
              <Label className="form-label mb-1 small">Buscar</Label>
              <div className="position-relative">
                <i
                  className="ri-search-line position-absolute"
                  style={{ left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888' }}
                />
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Número, cliente o NIT"
                  style={{ paddingLeft: 30 }}
                />
              </div>
            </Col>
            <Col md={1} className="d-flex">
              <Button color="light" className="w-100" onClick={clearFilters} title="Limpiar filtros">
                Limpiar
              </Button>
            </Col>
          </ReactstrapRow>
        </CardBody>
      </Card>

      {/* Main Card */}
      <Card className="border-0 shadow-sm">
        <CardBody>
          {needsAuth ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-2 text-center">
              <i className="ri-lock-2-line" style={{ fontSize: 48, color: '#f0ad4e' }} />
              <h6 className="mb-1 fw-semibold">Sesión requerida</h6>
              <p className="text-muted small mb-2">
                Inicia sesión para ver y gestionar tus facturas de venta.
              </p>
              <Button color="primary" onClick={() => navigate('/login')}>
                Ir a iniciar sesión
              </Button>
            </div>
          ) : loading ? (
            <div className="d-flex justify-content-center align-items-center py-5">
              <Spinner color="primary" />
            </div>
          ) : error ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-2 text-center">
              <AlertTriangle size={48} className="text-danger" />
              <h6 className="mb-1 fw-semibold">No pudimos conectar con el servidor</h6>
              <p className="text-muted small mb-2" style={{ maxWidth: 420 }}>
                {error.includes('fetch') || error.includes('Failed')
                  ? 'El backend no responde. Revisa que esté corriendo o configura VITE_API_URL en front/.env.'
                  : error}
              </p>
              <Button color="danger" onClick={loadInvoices}>
                Reintentar
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-2 text-center">
              <i className="ri-file-list-3-line" style={{ fontSize: 48, color: '#adb5bd' }} />
              <h6 className="mb-1 fw-semibold">
                {rows.length === 0
                  ? 'Todavía no hay facturas. Crea la primera.'
                  : 'Sin facturas con los filtros actuales.'}
              </h6>
              <p className="text-muted small mb-2">
                {rows.length === 0
                  ? 'Emite tu primera factura electrónica para empezar.'
                  : 'Probá ajustando el rango de fechas o limpiando los filtros.'}
              </p>
              <div className="d-flex gap-2">
                {rows.length > 0 && (
                  <Button color="light" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                )}
                <Button
                  color="primary"
                  className="d-inline-flex align-items-center gap-1"
                  onClick={goCreate}
                >
                  <Plus size={14} /> Crear factura
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>N° Factura</th>
                      <th>Cliente</th>
                      <th>Fecha</th>
                      <th className="text-end">Total</th>
                      <th className="text-end">Saldo</th>
                      <th>Estado</th>
                      <th>DIAN</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(row => {
                      const statusBadge = getStatusBadge(row.status);
                      const dianBadge = getDianBadge(row.dianStatus);
                      return (
                        <tr key={row.id}>
                          <td className="fw-medium">{row.number}</td>
                          <td>
                            <div className="fw-medium">{row.client}</div>
                            <div className="text-muted small">{row.clientNit || '—'}</div>
                          </td>
                          <td>{row.date}</td>
                          <td className="text-end fw-semibold font-monospace">
                            {formatMoney(row.total)}
                          </td>
                          <td className="text-end font-monospace">
                            {row.balance != null ? (
                              <span className={row.balance > 0 ? 'text-warning fw-medium' : 'text-muted'}>
                                {formatMoney(row.balance)}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <Badge color={statusBadge.color} pill>
                              {statusBadge.label}
                            </Badge>
                          </td>
                          <td>
                            <Badge color={dianBadge.color} pill>
                              {dianBadge.label}
                            </Badge>
                          </td>
                          <td className="text-end">
                            {/* container="body" portea al body (escapa overflow del table-responsive).
                                strategy="fixed" ancla al viewport. Ancho fijo + clases de reactstrap
                                para que cada item respete su fila y no se solapen. */}
                            <UncontrolledDropdown>
                              <DropdownToggle
                                tag="button"
                                className="btn btn-sm btn-light border-0 p-1"
                                aria-label="Acciones"
                              >
                                <MoreVertical size={16} />
                              </DropdownToggle>
                              <DropdownMenu
                                end
                                container="body"
                                strategy="fixed"
                                style={{ minWidth: 220, zIndex: 1080, padding: '6px 0' }}
                              >
                                {canSendToDian(row) && (
                                  <>
                                    <DropdownItem
                                      onClick={() => handleSendToDian(row.id)}
                                      style={{ padding: '10px 16px', fontWeight: 600, color: '#16a34a' }}
                                      className="d-flex align-items-center"
                                    >
                                      <Send size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                      <span>Enviar a DIAN</span>
                                    </DropdownItem>
                                    <DropdownItem divider />
                                  </>
                                )}
                                <DropdownItem
                                  onClick={() => handleView(row.id)}
                                  style={{ padding: '10px 16px' }}
                                  className="d-flex align-items-center"
                                >
                                  <Eye size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Ver factura</span>
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => navigate(`/contabilidad/cobros?invoiceId=${row.id}`)}
                                  style={{ padding: '10px 16px', color: '#16a34a', fontWeight: 600 }}
                                  className="d-flex align-items-center"
                                >
                                  <Receipt size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Registrar cobro</span>
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => handleEdit(row.id)}
                                  style={{ padding: '10px 16px' }}
                                  className="d-flex align-items-center"
                                >
                                  <Pencil size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Editar</span>
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => handleDownloadXML(row.id)}
                                  style={{ padding: '10px 16px' }}
                                  className="d-flex align-items-center"
                                >
                                  <Download size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Descargar XML</span>
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => handleDownloadPDF(row.id)}
                                  style={{ padding: '10px 16px' }}
                                  className="d-flex align-items-center"
                                >
                                  <Download size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Descargar PDF</span>
                                </DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem
                                  onClick={() => handleCreateCreditNote(row.id)}
                                  style={{ padding: '10px 16px', color: '#7c3aed' }}
                                  className="d-flex align-items-center"
                                >
                                  <TrendingDown size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Crear nota crédito</span>
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => handleCreateDebitNote(row.id)}
                                  style={{ padding: '10px 16px', color: '#db2777' }}
                                  className="d-flex align-items-center"
                                >
                                  <TrendingUp size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Crear nota débito</span>
                                </DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem
                                  onClick={() => handleAnular(row.id)}
                                  style={{ padding: '10px 16px', color: '#dc2626' }}
                                  className="d-flex align-items-center"
                                >
                                  <Trash2 size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Anular</span>
                                </DropdownItem>
                              </DropdownMenu>
                            </UncontrolledDropdown>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="d-flex align-items-center justify-content-between mt-3">
                <span className="text-muted small">
                  {filtered.length} factura{filtered.length === 1 ? '' : 's'}
                </span>
                <div className="d-flex align-items-center gap-2">
                  <Button
                    size="sm"
                    color="light"
                    disabled={pageClamped <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    « Anterior
                  </Button>
                  <span className="small text-muted">
                    página {pageClamped} de {totalPages}
                  </span>
                  <Button
                    size="sm"
                    color="light"
                    disabled={pageClamped >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    Siguiente »
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Drawer de creación de factura de venta — mismo patrón que Compras */}
      <Offcanvas
        direction="end"
        isOpen={createDrawerOpen}
        toggle={() => setCreateDrawerOpen(!createDrawerOpen)}
        style={{ width: '95vw', maxWidth: 1180 }}
      >
        <OffcanvasHeader toggle={() => setCreateDrawerOpen(false)}>
          <div>
            <h5 className="mb-0">Nueva factura de venta</h5>
            <small className="text-muted">Documento fiscal electrónico DIAN</small>
          </div>
        </OffcanvasHeader>
        <OffcanvasBody className="p-0">
          {createDrawerOpen && (
            <FacturaTab
              config={{
                title: 'Factura de venta',
                subtitle: 'Documento fiscal electrónico DIAN',
                icon: '📄',
                color: '#00BFA5',
                numberLabel: 'Factura No.',
              } as DocumentConfig}
            />
          )}
        </OffcanvasBody>
      </Offcanvas>

      {/* Modal de creación rápida (legacy) — mantenido por si se usa programáticamente */}
      <FacturaNuevaModal
        isOpen={modalOpen}
        toggle={() => setModalOpen(false)}
        onSaved={handleInvoiceSaved}
      />

      {/* Drawer de nota crédito / débito — mismo form que el módulo de Notas */}
      <NotaFormDrawer
        isOpen={notaDrawer.open}
        toggle={() => setNotaDrawer(prev => ({ ...prev, open: false }))}
        kind={notaDrawer.kind}
        preloadInvoiceId={notaDrawer.invoiceId}
        onSaved={() => {
          setNotaDrawer({ open: false, kind: notaDrawer.kind, invoiceId: null });
          loadInvoices();
        }}
      />
    </Container>
  );
};

export default FacturaVentaLista;
