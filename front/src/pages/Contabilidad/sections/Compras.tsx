import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ConfigGuardBanner from '../ConfigGuardBanner';
import CompraTab from '../../income/SalesInvoice/tabs/CompraTab';
import type { DocumentConfig } from '../../income/SalesInvoice/Create';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Offcanvas,
  OffcanvasBody,
  OffcanvasHeader,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import { API_BASE, money, useAuthHeaders, normalizeAccount } from '../shared';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import PucPicker from '../../../Components/Contabilidad/PucPicker';
import SupplierPicker from '../../../Components/Contabilidad/SupplierPicker';
import TipoDocumentoSelect from '../../../Components/Contabilidad/TipoDocumentoSelect';

type PurchaseLine = {
  id: string;
  expense_account_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  iva_pct: number;
  rf_pct: number;
};

type APRow = {
  id: number;
  supplier_name?: string;
  supplier_document_number?: string;
  supplier_document_type?: string;
  document_type?: string;
  document_prefix?: string;
  document_number?: string;
  issue_date?: string;
  due_date?: string;
  original_amount?: number | string;
  paid_amount?: number | string;
  balance_amount?: number | string;
  status?: string;
  expense_account_code?: string;
  notes?: string;
  cost_center?: string;
  reteiva_pct?: number | string;
  reteica_pct?: number | string;
  items?: PurchaseLine[];
  payments?: any[];
};

type Supplier = {
  id: number;
  name: string;
  document_number: string;
  document_type?: string;
  kind?: string;
};

type Account = {
  id: number;
  code: string;
  name: string;
  account_type?: string;
};

const DOC_TYPES = ['NIT', 'CC', 'CE', 'PP'];

// TODO: backend — cuando exista API de centros de costo, reemplazar por fetch real
const COST_CENTERS = ['General', 'Operación', 'Administración'];

const STATUS_COLORS: Record<string, string> = {
  pending: 'warning',
  pendiente: 'warning',
  paid: 'success',
  pagada: 'success',
  overdue: 'danger',
  vencida: 'danger',
  partial: 'info',
  parcial: 'info',
  cancelled: 'secondary',
  anulada: 'secondary',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  pendiente: 'Pendiente',
  paid: 'Pagada',
  pagada: 'Pagada',
  overdue: 'Vencida',
  vencida: 'Vencida',
  partial: 'Parcial',
  parcial: 'Parcial',
  cancelled: 'Anulada',
  anulada: 'Anulada',
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const firstOfMonthIso = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const addDaysIso = (base: string, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const isOverdue = (r: APRow) => {
  if (!r.due_date) return false;
  const bal = Number(r.balance_amount || 0);
  if (bal <= 0) return false;
  return new Date(r.due_date) < new Date(todayIso());
};

const effectiveStatus = (r: APRow) => {
  const raw = (r.status || '').toLowerCase();
  if (raw === 'paid' || raw === 'pagada') return 'paid';
  if (raw === 'cancelled' || raw === 'anulada') return 'cancelled';
  if (isOverdue(r)) return 'overdue';
  const bal = Number(r.balance_amount || 0);
  const paid = Number(r.paid_amount || 0);
  const total = Number(r.original_amount || 0);
  if (paid > 0 && bal > 0 && paid < total) return 'partial';
  return 'pending';
};

const newLineId = () =>
  `l_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const emptyLine = (): PurchaseLine => ({
  id: newLineId(),
  expense_account_code: '',
  description: '',
  quantity: 1,
  unit_price: 0,
  discount_pct: 0,
  iva_pct: 19,
  rf_pct: 0,
});

type LineComputed = {
  subtotal: number;
  discount: number;
  base: number;
  iva: number;
  rf: number;
  total: number;
};

const computeLine = (l: PurchaseLine): LineComputed => {
  const qty = Number(l.quantity) || 0;
  const unit = Number(l.unit_price) || 0;
  const subtotal = qty * unit;
  const discount = subtotal * ((Number(l.discount_pct) || 0) / 100);
  const base = subtotal - discount;
  const iva = base * ((Number(l.iva_pct) || 0) / 100);
  const rf = base * ((Number(l.rf_pct) || 0) / 100);
  const total = base + iva - rf;
  return { subtotal, discount, base, iva, rf, total };
};

type FormState = {
  supplier_name: string;
  supplier_document_type: string;
  supplier_document_number: string;
  document_type: string;
  document_prefix: string;
  document_number: string;
  internal_number: string;
  issue_date: string;
  due_date: string;
  payment_form: string;
  credit_term_days: string;
  payment_method: string;
  cost_center: string;
  notes: string;
  reteiva_pct: string;
  reteica_pct: string;
  items: PurchaseLine[];
};

const emptyForm = (): FormState => ({
  supplier_name: '',
  supplier_document_type: 'NIT',
  supplier_document_number: '',
  document_type: 'FC',
  document_prefix: '',
  document_number: '',
  internal_number: '',
  issue_date: todayIso(),
  due_date: addDaysIso(todayIso(), 30),
  payment_form: 'Credito',
  credit_term_days: '30',
  payment_method: '',
  cost_center: 'General',
  notes: '',
  reteiva_pct: '0',
  reteica_pct: '0',
  items: [emptyLine()],
});

const Compras: React.FC = () => {
  const headers = useAuthHeaders();

  const [rows, setRows] = useState<APRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(firstOfMonthIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPayable, setEditingPayable] = useState<APRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    document_type: 'NIT',
    document_number: '',
    name: '',
    email: '',
    phone: '',
    city: '',
    address: '',
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<APRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [banks, setBanks] = useState<any[]>([]);
  const [payForm, setPayForm] = useState({
    amount: '',
    date: todayIso(),
    method: 'BANK_TRANSFER' as 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER',
    bankAccountCode: '',
    reference: '',
    notes: '',
  });
  const [payingNow, setPayingNow] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Alta rápida de banco inline
  const [showNewBank, setShowNewBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [newBank, setNewBank] = useState({
    name: '',
    account_type: 'ahorros',
    account_number: '',
    account_code: '111005',
    branch: '',
    is_default: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        startDate,
        endDate,
        documentType: 'FACTURA_PROVEEDOR',
      });
      if (statusFilter) qs.append('status', statusFilter);
      const q = search.trim();
      if (q) qs.append('supplierSearch', q);
      const res = await fetch(`${API_BASE}/accounting/accounts-payable?${qs.toString()}`, { headers });
      const data = await res.json();
      const list = data?.payables || data?.accountsPayable || [];
      if (data?.success && Array.isArray(list)) {
        setRows(list);
      } else {
        setRows([]);
      }
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, startDate, endDate, statusFilter, search]);

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/third-parties`, { headers });
      const data = await res.json();
      const list = data?.thirdParties || data?.third_parties || data?.data || [];
      if (Array.isArray(list)) setSuppliers(list);
    } catch {
      setSuppliers([]);
    }
  }, [headers]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/chart-of-accounts`, { headers });
      const data = await res.json();
      const list = data?.accounts || data?.chartOfAccounts || data?.data || [];
      if (Array.isArray(list)) setAccounts(list.map(normalizeAccount));
    } catch {
      setAccounts([]);
    }
  }, [headers]);

  // Debounce de 300ms para no pegarle al backend en cada tecla del search
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    loadSuppliers();
    loadAccounts();
  }, [loadSuppliers, loadAccounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay =
          (r.supplier_name || '').toLowerCase() +
          ' ' +
          (r.supplier_document_number || '').toLowerCase() +
          ' ' +
          (r.document_number || '').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search]);

  const kpis = useMemo(() => {
    let total = 0;
    let pagado = 0;
    let pendiente = 0;
    let vencido = 0;
    filtered.forEach((r) => {
      const t = Number(r.original_amount || 0);
      const p = Number(r.paid_amount || 0);
      const b = Number(r.balance_amount || 0);
      total += t;
      pagado += p;
      pendiente += b;
      if (isOverdue(r)) vencido += b;
    });
    return { total, pagado, pendiente, vencido };
  }, [filtered]);

  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          (a.account_type || '').toUpperCase() === 'GASTO' ||
          (a.code || '').startsWith('5') ||
          (a.code || '').startsWith('6'),
      ),
    [accounts],
  );

  // Totales de formulario (líneas + retenciones globales)
  const formTotals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let baseTotal = 0;
    let ivaTotal = 0;
    let rfTotal = 0;
    form.items.forEach((l) => {
      const c = computeLine(l);
      subtotal += c.subtotal;
      discountTotal += c.discount;
      baseTotal += c.base;
      ivaTotal += c.iva;
      rfTotal += c.rf;
    });
    const reteIva = ivaTotal * ((Number(form.reteiva_pct) || 0) / 100);
    // ReteICA se maneja por mil (Ej: 7.00 x 1000 = 0.007)
    const reteIca = baseTotal * ((Number(form.reteica_pct) || 0) / 1000);
    const totalAPagar = baseTotal + ivaTotal - rfTotal - reteIva - reteIca;
    return {
      subtotal,
      discountTotal,
      baseTotal,
      ivaTotal,
      rfTotal,
      reteIva,
      reteIca,
      totalAPagar,
    };
  }, [form.items, form.reteiva_pct, form.reteica_pct]);

  const canSave = useMemo(() => {
    const hasValidLine = form.items.some(
      (l) =>
        l.expense_account_code.trim() &&
        Number(l.quantity) > 0 &&
        Number(l.unit_price) > 0,
    );
    return (
      form.supplier_name.trim() &&
      form.supplier_document_number.trim() &&
      form.document_number.trim() &&
      form.issue_date &&
      form.due_date &&
      hasValidLine &&
      formTotals.totalAPagar > 0
    );
  }, [form, formTotals.totalAPagar]);

  const onSupplierPick = (value: string) => {
    setForm((f) => ({ ...f, supplier_name: value }));
    const match = suppliers.find(
      (s) => s.name.toLowerCase() === value.toLowerCase() || s.document_number === value,
    );
    if (match) {
      setForm((f) => ({
        ...f,
        supplier_name: match.name,
        supplier_document_number: match.document_number,
        supplier_document_type: match.document_type || f.supplier_document_type,
      }));
      setShowNewSupplier(false);
    }
  };

  const setLineField = (lineId: string, patch: Partial<PurchaseLine>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    }));
  };

  const addLine = () =>
    setForm((f) => ({ ...f, items: [...f.items, emptyLine()] }));

  const removeLine = (lineId: string) =>
    setForm((f) => ({
      ...f,
      items: f.items.length <= 1 ? f.items : f.items.filter((l) => l.id !== lineId),
    }));

  const onLineAccountPick = (lineId: string, value: string) => {
    const match = accounts.find(
      (a) => a.code === value || `${a.code} - ${a.name}` === value || a.name.toLowerCase() === value.toLowerCase(),
    );
    setLineField(lineId, { expense_account_code: match ? match.code : value });
  };

  const createSupplier = async () => {
    const { name, document_number } = newSupplier;
    if (!name.trim() || !document_number.trim()) {
      setSupplierError('Nombre y número de documento son obligatorios.');
      return;
    }
    setSavingSupplier(true);
    setSupplierError(null);
    try {
      const res = await fetch(`${API_BASE}/accounting/third-parties`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...newSupplier, kind: 'SUPPLIER' }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || `Error ${res.status}`);
      }
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || 'Respuesta inválida del servidor');
      // éxito: autopoblar el form padre con el proveedor recién creado
      setForm((f) => ({
        ...f,
        supplier_name: newSupplier.name,
        supplier_document_type: newSupplier.document_type,
        supplier_document_number: newSupplier.document_number,
      }));
      await loadSuppliers();
      setShowNewSupplier(false);
      setNewSupplier({
        document_type: 'NIT',
        document_number: '',
        name: '',
        email: '',
        phone: '',
        city: '',
        address: '',
      });
    } catch (e: any) {
      setSupplierError(e?.message || 'Error inesperado');
    } finally {
      setSavingSupplier(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Primera línea con cuenta válida → se usa como cuenta principal para compat con backend actual.
      const primary =
        form.items.find((l) => l.expense_account_code.trim()) || form.items[0];

      // Número de documento completo (prefijo + número) para backend que espera un solo campo
      const fullDocNumber = form.document_prefix.trim()
        ? `${form.document_prefix.trim()}-${form.document_number.trim()}`
        : form.document_number.trim();

      const payload: Record<string, any> = {
        // --- Campos que el backend actual ya consume (camelCase) ---
        supplierName: form.supplier_name,
        supplierDocumentType: form.supplier_document_type,
        supplierDocumentNumber: form.supplier_document_number,
        documentType: form.document_type || 'FACTURA_PROVEEDOR',
        documentNumber: fullDocNumber,
        issueDate: form.issue_date,
        dueDate: form.due_date,
        paymentForm: form.payment_form,
        creditTermDays: form.payment_form === 'Credito' ? Number(form.credit_term_days) || 30 : 0,
        paymentMethod: form.payment_method || null,
        internalNumber: form.internal_number || null,
        amount: Number(formTotals.totalAPagar.toFixed(2)),
        subtotalAmount: Number(formTotals.subtotal.toFixed(2)),
        taxAmount: Number(formTotals.ivaTotal.toFixed(2)),
        withholdingSourceAmount: Number(formTotals.rfTotal.toFixed(2)),
        withholdingIcaAmount: Number(formTotals.reteIca.toFixed(2)),
        withholdingVatAmount: Number(formTotals.reteIva.toFixed(2)),
        expenseAccountCode: primary?.expense_account_code || '',
        expenseAccountName: primary
          ? (accounts.find((a) => a.code === primary.expense_account_code)?.name || '')
          : '',
        notes: form.notes,

        // --- Campos extra (el backend los ignora hoy; cuando se implemente, los consume) ---
        // TODO: backend — aceptar estos campos y generar asientos por línea con IVA descontable y retenciones
        document_prefix: form.document_prefix || null,
        cost_center: form.cost_center || null,
        subtotal: Number(formTotals.subtotal.toFixed(2)),
        discount_total: Number(formTotals.discountTotal.toFixed(2)),
        base_total: Number(formTotals.baseTotal.toFixed(2)),
        iva_total: Number(formTotals.ivaTotal.toFixed(2)),
        rete_fuente_total: Number(formTotals.rfTotal.toFixed(2)),
        rete_iva_pct: Number(form.reteiva_pct) || 0,
        rete_iva_total: Number(formTotals.reteIva.toFixed(2)),
        rete_ica_pct: Number(form.reteica_pct) || 0,
        rete_ica_total: Number(formTotals.reteIca.toFixed(2)),
        total_to_pay: Number(formTotals.totalAPagar.toFixed(2)),
        items: form.items.map((l) => {
          const c = computeLine(l);
          return {
            expense_account_code: l.expense_account_code,
            description: l.description,
            quantity: Number(l.quantity) || 0,
            unit_price: Number(l.unit_price) || 0,
            discount_pct: Number(l.discount_pct) || 0,
            iva_pct: Number(l.iva_pct) || 0,
            rf_pct: Number(l.rf_pct) || 0,
            subtotal: Number(c.subtotal.toFixed(2)),
            discount: Number(c.discount.toFixed(2)),
            base: Number(c.base.toFixed(2)),
            iva: Number(c.iva.toFixed(2)),
            rf: Number(c.rf.toFixed(2)),
            total: Number(c.total.toFixed(2)),
          };
        }),
      };

      const isEdit = editingId != null;
      const url = isEdit
        ? `${API_BASE}/accounting/accounts-payable/${editingId}`
        : `${API_BASE}/accounting/accounts-payable`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data?.success ?? true)) {
        setCreateOpen(false);
        setEditingId(null);
        setForm(emptyForm());
        setShowNewSupplier(false);
        load();
        await Swal.fire({
          icon: 'success',
          title: isEdit ? 'Factura de compra actualizada' : 'Factura de compra creada',
          text: data?.payable?.document_number ? `Número: ${data.payable.document_number}` : undefined,
          confirmButtonColor: '#1A1D1F',
          timer: 1800,
        });
      } else {
        const msg = data?.error || data?.message || `Error ${res.status}: no se pudo guardar la factura.`;
        await Swal.fire({
          icon: 'error',
          title: isEdit ? 'No se pudo actualizar la factura' : 'No se pudo guardar la factura',
          text: msg,
          confirmButtonColor: '#1A1D1F',
        });
      }
    } catch (e: any) {
      await Swal.fire({
        icon: 'error',
        title: 'Error de red al guardar',
        text: e?.message || 'Revisá tu conexión e intenta de nuevo.',
        confirmButtonColor: '#1A1D1F',
      });
    } finally {
      setSaving(false);
    }
  };

  const goToPayments = (id: number) => {
    window.location.href = `/contabilidad/pagos?id=${id}`;
  };

  const loadBanks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/banks`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setBanks(data?.banks || data?.data || []);
    } catch { /* noop */ }
  }, [headers]);

  const createBank = async () => {
    setBankError(null);
    if (!newBank.name.trim()) { setBankError('Seleccioná el banco'); return; }
    setSavingBank(true);
    try {
      const res = await fetch(`${API_BASE}/accounting/banks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newBank),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Error ${res.status}`);
      }
      const created = data?.bank;
      await loadBanks();
      if (created?.account_code) {
        setPayForm((f) => ({ ...f, bankAccountCode: created.account_code }));
      }
      setShowNewBank(false);
      setNewBank({
        name: '',
        account_type: 'ahorros',
        account_number: '',
        account_code: '111005',
        branch: '',
        is_default: false,
      });
    } catch (e: any) {
      setBankError(e?.message || 'No se pudo crear el banco');
    } finally {
      setSavingBank(false);
    }
  };

  useEffect(() => { loadBanks(); }, [loadBanks]);

  const openEdit = (r: APRow) => {
    if (Number(r.paid_amount || 0) > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No se puede editar',
        text: 'La factura ya tiene pagos aplicados. Anulá el pago primero desde el detalle de la factura.',
        confirmButtonColor: '#1A1D1F',
      });
      return;
    }
    const total = Number(r.original_amount || 0);
    const subtotal = Number((r as any).subtotal_amount ?? 0);
    const tax = Number((r as any).tax_amount ?? 0);
    const rfTotal = Number((r as any).withholding_source_amount ?? 0);
    const reteIvaTotal = Number((r as any).withholding_vat_amount ?? 0);
    const reteIcaTotal = Number((r as any).withholding_ica_amount ?? 0);

    const baseForLine = subtotal > 0 ? subtotal : Math.max(total - tax + rfTotal + reteIvaTotal + reteIcaTotal, 0);
    const ivaPct = baseForLine > 0 && tax > 0 ? (tax / baseForLine) * 100 : 0;
    const rfPct = baseForLine > 0 && rfTotal > 0 ? (rfTotal / baseForLine) * 100 : 0;
    const reteIvaPct = tax > 0 && reteIvaTotal > 0 ? (reteIvaTotal / tax) * 100 : 0;
    const reteIcaPct = baseForLine > 0 && reteIcaTotal > 0 ? (reteIcaTotal / baseForLine) * 1000 : 0;

    const incomingItems = Array.isArray(r.items) && r.items.length > 0
      ? r.items.map((l: any) => ({
          id: l.id ? String(l.id) : newLineId(),
          expense_account_code: l.expense_account_code || r.expense_account_code || '',
          description: l.description || r.notes || '',
          quantity: Number(l.quantity) || 1,
          unit_price: Number(l.unit_price) || 0,
          discount_pct: Number(l.discount_pct) || 0,
          iva_pct: Number(l.iva_pct) || 0,
          rf_pct: Number(l.rf_pct) || 0,
        }))
      : [{
          id: newLineId(),
          expense_account_code: r.expense_account_code || '',
          description: r.notes || `Factura ${r.document_number || ''}`.trim(),
          quantity: 1,
          unit_price: Number(baseForLine.toFixed(2)),
          discount_pct: 0,
          iva_pct: Number(ivaPct.toFixed(2)),
          rf_pct: Number(rfPct.toFixed(2)),
        }];

    const docNumber = r.document_number || '';
    let docPrefix = r.document_prefix || '';
    let docNumberOnly = docNumber;
    if (!docPrefix && docNumber.includes('-')) {
      const parts = docNumber.split('-');
      docPrefix = parts.shift() || '';
      docNumberOnly = parts.join('-');
    }

    setForm({
      supplier_name: r.supplier_name || '',
      supplier_document_type: r.supplier_document_type || 'NIT',
      supplier_document_number: r.supplier_document_number || '',
      document_type: r.document_type || 'FC',
      document_prefix: docPrefix,
      document_number: docNumberOnly,
      issue_date: (r.issue_date || '').slice(0, 10) || todayIso(),
      due_date: (r.due_date || '').slice(0, 10) || todayIso(),
      payment_form: (r as any).payment_form || 'Credito',
      credit_term_days: String((r as any).credit_term_days ?? 30),
      payment_method: (r as any).payment_method || '',
      internal_number: String((r as any).internal_number || ''),
      cost_center: r.cost_center || 'General',
      notes: r.notes || '',
      reteiva_pct: reteIvaPct ? String(Number(reteIvaPct.toFixed(2))) : '0',
      reteica_pct: reteIcaPct ? String(Number(reteIcaPct.toFixed(2))) : '0',
      items: incomingItems,
    });
    setEditingId(r.id);
    setEditingPayable(r);
    setDetailOpen(false);
    setCreateOpen(true);
  };

  const openDetail = async (r: APRow) => {
    setDetail(r);
    setDetailOpen(true);
    setDetailLoading(true);
    const saldo = Number(r.balance_amount ?? (Number(r.original_amount || 0) - Number(r.paid_amount || 0)));
    setPayForm({
      amount: saldo > 0 ? saldo.toFixed(2) : '',
      date: todayIso(),
      method: 'BANK_TRANSFER',
      bankAccountCode: '',
      reference: '',
      notes: '',
    });
    setPayError(null);
    try {
      const res = await fetch(`${API_BASE}/accounting/accounts-payable/${r.id}`, { headers });
      const data = await res.json();
      const full = data?.payable || data?.data || data;
      if (full) setDetail({ ...r, ...full });
    } catch { /* noop */ }
    finally {
      setDetailLoading(false);
    }
  };

  const voidInvoice = async (r: APRow) => {
    if (Number(r.paid_amount || 0) > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No se puede anular',
        text: 'La factura tiene pagos aplicados. Anula los pagos primero.',
        confirmButtonColor: '#1A1D1F',
      });
      return;
    }
    const { value: reason, isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: '¿Anular factura?',
      text: 'Se reversará el asiento contable. Esta acción no se puede deshacer.',
      input: 'text',
      inputLabel: 'Motivo (opcional)',
      inputPlaceholder: 'Ej: error de digitación, factura duplicada, etc.',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/accounting/accounts-payable/${r.id}/void`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      Swal.fire({ icon: 'success', title: 'Factura anulada', confirmButtonColor: '#1A1D1F', timer: 1800 });
      setDetailOpen(false);
      load();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo anular', text: e?.message || 'Error desconocido', confirmButtonColor: '#1A1D1F' });
    }
  };

  const applyPayment = async () => {
    if (!detail) return;
    const saldo = Number(detail.balance_amount ?? (Number(detail.original_amount || 0) - Number(detail.paid_amount || 0)));
    const amt = Number(payForm.amount || 0);
    setPayError(null);
    if (!amt || amt <= 0) { setPayError('Monto inválido'); return; }
    if (amt > saldo + 0.01) { setPayError('El monto supera el saldo pendiente'); return; }
    if (payForm.method !== 'CASH' && !payForm.bankAccountCode) { setPayError('Cuenta bancaria requerida'); return; }

    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Confirmar pago',
      html: `Vas a registrar un pago de <strong>$${money(amt)}</strong> a <strong>${detail.supplier_name}</strong> por la factura <strong>${detail.document_number}</strong>.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, pagar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A1D1F',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;

    setPayingNow(true);
    try {
      const res = await fetch(`${API_BASE}/accounting/accounts-payable/apply-payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          payableId: detail.id,
          amount: amt,
          paymentDate: payForm.date,
          paymentMethod: payForm.method,
          bankAccountCode: payForm.bankAccountCode || undefined,
          reference: payForm.reference || undefined,
          notes: payForm.notes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `Error ${res.status}`);
      }
      // Registrar también el movimiento bancario auxiliar (sin duplicar asiento)
      if (payForm.method !== 'CASH' && payForm.bankAccountCode) {
        const selectedBank = banks.find((b: any) => b.account_code === payForm.bankAccountCode);
        if (selectedBank?.id) {
          try {
            await fetch(`${API_BASE}/accounting/bank-transactions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                bankId: selectedBank.id,
                transactionDate: payForm.date,
                description: `Pago ${detail.document_number} - ${detail.supplier_name}`,
                reference: payForm.reference || detail.document_number || undefined,
                transactionType: 'CARGO',
                amount: amt,
                source: 'PAGO_CXP',
                skipJournal: true,
                notes: payForm.notes || undefined,
              }),
            });
          } catch { /* noop — el pago ya quedó registrado */ }
        }
      }

      await Swal.fire({
        icon: 'success',
        title: 'Pago registrado',
        text: `Se aplicó $${money(amt)} a ${detail.document_number}`,
        timer: 1800,
        confirmButtonColor: '#1A1D1F',
      });
      setDetailOpen(false);
      load();
    } catch (e: any) {
      setPayError(e?.message || 'No se pudo registrar el pago');
    } finally {
      setPayingNow(false);
    }
  };

  return (
    <div>
      <ConfigGuardBanner moduleKey="compras" />
      <Card className="mb-3">
        <CardHeader className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 className="mb-0">Facturas de compra</h5>
            <small className="text-muted">Facturas de compra recibidas de proveedores (FC)</small>
          </div>
          <div className="d-flex gap-2">
            <Button color="primary" onClick={() => { setEditingId(null); setCreateOpen(true); }}>
              <i className="ri-add-line align-middle me-1" /> Nueva factura de compra
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Total del período</div>
              <h4 className="mt-2 mb-0">${money(kpis.total)}</h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Pagado</div>
              <h4 className="mt-2 mb-0 text-success">${money(kpis.pagado)}</h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Pendiente</div>
              <h4 className="mt-2 mb-0 text-warning">${money(kpis.pendiente)}</h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Vencido</div>
              <h4 className="mt-2 mb-0 text-danger">${money(kpis.vencido)}</h4>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card
        className="border-0 shadow-sm mb-3"
        style={{ position: 'sticky', top: 0, zIndex: 10 }}
      >
        <CardBody>
          <Row className="g-2 align-items-end">
            <Col md={2}>
              <Label className="form-label mb-1 small">Desde</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Col>
            <Col md={2}>
              <Label className="form-label mb-1 small">Hasta</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Col>
            <Col md={3}>
              <Label className="form-label mb-1 small">Estado</Label>
              <Input type="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Todas</option>
                <option value="pending">Pendiente</option>
                <option value="paid">Pagada</option>
                <option value="overdue">Vencida</option>
                <option value="partial">Parcial</option>
              </Input>
            </Col>
            <Col md={5}>
              <Label className="form-label mb-1 small">Buscar</Label>
              <Input
                type="text"
                placeholder="Proveedor, NIT o número de factura"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardBody>
          {loading ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5">
              <i className="ri-file-list-3-line" style={{ fontSize: 48, color: '#adb5bd' }} />
              <p className="text-muted mt-3 mb-0">
                Sin facturas de compra en este período. Crea la primera con el botón de arriba.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Fecha emisión</th>
                    <th>Proveedor</th>
                    <th>Factura</th>
                    <th>Vencimiento</th>
                    <th className="text-end">Total</th>
                    <th className="text-end">Pagado</th>
                    <th className="text-end">Saldo</th>
                    <th>Estado</th>
                    <th className="text-end" style={{ width: 80 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const st = effectiveStatus(r);
                    const overdue = isOverdue(r);
                    return (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                        <td>{r.issue_date?.slice(0, 10)}</td>
                        <td>
                          <div className="fw-medium">{r.supplier_name}</div>
                          <div className="text-muted small">{r.supplier_document_number}</div>
                        </td>
                        <td>{r.document_number}</td>
                        <td>
                          {overdue ? (
                            <Badge color="danger">{r.due_date?.slice(0, 10)}</Badge>
                          ) : (
                            r.due_date?.slice(0, 10)
                          )}
                        </td>
                        <td className="text-end">${money(r.original_amount)}</td>
                        <td className="text-end text-success">${money(r.paid_amount)}</td>
                        <td className="text-end fw-medium">${money(r.balance_amount)}</td>
                        <td>
                          <Badge color={STATUS_COLORS[st] || 'secondary'}>
                            {STATUS_LABEL[st] || st}
                          </Badge>
                        </td>
                        <td className="text-end" onClick={(e) => e.stopPropagation()}>
                          {Number(r.paid_amount || 0) > 0 ? (
                            <Button
                              color="link"
                              size="sm"
                              className="p-1 text-muted"
                              title="No se puede editar: la factura ya tiene pagos aplicados. Anulá el pago primero."
                              disabled
                            >
                              <i className="ri-lock-line" />
                            </Button>
                          ) : (
                            <Button
                              color="link"
                              size="sm"
                              className="p-1"
                              title="Editar factura"
                              onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                            >
                              <i className="ri-pencil-line" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
      {/* ===================== CREATE — FORMATO ALEGRA ===================== */}
      <Offcanvas
        direction="end"
        isOpen={createOpen}
        toggle={() => { setCreateOpen(!createOpen); if (createOpen) setEditingId(null); }}
        style={{ width: '95vw', maxWidth: 1180 }}
      >
        <OffcanvasHeader toggle={() => { setCreateOpen(false); setEditingId(null); }}>
          <div>
            <h5 className="mb-0">{editingId != null ? 'Editar factura de compra' : 'Nueva factura de compra'}</h5>
            <small className="text-muted">Documento de compra recibido del proveedor (FC) — ingreso al inventario o gasto</small>
          </div>
        </OffcanvasHeader>
        <OffcanvasBody className="px-4 py-3">
          {createOpen && (
            <CompraTab
              config={{
                title: 'factura de compra',
                subtitle: 'Documento de proveedor',
                icon: 'ri-shopping-cart-2-line',
                color: '#F59E0B',
                numberLabel: 'N° factura',
              } as DocumentConfig}
              documentType="factura"
              editingId={editingId}
              initialData={editingPayable as any}
              onSaved={() => { setCreateOpen(false); setEditingId(null); setEditingPayable(null); load(); }}
              onCancel={() => { setCreateOpen(false); setEditingId(null); setEditingPayable(null); }}
            />
          )}
        </OffcanvasBody>
      </Offcanvas>

      {/* ===================== DETAIL ===================== */}
      <Offcanvas
        direction="end"
        isOpen={detailOpen}
        toggle={() => setDetailOpen(!detailOpen)}
        style={{ width: '95vw', maxWidth: 1180 }}
      >
        <OffcanvasHeader toggle={() => setDetailOpen(false)}>
          <div>
            <h5 className="mb-0">Detalle de factura</h5>
            <small className="text-muted">Información del documento de compra</small>
          </div>
        </OffcanvasHeader>
        <OffcanvasBody className="px-4 py-3">
          {detailLoading && !detail ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : detail ? (
            <>
              {/* Header resumen */}
              <Card className="border-0 shadow-sm mb-3" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)' }}>
                <CardBody>
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                    <div>
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Proveedor</div>
                      <div className="fs-5 fw-semibold">{detail.supplier_name}</div>
                      <div className="text-muted small">
                        {detail.supplier_document_type} {detail.supplier_document_number}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>
                        {detail.document_type || 'FC'} N°
                      </div>
                      <div className="fs-5 fw-semibold font-monospace">{detail.document_number}</div>
                      <Badge color={STATUS_COLORS[effectiveStatus(detail)] || 'secondary'} className="mt-1">
                        {STATUS_LABEL[effectiveStatus(detail)] || detail.status}
                      </Badge>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Montos destacados */}
              <Row className="g-2 mb-3">
                <Col md={4}>
                  <Card className="border-0 shadow-sm h-100">
                    <CardBody className="py-3">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Total</div>
                      <div className="fs-5 fw-semibold">${money(detail.original_amount)}</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-0 shadow-sm h-100" style={{ background: '#f0fdf4' }}>
                    <CardBody className="py-3">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Pagado</div>
                      <div className="fs-5 fw-semibold text-success">${money(detail.paid_amount)}</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-0 shadow-sm h-100" style={{ background: Number(detail.balance_amount || 0) > 0 ? '#fef3c7' : '#f0fdf4' }}>
                    <CardBody className="py-3">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Saldo</div>
                      <div className={`fs-5 fw-semibold ${Number(detail.balance_amount || 0) > 0 ? 'text-warning' : 'text-success'}`}>
                        ${money(detail.balance_amount)}
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {/* Meta de la factura */}
              <Card className="border-0 shadow-sm mb-3">
                <CardBody>
                  <Row className="g-3">
                    <Col md={6}>
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Fecha emisión</div>
                      <div className="fw-medium">{detail.issue_date?.slice(0, 10)}</div>
                    </Col>
                    <Col md={6}>
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Vencimiento</div>
                      <div className="fw-medium">
                        {isOverdue(detail) ? (
                          <Badge color="danger">{detail.due_date?.slice(0, 10)}</Badge>
                        ) : (
                          detail.due_date?.slice(0, 10)
                        )}
                      </div>
                    </Col>
                {detail.cost_center && (
                  <Col md={6}>
                    <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Centro de costo</div>
                    <div className="fw-medium">{detail.cost_center}</div>
                  </Col>
                )}
                {detail.expense_account_code && (
                  <Col md={6}>
                    <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Cuenta (PUC)</div>
                    <div className="fw-medium font-monospace">{detail.expense_account_code}</div>
                  </Col>
                )}
                {detail.notes && (
                  <Col md={12}>
                    <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Observaciones</div>
                    <div>{detail.notes}</div>
                  </Col>
                )}
                  </Row>
                </CardBody>
              </Card>

              <h6 className="mt-4 mb-2">Líneas de la factura</h6>
              {Array.isArray(detail.items) && detail.items.length > 0 ? (
                <div className="table-responsive">
                  <Table size="sm" bordered className="align-middle mb-3">
                    <thead className="table-light">
                      <tr>
                        <th>Cuenta</th>
                        <th>Descripción</th>
                        <th className="text-end">Cant.</th>
                        <th className="text-end">V. unitario</th>
                        <th className="text-end">% Desc</th>
                        <th className="text-end">% IVA</th>
                        <th className="text-end">% RF</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((l: any, idx: number) => {
                        const c = computeLine({
                          id: l.id || String(idx),
                          expense_account_code: l.expense_account_code || '',
                          description: l.description || '',
                          quantity: Number(l.quantity) || 0,
                          unit_price: Number(l.unit_price) || 0,
                          discount_pct: Number(l.discount_pct) || 0,
                          iva_pct: Number(l.iva_pct) || 0,
                          rf_pct: Number(l.rf_pct) || 0,
                        });
                        return (
                          <tr key={l.id || idx}>
                            <td>{l.expense_account_code || '-'}</td>
                            <td>{l.description || '-'}</td>
                            <td className="text-end">{l.quantity}</td>
                            <td className="text-end">${money(l.unit_price)}</td>
                            <td className="text-end">{l.discount_pct}%</td>
                            <td className="text-end">{l.iva_pct}%</td>
                            <td className="text-end">{l.rf_pct}%</td>
                            <td className="text-end fw-medium">${money(l.total ?? c.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="alert alert-warning py-2 small mb-3">
                  <i className="ri-information-line me-1" />
                  Factura registrada sin detalle de líneas. Solo se conserva el monto total.
                </div>
              )}

              <h6 className="mt-4 mb-2">Pagos aplicados</h6>
              {Array.isArray(detail.payments) && detail.payments.length > 0 ? (
                <Table size="sm" className="mb-3">
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Referencia</th>
                      <th className="text-end">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((p: any, i: number) => (
                      <tr key={p.id || i}>
                        <td>{(p.payment_date || p.date || '').slice(0, 10)}</td>
                        <td>{p.reference || p.payment_number || '-'}</td>
                        <td className="text-end">${money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="text-muted small mb-3">Aún no hay pagos aplicados.</div>
              )}

              {Number(detail.balance_amount || 0) > 0 && (
                <>
                  <h6 className="mt-4 mb-2">Registrar pago</h6>
                  <Card className="border-0 shadow-sm mb-3">
                    <CardBody>
                      {payError && (
                        <Alert color="danger" className="py-2 small">
                          {payError}
                        </Alert>
                      )}
                      <Row className="g-3">
                        <Col md={4}>
                          <Label className="form-label small">Monto</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={payForm.amount}
                            onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                            placeholder="0.00"
                          />
                          <div className="small text-muted mt-1">
                            Saldo: ${money(detail.balance_amount)}
                          </div>
                        </Col>
                        <Col md={4}>
                          <Label className="form-label small">Fecha</Label>
                          <Input
                            type="date"
                            value={payForm.date}
                            onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                          />
                        </Col>
                        <Col md={4}>
                          <Label className="form-label small">Método</Label>
                          <Input
                            type="select"
                            value={payForm.method}
                            onChange={(e) => setPayForm({ ...payForm, method: e.target.value as any })}
                          >
                            <option value="BANK_TRANSFER">Transferencia</option>
                            <option value="CASH">Efectivo</option>
                            <option value="CHECK">Cheque</option>
                            <option value="OTHER">Otro</option>
                          </Input>
                        </Col>
                        {payForm.method !== 'CASH' && (
                          <>
                            <Col md={6}>
                              <Label className="form-label small d-flex justify-content-between align-items-center">
                                <span>Cuenta bancaria</span>
                                <Button color="link" size="sm" className="p-0 small" onClick={() => { setBankError(null); setShowNewBank(true); }}>
                                  <i className="ri-add-line" /> Agregar
                                </Button>
                              </Label>
                              <Input
                                type="select"
                                value={payForm.bankAccountCode}
                                onChange={(e) => setPayForm({ ...payForm, bankAccountCode: e.target.value })}
                              >
                                <option value="">
                                  {banks.length === 0 ? '-- Sin bancos. Agregá uno → --' : '-- Seleccionar --'}
                                </option>
                                {banks.map((b: any) => (
                                  <option key={b.id} value={b.account_code || ''}>
                                    {b.name}{b.account_number ? ` · ${b.account_number}` : ''}{b.account_code ? ` (PUC ${b.account_code})` : ''}
                                  </option>
                                ))}
                              </Input>
                            </Col>
                            <Col md={6}>
                              <Label className="form-label small">Referencia</Label>
                              <Input
                                value={payForm.reference}
                                onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                                placeholder="N° transacción o cheque"
                              />
                            </Col>
                          </>
                        )}
                        <Col md={12}>
                          <Label className="form-label small">Observaciones</Label>
                          <Input
                            type="textarea"
                            rows={2}
                            value={payForm.notes}
                            onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                            placeholder="Opcional"
                          />
                        </Col>
                      </Row>
                    </CardBody>
                  </Card>
                </>
              )}

              <div className="d-flex justify-content-end gap-2">
                <Button color="light" onClick={() => setDetailOpen(false)} disabled={payingNow}>
                  Cerrar
                </Button>
                <Button
                  color="secondary"
                  outline
                  onClick={() => openEdit(detail)}
                  disabled={payingNow || Number(detail.paid_amount || 0) > 0}
                  title={Number(detail.paid_amount || 0) > 0 ? 'No se puede editar: la factura ya tiene pagos aplicados. Anulá el pago primero.' : undefined}
                >
                  <i className={`${Number(detail.paid_amount || 0) > 0 ? 'ri-lock-line' : 'ri-pencil-line'} me-1`} /> Editar factura
                </Button>
                {detail.status !== 'ANULADA' && Number(detail.paid_amount || 0) === 0 && (
                  <Button
                    color="danger"
                    outline
                    onClick={() => voidInvoice(detail)}
                    disabled={payingNow}
                  >
                    <i className="ri-close-circle-line me-1" /> Anular factura
                  </Button>
                )}
                {Number(detail.balance_amount || 0) > 0 && (
                  <Button color="primary" onClick={applyPayment} disabled={payingNow}>
                    {payingNow ? (
                      <><Spinner size="sm" className="me-2" /> Guardando...</>
                    ) : (
                      <><i className="ri-bank-card-line me-1" /> Confirmar pago</>
                    )}
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </OffcanvasBody>
      </Offcanvas>

      {/* ===================== NUEVO BANCO (INLINE) ===================== */}
      <Modal isOpen={showNewBank} toggle={() => setShowNewBank(false)} centered size="md">
        <ModalHeader toggle={() => setShowNewBank(false)}>
          Agregar cuenta bancaria
        </ModalHeader>
        <ModalBody>
          {bankError && <Alert color="danger" className="py-2 small">{bankError}</Alert>}
          <Row className="g-3">
            <Col md={12}>
              <Label className="form-label small">Banco *</Label>
              <Input
                type="select"
                value={newBank.name}
                onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
              >
                <option value="">-- Seleccionar --</option>
                <option value="Bancolombia">Bancolombia</option>
                <option value="Davivienda">Davivienda</option>
                <option value="BBVA Colombia">BBVA Colombia</option>
                <option value="Banco de Bogotá">Banco de Bogotá</option>
                <option value="Banco de Occidente">Banco de Occidente</option>
                <option value="Banco Popular">Banco Popular</option>
                <option value="Banco Caja Social">Banco Caja Social</option>
                <option value="Banco AV Villas">Banco AV Villas</option>
                <option value="Scotiabank Colpatria">Scotiabank Colpatria</option>
                <option value="Itaú">Itaú</option>
                <option value="Banco Agrario">Banco Agrario</option>
                <option value="Banco Falabella">Banco Falabella</option>
                <option value="Banco Pichincha">Banco Pichincha</option>
                <option value="Banco Santander">Banco Santander</option>
                <option value="Coltefinanciera">Coltefinanciera</option>
                <option value="Bancoomeva">Bancoomeva</option>
                <option value="Banco GNB Sudameris">Banco GNB Sudameris</option>
                <option value="Banco Serfinanza">Banco Serfinanza</option>
                <option value="Banco Mundo Mujer">Banco Mundo Mujer</option>
                <option value="Nequi">Nequi</option>
                <option value="Daviplata">Daviplata</option>
                <option value="Movii">Movii</option>
                <option value="Otro">Otro</option>
              </Input>
            </Col>
            {newBank.name === 'Otro' && (
              <Col md={12}>
                <Label className="form-label small">Nombre del banco *</Label>
                <Input
                  value={newBank.branch || ''}
                  onChange={(e) => setNewBank({ ...newBank, name: e.target.value, branch: e.target.value })}
                  placeholder="Ej: Banco de la Gente"
                />
              </Col>
            )}
            <Col md={6}>
              <Label className="form-label small">Tipo de cuenta</Label>
              <Input
                type="select"
                value={newBank.account_type}
                onChange={(e) => setNewBank({ ...newBank, account_type: e.target.value })}
              >
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </Input>
            </Col>
            <Col md={6}>
              <Label className="form-label small">Número de cuenta</Label>
              <Input
                value={newBank.account_number}
                onChange={(e) => setNewBank({ ...newBank, account_number: e.target.value })}
                placeholder="Ej: 1234567890"
              />
            </Col>
            <Col md={6}>
              <Label className="form-label small">Cuenta PUC</Label>
              <Input
                value={newBank.account_code}
                onChange={(e) => setNewBank({ ...newBank, account_code: e.target.value })}
                placeholder="111005"
              />
              <div className="small text-muted mt-1">111005 = Cuenta bancaria (moneda nacional)</div>
            </Col>
            <Col md={6} className="d-flex align-items-end">
              <FormGroup check>
                <Input
                  type="checkbox"
                  id="bank-is-default"
                  checked={newBank.is_default}
                  onChange={(e) => setNewBank({ ...newBank, is_default: e.target.checked })}
                />
                <Label for="bank-is-default" check>Marcar como predeterminada</Label>
              </FormGroup>
            </Col>
          </Row>
          <div className="small text-muted mt-3">
            También podés gestionar tus bancos desde <strong>Configuración → Contabilidad</strong>.
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setShowNewBank(false)} disabled={savingBank}>Cancelar</Button>
          <Button color="primary" onClick={createBank} disabled={savingBank}>
            {savingBank ? <><Spinner size="sm" className="me-2" />Guardando...</> : 'Guardar banco'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ===================== NUEVO PROVEEDOR ===================== */}
      <Modal
        isOpen={showNewSupplier}
        toggle={() => setShowNewSupplier(false)}
        centered
        size="md"
      >
        <ModalHeader toggle={() => setShowNewSupplier(false)}>Nuevo proveedor</ModalHeader>
        <ModalBody>
          {supplierError && (
            <Alert color="danger" className="d-flex align-items-start gap-2 mb-3">
              <i className="ri-error-warning-line fs-18 mt-1" />
              <div className="flex-grow-1">
                <strong>No se pudo crear el proveedor</strong>
                <div className="fs-13">
                  {supplierError.toLowerCase().includes('fetch') ||
                  supplierError.toLowerCase().includes('network')
                    ? 'No pudimos conectar con el servidor. Revisa que el backend esté corriendo.'
                    : supplierError}
                </div>
              </div>
            </Alert>
          )}
          <Row className="g-3">
            <Col md={6}>
              <Label className="form-label">Tipo doc. *</Label>
              <Input
                type="select"
                value={newSupplier.document_type}
                onChange={(e) =>
                  setNewSupplier((s) => ({ ...s, document_type: e.target.value }))
                }
              >
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={6}>
              <Label className="form-label">N° documento *</Label>
              <Input
                type="text"
                value={newSupplier.document_number}
                onChange={(e) =>
                  setNewSupplier((s) => ({ ...s, document_number: e.target.value }))
                }
              />
            </Col>
            <Col md={12}>
              <Label className="form-label">Razón social / Nombre *</Label>
              <Input
                type="text"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))}
              />
            </Col>
            <Col md={6}>
              <Label className="form-label">Email</Label>
              <Input
                type="email"
                value={newSupplier.email}
                onChange={(e) => setNewSupplier((s) => ({ ...s, email: e.target.value }))}
              />
            </Col>
            <Col md={6}>
              <Label className="form-label">Teléfono</Label>
              <Input
                type="text"
                value={newSupplier.phone}
                onChange={(e) => setNewSupplier((s) => ({ ...s, phone: e.target.value }))}
              />
            </Col>
            <Col md={6}>
              <Label className="form-label">Ciudad</Label>
              <Input
                type="text"
                value={newSupplier.city}
                onChange={(e) => setNewSupplier((s) => ({ ...s, city: e.target.value }))}
              />
            </Col>
            <Col md={6}>
              <Label className="form-label">Dirección</Label>
              <Input
                type="text"
                value={newSupplier.address}
                onChange={(e) => setNewSupplier((s) => ({ ...s, address: e.target.value }))}
              />
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button
            color="light"
            onClick={() => setShowNewSupplier(false)}
            disabled={savingSupplier}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            onClick={createSupplier}
            disabled={
              savingSupplier || !newSupplier.name.trim() || !newSupplier.document_number.trim()
            }
          >
            {savingSupplier && <Spinner size="sm" className="me-2" />}
            Crear proveedor
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default Compras;
