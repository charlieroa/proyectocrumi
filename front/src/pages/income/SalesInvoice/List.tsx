import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText,
  ClipboardList,
  Package,
  Wallet,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  FileMinus,
  FileEdit,
  Search,
  SlidersHorizontal,
  Plus,
  Download,
  Eye,
  FileCode,
  Pencil,
  Trash2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Inbox,
  ArrowLeft,
} from 'lucide-react';
import { env } from '../../../env';

type ModuleType = 'ingresos' | 'gastos';
type DocumentType = 'facturas' | 'cotizaciones' | 'remisiones' | 'pagos' | 'devoluciones' | 'notas-debito';

interface DocumentConfig {
  title: string;
  description: string;
  icon: React.FC<any>;
  color: string;
  emptyMessage: string;
  createRoute: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  date_issue: string;
  status: string;
  dian_status: string;
  total: number;
}

const PURCHASE_DOCUMENT_TYPE_MAP: Record<DocumentType, string | null> = {
  facturas: 'FACTURA_PROVEEDOR',
  cotizaciones: 'ORDEN_COMPRA',
  remisiones: 'DOCUMENTO_SOPORTE',
  pagos: null,
  devoluciones: 'NOTA_AJUSTE_COMPRA',
  'notas-debito': 'NOTA_DEBITO_PROVEEDOR',
};

const DocumentList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [module, setModule] = useState<ModuleType>((searchParams.get('modulo') as ModuleType) || 'ingresos');
  const [documentType, setDocumentType] = useState<DocumentType>((searchParams.get('tipo') as DocumentType) || 'facturas');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const getStatusLabel = (status: string, dianStatus?: string) => {
    if (dianStatus === 'APROBADA') return 'Aprobada DIAN';
    if (dianStatus === 'RECHAZADA') return 'Rechazada DIAN';
    if (dianStatus === 'BORRADOR' || status === 'BORRADOR') return 'Borrador';
    if (status === 'PAGADA') return 'Pagada';
    if (status === 'PENDIENTE') return 'Pendiente';
    if (status === 'APLICADA') return 'Aplicada';
    if (status === 'ANULADA') return 'Anulada';
    return status || 'Desconocido';
  };

  const getStatusColor = (status: string, dianStatus?: string) => {
    if (dianStatus === 'APROBADA') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (dianStatus === 'RECHAZADA') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (dianStatus === 'BORRADOR' || status === 'BORRADOR') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (status === 'PAGADA') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (status === 'PENDIENTE') return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    if (status === 'APLICADA') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (status === 'ANULADA') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  };

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${env.API_URL}/invoices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar facturas');
      const data = await response.json();

      setDocuments(data.invoices.map((invoice: Invoice) => ({
        number: invoice.invoice_number,
        client: invoice.client_name,
        date: new Date(invoice.date_issue).toLocaleDateString('es-CO'),
        status: getStatusLabel(invoice.status, invoice.dian_status),
        statusColor: getStatusColor(invoice.status, invoice.dian_status),
        total: invoice.total,
        id: invoice.id
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDebitNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${env.API_URL}/debit-notes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar notas débito');
      const data = await response.json();

      setDocuments((data.debitNotes || []).map((note: any) => ({
        number: note.debit_note_number,
        client: note.client_name,
        date: note.date_issue ? new Date(note.date_issue).toLocaleDateString('es-CO') : '-',
        status: getStatusLabel(note.status),
        statusColor: getStatusColor(note.status),
        total: Number(note.total) || 0,
        id: note.id
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCreditNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${env.API_URL}/credit-notes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar notas crédito');
      const data = await response.json();

      setDocuments((data.creditNotes || []).map((note: any) => ({
        number: note.credit_note_number,
        client: note.client_name,
        date: note.date_issue ? new Date(note.date_issue).toLocaleDateString('es-CO') : '-',
        status: getStatusLabel(note.status),
        statusColor: getStatusColor(note.status),
        total: Number(note.total) || 0,
        id: note.id
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExpenseDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');

      if (documentType === 'pagos') {
        const response = await fetch(`${env.API_URL}/accounting/accounts-payable/payments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al cargar pagos realizados');
        const data = await response.json();

        setDocuments((data.payments || []).map((payment: any) => ({
          number: payment.source_number || `PAGO-${payment.id}`,
          client: payment.supplier_name,
          date: payment.application_date ? new Date(payment.application_date).toLocaleDateString('es-CO') : '-',
          status: 'Aplicado',
          statusColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
          total: Number(payment.amount) || 0,
          id: payment.id
        })));
        return;
      }

      const mappedType = PURCHASE_DOCUMENT_TYPE_MAP[documentType];
      const params = new URLSearchParams();
      if (mappedType) params.set('documentType', mappedType);

      const response = await fetch(`${env.API_URL}/accounting/accounts-payable?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar documentos de compra');
      const data = await response.json();

      setDocuments((data.payables || []).map((doc: any) => ({
        number: doc.document_number,
        client: doc.supplier_name,
        date: doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('es-CO') : '-',
        status: getStatusLabel(doc.status),
        statusColor: getStatusColor(doc.status),
        total: Number(doc.original_amount) || 0,
        id: doc.id
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  useEffect(() => {
    // Limpiar documentos al cambiar de tab
    setDocuments([]);

    if (module === 'gastos') {
      loadExpenseDocuments();
    } else if (documentType === 'facturas') {
      loadInvoices();
    } else if (documentType === 'notas-debito') {
      loadDebitNotes();
    } else if (documentType === 'devoluciones') {
      loadCreditNotes();
    }
  }, [documentType, module, loadInvoices, loadDebitNotes, loadCreditNotes, loadExpenseDocuments]);

  const handleDownloadXML = async (invoiceId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${env.API_URL}/invoices/${invoiceId}/download-xml`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
      alert(`Error: ${err.message}`);
    }
  };

  const handleViewXML = (invoiceId: string) => {
    const token = localStorage.getItem('token');
    fetch(`${env.API_URL}/invoices/${invoiceId}/view-xml`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.blob())
      .then(blob => window.open(window.URL.createObjectURL(blob), '_blank'))
      .catch(() => alert('Error al abrir el XML'));
  };

  const documentConfigs: Record<ModuleType, Record<DocumentType, DocumentConfig>> = {
    ingresos: {
      facturas: { title: 'Facturas de venta', description: 'Crea, edita y gestiona facturas detalladas.', icon: FileText, color: 'teal', emptyMessage: 'Aún no tienes facturas de venta', createRoute: '/ingresos/factura-venta/crear?tipo=factura' },
      cotizaciones: { title: 'Cotizaciones', description: 'Genera propuestas comerciales y presupuestos.', icon: ClipboardList, color: 'blue', emptyMessage: 'Aún no tienes cotizaciones', createRoute: '/ingresos/factura-venta/crear?tipo=cotizacion' },
      remisiones: { title: 'Remisiones', description: 'Gestiona documentos de envío y entregas.', icon: Package, color: 'orange', emptyMessage: 'Aún no tienes remisiones', createRoute: '/ingresos/factura-venta/crear?tipo=remision' },
      pagos: { title: 'Pagos recibidos', description: 'Registra y organiza todos los pagos recibidos.', icon: Wallet, color: 'green', emptyMessage: 'Aún no tienes pagos registrados', createRoute: '/ingresos/factura-venta/crear?tipo=pago' },
      devoluciones: { title: 'Devoluciones', description: 'Registra devoluciones y notas de crédito.', icon: TrendingDown, color: 'purple', emptyMessage: 'Aún no tienes devoluciones', createRoute: '/ingresos/factura-venta/crear?tipo=nota-credito' },
      'notas-debito': { title: 'Notas débito', description: 'Registra incrementos o correcciones.', icon: TrendingUp, color: 'red', emptyMessage: 'Aún no tienes notas de débito', createRoute: '/ingresos/factura-venta/crear?tipo=nota-debito' },
    },
    gastos: {
      facturas: { title: 'Facturas de compra', description: 'Registra facturas de tus proveedores.', icon: ShoppingCart, color: 'orange', emptyMessage: 'Aún no tienes facturas de compra', createRoute: '/gastos/factura-compra/crear?tipo=factura' },
      cotizaciones: { title: 'Órdenes de compra', description: 'Gestiona órdenes de compra a proveedores.', icon: ClipboardList, color: 'gray', emptyMessage: 'Aún no tienes órdenes de compra', createRoute: '/gastos/factura-compra/crear?tipo=orden' },
      remisiones: { title: 'Documento soporte', description: 'Registra documentos equivalentes.', icon: FileText, color: 'brown', emptyMessage: 'Aún no tienes documentos soporte', createRoute: '/gastos/factura-compra/crear?tipo=documento-soporte' },
      pagos: { title: 'Pagos realizados', description: 'Registra pagos a proveedores.', icon: Wallet, color: 'pink', emptyMessage: 'Aún no tienes pagos realizados', createRoute: '/gastos/factura-compra/crear?tipo=pago' },
      devoluciones: { title: 'Notas de ajuste', description: 'Registra ajustes en facturas de compra.', icon: FileEdit, color: 'purple', emptyMessage: 'Aún no tienes notas de ajuste', createRoute: '/gastos/factura-compra/crear?tipo=nota-ajuste' },
      'notas-debito': { title: 'Notas débito compras', description: 'Registra notas de débito de proveedores.', icon: FileMinus, color: 'red', emptyMessage: 'Aún no tienes notas de débito', createRoute: '/gastos/factura-compra/crear?tipo=nota-debito' },
    }
  };

  const config = documentConfigs[module][documentType];
  const Icon = config.icon;

  const handleModuleChange = (m: ModuleType) => { setModule(m); setDocumentType('facturas'); setSearchParams({ modulo: m, tipo: 'facturas' }); };
  const handleDocTypeChange = (t: DocumentType) => { setDocumentType(t); setSearchParams({ modulo: module, tipo: t }); };

  const allDocTypes: { key: DocumentType; labelIngresos: string; labelGastos: string }[] = [
    { key: 'facturas', labelIngresos: 'Facturas', labelGastos: 'Facturas compra' },
    { key: 'cotizaciones', labelIngresos: 'Cotizaciones', labelGastos: 'Órdenes compra' },
    { key: 'remisiones', labelIngresos: 'Remisiones', labelGastos: 'Doc. soporte' },
    { key: 'pagos', labelIngresos: 'Pagos recibidos', labelGastos: 'Pagos realizados' },
    { key: 'devoluciones', labelIngresos: 'Devoluciones', labelGastos: 'Notas ajuste' },
    { key: 'notas-debito', labelIngresos: 'Notas débito', labelGastos: 'Notas débito' },
  ];

  // Remisiones de ventas (ingresos) ocultas; en gastos se conservan como Doc. soporte.
  const docTypes = allDocTypes.filter(dt => !(module === 'ingresos' && dt.key === 'remisiones'));

  return (
    <>
      {/* ── Breadcrumb / volver al hub ── */}
      <div className="mb-3 flex items-center gap-2 text-sm">
        <Link
          to="/contabilidad"
          className="inline-flex items-center gap-1.5 text-crumi-text-muted hover:text-crumi-text-primary transition-colors"
        >
          <ArrowLeft className="size-4" />
          Volver a Contabilidad
        </Link>
        <span className="text-crumi-text-muted/40">/</span>
        <span className="text-crumi-text-primary font-medium">
          {module === 'ingresos' ? 'Ingresos' : 'Gastos'} · {documentType === 'facturas' ? 'Facturas' : documentType}
        </span>
      </div>

    <div className="bg-white dark:bg-crumi-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">

      {/* ── Card header: module toggle + title + actions ── */}
      <div className="px-5 pt-5 pb-0">
        {/* Row 1: Module toggle + action buttons */}
        <div className="flex items-center justify-between mb-4">
          {/* Module pills */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800/60 rounded-xl p-0.5">
            {(['ingresos', 'gastos'] as ModuleType[]).map(m => (
              <button
                key={m}
                onClick={() => handleModuleChange(m)}
                className={`px-4 py-1.5 rounded-[10px] text-xs font-semibold transition-all duration-200
                  ${module === m
                    ? 'bg-white dark:bg-crumi-surface-dark text-crumi-text-primary dark:text-white shadow-sm'
                    : 'text-crumi-text-muted dark:text-crumi-text-dark-muted hover:text-crumi-text-primary dark:hover:text-white'
                  }
                `}
              >
                {m === 'ingresos' ? 'Ingresos' : 'Gastos'}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              text-crumi-text-muted dark:text-crumi-text-dark-muted
              hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Download size={13} /> Exportar
            </button>
            <Link
              to={config.createRoute}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold no-underline
                bg-crumi-primary dark:bg-crumi-accent text-white hover:opacity-90 transition-all"
            >
              <Plus size={13} /> Nuevo
            </Link>
          </div>
        </div>

        {/* Row 2: Doc type tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto crumi-scrollbar -mb-px">
          {docTypes.map(dt => {
            const isActive = documentType === dt.key;
            return (
              <button
                key={dt.key}
                onClick={() => handleDocTypeChange(dt.key)}
                className={`px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-all duration-200 border-b-2 shrink-0
                  ${isActive
                    ? 'border-crumi-primary dark:border-crumi-accent text-crumi-primary dark:text-crumi-accent'
                    : 'border-transparent text-crumi-text-muted dark:text-crumi-text-dark-muted hover:text-crumi-text-primary dark:hover:text-crumi-text-dark-primary hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                {module === 'ingresos' ? dt.labelIngresos : dt.labelGastos}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-gray-100 dark:border-gray-700/50" />

      {/* ── Toolbar: search + filter ── */}
      <div className="px-5 py-3 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <Search size={14} className="text-crumi-text-muted dark:text-crumi-text-dark-muted shrink-0" />
          <input
            type="text"
            placeholder={`Buscar en ${config.title.toLowerCase()}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-xs
              text-crumi-text-primary dark:text-crumi-text-dark-primary
              placeholder:text-crumi-text-muted dark:placeholder:text-crumi-text-dark-muted"
          />
        </div>
        <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
          text-crumi-text-muted dark:text-crumi-text-dark-muted
          border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <SlidersHorizontal size={12} /> Filtros
        </button>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-gray-100 dark:border-gray-700/50" />

      {/* ── Content: table / loading / empty / error ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-7 h-7 border-2 border-crumi-primary dark:border-crumi-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted">Cargando documentos...</p>
        </div>
      ) : error ? (
        <div className="mx-5 my-6 p-6 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
                No pudimos conectar con el servidor
              </h4>
              <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                {error.includes('fetch') || error.includes('Failed')
                  ? 'El backend no responde. Revisa que esté corriendo (npm start en crumi/back) o configura VITE_API_URL en front/.env.'
                  : error}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  if (module === 'gastos') loadExpenseDocuments();
                  else if (documentType === 'facturas') loadInvoices();
                  else if (documentType === 'notas-debito') loadDebitNotes();
                  else if (documentType === 'devoluciones') loadCreditNotes();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Inbox size={22} className="text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold dark:text-white text-crumi-text-primary">{config.emptyMessage}</p>
            <p className="text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted mt-0.5">Crea tu primer documento para empezar.</p>
          </div>
          <Link
            to={config.createRoute}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold no-underline
              bg-crumi-primary dark:bg-crumi-accent text-white hover:opacity-90 transition-all mt-1"
          >
            <Plus size={13} /> Crear {config.title.split(' ')[0].toLowerCase()}
          </Link>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-5 py-2.5">Número</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-5 py-2.5">{module === 'ingresos' ? 'Cliente' : 'Proveedor'}</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-5 py-2.5">Fecha</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-5 py-2.5">Estado</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-crumi-text-muted dark:text-crumi-text-dark-muted px-5 py-2.5">Total</th>
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors group"
                  >
                    <td className="px-5 py-2.5 text-xs font-medium dark:text-white text-crumi-text-primary">{doc.number}</td>
                    <td className="px-5 py-2.5 text-xs dark:text-crumi-text-dark-primary text-crumi-text-primary">{doc.client}</td>
                    <td className="px-5 py-2.5 text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted">{doc.date}</td>
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${doc.statusColor}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-xs font-semibold text-right dark:text-white text-crumi-text-primary">
                      ${doc.total.toLocaleString('es-CO')}
                    </td>
                    <td className="px-2 py-2.5 text-right relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === doc.id ? null : doc.id)}
                        className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                      >
                        <MoreVertical size={14} className="text-crumi-text-muted dark:text-crumi-text-dark-muted" />
                      </button>
                      {openDropdown === doc.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                          <div className="absolute right-2 top-full mt-0.5 z-20 w-44 py-1
                            bg-white dark:bg-crumi-surface-dark rounded-lg border border-gray-100 dark:border-gray-700/50 shadow-lg">
                            <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-crumi-text-primary dark:text-crumi-text-dark-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <Eye size={12} /> Ver detalle
                            </button>
                            <button onClick={() => { handleViewXML(doc.id); setOpenDropdown(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-crumi-text-primary dark:text-crumi-text-dark-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <FileCode size={12} /> Ver XML
                            </button>
                            <button onClick={() => { handleDownloadXML(doc.id); setOpenDropdown(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-crumi-text-primary dark:text-crumi-text-dark-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <Download size={12} /> Descargar XML
                            </button>
                            <div className="my-0.5 border-t border-gray-100 dark:border-gray-700/50" />
                            <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-crumi-text-primary dark:text-crumi-text-dark-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <Pencil size={12} /> Editar
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={12} /> Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/40 dark:bg-gray-800/20">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-crumi-text-muted dark:text-crumi-text-dark-muted">Mostrar</span>
              <select
                value={itemsPerPage}
                onChange={e => setItemsPerPage(Number(e.target.value))}
                className="text-[10px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-crumi-surface-dark
                  text-crumi-text-primary dark:text-crumi-text-dark-primary px-1.5 py-0.5 outline-none"
              >
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-[10px] text-crumi-text-muted dark:text-crumi-text-dark-muted">
                · 1–{documents.length} de {documents.length}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-1 rounded-md disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft size={13} className="text-crumi-text-muted dark:text-crumi-text-dark-muted" />
              </button>
              <span className="text-[10px] text-crumi-text-muted dark:text-crumi-text-dark-muted px-1.5 tabular-nums">
                {currentPage}
              </span>
              <button
                disabled={documents.length === 0}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1 rounded-md disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronRight size={13} className="text-crumi-text-muted dark:text-crumi-text-dark-muted" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
};

export default DocumentList;
