import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ConfigGuardBanner from '../ConfigGuardBanner';
import {
  Row, Col, Card, CardBody, Button, Badge, Table, Offcanvas, OffcanvasHeader, OffcanvasBody,
  Input, Label, FormGroup, Alert, Spinner, UncontrolledTooltip, InputGroup, InputGroupText,
  Container, UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem,
} from 'reactstrap';
import {
  ArrowLeft, Plus, MoreVertical, Eye, Pencil, Send, FileText, Receipt, CheckCheck, Clock, XCircle,
} from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { API_BASE, money, useAuthHeaders, normalizeAccount } from '../shared';
import PucPicker from '../../../Components/Contabilidad/PucPicker';
import SupplierPicker from '../../../Components/Contabilidad/SupplierPicker';

type DocumentoSoporte = {
  id: number;
  supplier_name?: string;
  supplier_document_number?: string;
  supplier_document_type?: string;
  document_type: string;
  document_number: string;
  issue_date: string;
  due_date?: string;
  amount: number | string;
  base_amount?: number | string;
  balance?: number | string;
  balance_amount?: number | string;
  paid_amount?: number | string;
  original_amount?: number | string;
  subtotal_amount?: number | string;
  tax_amount?: number | string;
  withholding_source_amount?: number | string;
  withholding_ica_amount?: number | string;
  withholding_vat_amount?: number | string;
  status?: string;
  expense_account_code?: string;
  notes?: string;
  dian_status?: string;
  cuds?: string;
  dian_submitted_at?: string;
  dian_submitted_number?: string;
  supplier_invoice?: string;
  branch?: string;
  transaction_type?: string;
  created_by?: string;
};

type ThirdParty = {
  id: number;
  name: string;
  document_number: string;
  document_type?: string;
  kind?: string;
  email?: string;
  city?: string;
};

type Account = {
  id: number;
  code: string;
  name: string;
  account_type?: string;
};

type Retencion = {
  nombre: string;
  tarifa: number;
  aplicar: boolean;
};

type AuditEvent = {
  id: number;
  datetime: string;
  document: string;
  event: string;
  user: string;
  result: 'OK' | 'ERROR' | 'WARN';
  detail?: string;
};

const hoyISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};
const primerDiaMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const primerDiaAnio = () => {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
};

const estadoDianBadge = (status?: string) => {
  const s = (status || '').toUpperCase();
  if (s === 'APROBADO_MOCK') return <Badge color="info" title="Aprobado en modo prueba (no enviado a DIAN real)">Aprobado (mock)</Badge>;
  if (s === 'APROBADO' || s === 'APPROVED') return <Badge color="success">Aprobado</Badge>;
  if (s === 'RECHAZADO' || s === 'REJECTED') return <Badge color="danger">Rechazado</Badge>;
  if (s === 'PENDIENTE' || s === 'PENDING' || s === 'ENVIADO') return <Badge color="warning">Pendiente</Badge>;
  return <Badge color="light" className="text-muted border">Sin enviar</Badge>;
};

const resultadoBadge = (r: AuditEvent['result']) => {
  if (r === 'OK') return <Badge color="success">Exitoso</Badge>;
  if (r === 'ERROR') return <Badge color="danger">Error</Badge>;
  return <Badge color="warning">Advertencia</Badge>;
};

// Mapea la columna `action` del backend (accounting_audit_events) a un nombre legible.
const ACTION_LABEL: Record<string, string> = {
  'payable.created': 'Creación',
  'payable.updated': 'Edición',
  'payable.ds_submitted': 'Envío DIAN',
  'payable.ds_submit_failed': 'Envío DIAN',
  'payable.payment_applied': 'Pago aplicado',
  'payable.payment_voided': 'Anulación pago',
};

const mapAuditRowToEvent = (row: any, idx: number): AuditEvent => {
  const actionKey = String(row.action || '').toLowerCase();
  const evLabel = ACTION_LABEL[actionKey] || (row.action || 'Evento');
  const evType = String(row.event_type || '').toUpperCase();
  const severity = String(row.severity || '').toUpperCase();
  let result: AuditEvent['result'] = 'OK';
  if (evType === 'ERROR' || actionKey.endsWith('_failed')) result = 'ERROR';
  else if (severity === 'WARNING') result = 'WARN';

  const rawDate: string = row.created_at || '';
  const datetime = rawDate ? String(rawDate).replace('T', ' ').slice(0, 19) : '';

  return {
    id: row.id ?? idx,
    datetime,
    document: row.document_number || row.entity_number || '—',
    event: evLabel,
    user: row.created_by_name || row.created_by_email || 'sistema',
    result,
    detail: row.message || undefined,
  };
};

const DocumentosSoporte: React.FC = () => {
  const headers = useAuthHeaders();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'documentos' | 'eventos'>('documentos');

  // Filtros panel
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [fProveedor, setFProveedor] = useState('');
  const [fStartDate, setFStartDate] = useState<string>(daysAgoISO(15));
  const [fEndDate, setFEndDate] = useState<string>(hoyISO());
  const [fTipoTrans, setFTipoTrans] = useState<string>('todos');
  const [fCreadoPor, setFCreadoPor] = useState('');
  const [fFacturaProv, setFFacturaProv] = useState('');
  const [fDian, setFDian] = useState<string>('todos');

  // Busqueda ejecutada (se dispara al pulsar Buscar)
  const [buscado, setBuscado] = useState(false);

  const [items, setItems] = useState<DocumentoSoporte[]>([]);
  const [terceros, setTerceros] = useState<ThirdParty[]>([]);
  const [cuentas, setCuentas] = useState<Account[]>([]);

  // Filtros eventos
  const [evStart, setEvStart] = useState<string>(daysAgoISO(15));
  const [evEnd, setEvEnd] = useState<string>(hoyISO());
  const [evTipo, setEvTipo] = useState<string>('todos');
  const [eventos, setEventos] = useState<AuditEvent[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [eventosError, setEventosError] = useState<string | null>(null);

  const [drawerCrear, setDrawerCrear] = useState(false);
  const [drawerDetalle, setDrawerDetalle] = useState(false);
  const [drawerTercero, setDrawerTercero] = useState(false);
  const [seleccionado, setSeleccionado] = useState<DocumentoSoporte | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Formulario de pago inline (desde el drawer detalle)
  const [payForm, setPayForm] = useState({
    amount: '',
    date: hoyISO(),
    method: 'BANK_TRANSFER' as 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER',
    reference: '',
    notes: '',
  });
  const [payingNow, setPayingNow] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [submittingDian, setSubmittingDian] = useState(false);
  const [dianError, setDianError] = useState<string | null>(null);

  const [fContratista, setFContratista] = useState('');
  const [fFecha, setFFecha] = useState(hoyISO());
  const [fConcepto, setFConcepto] = useState('');
  const [fValor, setFValor] = useState<string>('');
  const [fCuenta, setFCuenta] = useState('');
  const [fConsecutivo, setFConsecutivo] = useState('');
  const [fObs, setFObs] = useState('');

  const [retenciones, setRetenciones] = useState<Retencion[]>([
    { nombre: 'Retefuente', tarifa: 4, aplicar: false },
    { nombre: 'ReteIVA', tarifa: 15, aplicar: false },
    { nombre: 'ReteICA', tarifa: 0.966, aplicar: false },
  ]);

  const [nuevoTercero, setNuevoTercero] = useState({
    document_type: 'CC',
    document_number: '',
    name: '',
    email: '',
    city: '',
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/accounting/accounts-payable?startDate=${fStartDate}&endDate=${fEndDate}&documentType=DS`;
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json();
      const arr: any[] = Array.isArray(data)
        ? data
        : data.payables || data.rows || data.data || data.items || [];
      // Normaliza `amount` (el backend expone `original_amount`)
      const normalized = arr.map(d => ({
        ...d,
        amount: d.amount ?? d.original_amount ?? d.subtotal_amount ?? 0,
      }));
      setItems(normalized);
    } catch (e: any) {
      setError(e.message || 'Error al cargar documentos soporte');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fStartDate, fEndDate, headers]);

  const fetchTerceros = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/accounting/third-parties`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      const arr = Array.isArray(data)
        ? data
        : data.thirdParties || data.third_parties || data.data || data.items || [];
      setTerceros(arr);
    } catch { /* noop */ }
  }, [headers]);

  const fetchCuentas = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/accounting/chart-of-accounts`, { headers });
      if (!r.ok) return;
      const data = await r.json();
      const arr = Array.isArray(data)
        ? data
        : data.accounts || data.chartOfAccounts || data.data || data.items || [];
      setCuentas(Array.isArray(arr) ? arr.map(normalizeAccount) : []);
    } catch { /* noop */ }
  }, [headers]);

  useEffect(() => { fetchTerceros(); fetchCuentas(); }, [fetchTerceros, fetchCuentas]);

  // Carga automática del listado al entrar a la vista
  useEffect(() => {
    fetchItems();
    setBuscado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEventos = useCallback(async () => {
    setLoadingEventos(true);
    setEventosError(null);
    try {
      const params = new URLSearchParams({
        documentType: 'DS',
        startDate: evStart,
        endDate: evEnd,
        limit: '200',
      });
      const r = await fetch(`${API_BASE}/accounting/audit-events?${params.toString()}`, { headers });
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json();
      const rows = Array.isArray(data) ? data : data.events || data.rows || data.data || [];
      setEventos(rows.map(mapAuditRowToEvent));
    } catch (e: any) {
      setEventosError(e?.message || 'Error al cargar eventos');
      setEventos([]);
    } finally {
      setLoadingEventos(false);
    }
  }, [evStart, evEnd, headers]);

  useEffect(() => {
    if (activeTab === 'eventos') fetchEventos();
  }, [activeTab, fetchEventos]);

  // Resultados filtrados client-side (sobre items ya cargados del backend)
  const resultados = useMemo(() => {
    const q = fProveedor.trim().toLowerCase();
    return items.filter(d => {
      if (q) {
        const match = (d.supplier_name || '').toLowerCase().includes(q)
          || (d.supplier_document_number || '').includes(q)
          || (d.document_number || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (fDian !== 'todos') {
        const s = (d.dian_status || 'sin_enviar').toLowerCase();
        if (s !== fDian) return false;
      }
      return true;
    });
  }, [items, fProveedor, fDian]);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter(ev => {
      if (evTipo !== 'todos' && !ev.event.toLowerCase().includes(evTipo.toLowerCase())) return false;
      return true;
    });
  }, [eventos, evTipo]);

  const valorBruto = Number(fValor || 0);
  const calculos = useMemo(() => {
    const rets = retenciones.map(r => {
      const valor = r.aplicar ? Math.round(valorBruto * (r.tarifa / 100) * 100) / 100 : 0;
      return { ...r, base: valorBruto, valor };
    });
    const totalRet = rets.reduce((a, r) => a + r.valor, 0);
    const neto = valorBruto - totalRet;
    return { rets, totalRet, neto };
  }, [retenciones, valorBruto]);

  const resetFormulario = () => {
    setFContratista('');
    setFFecha(hoyISO());
    setFConcepto('');
    setFValor('');
    setFCuenta('');
    setFConsecutivo('');
    setFObs('');
    setRetenciones(r => r.map(x => ({ ...x, aplicar: false })));
  };

  const abrirCrear = () => {
    resetFormulario();
    setError(null);
    setOk(null);
    setDrawerCrear(true);
  };

  const terceroSeleccionado = useMemo(() => {
    const q = fContratista.trim();
    if (!q) return undefined;
    const ql = q.toLowerCase();
    return terceros.find(t => t.name.toLowerCase() === ql || t.document_number === q);
  }, [terceros, fContratista]);

  const buscar = async () => {
    await fetchItems();
  };

  const limpiarFiltros = () => {
    setFProveedor('');
    setFStartDate(daysAgoISO(15));
    setFEndDate(hoyISO());
    setFDian('todos');
  };

  const aplicarAtajoFecha = (tipo: 'mes' | '15dias' | 'anio') => {
    if (tipo === 'mes') {
      setFStartDate(primerDiaMes());
      setFEndDate(hoyISO());
    } else if (tipo === '15dias') {
      setFStartDate(daysAgoISO(15));
      setFEndDate(hoyISO());
    } else {
      setFStartDate(primerDiaAnio());
      setFEndDate(hoyISO());
    }
  };

  const guardar = async () => {
    setError(null);
    setOk(null);
    if (!terceroSeleccionado) {
      setError('Debes seleccionar un contratista o prestador válido');
      return;
    }
    if (!fConcepto.trim()) { setError('El concepto es obligatorio'); return; }
    if (!valorBruto || valorBruto <= 0) { setError('El valor debe ser mayor a cero'); return; }
    if (!fCuenta) { setError('Selecciona una cuenta de gasto'); return; }

    const expense_account_code = fCuenta.trim();

    const getRetValor = (nombre: string) => {
      const r = calculos.rets.find(x => x.nombre === nombre && x.aplicar);
      return r ? r.valor : 0;
    };
    const withholdingSourceAmount = getRetValor('Retefuente');
    const withholdingVatAmount = getRetValor('ReteIVA');
    const withholdingIcaAmount = getRetValor('ReteICA');

    const notesParts: string[] = [];
    notesParts.push(`Concepto: ${fConcepto.trim()}`);
    if (fObs.trim()) notesParts.push(`Obs: ${fObs.trim()}`);

    const body: any = {
      supplierName: terceroSeleccionado.name,
      supplierDocumentType: terceroSeleccionado.document_type || 'CC',
      supplierDocumentNumber: terceroSeleccionado.document_number,
      documentType: 'DS',
      issueDate: fFecha,
      subtotalAmount: valorBruto,
      taxAmount: 0,
      withholdingSourceAmount,
      withholdingIcaAmount,
      withholdingVatAmount,
      amount: calculos.neto,
      expenseAccountCode: expense_account_code,
      notes: notesParts.join(' // '),
    };
    if (fConsecutivo.trim()) body.documentNumber = fConsecutivo.trim();

    setSaving(true);
    try {
      const isEdit = editingId != null;
      const url = isEdit
        ? `${API_BASE}/accounting/accounts-payable/${editingId}`
        : `${API_BASE}/accounting/accounts-payable`;
      const r = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `Error ${r.status}`);
      }
      setOk(isEdit ? 'Documento soporte actualizado' : 'Documento soporte creado correctamente');
      setDrawerCrear(false);
      setEditingId(null);
      await fetchItems();
      setBuscado(true);
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const crearTercero = async () => {
    setError(null);
    if (!nuevoTercero.name.trim() || !nuevoTercero.document_number.trim()) {
      setError('Nombre y número de documento son obligatorios');
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/accounting/third-parties`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...nuevoTercero, kind: 'SUPPLIER' }),
      });
      if (!r.ok) { const t = await r.text(); throw new Error(t || `Error ${r.status}`); }
      const creado = await r.json();
      const t: ThirdParty = creado?.data || creado;
      await fetchTerceros();
      setFContratista(t.name);
      setDrawerTercero(false);
      setNuevoTercero({ document_type: 'CC', document_number: '', name: '', email: '', city: '' });
    } catch (e: any) {
      setError(e.message || 'Error al crear contratista');
    }
  };

  const verDetalle = (d: DocumentoSoporte) => {
    setSeleccionado(d);
    const saldo = Number((d as any).balance_amount ?? (Number(d.amount || 0) - Number((d as any).paid_amount || 0)));
    setPayForm({
      amount: saldo > 0 ? saldo.toFixed(2) : '',
      date: hoyISO(),
      method: 'BANK_TRANSFER',
      reference: '',
      notes: '',
    });
    setPayError(null);
    setDrawerDetalle(true);
  };

  // Abrir el drawer de crear precargado con los datos del DS para editarlo.
  const openEdit = (d: DocumentoSoporte) => {
    if (Number((d as any).paid_amount || 0) > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No se puede editar',
        text: 'El documento soporte ya tiene pagos aplicados. Anulá el pago primero.',
        confirmButtonColor: '#1A1D1F',
      });
      return;
    }
    setEditingId(d.id);
    setFContratista(d.supplier_name || '');
    setFFecha((d.issue_date || hoyISO()).slice(0, 10));
    const bruto = Number(d.subtotal_amount || 0) || Number(d.amount || 0);
    setFValor(String(bruto));
    setFCuenta(d.expense_account_code || '');
    setFConsecutivo((d as any).document_number || '');
    const rawNotes = d.notes || '';
    const conceptoMatch = rawNotes.match(/Concepto:\s*([^/]*)/);
    const obsMatch = rawNotes.match(/Obs:\s*(.*)$/);
    setFConcepto(conceptoMatch ? conceptoMatch[1].trim() : '');
    setFObs(obsMatch ? obsMatch[1].trim() : '');

    const wsrc = Number(d.withholding_source_amount || 0);
    const wica = Number(d.withholding_ica_amount || 0);
    const wvat = Number(d.withholding_vat_amount || 0);
    setRetenciones(prev => prev.map(r => {
      if (r.nombre === 'Retefuente') return { ...r, aplicar: wsrc > 0, tarifa: bruto > 0 && wsrc > 0 ? Math.round((wsrc / bruto) * 10000) / 100 : r.tarifa };
      if (r.nombre === 'ReteICA') return { ...r, aplicar: wica > 0, tarifa: bruto > 0 && wica > 0 ? Math.round((wica / bruto) * 100000) / 1000 : r.tarifa };
      if (r.nombre === 'ReteIVA') return { ...r, aplicar: wvat > 0, tarifa: bruto > 0 && wvat > 0 ? Math.round((wvat / bruto) * 10000) / 100 : r.tarifa };
      return r;
    }));
    setDrawerCrear(true);
  };

  const anularDS = async (d: DocumentoSoporte) => {
    if (Number(d.paid_amount || 0) > 0) {
      Swal.fire({ icon: 'warning', title: 'No se puede anular', text: 'El DS tiene pagos aplicados. Anula los pagos primero.', confirmButtonColor: '#1A1D1F' });
      return;
    }
    const { isConfirmed, value: reason } = await Swal.fire({
      icon: 'warning',
      title: '¿Anular Documento Soporte?',
      text: 'Se reversará el asiento contable. Si el DS ya está aprobado por la DIAN, deberás emitir una nota de ajuste por separado.',
      input: 'text',
      inputLabel: 'Motivo (opcional)',
      inputPlaceholder: 'Ej: error en datos, factura duplicada',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    });
    if (!isConfirmed) return;
    try {
      const r = await fetch(`${API_BASE}/accounting/accounts-payable/${d.id}/void`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || null }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${r.status}`);
      }
      Swal.fire({ icon: 'success', title: 'DS anulado', confirmButtonColor: '#1A1D1F', timer: 1800 });
      fetchItems();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'No se pudo anular', text: e?.message || 'Error desconocido', confirmButtonColor: '#1A1D1F' });
    }
  };

  const enviarDian = async (doc?: DocumentoSoporte) => {
    const target = doc || seleccionado;
    if (!target) return;
    const confirm = await Swal.fire({
      icon: 'question',
      title: '¿Enviar a la DIAN?',
      html: `Se enviará el DS <strong>${target.document_number}</strong> del proveedor <strong>${target.supplier_name || ''}</strong>.<br/><br/>Si la DIAN lo acepta, recibirás un CUDS de validación.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
    });
    if (!confirm.isConfirmed) return;

    Swal.fire({
      title: 'Enviando a la DIAN…',
      html: 'No cierres esta ventana. Esto puede tardar unos segundos.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => { Swal.showLoading(null); },
    });

    setSubmittingDian(true);
    setDianError(null);
    try {
      const r = await fetch(`${API_BASE}/accounting/accounts-payable/${target.id}/submit-dian`, {
        method: 'POST',
        headers,
      });
      const data = await r.json().catch(() => ({}));
      Swal.close();
      if (!r.ok || data?.success === false) {
        throw new Error(data?.error || `Error ${r.status}`);
      }
      const cuds = data.cuds || data.data?.cuds || '';
      const dianStatus = data.dianStatus || data.data?.dianStatus || 'ENVIADO';
      await Swal.fire({
        icon: 'success',
        title: 'DS enviado correctamente',
        html: `
          <div style="text-align:left; font-size:13px;">
            <div><strong>Estado DIAN:</strong> ${dianStatus}</div>
            <div style="margin-top:8px;"><strong>CUDS:</strong></div>
            <div style="word-break:break-all; font-family:monospace; font-size:11px; color:#6b7280; margin-top:4px;">${cuds || '—'}</div>
          </div>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#16a34a',
      });
      setDrawerDetalle(false);
      await fetchItems();
    } catch (e: any) {
      Swal.close();
      const msg = e?.message || 'No se pudo enviar a la DIAN';
      setDianError(msg);
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo enviar a la DIAN',
        text: msg,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#dc3545',
      });
    } finally {
      setSubmittingDian(false);
    }
  };

  const applyPaymentDS = async () => {
    if (!seleccionado) return;
    const saldo = Number((seleccionado as any).balance_amount ?? (Number(seleccionado.amount || 0) - Number((seleccionado as any).paid_amount || 0)));
    const amt = Number(payForm.amount || 0);
    setPayError(null);
    if (!amt || amt <= 0) { setPayError('Monto inválido'); return; }
    if (amt > saldo + 0.01) { setPayError('El monto supera el saldo pendiente'); return; }

    const confirm = await Swal.fire({
      icon: 'question',
      title: '¿Registrar pago?',
      html: `Monto: <strong>$${money(amt)}</strong><br/>Proveedor: <strong>${seleccionado.supplier_name}</strong>`,
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
    });
    if (!confirm.isConfirmed) return;

    setPayingNow(true);
    try {
      const r = await fetch(`${API_BASE}/accounting/accounts-payable/apply-payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          payableId: seleccionado.id,
          amount: amt,
          paymentDate: payForm.date,
          paymentMethod: payForm.method,
          reference: payForm.reference || undefined,
          notes: payForm.notes || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `Error ${r.status}`);
      }
      setOk(`Pago de $${money(amt)} registrado en ${seleccionado.supplier_name}`);
      setDrawerDetalle(false);
      await fetchItems();
    } catch (e: any) {
      setPayError(e?.message || 'No se pudo registrar el pago');
    } finally {
      setPayingNow(false);
    }
  };

  // KPIs del listado (sobre items ya cargados)
  const kpis = useMemo(() => {
    const total = items.length;
    const monto = items.reduce((a, d) => a + Number(d.amount || 0), 0);
    const aprobados = items.filter(d => (d.dian_status || '').toUpperCase() === 'APROBADO').length;
    const pendientes = total - aprobados;
    return { total, monto, aprobados, pendientes };
  }, [items]);

  // KPI card reutilizable (mismo estilo que Factura de venta / Compras)
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

  return (
    <div>
      <ConfigGuardBanner moduleKey="documentos-soporte" />

        {error && (() => {
          const isNetwork = String(error).toLowerCase().includes('fetch') || String(error).toLowerCase().includes('network');
          return (
            <Alert color="danger" className="d-flex align-items-start gap-3 mb-3" toggle={() => setError(null)}>
              <i className="ri-error-warning-line fs-20 mt-1" />
              <div className="flex-grow-1">
                <strong>{isNetwork ? 'No pudimos conectar con el servidor' : 'No se pudo guardar'}</strong>
                <div className="fs-13 mt-1">
                  {isNetwork
                    ? 'El backend no responde. Revisa que esté corriendo (npm start en crumi/back) o ajusta VITE_API_URL en front/.env.'
                    : String(error)}
                </div>
                {isNetwork && (
                  <Button size="sm" color="danger" outline className="mt-2" onClick={() => { setError(null); fetchItems(); }}>
                    Reintentar
                  </Button>
                )}
              </div>
            </Alert>
          );
        })()}
        {ok && <Alert color="success" toggle={() => setOk(null)}>{ok}</Alert>}

        {/* Acción principal (el título y "Volver" los provee SectionPage) */}
        <div className="d-flex justify-content-end mb-3">
          <Button
            color="primary"
            onClick={abrirCrear}
            className="d-inline-flex align-items-center gap-1"
          >
            <Plus size={14} /> Crear documento soporte
          </Button>
        </div>

        {/* KPIs */}
        <Row className="g-3 mb-3">
          <Col md={6} xl={3}>
            <KpiCard label="Documentos" value={kpis.total.toLocaleString('es-CO')} Icon={FileText} color="primary" />
          </Col>
          <Col md={6} xl={3}>
            <KpiCard label="Valor total" value={`$${money(kpis.monto)}`} Icon={Receipt} color="warning" />
          </Col>
          <Col md={6} xl={3}>
            <KpiCard label="Aprobados DIAN" value={kpis.aprobados.toLocaleString('es-CO')} Icon={CheckCheck} color="success" />
          </Col>
          <Col md={6} xl={3}>
            <KpiCard label="Pendientes DIAN" value={kpis.pendientes.toLocaleString('es-CO')} Icon={Clock} color="danger" />
          </Col>
        </Row>

        {/* Filtros inline (sin colapso, aplican en vivo) */}
        <Card className="border-0 shadow-sm mb-3">
          <CardBody>
            <Row className="g-2 align-items-end">
              <Col md={2}>
                <Label className="form-label mb-1 small">Desde</Label>
                <Input type="date" value={fStartDate} onChange={e => setFStartDate(e.target.value)} />
              </Col>
              <Col md={2}>
                <Label className="form-label mb-1 small">Hasta</Label>
                <Input type="date" value={fEndDate} onChange={e => setFEndDate(e.target.value)} />
              </Col>
              <Col md={2}>
                <Label className="form-label mb-1 small">Estado DIAN</Label>
                <Input type="select" value={fDian} onChange={e => setFDian(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="rechazado">Rechazado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="sin_enviar">Sin enviar</option>
                </Input>
              </Col>
              <Col md={4}>
                <Label className="form-label mb-1 small">Buscar</Label>
                <Input
                  type="text"
                  value={fProveedor}
                  onChange={e => setFProveedor(e.target.value)}
                  placeholder="Proveedor, NIT o número"
                />
              </Col>
              <Col md={2} className="d-flex gap-1">
                <Button color="light" className="flex-grow-1" onClick={limpiarFiltros} title="Limpiar filtros">
                  Limpiar
                </Button>
                <Button color="primary" onClick={buscar} disabled={loading} title="Recargar">
                  {loading ? <Spinner size="sm" /> : <i className="ri-refresh-line" />}
                </Button>
              </Col>
            </Row>
          </CardBody>
        </Card>

        {/* Tabla */}
        <Card className="border-0 shadow-sm">
          <CardBody>
            {loading ? (
              <div className="d-flex justify-content-center align-items-center py-5">
                <Spinner color="primary" />
              </div>
            ) : resultados.length === 0 ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-2 text-center">
                <i className="ri-file-list-3-line" style={{ fontSize: 48, color: '#adb5bd' }} />
                <h6 className="mb-1 fw-semibold">
                  {items.length === 0
                    ? 'Todavía no hay documentos soporte.'
                    : 'Sin resultados con los filtros actuales.'}
                </h6>
                <p className="text-muted small mb-2">
                  {items.length === 0
                    ? 'Crea tu primer documento soporte para empezar.'
                    : 'Ajusta los filtros o límpialos.'}
                </p>
                <div className="d-flex gap-2">
                  {items.length > 0 && (
                    <Button color="light" onClick={limpiarFiltros}>Limpiar filtros</Button>
                  )}
                  <Button color="primary" onClick={abrirCrear} className="d-inline-flex align-items-center gap-1">
                    <Plus size={14} /> Crear documento soporte
                  </Button>
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>N° DS</th>
                      <th>Proveedor</th>
                      <th>Fecha</th>
                      <th className="text-end">Total</th>
                      <th>DIAN</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map(d => {
                      const dsStatus = (d.dian_status || '').toUpperCase();
                      const puedeEnviarDian = dsStatus !== 'APROBADO' && dsStatus !== 'APROBADO_MOCK';
                      return (
                        <tr key={d.id}>
                          <td className="fw-medium font-monospace">{d.document_number}</td>
                          <td>
                            <div className="fw-medium">{d.supplier_name}</div>
                            <div className="text-muted small">
                              {d.supplier_document_type} {d.supplier_document_number}
                            </div>
                          </td>
                          <td>{d.issue_date?.slice(0, 10)}</td>
                          <td className="text-end fw-semibold font-monospace">
                            ${money(d.amount)}
                          </td>
                          <td>{estadoDianBadge(d.dian_status)}</td>
                          <td className="text-end">
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
                                {puedeEnviarDian && (
                                  <>
                                    <DropdownItem
                                      onClick={() => enviarDian(d)}
                                      style={{ padding: '10px 16px', fontWeight: 600, color: dsStatus === 'ERROR' || dsStatus === 'RECHAZADO' ? '#d97706' : '#16a34a' }}
                                      className="d-flex align-items-center"
                                    >
                                      <Send size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                      <span>{dsStatus === 'ERROR' || dsStatus === 'RECHAZADO' ? 'Reenviar a DIAN' : 'Enviar a DIAN'}</span>
                                    </DropdownItem>
                                    <DropdownItem divider />
                                  </>
                                )}
                                <DropdownItem
                                  onClick={() => verDetalle(d)}
                                  style={{ padding: '10px 16px' }}
                                  className="d-flex align-items-center"
                                >
                                  <Eye size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Ver</span>
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => openEdit(d)}
                                  disabled={Number((d as any).paid_amount || 0) > 0}
                                  style={{ padding: '10px 16px' }}
                                  className="d-flex align-items-center"
                                  title={Number((d as any).paid_amount || 0) > 0 ? 'No se puede editar: el DS ya tiene pagos aplicados. Anulá el pago primero.' : undefined}
                                >
                                  <Pencil size={16} style={{ marginRight: 10, flexShrink: 0 }} />
                                  <span>Editar</span>
                                </DropdownItem>
                                <DropdownItem divider />
                                <DropdownItem
                                  onClick={() => anularDS(d)}
                                  disabled={Number(d.paid_amount || 0) > 0 || d.status === 'ANULADA'}
                                  style={{ padding: '10px 16px', color: '#dc2626' }}
                                  className="d-flex align-items-center"
                                >
                                  <XCircle size={16} style={{ marginRight: 10, flexShrink: 0 }} />
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
            )}
          </CardBody>
        </Card>

        {/* ============ OFFCANVAS: Nuevo DS (sin cambios en endpoints) ============ */}
        <Offcanvas isOpen={drawerCrear} toggle={() => setDrawerCrear(false)} direction="end" style={{ width: 640 }}>
          <OffcanvasHeader toggle={() => setDrawerCrear(false)}>Nuevo documento soporte</OffcanvasHeader>
          <OffcanvasBody>
            {error && <Alert color="danger" toggle={() => setError(null)}>{error}</Alert>}

            <FormGroup>
              <Label>Contratista o prestador de servicio</Label>
              <SupplierPicker
                value={fContratista}
                onChange={(name) => setFContratista(name)}
                onPick={(t) => setFContratista(t.name)}
                onCreateNew={(seed) => {
                  setNuevoTercero(n => ({ ...n, name: seed || '' }));
                  setDrawerTercero(true);
                }}
                suppliers={terceros}
                placeholder="Nombre o NIT del contratista"
              />
              {terceroSeleccionado && (
                <small className="text-success d-block mt-1">
                  <i className="ri-checkbox-circle-line" /> {terceroSeleccionado.name} — {terceroSeleccionado.document_type || 'CC'} {terceroSeleccionado.document_number}
                </small>
              )}
            </FormGroup>

            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Fecha del servicio/compra</Label>
                  <Input type="date" value={fFecha} onChange={e => setFFecha(e.target.value)} />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Número del DS</Label>
                  <Input
                    value={fConsecutivo}
                    onChange={e => setFConsecutivo(e.target.value)}
                    placeholder="Si no lo llenas lo generamos automáticamente"
                  />
                </FormGroup>
              </Col>
            </Row>

            <FormGroup>
              <Label>Concepto del gasto</Label>
              <Input
                type="textarea" rows={3}
                value={fConcepto}
                onChange={e => setFConcepto(e.target.value)}
                placeholder="Ej: Servicios profesionales de asesoría contable marzo 2026"
              />
            </FormGroup>

            <FormGroup>
              <Label>Valor bruto (antes de retenciones)</Label>
              <InputGroup>
                <InputGroupText>$</InputGroupText>
                <Input
                  type="number" min={0}
                  value={fValor}
                  onChange={e => setFValor(e.target.value)}
                  placeholder="0.00"
                />
              </InputGroup>
            </FormGroup>

            <Card className="mb-3 border">
              <CardBody className="p-2">
                <div className="fw-semibold mb-2"><i className="ri-percent-line me-1" /> Retenciones aplicables</div>
                <Table size="sm" className="mb-2">
                  <thead>
                    <tr className="small">
                      <th style={{ width: 40 }}></th>
                      <th>Tipo</th>
                      <th className="text-end">Base</th>
                      <th style={{ width: 90 }}>Tarifa %</th>
                      <th className="text-end">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retenciones.map((r, i) => {
                      const valor = r.aplicar ? Math.round(valorBruto * (r.tarifa / 100) * 100) / 100 : 0;
                      return (
                        <tr key={r.nombre}>
                          <td>
                            <Input
                              type="checkbox"
                              checked={r.aplicar}
                              onChange={e => {
                                const copy = [...retenciones];
                                copy[i] = { ...copy[i], aplicar: e.target.checked };
                                setRetenciones(copy);
                              }}
                            />
                          </td>
                          <td>{r.nombre}</td>
                          <td className="text-end"><small>${money(valorBruto)}</small></td>
                          <td>
                            <Input
                              type="number" step="0.001" bsSize="sm"
                              value={r.tarifa}
                              onChange={e => {
                                const copy = [...retenciones];
                                copy[i] = { ...copy[i], tarifa: Number(e.target.value) };
                                setRetenciones(copy);
                              }}
                            />
                          </td>
                          <td className="text-end text-danger">${money(valor)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <div className="d-flex justify-content-between align-items-center border-top pt-2">
                  <span className="text-muted">Total retenciones: <strong className="text-danger">-${money(calculos.totalRet)}</strong></span>
                  <div className="text-end">
                    <div className="small text-muted">Neto a pagar</div>
                    <h3 className="mb-0 text-success">${money(calculos.neto)}</h3>
                  </div>
                </div>
              </CardBody>
            </Card>

            <FormGroup>
              <Label>Cuenta de gasto (PUC)</Label>
              <PucPicker
                value={fCuenta}
                onChange={(code) => setFCuenta(code)}
                accounts={cuentas}
                placeholder="Código PUC (ej. 14, 5135)"
              />
            </FormGroup>

            <FormGroup>
              <Label>Observaciones</Label>
              <Input type="textarea" rows={2} value={fObs} onChange={e => setFObs(e.target.value)} />
            </FormGroup>

            <div className="d-flex gap-2 mt-4">
              <Button color="primary" size="lg" onClick={guardar} disabled={saving} className="flex-grow-1">
                {saving ? <Spinner size="sm" /> : <><i className="ri-save-line me-1" /> Guardar documento soporte</>}
              </Button>
              <Button color="light" onClick={() => setDrawerCrear(false)} disabled={saving}>Cancelar</Button>
            </div>
          </OffcanvasBody>
        </Offcanvas>

        <Offcanvas isOpen={drawerTercero} toggle={() => setDrawerTercero(false)} direction="end" style={{ width: 480 }}>
          <OffcanvasHeader toggle={() => setDrawerTercero(false)}>Nuevo contratista / prestador</OffcanvasHeader>
          <OffcanvasBody>
            <Alert color="light" className="small">Tipo de tercero: <strong>Proveedor (SUPPLIER)</strong></Alert>
            <Row>
              <Col md={5}>
                <FormGroup>
                  <Label>Tipo doc.</Label>
                  <Input type="select" value={nuevoTercero.document_type}
                    onChange={e => setNuevoTercero({ ...nuevoTercero, document_type: e.target.value })}>
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="NIT">NIT</option>
                    <option value="PAS">PAS</option>
                    <option value="PEP">PEP</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md={7}>
                <FormGroup>
                  <Label>Número</Label>
                  <Input value={nuevoTercero.document_number}
                    onChange={e => setNuevoTercero({ ...nuevoTercero, document_number: e.target.value })} />
                </FormGroup>
              </Col>
            </Row>
            <FormGroup>
              <Label>Nombre completo / Razón social</Label>
              <Input value={nuevoTercero.name}
                onChange={e => setNuevoTercero({ ...nuevoTercero, name: e.target.value })} />
            </FormGroup>
            <FormGroup>
              <Label>Email</Label>
              <Input type="email" value={nuevoTercero.email}
                onChange={e => setNuevoTercero({ ...nuevoTercero, email: e.target.value })} />
            </FormGroup>
            <FormGroup>
              <Label>Ciudad</Label>
              <Input value={nuevoTercero.city}
                onChange={e => setNuevoTercero({ ...nuevoTercero, city: e.target.value })} />
            </FormGroup>
            <div className="d-flex gap-2 mt-3">
              <Button color="primary" onClick={crearTercero} className="flex-grow-1">Crear contratista</Button>
              <Button color="light" onClick={() => setDrawerTercero(false)}>Cancelar</Button>
            </div>
          </OffcanvasBody>
        </Offcanvas>

        <Offcanvas isOpen={drawerDetalle} toggle={() => setDrawerDetalle(false)} direction="end" style={{ width: 560 }}>
          <OffcanvasHeader toggle={() => setDrawerDetalle(false)}>
            Documento soporte {seleccionado?.document_number}
          </OffcanvasHeader>
          <OffcanvasBody>
            {seleccionado && (
              <>
                <div className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Consecutivo</span>
                    <strong style={{ fontFamily: 'monospace' }}>{seleccionado.document_number}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Fecha</span>
                    <span>{seleccionado.issue_date?.slice(0, 10)}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Estado DIAN</span>
                    <span>{estadoDianBadge(seleccionado.dian_status)}</span>
                  </div>
                </div>

                <Card className="mb-3"><CardBody className="p-2">
                  <div className="small text-muted">Contratista / prestador</div>
                  <div className="fw-medium">{seleccionado.supplier_name}</div>
                  <small>{seleccionado.supplier_document_type} {seleccionado.supplier_document_number}</small>
                </CardBody></Card>

                <Card className="mb-3"><CardBody className="p-2">
                  <div className="small text-muted mb-1">Concepto / notas</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{seleccionado.notes || '—'}</div>
                </CardBody></Card>

                {(Number(seleccionado.withholding_source_amount || 0)
                  + Number(seleccionado.withholding_ica_amount || 0)
                  + Number(seleccionado.withholding_vat_amount || 0)) > 0 && (
                  <Card className="mb-3 border-warning">
                    <CardBody className="p-2">
                      <div className="small text-muted mb-1"><i className="ri-percent-line me-1" /> Retenciones registradas</div>
                      <Table size="sm" className="mb-0">
                        <tbody>
                          {Number(seleccionado.withholding_source_amount || 0) > 0 && (
                            <tr>
                              <td>Retefuente</td>
                              <td className="text-end text-danger">-${money(seleccionado.withholding_source_amount)}</td>
                            </tr>
                          )}
                          {Number(seleccionado.withholding_ica_amount || 0) > 0 && (
                            <tr>
                              <td>ReteICA</td>
                              <td className="text-end text-danger">-${money(seleccionado.withholding_ica_amount)}</td>
                            </tr>
                          )}
                          {Number(seleccionado.withholding_vat_amount || 0) > 0 && (
                            <tr>
                              <td>ReteIVA</td>
                              <td className="text-end text-danger">-${money(seleccionado.withholding_vat_amount)}</td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </CardBody>
                  </Card>
                )}

                <Card className="mb-3"><CardBody className="p-2">
                  <div className="d-flex justify-content-between">
                    <span>Valor total</span>
                    <strong>${money(seleccionado.amount)}</strong>
                  </div>
                  {seleccionado.balance !== undefined && (
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Saldo pendiente</span>
                      <span>${money(seleccionado.balance)}</span>
                    </div>
                  )}
                  {seleccionado.expense_account_code && (
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Cuenta de gasto</span>
                      <span style={{ fontFamily: 'monospace' }}>{seleccionado.expense_account_code}</span>
                    </div>
                  )}
                </CardBody></Card>

                {/* Formulario de pago inline (mismo patrón que Compras) */}
                {Number((seleccionado as any).balance_amount ?? (Number(seleccionado.amount) - Number((seleccionado as any).paid_amount || 0))) > 0 && (
                  <Card className="border-0 shadow-sm mb-3">
                    <CardBody>
                      <h6 className="mb-2"><i className="ri-money-dollar-circle-line me-1" /> Registrar pago</h6>
                      {payError && <Alert color="danger" className="py-2 small">{payError}</Alert>}
                      <Row className="g-3">
                        <Col md={4}>
                          <Label className="small">Monto</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={payForm.amount}
                            onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                            placeholder="0.00"
                          />
                        </Col>
                        <Col md={4}>
                          <Label className="small">Fecha</Label>
                          <Input
                            type="date"
                            value={payForm.date}
                            onChange={e => setPayForm({ ...payForm, date: e.target.value })}
                          />
                        </Col>
                        <Col md={4}>
                          <Label className="small">Método</Label>
                          <Input
                            type="select"
                            value={payForm.method}
                            onChange={e => setPayForm({ ...payForm, method: e.target.value as any })}
                          >
                            <option value="BANK_TRANSFER">Transferencia</option>
                            <option value="CASH">Efectivo</option>
                            <option value="CHECK">Cheque</option>
                            <option value="OTHER">Otro</option>
                          </Input>
                        </Col>
                        <Col md={12}>
                          <Label className="small">Referencia (opcional)</Label>
                          <Input
                            value={payForm.reference}
                            onChange={e => setPayForm({ ...payForm, reference: e.target.value })}
                            placeholder="N° transacción o cheque"
                          />
                        </Col>
                      </Row>
                    </CardBody>
                  </Card>
                )}

                {dianError && <Alert color="danger" className="py-2 small" toggle={() => setDianError(null)}>{dianError}</Alert>}

                {seleccionado.cuds && (
                  <Card className="mb-3 border-success">
                    <CardBody className="p-2">
                      <div className="small text-muted mb-1"><i className="ri-shield-check-line me-1" /> CUDS DIAN</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{seleccionado.cuds}</div>
                      {seleccionado.dian_submitted_at && (
                        <small className="text-muted d-block mt-1">
                          Enviado: {String(seleccionado.dian_submitted_at).slice(0, 19).replace('T', ' ')}
                        </small>
                      )}
                    </CardBody>
                  </Card>
                )}

                <div className="d-flex gap-2 flex-wrap">
                  <Button color="light" onClick={() => window.print()}>
                    <i className="ri-printer-line me-1" /> Imprimir
                  </Button>
                  {(seleccionado.dian_status || '').toUpperCase() !== 'APROBADO' && (
                    <Button
                      color="warning"
                      onClick={() => enviarDian()}
                      disabled={submittingDian}
                    >
                      {submittingDian ? <Spinner size="sm" /> : <><i className="ri-send-plane-line me-1" /> Enviar a DIAN</>}
                    </Button>
                  )}
                  {Number((seleccionado as any).balance_amount ?? (Number(seleccionado.amount) - Number((seleccionado as any).paid_amount || 0))) > 0 && (
                    <Button
                      color="primary"
                      onClick={applyPaymentDS}
                      disabled={payingNow}
                      className="flex-grow-1"
                    >
                      {payingNow ? <Spinner size="sm" /> : <><i className="ri-bank-card-line me-1" /> Confirmar pago</>}
                    </Button>
                  )}
                </div>
              </>
            )}
          </OffcanvasBody>
        </Offcanvas>
    </div>
  );
};

export default DocumentosSoporte;
