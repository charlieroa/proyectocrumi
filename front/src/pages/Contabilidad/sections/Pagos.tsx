import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Table,
  Spinner,
  Badge,
  Offcanvas,
  OffcanvasHeader,
  OffcanvasBody,
  Alert,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  Progress,
} from 'reactstrap';
import { API_BASE, money, useAuthHeaders, normalizeAccount } from '../shared';
import { useLocation } from 'react-router-dom';
import { downloadExcelReport } from '../../../Components/Common/excelExport';
import { downloadPdfReport } from '../../../Components/Common/pdfExport';
import PucPicker from '../../../Components/Contabilidad/PucPicker';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

type PayMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';

interface ApplyLine {
  payableId: number | string;
  document_number?: string;
  document_type?: string;
  supplier_name?: string;
  supplier_document_number?: string;
  issue_date?: string;
  due_date?: string;
  aging_bucket?: string;
  total: number;
  balance: number;
  paid: number;
  amountApplied: string;
}

interface FormaRecaudo {
  id: string;
  method: PayMethod;
  amount: string;
  bankAccountCode: string;
}

interface PaymentRow {
  id: number | string;
  source_number?: string;
  date: string;
  payable_id?: number | string;
  payable_document_number?: string;
  payable_document_type?: string;
  supplier_name?: string;
  supplier_document_number?: string;
  amount: number | string;
  method?: string;
  bank_account_code?: string;
  reference?: string;
  notes?: string;
  status?: string;
  payable_total?: number | string;
  payable_balance?: number | string;
}

interface PayableRow {
  id: number | string;
  document_type?: string;
  document_number?: string;
  supplier_name?: string;
  supplier_document_number?: string;
  issue_date?: string;
  due_date?: string;
  total?: number | string;
  original_amount?: number | string;
  paid_amount?: number | string;
  balance?: number | string;
  balance_amount?: number | string;
  status?: string;
  aging_bucket?: string;
  days_overdue?: number;
  withholding_source_amount?: number | string;
  withholding_ica_amount?: number | string;
  withholding_vat_amount?: number | string;
}

interface BankAccount {
  id?: number | string;
  code?: string;
  name?: string;
  account_code?: string;
  account_name?: string;
  account_number?: string;
}

interface PucAccount {
  id?: number | string;
  code: string;
  name: string;
  account_type?: string;
}

interface PaymentInvoiceRef {
  payable_id: number;
  document_type?: string;
  document_number?: string;
  supplier_name?: string;
  supplier_document_number?: string;
  amount_applied: number;
  gross_amount?: number;
}

interface PaymentMethodEntry {
  method: string;
  amount: number;
  bank_account_code?: string;
}

interface PaymentDetail {
  application: {
    id: number;
    source_number: string;
    date: string;
    amount: number;
    gross_amount?: number;
    withholding_source_amount?: number;
    withholding_ica_amount?: number;
    withholding_vat_amount?: number;
    withholding_source_code?: string | null;
    withholding_ica_code?: string | null;
    withholding_vat_code?: string | null;
    method?: string;
    bank_account_code?: string;
    reference?: string;
    notes?: string;
    status: string;
    voided_at?: string;
    void_reason?: string;
    created_at?: string;
    // Nuevos (backend multi-factura / multi-método):
    invoices?: PaymentInvoiceRef[];
    paymentMethods?: PaymentMethodEntry[];
  };
  payable: {
    id: number;
    document_type: string;
    document_number: string;
    internal_number?: string;
    supplier_name: string;
    supplier_document_type?: string;
    supplier_document_number?: string;
    issue_date?: string;
    due_date?: string;
    subtotal: number;
    tax: number;
    retefuente: number;
    reteica: number;
    reteiva: number;
    total: number;
    paid: number;
    balance: number;
    status: string;
    expense_account_code?: string;
    expense_account_name?: string;
    payable_account_code?: string;
  };
  journal: {
    entries: Array<{ id: number; entry_number?: string; description?: string; document_type?: string; entry_date?: string; status?: string }>;
    lines: Array<{ journal_entry_id: number; account_code: string; account_name?: string; description?: string; debit: number | string; credit: number | string; third_party_document?: string; third_party_name?: string }>;
  };
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const methodLabel = (m?: string) => {
  const u = String(m || '').toUpperCase();
  if (u === 'CASH' || u.includes('EFECT')) return 'Efectivo';
  if (u === 'BANK_TRANSFER' || u.includes('TRANSF') || u.includes('PSE')) return 'Transferencia';
  if (u === 'CHECK' || u.includes('CHEQ')) return 'Cheque';
  if (u === 'OTHER' || u.includes('OTRO')) return 'Otro';
  return m || '-';
};

const methodColor = (m?: string) => {
  const u = String(m || '').toUpperCase();
  if (u === 'CASH' || u.includes('EFECT')) return 'success';
  if (u === 'BANK_TRANSFER' || u.includes('TRANSF') || u.includes('PSE')) return 'primary';
  if (u === 'CHECK' || u.includes('CHEQ')) return 'info';
  return 'secondary';
};

const methodIcon = (m?: string) => {
  const u = String(m || '').toUpperCase();
  if (u === 'CASH' || u.includes('EFECT')) return 'ri-money-dollar-circle-line';
  if (u === 'BANK_TRANSFER' || u.includes('TRANSF') || u.includes('PSE')) return 'ri-bank-line';
  if (u === 'CHECK' || u.includes('CHEQ')) return 'ri-bill-line';
  return 'ri-more-2-line';
};

const agingColor = (bucket?: string) => {
  switch (bucket) {
    case 'AL DIA': return 'success';
    case '1-30': return 'warning';
    case '31-60': return 'warning';
    case '61-90': return 'danger';
    case '90+': return 'danger';
    default: return 'light';
  }
};

const statusColor = (s?: string) => {
  const u = String(s || '').toUpperCase();
  if (u === 'ANULADO' || u === 'VOID' || u === 'VOIDED') return 'secondary';
  if (u === 'ACTIVO' || u === 'REGISTERED' || u === 'POSTED') return 'success';
  if (u === 'PENDIENTE' || u === 'PENDING') return 'warning';
  if (u === 'PARCIAL' || u === 'PARTIAL') return 'info';
  if (u === 'PAGADA' || u === 'PAID') return 'success';
  return 'info';
};

const num = (v: any) => Number(v || 0);

const Pagos: React.FC = () => {
  const headers = useAuthHeaders();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'emitidos' | 'pendientes'>('emitidos');
  const [loading, setLoading] = useState(false);
  const [loadingPayables, setLoadingPayables] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payables, setPayables] = useState<PayableRow[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<PucAccount[]>([]);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState(firstDayOfMonthISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [supplierFilter, setSupplierFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');

  const [showNew, setShowNew] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const [form, setForm] = useState({
    date: todayISO(),
    reference: '',
    notes: '',
    // Retenciones practicadas al pago (opcionales, totales a nivel comprobante)
    retefuenteAmount: '',
    retefuenteCode: '236540',
    reteicaAmount: '',
    reteicaCode: '236801',
    reteivaAmount: '',
    reteivaCode: '236703',
  });
  const [applyLines, setApplyLines] = useState<ApplyLine[]>([]);
  const [formasRecaudo, setFormasRecaudo] = useState<FormaRecaudo[]>([
    { id: `fr_${Date.now()}`, method: 'BANK_TRANSFER', amount: '', bankAccountCode: '' },
  ]);
  const [showRetenciones, setShowRetenciones] = useState(false);
  const [payableSearch, setPayableSearch] = useState('');
  const [generarMovBancario, setGenerarMovBancario] = useState(true);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = `${API_BASE}/accounting/accounts-payable/payments?startDate=${startDate}&endDate=${endDate}`;
      const r = await fetch(url, { headers });
      const j = await r.json();
      if (j?.success) setPayments(j.payments || []);
      else setError(j?.message || 'No se pudieron cargar los pagos');
    } catch (e: any) {
      setError(e?.message || 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, headers]);

  const loadPayables = useCallback(async () => {
    setLoadingPayables(true);
    try {
      const r = await fetch(`${API_BASE}/accounting/accounts-payable`, { headers });
      const j = await r.json();
      const raw: any[] = j?.payables || j?.accountsPayable || j?.data || [];
      const list: PayableRow[] = raw.map((p: any) => ({
        ...p,
        total: p.original_amount ?? p.total ?? 0,
        balance: p.balance_amount ?? p.balance ?? 0,
        paid_amount: p.paid_amount ?? 0,
      }));
      setPayables(list);
    } catch { /* noop */ }
    finally { setLoadingPayables(false); }
  }, [headers]);

  const loadBanks = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/accounting/banks`, { headers });
      if (!r.ok) return;
      const j = await r.json();
      setBanks(j?.banks || j?.data || []);
    } catch { /* noop */ }
  }, [headers]);

  const loadAccounts = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/accounting/chart-of-accounts`, { headers });
      if (!r.ok) return;
      const j = await r.json();
      const list: any[] = j?.accounts || j?.chartOfAccounts || j?.data || [];
      setAccounts(Array.isArray(list) ? list.map(normalizeAccount) : []);
    } catch { /* noop */ }
  }, [headers]);

  useEffect(() => { loadPayments(); }, [loadPayments]);
  useEffect(() => { loadPayables(); loadBanks(); loadAccounts(); }, [loadPayables, loadBanks, loadAccounts]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id && payables.length > 0) {
      const p = payables.find(x => String(x.id) === String(id));
      if (p) openNewFor(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, payables]);

  const payableToApplyLine = (p: PayableRow): ApplyLine => {
    const total = num(p.total);
    const paid = num(p.paid_amount);
    const balance = num(p.balance ?? (total - paid));
    return {
      payableId: p.id,
      document_number: p.document_number,
      document_type: p.document_type,
      supplier_name: p.supplier_name,
      supplier_document_number: p.supplier_document_number,
      issue_date: p.issue_date,
      due_date: p.due_date,
      aging_bucket: p.aging_bucket,
      total, balance, paid,
      amountApplied: balance.toFixed(2),
    };
  };

  const resetFormBase = () => {
    setForm({
      date: todayISO(),
      reference: '',
      notes: '',
      retefuenteAmount: '',
      retefuenteCode: '236540',
      reteicaAmount: '',
      reteicaCode: '236801',
      reteivaAmount: '',
      reteivaCode: '236703',
    });
    setFormasRecaudo([{ id: `fr_${Date.now()}`, method: 'BANK_TRANSFER', amount: '', bankAccountCode: '' }]);
    setShowRetenciones(false);
    setPayableSearch('');
  };

  const openNewFor = (p: PayableRow) => {
    resetFormBase();
    setApplyLines([payableToApplyLine(p)]);
    setShowNew(true);
  };

  const openNewBlank = () => {
    resetFormBase();
    setApplyLines([]);
    setShowNew(true);
  };

  const addApplyLine = (p: PayableRow) => {
    setApplyLines(lines => {
      if (lines.some(l => String(l.payableId) === String(p.id))) return lines;
      return [...lines, payableToApplyLine(p)];
    });
  };

  const removeApplyLine = (payableId: number | string) => {
    setApplyLines(lines => lines.filter(l => String(l.payableId) !== String(payableId)));
  };

  const setApplyLineAmount = (payableId: number | string, value: string) => {
    setApplyLines(lines => lines.map(l => String(l.payableId) === String(payableId) ? { ...l, amountApplied: value } : l));
  };

  const addFormaRecaudo = () => {
    setFormasRecaudo(f => [...f, { id: `fr_${Date.now()}`, method: 'CASH', amount: '', bankAccountCode: '' }]);
  };

  const removeFormaRecaudo = (id: string) => {
    setFormasRecaudo(f => f.length > 1 ? f.filter(r => r.id !== id) : f);
  };

  const updateFormaRecaudo = (id: string, patch: Partial<FormaRecaudo>) => {
    setFormasRecaudo(f => f.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const selectedPayableIds = useMemo(() => new Set(applyLines.map(l => String(l.payableId))), [applyLines]);

  const pendingPayables = useMemo(() => {
    return payables.filter(p => num(p.balance ?? (num(p.total) - num(p.paid_amount))) > 0);
  }, [payables]);

  const filteredPayablesForSearch = useMemo(() => {
    const q = payableSearch.trim().toLowerCase();
    const base = pendingPayables;
    if (!q) return base.slice(0, 20);
    return base.filter(p =>
      (p.document_number || '').toLowerCase().includes(q) ||
      (p.supplier_name || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [pendingPayables, payableSearch]);

  const filteredPendientes = useMemo(() => {
    const q = supplierFilter.trim().toLowerCase();
    return pendingPayables.filter(p => {
      if (!q) return true;
      const hay = `${p.supplier_name || ''} ${p.document_number || ''} ${p.supplier_document_number || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pendingPayables, supplierFilter]);

  const filteredEmitidos = useMemo(() => {
    const q = supplierFilter.trim().toLowerCase();
    return payments.filter(p => {
      const status = String(p.status || 'ACTIVO').toUpperCase();
      if (statusFilter === 'ACTIVE' && status !== 'ACTIVO') return false;
      if (statusFilter === 'VOIDED' && status !== 'ANULADO') return false;
      if (methodFilter !== 'ALL' && String(p.method || '').toUpperCase() !== methodFilter) return false;
      if (q) {
        const hay = `${p.supplier_name || ''} ${p.source_number || ''} ${p.payable_document_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [payments, supplierFilter, methodFilter, statusFilter]);

  const kpis = useMemo(() => {
    let paidMonth = 0;
    let countMonth = 0;
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    payments.forEach(p => {
      if (String(p.status || 'ACTIVO').toUpperCase() !== 'ACTIVO') return;
      const d = new Date(p.date);
      if (d.getMonth() === m && d.getFullYear() === y) {
        paidMonth += num(p.amount);
        countMonth += 1;
      }
    });
    let pendingTotal = 0;
    let overdueCount = 0;
    pendingPayables.forEach(p => {
      const saldo = num(p.balance ?? (num(p.total) - num(p.paid_amount)));
      pendingTotal += saldo;
      if (p.due_date && new Date(p.due_date) < new Date(todayISO()) && saldo > 0) overdueCount += 1;
    });
    return { paidMonth, countMonth, pendingTotal, overdueCount };
  }, [payments, pendingPayables]);


  // Totales derivados del comprobante de egreso:
  // - bruto = suma de amountApplied en cada factura (lo que disminuye la CxP)
  // - retenciones = totales a nivel comprobante
  // - neto a girar = bruto - retenciones (debe coincidir con la suma de formas de pago)
  const totales = useMemo(() => {
    const bruto = applyLines.reduce((s, l) => s + num(l.amountApplied), 0);
    const retF = num(form.retefuenteAmount);
    const retI = num(form.reteicaAmount);
    const retV = num(form.reteivaAmount);
    const retTotal = retF + retI + retV;
    const neto = Math.max(bruto - retTotal, 0);
    const recaudado = formasRecaudo.reduce((s, f) => s + num(f.amount), 0);
    return { bruto, retF, retI, retV, retTotal, neto, recaudado, diff: recaudado - neto };
  }, [applyLines, form.retefuenteAmount, form.reteicaAmount, form.reteivaAmount, formasRecaudo]);

  // Auto-ajuste: si hay una sola forma de recaudo con monto vacío, llenarla con el neto
  useEffect(() => {
    if (formasRecaudo.length === 1 && !formasRecaudo[0].amount && totales.neto > 0) {
      updateFormaRecaudo(formasRecaudo[0].id, { amount: totales.neto.toFixed(2) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totales.neto, formasRecaudo.length]);

  const submit = async () => {
    setError('');
    if (applyLines.length === 0) { setError('Selecciona al menos una factura a pagar'); return; }
    if (!form.date) { setError('Fecha requerida'); return; }
    // Validar cada línea
    for (const l of applyLines) {
      const applied = num(l.amountApplied);
      if (applied <= 0) { setError(`Monto inválido en factura ${l.document_number || l.payableId}`); return; }
      if (applied > l.balance + 0.01) { setError(`El monto aplicado a ${l.document_number || l.payableId} supera su saldo`); return; }
    }
    if (totales.bruto <= 0) { setError('Monto bruto inválido'); return; }
    if (totales.retTotal > totales.bruto + 0.01) {
      setError('Las retenciones no pueden superar el monto bruto aplicado'); return;
    }
    if (totales.retF > 0 && !form.retefuenteCode) { setError('PUC de retefuente requerido'); return; }
    if (totales.retI > 0 && !form.reteicaCode) { setError('PUC de reteICA requerido'); return; }
    if (totales.retV > 0 && !form.reteivaCode) { setError('PUC de reteIVA requerido'); return; }
    // Validar formas de pago
    const formasValidas = formasRecaudo.filter(f => num(f.amount) > 0);
    if (formasValidas.length === 0) { setError('Agrega al menos una forma de pago con monto'); return; }
    for (const f of formasValidas) {
      if (f.method !== 'CASH' && !f.bankAccountCode) { setError(`Cuenta PUC requerida para ${methodLabel(f.method)}`); return; }
    }
    if (Math.abs(totales.diff) > 0.01) {
      setError(`La suma de formas de pago ($${money(totales.recaudado)}) no coincide con el neto a girar ($${money(totales.neto)})`);
      return;
    }

    // Confirmación
    const invoicesHtml = applyLines.map(l => `<tr><td class="text-start">${l.document_type || 'FC'} ${l.document_number || ''} · ${l.supplier_name || ''}</td><td class="text-end">$${money(l.amountApplied)}</td></tr>`).join('');
    const formasHtml = formasValidas.map(f => `<tr><td class="text-start">${methodLabel(f.method)}${f.bankAccountCode ? ` (${f.bankAccountCode})` : ''}</td><td class="text-end">$${money(f.amount)}</td></tr>`).join('');
    const detalleHtml = `
      <div class="small text-start">
        <div class="fw-semibold mb-1">Facturas a abonar</div>
        <table class="table table-sm mb-2"><tbody>${invoicesHtml}<tr class="fw-bold"><td>Total bruto</td><td class="text-end">$${money(totales.bruto)}</td></tr></tbody></table>
        ${totales.retTotal > 0 ? `<div class="fw-semibold mb-1">Retenciones</div><div class="text-info mb-2">-$${money(totales.retTotal)}</div>` : ''}
        <div class="fw-semibold mb-1">Formas de pago</div>
        <table class="table table-sm mb-0"><tbody>${formasHtml}<tr class="fw-bold"><td>Neto girado</td><td class="text-end text-success">$${money(totales.neto)}</td></tr></tbody></table>
      </div>`;
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Confirmar comprobante de egreso',
      html: detalleHtml,
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A1D1F',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
      width: 520,
    });
    if (!confirm.isConfirmed) return;

    setSavingNew(true);
    try {
      const body = {
        paymentDate: form.date,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
        invoices: applyLines.map(l => ({ payableId: l.payableId, amountApplied: num(l.amountApplied) })),
        paymentMethods: formasValidas.map(f => ({
          method: f.method,
          amount: num(f.amount),
          bankAccountCode: f.bankAccountCode || undefined,
        })),
        withholdingSourceAmount: totales.retF,
        withholdingIcaAmount: totales.retI,
        withholdingVatAmount: totales.retV,
        withholdingSourceCode: totales.retF > 0 ? form.retefuenteCode : undefined,
        withholdingIcaCode: totales.retI > 0 ? form.reteicaCode : undefined,
        withholdingVatCode: totales.retV > 0 ? form.reteivaCode : undefined,
      };
      const r = await fetch(`${API_BASE}/accounting/accounts-payable/apply-payment`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || j?.message || 'No se pudo registrar el pago');

      // El backend ya crea bank_transactions automáticamente en apply-payment
      // (por cada forma no-efectivo cuya cuenta esté en tenant_banks).
      const okMsg = `Egreso ${j.sourceNumber || ''} registrado`.trim();
      {
        await Swal.fire({
          icon: 'success', title: okMsg,
          text: totales.retTotal > 0 ? `Neto girado: $${money(totales.neto)} · Retenciones: $${money(totales.retTotal)}` : `Monto pagado: $${money(totales.bruto)}`,
          timer: 2000, confirmButtonColor: '#1A1D1F',
        });
      }

      setShowNew(false);
      await Promise.all([loadPayments(), loadPayables()]);
    } catch (e: any) {
      await Swal.fire({
        icon: 'error', title: 'No se pudo registrar el pago',
        text: e?.message || 'Error de red', confirmButtonColor: '#1A1D1F',
      });
    } finally {
      setSavingNew(false);
    }
  };

  const openDetail = async (p: PaymentRow) => {
    setShowDetail(true);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const r = await fetch(`${API_BASE}/accounting/accounts-payable/payments/${p.id}`, { headers });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || 'No se pudo cargar el detalle');
      setDetail({
        application: j.application,
        payable: j.payable,
        journal: j.journal,
      });
    } catch (e: any) {
      setError(e?.message || 'Error al cargar detalle');
      setShowDetail(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const doVoid = async () => {
    if (!detail) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: `Anular pago ${detail.application.source_number}`,
      text: 'Ingresa el motivo de anulación:',
      input: 'text',
      inputPlaceholder: 'Motivo (opcional)',
      showCancelButton: true,
      confirmButtonText: 'Anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    const reason = result.value || null;
    setVoiding(true);
    try {
      const r = await fetch(`${API_BASE}/accounting/accounts-payable/payments/${detail.application.id}/void`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });
      const j = await r.json();
      if (!r.ok || !j?.success) throw new Error(j?.error || 'No se pudo anular el pago');
      await Swal.fire({
        icon: 'success',
        title: `Pago ${detail.application.source_number} anulado`,
        timer: 1800,
        confirmButtonColor: '#1A1D1F',
      });
      setShowDetail(false);
      await Promise.all([loadPayments(), loadPayables()]);
    } catch (e: any) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo anular',
        text: e?.message || 'Error de red',
        confirmButtonColor: '#1A1D1F',
      });
    } finally {
      setVoiding(false);
    }
  };

  const exportPaymentsExcel = () => {
    const rows = filteredEmitidos.map(p => [
      p.source_number || '',
      String(p.date || '').slice(0, 10),
      p.supplier_name || '',
      p.supplier_document_number || '',
      `${p.payable_document_type || 'FC'} ${p.payable_document_number || ''}`.trim(),
      num(p.payable_total),
      num(p.amount),
      num(p.payable_balance),
      methodLabel(p.method),
      p.bank_account_code || '',
      p.reference || '',
      String(p.status || 'ACTIVO'),
    ]);
    downloadExcelReport(
      'Pagos',
      ['N° CE', 'Fecha', 'Proveedor', 'NIT', 'Factura', 'Total factura', 'Monto pagado', 'Saldo factura', 'Método', 'PUC banco', 'Referencia', 'Estado'],
      rows,
      `pagos_proveedores_${startDate}_${endDate}.xlsx`,
      { title: 'Pagos a proveedores', dateRange: `${startDate} a ${endDate}` }
    );
  };

  const exportPendientesExcel = () => {
    const rows = filteredPendientes.map(p => {
      const saldo = num(p.balance ?? (num(p.total) - num(p.paid_amount)));
      return [
        `${p.document_type || 'FC'} ${p.document_number || ''}`.trim(),
        p.supplier_name || '',
        p.supplier_document_number || '',
        String(p.issue_date || '').slice(0, 10),
        String(p.due_date || '').slice(0, 10),
        num(p.total),
        num(p.paid_amount),
        saldo,
        p.aging_bucket || '',
      ];
    });
    downloadExcelReport(
      'CxP pendientes',
      ['Factura', 'Proveedor', 'NIT', 'Emitida', 'Vence', 'Total', 'Pagado', 'Saldo', 'Aging'],
      rows,
      `cxp_pendientes_${todayISO()}.xlsx`,
      { title: 'Cuentas por pagar pendientes' }
    );
  };

  const downloadPaymentPDF = () => {
    if (!detail) return;
    const d = detail;
    const bankName = banks.find(b =>
      (b.code && String(b.code) === (d.application.bank_account_code || '')) ||
      (b.account_code && String(b.account_code) === (d.application.bank_account_code || ''))
    );
    const bankLabel = `${d.application.bank_account_code || '-'}${bankName ? ` · ${bankName.name || bankName.account_name || ''}` : ''}`;
    const totalRetenciones = (d.payable.retefuente || 0) + (d.payable.reteica || 0) + (d.payable.reteiva || 0);
    const rows: (string | number)[][] = [
      ['Total factura', Number(d.payable.total) || 0],
      ['Saldo antes del pago', (Number(d.payable.balance) || 0) + (Number(d.application.amount) || 0)],
      ['VALOR PAGADO', Number(d.application.amount) || 0],
      ['Saldo después del pago', Number(d.payable.balance) || 0],
    ];
    const extra: string[] = [
      `Proveedor: ${d.payable.supplier_name || '-'} (${d.payable.supplier_document_type || 'NIT'} ${d.payable.supplier_document_number || '-'})`,
      `Factura: ${d.payable.document_type || ''} ${d.payable.document_number || ''}`,
      `Emitida / Vence: ${String(d.payable.issue_date || '').slice(0, 10)} / ${String(d.payable.due_date || '').slice(0, 10)}`,
      `Método de pago: ${methodLabel(d.application.method)}`,
      `Cuenta bancaria (PUC): ${bankLabel}`,
      `Referencia: ${d.application.reference || '-'}`,
      `Observaciones: ${d.application.notes || '-'}`,
      `Subtotal factura: $${money(d.payable.subtotal)} · IVA: $${money(d.payable.tax)}`,
    ];
    if (totalRetenciones > 0) {
      extra.push(`Retenciones al causar: Retefuente $${money(d.payable.retefuente)} · ReteICA $${money(d.payable.reteica)} · ReteIVA $${money(d.payable.reteiva)}`);
    }
    if (d.application.status === 'ANULADO') {
      extra.push(`PAGO ANULADO — ${d.application.void_reason || ''} ${d.application.voided_at ? `(${String(d.application.voided_at).slice(0, 19).replace('T', ' ')})` : ''}`);
    }
    downloadPdfReport(
      ['Concepto', 'Valor'],
      rows,
      `comprobante_egreso_${d.application.source_number}.pdf`,
      {
        title: `Comprobante de Egreso ${d.application.source_number}`,
        subtitle: `Estado: ${d.application.status}`,
        dateRange: String(d.application.date || '').slice(0, 10),
        extra,
        signatures: [
          { role: 'Elaborado por' },
          { role: 'Aprobado por' },
          { role: 'Recibido (proveedor)' },
        ],
      },
    );
  };

  return (
    <div>
      <ConfigGuardBanner moduleKey="pagos" />
      <Card className="mb-3">
        <CardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 className="mb-0">Pagos a proveedores</h5>
            <small className="text-muted">Comprobantes de egreso (CE) sobre facturas (FC) y documentos soporte (DS)</small>
          </div>
          <div className="d-flex gap-2">
            <Button color="light" onClick={activeTab === 'emitidos' ? exportPaymentsExcel : exportPendientesExcel}>
              <i className="ri-file-excel-2-line align-middle me-1" /> Excel
            </Button>
            <Button color="primary" onClick={openNewBlank}>
              <i className="ri-add-line align-middle me-1" /> Registrar pago
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="h-100"><CardBody>
            <div className="text-muted small">Pagado este mes</div>
            <h4 className="mt-1 mb-0 text-success">${money(kpis.paidMonth)}</h4>
            <div className="text-muted small mt-1">Salidas de banco / caja</div>
          </CardBody></Card>
        </Col>
        <Col md={3}>
          <Card className="h-100"><CardBody>
            <div className="text-muted small">Egresos del mes</div>
            <h4 className="mt-1 mb-0">{kpis.countMonth}</h4>
            <div className="text-muted small mt-1">Comprobantes emitidos</div>
          </CardBody></Card>
        </Col>
        <Col md={3}>
          <Card className="h-100"><CardBody>
            <div className="text-muted small">CxP pendientes</div>
            <h4 className="mt-1 mb-0 text-warning">${money(kpis.pendingTotal)}</h4>
            <div className="text-muted small mt-1">{pendingPayables.length} facturas</div>
          </CardBody></Card>
        </Col>
        <Col md={3}>
          <Card className="h-100"><CardBody>
            <div className="text-muted small">Vencidas sin pagar</div>
            <h4 className={`mt-1 mb-0 ${kpis.overdueCount > 0 ? 'text-danger' : ''}`}>{kpis.overdueCount}</h4>
            <div className="text-muted small mt-1">Revisa aging &gt; 0 días</div>
          </CardBody></Card>
        </Col>
      </Row>

      <Card className="mb-3">
        <CardBody>
          <Nav tabs className="mb-3">
            <NavItem>
              <NavLink
                className={activeTab === 'emitidos' ? 'active' : ''}
                onClick={() => setActiveTab('emitidos')}
                style={{ cursor: 'pointer' }}
              >
                <i className="ri-file-list-3-line me-1" /> Emitidos ({payments.filter(p => String(p.status || 'ACTIVO').toUpperCase() === 'ACTIVO').length})
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                className={activeTab === 'pendientes' ? 'active' : ''}
                onClick={() => setActiveTab('pendientes')}
                style={{ cursor: 'pointer' }}
              >
                <i className="ri-time-line me-1" /> Pendientes de pago ({pendingPayables.length})
              </NavLink>
            </NavItem>
          </Nav>

          <Row className="g-2 align-items-end mb-3">
            {activeTab === 'emitidos' && (
              <>
                <Col md={2}>
                  <Label className="form-label">Desde</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </Col>
                <Col md={2}>
                  <Label className="form-label">Hasta</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </Col>
              </>
            )}
            <Col md={3}>
              <Label className="form-label">Proveedor</Label>
              <Input placeholder="Buscar proveedor o documento" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} />
            </Col>
            {activeTab === 'emitidos' && (
              <>
                <Col md={2}>
                  <Label className="form-label">Método</Label>
                  <Input type="select" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
                    <option value="ALL">Todos</option>
                    <option value="CASH">Efectivo</option>
                    <option value="BANK_TRANSFER">Transferencia</option>
                    <option value="CHECK">Cheque</option>
                    <option value="OTHER">Otro</option>
                  </Input>
                </Col>
                <Col md={2}>
                  <Label className="form-label">Estado</Label>
                  <Input type="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="ACTIVE">Activos</option>
                    <option value="VOIDED">Anulados</option>
                    <option value="ALL">Todos</option>
                  </Input>
                </Col>
              </>
            )}
            <Col md={1}>
              <Button color="light" className="w-100" onClick={activeTab === 'emitidos' ? loadPayments : loadPayables}>
                <i className="ri-refresh-line" />
              </Button>
            </Col>
          </Row>

          {error && (
            <Alert color="danger" className="d-flex align-items-start gap-3 mb-3" toggle={() => setError('')}>
              <i className="ri-error-warning-line fs-20 mt-1" />
              <div className="flex-grow-1">
                <strong>Ups, hubo un problema</strong>
                <div className="fs-13 mt-1">{String(error)}</div>
              </div>
            </Alert>
          )}
          <TabContent activeTab={activeTab}>
            <TabPane tabId="emitidos">
              {loading ? (
                <div className="text-center py-5"><Spinner /></div>
              ) : filteredEmitidos.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="ri-wallet-3-line" style={{ fontSize: 48 }} />
                  <div className="mt-2">No hay pagos emitidos en este período</div>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table className="align-middle mb-0" hover>
                    <thead>
                      <tr>
                        <th>N° CE</th>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Factura</th>
                        <th className="text-end">Total factura</th>
                        <th className="text-end">Pagado</th>
                        <th className="text-end">Saldo factura</th>
                        <th>Método</th>
                        <th>PUC banco</th>
                        <th>Estado</th>
                        <th style={{ width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmitidos.map(p => {
                        const isVoid = String(p.status || 'ACTIVO').toUpperCase() === 'ANULADO';
                        return (
                          <tr key={p.id} className={isVoid ? 'text-muted' : ''} style={isVoid ? { textDecoration: 'line-through' } : undefined}>
                            <td className="fw-semibold">{p.source_number || `#${p.id}`}</td>
                            <td>{String(p.date || '').slice(0, 10)}</td>
                            <td>
                              <div>{p.supplier_name || '-'}</div>
                              <div className="text-muted small">{p.supplier_document_number || ''}</div>
                            </td>
                            <td>{p.payable_document_type || 'FC'} {p.payable_document_number || ''}</td>
                            <td className="text-end">${money(p.payable_total)}</td>
                            <td className="text-end fw-bold text-success">${money(p.amount)}</td>
                            <td className="text-end text-warning">${money(p.payable_balance)}</td>
                            <td>
                              <Badge color={methodColor(p.method)}>
                                <i className={`${methodIcon(p.method)} align-middle me-1`} />
                                {methodLabel(p.method)}
                              </Badge>
                            </td>
                            <td className="small">{p.bank_account_code || '-'}</td>
                            <td><Badge color={statusColor(p.status)}>{p.status || 'ACTIVO'}</Badge></td>
                            <td>
                              <Button size="sm" color="light" onClick={() => openDetail(p)}>
                                <i className="ri-eye-line" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="table-light fw-semibold">
                        <td colSpan={5}>Total pagado ({filteredEmitidos.length} egresos)</td>
                        <td className="text-end text-success">
                          ${money(filteredEmitidos.reduce((s, p) => s + num(p.amount), 0))}
                        </td>
                        <td colSpan={5}></td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              )}
            </TabPane>

            <TabPane tabId="pendientes">
              {loadingPayables ? (
                <div className="text-center py-5"><Spinner /></div>
              ) : filteredPendientes.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="ri-check-double-line" style={{ fontSize: 48 }} />
                  <div className="mt-2">No hay CxP pendientes 🎉</div>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table className="align-middle mb-0" hover>
                    <thead>
                      <tr>
                        <th>Factura</th>
                        <th>Proveedor</th>
                        <th>Emitida</th>
                        <th>Vence</th>
                        <th>Aging</th>
                        <th className="text-end">Total</th>
                        <th className="text-end">Pagado</th>
                        <th className="text-end">Saldo</th>
                        <th style={{ width: 120 }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPendientes.map(p => {
                        const saldo = num(p.balance ?? (num(p.total) - num(p.paid_amount)));
                        return (
                          <tr key={p.id}>
                            <td className="fw-semibold">{p.document_type || 'FC'} {p.document_number}</td>
                            <td>
                              <div>{p.supplier_name || '-'}</div>
                              <div className="text-muted small">{p.supplier_document_number || ''}</div>
                            </td>
                            <td className="small">{String(p.issue_date || '').slice(0, 10)}</td>
                            <td className="small">{String(p.due_date || '').slice(0, 10)}</td>
                            <td><Badge color={agingColor(p.aging_bucket)}>{p.aging_bucket || '-'}</Badge></td>
                            <td className="text-end">${money(p.total)}</td>
                            <td className="text-end text-success">${money(p.paid_amount)}</td>
                            <td className="text-end fw-bold text-warning">${money(saldo)}</td>
                            <td>
                              <Button size="sm" color="primary" onClick={() => openNewFor(p)}>
                                <i className="ri-send-plane-line align-middle me-1" /> Pagar
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="table-light fw-semibold">
                        <td colSpan={5}>Total ({filteredPendientes.length} CxP)</td>
                        <td className="text-end">${money(filteredPendientes.reduce((s, p) => s + num(p.total), 0))}</td>
                        <td className="text-end text-success">${money(filteredPendientes.reduce((s, p) => s + num(p.paid_amount), 0))}</td>
                        <td className="text-end text-warning">
                          ${money(filteredPendientes.reduce((s, p) => s + num(p.balance ?? (num(p.total) - num(p.paid_amount))), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              )}
            </TabPane>
          </TabContent>
        </CardBody>
      </Card>

      <Offcanvas
        direction="end"
        isOpen={showNew}
        toggle={() => setShowNew(!showNew)}
        style={{ width: '95vw', maxWidth: 1180 }}
      >
        <OffcanvasHeader toggle={() => setShowNew(false)}>
          <div>
            <h5 className="mb-0">Nuevo pago a proveedor</h5>
            <small className="text-muted">Registrar pago a CxP</small>
          </div>
        </OffcanvasHeader>
        <OffcanvasBody className="px-4 py-3">
          <Row className="g-2 mb-3">
            <Col md={6}>
              <Label className="form-label">Fecha</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </Col>
            <Col md={6}>
              <Label className="form-label">Referencia</Label>
              <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Ej. N° transacción general" />
            </Col>
          </Row>

          <FormGroup>
            <Label className="d-flex justify-content-between align-items-center">
              <span>Facturas a pagar</span>
              <small className="text-muted">{applyLines.length} seleccionada{applyLines.length === 1 ? '' : 's'}</small>
            </Label>
            <Input
              placeholder="Buscar por número o proveedor..."
              value={payableSearch}
              onChange={e => setPayableSearch(e.target.value)}
              className="mb-2"
            />
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #e9ebec', borderRadius: 4 }}>
              {filteredPayablesForSearch.length === 0 ? (
                <div className="p-3 text-muted text-center small">Sin facturas pendientes</div>
              ) : filteredPayablesForSearch.map(p => {
                const saldo = num(p.balance ?? (num(p.total) - num(p.paid_amount)));
                const already = selectedPayableIds.has(String(p.id));
                return (
                  <div
                    key={p.id}
                    onClick={() => already ? removeApplyLine(p.id) : addApplyLine(p)}
                    className={`p-2 border-bottom ${already ? 'bg-soft-primary' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-2">
                        <i className={`ri-${already ? 'checkbox-circle-fill text-primary' : 'add-circle-line text-muted'}`} />
                        <span className="fw-semibold">{p.document_type || 'FC'} {p.document_number}</span>
                        {p.aging_bucket && p.aging_bucket !== 'AL DIA' && (
                          <Badge color={agingColor(p.aging_bucket)}>{p.aging_bucket}</Badge>
                        )}
                      </div>
                      <span className="text-warning fw-semibold">${money(saldo)}</span>
                    </div>
                    <div className="small text-muted">{p.supplier_name}</div>
                  </div>
                );
              })}
            </div>
          </FormGroup>

          {applyLines.length > 0 && (
            <Card className="mb-3">
              <CardBody className="py-2">
                <div className="small fw-semibold mb-2">Aplicación por factura</div>
                <Table size="sm" className="mb-0 small align-middle">
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Vence</th>
                      <th className="text-end">Saldo</th>
                      <th className="text-end" style={{ width: 140 }}>A aplicar</th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {applyLines.map(l => {
                      const today = new Date(); today.setHours(0,0,0,0);
                      const due = l.due_date ? new Date(l.due_date) : null;
                      let agingBadge: { color: string; label: string } | null = null;
                      let termBadge: number | null = null;
                      if (due) {
                        const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
                        if (diffDays < 0) agingBadge = { color: 'danger', label: `Vencida ${-diffDays}d` };
                        else if (diffDays === 0) agingBadge = { color: 'warning', label: 'Vence hoy' };
                        else if (diffDays < 15) agingBadge = { color: 'warning', label: `Por vencer ${diffDays}d` };
                        else agingBadge = { color: 'success', label: 'Al día' };
                        if (l.issue_date) {
                          const issue = new Date(l.issue_date);
                          const t = Math.round((due.getTime() - issue.getTime()) / 86400000);
                          const match = [30, 60, 90, 180].find(x => Math.abs(t - x) <= 3);
                          if (match) termBadge = match;
                        }
                      }
                      const applied = num(l.amountApplied);
                      const pctPaid = l.total > 0 ? Math.min(100, Math.round(((l.paid + applied) / l.total) * 100)) : 0;
                      const restante = Math.max(l.balance - applied, 0);
                      const esParcial = applied > 0 && applied < l.balance;
                      return (
                        <tr key={String(l.payableId)}>
                          <td>
                            <div className="d-flex flex-wrap gap-1 align-items-center">
                              <span className="fw-semibold">{l.document_type || 'FC'} {l.document_number}</span>
                              {agingBadge && <Badge color={agingBadge.color}>{agingBadge.label}</Badge>}
                              {termBadge && <Badge color="info">{termBadge}d</Badge>}
                            </div>
                            <div className="text-muted" style={{ fontSize: 11 }}>{l.supplier_name}</div>
                            <Progress value={pctPaid} color={pctPaid >= 100 ? 'success' : 'info'} style={{ height: 4, marginTop: 4 }} />
                          </td>
                          <td className="small">{String(l.due_date || '').slice(0, 10)}</td>
                          <td className="text-end">${money(l.balance)}</td>
                          <td>
                            <Input
                              bsSize="sm"
                              type="number"
                              step="0.01"
                              min={0}
                              value={l.amountApplied}
                              onChange={e => setApplyLineAmount(l.payableId, e.target.value)}
                              className="text-end"
                            />
                            {esParcial && (
                              <div className="text-info" style={{ fontSize: 10 }}>Parcial — queda ${money(restante)}</div>
                            )}
                          </td>
                          <td className="text-center">
                            <Button size="sm" color="light" onClick={() => removeApplyLine(l.payableId)} title="Quitar">
                              <i className="ri-close-line text-danger" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="table-light fw-semibold">
                      <td colSpan={3}>Total bruto a abonar</td>
                      <td className="text-end">${money(totales.bruto)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </Table>
              </CardBody>
            </Card>
          )}

          {/* Formas de pago (multi-método, tipo recibo de caja) */}
          <Card className="mb-3">
            <CardBody className="py-2">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="small fw-semibold">Formas de pago</div>
                <Button size="sm" color="light" onClick={addFormaRecaudo}>
                  <i className="ri-add-line me-1" />Agregar
                </Button>
              </div>
              {formasRecaudo.map((f, idx) => (
                <Row className="g-2 mb-2 align-items-end" key={f.id}>
                  <Col md={4}>
                    {idx === 0 && <Label className="form-label small mb-1">Método</Label>}
                    <Input
                      type="select"
                      bsSize="sm"
                      value={f.method}
                      onChange={e => updateFormaRecaudo(f.id, { method: e.target.value as PayMethod })}
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="BANK_TRANSFER">Transferencia</option>
                      <option value="CHECK">Cheque</option>
                      <option value="OTHER">Otro</option>
                    </Input>
                  </Col>
                  <Col md={5}>
                    {idx === 0 && <Label className="form-label small mb-1">Cuenta PUC (Caja/Banco)</Label>}
                    <PucPicker
                      value={f.bankAccountCode}
                      onChange={(code) => updateFormaRecaudo(f.id, { bankAccountCode: code })}
                      accounts={accounts}
                      prefixFilter={['11']}
                      placeholder={f.method === 'CASH' ? '1105' : '1110'}
                    />
                  </Col>
                  <Col md={3}>
                    {idx === 0 && <Label className="form-label small mb-1">Monto</Label>}
                    <div className="d-flex gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        bsSize="sm"
                        value={f.amount}
                        onChange={e => updateFormaRecaudo(f.id, { amount: e.target.value })}
                        className="text-end"
                      />
                      {formasRecaudo.length > 1 && (
                        <Button size="sm" color="light" onClick={() => removeFormaRecaudo(f.id)} title="Quitar">
                          <i className="ri-close-line text-danger" />
                        </Button>
                      )}
                    </div>
                  </Col>
                </Row>
              ))}
              <div className="d-flex justify-content-between border-top pt-2 mt-2 small">
                <span className="text-muted">Total recaudado</span>
                <span className={Math.abs(totales.diff) > 0.01 ? 'text-danger fw-bold' : 'fw-semibold'}>
                  ${money(totales.recaudado)} / ${money(totales.neto)}
                </span>
              </div>
              {Math.abs(totales.diff) > 0.01 && (
                <div className="text-danger small">
                  {totales.diff > 0 ? 'Sobra' : 'Falta'} ${money(Math.abs(totales.diff))} respecto al neto a girar
                </div>
              )}
            </CardBody>
          </Card>

          <FormGroup check className="mt-1 mb-3">
            <Input
              type="checkbox"
              id="pagos-gen-mov-bancario"
              checked={generarMovBancario}
              onChange={e => setGenerarMovBancario(e.target.checked)}
            />
            <Label for="pagos-gen-mov-bancario" check className="fs-13">
              Crear también movimientos en Bancos (uno por cada forma no efectivo)
            </Label>
          </FormGroup>

          {/* Retenciones practicadas al pago (comprobante de egreso) */}
          <Card className="mb-3 border-secondary-subtle">
            <CardBody className="py-2">
              <div
                className="d-flex justify-content-between align-items-center"
                style={{ cursor: 'pointer' }}
                onClick={() => setShowRetenciones(v => !v)}
              >
                <div>
                  <strong className="small">Retenciones practicadas al pago</strong>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    Opcional — se acreditan en el comprobante de egreso
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {totales.retTotal > 0 && (
                    <Badge color="info">-${money(totales.retTotal)}</Badge>
                  )}
                  <i className={`ri-arrow-${showRetenciones ? 'up' : 'down'}-s-line`} />
                </div>
              </div>

              {showRetenciones && (
                <div className="mt-3">
                  <Row className="g-2 mb-2 align-items-end">
                    <Col md={7}>
                      <Label className="form-label small mb-1">PUC Retefuente</Label>
                      <PucPicker
                        value={form.retefuenteCode}
                        onChange={(code) => setForm(f => ({ ...f, retefuenteCode: code }))}
                        accounts={accounts}
                        prefixFilter={['2365', '2367']}
                        placeholder="236540"
                      />
                    </Col>
                    <Col md={5}>
                      <Label className="form-label small mb-1">Monto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.retefuenteAmount}
                        onChange={e => setForm(f => ({ ...f, retefuenteAmount: e.target.value }))}
                        placeholder="0"
                      />
                    </Col>
                  </Row>
                  <Row className="g-2 mb-2 align-items-end">
                    <Col md={7}>
                      <Label className="form-label small mb-1">PUC ReteICA</Label>
                      <PucPicker
                        value={form.reteicaCode}
                        onChange={(code) => setForm(f => ({ ...f, reteicaCode: code }))}
                        accounts={accounts}
                        prefixFilter={['2368']}
                        placeholder="236801"
                      />
                    </Col>
                    <Col md={5}>
                      <Label className="form-label small mb-1">Monto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.reteicaAmount}
                        onChange={e => setForm(f => ({ ...f, reteicaAmount: e.target.value }))}
                        placeholder="0"
                      />
                    </Col>
                  </Row>
                  <Row className="g-2 mb-1 align-items-end">
                    <Col md={7}>
                      <Label className="form-label small mb-1">PUC ReteIVA</Label>
                      <PucPicker
                        value={form.reteivaCode}
                        onChange={(code) => setForm(f => ({ ...f, reteivaCode: code }))}
                        accounts={accounts}
                        prefixFilter={['2367']}
                        placeholder="236703"
                      />
                    </Col>
                    <Col md={5}>
                      <Label className="form-label small mb-1">Monto</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.reteivaAmount}
                        onChange={e => setForm(f => ({ ...f, reteivaAmount: e.target.value }))}
                        placeholder="0"
                      />
                    </Col>
                  </Row>
                </div>
              )}
            </CardBody>
          </Card>

          <FormGroup>
            <Label>Observaciones</Label>
            <Input
              type="textarea"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </FormGroup>

          {applyLines.length > 0 && totales.bruto > 0 && (
            <div className="alert alert-info py-2 small">
              {totales.retTotal > 0 ? (
                <>
                  Bruto abonado: <strong>${money(totales.bruto)}</strong>{' '}
                  · Retenciones: <strong>-${money(totales.retTotal)}</strong>{' '}
                  · <span className="text-success">Neto girado: <strong>${money(totales.neto)}</strong></span>
                  <div>
                    {applyLines.length === 1
                      ? `Factura ${applyLines[0].document_type || 'FC'} ${applyLines[0].document_number || ''} de ${applyLines[0].supplier_name || ''}.`
                      : `${applyLines.length} facturas aplicadas.`}
                  </div>
                </>
              ) : (
                <>
                  {applyLines.length === 1
                    ? <>Se pagará <strong>${money(totales.bruto)}</strong> a la factura <strong>{applyLines[0].document_type || 'FC'} {applyLines[0].document_number}</strong> de <strong>{applyLines[0].supplier_name}</strong>.</>
                    : <>Se abonará <strong>${money(totales.bruto)}</strong> a <strong>{applyLines.length}</strong> facturas.</>}
                </>
              )}
            </div>
          )}

          <div className="d-flex gap-2 mt-3">
            <Button color="light" onClick={() => setShowNew(false)} disabled={savingNew}>Cancelar</Button>
            <Button color="primary" size="lg" className="flex-grow-1" onClick={submit} disabled={savingNew}>
              {savingNew ? <Spinner size="sm" /> : <><i className="ri-check-line align-middle me-1" /> Confirmar pago</>}
            </Button>
          </div>
        </OffcanvasBody>
      </Offcanvas>

      <Offcanvas isOpen={showDetail} toggle={() => setShowDetail(false)} direction="end" style={{ width: 600 }}>
        <OffcanvasHeader toggle={() => setShowDetail(false)}>
          {detail ? `Comprobante ${detail.application.source_number}` : 'Detalle del pago'}
        </OffcanvasHeader>
        <OffcanvasBody>
          {loadingDetail || !detail ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : (
            <div>
              <div className="mb-3">
                <Badge color={statusColor(detail.application.status)} className="fs-13">{detail.application.status}</Badge>
                {detail.application.status === 'ANULADO' && detail.application.void_reason && (
                  <div className="small text-danger mt-1">
                    Motivo: {detail.application.void_reason}
                    {detail.application.voided_at ? ` · ${String(detail.application.voided_at).slice(0,19).replace('T',' ')}` : ''}
                  </div>
                )}
              </div>

              <Card className="mb-3">
                <CardBody>
                  <h6 className="mb-3">Proveedor y factura</h6>
                  <Row className="g-2 small">
                    <Col xs={12}><span className="text-muted">Proveedor:</span> <strong>{detail.payable.supplier_name}</strong></Col>
                    <Col xs={6}><span className="text-muted">{detail.payable.supplier_document_type || 'NIT'}:</span> {detail.payable.supplier_document_number || '-'}</Col>
                    <Col xs={6}><span className="text-muted">Factura:</span> <strong>{detail.payable.document_type} {detail.payable.document_number}</strong></Col>
                    <Col xs={6}><span className="text-muted">Emitida:</span> {String(detail.payable.issue_date || '').slice(0,10)}</Col>
                    <Col xs={6}><span className="text-muted">Vence:</span> {String(detail.payable.due_date || '').slice(0,10)}</Col>
                    <Col xs={6}><span className="text-muted">Total factura:</span> ${money(detail.payable.total)}</Col>
                    <Col xs={6}><span className="text-muted">Saldo actual:</span> <span className="fw-semibold text-warning">${money(detail.payable.balance)}</span></Col>
                  </Row>
                </CardBody>
              </Card>

              <Card className="mb-3">
                <CardBody>
                  <h6 className="mb-1">Pago</h6>
                  <small className="text-muted d-block mb-2">
                    Comprobante de egreso. Las retenciones practicadas aquí se acreditan a la DIAN/municipio.
                  </small>
                  {(() => {
                    const retF = num(detail.application.withholding_source_amount);
                    const retI = num(detail.application.withholding_ica_amount);
                    const retV = num(detail.application.withholding_vat_amount);
                    const retTotal = retF + retI + retV;
                    const gross = num(detail.application.gross_amount) || (num(detail.application.amount) + retTotal);
                    return (
                      <Table size="sm" className="mb-0">
                        <tbody>
                          <tr><td>Total factura</td><td className="text-end">${money(detail.payable.total)}</td></tr>
                          <tr><td>Saldo antes del pago</td><td className="text-end">${money(detail.payable.balance + gross)}</td></tr>
                          <tr className="fw-semibold"><td>Bruto pagado (disminuye CxP)</td><td className="text-end">${money(gross)}</td></tr>
                          {retF > 0 && <tr className="text-info"><td>Retefuente practicada ({detail.application.withholding_source_code || '-'})</td><td className="text-end">-${money(retF)}</td></tr>}
                          {retI > 0 && <tr className="text-info"><td>ReteICA practicada ({detail.application.withholding_ica_code || '-'})</td><td className="text-end">-${money(retI)}</td></tr>}
                          {retV > 0 && <tr className="text-info"><td>ReteIVA practicada ({detail.application.withholding_vat_code || '-'})</td><td className="text-end">-${money(retV)}</td></tr>}
                          <tr className="fw-bold table-light">
                            <td>NETO GIRADO</td>
                            <td className="text-end text-success">${money(detail.application.amount)}</td>
                          </tr>
                          <tr><td>Saldo después del pago</td><td className="text-end text-warning">${money(detail.payable.balance)}</td></tr>
                        </tbody>
                      </Table>
                    );
                  })()}
                </CardBody>
              </Card>

              {(detail.payable.subtotal > 0 || detail.payable.tax > 0 || detail.payable.retefuente > 0 || detail.payable.reteica > 0 || detail.payable.reteiva > 0) && (
                <Card className="mb-3 border-secondary-subtle">
                  <CardBody>
                    <h6 className="mb-1">Datos de la factura original</h6>
                    <small className="text-muted d-block mb-2">
                      Valores contabilizados al <strong>causar</strong> la factura {detail.payable.document_type} {detail.payable.document_number} (no al pagar).
                    </small>
                    <Table size="sm" className="mb-0">
                      <tbody>
                        <tr><td>Subtotal</td><td className="text-end">${money(detail.payable.subtotal)}</td></tr>
                        <tr><td>IVA descontable</td><td className="text-end">${money(detail.payable.tax)}</td></tr>
                        {detail.payable.retefuente > 0 && <tr className="text-info"><td>Retefuente practicada</td><td className="text-end">-${money(detail.payable.retefuente)}</td></tr>}
                        {detail.payable.reteica > 0 && <tr className="text-info"><td>ReteICA practicada</td><td className="text-end">-${money(detail.payable.reteica)}</td></tr>}
                        {detail.payable.reteiva > 0 && <tr className="text-info"><td>ReteIVA practicada</td><td className="text-end">-${money(detail.payable.reteiva)}</td></tr>}
                        <tr className="fw-semibold">
                          <td>Neto por pagar (factura)</td>
                          <td className="text-end">${money(detail.payable.total)}</td>
                        </tr>
                      </tbody>
                    </Table>
                  </CardBody>
                </Card>
              )}

              <Card className="mb-3">
                <CardBody>
                  <h6 className="mb-3">Medio de pago</h6>
                  <Row className="g-2 small">
                    <Col xs={6}><span className="text-muted">Fecha:</span> {String(detail.application.date || '').slice(0,10)}</Col>
                    <Col xs={6}><span className="text-muted">Método:</span> <Badge color={methodColor(detail.application.method)}><i className={`${methodIcon(detail.application.method)} me-1`} />{methodLabel(detail.application.method)}</Badge></Col>
                    {String(detail.application.method || '').toUpperCase() === 'MIXTO'
                      && Array.isArray((detail.application as any).paymentMethods)
                      && (detail.application as any).paymentMethods.length > 0 ? (
                      <Col xs={12}>
                        <div className="text-muted mb-1">Desglose de formas de pago:</div>
                        <Table size="sm" className="mb-0 small">
                          <thead className="table-light">
                            <tr>
                              <th>Método</th>
                              <th>Cuenta PUC</th>
                              <th className="text-end">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {((detail.application as any).paymentMethods as any[]).map((m: any, i: number) => (
                              <tr key={i}>
                                <td>{methodLabel(m.method)}</td>
                                <td className="font-monospace">{m.bankAccountCode || m.bank_account_code || '-'}</td>
                                <td className="text-end font-monospace">${money(Number(m.amount || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </Col>
                    ) : (
                      <Col xs={12}><span className="text-muted">Cuenta bancaria (PUC):</span> {detail.application.bank_account_code || '-'}</Col>
                    )}
                    <Col xs={12}><span className="text-muted">Referencia:</span> {detail.application.reference || '-'}</Col>
                    <Col xs={12}><span className="text-muted">Observaciones:</span> {detail.application.notes || '-'}</Col>
                  </Row>
                </CardBody>
              </Card>

              {detail.journal.lines.length > 0 && (
                <Card className="mb-3">
                  <CardBody>
                    <h6 className="mb-3">Asiento contable</h6>
                    <Table size="sm" className="small mb-0">
                      <thead>
                        <tr>
                          <th>Cuenta</th>
                          <th>Descripción</th>
                          <th className="text-end">Débito</th>
                          <th className="text-end">Crédito</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.journal.lines.map((l, i) => (
                          <tr key={i}>
                            <td><code>{l.account_code}</code><div className="text-muted" style={{ fontSize: 11 }}>{l.account_name}</div></td>
                            <td style={{ fontSize: 11 }}>{l.description}</td>
                            <td className="text-end">{num(l.debit) > 0 ? `$${money(l.debit)}` : ''}</td>
                            <td className="text-end">{num(l.credit) > 0 ? `$${money(l.credit)}` : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </CardBody>
                </Card>
              )}

              <div className="d-flex gap-2">
                <Button color="danger" outline onClick={downloadPaymentPDF}>
                  <i className="ri-file-pdf-2-line align-middle me-1" /> Descargar PDF
                </Button>
                {detail.application.status === 'ACTIVO' && (
                  <Button color="danger" outline onClick={doVoid} disabled={voiding}>
                    {voiding ? <Spinner size="sm" /> : <><i className="ri-close-circle-line align-middle me-1" /> Anular pago</>}
                  </Button>
                )}
                <Button color="light" className="ms-auto" onClick={() => setShowDetail(false)}>Cerrar</Button>
              </div>
            </div>
          )}
        </OffcanvasBody>
      </Offcanvas>
    </div>
  );
};

export default Pagos;
