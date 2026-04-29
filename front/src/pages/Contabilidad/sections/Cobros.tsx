import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConfigGuardBanner from '../ConfigGuardBanner';
import {
  Row,
  Col,
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Label,
  FormGroup,
  Form,
  Table,
  Spinner,
  Badge,
  Offcanvas,
  OffcanvasHeader,
  OffcanvasBody,
  InputGroup,
  InputGroupText,
  Alert,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  Progress,
} from 'reactstrap';
import { API_BASE, API_ROOT, money, useAuthHeaders } from '../shared';
import ClienteSelector, { Cliente } from '../../../Components/Contabilidad/ClienteSelector';
import Swal from 'sweetalert2';

interface ReceiptInvoice {
  invoice_id: number | string;
  invoice_number?: string;
  applied_amount: number | string;
}

interface PaymentReceipt {
  id: number | string;
  number?: string;
  date: string;
  client_name?: string;
  client_nit?: string;
  total: number | string;
  method?: string;
  reference?: string;
  status?: string;
  notes?: string;
  invoices?: ReceiptInvoice[];
}

interface Receivable {
  invoice_id: number | string;
  invoice_number?: string;
  client_name?: string;
  client_nit?: string;
  issue_date?: string;
  due_date?: string;
  total: number | string;
  paid: number | string;
  balance: number | string;
}

interface Customer {
  id: number | string;
  name: string;
  document_number?: string;
  document_type?: string;
  kind?: string;
}

// Compara dos identificaciones ignorando puntos, espacios y dígito de verificación.
// "901.308.657-1" ≡ "901308657" ≡ "901308657-1".
const sameNit = (a?: string, b?: string): boolean => {
  if (!a || !b) return false;
  const norm = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    return raw.includes('-') && digits.length > 1 ? digits.slice(0, -1) : digits;
  };
  const na = norm(String(a));
  const nb = norm(String(b));
  return na.length > 0 && na === nb;
};

interface ApplyLine {
  invoice_id: number | string;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  total: number;
  balance: number;
  applied: string;          // saldo de la factura a cubrir (valor bruto)
  retefuente: string;
  reteIva: string;
  reteIca: string;
  impoconsumo: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

// Diferencia en días entre dos fechas ISO (b - a). Devuelve null si falta alguna.
const daysBetween = (a?: string, b?: string): number | null => {
  if (!a || !b) return null;
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.round((d2 - d1) / 86_400_000);
};

// Devuelve la info del badge de aging para una fecha de vencimiento dada
type AgingInfo = { color: string; label: string };
const agingInfo = (dueDate?: string): AgingInfo => {
  if (!dueDate) return { color: 'light', label: '-' };
  const diff = daysBetween(todayISO(), dueDate); // due - today
  if (diff === null) return { color: 'light', label: '-' };
  if (diff < 0) return { color: 'danger', label: `Vencida ${Math.abs(diff)}d` };
  if (diff === 0) return { color: 'warning', label: 'Vence hoy' };
  if (diff < 15) return { color: 'warning', label: `Por vencer ${diff}d` };
  return { color: 'success', label: 'Al día' };
};

// Plazo (credit term) conocido a partir de issue_date y due_date
const creditTermDays = (issueDate?: string, dueDate?: string): number | null => {
  const diff = daysBetween(issueDate, dueDate);
  if (diff === null || diff <= 0) return null;
  // Solo mostramos plazos "estándar" para no ensuciar el UI
  const standard = [30, 60, 90, 180];
  // Aproximar al plazo estándar más cercano si está dentro de +/- 3 días
  for (const t of standard) {
    if (Math.abs(diff - t) <= 3) return t;
  }
  return diff;
};

const METHODS: { value: string; label: string; icon: string }[] = [
  { value: 'CASH', label: 'Efectivo', icon: 'ri-money-dollar-circle-line' },
  { value: 'TRANSFER', label: 'Transferencia', icon: 'ri-bank-line' },
  { value: 'CHECK', label: 'Cheque', icon: 'ri-bill-line' },
  { value: 'CARD', label: 'Tarjeta', icon: 'ri-bank-card-line' },
  { value: 'MIXED', label: 'Mixto', icon: 'ri-exchange-line' },
  { value: 'OTHER', label: 'Otro', icon: 'ri-more-2-line' },
];

// Normaliza el método del backend (puede venir en español o canónico)
const canonicalMethodValue = (raw?: string): string => {
  if (!raw) return '';
  const m = raw.toUpperCase();
  if (m.includes('EFECT') || m === 'CASH') return 'CASH';
  if (m.includes('TRANSF') || m === 'TRANSFER' || m.includes('PSE')) return 'TRANSFER';
  if (m.includes('CHEQ') || m === 'CHECK') return 'CHECK';
  if (m.includes('TARJ') || m === 'CARD') return 'CARD';
  if (m === 'MIXED' || m.includes('MIXT')) return 'MIXED';
  return 'OTHER';
};

const methodLabel = (m?: string) => METHODS.find(x => x.value === canonicalMethodValue(m))?.label || m || '-';
const methodIcon = (m?: string) => METHODS.find(x => x.value === canonicalMethodValue(m))?.icon || 'ri-wallet-line';

const statusColor = (s?: string) => {
  const map: Record<string, string> = {
    ACTIVE: 'success',
    REGISTERED: 'success',
    POSTED: 'success',
    PENDING: 'warning',
    VOID: 'secondary',
    VOIDED: 'secondary',
    CANCELLED: 'danger',
  };
  return map[(s || '').toUpperCase()] || 'info';
};

const statusLabel = (s?: string) => {
  const u = (s || '').toUpperCase();
  if (u === 'VOID' || u === 'VOIDED' || u === 'CANCELLED') return 'Anulado';
  if (u === 'PENDING') return 'Pendiente';
  return 'Registrado';
};

const Cobros: React.FC = () => {
  const headers = useAuthHeaders();

  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState(firstDayOfMonthISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [clientSearch, setClientSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'emitidos' | 'pendientes'>('pendientes');
  const [showNew, setShowNew] = useState(false);
  // Si se abre desde "Cobrar" de una factura específica, solo esa se muestra (hasta que el usuario
  // expanda a todas con el botón "Mostrar todas")
  const [initialInvoiceId, setInitialInvoiceId] = useState<number | string | null>(null);
  const [showAllClientInvoices, setShowAllClientInvoices] = useState<boolean>(true);
  const [savingNew, setSavingNew] = useState(false);
  const [viewingId, setViewingId] = useState<number | string | null>(null);
  const [form, setForm] = useState({
    clientId: '' as string | number | '',
    clientName: '',
    clientNit: '',
    dateIssue: todayISO(),
    method: 'TRANSFER',
    reference: '',
    notes: '',
    totalAmount: '',
    retefuenteAmount: '',
    reteivaAmount: '',
    reteicaAmount: '',
    impoconsumoAmount: '',
  });
  const [applyLines, setApplyLines] = useState<ApplyLine[]>([]);
  const [formasRecaudo, setFormasRecaudo] = useState<{ id: string; method: string; amount: string }[]>([
    { id: `fr_${Date.now()}`, method: 'TRANSFER', amount: '' },
  ]);

  const [detail, setDetail] = useState<PaymentReceipt | null>(null);
  const [voiding, setVoiding] = useState(false);

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const r = await fetch(`${API_ROOT}/payment-receipts?${params.toString()}`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const raw: any[] = d.paymentReceipts || d.receipts || [];
      const normalized = raw.map((x: any) => ({
        id: x.id,
        number: x.number || x.receipt_number,
        date: x.date ? String(x.date).slice(0, 10) : '',
        client_name: x.client_name,
        client_nit: x.client_nit || x.client_document_number,
        total: Number(x.total || 0),
        method: x.method || x.payment_method,
        reference: x.reference,
        status: x.status,
        notes: x.notes,
        invoices: x.invoices,
      }));
      setReceipts(normalized);
    } catch {
      setError('No se pudieron cargar los cobros.');
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, headers]);

  const loadCustomers = useCallback(async () => {
    try {
      // No filtramos por kind=CUSTOMER: algunos terceros quedan como SUPPLIER
      // pero igual tienen facturas de venta. Mostramos todos.
      const r = await fetch(`${API_BASE}/accounting/third-parties`, { headers });
      if (!r.ok) return;
      const d = await r.json();
      setCustomers(d.thirdParties || d.third_parties || d.parties || []);
    } catch {
      setCustomers([]);
    }
  }, [headers]);

  const loadReceivables = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/accounting/accounts-receivable`, { headers });
      if (!r.ok) return;
      const d = await r.json();
      const raw: any[] = d.receivables || [];
      const normalized = raw.map((v: any) => ({
        invoice_id: v.invoice_id ?? v.id,
        invoice_number: v.invoice_number ?? v.document_number,
        client_name: v.client_name,
        client_nit: v.client_nit ?? v.client_document_number,
        issue_date: v.issue_date ? String(v.issue_date).slice(0, 10) : undefined,
        due_date: v.due_date ? String(v.due_date).slice(0, 10) : undefined,
        total: Number(v.total ?? v.original_amount ?? 0),
        paid: Number(v.paid ?? v.paid_amount ?? 0),
        balance: Number(v.balance ?? v.balance_amount ?? 0),
      }));
      setReceivables(normalized);
    } catch {
      setReceivables([]);
    }
  }, [headers]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    loadCustomers();
    loadReceivables();
  }, [loadCustomers, loadReceivables]);

  // Si entramos con ?invoiceId=X (desde el listado de facturas "Registrar cobro"),
  // precargamos cliente + factura y abrimos el drawer automáticamente.
  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId');
    if (!invoiceId || receivables.length === 0) return;
    const r = receivables.find((v) => String(v.invoice_id) === String(invoiceId));
    if (!r) return;
    setForm((f) => ({
      ...f,
      clientName: r.client_name || '',
      clientNit: r.client_nit || '',
      totalAmount: String(Number(r.balance || 0).toFixed(2)),
    }));
    setShowNew(true);
    // limpiar el query param para no reabrir en refresh
    searchParams.delete('invoiceId');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivables]);

  const filtered = useMemo(() => {
    const s = clientSearch.trim().toLowerCase();
    return receipts.filter(r => {
      if (methodFilter && canonicalMethodValue(r.method) !== methodFilter) return false;
      if (s) {
        const hay = `${r.client_name || ''} ${r.client_nit || ''} ${r.number || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [receipts, clientSearch, methodFilter]);

  const kpis = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let collectedMonth = 0;
    let countReceipts = 0;
    receipts.forEach(r => {
      const u = (r.status || '').toUpperCase();
      if (u === 'VOID' || u === 'VOIDED' || u === 'CANCELLED') return;
      if ((r.date || '').startsWith(ym)) collectedMonth += Number(r.total || 0);
      countReceipts += 1;
    });
    let outstanding = 0;
    let overdueCount = 0;
    const today = todayISO();
    receivables.forEach(v => {
      const bal = Number(v.balance || 0);
      outstanding += bal;
      if (bal > 0 && v.due_date && v.due_date < today) overdueCount += 1;
    });
    return { collectedMonth, countReceipts, outstanding, overdueCount };
  }, [receipts, receivables]);

  const clientReceivables = useMemo(() => {
    if (!form.clientNit && !form.clientName) return [];
    const normName = (s?: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return receivables.filter(v => {
      const balance = Number(v.balance || 0);
      if (balance <= 0) return false;
      if (form.clientNit && sameNit(v.client_nit, form.clientNit)) return true;
      if (form.clientName && v.client_name && normName(v.client_name) === normName(form.clientName)) return true;
      return false;
    });
  }, [receivables, form.clientNit, form.clientName]);

  useEffect(() => {
    if (viewingId != null) return;
    // Si vino desde "Cobrar" de UNA factura específica y no se pidió expandir,
    // mostrar SOLO esa factura.
    const filtered = (initialInvoiceId != null && !showAllClientInvoices)
      ? clientReceivables.filter(v => String(v.invoice_id) === String(initialInvoiceId))
      : clientReceivables;

    setApplyLines(
      filtered.map(v => {
        const isTarget = initialInvoiceId == null
          ? true
          : String(v.invoice_id) === String(initialInvoiceId);
        return {
          invoice_id: v.invoice_id,
          invoice_number: v.invoice_number,
          issue_date: v.issue_date,
          due_date: v.due_date,
          total: Number(v.total || 0),
          balance: Number(v.balance || 0),
          applied: isTarget ? String(Number(v.balance || 0).toFixed(2)) : '0',
          retefuente: '0',
          reteIva: '0',
          reteIca: '0',
          impoconsumo: '0',
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientReceivables.length, form.clientNit, form.clientName, viewingId, showAllClientInvoices]);

  // Valor bruto que se aplica = exactamente lo que el usuario ingresó en "Aplicar (bruto)"
  // Si la casilla está desmarcada, applied = "0" → suma 0 (no entra al total).
  const totalApplied = useMemo(
    () => applyLines.reduce((sum, l) => sum + (Number(l.applied) || 0), 0),
    [applyLines]
  );
  // Sumas por tipo de retención
  const totalRetefuente = useMemo(
    () => applyLines.reduce((sum, l) => sum + Number(l.retefuente || 0), 0),
    [applyLines]
  );
  const totalReteIva = useMemo(
    () => applyLines.reduce((sum, l) => sum + Number(l.reteIva || 0), 0),
    [applyLines]
  );
  const totalReteIca = useMemo(
    () => applyLines.reduce((sum, l) => sum + Number(l.reteIca || 0), 0),
    [applyLines]
  );
  const totalImpoconsumo = useMemo(
    () => applyLines.reduce((sum, l) => sum + Number(l.impoconsumo || 0), 0),
    [applyLines]
  );
  const totalRetenciones = totalRetefuente + totalReteIva + totalReteIca;
  // Neto que llega al banco = bruto aplicado − retenciones
  const netoRecibido = Math.max(totalApplied - totalRetenciones, 0);

  const totalFormasRecaudo = useMemo(
    () => formasRecaudo.reduce((s, f) => s + (Number(f.amount) || 0), 0),
    [formasRecaudo]
  );
  // Auto-sync: cuando hay UNA SOLA forma de recaudo, su monto SIEMPRE sigue al
  // neto recibido (cualquier cambio en montos aplicados o retenciones se refleja).
  // Cuando hay 2+ formas, el usuario reparte manualmente y no tocamos.
  useEffect(() => {
    if (formasRecaudo.length !== 1) return;
    const target = netoRecibido > 0 ? String(netoRecibido.toFixed(2)) : '';
    const curr = formasRecaudo[0].amount;
    // Comparar como números para evitar bucles por "10.00" vs "10"
    const same = (Number(curr || 0) === Number(target || 0)) && (curr === '' ? target === '' : true);
    if (!same) {
      setFormasRecaudo([{ ...formasRecaudo[0], amount: target }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netoRecibido, formasRecaudo.length]);

  const totalAmountNum = Number(form.totalAmount || 0);
  const leftover = totalAmountNum - totalApplied;

  const pickCustomer = (text: string) => {
    const byName = customers.find(c => c.name === text);
    const byDoc = customers.find(c => c.document_number === text);
    const c = byName || byDoc;
    if (c) {
      setForm(f => ({
        ...f,
        clientId: c.id,
        clientName: c.name,
        clientNit: c.document_number || '',
      }));
    } else {
      setForm(f => ({ ...f, clientId: '', clientName: text }));
    }
  };

  // Tipo de documento del cliente seleccionado (NIT/CC/CE/...). Se manda al
  // backend para que client_document_type quede coherente con el cliente real.
  const selectedDocType = useMemo(() => {
    if (!form.clientId) return 'NIT';
    const c = customers.find(x => String(x.id) === String(form.clientId));
    return (c?.document_type || 'NIT').toUpperCase();
  }, [form.clientId, customers]);

  const resetForm = () => {
    setForm({
      clientId: '',
      clientName: '',
      clientNit: '',
      dateIssue: todayISO(),
      method: 'TRANSFER',
      reference: '',
      notes: '',
      totalAmount: '',
      retefuenteAmount: '',
      reteivaAmount: '',
      reteicaAmount: '',
      impoconsumoAmount: '',
    });
    setApplyLines([]);
    // Reset formas de recaudo a una sola vacía — el useEffect la autollenará al neto.
    setFormasRecaudo([{ id: `fr_${Date.now()}`, method: 'TRANSFER', amount: '' }]);
  };

  const submitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (viewingId != null) return; // modo vista, no guardar
    if (!form.clientName) {
      Swal.fire({ icon: 'warning', title: 'Falta cliente', text: 'Seleccione un cliente.', confirmButtonColor: '#1A1D1F' });
      return;
    }
    if (!totalApplied || totalApplied <= 0) {
      Swal.fire({ icon: 'warning', title: 'Falta monto', text: 'Ingrese el valor aplicado en al menos una factura.', confirmButtonColor: '#1A1D1F' });
      return;
    }
    // Validar que las retenciones no excedan el bruto aplicado por factura
    for (const l of applyLines) {
      const aplicado = Number(l.applied || 0);
      if (aplicado <= 0) continue;
      const rets = Number(l.retefuente || 0) + Number(l.reteIva || 0) + Number(l.reteIca || 0);
      if (rets > aplicado + 0.01) {
        Swal.fire({
          icon: 'error',
          title: 'Retenciones inválidas',
          text: `Las retenciones de la factura ${l.invoice_number || l.invoice_id} exceden el valor aplicado.`,
          confirmButtonColor: '#1A1D1F',
        });
        return;
      }
    }
    // Validar que las formas de recaudo sumen el neto recibido
    if (netoRecibido > 0 && Math.abs(totalFormasRecaudo - netoRecibido) > 0.01) {
      Swal.fire({
        icon: 'error',
        title: 'Formas de recaudo no cuadran',
        html: `Total asignado: <b>$${money(totalFormasRecaudo)}</b><br/>Neto recibido: <b>$${money(netoRecibido)}</b>`,
        confirmButtonColor: '#1A1D1F',
      });
      return;
    }
    const applied = applyLines.filter(l => Number(l.applied || 0) > 0);

    // Resumen para que el usuario confirme antes de impactar cartera + asiento contable
    const facturasResumen = applied.length === 1
      ? `Factura: <b>${applyLines.find(l => Number(l.applied||0)>0)?.invoice_number || ''}</b>`
      : `Facturas: <b>${applied.length}</b>`;
    const retencionesResumen = totalRetenciones > 0
      ? `<br/>Retenciones: <b>$${money(totalRetenciones)}</b>`
      : '';
    const confirm = await Swal.fire({
      icon: 'question',
      title: '¿Registrar cobro?',
      html:
        `<div style="text-align:left">
          Cliente: <b>${form.clientName}</b><br/>
          ${facturasResumen}<br/>
          Bruto aplicado: <b>$${money(totalApplied)}</b>${retencionesResumen}<br/>
          <span style="font-size:1.1em">Neto recibido: <b>$${money(netoRecibido)}</b></span>
         </div>`,
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A1D1F',
    });
    if (!confirm.isConfirmed) return;
    setSavingNew(true);
    try {
      // Retenciones por línea ya están calculadas en applyLines
      const methodMap: Record<string, string> = {
        CASH: 'Efectivo',
        TRANSFER: 'Transferencia',
        CHECK: 'Cheque',
        CARD: 'Tarjeta',
        OTHER: 'Otro',
        MIXED: 'Mixto',
      };
      // Método principal = MIXED si hay más de una forma con monto, de lo contrario el canon de la única
      const formasValidas = formasRecaudo.filter(f => Number(f.amount) > 0);
      const primaryMethod = formasValidas.length > 1
        ? 'MIXED'
        : (formasValidas[0]?.method || form.method || 'TRANSFER');

      const r = await fetch(`${API_ROOT}/payment-receipts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientId: form.clientId || undefined,
          clientName: form.clientName,
          clientNit: form.clientNit,
          clientDocType: selectedDocType,
          paymentDate: form.dateIssue,
          paymentMethod: methodMap[primaryMethod] || primaryMethod,
          paymentMethods: formasValidas.map(f => ({
            method: methodMap[f.method] || f.method,
            amount: Number(f.amount) || 0,
          })),
          transactionReference: form.reference,
          notes: form.notes,
          invoices: applyLines
            .filter(l => Number(l.applied || 0) > 0)
            .map(l => ({
              invoiceId: l.invoice_id,
              amountApplied: Number(l.applied) || 0,
              retefuente: Number(l.retefuente) || 0,
              reteIva: Number(l.reteIva) || 0,
              reteIca: Number(l.reteIca) || 0,
              impoconsumo: Number(l.impoconsumo) || 0,
            })),
          // Total neto que efectivamente entra al banco/caja
          amount: netoRecibido,
          amountReceived: netoRecibido,
          // Totales agregados de retenciones (para el asiento contable)
          retefuenteAmount: totalRetefuente,
          reteivaAmount: totalReteIva,
          reteicaAmount: totalReteIca,
          impoconsumoAmount: totalImpoconsumo,
          // Bruto = suma de "Aplicar" de todas las facturas
          grossAmount: totalApplied,
        }),
      });
      const data = await r.json().catch(() => ({} as any));
      if (!r.ok || data?.success === false) {
        const msg = data?.error || data?.message || `HTTP ${r.status}`;
        throw new Error(msg);
      }
      closeDrawer();
      resetForm();
      loadReceipts();
      loadReceivables();
      Swal.fire({
        icon: 'success',
        title: 'Cobro registrado',
        text: `Neto recibido: $${money(netoRecibido)}`,
        confirmButtonColor: '#1A1D1F',
        timer: 2200,
        timerProgressBar: true,
      });
    } catch (e: any) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar el cobro',
        text: e?.message || 'Error desconocido',
        confirmButtonColor: '#1A1D1F',
      });
    } finally {
      setSavingNew(false);
    }
  };

  const voidReceipt = async () => {
    if (!detail) return;
    const confirm = await Swal.fire({
      icon: 'warning',
      title: '¿Anular recibo?',
      html: `Recibo <b>${detail.number || detail.id}</b> por <b>$${money(detail.total)}</b>.<br/><br/>` +
            `Se revertirá la aplicación a cartera y se generará el asiento contable de reverso.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'No',
      confirmButtonColor: '#dc3545',
    });
    if (!confirm.isConfirmed) return;
    setVoiding(true);
    try {
      const r = await fetch(`${API_ROOT}/payment-receipts/${detail.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'ANULADO' }),
      });
      const data = await r.json().catch(() => ({} as any));
      if (!r.ok || data?.success === false) {
        const msg = data?.error || data?.message || `HTTP ${r.status}`;
        throw new Error(msg);
      }
      setDetail(null);
      loadReceipts();
      loadReceivables();
      Swal.fire({
        icon: 'success',
        title: 'Recibo anulado',
        text: 'Se reversó la aplicación a cartera y el asiento contable.',
        confirmButtonColor: '#1A1D1F',
        timer: 2200,
        timerProgressBar: true,
      });
    } catch (e: any) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo anular el recibo',
        text: e?.message || 'Error desconocido',
        confirmButtonColor: '#1A1D1F',
      });
    } finally {
      setVoiding(false);
    }
  };

  // Cierra el drawer y limpia el modo vista
  const closeDrawer = () => {
    setShowNew(false);
    setViewingId(null);
    resetForm();
  };

  // Abrir el drawer (mismo UI de cobro) precargado con los datos del recibo existente.
  // Modo solo-lectura: guardar queda deshabilitado.
  const openAsDrawer = async (r: PaymentReceipt) => {
    try {
      const res = await fetch(`${API_ROOT}/payment-receipts/${r.id}`, { headers });
      if (!res.ok) return;
      const d = await res.json();
      const raw: any = d.paymentReceipt || d.receipt;
      if (!raw) return;

      // Prefill del encabezado
      setForm({
        clientId: '',
        clientName: raw.client_name || '',
        clientNit: raw.client_nit || raw.client_document_number || '',
        dateIssue: (raw.date && String(raw.date).slice(0, 10)) || todayISO(),
        method: canonicalMethodValue(raw.payment_method || raw.method || ''),
        reference: raw.reference || '',
        notes: raw.notes || '',
        totalAmount: String(Number(raw.total || 0).toFixed(2)),
        retefuenteAmount: String(Number(raw.retefuente_amount || 0)),
        reteivaAmount: String(Number(raw.reteiva_amount || 0)),
        reteicaAmount: String(Number(raw.reteica_amount || 0)),
        impoconsumoAmount: String(Number(raw.impoconsumo_amount || 0)),
      });

      // Prefill de líneas de factura con los applied_amount guardados
      const invs: any[] = Array.isArray(raw.invoices) ? raw.invoices : [];
      setApplyLines(
        invs.map((i: any) => ({
          invoice_id: i.invoice_id ?? i.id,
          invoice_number: i.invoice_number || `F-${i.invoice_id ?? i.id}`,
          issue_date: '',
          due_date: '',
          total: Number(i.invoice_total || i.total || i.amount || 0),
          balance: 0,
          applied: String(Number(i.applied_amount ?? i.amount ?? 0).toFixed(2)),
          retefuente: String(Number(i.retefuente_amount ?? 0)),
          reteIva: String(Number(i.reteiva_amount ?? 0)),
          reteIca: String(Number(i.reteica_amount ?? 0)),
          impoconsumo: String(Number(i.impoconsumo_amount ?? 0)),
        }))
      );

      setViewingId(raw.id);
      setShowNew(true);
    } catch {
      /* noop */
    }
  };

  const openDetail = async (r: PaymentReceipt) => {
    setDetail(r);
    try {
      const res = await fetch(`${API_ROOT}/payment-receipts/${r.id}`, { headers });
      if (!res.ok) return;
      const d = await res.json();
      const raw: any = d.paymentReceipt || d.receipt;
      if (!raw) return;
      const normalized: PaymentReceipt = {
        id: raw.id,
        number: raw.number || raw.receipt_number,
        date: raw.date ? String(raw.date).slice(0, 10) : '',
        client_name: raw.client_name,
        client_nit: raw.client_nit || raw.client_document_number,
        total: Number(raw.total || 0),
        method: raw.method || raw.payment_method,
        reference: raw.reference,
        status: raw.status,
        notes: raw.notes,
        invoices: Array.isArray(raw.invoices)
          ? raw.invoices.map((i: any) => ({
              invoice_id: i.invoice_id ?? i.id,
              invoice_number: i.invoice_number
                || (i.invoice_id != null ? `F-${i.invoice_id}` : undefined),
              applied_amount: Number(i.applied_amount ?? i.amount ?? 0),
            }))
          : [],
      };
      setDetail(normalized);
    } catch {
      //
    }
  };

  const updateApplied = (idx: number, value: string) => {
    setApplyLines(prev => {
      const next = [...prev];
      const max = next[idx].balance;
      let v = Number(value || 0);
      if (v < 0) v = 0;
      if (v > max) v = max;
      next[idx] = { ...next[idx], applied: value === '' ? '' : String(v) };
      return next;
    });
  };

  // Aplicar el saldo completo de cada factura (el usuario luego edita retenciones)
  const autoFillApplied = () => {
    setApplyLines(prev =>
      prev.map(l => ({ ...l, applied: String(Number(l.balance || 0).toFixed(2)) }))
    );
  };

  return (
    <div>
      <ConfigGuardBanner moduleKey="cobros" />
      <Row className="align-items-center mb-3">
        <Col>
          <h4 className="mb-0">
            <i className="ri-hand-coin-line me-2 text-primary" />
            Cobros
          </h4>
          <small className="text-muted">Recibos de cobro aplicados a facturas de venta</small>
        </Col>
        <Col xs="auto">
          <Button color="primary" size="lg" onClick={() => {
            setInitialInvoiceId(null);
            setShowAllClientInvoices(true);
            setShowNew(true);
          }}>
            <i className="ri-add-line me-1" />
            Registrar cobro
          </Button>
        </Col>
      </Row>

      <Row className="g-2 mb-3">
        <Col md={3}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Cobrado este mes</div>
              <h4 className="mb-0 text-success font-monospace">${money(kpis.collectedMonth)}</h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Recibos</div>
              <h4 className="mb-0 text-primary">{kpis.countReceipts}</h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Cartera pendiente</div>
              <h4 className="mb-0 text-warning font-monospace">${money(kpis.outstanding)}</h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Vencidos sin cobrar</div>
              <h4 className="mb-0 text-danger">{kpis.overdueCount}</h4>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm mb-3">
        <CardBody>
          <Row className="g-2 align-items-end">
            <Col md={2}>
              <Label className="mb-1 small">Desde</Label>
              <Input type="date" bsSize="sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </Col>
            <Col md={2}>
              <Label className="mb-1 small">Hasta</Label>
              <Input type="date" bsSize="sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </Col>
            <Col md={4}>
              <Label className="mb-1 small">Cliente</Label>
              <InputGroup size="sm">
                <InputGroupText>
                  <i className="ri-search-line" />
                </InputGroupText>
                <Input
                  placeholder="Nombre, NIT o número de recibo"
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={2}>
              <Label className="mb-1 small">Método</Label>
              <Input type="select" bsSize="sm" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
                <option value="">Todos</option>
                {METHODS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={2}>
              <Button color="light" size="sm" onClick={loadReceipts} block>
                <i className="ri-refresh-line me-1" />
                Actualizar
              </Button>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="bg-transparent">
          <Nav tabs className="card-header-tabs">
            <NavItem>
              <NavLink
                active={activeTab === 'emitidos'}
                onClick={() => setActiveTab('emitidos')}
                style={{ cursor: 'pointer' }}
              >
                <i className="ri-check-double-line me-1" />
                Cobros emitidos
                <Badge color="secondary" pill className="ms-2">{filtered.length}</Badge>
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                active={activeTab === 'pendientes'}
                onClick={() => setActiveTab('pendientes')}
                style={{ cursor: 'pointer' }}
              >
                <i className="ri-hand-coin-line me-1" />
                Pendientes de cobro
                <Badge color="warning" pill className="ms-2">
                  {receivables.filter(v => Number(v.balance || 0) > 0).length}
                </Badge>
              </NavLink>
            </NavItem>
          </Nav>
        </CardHeader>
        <CardBody className="p-0">
          {activeTab === 'pendientes' ? (
            <div className="table-responsive">
              {receivables.filter(v => Number(v.balance || 0) > 0).length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="ri-check-line fs-1 d-block mb-2 text-success" />
                  No hay facturas pendientes de cobro
                </div>
              ) : (
                <Table size="sm" className="align-middle mb-0" hover>
                  <thead className="table-light">
                    <tr>
                      <th># Factura</th>
                      <th>Cliente</th>
                      <th>Emisión</th>
                      <th>Vence</th>
                      <th className="text-end">Total</th>
                      <th className="text-end">Pagado</th>
                      <th className="text-end">Saldo</th>
                      <th className="text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables
                      .filter(v => Number(v.balance || 0) > 0)
                      .map(v => {
                        const aging = agingInfo(v.due_date);
                        const term = creditTermDays(v.issue_date, v.due_date);
                        return (
                        <tr key={v.invoice_id}>
                          <td>
                            <div className="d-flex align-items-center flex-wrap gap-1">
                              <Badge color="light" className="text-dark font-monospace">
                                {v.invoice_number || `#${v.invoice_id}`}
                              </Badge>
                              <Badge color={aging.color} className={aging.color === 'light' ? 'text-dark' : ''}>
                                {aging.label}
                              </Badge>
                              {term !== null && (
                                <Badge color="info" className="fw-normal">
                                  {term}d
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="fw-semibold">{v.client_name || '-'}</div>
                            {v.client_nit && <small className="text-muted">NIT {v.client_nit}</small>}
                          </td>
                          <td className="small">{v.issue_date || '-'}</td>
                          <td className="small">{v.due_date || '-'}</td>
                          <td className="text-end font-monospace">${money(v.total)}</td>
                          <td className="text-end font-monospace text-success">${money(v.paid)}</td>
                          <td className="text-end font-monospace fw-semibold text-warning">${money(v.balance)}</td>
                          <td className="text-center">
                            <Button
                              color="primary"
                              size="sm"
                              onClick={() => {
                                setInitialInvoiceId(v.invoice_id);
                                setShowAllClientInvoices(false);
                                setForm(f => ({
                                  ...f,
                                  clientName: v.client_name || '',
                                  clientNit: String(v.client_nit || ''),
                                }));
                                setShowNew(true);
                              }}
                            >
                              <i className="ri-hand-coin-line me-1" />
                              Cobrar
                            </Button>
                          </td>
                        </tr>
                        );
                      })}
                  </tbody>
                </Table>
              )}
            </div>
          ) : loading ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : error ? (
            <div className="p-3">
              <Alert color="danger" className="d-flex align-items-start gap-3 mb-0">
                <i className="ri-error-warning-line fs-20 mt-1" />
                <div className="flex-grow-1">
                  <strong>No pudimos conectar con el servidor</strong>
                  <div className="fs-13 mt-1">
                    {String(error).toLowerCase().includes('fetch') || String(error).toLowerCase().includes('network')
                      ? 'El backend no responde. Revisa que esté corriendo (npm start en crumi/back) o ajusta VITE_API_URL en front/.env.'
                      : String(error)}
                  </div>
                  <Button size="sm" color="danger" outline className="mt-2" onClick={() => { setError(''); loadReceipts(); }}>
                    Reintentar
                  </Button>
                </div>
              </Alert>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="ri-inbox-line fs-1 d-block mb-2" />
              No has registrado cobros este período
            </div>
          ) : (
            <div className="table-responsive">
              <Table size="sm" className="align-middle mb-0" hover>
                <thead className="table-light">
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th className="text-end">Monto</th>
                    <th className="text-center">Método</th>
                    <th>Referencia</th>
                    <th className="text-center">Facturas</th>
                    <th className="text-center">Estado</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td>
                        <Badge color="info" pill>
                          {r.number || `#${r.id}`}
                        </Badge>
                      </td>
                      <td className="text-nowrap">{r.date}</td>
                      <td>
                        <div className="fw-semibold">{r.client_name || '-'}</div>
                        {r.client_nit && <small className="text-muted">NIT {r.client_nit}</small>}
                      </td>
                      <td className="text-end font-monospace">${money(r.total)}</td>
                      <td className="text-center">
                        <Badge color="light" className="text-dark">
                          <i className={`${methodIcon(r.method)} me-1`} />
                          {methodLabel(r.method)}
                        </Badge>
                      </td>
                      <td>
                        <code className="small">{r.reference || '-'}</code>
                      </td>
                      <td className="text-center">{r.invoices?.length || 0}</td>
                      <td className="text-center">
                        <Badge color={statusColor(r.status)} pill>
                          {statusLabel(r.status)}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <Button
                          size="sm"
                          color="light"
                          onClick={() => openAsDrawer(r)}
                          title="Ver recibo"
                        >
                          <i className="ri-eye-line" />
                        </Button>
                        <Button
                          size="sm"
                          color="light"
                          className="ms-1"
                          onClick={() => openDetail(r)}
                          title="Detalle resumido"
                        >
                          <i className="ri-information-line" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <Offcanvas
        isOpen={showNew}
        toggle={() => closeDrawer()}
        direction="end"
        style={{ width: 620 }}
      >
        <OffcanvasHeader toggle={() => closeDrawer()}>
          <i className="ri-hand-coin-line me-2 text-primary" />
          {viewingId != null ? `Ver recibo RP-${viewingId}` : 'Registrar cobro'}
        </OffcanvasHeader>
        <OffcanvasBody>
          <Form onSubmit={submitReceipt}>
            <Row className="g-2">
              <Col md={8}>
                <FormGroup>
                  <Label className="small">Cliente</Label>
                  <ClienteSelector
                    value={form.clientId || form.clientName || null}
                    onChange={(c: Cliente | null) => {
                      if (c) {
                        setForm(f => ({
                          ...f,
                          clientId: c.id,
                          clientName: c.name,
                          clientNit: c.document_number || '',
                        }));
                      } else {
                        setForm(f => ({ ...f, clientId: '', clientName: '', clientNit: '' }));
                      }
                    }}
                    fallbackLabel={form.clientName}
                    allowCreate
                  />
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup>
                  <Label className="small">NIT</Label>
                  <Input
                    bsSize="sm"
                    value={form.clientNit}
                    onChange={e => setForm({ ...form, clientNit: e.target.value })}
                  />
                </FormGroup>
              </Col>
            </Row>

            <Row className="g-2">
              <Col md={6}>
                <FormGroup>
                  <Label className="small">Fecha del cobro</Label>
                  <Input
                    type="date"
                    bsSize="sm"
                    value={form.dateIssue}
                    onChange={e => setForm({ ...form, dateIssue: e.target.value })}
                    required
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label className="small">Neto total recibido (auto)</Label>
                  <InputGroup size="sm">
                    <InputGroupText>$</InputGroupText>
                    <Input
                      type="text"
                      readOnly
                      value={money(netoRecibido)}
                      style={{ background: '#f0fdf4', fontWeight: 600 }}
                    />
                  </InputGroup>
                  <small className="text-muted">
                    Se calcula automáticamente desde las retenciones que ingreses por factura.
                  </small>
                </FormGroup>
              </Col>
            </Row>

            <div className="alert alert-info py-2 small mb-3">
              <i className="ri-information-line me-1" />
              Para cada factura ingresa cuánto aplicar (valor bruto) y las retenciones que practicó el
              cliente (retefuente/reteIVA/reteICA). El <strong>neto recibido</strong> de cada factura se
              calcula automáticamente (bruto − retenciones). Tarifas típicas: retefuente 2.5% servicios /
              4% honorarios, reteIVA 15% del IVA, reteICA Bogotá 9.66‰ servicios.
            </div>

            {/* ── Formas de recaudo (cómo llega el dinero) ── */}
            <div className="p-3 rounded mb-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong className="small">
                  <i className="ri-wallet-3-line me-1" />
                  Formas de recaudo (cómo llega el neto)
                </strong>
                <Button
                  size="sm"
                  color="link"
                  className="p-0"
                  onClick={() =>
                    setFormasRecaudo(prev => {
                      const asignado = prev.reduce((s, f) => s + (Number(f.amount) || 0), 0);
                      const falta = Math.max(netoRecibido - asignado, 0);
                      return [
                        ...prev,
                        { id: `fr_${Date.now()}_${Math.random()}`, method: 'CASH', amount: String(falta.toFixed(2)) },
                      ];
                    })
                  }
                >
                  <i className="ri-add-line me-1" />
                  Agregar otra forma
                </Button>
              </div>

              {formasRecaudo.map((f, i) => (
                <Row key={f.id} className="g-2 align-items-end mb-2">
                  <Col md={5}>
                    <Label className="small mb-1">Método</Label>
                    <Input
                      type="select"
                      bsSize="sm"
                      value={f.method}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormasRecaudo(prev => prev.map((x, k) => (k === i ? { ...x, method: v } : x)));
                      }}
                    >
                      {METHODS.filter(m => m.value !== 'MIXED').map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </Input>
                  </Col>
                  <Col md={5}>
                    <Label className="small mb-1">
                      Monto
                      {formasRecaudo.length === 1 && (
                        <span className="text-muted ms-1" style={{ fontSize: '11px' }}>
                          (auto = neto recibido)
                        </span>
                      )}
                    </Label>
                    <InputGroup size="sm">
                      <InputGroupText>$</InputGroupText>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={f.amount}
                        readOnly={formasRecaudo.length === 1}
                        title={formasRecaudo.length === 1 ? 'Se calcula automáticamente del neto recibido. Agregá otra forma para repartir manualmente.' : undefined}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormasRecaudo(prev => prev.map((x, k) => (k === i ? { ...x, amount: v } : x)));
                        }}
                      />
                    </InputGroup>
                  </Col>
                  <Col md={2}>
                    <Button
                      color="light"
                      size="sm"
                      className="text-danger w-100"
                      onClick={() => setFormasRecaudo(prev => prev.length > 1 ? prev.filter((_, k) => k !== i) : prev)}
                      disabled={formasRecaudo.length <= 1}
                    >
                      <i className="ri-close-line" />
                    </Button>
                  </Col>
                </Row>
              ))}

              <div className="mt-2 pt-2 small d-flex justify-content-between" style={{ borderTop: '1px dashed #bfdbfe' }}>
                <span className="text-muted">Total asignado a métodos:</span>
                <strong className="font-monospace">${money(totalFormasRecaudo)}</strong>
              </div>
              <div className="small d-flex justify-content-between">
                <span className="text-muted">Neto a recaudar:</span>
                <strong className="font-monospace">${money(netoRecibido)}</strong>
              </div>
              {netoRecibido > 0 && Math.abs(totalFormasRecaudo - netoRecibido) > 0.01 && (
                <div className="small text-danger mt-1">
                  <i className="ri-alert-line me-1" />
                  Debe asignar exactamente ${money(netoRecibido)} entre los métodos de pago.
                </div>
              )}
            </div>

            <FormGroup>
              <Label className="small">Referencia</Label>
              <Input
                bsSize="sm"
                placeholder="Número de transacción, comprobante..."
                value={form.reference}
                onChange={e => setForm({ ...form, reference: e.target.value })}
              />
            </FormGroup>

            <div className="mt-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong className="small">
                  Aplicar a facturas pendientes
                  {applyLines.filter(l => Number(l.applied) > 0).length === 1 && applyLines.length > 1 && (
                    <Badge color="info" className="ms-2 fw-normal">
                      1 de {applyLines.length} marcada — marca más si también quieres cobrarlas
                    </Badge>
                  )}
                </strong>
                <Button
                  type="button"
                  color="link"
                  size="sm"
                  className="p-0"
                  onClick={autoFillApplied}
                  disabled={!applyLines.length}
                >
                  <i className="ri-magic-line me-1" />
                  Aplicar saldo completo
                </Button>
              </div>
              {applyLines.length === 0 ? (
                <div className="text-center text-muted small py-3 border rounded">
                  {form.clientName
                    ? 'Este cliente no tiene facturas pendientes.'
                    : 'Seleccione un cliente para ver sus facturas.'}
                </div>
              ) : (
                <div className="table-responsive border rounded">
                  <Table size="sm" className="mb-0 align-middle" style={{ minWidth: 960 }}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 50 }} className="text-center">Incluir</th>
                        <th># Factura</th>
                        <th className="text-end">Saldo</th>
                        <th className="text-end" style={{ width: 110 }}>Aplicar (bruto)</th>
                        <th className="text-end" style={{ width: 100 }}>Retefuente</th>
                        <th className="text-end" style={{ width: 100 }}>ReteIVA</th>
                        <th className="text-end" style={{ width: 100 }}>ReteICA</th>
                        <th className="text-end" style={{ width: 100 }}>Impoconsumo</th>
                        <th className="text-end" style={{ width: 110 }}>Neto recibido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applyLines.map((l, idx) => {
                        const aplicado = Number(l.applied || 0);
                        const included = aplicado > 0;
                        const rf = Number(l.retefuente || 0);
                        const rIva = Number(l.reteIva || 0);
                        const rIca = Number(l.reteIca || 0);
                        const neto = Math.max(aplicado - rf - rIva - rIca, 0);
                        const aging = agingInfo(l.due_date);
                        const term = creditTermDays(l.issue_date, l.due_date);
                        const totalInv = Number(l.total || 0);
                        const pagadoAntes = Math.max(totalInv - Number(l.balance || 0), 0);
                        const pctPagado = totalInv > 0 ? Math.min((pagadoAntes / totalInv) * 100, 100) : 0;
                        const restante = Math.max(Number(l.balance || 0) - aplicado, 0);
                        const esAbonoParcial = aplicado > 0 && aplicado < Number(l.balance || 0);
                        return (
                          <tr key={l.invoice_id} style={{ opacity: included ? 1 : 0.5 }}>
                            <td className="text-center">
                              <Input
                                type="checkbox"
                                checked={included}
                                onChange={() => {
                                  setApplyLines(prev => prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          applied: included
                                            ? '0'
                                            : String(Number(x.balance || 0).toFixed(2)),
                                          retefuente: included ? '0' : x.retefuente,
                                          reteIva: included ? '0' : x.reteIva,
                                          reteIca: included ? '0' : x.reteIca,
                                          impoconsumo: included ? '0' : x.impoconsumo,
                                        }
                                      : x
                                  ));
                                }}
                              />
                            </td>
                            <td>
                              <div className="d-flex align-items-center flex-wrap gap-1">
                                <Badge color="light" className="text-dark font-monospace">
                                  {l.invoice_number || `#${l.invoice_id}`}
                                </Badge>
                                <Badge color={aging.color} className={aging.color === 'light' ? 'text-dark' : ''}>
                                  {aging.label}
                                </Badge>
                                {term !== null && (
                                  <Badge color="info" className="fw-normal">
                                    {term}d
                                  </Badge>
                                )}
                              </div>
                              <div className="small text-muted">{l.issue_date || '-'}</div>
                              {totalInv > 0 && (
                                <div className="mt-1" style={{ maxWidth: 200 }}>
                                  <Progress
                                    value={pctPagado}
                                    color={pctPagado >= 100 ? 'success' : 'info'}
                                    style={{ height: 4 }}
                                  />
                                  <small className="text-muted" style={{ fontSize: '10px' }}>
                                    {pctPagado.toFixed(0)}% pagado
                                  </small>
                                </div>
                              )}
                            </td>
                            <td className="text-end font-monospace small text-warning">
                              ${money(l.balance)}
                            </td>
                            <td>
                              <Input
                                type="number"
                                bsSize="sm"
                                step="0.01"
                                min="0"
                                max={l.balance}
                                value={l.applied}
                                onChange={e => updateApplied(idx, e.target.value)}
                                className="text-end"
                              />
                              {esAbonoParcial && (
                                <small className="text-info d-block mt-1" style={{ fontSize: '10px', lineHeight: 1.2 }}>
                                  <i className="ri-information-line me-1" />
                                  Abono parcial — quedará ${money(restante)} por cobrar
                                </small>
                              )}
                            </td>
                            <td>
                              <Input
                                type="number"
                                bsSize="sm"
                                step="0.01"
                                min="0"
                                value={l.retefuente}
                                onChange={e => {
                                  const v = e.target.value;
                                  setApplyLines(prev => prev.map((x, i) => i === idx ? { ...x, retefuente: v } : x));
                                }}
                                className="text-end"
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <Input
                                type="number"
                                bsSize="sm"
                                step="0.01"
                                min="0"
                                value={l.reteIva}
                                onChange={e => {
                                  const v = e.target.value;
                                  setApplyLines(prev => prev.map((x, i) => i === idx ? { ...x, reteIva: v } : x));
                                }}
                                className="text-end"
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <Input
                                type="number"
                                bsSize="sm"
                                step="0.01"
                                min="0"
                                value={l.reteIca}
                                onChange={e => {
                                  const v = e.target.value;
                                  setApplyLines(prev => prev.map((x, i) => i === idx ? { ...x, reteIca: v } : x));
                                }}
                                className="text-end"
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <Input
                                type="number"
                                bsSize="sm"
                                step="0.01"
                                min="0"
                                value={l.impoconsumo}
                                onChange={e => {
                                  const v = e.target.value;
                                  setApplyLines(prev => prev.map((x, i) => i === idx ? { ...x, impoconsumo: v } : x));
                                }}
                                className="text-end"
                                placeholder="0"
                              />
                            </td>
                            <td className="text-end font-monospace fw-semibold text-success">
                              ${money(neto)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="table-light">
                        <td></td>
                        <td className="fw-semibold">TOTAL</td>
                        <td></td>
                        <td className="text-end font-monospace fw-semibold">${money(totalApplied)}</td>
                        <td className="text-end font-monospace">${money(totalRetefuente)}</td>
                        <td className="text-end font-monospace">${money(totalReteIva)}</td>
                        <td className="text-end font-monospace">${money(totalReteIca)}</td>
                        <td className="text-end font-monospace">${money(totalImpoconsumo)}</td>
                        <td className="text-end font-monospace fw-bold text-success">${money(netoRecibido)}</td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              )}
              <div className="mt-2 p-2 bg-light rounded small">
                <div className="d-flex justify-content-between">
                  <span>Bruto aplicado (suma de facturas):</span>
                  <strong className="font-monospace">${money(totalApplied)}</strong>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Total retenciones:</span>
                  <strong className="font-monospace text-warning">−${money(totalRetenciones)}</strong>
                </div>
                <div className="d-flex justify-content-between fs-6">
                  <span className="fw-semibold">Neto recibido al banco/caja:</span>
                  <strong className="font-monospace text-success">${money(netoRecibido)}</strong>
                </div>
              </div>
            </div>

            <FormGroup className="mt-3">
              <Label className="small">Observaciones</Label>
              <Input
                type="textarea"
                rows={2}
                bsSize="sm"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </FormGroup>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button color="light" size="sm" type="button" onClick={() => closeDrawer()}>
                {viewingId != null ? 'Cerrar' : 'Cancelar'}
              </Button>
              {viewingId == null && (
                <Button
                  color="primary"
                  size="lg"
                  type="submit"
                  disabled={savingNew}
                >
                  {savingNew ? <Spinner size="sm" /> : (
                    <>
                      <i className="ri-check-line me-1" />
                      Registrar cobro
                    </>
                  )}
                </Button>
              )}
            </div>
          </Form>
        </OffcanvasBody>
      </Offcanvas>

      <Offcanvas isOpen={!!detail} toggle={() => setDetail(null)} direction="end" style={{ width: 620 }}>
        <OffcanvasHeader toggle={() => setDetail(null)}>
          Detalle de cobro {detail?.number ? `#${detail.number}` : ''}
        </OffcanvasHeader>
        <OffcanvasBody>
          {detail && (
            <div>
              {/* Header resumen */}
              <Card
                className="border-0 shadow-sm mb-3"
                style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)' }}
              >
                <CardBody>
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                    <div>
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Cliente</div>
                      <div className="fs-5 fw-semibold">{detail.client_name || '-'}</div>
                      {detail.client_nit && (
                        <div className="text-muted small">NIT {detail.client_nit}</div>
                      )}
                    </div>
                    <div className="text-end">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>
                        Recibo de caja
                      </div>
                      <div className="fs-5 fw-semibold font-monospace">
                        {detail.number ? `#${detail.number}` : `#${detail.id}`}
                      </div>
                      <Badge color={statusColor(detail.status)} pill className="mt-1">
                        {statusLabel(detail.status)}
                      </Badge>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Métricas destacadas */}
              <Row className="g-2 mb-3">
                <Col md={4}>
                  <Card className="border-0 shadow-sm h-100" style={{ background: '#f0fdf4' }}>
                    <CardBody className="py-3">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Monto</div>
                      <div className="fs-5 fw-semibold text-success">${money(detail.total)}</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-0 shadow-sm h-100">
                    <CardBody className="py-3">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Fecha</div>
                      <div className="fw-medium">{detail.date || '-'}</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-0 shadow-sm h-100">
                    <CardBody className="py-3">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Método</div>
                      <div className="fw-medium">
                        <i className={`${methodIcon(detail.method)} me-1 text-primary`} />
                        {methodLabel(detail.method)}
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {/* Detalles adicionales */}
              {(detail.reference || detail.notes) && (
                <Card className="border-0 shadow-sm mb-3">
                  <CardBody>
                    <Row className="g-3">
                      {detail.reference && (
                        <Col md={6}>
                          <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Referencia</div>
                          <code>{detail.reference}</code>
                        </Col>
                      )}
                      {detail.notes && (
                        <Col md={detail.reference ? 6 : 12}>
                          <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Observaciones</div>
                          <div>{detail.notes}</div>
                        </Col>
                      )}
                    </Row>
                  </CardBody>
                </Card>
              )}

              {/* Facturas aplicadas */}
              <h6 className="mt-3 mb-2">Facturas aplicadas</h6>
              {!detail.invoices || detail.invoices.length === 0 ? (
                <div className="alert alert-warning py-2 small">
                  <i className="ri-information-line me-1" />
                  Cobro sin aplicación a factura (anticipo del cliente).
                </div>
              ) : (
                <div className="table-responsive border rounded mb-2">
                  <Table size="sm" className="align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th># Factura</th>
                        <th className="text-end">Aplicado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.invoices.map(i => (
                        <tr key={i.invoice_id}>
                          <td>
                            <Badge color="light" className="text-dark font-monospace">
                              {i.invoice_number || `#${i.invoice_id}`}
                            </Badge>
                          </td>
                          <td className="text-end font-monospace fw-medium">${money(i.applied_amount)}</td>
                        </tr>
                      ))}
                      <tr className="table-light">
                        <td className="fw-semibold">Total aplicado</td>
                        <td className="text-end font-monospace fw-semibold">
                          ${money(detail.invoices.reduce((sum, i) => sum + Number(i.applied_amount || 0), 0))}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              )}

              {statusLabel(detail.status) !== 'Anulado' && (
                <div className="mt-3 d-flex justify-content-end">
                  <Button color="danger" size="sm" outline onClick={voidReceipt} disabled={voiding}>
                    {voiding ? <Spinner size="sm" /> : (
                      <>
                        <i className="ri-close-circle-line me-1" />
                        Anular recibo
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </OffcanvasBody>
      </Offcanvas>
    </div>
  );
};

export default Cobros;
