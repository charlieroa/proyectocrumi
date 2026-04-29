import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  CardBody,
  CardHeader,
  Button,
  ButtonGroup,
  Input,
  Label,
  FormGroup,
  Table,
  Spinner,
  Badge,
  Offcanvas,
  OffcanvasHeader,
  OffcanvasBody,
  InputGroup,
  InputGroupText,
  Toast,
  ToastBody,
  Alert,
} from 'reactstrap';
import { API_BASE, money, useAuthHeaders, accountTypeColor } from '../shared';
import { downloadExcelReport, flattenSectioned } from '../../../Components/Common/excelExport';
import {
  downloadPdfReport,
  downloadPdfSectionedReport,
  PdfReportMeta,
  PdfSection,
  CellValue as PdfCellValue,
} from '../../../Components/Common/pdfExport';

// TODO(tpia): wire tenant data (tenantName + tenantTaxId) from Redux/auth context once available.
// TODO(tpia): wire tenant-configured signatures (Contador / Revisor Fiscal) — see `signatures` in PdfReportMeta.
// Until then, PDFs render without the company header and with blank signature lines.

// Etiqueta legible para los document_type que se guardan en journal_entries.
// Si aparece un valor nuevo no mapeado, lo mostramos tal cual (sin romper).
const DOC_TYPE_LABELS: Record<string, string> = {
  FACTURA: 'Factura venta',
  FACTURA_VENTA: 'Factura venta',
  NOTA_CREDITO: 'Nota crédito venta',
  NOTA_DEBITO: 'Nota débito venta',
  RECIBO_CAJA: 'Recibo de caja',
  RECIBO_PAGO: 'Recibo de caja',
  RP: 'Recibo de caja',
  CUENTA_POR_PAGAR: 'Factura compra',
  FACTURA_PROVEEDOR: 'Factura compra',
  PAGO_CXP: 'Pago a proveedor',
  PAGO_PROVEEDOR: 'Pago a proveedor',
  ORDEN_COMPRA: 'Orden de compra',
  DOCUMENTO_SOPORTE: 'Documento soporte',
  NOTA_AJUSTE_COMPRA: 'Nota ajuste compra',
  NOTA_DEBITO_PROVEEDOR: 'Nota débito compra',
  NOMINA: 'Nómina',
  KARDEX: 'Kardex',
  REVERSO: 'Reverso',
  AJUSTE_MANUAL: 'Ajuste manual',
  MANUAL: 'Manual',
};

const docTypeLabel = (t?: string | null): string => {
  if (!t) return '—';
  const key = String(t).toUpperCase();
  return DOC_TYPE_LABELS[key] || t;
};

type ViewKey = 'diario' | 'diario-resumido' | 'no-contabilizados' | 'mayor' | 'auxiliar' | 'trial' | 'trial-config' | 'trial-tercero' | 'balance' | 'pyg' | 'pyg-funcion' | 'flujo' | 'patrimonio' | 'libro-compras' | 'libro-ventas' | 'libro-inventarios';

interface DiarioResumenRow {
  date: string;
  count: number;
  total_debit: number;
  total_credit: number;
}

interface TrialByTpRow {
  document_number: string;
  name: string;
  debit: number;
  credit: number;
  balance: number;
  lines: number;
}

interface LibroCompraRow {
  consecutivo: number;
  id: number;
  fecha: string;
  fecha_vencimiento?: string;
  proveedor_tipo_documento: string;
  proveedor_numero_documento: string;
  proveedor_nombre: string;
  tipo_documento?: string;
  numero_factura?: string;
  moneda?: string;
  estado?: string;
  base_gravable: number;
  iva_descontable: number;
  retefuente: number;
  reteiva: number;
  reteica: number;
  total: number;
}

interface LibroVentaRow {
  consecutivo: number;
  id: number;
  fecha: string;
  fecha_vencimiento?: string;
  cliente_tipo_documento: string;
  cliente_numero_documento: string;
  cliente_nombre: string;
  tipo_documento?: string;
  numero_factura?: string;
  moneda?: string;
  estado?: string;
  base_gravable: number;
  iva_generado: number;
  retefuente: number;
  reteiva: number;
  reteica: number;
  total: number;
}

interface LibroInventarioRow {
  codigo: string;
  nombre: string;
  tipo: string;
  saldo_inicial: number;
  debitos: number;
  creditos: number;
  saldo_final: number;
}

interface LibroTotals {
  base: number; iva: number; retefuente: number; reteIva: number; reteIca: number; total: number;
}

interface PygFuncionStatement {
  ingresos: BalanceAccount[];
  costoVentas: BalanceAccount[];
  gastosAdmin: BalanceAccount[];
  gastosVentas: BalanceAccount[];
  gastosNoOperacionales: BalanceAccount[];
  impuestoRenta: BalanceAccount[];
  totals: {
    ingresos: number; costoVentas: number; utilidadBruta: number;
    gastosAdmin: number; gastosVentas: number; utilidadOperacional: number;
    gastosNoOperacionales: number; utilidadAntesImpuestos: number;
    impuestoRenta: number; utilidadNeta: number;
  };
  periodo: { startDate: string; endDate: string };
}

interface JournalLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  third_party_name?: string;
  line_description?: string;
}

interface JournalEntry {
  id: number | string;
  entry_number: string;
  date: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: string;
  lines?: JournalLine[];
  reverses_entry_id?: number | null;
  reversed_by_entry_id?: number | null;
}

interface LedgerRow {
  date: string;
  entry_number: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  third_party_name?: string;
}

interface AuxRow {
  date: string;
  voucher_number: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  third_party_name?: string;
}

interface TrialRow {
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface BalanceAccount {
  account_code: string;
  account_name: string;
  balance: number;
}

const firstOfYear = () => {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
};
const today = () => new Date().toISOString().slice(0, 10);

const Consultas: React.FC = () => {
  const headers = useAuthHeaders();

  // Soporte de ?view=balance en la URL para deep-link desde el hub de reportes
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const VALID_VIEWS: ViewKey[] = [
    'diario', 'diario-resumido', 'no-contabilizados',
    'mayor', 'auxiliar',
    'trial', 'trial-config', 'trial-tercero',
    'balance', 'pyg', 'pyg-funcion', 'flujo', 'patrimonio',
    'libro-compras', 'libro-ventas', 'libro-inventarios',
  ];
  const initialView = searchParams.get('view') as ViewKey | null;
  const [view, setView] = useState<ViewKey>(
    initialView && VALID_VIEWS.includes(initialView) ? initialView : 'diario',
  );
  // Si se llegó vía ?view=X, entramos en modo "reporte único" (sin nav).
  const isDeepLinked = Boolean(initialView && VALID_VIEWS.includes(initialView));
  const [startDate, setStartDate] = useState(firstOfYear());
  const [endDate, setEndDate] = useState(today());
  const [search, setSearch] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [filterTick, setFilterTick] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [expandedEntry, setExpandedEntry] = useState<string | number | null>(null);

  const [diarioResumen, setDiarioResumen] = useState<DiarioResumenRow[]>([]);
  const [unposted, setUnposted] = useState<JournalEntry[]>([]);
  const [trialByTp, setTrialByTp] = useState<TrialByTpRow[]>([]);
  const [libroCompras, setLibroCompras] = useState<LibroCompraRow[]>([]);
  const [librosComprasTotals, setLibroComprasTotals] = useState<LibroTotals | null>(null);
  const [libroVentas, setLibroVentas] = useState<LibroVentaRow[]>([]);
  const [librosVentasTotals, setLibroVentasTotals] = useState<LibroTotals | null>(null);
  const [libroInventarios, setLibroInventarios] = useState<LibroInventarioRow[]>([]);
  const [pygFuncion, setPygFuncion] = useState<PygFuncionStatement | null>(null);
  const [trialConfig, setTrialConfig] = useState<TrialRow[]>([]);
  const [trialConfigFilters, setTrialConfigFilters] = useState<{
    accountFrom: string; accountTo: string; level: string; onlyWithMovement: boolean;
  }>({ accountFrom: '', accountTo: '', level: '', onlyWithMovement: true });
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [auxMovs, setAuxMovs] = useState<AuxRow[]>([]);
  const [trial, setTrial] = useState<TrialRow[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [cashFlow, setCashFlow] = useState<any>(null);
  const [equityChanges, setEquityChanges] = useState<any>(null);

  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const applyFilters = () => {
    setPage(1);
    setFilterTick((t) => t + 1);
  };

  const fetchJson = useCallback(
    async (url: string) => {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [headers]
  );

  const loadDiario = useCallback(async () => {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search,
      startDate,
      endDate,
    });
    const data = await fetchJson(`${API_BASE}/accounting/journal-entries?${qs}`);
    setEntries(data.entries || []);
    setEntriesTotal(data.total || 0);
  }, [fetchJson, page, search, startDate, endDate]);

  const loadDiarioResumen = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/journal-entries/summary?${qs}`);
    setDiarioResumen(data.entries || []);
  }, [fetchJson, startDate, endDate]);

  const loadUnposted = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/journal-entries/unposted?${qs}`);
    setUnposted(data.entries || []);
  }, [fetchJson, startDate, endDate]);

  const loadTrialByTp = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    if (accountCode) qs.append('accountCode', accountCode);
    const data = await fetchJson(`${API_BASE}/accounting/trial-balance/by-third-party?${qs}`);
    setTrialByTp(data.trialBalance || []);
  }, [fetchJson, startDate, endDate, accountCode]);

  const loadLibroCompras = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/libro-oficial/compras?${qs}`);
    setLibroCompras(data.compras || []);
    setLibroComprasTotals(data.totals || null);
  }, [fetchJson, startDate, endDate]);

  const loadLibroVentas = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/libro-oficial/ventas?${qs}`);
    setLibroVentas(data.ventas || []);
    setLibroVentasTotals(data.totals || null);
  }, [fetchJson, startDate, endDate]);

  const loadLibroInventarios = useCallback(async () => {
    const qs = new URLSearchParams({ date: endDate });
    const data = await fetchJson(`${API_BASE}/accounting/libro-oficial/inventarios-balance?${qs}`);
    setLibroInventarios(data.cuentas || []);
  }, [fetchJson, endDate]);

  const loadTrialConfig = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    if (trialConfigFilters.accountFrom) qs.append('accountFrom', trialConfigFilters.accountFrom);
    if (trialConfigFilters.accountTo) qs.append('accountTo', trialConfigFilters.accountTo);
    if (trialConfigFilters.level) qs.append('level', trialConfigFilters.level);
    if (trialConfigFilters.onlyWithMovement) qs.append('onlyWithMovement', 'true');
    const data = await fetchJson(`${API_BASE}/accounting/trial-balance/configurable?${qs}`);
    setTrialConfig(data.trialBalance || []);
  }, [fetchJson, startDate, endDate, trialConfigFilters]);

  const loadPygFuncion = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/income-statement/by-function?${qs}`);
    setPygFuncion(data.statement || null);
  }, [fetchJson, startDate, endDate]);

  const loadMayor = useCallback(async () => {
    if (!accountCode) {
      setLedger([]);
      return;
    }
    const qs = new URLSearchParams({ accountCode, startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/ledger?${qs}`);
    setLedger(data.ledger || []);
  }, [fetchJson, accountCode, startDate, endDate]);

  const loadAuxiliar = useCallback(async () => {
    if (!accountCode) {
      setAuxMovs([]);
      return;
    }
    const qs = new URLSearchParams({ accountCode, startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/auxiliar?${qs}`);
    setAuxMovs(data.movements || []);
  }, [fetchJson, accountCode, startDate, endDate]);

  const loadTrial = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/trial-balance?${qs}`);
    setTrial(data.trialBalance || []);
  }, [fetchJson, startDate, endDate]);

  const loadBalance = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/balance-sheet?${qs}`);
    setBalanceSheet(data.balanceSheet || null);
  }, [fetchJson, startDate, endDate]);

  const loadPyg = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/income-statement?${qs}`);
    setIncomeStatement(data.incomeStatement || data.statement || null);
  }, [fetchJson, startDate, endDate]);

  const loadFlujo = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/cash-flow?${qs}`);
    setCashFlow(data.cashFlow || null);
  }, [fetchJson, startDate, endDate]);

  const loadPatrimonio = useCallback(async () => {
    const qs = new URLSearchParams({ startDate, endDate });
    const data = await fetchJson(`${API_BASE}/accounting/equity-changes?${qs}`);
    setEquityChanges(data.equityChanges || null);
  }, [fetchJson, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        if (view === 'diario') await loadDiario();
        else if (view === 'diario-resumido') await loadDiarioResumen();
        else if (view === 'no-contabilizados') await loadUnposted();
        else if (view === 'trial-tercero') await loadTrialByTp();
        else if (view === 'libro-compras') await loadLibroCompras();
        else if (view === 'libro-ventas') await loadLibroVentas();
        else if (view === 'libro-inventarios') await loadLibroInventarios();
        else if (view === 'pyg-funcion') await loadPygFuncion();
        else if (view === 'trial-config') await loadTrialConfig();
        else if (view === 'mayor') await loadMayor();
        else if (view === 'auxiliar') await loadAuxiliar();
        else if (view === 'trial') await loadTrial();
        else if (view === 'balance') await loadBalance();
        else if (view === 'pyg') await loadPyg();
        else if (view === 'flujo') await loadFlujo();
        else if (view === 'patrimonio') await loadPatrimonio();
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Error cargando datos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filterTick, page]);

  const openDetail = async (entry: JournalEntry) => {
    setDetailOpen(true);
    setDetailEntry(entry);
    try {
      const data = await fetchJson(`${API_BASE}/accounting/journal-entries/${entry.id}`);
      setDetailEntry(data.entry || data || entry);
    } catch {
      // keep existing
    }
  };

  const totalPages = Math.max(1, Math.ceil(entriesTotal / limit));

  const viewGroups: { label: string; icon: string; items: { key: ViewKey; label: string; icon: string }[] }[] = [
    {
      label: 'Movimientos',
      icon: 'ri-book-2-line',
      items: [
        { key: 'diario', label: 'Diario', icon: 'ri-book-2-line' },
        { key: 'diario-resumido', label: 'Diario resumido', icon: 'ri-list-check-2' },
        { key: 'no-contabilizados', label: 'No contabilizados', icon: 'ri-error-warning-line' },
        { key: 'mayor', label: 'Mayor', icon: 'ri-archive-line' },
        { key: 'auxiliar', label: 'Auxiliar', icon: 'ri-file-list-3-line' },
      ],
    },
    {
      label: 'Balances',
      icon: 'ri-scales-3-line',
      items: [
        { key: 'trial', label: 'Balance prueba', icon: 'ri-scales-3-line' },
        { key: 'trial-config', label: 'Configurable', icon: 'ri-filter-3-line' },
        { key: 'trial-tercero', label: 'Por tercero', icon: 'ri-group-line' },
        { key: 'balance', label: 'Balance general', icon: 'ri-building-line' },
      ],
    },
    {
      label: 'Estados financieros',
      icon: 'ri-line-chart-line',
      items: [
        { key: 'pyg', label: 'Estado de resultado', icon: 'ri-line-chart-line' },
        { key: 'pyg-funcion', label: 'Estado de resultado por función', icon: 'ri-funds-box-line' },
        { key: 'flujo', label: 'Flujo de efectivo', icon: 'ri-exchange-funds-line' },
        { key: 'patrimonio', label: 'Patrimonio', icon: 'ri-bank-line' },
      ],
    },
    {
      label: 'Libros oficiales DIAN',
      icon: 'ri-government-line',
      items: [
        { key: 'libro-compras', label: 'Compras', icon: 'ri-shopping-cart-2-line' },
        { key: 'libro-ventas', label: 'Ventas', icon: 'ri-store-2-line' },
        { key: 'libro-inventarios', label: 'Inventarios y balance', icon: 'ri-stack-line' },
      ],
    },
  ];

  const activeGroup = viewGroups.find(g => g.items.some(i => i.key === view)) || viewGroups[0];
  const activeItem = activeGroup.items.find(i => i.key === view) || activeGroup.items[0];

  // Metadatos por vista para el modo deep-link (título y descripción mostrados en la cabecera)
  const VIEW_META: Record<ViewKey, { title: string; desc: string }> = {
    'diario': { title: 'Libro diario', desc: 'Listado cronológico de asientos contables' },
    'diario-resumido': { title: 'Diario resumido', desc: 'Totales de comprobantes agrupados por día' },
    'no-contabilizados': { title: 'Comprobantes no contabilizados', desc: 'Asientos pendientes de contabilización' },
    'mayor': { title: 'Libro mayor', desc: 'Movimientos y saldo acumulado por cuenta' },
    'auxiliar': { title: 'Auxiliar', desc: 'Movimientos detallados por cuenta' },
    'trial': { title: 'Balance de prueba', desc: 'Saldos deudores y acreedores del período' },
    'trial-config': { title: 'Balance configurable', desc: 'Balance de prueba con filtros por rango y nivel' },
    'trial-tercero': { title: 'Balance por tercero', desc: 'Saldos agrupados por tercero' },
    'balance': { title: 'Balance general', desc: 'Activos, pasivos y patrimonio' },
    'pyg': { title: 'Estado de resultado', desc: 'Ingresos, costos y gastos del período' },
    'pyg-funcion': { title: 'Estado de resultado por función', desc: 'Estado de resultado integral por función de gastos' },
    'flujo': { title: 'Flujo de efectivo', desc: 'Estado de flujo de efectivo — Método indirecto' },
    'patrimonio': { title: 'Cambios en el patrimonio', desc: 'Variaciones de las cuentas de patrimonio' },
    'libro-compras': { title: 'Libro oficial de compras', desc: 'Compras del período con bases e impuestos' },
    'libro-ventas': { title: 'Libro oficial de ventas', desc: 'Ventas del período con bases e impuestos' },
    'libro-inventarios': { title: 'Libro de inventarios y balance', desc: 'Saldos de cuentas al cierre' },
  };
  const currentViewTitle = VIEW_META[view]?.title || activeItem.label;
  const currentViewDescription = VIEW_META[view]?.desc || '';

  const needsAccount = view === 'mayor' || view === 'auxiliar';

  const groupedTrial = useMemo(() => {
    const groups: Record<string, TrialRow[]> = {};
    trial.forEach((r) => {
      const k = (r.account_code || '0').charAt(0);
      if (!groups[k]) groups[k] = [];
      groups[k].push(r);
    });
    return groups;
  }, [trial]);

  const groupLabels: Record<string, string> = {
    '1': 'Activos',
    '2': 'Pasivos',
    '3': 'Patrimonio',
    '4': 'Ingresos',
    '5': 'Gastos',
    '6': 'Costos de venta',
    '7': 'Costos de producción',
  };

  // ============================================================
  // Exports a Excel
  // ============================================================
  const dateRange = `${startDate} a ${endDate}`;

  const exportDiario = () => {
    const rows = entries.map(e => [
      e.entry_number,
      e.date,
      e.description,
      Number(e.total_debit) || 0,
      Number(e.total_credit) || 0,
      e.status,
    ]);
    downloadExcelReport(
      'Libro diario',
      ['Número', 'Fecha', 'Descripción', 'Débito', 'Crédito', 'Estado'],
      rows,
      `libro_diario_${startDate}_${endDate}.xlsx`,
      { title: 'Libro diario', dateRange },
    );
  };

  const exportDiarioResumen = () => {
    const rows = diarioResumen.map(r => [
      r.date,
      Number(r.count) || 0,
      Number(r.total_debit) || 0,
      Number(r.total_credit) || 0,
    ]);
    const totalCount = diarioResumen.reduce((s, r) => s + (Number(r.count) || 0), 0);
    const totalDebit = diarioResumen.reduce((s, r) => s + (Number(r.total_debit) || 0), 0);
    const totalCredit = diarioResumen.reduce((s, r) => s + (Number(r.total_credit) || 0), 0);
    rows.push(['TOTAL', totalCount, totalDebit, totalCredit]);
    downloadExcelReport(
      'Diario resumido',
      ['Fecha', 'Comprobantes', 'Débito', 'Crédito'],
      rows,
      `diario_resumido_${startDate}_${endDate}.xlsx`,
      { title: 'Libro diario resumido', dateRange },
    );
  };

  const exportUnposted = () => {
    const rows = unposted.map(e => [
      e.entry_number,
      e.date,
      e.description,
      Number(e.total_debit) || 0,
      Number(e.total_credit) || 0,
      e.status,
      e.reversed_by_entry_id ? `→ ${e.reversed_by_entry_id}` : '',
    ]);
    downloadExcelReport(
      'No contabilizados',
      ['Número', 'Fecha', 'Descripción', 'Débito', 'Crédito', 'Estado', 'Reversado por'],
      rows,
      `no_contabilizados_${startDate}_${endDate}.xlsx`,
      { title: 'Comprobantes no contabilizados', dateRange },
    );
  };

  const exportTrialByTp = () => {
    const rows = trialByTp.map(r => [
      r.document_number,
      r.name,
      Number(r.debit) || 0,
      Number(r.credit) || 0,
      Number(r.balance) || 0,
      Number(r.lines) || 0,
    ]);
    const totalDebit = trialByTp.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const totalCredit = trialByTp.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const totalBalance = trialByTp.reduce((s, r) => s + (Number(r.balance) || 0), 0);
    rows.push(['', 'TOTAL', totalDebit, totalCredit, totalBalance, '']);
    downloadExcelReport(
      'Balance por tercero',
      ['Documento', 'Nombre', 'Débito', 'Crédito', 'Saldo', 'Líneas'],
      rows,
      `balance_por_tercero_${startDate}_${endDate}.xlsx`,
      { title: `Balance de prueba por tercero${accountCode ? ` · cuenta ${accountCode}` : ''}`, dateRange },
    );
  };

  const exportLibroCompras = () => {
    const rows = libroCompras.map(r => [
      r.consecutivo, r.fecha, r.proveedor_tipo_documento, r.proveedor_numero_documento,
      r.proveedor_nombre, r.tipo_documento || '', r.numero_factura || '',
      r.base_gravable, r.iva_descontable, r.retefuente, r.reteiva, r.reteica, r.total,
    ]);
    if (librosComprasTotals) {
      rows.push(['', '', '', '', 'TOTAL', '', '',
        librosComprasTotals.base, librosComprasTotals.iva, librosComprasTotals.retefuente,
        librosComprasTotals.reteIva, librosComprasTotals.reteIca, librosComprasTotals.total]);
    }
    downloadExcelReport(
      'Libro compras',
      ['#', 'Fecha', 'Tipo doc', 'NIT', 'Proveedor', 'Tipo doc FC', 'Nº factura',
       'Base', 'IVA descontable', 'Retefuente', 'ReteIVA', 'ReteICA', 'Total'],
      rows,
      `libro_compras_${startDate}_${endDate}.xlsx`,
      { title: 'Libro Oficial de Compras', dateRange },
    );
  };

  const exportLibroVentas = () => {
    const rows = libroVentas.map(r => [
      r.consecutivo, r.fecha, r.cliente_tipo_documento, r.cliente_numero_documento,
      r.cliente_nombre, r.tipo_documento || '', r.numero_factura || '',
      r.base_gravable, r.iva_generado, r.retefuente, r.reteiva, r.reteica, r.total,
    ]);
    if (librosVentasTotals) {
      rows.push(['', '', '', '', 'TOTAL', '', '',
        librosVentasTotals.base, librosVentasTotals.iva, librosVentasTotals.retefuente,
        librosVentasTotals.reteIva, librosVentasTotals.reteIca, librosVentasTotals.total]);
    }
    downloadExcelReport(
      'Libro ventas',
      ['#', 'Fecha', 'Tipo doc', 'NIT', 'Cliente', 'Tipo doc FC', 'Nº factura',
       'Base', 'IVA generado', 'Retefuente', 'ReteIVA', 'ReteICA', 'Total'],
      rows,
      `libro_ventas_${startDate}_${endDate}.xlsx`,
      { title: 'Libro Oficial de Ventas', dateRange },
    );
  };

  const exportLibroInventarios = () => {
    const rows = libroInventarios.map(r => [
      r.codigo, r.nombre, r.tipo,
      Number(r.saldo_inicial) || 0,
      Number(r.debitos) || 0,
      Number(r.creditos) || 0,
      Number(r.saldo_final) || 0,
    ]);
    downloadExcelReport(
      'Inventarios y Balance',
      ['Código', 'Cuenta', 'Tipo', 'Saldo inicial', 'Débitos', 'Créditos', 'Saldo final'],
      rows,
      `libro_inventarios_balance_${endDate}.xlsx`,
      { title: `Libro de Inventarios y Balance al ${endDate}` },
    );
  };

  const exportTrialConfig = () => {
    const rows = trialConfig.map(r => [
      r.account_code, r.account_name, r.account_type || '',
      Number(r.debit) || 0, Number(r.credit) || 0, Number(r.balance) || 0,
    ]);
    const totalDebit = trialConfig.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const totalCredit = trialConfig.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const totalBalance = trialConfig.reduce((s, r) => s + (Number(r.balance) || 0), 0);
    rows.push(['', 'TOTAL', '', totalDebit, totalCredit, totalBalance]);
    const filtersLine = [
      trialConfigFilters.accountFrom && `Desde ${trialConfigFilters.accountFrom}`,
      trialConfigFilters.accountTo && `Hasta ${trialConfigFilters.accountTo}`,
      trialConfigFilters.level && `Nivel ${trialConfigFilters.level}`,
      trialConfigFilters.onlyWithMovement && 'Solo con movimiento',
    ].filter(Boolean).join(' · ');
    downloadExcelReport(
      'Balance configurable',
      ['Código', 'Nombre', 'Tipo', 'Débito', 'Crédito', 'Saldo'],
      rows,
      `balance_configurable_${startDate}_${endDate}.xlsx`,
      { title: 'Balance de prueba configurable', dateRange, extra: filtersLine ? [filtersLine] : undefined },
    );
  };

  const exportPygFuncion = () => {
    if (!pygFuncion) return;
    const t = pygFuncion.totals;
    const body = flattenSectioned(
      [
        { label: 'INGRESOS OPERACIONALES', items: pygFuncion.ingresos },
        { label: 'COSTO DE VENTAS', items: pygFuncion.costoVentas },
        { label: 'GASTOS DE ADMINISTRACIÓN', items: pygFuncion.gastosAdmin },
        { label: 'GASTOS DE VENTAS', items: pygFuncion.gastosVentas },
        { label: 'GASTOS NO OPERACIONALES', items: pygFuncion.gastosNoOperacionales },
        { label: 'IMPUESTO DE RENTA', items: pygFuncion.impuestoRenta },
      ].filter(s => s.items && s.items.length > 0),
      (it: BalanceAccount) => [it.account_code, it.account_name, Number(it.balance) || 0],
    );
    const totals: (string | number)[][] = [
      [],
      ['', 'UTILIDAD BRUTA', '', t.utilidadBruta],
      ['', 'UTILIDAD OPERACIONAL', '', t.utilidadOperacional],
      ['', 'UTILIDAD ANTES DE IMPUESTOS', '', t.utilidadAntesImpuestos],
      ['', 'UTILIDAD NETA', '', t.utilidadNeta],
    ];
    downloadExcelReport(
      'P&G por función',
      ['Sección', 'Código', 'Nombre', 'Valor'],
      [...body, ...totals],
      `estado_resultados_funcion_${startDate}_${endDate}.xlsx`,
      { title: 'Estado de resultado por función', dateRange },
    );
  };

  const exportMayor = () => {
    const rows = ledger.map(r => [
      r.date,
      r.entry_number,
      r.description || '',
      r.third_party_name || '',
      Number(r.debit) || 0,
      Number(r.credit) || 0,
      Number(r.running_balance) || 0,
    ]);
    downloadExcelReport(
      'Libro mayor',
      ['Fecha', 'Comprobante', 'Descripción', 'Tercero', 'Débito', 'Crédito', 'Saldo'],
      rows,
      `libro_mayor_${accountCode}_${startDate}_${endDate}.xlsx`,
      { title: `Libro mayor · cuenta ${accountCode}`, dateRange },
    );
  };

  const exportAuxiliar = () => {
    const rows = auxMovs.map(r => [
      r.date,
      r.voucher_number,
      r.description || '',
      r.third_party_name || '',
      Number(r.debit) || 0,
      Number(r.credit) || 0,
      Number(r.balance) || 0,
    ]);
    downloadExcelReport(
      'Auxiliar',
      ['Fecha', 'Comprobante', 'Descripción', 'Tercero', 'Débito', 'Crédito', 'Saldo'],
      rows,
      `auxiliar_${accountCode}_${startDate}_${endDate}.xlsx`,
      { title: `Auxiliar · cuenta ${accountCode}`, dateRange },
    );
  };

  const exportTrial = () => {
    const rows = trial.map(r => [
      r.account_code,
      r.account_name,
      r.account_type || '',
      Number(r.debit) || 0,
      Number(r.credit) || 0,
      Number(r.balance) || 0,
    ]);
    // Totales al final
    const totalDebit = trial.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const totalCredit = trial.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    rows.push(['', 'TOTAL', '', totalDebit, totalCredit, '']);
    downloadExcelReport(
      'Balance de prueba',
      ['Código', 'Nombre', 'Tipo', 'Débito', 'Crédito', 'Saldo'],
      rows,
      `balance_prueba_${startDate}_${endDate}.xlsx`,
      { title: 'Balance de prueba', dateRange },
    );
  };

  const exportBalance = () => {
    if (!balanceSheet) return;
    const sections: { label: string; items: any[] }[] = [];
    const pushSection = (label: string, items: any[] | undefined) => {
      if (items && items.length > 0) sections.push({ label, items });
    };
    // El endpoint puede devolver {assets/liabilities/equity} o {activos/pasivos/patrimonio}
    pushSection('ACTIVOS', balanceSheet.assets || balanceSheet.activos);
    pushSection('PASIVOS', balanceSheet.liabilities || balanceSheet.pasivos);
    pushSection('PATRIMONIO', balanceSheet.equity || balanceSheet.patrimonio);

    const body = flattenSectioned(sections, (it: any) => [
      it.account_code || '',
      it.account_name || '',
      Number(it.balance) || 0,
    ]);
    // agregar totales si están
    const totals: (string | number)[][] = [];
    const totalAssets = balanceSheet.total_assets ?? balanceSheet.totalAssets;
    const totalLiab = balanceSheet.total_liabilities ?? balanceSheet.totalLiabilities;
    const totalEq = balanceSheet.total_equity ?? balanceSheet.totalEquity;
    if (totalAssets != null) totals.push(['', 'TOTAL ACTIVOS', '', Number(totalAssets)]);
    if (totalLiab != null) totals.push(['', 'TOTAL PASIVOS', '', Number(totalLiab)]);
    if (totalEq != null) totals.push(['', 'TOTAL PATRIMONIO', '', Number(totalEq)]);

    downloadExcelReport(
      'Balance general',
      ['Sección', 'Código', 'Nombre', 'Saldo'],
      [...body, ...totals],
      `balance_general_${endDate}.xlsx`,
      { title: `Balance general al ${endDate}` },
    );
  };

  const exportPyg = () => {
    if (!incomeStatement) return;
    const { ingresos = [], costos = [], gastos = [], utilidadBruta = 0, utilidadOperacional = 0, utilidadNeta = 0 } = incomeStatement;
    const body = flattenSectioned(
      [
        { label: 'INGRESOS', items: ingresos },
        { label: 'COSTOS', items: costos },
        { label: 'GASTOS OPERACIONALES', items: gastos },
      ],
      (it: any) => [it.account_code || '', it.account_name || '', Number(it.balance) || 0],
    );
    const totals: (string | number)[][] = [
      [],
      ['', 'UTILIDAD BRUTA', '', Number(utilidadBruta) || 0],
      ['', 'UTILIDAD OPERACIONAL', '', Number(utilidadOperacional) || 0],
      ['', 'UTILIDAD NETA', '', Number(utilidadNeta) || 0],
    ];
    downloadExcelReport(
      'P&G',
      ['Sección', 'Código', 'Nombre', 'Valor'],
      [...body, ...totals],
      `estado_resultados_${startDate}_${endDate}.xlsx`,
      { title: 'Estado de resultado', dateRange },
    );
  };

  const exportFlujo = () => {
    if (!cashFlow) return;
    const { operacion = {}, inversion = {}, financiacion = {}, resumen = {} } = cashFlow;
    const num = (v: any) => Number(v) || 0;
    const rows: (string | number)[][] = [
      ['ACTIVIDADES DE OPERACIÓN', '', num(operacion.total)],
      ['', 'Utilidad neta del período', num(operacion.utilidadNeta)],
      ['', '(+) Depreciación', num(operacion.depreciacion)],
      ['', '(+) Amortización', num(operacion.amortizacion)],
      ['', '(+) Provisiones', num(operacion.provisiones)],
      ['', 'Variación cuentas por cobrar', num(operacion.deltaCxC)],
      ['', 'Variación inventarios', num(operacion.deltaInventarios)],
      ['', 'Variación cuentas por pagar', num(operacion.deltaCxP)],
      ['ACTIVIDADES DE INVERSIÓN', '', num(inversion.total)],
      ['', 'Adquisición / venta de activos fijos', num(inversion.adquisicionActivos)],
      ['ACTIVIDADES DE FINANCIACIÓN', '', num(financiacion.total)],
      ['', 'Variación obligaciones financieras', num(financiacion.deltaDeuda)],
      ['', 'Aportes / retiros de capital', num(financiacion.deltaCapital)],
      ['', 'Dividendos pagados', num(financiacion.dividendos)],
      [],
      ['RESUMEN', '', ''],
      ['', 'Flujo neto calculado', num(resumen.flujoNetoCalculado)],
      ['', 'Variación caja real', num(resumen.variacionCajaReal)],
      ['', 'Diferencia', num(resumen.diferencia)],
      ['', 'Caja inicial', num(resumen.cajaInicial)],
      ['', 'Caja final', num(resumen.cajaFinal)],
    ];
    downloadExcelReport(
      'Flujo efectivo',
      ['Sección', 'Concepto', 'Valor'],
      rows,
      `flujo_efectivo_${startDate}_${endDate}.xlsx`,
      { title: 'Estado de Flujo de Efectivo — Método indirecto', dateRange },
    );
  };

  const exportPatrimonio = () => {
    if (!equityChanges) return;
    const { cuentas = [], totales = {} } = equityChanges;
    const rows = cuentas.map((c: any) => [
      c.account_code || '',
      c.account_name || '',
      Number(c.saldo_inicial) || 0,
      Number(c.debitos) || 0,
      Number(c.creditos) || 0,
      Number(c.variacion) || 0,
      Number(c.saldo_final) || 0,
    ]);
    rows.push([
      '',
      'TOTALES',
      Number(totales.saldo_inicial) || 0,
      Number(totales.debitos) || 0,
      Number(totales.creditos) || 0,
      Number(totales.variacion) || 0,
      Number(totales.saldo_final) || 0,
    ]);
    downloadExcelReport(
      'Patrimonio',
      ['Código', 'Cuenta', 'Saldo inicial', 'Débitos', 'Créditos', 'Variación', 'Saldo final'],
      rows,
      `cambios_patrimonio_${startDate}_${endDate}.xlsx`,
      { title: 'Estado de Cambios en el Patrimonio', dateRange },
    );
  };

  // ============================================================
  // Exports a PDF
  // ============================================================
  // Helper para construir el meta del PDF de forma consistente.
  // `signatures: undefined` hace que el helper pinte líneas en blanco "Contador / Revisor Fiscal".
  const buildPdfMeta = (
    title: string,
    extra?: { dateRange?: string; subtitle?: string; extraLines?: string[] },
  ): PdfReportMeta => ({
    title,
    dateRange: extra?.dateRange,
    subtitle: extra?.subtitle,
    extra: extra?.extraLines,
    // TODO(tpia): tenantName / tenantTaxId — pendiente de wiring.
    // TODO(tpia): signatures — pendiente de wiring desde configuración del tenant.
    signatures: undefined,
  });

  const exportPdfDiario = () => {
    const rows: PdfCellValue[][] = entries.map(e => [
      e.entry_number,
      e.date,
      e.description,
      Number(e.total_debit) || 0,
      Number(e.total_credit) || 0,
      e.status,
    ]);
    downloadPdfReport(
      ['Número', 'Fecha', 'Descripción', 'Débito', 'Crédito', 'Estado'],
      rows,
      `libro_diario_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Libro diario', { dateRange }),
    );
  };

  const exportPdfDiarioResumen = () => {
    const rows: PdfCellValue[][] = diarioResumen.map(r => [
      r.date,
      Number(r.count) || 0,
      Number(r.total_debit) || 0,
      Number(r.total_credit) || 0,
    ]);
    const totalCount = diarioResumen.reduce((s, r) => s + (Number(r.count) || 0), 0);
    const totalDebit = diarioResumen.reduce((s, r) => s + (Number(r.total_debit) || 0), 0);
    const totalCredit = diarioResumen.reduce((s, r) => s + (Number(r.total_credit) || 0), 0);
    rows.push(['TOTAL', totalCount, totalDebit, totalCredit]);
    downloadPdfReport(
      ['Fecha', 'Comprobantes', 'Débito', 'Crédito'],
      rows,
      `diario_resumido_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Libro diario resumido', { dateRange }),
    );
  };

  const exportPdfUnposted = () => {
    const rows: PdfCellValue[][] = unposted.map(e => [
      e.entry_number,
      e.date,
      e.description,
      Number(e.total_debit) || 0,
      Number(e.total_credit) || 0,
      e.status,
      e.reversed_by_entry_id ? `→ ${e.reversed_by_entry_id}` : '',
    ]);
    downloadPdfReport(
      ['Número', 'Fecha', 'Descripción', 'Débito', 'Crédito', 'Estado', 'Reversado por'],
      rows,
      `no_contabilizados_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Comprobantes no contabilizados', { dateRange }),
    );
  };

  const exportPdfTrialByTp = () => {
    const rows: PdfCellValue[][] = trialByTp.map(r => [
      r.document_number,
      r.name,
      Number(r.debit) || 0,
      Number(r.credit) || 0,
      Number(r.balance) || 0,
      Number(r.lines) || 0,
    ]);
    const totalDebit = trialByTp.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const totalCredit = trialByTp.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const totalBalance = trialByTp.reduce((s, r) => s + (Number(r.balance) || 0), 0);
    rows.push(['', 'TOTAL', totalDebit, totalCredit, totalBalance, '']);
    downloadPdfReport(
      ['Documento', 'Nombre', 'Débito', 'Crédito', 'Saldo', 'Líneas'],
      rows,
      `balance_por_tercero_${startDate}_${endDate}.pdf`,
      buildPdfMeta(`Balance de prueba por tercero${accountCode ? ` · cuenta ${accountCode}` : ''}`, { dateRange }),
    );
  };

  const exportPdfLibroCompras = () => {
    const rows: PdfCellValue[][] = libroCompras.map(r => [
      r.consecutivo, r.fecha, r.proveedor_tipo_documento, r.proveedor_numero_documento,
      r.proveedor_nombre, r.tipo_documento || '', r.numero_factura || '',
      r.base_gravable, r.iva_descontable, r.retefuente, r.reteiva, r.reteica, r.total,
    ]);
    if (librosComprasTotals) {
      rows.push(['', '', '', '', 'TOTAL', '', '',
        librosComprasTotals.base, librosComprasTotals.iva, librosComprasTotals.retefuente,
        librosComprasTotals.reteIva, librosComprasTotals.reteIca, librosComprasTotals.total]);
    }
    downloadPdfReport(
      ['#', 'Fecha', 'Tipo doc', 'NIT', 'Proveedor', 'Tipo doc FC', 'Nº factura',
       'Base', 'IVA descontable', 'Retefuente', 'ReteIVA', 'ReteICA', 'Total'],
      rows,
      `libro_compras_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Libro Oficial de Compras', { dateRange }),
    );
  };

  const exportPdfLibroVentas = () => {
    const rows: PdfCellValue[][] = libroVentas.map(r => [
      r.consecutivo, r.fecha, r.cliente_tipo_documento, r.cliente_numero_documento,
      r.cliente_nombre, r.tipo_documento || '', r.numero_factura || '',
      r.base_gravable, r.iva_generado, r.retefuente, r.reteiva, r.reteica, r.total,
    ]);
    if (librosVentasTotals) {
      rows.push(['', '', '', '', 'TOTAL', '', '',
        librosVentasTotals.base, librosVentasTotals.iva, librosVentasTotals.retefuente,
        librosVentasTotals.reteIva, librosVentasTotals.reteIca, librosVentasTotals.total]);
    }
    downloadPdfReport(
      ['#', 'Fecha', 'Tipo doc', 'NIT', 'Cliente', 'Tipo doc FC', 'Nº factura',
       'Base', 'IVA generado', 'Retefuente', 'ReteIVA', 'ReteICA', 'Total'],
      rows,
      `libro_ventas_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Libro Oficial de Ventas', { dateRange }),
    );
  };

  const exportPdfLibroInventarios = () => {
    const rows: PdfCellValue[][] = libroInventarios.map(r => [
      r.codigo, r.nombre, r.tipo,
      Number(r.saldo_inicial) || 0,
      Number(r.debitos) || 0,
      Number(r.creditos) || 0,
      Number(r.saldo_final) || 0,
    ]);
    downloadPdfReport(
      ['Código', 'Cuenta', 'Tipo', 'Saldo inicial', 'Débitos', 'Créditos', 'Saldo final'],
      rows,
      `libro_inventarios_balance_${endDate}.pdf`,
      buildPdfMeta(`Libro de Inventarios y Balance al ${endDate}`),
    );
  };

  const exportPdfTrialConfig = () => {
    const rows: PdfCellValue[][] = trialConfig.map(r => [
      r.account_code, r.account_name, r.account_type || '',
      Number(r.debit) || 0, Number(r.credit) || 0, Number(r.balance) || 0,
    ]);
    const totalDebit = trialConfig.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const totalCredit = trialConfig.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const totalBalance = trialConfig.reduce((s, r) => s + (Number(r.balance) || 0), 0);
    rows.push(['', 'TOTAL', '', totalDebit, totalCredit, totalBalance]);
    const filtersLine = [
      trialConfigFilters.accountFrom && `Desde ${trialConfigFilters.accountFrom}`,
      trialConfigFilters.accountTo && `Hasta ${trialConfigFilters.accountTo}`,
      trialConfigFilters.level && `Nivel ${trialConfigFilters.level}`,
      trialConfigFilters.onlyWithMovement && 'Solo con movimiento',
    ].filter(Boolean).join(' · ');
    downloadPdfReport(
      ['Código', 'Nombre', 'Tipo', 'Débito', 'Crédito', 'Saldo'],
      rows,
      `balance_configurable_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Balance de prueba configurable', {
        dateRange,
        extraLines: filtersLine ? [filtersLine] : undefined,
      }),
    );
  };

  const exportPdfMayor = () => {
    const rows: PdfCellValue[][] = ledger.map(r => [
      r.date,
      r.entry_number,
      r.description || '',
      r.third_party_name || '',
      Number(r.debit) || 0,
      Number(r.credit) || 0,
      Number(r.running_balance) || 0,
    ]);
    downloadPdfReport(
      ['Fecha', 'Comprobante', 'Descripción', 'Tercero', 'Débito', 'Crédito', 'Saldo'],
      rows,
      `libro_mayor_${accountCode}_${startDate}_${endDate}.pdf`,
      buildPdfMeta(`Libro mayor · cuenta ${accountCode}`, { dateRange }),
    );
  };

  const exportPdfAuxiliar = () => {
    const rows: PdfCellValue[][] = auxMovs.map(r => [
      r.date,
      r.voucher_number,
      r.description || '',
      r.third_party_name || '',
      Number(r.debit) || 0,
      Number(r.credit) || 0,
      Number(r.balance) || 0,
    ]);
    downloadPdfReport(
      ['Fecha', 'Comprobante', 'Descripción', 'Tercero', 'Débito', 'Crédito', 'Saldo'],
      rows,
      `auxiliar_${accountCode}_${startDate}_${endDate}.pdf`,
      buildPdfMeta(`Auxiliar · cuenta ${accountCode}`, { dateRange }),
    );
  };

  const exportPdfTrial = () => {
    const rows: PdfCellValue[][] = trial.map(r => [
      r.account_code,
      r.account_name,
      r.account_type || '',
      Number(r.debit) || 0,
      Number(r.credit) || 0,
      Number(r.balance) || 0,
    ]);
    const totalDebit = trial.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const totalCredit = trial.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    rows.push(['', 'TOTAL', '', totalDebit, totalCredit, '']);
    downloadPdfReport(
      ['Código', 'Nombre', 'Tipo', 'Débito', 'Crédito', 'Saldo'],
      rows,
      `balance_prueba_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Balance de prueba', { dateRange }),
    );
  };

  const exportPdfBalance = () => {
    if (!balanceSheet) return;
    const assets: BalanceAccount[] = balanceSheet.assets || balanceSheet.activos || [];
    const liabilities: BalanceAccount[] = balanceSheet.liabilities || balanceSheet.pasivos || [];
    const equity: BalanceAccount[] = balanceSheet.equity || balanceSheet.patrimonio || [];
    const totalAssets = balanceSheet.total_assets ?? balanceSheet.totalAssets;
    const totalLiab = balanceSheet.total_liabilities ?? balanceSheet.totalLiabilities;
    const totalEq = balanceSheet.total_equity ?? balanceSheet.totalEquity;

    const sectionItems = (arr: BalanceAccount[]): PdfCellValue[][] =>
      arr.map(it => [it.account_code || '', it.account_name || '', Number(it.balance) || 0]);

    const sections: PdfSection[] = [];
    if (assets.length > 0) {
      sections.push({
        label: 'ACTIVOS',
        items: sectionItems(assets),
        total: totalAssets != null ? { label: 'TOTAL ACTIVOS', value: Number(totalAssets) } : undefined,
        color: 'primary',
      });
    }
    if (liabilities.length > 0) {
      sections.push({
        label: 'PASIVOS',
        items: sectionItems(liabilities),
        total: totalLiab != null ? { label: 'TOTAL PASIVOS', value: Number(totalLiab) } : undefined,
        color: 'danger',
      });
    }
    if (equity.length > 0) {
      sections.push({
        label: 'PATRIMONIO',
        items: sectionItems(equity),
        total: totalEq != null ? { label: 'TOTAL PATRIMONIO', value: Number(totalEq) } : undefined,
        color: 'success',
      });
    }

    const grandTotals: { label: string; value: PdfCellValue }[] = [];
    if (totalLiab != null && totalEq != null) {
      grandTotals.push({ label: 'TOTAL PASIVO + PATRIMONIO', value: Number(totalLiab) + Number(totalEq) });
    }
    if (totalAssets != null) {
      grandTotals.push({ label: 'TOTAL ACTIVOS', value: Number(totalAssets) });
    }

    downloadPdfSectionedReport(
      ['Código', 'Nombre', 'Saldo'],
      sections,
      grandTotals,
      `balance_general_${endDate}.pdf`,
      buildPdfMeta(`Balance general al ${endDate}`),
    );
  };

  const exportPdfPyg = () => {
    if (!incomeStatement) return;
    const {
      ingresos = [],
      costos = [],
      gastos = [],
      utilidadBruta = 0,
      utilidadOperacional = 0,
      utilidadNeta = 0,
    } = incomeStatement;
    const toRow = (it: BalanceAccount): PdfCellValue[] => [
      it.account_code || '',
      it.account_name || '',
      Number(it.balance) || 0,
    ];
    const sections: PdfSection[] = ([
      { label: 'INGRESOS', items: (ingresos as BalanceAccount[]).map(toRow), color: 'success' },
      { label: 'COSTOS', items: (costos as BalanceAccount[]).map(toRow), color: 'warning' },
      { label: 'GASTOS OPERACIONALES', items: (gastos as BalanceAccount[]).map(toRow), color: 'danger' },
    ] as PdfSection[]).filter(s => s.items.length > 0);

    const grandTotals: { label: string; value: PdfCellValue }[] = [
      { label: 'UTILIDAD BRUTA', value: Number(utilidadBruta) || 0 },
      { label: 'UTILIDAD OPERACIONAL', value: Number(utilidadOperacional) || 0 },
      { label: 'UTILIDAD NETA', value: Number(utilidadNeta) || 0 },
    ];

    downloadPdfSectionedReport(
      ['Código', 'Nombre', 'Valor'],
      sections,
      grandTotals,
      `estado_resultados_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Estado de resultado', { dateRange }),
    );
  };

  const exportPdfPygFuncion = () => {
    if (!pygFuncion) return;
    const t = pygFuncion.totals;
    const toRow = (it: BalanceAccount): PdfCellValue[] => [
      it.account_code,
      it.account_name,
      Number(it.balance) || 0,
    ];
    const rawSections: { label: string; items: BalanceAccount[]; color: PdfSection['color'] }[] = [
      { label: 'INGRESOS OPERACIONALES', items: pygFuncion.ingresos, color: 'success' },
      { label: 'COSTO DE VENTAS', items: pygFuncion.costoVentas, color: 'warning' },
      { label: 'GASTOS DE ADMINISTRACIÓN', items: pygFuncion.gastosAdmin, color: 'danger' },
      { label: 'GASTOS DE VENTAS', items: pygFuncion.gastosVentas, color: 'danger' },
      { label: 'GASTOS NO OPERACIONALES', items: pygFuncion.gastosNoOperacionales, color: 'secondary' },
      { label: 'IMPUESTO DE RENTA', items: pygFuncion.impuestoRenta, color: 'info' },
    ];
    const sections: PdfSection[] = rawSections
      .filter(s => s.items && s.items.length > 0)
      .map(s => ({ label: s.label, items: s.items.map(toRow), color: s.color }));

    const grandTotals: { label: string; value: PdfCellValue }[] = [
      { label: 'UTILIDAD BRUTA', value: Number(t.utilidadBruta) || 0 },
      { label: 'UTILIDAD OPERACIONAL', value: Number(t.utilidadOperacional) || 0 },
      { label: 'UTILIDAD ANTES DE IMPUESTOS', value: Number(t.utilidadAntesImpuestos) || 0 },
      { label: 'UTILIDAD NETA', value: Number(t.utilidadNeta) || 0 },
    ];

    downloadPdfSectionedReport(
      ['Código', 'Nombre', 'Valor'],
      sections,
      grandTotals,
      `estado_resultados_funcion_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Estado de resultado por función', {
        dateRange,
        subtitle: 'Por función de gastos',
      }),
    );
  };

  const exportPdfFlujo = () => {
    if (!cashFlow) return;
    const { operacion = {}, inversion = {}, financiacion = {}, resumen = {} } = cashFlow;
    const num = (v: any): number => Number(v) || 0;

    const sections: PdfSection[] = [
      {
        label: 'ACTIVIDADES DE OPERACIÓN',
        color: 'primary',
        items: [
          ['Utilidad neta del período', num(operacion.utilidadNeta)],
          ['(+) Depreciación', num(operacion.depreciacion)],
          ['(+) Amortización', num(operacion.amortizacion)],
          ['(+) Provisiones', num(operacion.provisiones)],
          ['Variación cuentas por cobrar', num(operacion.deltaCxC)],
          ['Variación inventarios', num(operacion.deltaInventarios)],
          ['Variación cuentas por pagar', num(operacion.deltaCxP)],
        ],
        total: { label: 'Flujo de operación', value: num(operacion.total) },
      },
      {
        label: 'ACTIVIDADES DE INVERSIÓN',
        color: 'warning',
        items: [
          ['Adquisición / venta de activos fijos', num(inversion.adquisicionActivos)],
        ],
        total: { label: 'Flujo de inversión', value: num(inversion.total) },
      },
      {
        label: 'ACTIVIDADES DE FINANCIACIÓN',
        color: 'info',
        items: [
          ['Variación obligaciones financieras', num(financiacion.deltaDeuda)],
          ['Aportes / retiros de capital', num(financiacion.deltaCapital)],
          ['Dividendos pagados', num(financiacion.dividendos)],
        ],
        total: { label: 'Flujo de financiación', value: num(financiacion.total) },
      },
      {
        label: 'RESUMEN',
        color: 'secondary',
        items: [
          ['Flujo neto calculado', num(resumen.flujoNetoCalculado)],
          ['Variación caja real', num(resumen.variacionCajaReal)],
          ['Diferencia', num(resumen.diferencia)],
          ['Caja inicial', num(resumen.cajaInicial)],
          ['Caja final', num(resumen.cajaFinal)],
        ],
      },
    ];

    const grandTotals: { label: string; value: PdfCellValue }[] = [
      { label: 'Caja inicial', value: num(resumen.cajaInicial) },
      { label: 'Flujo neto calculado', value: num(resumen.flujoNetoCalculado) },
      { label: 'Caja final', value: num(resumen.cajaFinal) },
    ];

    downloadPdfSectionedReport(
      ['Concepto', 'Valor'],
      sections,
      grandTotals,
      `flujo_efectivo_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Estado de Flujo de Efectivo — Método indirecto', { dateRange }),
    );
  };

  const exportPdfPatrimonio = () => {
    if (!equityChanges) return;
    const { cuentas = [], totales = {} } = equityChanges;
    const items: PdfCellValue[][] = cuentas.map((c: any) => [
      c.account_code || '',
      c.account_name || '',
      Number(c.saldo_inicial) || 0,
      Number(c.debitos) || 0,
      Number(c.creditos) || 0,
      Number(c.variacion) || 0,
      Number(c.saldo_final) || 0,
    ]);

    const sections: PdfSection[] = [
      {
        label: 'CUENTAS DE PATRIMONIO',
        color: 'success',
        items,
      },
    ];

    const grandTotals: { label: string; value: PdfCellValue }[] = [
      { label: 'Saldo inicial', value: Number(totales.saldo_inicial) || 0 },
      { label: 'Débitos', value: Number(totales.debitos) || 0 },
      { label: 'Créditos', value: Number(totales.creditos) || 0 },
      { label: 'Variación', value: Number(totales.variacion) || 0 },
      { label: 'Saldo final', value: Number(totales.saldo_final) || 0 },
    ];

    downloadPdfSectionedReport(
      ['Código', 'Cuenta', 'Saldo inicial', 'Débitos', 'Créditos', 'Variación', 'Saldo final'],
      sections,
      grandTotals,
      `cambios_patrimonio_${startDate}_${endDate}.pdf`,
      buildPdfMeta('Estado de Cambios en el Patrimonio', { dateRange }),
    );
  };

  const canExport = (() => {
    if (view === 'diario') return entries.length > 0;
    if (view === 'diario-resumido') return diarioResumen.length > 0;
    if (view === 'no-contabilizados') return unposted.length > 0;
    if (view === 'trial-tercero') return trialByTp.length > 0;
    if (view === 'libro-compras') return libroCompras.length > 0;
    if (view === 'libro-ventas') return libroVentas.length > 0;
    if (view === 'libro-inventarios') return libroInventarios.length > 0;
    if (view === 'pyg-funcion') return !!pygFuncion;
    if (view === 'trial-config') return trialConfig.length > 0;
    if (view === 'mayor') return ledger.length > 0;
    if (view === 'auxiliar') return auxMovs.length > 0;
    if (view === 'trial') return trial.length > 0;
    if (view === 'balance') return !!balanceSheet;
    if (view === 'pyg') return !!incomeStatement;
    if (view === 'flujo') return !!cashFlow;
    if (view === 'patrimonio') return !!equityChanges;
    return false;
  })();

  const doExport = () => {
    if (view === 'diario') exportDiario();
    else if (view === 'diario-resumido') exportDiarioResumen();
    else if (view === 'no-contabilizados') exportUnposted();
    else if (view === 'trial-tercero') exportTrialByTp();
    else if (view === 'libro-compras') exportLibroCompras();
    else if (view === 'libro-ventas') exportLibroVentas();
    else if (view === 'libro-inventarios') exportLibroInventarios();
    else if (view === 'pyg-funcion') exportPygFuncion();
    else if (view === 'trial-config') exportTrialConfig();
    else if (view === 'mayor') exportMayor();
    else if (view === 'auxiliar') exportAuxiliar();
    else if (view === 'trial') exportTrial();
    else if (view === 'balance') exportBalance();
    else if (view === 'pyg') exportPyg();
    else if (view === 'flujo') exportFlujo();
    else if (view === 'patrimonio') exportPatrimonio();
  };

  // Export a PDF: usa el helper pdfExport (jsPDF + autoTable) con encabezado, totales y firmas.
  const doExportPDF = () => {
    if (!canExport) {
      showToast('No hay datos para exportar. Aplicá filtros primero.');
      return;
    }
    if (view === 'diario') exportPdfDiario();
    else if (view === 'diario-resumido') exportPdfDiarioResumen();
    else if (view === 'no-contabilizados') exportPdfUnposted();
    else if (view === 'trial-tercero') exportPdfTrialByTp();
    else if (view === 'libro-compras') exportPdfLibroCompras();
    else if (view === 'libro-ventas') exportPdfLibroVentas();
    else if (view === 'libro-inventarios') exportPdfLibroInventarios();
    else if (view === 'pyg-funcion') exportPdfPygFuncion();
    else if (view === 'trial-config') exportPdfTrialConfig();
    else if (view === 'mayor') exportPdfMayor();
    else if (view === 'auxiliar') exportPdfAuxiliar();
    else if (view === 'trial') exportPdfTrial();
    else if (view === 'balance') exportPdfBalance();
    else if (view === 'pyg') exportPdfPyg();
    else if (view === 'flujo') exportPdfFlujo();
    else if (view === 'patrimonio') exportPdfPatrimonio();
  };

  const renderLoading = () => (
    <div className="text-center py-5">
      <Spinner color="primary" />
    </div>
  );

  const renderEmpty = (msg: string) => (
    <div className="text-center py-5 text-muted">
      <i className="ri-inbox-line fs-48 d-block mb-2"></i>
      {msg}
    </div>
  );

  const renderTrialConfig = () => {
    const totalDebit = trialConfig.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const totalCredit = trialConfig.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const totalBalance = trialConfig.reduce((s, r) => s + (Number(r.balance) || 0), 0);
    return (
      <>
        <Card className="border mb-3">
          <CardBody className="py-2">
            <Row className="g-2 align-items-end">
              <Col md={2}>
                <Label className="fs-12 mb-1">Desde cuenta</Label>
                <Input bsSize="sm" className="font-monospace" placeholder="Ej: 1"
                  value={trialConfigFilters.accountFrom}
                  onChange={e => setTrialConfigFilters(f => ({ ...f, accountFrom: e.target.value }))} />
              </Col>
              <Col md={2}>
                <Label className="fs-12 mb-1">Hasta cuenta</Label>
                <Input bsSize="sm" className="font-monospace" placeholder="Ej: 7"
                  value={trialConfigFilters.accountTo}
                  onChange={e => setTrialConfigFilters(f => ({ ...f, accountTo: e.target.value }))} />
              </Col>
              <Col md={3}>
                <Label className="fs-12 mb-1">Agrupar a nivel</Label>
                <Input bsSize="sm" type="select"
                  value={trialConfigFilters.level}
                  onChange={e => setTrialConfigFilters(f => ({ ...f, level: e.target.value }))}>
                  <option value="">Sin agrupar (máximo detalle)</option>
                  <option value="1">Clase (1 dígito)</option>
                  <option value="2">Grupo (2 dígitos)</option>
                  <option value="4">Cuenta (4 dígitos)</option>
                  <option value="6">Subcuenta (6 dígitos)</option>
                  <option value="8">Auxiliar (8 dígitos)</option>
                </Input>
              </Col>
              <Col md={3}>
                <div className="form-check mt-3">
                  <Input type="checkbox" className="form-check-input" id="tcf-only-mov"
                    checked={trialConfigFilters.onlyWithMovement}
                    onChange={e => setTrialConfigFilters(f => ({ ...f, onlyWithMovement: e.target.checked }))} />
                  <Label for="tcf-only-mov" className="form-check-label fs-13">Solo con movimiento</Label>
                </div>
              </Col>
              <Col md={2}>
                <Button color="primary" size="sm" className="w-100" onClick={applyFilters}>
                  <i className="ri-refresh-line me-1"></i>Recalcular
                </Button>
              </Col>
            </Row>
          </CardBody>
        </Card>

        {loading ? renderLoading() : !trialConfig.length ? renderEmpty('Sin resultados para esos filtros.') : (
          <div className="table-responsive">
            <Table size="sm" hover className="align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th className="text-end">Débito</th>
                  <th className="text-end">Crédito</th>
                  <th className="text-end">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {trialConfig.map((r, i) => (
                  <tr key={i}>
                    <td className="font-monospace">{r.account_code}</td>
                    <td>{r.account_name}</td>
                    <td><Badge color={accountTypeColor(r.account_type)} className="fs-11">{r.account_type}</Badge></td>
                    <td className="text-end font-monospace">{money(r.debit)}</td>
                    <td className="text-end font-monospace">{money(r.credit)}</td>
                    <td className="text-end font-monospace fw-semibold">{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-secondary fw-bold">
                  <td colSpan={3}>TOTAL</td>
                  <td className="text-end font-monospace">{money(totalDebit)}</td>
                  <td className="text-end font-monospace">{money(totalCredit)}</td>
                  <td className="text-end font-monospace">{money(totalBalance)}</td>
                </tr>
              </tfoot>
            </Table>
          </div>
        )}
      </>
    );
  };

  const renderLibroCompras = () => {
    if (loading) return renderLoading();
    if (!libroCompras.length) return renderEmpty('Sin facturas de compra en el período.');
    return (
      <div className="table-responsive">
        <Table size="sm" hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>#</th><th>Fecha</th><th>NIT</th><th>Proveedor</th><th>Factura</th>
              <th className="text-end">Base</th>
              <th className="text-end">IVA</th>
              <th className="text-end">Retefte</th>
              <th className="text-end">ReteIVA</th>
              <th className="text-end">ReteICA</th>
              <th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {libroCompras.map(r => (
              <tr key={r.id}>
                <td>{r.consecutivo}</td>
                <td className="fs-12">{r.fecha}</td>
                <td className="font-monospace fs-12">{r.proveedor_numero_documento}</td>
                <td className="fs-13">{r.proveedor_nombre}</td>
                <td className="font-monospace fs-12">{r.numero_factura}</td>
                <td className="text-end font-monospace">{money(r.base_gravable)}</td>
                <td className="text-end font-monospace">{money(r.iva_descontable)}</td>
                <td className="text-end font-monospace">{money(r.retefuente)}</td>
                <td className="text-end font-monospace">{money(r.reteiva)}</td>
                <td className="text-end font-monospace">{money(r.reteica)}</td>
                <td className="text-end font-monospace fw-semibold">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
          {librosComprasTotals && (
            <tfoot>
              <tr className="table-secondary fw-bold">
                <td colSpan={5}>TOTAL</td>
                <td className="text-end font-monospace">{money(librosComprasTotals.base)}</td>
                <td className="text-end font-monospace">{money(librosComprasTotals.iva)}</td>
                <td className="text-end font-monospace">{money(librosComprasTotals.retefuente)}</td>
                <td className="text-end font-monospace">{money(librosComprasTotals.reteIva)}</td>
                <td className="text-end font-monospace">{money(librosComprasTotals.reteIca)}</td>
                <td className="text-end font-monospace">{money(librosComprasTotals.total)}</td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    );
  };

  const renderLibroVentas = () => {
    if (loading) return renderLoading();
    if (!libroVentas.length) return renderEmpty('Sin facturas de venta en el período.');
    return (
      <div className="table-responsive">
        <Table size="sm" hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>#</th><th>Fecha</th><th>NIT</th><th>Cliente</th><th>Factura</th>
              <th className="text-end">Base</th>
              <th className="text-end">IVA</th>
              <th className="text-end">Retefte</th>
              <th className="text-end">ReteIVA</th>
              <th className="text-end">ReteICA</th>
              <th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {libroVentas.map(r => (
              <tr key={r.id}>
                <td>{r.consecutivo}</td>
                <td className="fs-12">{r.fecha}</td>
                <td className="font-monospace fs-12">{r.cliente_numero_documento}</td>
                <td className="fs-13">{r.cliente_nombre}</td>
                <td className="font-monospace fs-12">{r.numero_factura}</td>
                <td className="text-end font-monospace">{money(r.base_gravable)}</td>
                <td className="text-end font-monospace">{money(r.iva_generado)}</td>
                <td className="text-end font-monospace">{money(r.retefuente)}</td>
                <td className="text-end font-monospace">{money(r.reteiva)}</td>
                <td className="text-end font-monospace">{money(r.reteica)}</td>
                <td className="text-end font-monospace fw-semibold">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
          {librosVentasTotals && (
            <tfoot>
              <tr className="table-secondary fw-bold">
                <td colSpan={5}>TOTAL</td>
                <td className="text-end font-monospace">{money(librosVentasTotals.base)}</td>
                <td className="text-end font-monospace">{money(librosVentasTotals.iva)}</td>
                <td className="text-end font-monospace">{money(librosVentasTotals.retefuente)}</td>
                <td className="text-end font-monospace">{money(librosVentasTotals.reteIva)}</td>
                <td className="text-end font-monospace">{money(librosVentasTotals.reteIca)}</td>
                <td className="text-end font-monospace">{money(librosVentasTotals.total)}</td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    );
  };

  const renderLibroInventarios = () => {
    if (loading) return renderLoading();
    if (!libroInventarios.length) return renderEmpty('Sin movimientos al cierre.');
    return (
      <div className="table-responsive">
        <Table size="sm" hover className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Código</th>
              <th>Cuenta</th>
              <th>Tipo</th>
              <th className="text-end">Saldo inicial</th>
              <th className="text-end">Débitos</th>
              <th className="text-end">Créditos</th>
              <th className="text-end">Saldo final</th>
            </tr>
          </thead>
          <tbody>
            {libroInventarios.map((r, i) => (
              <tr key={i}>
                <td className="font-monospace fs-12">{r.codigo}</td>
                <td>{r.nombre}</td>
                <td><Badge color={accountTypeColor(r.tipo)} className="fs-11">{r.tipo}</Badge></td>
                <td className="text-end font-monospace">{money(r.saldo_inicial)}</td>
                <td className="text-end font-monospace">{money(r.debitos)}</td>
                <td className="text-end font-monospace">{money(r.creditos)}</td>
                <td className="text-end font-monospace fw-semibold">{money(r.saldo_final)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  };

  const renderPygFuncion = () => {
    if (loading) return renderLoading();
    if (!pygFuncion) return renderEmpty('Sin datos de P&G por función.');
    const t = pygFuncion.totals;
    const signColor = (n: number) => (n >= 0 ? 'text-success' : 'text-danger');
    const section = (title: string, items: BalanceAccount[], total: number, color: string) => {
      if (!items || items.length === 0) return null;
      return (
        <Card className="border mb-2">
          <CardHeader className={`bg-${color}-subtle py-2`}>
            <div className="d-flex justify-content-between">
              <strong>{title}</strong>
              <span className="font-monospace fw-semibold">{money(total)}</span>
            </div>
          </CardHeader>
          <CardBody className="p-2">
            {items.map((a, i) => (
              <div key={i} className="d-flex justify-content-between px-2 py-1 small">
                <span>{a.account_name}</span>
                <span className="font-monospace">{money(a.balance)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      );
    };
    const totalRow = (label: string, val: number, bold = false, bg = 'light') => (
      <div className={`d-flex justify-content-between align-items-center border rounded p-3 mb-2 bg-${bg}`}>
        <span className={bold ? 'fw-bold' : 'fw-semibold'}>{label}</span>
        <span className={`${bold ? 'fs-18' : 'fs-16'} ${bold ? 'fw-bold' : 'fw-semibold'} font-monospace ${signColor(val)}`}>{money(val)}</span>
      </div>
    );
    return (
      <>
        <div className="mb-3">
          <h5 className="mb-0">Estado de resultado por función</h5>
          <small className="text-muted">Del {startDate} al {endDate}</small>
        </div>
        {section('INGRESOS OPERACIONALES', pygFuncion.ingresos, t.ingresos, 'success')}
        {section('COSTO DE VENTAS', pygFuncion.costoVentas, t.costoVentas, 'warning')}
        {totalRow('UTILIDAD BRUTA', t.utilidadBruta)}
        {section('GASTOS DE ADMINISTRACIÓN', pygFuncion.gastosAdmin, t.gastosAdmin, 'danger')}
        {section('GASTOS DE VENTAS', pygFuncion.gastosVentas, t.gastosVentas, 'danger')}
        {totalRow('UTILIDAD OPERACIONAL', t.utilidadOperacional)}
        {section('GASTOS NO OPERACIONALES', pygFuncion.gastosNoOperacionales, t.gastosNoOperacionales, 'secondary')}
        {totalRow('UTILIDAD ANTES DE IMPUESTOS', t.utilidadAntesImpuestos)}
        {section('IMPUESTO DE RENTA', pygFuncion.impuestoRenta, t.impuestoRenta, 'dark')}
        {totalRow('UTILIDAD NETA', t.utilidadNeta, true, 'primary-subtle')}
      </>
    );
  };

  const renderUnposted = () => {
    if (loading) return renderLoading();
    if (!unposted.length) return renderEmpty('No hay comprobantes sin contabilizar en el período. (Aparecen aquí los reversados, borradores y anulados.)');
    return (
      <Table size="sm" hover responsive className="align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Número</th>
            <th>Fecha</th>
            <th>Descripción</th>
            <th className="text-end">Débito</th>
            <th className="text-end">Crédito</th>
            <th>Estado</th>
            <th>Reversado por</th>
          </tr>
        </thead>
        <tbody>
          {unposted.map(e => (
            <tr key={e.id}>
              <td className="font-monospace">{e.entry_number}</td>
              <td>{e.date}</td>
              <td>{e.description}</td>
              <td className="text-end font-monospace">{money(e.total_debit)}</td>
              <td className="text-end font-monospace">{money(e.total_credit)}</td>
              <td><Badge color="warning-subtle" className="text-dark">{e.status}</Badge></td>
              <td className="font-monospace fs-12">{e.reversed_by_entry_id ? `→ ${e.reversed_by_entry_id}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  const renderTrialByTp = () => {
    if (loading) return renderLoading();
    if (!trialByTp.length) return renderEmpty('Sin movimientos por tercero en el período.');
    const totalDebit = trialByTp.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const totalCredit = trialByTp.reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const totalBalance = trialByTp.reduce((s, r) => s + (Number(r.balance) || 0), 0);
    return (
      <>
        {accountCode && (
          <div className="mb-2">
            <small className="text-muted">Filtrado por cuenta {accountCode}</small>
          </div>
        )}
        <Table size="sm" hover responsive className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Documento</th>
              <th>Tercero</th>
              <th className="text-end">Débito</th>
              <th className="text-end">Crédito</th>
              <th className="text-end">Saldo</th>
              <th className="text-end">Líneas</th>
            </tr>
          </thead>
          <tbody>
            {trialByTp.map((r, i) => (
              <tr key={i}>
                <td className="font-monospace fs-13">{r.document_number}</td>
                <td>{r.name || '—'}</td>
                <td className="text-end font-monospace">{money(r.debit)}</td>
                <td className="text-end font-monospace">{money(r.credit)}</td>
                <td className="text-end font-monospace fw-semibold">{money(r.balance)}</td>
                <td className="text-end">{r.lines}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="table-secondary fw-bold">
              <td colSpan={2}>TOTAL</td>
              <td className="text-end font-monospace">{money(totalDebit)}</td>
              <td className="text-end font-monospace">{money(totalCredit)}</td>
              <td className="text-end font-monospace">{money(totalBalance)}</td>
              <td></td>
            </tr>
          </tfoot>
        </Table>
      </>
    );
  };

  const renderDiarioResumen = () => {
    if (loading) return renderLoading();
    if (!diarioResumen.length) return renderEmpty('Sin asientos en el período.');
    const totalCount = diarioResumen.reduce((s, r) => s + (Number(r.count) || 0), 0);
    const totalDebit = diarioResumen.reduce((s, r) => s + (Number(r.total_debit) || 0), 0);
    const totalCredit = diarioResumen.reduce((s, r) => s + (Number(r.total_credit) || 0), 0);
    return (
      <Table size="sm" hover responsive className="align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Fecha</th>
            <th className="text-end">Comprobantes</th>
            <th className="text-end">Débito</th>
            <th className="text-end">Crédito</th>
          </tr>
        </thead>
        <tbody>
          {diarioResumen.map((r, i) => (
            <tr key={i}>
              <td>{r.date}</td>
              <td className="text-end">{r.count}</td>
              <td className="text-end font-monospace">{money(r.total_debit)}</td>
              <td className="text-end font-monospace">{money(r.total_credit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="table-secondary fw-bold">
            <td>TOTAL</td>
            <td className="text-end">{totalCount}</td>
            <td className="text-end font-monospace">{money(totalDebit)}</td>
            <td className="text-end font-monospace">{money(totalCredit)}</td>
          </tr>
        </tfoot>
      </Table>
    );
  };

  const renderDiario = () => {
    if (loading) return renderLoading();
    if (!entries.length) return renderEmpty('Sin asientos en el período.');
    return (
      <>
        <Table size="sm" hover responsive className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th style={{ width: 30 }}></th>
              <th>Número</th>
              <th>Fecha</th>
              <th>Tipo documento</th>
              <th>Descripción</th>
              <th className="text-end">Total Db</th>
              <th className="text-end">Total Cr</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <React.Fragment key={e.id}>
                <tr style={{ cursor: 'pointer' }}>
                  <td
                    onClick={() =>
                      setExpandedEntry(expandedEntry === e.id ? null : e.id)
                    }
                  >
                    <i
                      className={
                        expandedEntry === e.id
                          ? 'ri-arrow-down-s-line'
                          : 'ri-arrow-right-s-line'
                      }
                    ></i>
                  </td>
                  <td className="font-monospace">{e.entry_number}</td>
                  <td>{e.date}</td>
                  <td>
                    <span className="badge bg-light text-dark border">
                      {docTypeLabel((e as any).document_type)}
                    </span>
                    {(e as any).document_number && (
                      <span className="ms-1 text-muted font-monospace small">
                        {(e as any).document_number}
                      </span>
                    )}
                  </td>
                  <td>{e.description}</td>
                  <td className="text-end font-monospace">{money(e.total_debit)}</td>
                  <td className="text-end font-monospace">{money(e.total_credit)}</td>
                  <td>
                    <Badge color={e.status === 'posted' ? 'success-subtle' : 'warning-subtle'} className="text-dark">
                      {e.status}
                    </Badge>
                  </td>
                  <td>
                    <Button size="sm" color="link" onClick={() => openDetail(e)}>
                      <i className="ri-eye-line"></i>
                    </Button>
                  </td>
                </tr>
                {expandedEntry === e.id && e.lines && (
                  <tr>
                    <td colSpan={9} className="bg-light">
                      <Table size="sm" borderless className="mb-0">
                        <thead>
                          <tr className="text-muted">
                            <th>Cuenta</th>
                            <th>Tercero</th>
                            <th>Detalle</th>
                            <th className="text-end">Débito</th>
                            <th className="text-end">Crédito</th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.lines.map((l, i) => (
                            <tr key={i}>
                              <td className="font-monospace">
                                {l.account_code} — {l.account_name}
                              </td>
                              <td>{l.third_party_name || '—'}</td>
                              <td>{l.line_description || '—'}</td>
                              <td className="text-end font-monospace">{money(l.debit)}</td>
                              <td className="text-end font-monospace">{money(l.credit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
        <div className="d-flex justify-content-between align-items-center mt-3">
          <small className="text-muted">
            {entriesTotal} asientos · Página {page} de {totalPages}
          </small>
          <ButtonGroup size="sm">
            <Button
              color="light"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <i className="ri-arrow-left-s-line"></i> Anterior
            </Button>
            <Button
              color="light"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente <i className="ri-arrow-right-s-line"></i>
            </Button>
          </ButtonGroup>
        </div>
      </>
    );
  };

  const renderMayor = () => {
    if (!accountCode) return renderEmpty('Ingrese un código de cuenta en los filtros.');
    if (loading) return renderLoading();
    if (!ledger.length) return renderEmpty('Sin movimientos para la cuenta.');
    return (
      <>
        <div className="mb-3">
          <h5 className="mb-0 font-monospace">Cuenta {accountCode}</h5>
          <small className="text-muted">Libro mayor · {startDate} a {endDate}</small>
        </div>
        <Table size="sm" hover responsive className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Fecha</th>
              <th>Número</th>
              <th>Tipo documento</th>
              <th>Cuenta</th>
              <th>Descripción</th>
              <th>Tercero</th>
              <th className="text-end">Débito</th>
              <th className="text-end">Crédito</th>
              <th className="text-end">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((r: any, i) => (
              <tr key={i}>
                <td>{r.date ? String(r.date).slice(0, 10) : '—'}</td>
                <td className="font-monospace">{r.entry_number}</td>
                <td>
                  <span className="badge bg-light text-dark border">
                    {docTypeLabel(r.document_type)}
                  </span>
                  {r.document_number && (
                    <span className="ms-1 text-muted font-monospace small">{r.document_number}</span>
                  )}
                </td>
                <td className="font-monospace small">{r.account_code} — {r.account_name}</td>
                <td>{r.description || r.entry_description || '—'}</td>
                <td>{r.third_party_name || '—'}</td>
                <td className="text-end font-monospace">{money(r.debit)}</td>
                <td className="text-end font-monospace">{money(r.credit)}</td>
                <td className="text-end font-monospace fw-semibold">{money(r.running_balance)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </>
    );
  };

  const renderAuxiliar = () => {
    if (!accountCode) return renderEmpty('Ingrese un código de cuenta en los filtros.');
    if (loading) return renderLoading();
    if (!auxMovs.length) return renderEmpty('Sin movimientos auxiliares.');
    return (
      <>
        <div className="mb-3">
          <h5 className="mb-0 font-monospace">Auxiliar {accountCode}</h5>
          <small className="text-muted">Movimientos por tercero · {startDate} a {endDate}</small>
        </div>
        <Table size="sm" hover responsive className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Fecha</th>
              <th>Comprobante</th>
              <th>Tipo documento</th>
              <th>Tercero</th>
              <th>Descripción</th>
              <th className="text-end">Débito</th>
              <th className="text-end">Crédito</th>
              <th className="text-end">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {auxMovs.map((r: any, i) => (
              <tr key={i}>
                <td>{r.date ? String(r.date).slice(0, 10) : '—'}</td>
                <td className="font-monospace">{r.voucher_number || r.entry_number}</td>
                <td>
                  <span className="badge bg-light text-dark border">
                    {docTypeLabel(r.document_type)}
                  </span>
                  {r.document_number && (
                    <span className="ms-1 text-muted font-monospace small">{r.document_number}</span>
                  )}
                </td>
                <td>{r.third_party_name || '—'}</td>
                <td>{r.description}</td>
                <td className="text-end font-monospace">{money(r.debit)}</td>
                <td className="text-end font-monospace">{money(r.credit)}</td>
                <td className="text-end font-monospace fw-semibold">{money(r.balance || r.running_balance)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </>
    );
  };

  const renderTrial = () => {
    if (loading) return renderLoading();
    if (!trial.length) return renderEmpty('Sin datos para el balance de prueba.');
    const totalDebit = trial.reduce((s, r) => s + Number(r.debit || 0), 0);
    const totalCredit = trial.reduce((s, r) => s + Number(r.credit || 0), 0);
    const keys = Object.keys(groupedTrial).sort();
    return (
      <>
        <Table size="sm" hover responsive className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Código</th>
              <th>Cuenta</th>
              <th>Tipo</th>
              <th className="text-end">Débitos</th>
              <th className="text-end">Créditos</th>
              <th className="text-end">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const rows = groupedTrial[k];
              const sd = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
              const sc = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
              const sb = rows.reduce((s, r) => s + Number(r.balance || 0), 0);
              return (
                <React.Fragment key={k}>
                  <tr className="table-secondary">
                    <td colSpan={3} className="fw-semibold">
                      {k} · {groupLabels[k] || 'Otros'}
                    </td>
                    <td className="text-end font-monospace fw-semibold">{money(sd)}</td>
                    <td className="text-end font-monospace fw-semibold">{money(sc)}</td>
                    <td className="text-end font-monospace fw-semibold">{money(sb)}</td>
                  </tr>
                  {rows.map((r) => (
                    <tr key={r.account_code}>
                      <td className="font-monospace">{r.account_code}</td>
                      <td>{r.account_name}</td>
                      <td>
                        <Badge color={`${accountTypeColor(r.account_type)}-subtle`} className="text-dark">
                          {r.account_type}
                        </Badge>
                      </td>
                      <td className="text-end font-monospace">{money(r.debit)}</td>
                      <td className="text-end font-monospace">{money(r.credit)}</td>
                      <td className="text-end font-monospace">{money(r.balance)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="table-light fw-bold">
              <td colSpan={3}>TOTALES</td>
              <td className="text-end font-monospace">{money(totalDebit)}</td>
              <td className="text-end font-monospace">{money(totalCredit)}</td>
              <td className="text-end font-monospace">
                <Badge color={Math.abs(totalDebit - totalCredit) < 1 ? 'success-subtle' : 'danger-subtle'} className="text-dark">
                  {Math.abs(totalDebit - totalCredit) < 1 ? 'Cuadra' : 'Descuadrado'}
                </Badge>
              </td>
            </tr>
          </tfoot>
        </Table>
      </>
    );
  };

  const renderBalance = () => {
    if (loading) return renderLoading();
    if (!balanceSheet) return renderEmpty('Sin datos de balance general.');
    const { activos = [], pasivos = [], patrimonio = [], totalActivos = 0, totalPasivos = 0, totalPatrimonio = 0 } = balanceSheet;
    const cuadra = Math.abs(Number(totalActivos) - (Number(totalPasivos) + Number(totalPatrimonio))) < 1;

    const renderList = (items: BalanceAccount[]) => (
      <Table size="sm" borderless className="mb-0">
        <tbody>
          {items.map((a, i) => (
            <tr key={i}>
              <td className="font-monospace text-muted" style={{ width: 80 }}>{a.account_code}</td>
              <td>{a.account_name}</td>
              <td className="text-end font-monospace">{money(a.balance)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    );

    return (
      <>
        <div className="mb-3">
          <h5 className="mb-0">Balance general</h5>
          <small className="text-muted">Al {endDate}</small>
        </div>
        <Row>
          <Col md={6}>
            <Card className="border">
              <CardHeader className="bg-info-subtle">
                <strong>ACTIVOS</strong>
              </CardHeader>
              <CardBody className="p-2">
                {renderList(activos)}
                <hr className="my-2" />
                <div className="d-flex justify-content-between px-2 fw-bold">
                  <span>TOTAL ACTIVOS</span>
                  <span className="font-monospace">{money(totalActivos)}</span>
                </div>
              </CardBody>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="border mb-3">
              <CardHeader className="bg-warning-subtle">
                <strong>PASIVOS</strong>
              </CardHeader>
              <CardBody className="p-2">
                {renderList(pasivos)}
                <hr className="my-2" />
                <div className="d-flex justify-content-between px-2 fw-bold">
                  <span>TOTAL PASIVOS</span>
                  <span className="font-monospace">{money(totalPasivos)}</span>
                </div>
              </CardBody>
            </Card>
            <Card className="border">
              <CardHeader className="bg-success-subtle">
                <strong>PATRIMONIO</strong>
              </CardHeader>
              <CardBody className="p-2">
                {renderList(patrimonio)}
                <hr className="my-2" />
                <div className="d-flex justify-content-between px-2 fw-bold">
                  <span>TOTAL PATRIMONIO</span>
                  <span className="font-monospace">{money(totalPatrimonio)}</span>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
        <div className="text-center mt-3">
          <Badge color={cuadra ? 'success-subtle' : 'danger-subtle'} className="text-dark fs-14 p-2">
            {cuadra ? (
              <><i className="ri-check-line"></i> Ecuación contable: Activos = Pasivos + Patrimonio ({money(totalActivos)})</>
            ) : (
              <><i className="ri-error-warning-line"></i> Descuadre: Δ {money(Number(totalActivos) - Number(totalPasivos) - Number(totalPatrimonio))}</>
            )}
          </Badge>
        </div>
      </>
    );
  };

  const renderPyg = () => {
    if (loading) return renderLoading();
    if (!incomeStatement) return renderEmpty('Sin datos de P&G.');
    const {
      ingresos = [],
      costos = [],
      gastos = [],
      utilidadBruta = 0,
      utilidadOperacional = 0,
      utilidadNeta = 0,
    } = incomeStatement;

    const sum = (arr: BalanceAccount[]) =>
      arr.reduce((s: number, a: BalanceAccount) => s + Number(a.balance || 0), 0);

    const totalIng = sum(ingresos);
    const totalCost = sum(costos);
    const totalGas = sum(gastos);

    const signColor = (n: number) => (Number(n) >= 0 ? 'text-success' : 'text-danger');

    const section = (title: string, items: BalanceAccount[], total: number, color: string) => (
      <Card className="border mb-2">
        <CardHeader className={`bg-${color}-subtle py-2`}>
          <div className="d-flex justify-content-between">
            <strong>{title}</strong>
            <span className="font-monospace fw-semibold">{money(total)}</span>
          </div>
        </CardHeader>
        <CardBody className="p-2">
          {items.map((a, i) => (
            <div key={i} className="d-flex justify-content-between px-2 py-1 small">
              <span>{a.account_name}</span>
              <span className="font-monospace">{money(a.balance)}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    );

    return (
      <>
        <div className="mb-3">
          <h5 className="mb-0">Estado de resultado</h5>
          <small className="text-muted">Del {startDate} al {endDate}</small>
        </div>
        {section('INGRESOS', ingresos, totalIng, 'success')}
        {section('COSTOS', costos, totalCost, 'warning')}
        <div className="d-flex justify-content-between align-items-center border rounded p-3 mb-3 bg-light">
          <span className="fw-semibold">UTILIDAD BRUTA</span>
          <span className={`fs-18 fw-semibold font-monospace ${signColor(utilidadBruta)}`}>
            {money(utilidadBruta)}
          </span>
        </div>
        {section('GASTOS OPERACIONALES', gastos, totalGas, 'danger')}
        <div className="d-flex justify-content-between align-items-center border rounded p-3 mb-2 bg-light">
          <span className="fw-semibold">UTILIDAD OPERACIONAL</span>
          <span className={`fs-18 fw-semibold font-monospace ${signColor(utilidadOperacional)}`}>
            {money(utilidadOperacional)}
          </span>
        </div>
        <div className="d-flex justify-content-between align-items-center border border-2 rounded p-3 bg-primary-subtle">
          <span className="fw-bold">UTILIDAD NETA</span>
          <span className={`fs-18 fw-bold font-monospace ${signColor(utilidadNeta)}`}>
            {money(utilidadNeta)}
          </span>
        </div>
      </>
    );
  };

  const renderFlujo = () => {
    if (loading) return renderLoading();
    if (!cashFlow) return renderEmpty('Sin datos de flujo de efectivo.');
    const { operacion, inversion, financiacion, resumen, periodo } = cashFlow;

    const signColor = (n: number) => (Number(n) >= 0 ? 'text-success' : 'text-danger');
    const linea = (label: string, value: number) => (
      <div className="d-flex justify-content-between px-2 py-1 small">
        <span>{label}</span>
        <span className={`font-monospace ${signColor(value)}`}>{money(value)}</span>
      </div>
    );

    return (
      <>
        <div className="mb-3">
          <h5 className="mb-0">Estado de Flujo de Efectivo</h5>
          <small className="text-muted">Método indirecto · {periodo?.startDate} a {periodo?.endDate}</small>
        </div>

        <Card className="border mb-2">
          <CardHeader className="bg-primary-subtle py-2">
            <div className="d-flex justify-content-between">
              <strong>ACTIVIDADES DE OPERACIÓN</strong>
              <span className={`font-monospace fw-semibold ${signColor(operacion.total)}`}>{money(operacion.total)}</span>
            </div>
          </CardHeader>
          <CardBody className="p-2">
            {linea('Utilidad neta del período', operacion.utilidadNeta)}
            {linea('(+) Depreciación', operacion.depreciacion)}
            {linea('(+) Amortización', operacion.amortizacion)}
            {linea('(+) Provisiones', operacion.provisiones)}
            {linea('Variación cuentas por cobrar', operacion.deltaCxC)}
            {linea('Variación inventarios', operacion.deltaInventarios)}
            {linea('Variación cuentas por pagar', operacion.deltaCxP)}
          </CardBody>
        </Card>

        <Card className="border mb-2">
          <CardHeader className="bg-warning-subtle py-2">
            <div className="d-flex justify-content-between">
              <strong>ACTIVIDADES DE INVERSIÓN</strong>
              <span className={`font-monospace fw-semibold ${signColor(inversion.total)}`}>{money(inversion.total)}</span>
            </div>
          </CardHeader>
          <CardBody className="p-2">
            {linea('Adquisición / venta de activos fijos', inversion.adquisicionActivos)}
          </CardBody>
        </Card>

        <Card className="border mb-3">
          <CardHeader className="bg-info-subtle py-2">
            <div className="d-flex justify-content-between">
              <strong>ACTIVIDADES DE FINANCIACIÓN</strong>
              <span className={`font-monospace fw-semibold ${signColor(financiacion.total)}`}>{money(financiacion.total)}</span>
            </div>
          </CardHeader>
          <CardBody className="p-2">
            {linea('Variación obligaciones financieras', financiacion.deltaDeuda)}
            {linea('Aportes / retiros de capital', financiacion.deltaCapital)}
            {linea('Dividendos pagados', financiacion.dividendos)}
          </CardBody>
        </Card>

        <Card className="border border-2">
          <CardBody className="p-3 bg-light">
            <Row className="g-2">
              <Col md={6}>
                <div className="d-flex justify-content-between small">
                  <span>Flujo neto calculado</span>
                  <span className={`font-monospace fw-semibold ${signColor(resumen.flujoNetoCalculado)}`}>{money(resumen.flujoNetoCalculado)}</span>
                </div>
                <div className="d-flex justify-content-between small">
                  <span>Variación caja real (11%)</span>
                  <span className={`font-monospace ${signColor(resumen.variacionCajaReal)}`}>{money(resumen.variacionCajaReal)}</span>
                </div>
                <div className="d-flex justify-content-between small">
                  <span>Diferencia</span>
                  <span className="font-monospace">{money(resumen.diferencia)}</span>
                </div>
              </Col>
              <Col md={6}>
                <div className="d-flex justify-content-between small">
                  <span>Caja inicial</span>
                  <span className="font-monospace">{money(resumen.cajaInicial)}</span>
                </div>
                <div className="d-flex justify-content-between small fw-semibold">
                  <span>Caja final</span>
                  <span className="font-monospace">{money(resumen.cajaFinal)}</span>
                </div>
                <div className="text-end mt-2">
                  <Badge color={resumen.conciliado ? 'success-subtle' : 'warning-subtle'} className="text-dark">
                    {resumen.conciliado ? 'Conciliado' : 'Revisar diferencia'}
                  </Badge>
                </div>
              </Col>
            </Row>
          </CardBody>
        </Card>
      </>
    );
  };

  const renderPatrimonio = () => {
    if (loading) return renderLoading();
    if (!equityChanges) return renderEmpty('Sin datos de cambios en el patrimonio.');
    const { cuentas = [], totales = {}, periodo = {} } = equityChanges;
    if (!cuentas.length) return renderEmpty('No hay movimientos patrimoniales en el período.');

    return (
      <>
        <div className="mb-3">
          <h5 className="mb-0">Estado de Cambios en el Patrimonio</h5>
          <small className="text-muted">Del {periodo.startDate} al {periodo.endDate}</small>
        </div>
        <Table size="sm" hover responsive className="align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Código</th>
              <th>Cuenta</th>
              <th className="text-end">Saldo inicial</th>
              <th className="text-end">Débitos</th>
              <th className="text-end">Créditos</th>
              <th className="text-end">Variación</th>
              <th className="text-end">Saldo final</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((c: any, i: number) => (
              <tr key={i} className={c.virtual ? 'table-warning' : ''}>
                <td className="font-monospace">{c.account_code}</td>
                <td>
                  {c.account_name}
                  {c.virtual && <Badge color="warning-subtle" className="text-dark ms-2">calculada</Badge>}
                </td>
                <td className="text-end font-monospace">{money(c.saldo_inicial)}</td>
                <td className="text-end font-monospace">{money(c.debitos)}</td>
                <td className="text-end font-monospace">{money(c.creditos)}</td>
                <td className="text-end font-monospace">{money(c.variacion)}</td>
                <td className="text-end font-monospace fw-semibold">{money(c.saldo_final)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="table-secondary fw-bold">
              <td colSpan={2}>TOTALES</td>
              <td className="text-end font-monospace">{money(totales.saldo_inicial)}</td>
              <td className="text-end font-monospace">{money(totales.debitos)}</td>
              <td className="text-end font-monospace">{money(totales.creditos)}</td>
              <td className="text-end font-monospace">{money(totales.variacion)}</td>
              <td className="text-end font-monospace">{money(totales.saldo_final)}</td>
            </tr>
          </tfoot>
        </Table>
      </>
    );
  };

  const renderContent = () => {
    if (error) {
      return (
        <Alert color="danger" className="d-flex align-items-start gap-3 mb-3">
          <i className="ri-error-warning-line fs-20 mt-1" />
          <div className="flex-grow-1">
            <strong>No pudimos conectar con el servidor</strong>
            <div className="fs-13 mt-1">
              {String(error).toLowerCase().includes('fetch') || String(error).toLowerCase().includes('network')
                ? 'El backend no responde. Revisa que esté corriendo (npm start en crumi/back) o ajusta VITE_API_URL en front/.env.'
                : String(error)}
            </div>
            <Button size="sm" color="danger" outline className="mt-2" onClick={() => { setError(null); applyFilters(); }}>
              Reintentar
            </Button>
          </div>
        </Alert>
      );
    }
    switch (view) {
      case 'diario': return renderDiario();
      case 'diario-resumido': return renderDiarioResumen();
      case 'no-contabilizados': return renderUnposted();
      case 'trial-tercero': return renderTrialByTp();
      case 'libro-compras': return renderLibroCompras();
      case 'libro-ventas': return renderLibroVentas();
      case 'libro-inventarios': return renderLibroInventarios();
      case 'pyg-funcion': return renderPygFuncion();
      case 'trial-config': return renderTrialConfig();
      case 'mayor': return renderMayor();
      case 'auxiliar': return renderAuxiliar();
      case 'trial': return renderTrial();
      case 'balance': return renderBalance();
      case 'pyg': return renderPyg();
      case 'flujo': return renderFlujo();
      case 'patrimonio': return renderPatrimonio();
    }
  };

  return (
    <div>
      {/* Estilos específicos para imprimir (Ctrl+P del navegador). Descargar PDF usa jsPDF (pdfExport.ts). */}
      <style>{`
        @media print {
          .crumi-header, .crumi-sidebar, .conversation-panel, .nav-tabs,
          .d-print-none, .btn, .offcanvas, .offcanvas-backdrop { display: none !important; }
          body { background: #fff !important; }
          main, .container, .container-fluid, .page-content { width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; }
          [data-print-area="true"] { border: none !important; box-shadow: none !important; width: 100% !important; }
          [data-print-area="true"] .card-body { padding: 0 !important; }
          table { page-break-inside: auto; font-size: 11px; width: 100% !important; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>
      <Row>
        <Col md={3} className="d-print-none">
          <Card className="border sticky-top" style={{ top: 10 }}>
            <CardHeader className="py-2 bg-light">
              <strong><i className="ri-filter-3-line me-1"></i>Filtros</strong>
            </CardHeader>
            <CardBody>
              <FormGroup>
                <Label className="small mb-1">Desde</Label>
                <Input
                  type="date"
                  bsSize="sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </FormGroup>
              <FormGroup>
                <Label className="small mb-1">Hasta</Label>
                <Input
                  type="date"
                  bsSize="sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </FormGroup>
              <FormGroup>
                <Label className="small mb-1">Búsqueda</Label>
                <InputGroup size="sm">
                  <InputGroupText>
                    <i className="ri-search-line"></i>
                  </InputGroupText>
                  <Input
                    placeholder="Texto libre..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </InputGroup>
              </FormGroup>
              <FormGroup>
                <Label className="small mb-1">
                  Cuenta {needsAccount && <span className="text-danger">*</span>}
                </Label>
                <Input
                  bsSize="sm"
                  placeholder="Ej: 13 · 1305 · 110505"
                  className="font-monospace"
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                />
                <small className="text-muted fs-11">Acepta prefijo: 13 → toda la clase</small>
              </FormGroup>
              <Button color="primary" size="sm" block className="w-100" onClick={applyFilters}>
                <i className="ri-check-line me-1"></i>Aplicar filtros
              </Button>
            </CardBody>
          </Card>
        </Col>
        <Col md={9}>
          {/* Cabecera "reporte único" cuando se entra vía ?view=X (deep-link desde el hub de reportes) */}
          {isDeepLinked && (
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 pb-3 border-bottom d-print-none">
              <div>
                <h5 className="mb-0">{currentViewTitle}</h5>
                {currentViewDescription && (
                  <div className="text-muted fs-13">{currentViewDescription}</div>
                )}
              </div>
              <div className="d-flex gap-2">
                <Button
                  color="danger"
                  outline
                  size="sm"
                  onClick={doExportPDF}
                  disabled={!canExport || loading}
                  title={canExport ? 'Descargar vista actual a PDF' : 'No hay datos para exportar'}
                >
                  <i className="ri-file-pdf-2-line me-1" /> Descargar PDF
                </Button>
                <Button
                  color="success"
                  outline
                  size="sm"
                  onClick={doExport}
                  disabled={!canExport || loading}
                  title={canExport ? 'Descargar vista actual a Excel' : 'No hay datos para exportar'}
                >
                  <i className="ri-file-excel-2-line me-1" /> Descargar Excel
                </Button>
              </div>
            </div>
          )}
          {/* Selector en 2 niveles: pestaña de categoría + botones de la categoría seleccionada */}
          {!isDeepLinked && (
            <Card className="border mb-3 d-print-none">
              <CardBody className="py-2">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <ButtonGroup size="sm">
                    {viewGroups.map((g) => (
                      <Button
                        key={g.label}
                        color={activeGroup.label === g.label ? 'primary' : 'light'}
                        onClick={() => {
                          // Al cambiar de categoría, seleccionar el primer ítem de esa categoría
                          setView(g.items[0].key);
                          setPage(1);
                        }}
                      >
                        <i className={`${g.icon} me-1`}></i>{g.label}
                      </Button>
                    ))}
                  </ButtonGroup>
                  <div className="d-flex gap-2">
                    <Button
                      color="danger"
                      outline
                      size="sm"
                      onClick={doExportPDF}
                      disabled={!canExport || loading}
                      title={canExport ? 'Descargar vista actual a PDF' : 'No hay datos para exportar'}
                    >
                      <i className="ri-file-pdf-2-line me-1"></i> PDF
                    </Button>
                    <Button
                      color="success"
                      outline
                      size="sm"
                      onClick={doExport}
                      disabled={!canExport || loading}
                      title={canExport ? 'Descargar vista actual a Excel' : 'No hay datos para exportar'}
                    >
                      <i className="ri-file-excel-2-line me-1"></i> Excel
                    </Button>
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-1 pt-2 border-top">
                  {activeGroup.items.map((v) => (
                    <Button
                      key={v.key}
                      size="sm"
                      color={view === v.key ? 'primary' : 'link'}
                      className={view === v.key ? '' : 'text-body'}
                      onClick={() => {
                        setView(v.key);
                        setPage(1);
                      }}
                    >
                      <i className={`${v.icon} me-1`}></i>{v.label}
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
          <Card className="border" data-print-area="true">
            <CardBody>
              {/* Encabezado visible solo al imprimir (PDF) */}
              <div className="print-only mb-3">
                <h4 className="mb-1">{currentViewTitle}</h4>
                {currentViewDescription && (
                  <div className="text-muted fs-13">{currentViewDescription}</div>
                )}
                <div className="fs-13 text-muted">Período: {startDate} a {endDate}</div>
              </div>
              {renderContent()}
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Offcanvas
        isOpen={detailOpen}
        toggle={() => setDetailOpen(false)}
        direction="end"
        style={{ width: 560 }}
      >
        <OffcanvasHeader toggle={() => setDetailOpen(false)}>
          Asiento {detailEntry?.entry_number}
        </OffcanvasHeader>
        <OffcanvasBody>
          {detailEntry && (
            <>
              <div className="mb-3">
                <Row className="g-2">
                  <Col xs={6}>
                    <small className="text-muted d-block">Fecha</small>
                    <strong>{detailEntry.date}</strong>
                  </Col>
                  <Col xs={6}>
                    <small className="text-muted d-block">Estado</small>
                    <Badge color="success-subtle" className="text-dark">{detailEntry.status}</Badge>
                  </Col>
                  <Col xs={12}>
                    <small className="text-muted d-block">Descripción</small>
                    <span>{detailEntry.description}</span>
                  </Col>
                </Row>
              </div>
              <Table size="sm" className="align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Cuenta</th>
                    <th>Tercero</th>
                    <th className="text-end">Db</th>
                    <th className="text-end">Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailEntry.lines || []).map((l, i) => (
                    <tr key={i}>
                      <td className="font-monospace small">
                        {l.account_code}<br />
                        <span className="text-muted">{l.account_name}</span>
                      </td>
                      <td className="small">{l.third_party_name || '—'}</td>
                      <td className="text-end font-monospace">{money(l.debit)}</td>
                      <td className="text-end font-monospace">{money(l.credit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="fw-bold">
                    <td colSpan={2}>Totales</td>
                    <td className="text-end font-monospace">{money(detailEntry.total_debit)}</td>
                    <td className="text-end font-monospace">{money(detailEntry.total_credit)}</td>
                  </tr>
                </tfoot>
              </Table>
              {detailEntry && detailEntry.status !== 'REVERSADO' && !detailEntry.reverses_entry_id && (
                <div className="d-flex gap-2 mt-3">
                  <Button color="warning" size="sm" onClick={async () => {
                    if (!window.confirm('¿Reversar este asiento? Se generará un asiento opuesto con la misma fecha/cuentas pero débito↔crédito invertido. Esta acción queda registrada.')) return;
                    try {
                      const res = await fetch(`${API_BASE}/accounting/journal-entries/${detailEntry.id}/reverse`, {
                        method: 'POST',
                        headers,
                      });
                      const data = await res.json();
                      if (data.success) {
                        showToast(`Asiento reversado. Reverso ${data.reverseEntry?.entryNumber || '#' + data.reverseEntry?.id}`);
                        setDetailOpen(false);
                        setDetailEntry(null);
                        loadDiario();
                      } else {
                        alert(data.error || 'No se pudo reversar');
                      }
                    } catch (e) {
                      alert('Error al reversar');
                    }
                  }}>
                    <i className="ri-arrow-go-back-line me-1" /> Reversar asiento
                  </Button>
                </div>
              )}
              {detailEntry && detailEntry.status === 'REVERSADO' && (
                <Alert color="danger" className="mt-3">
                  Este asiento fue reversado. No puedes modificarlo.
                </Alert>
              )}
              {detailEntry && detailEntry.reverses_entry_id && (
                <Alert color="info" className="mt-3">
                  Este asiento es el reverso del asiento #{detailEntry.reverses_entry_id}.
                </Alert>
              )}
            </>
          )}
        </OffcanvasBody>
      </Offcanvas>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 2000,
          }}
        >
          <Toast isOpen={!!toast}>
            <ToastBody>
              <i className="ri-information-line me-2"></i>{toast}
            </ToastBody>
          </Toast>
        </div>
      )}
    </div>
  );
};

export default Consultas;
