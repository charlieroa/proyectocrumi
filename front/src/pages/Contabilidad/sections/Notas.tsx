import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Input,
  Label,
  Offcanvas,
  OffcanvasBody,
  OffcanvasHeader,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { API_ROOT, money, useAuthHeaders } from '../shared';
import ClienteSelector, { Cliente } from '../../../Components/Contabilidad/ClienteSelector';

type Kind = 'credit' | 'debit';
type Props = { initialKind?: Kind; onSaved?: () => void };

type NoteItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  discount: number;
};

type NoteRow = {
  id: number | string;
  note_number?: string;
  date?: string;
  client_name?: string;
  client_nit?: string;
  related_invoice_number?: string;
  reason?: string;
  notes?: string;
  total?: number;
  status?: string;
  items?: any[];
  client_email?: string;
  client_doc_type?: string;
  cude?: string | null;
};

const REASONS = [
  'Devolución',
  'Descuento por pronto pago',
  'Ajuste por error',
  'Anulación parcial',
  'Anulación total',
  'Otro',
];

const DOC_TYPES = ['NIT', 'CC', 'CE', 'PP'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'secondary',
  issued: 'success',
  void: 'danger',
  borrador: 'secondary',
  emitida: 'success',
  anulada: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  issued: 'Emitida',
  void: 'Anulada',
  borrador: 'Borrador',
  emitida: 'Emitida',
  anulada: 'Anulada',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyItem = (): NoteItem => ({
  description: '',
  quantity: 1,
  unitPrice: 0,
  tax: 19,
  discount: 0,
});

const computeItem = (it: NoteItem) => {
  const base = (it.quantity || 0) * (it.unitPrice || 0);
  const disc = base * ((it.discount || 0) / 100);
  const sub = base - disc;
  const iva = sub * ((it.tax || 0) / 100);
  const total = sub + iva;
  return { base, disc, sub, iva, total };
};

const Notas: React.FC<Props> = ({ initialKind = 'credit', onSaved }) => {
  const headers = useAuthHeaders();
  const [kind] = useState<Kind>(initialKind);
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [drawerCreate, setDrawerCreate] = useState(false);
  const [drawerDetail, setDrawerDetail] = useState<NoteRow | null>(null);
  const [resendingId, setResendingId] = useState<number | string | null>(null);

  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientDocType, setClientDocType] = useState('NIT');
  const [clientNit, setClientNit] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [dateIssue, setDateIssue] = useState(todayIso());
  const [relatedInvoice, setRelatedInvoice] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [reasonOther, setReasonOther] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<NoteItem[]>([emptyItem()]);

  // Facturas reales del cliente seleccionado (dentro del drawer)
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  // Todas las facturas del tenant (para la tabla superior)
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  useEffect(() => {
    const doc = clientNit.trim();
    const name = clientName.trim();
    if (!drawerCreate || (!doc && !name)) { setClientInvoices([]); return; }
    const ctrl = new AbortController();
    const params = new URLSearchParams();
    if (doc) params.append('clientDocumentNumber', doc);
    if (name) params.append('clientName', name);
    fetch(`${API_ROOT}/invoices?${params.toString()}`, { headers, signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { invoices: [] }))
      .then((d) => setClientInvoices(Array.isArray(d?.invoices) ? d.invoices : []))
      .catch(() => setClientInvoices([]));
    return () => ctrl.abort();
  }, [drawerCreate, clientNit, clientName, headers]);

  const loadAllInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const r = await fetch(`${API_ROOT}/invoices`, { headers });
      if (!r.ok) return;
      const d = await r.json();
      setAllInvoices(Array.isArray(d?.invoices) ? d.invoices : []);
    } catch {
      setAllInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    loadAllInvoices();
  }, [loadAllInvoices]);

  const fetchInvoiceItems = async (invoiceId: number | string) => {
    try {
      const r = await fetch(`${API_ROOT}/invoices/${invoiceId}`, { headers });
      if (!r.ok) return;
      const d = await r.json();
      const invItems: any[] = Array.isArray(d?.invoice?.items) ? d.invoice.items : [];
      if (invItems.length === 0) return;
      const mapped = invItems.map((it: any) => ({
        description: it.description || '',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unit_price) || 0,
        discount: Number(it.discount) || 0,
        tax: Number(it.tax_rate) || 0,
      }));
      setItems(mapped);
    } catch {
      /* ignore */
    }
  };

  const openFromInvoice = (inv: any) => {
    resetForm();
    setClientName(inv.client_name || '');
    setClientDocType(inv.client_document_type || 'NIT');
    setClientNit(inv.client_document_number || '');
    setClientEmail(inv.client_email || '');
    const number = inv.invoice_number && String(inv.invoice_number).trim()
      ? inv.invoice_number
      : `F-${inv.id}`;
    setRelatedInvoice(number);
    setDateIssue(todayIso());
    setDrawerCreate(true);
    // Cargar ítems de la factura de inmediato
    if (inv.id) fetchInvoiceItems(inv.id);
  };

  const selectedInvoice = useMemo(() => {
    const v = relatedInvoice.trim();
    if (!v) return undefined;
    return clientInvoices.find((i: any) => {
      const label = i.invoice_number && String(i.invoice_number).trim() ? i.invoice_number : `F-${i.id}`;
      return label === v;
    });
  }, [clientInvoices, relatedInvoice]);

  // Autopoblar items desde la factura seleccionada
  useEffect(() => {
    if (!selectedInvoice?.id || !drawerCreate) return;
    const ctrl = new AbortController();
    fetch(`${API_ROOT}/invoices/${selectedInvoice.id}`, { headers, signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { success: false }))
      .then((d) => {
        const invoice = d?.invoice;
        const invItems: any[] = Array.isArray(invoice?.items) ? invoice.items : [];
        if (invItems.length === 0) return;
        const mapped = invItems.map((it) => ({
          description: it.description || '',
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unit_price) || 0,
          discount: Number(it.discount) || 0,
          tax: Number(it.tax_rate) || 0,
        }));
        setItems(mapped.length > 0 ? mapped : [emptyItem()]);
      })
      .catch(() => { /* ignore */ });
    return () => ctrl.abort();
  }, [selectedInvoice?.id, drawerCreate, headers]);

  const endpoint = kind === 'credit' ? 'credit-notes' : 'debit-notes';
  const listKey = kind === 'credit' ? 'creditNotes' : 'debitNotes';
  const label = kind === 'credit' ? 'crédito' : 'débito';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/${endpoint}`, { headers });
      const data = await res.json();
      if (data && data.success) {
        setRows(data[listKey] || []);
      } else {
        setRows([]);
      }
    } catch (_e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, headers, listKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResendDian = async (row: NoteRow) => {
    setResendingId(row.id);
    try {
      const res = await fetch(`${API_ROOT}/${endpoint}/${row.id}/resend-dian`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (data && data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Enviada a DIAN',
          text: `CUDE: ${data.cude || '—'}`,
          confirmButtonColor: '#1A1D1F',
        });
        loadData();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Falla al enviar a DIAN',
          text: (data && (data.error || data.message)) || 'Error desconocido',
          confirmButtonColor: '#1A1D1F',
        });
      }
    } catch (_e) {
      Swal.fire({ icon: 'error', title: 'Error de red', confirmButtonColor: '#1A1D1F' });
    } finally {
      setResendingId(null);
    }
  };

  const handleAnular = async (row: NoteRow) => {
    if (!window.confirm('¿Anular esta nota en borrador?')) return;
    try {
      const res = await fetch(`${API_ROOT}/${endpoint}/${row.id}/status`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ANULADA' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.success !== false) {
        Swal.fire({ icon: 'success', title: 'Nota anulada', confirmButtonColor: '#1A1D1F' });
        loadData();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo anular',
          text: (data && (data.error || data.message)) || 'Error desconocido',
          confirmButtonColor: '#1A1D1F',
        });
      }
    } catch (_e) {
      Swal.fire({ icon: 'error', title: 'Error de red', confirmButtonColor: '#1A1D1F' });
    }
  };

  const handleEliminar = async (row: NoteRow) => {
    if (!window.confirm('¿Eliminar esta nota en borrador?')) return;
    try {
      const res = await fetch(`${API_ROOT}/${endpoint}/${row.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data && data.success !== false) {
        Swal.fire({ icon: 'success', title: 'Nota eliminada', confirmButtonColor: '#1A1D1F' });
        loadData();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo eliminar',
          text: (data && (data.error || data.message)) || 'Error desconocido',
          confirmButtonColor: '#1A1D1F',
        });
      }
    } catch (_e) {
      Swal.fire({ icon: 'error', title: 'Error de red', confirmButtonColor: '#1A1D1F' });
    }
  };

  const resetForm = () => {
    setClientName('');
    setClientDocType('NIT');
    setClientNit('');
    setClientEmail('');
    setDateIssue(todayIso());
    setRelatedInvoice('');
    setReason(REASONS[0]);
    setReasonOther('');
    setReasonDetail('');
    setResponsibleName('');
    setNotes('');
    setItems([emptyItem()]);
  };

  const openCreate = () => {
    resetForm();
    setDrawerCreate(true);
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all') {
        const s = (r.status || '').toLowerCase();
        if (s !== statusFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${r.client_name || ''} ${r.client_nit || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const totals = useMemo(() => {
    let sub = 0;
    let disc = 0;
    let iva = 0;
    let total = 0;
    items.forEach((it) => {
      const c = computeItem(it);
      sub += c.base;
      disc += c.disc;
      iva += c.iva;
      total += c.total;
    });
    return { sub, disc, iva, total };
  }, [items]);

  const updateItem = (idx: number, patch: Partial<NoteItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  };
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const isFullAnnulment = reason === 'Anulación total';

  // Al elegir "Anulación total" con factura seleccionada, recargamos ítems desde la factura
  // para asegurar que la nota cubra exactamente el 100% de la original.
  useEffect(() => {
    if (!isFullAnnulment) return;
    if (!selectedInvoice?.id) return;
    fetchInvoiceItems(selectedInvoice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullAnnulment, selectedInvoice?.id]);

  const canSave =
    clientName.trim().length > 0 &&
    items.length > 0 &&
    items.every((it) => it.description.trim().length > 0 && it.quantity > 0) &&
    (!isFullAnnulment || !!selectedInvoice);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const finalReason = reason === 'Otro' ? reasonOther.trim() || 'Otro' : reason;
      const normalize = (s: string) => s.trim().toLowerCase();
      const creditMap: Record<string, string> = {
        'devolución': '1',
        'devolucion': '1',
        'anulación': '2',
        'anulacion': '2',
        'anulación total': '2',
        'anulacion total': '2',
        'rebaja': '3',
        'descuento': '3',
        'ajuste de precio': '4',
        'otros': '5',
        'otro': '5',
      };
      const debitMap: Record<string, string> = {
        'intereses': '1',
        'gastos por cobrar': '2',
        'cambio del valor': '3',
        'ajuste de precio': '3',
        'otros': '4',
        'otro': '4',
      };
      const map = kind === 'credit' ? creditMap : debitMap;
      const correctionCode: string | null = finalReason ? (map[normalize(finalReason)] ?? null) : null;
      const relatedInvoiceId: number | null = selectedInvoice?.id ? Number(selectedInvoice.id) : null;
      const body = {
        clientName: clientName.trim(),
        clientNit: clientNit.trim(),
        clientDocType,
        clientEmail: clientEmail.trim() || undefined,
        relatedInvoiceNumber: relatedInvoice.trim() || undefined,
        relatedInvoiceId,
        dateIssue,
        reason: finalReason,
        correctionCode,
        reasonDetail: reasonDetail.trim() || undefined,
        responsibleName: responsibleName.trim() || undefined,
        notes,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          tax: Number(it.tax) || 0,
          discount: Number(it.discount) || 0,
        })),
      };
      const res = await fetch(`${API_ROOT}/${endpoint}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data && data.success) {
        setDrawerCreate(false);
        resetForm();
        await loadData();
        onSaved?.();
      } else {
        Swal.fire({ icon: 'error', title: (data && data.message) || 'No se pudo guardar la nota', confirmButtonColor: '#1A1D1F' });
      }
    } catch (_e) {
      Swal.fire({ icon: 'error', title: 'Error de red al guardar', confirmButtonColor: '#1A1D1F' });
    } finally {
      setSaving(false);
    }
  };

  const renderStatus = (s?: string) => {
    const key = (s || '').toLowerCase();
    const color = STATUS_COLORS[key] || 'secondary';
    const text = STATUS_LABEL[key] || (s || '—');
    return (
      <Badge color={color} className={`badge-soft-${color}`}>
        {text}
      </Badge>
    );
  };

  return (
    <div>
      <div className="d-flex align-items-center justify-content-end gap-2 mb-3" style={{ flexWrap: 'nowrap' }}>
        <div className="position-relative" style={{ flex: '0 1 260px', minWidth: 180 }}>
          <Input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
          <i
            className="ri-search-line position-absolute"
            style={{ left: 10, top: 8, color: '#888' }}
          />
        </div>
        <Input
          type="select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ flex: '0 0 140px', minWidth: 120 }}
        >
          <option value="all">Todos</option>
          <option value="draft">Borrador</option>
          <option value="issued">Emitida</option>
          <option value="void">Anulada</option>
        </Input>
        <Button color="primary" onClick={openCreate} style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
          <i className="ri-add-line me-1" />
          Nueva nota {label}
        </Button>
      </div>

      {/* Facturas disponibles para crear nota */}
      <Card className="shadow-sm mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h6 className="mb-0">
              <i className="ri-file-list-3-line me-1" />
              Facturas disponibles para nota {label}
            </h6>
            <small className="text-muted">
              {invoicesLoading ? 'Cargando...' : `${allInvoices.length} factura(s)`}
            </small>
          </div>
          {invoicesLoading ? (
            <div className="text-center py-3">
              <Spinner size="sm" color="primary" />
            </div>
          ) : allInvoices.length === 0 ? (
            <div className="text-muted small py-2">
              No hay facturas registradas todavía.
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: 280, overflowY: 'auto' }}>
              <Table size="sm" hover className="align-middle mb-0">
                <thead className="table-light" style={{ position: 'sticky', top: 0 }}>
                  <tr>
                    <th>Factura</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>NIT</th>
                    <th className="text-end">Total</th>
                    <th>Estado</th>
                    <th className="text-end" style={{ width: 170 }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {allInvoices.map((inv: any) => {
                    const numberLabel = inv.invoice_number && String(inv.invoice_number).trim()
                      ? inv.invoice_number
                      : `F-${inv.id}`;
                    return (
                      <tr key={inv.id}>
                        <td>
                          <Badge color="light" className="text-dark font-monospace">
                            {numberLabel}
                          </Badge>
                        </td>
                        <td className="small">{String(inv.date || '').slice(0, 10)}</td>
                        <td>{inv.client_name || '—'}</td>
                        <td className="small text-muted">{inv.client_document_number || '—'}</td>
                        <td className="text-end font-monospace">${Number(inv.total || 0).toLocaleString('es-CO')}</td>
                        <td>
                          <Badge color={
                            (inv.payment_status === 'PAGADA' || inv.payment_status === 'paid') ? 'success' :
                            (inv.payment_status === 'PARCIAL' || inv.payment_status === 'partial') ? 'info' :
                            'warning'
                          }>
                            {inv.payment_status || inv.status || '—'}
                          </Badge>
                        </td>
                        <td className="text-end">
                          <Button
                            color="primary"
                            outline
                            size="sm"
                            onClick={() => openFromInvoice(inv)}
                          >
                            <i className="ri-add-line me-1" />
                            Crear nota {label}
                          </Button>
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

      <Card className="shadow-sm">
        <CardBody className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="ri-file-list-3-line" style={{ fontSize: 48, opacity: 0.4 }} />
              <div className="mt-2">
                Aún no hay notas {label}. Crea la primera con el botón de arriba.
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>NIT</th>
                    <th>Factura rel.</th>
                    <th>Motivo</th>
                    <th className="text-end">Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const status = String(r.status || '').toUpperCase();
                    const canResend = status === 'BORRADOR' || status === 'DRAFT';
                    const isDraft = status === 'BORRADOR' || status === 'DRAFT';
                    const hasCude = !!(r.cude && String(r.cude).trim());
                    const canModify = isDraft && !hasCude;
                    return (
                    <tr
                      key={r.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setDrawerDetail(r)}
                    >
                      <td>
                        <Badge color="primary" className="badge-soft-primary">
                          {r.note_number || `#${r.id}`}
                        </Badge>
                      </td>
                      <td>{r.date ? String(r.date).slice(0, 10) : '—'}</td>
                      <td>{r.client_name || '—'}</td>
                      <td>{r.client_nit || '—'}</td>
                      <td>
                        {r.related_invoice_number ? (
                          <Badge color="info" className="badge-soft-info">
                            {r.related_invoice_number}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{r.reason || '—'}</td>
                      <td
                        className="text-end"
                        style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}
                      >
                        {money(Number(r.total) || 0)}
                      </td>
                      <td>{renderStatus(r.status)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex gap-1 flex-wrap">
                          {canResend && (
                            <Button
                              size="sm"
                              color="warning"
                              outline
                              disabled={resendingId === r.id}
                              onClick={() => handleResendDian(r)}
                            >
                              {resendingId === r.id ? <Spinner size="sm" /> : 'Reenviar a DIAN'}
                            </Button>
                          )}
                          {canModify && (
                            <Button
                              size="sm"
                              color="secondary"
                              outline
                              onClick={() => handleAnular(r)}
                            >
                              Anular
                            </Button>
                          )}
                          {canModify && (
                            <Button
                              size="sm"
                              color="danger"
                              outline
                              onClick={() => handleEliminar(r)}
                            >
                              Eliminar
                            </Button>
                          )}
                        </div>
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

      <Offcanvas
        direction="end"
        isOpen={drawerCreate}
        toggle={() => setDrawerCreate(!drawerCreate)}
        style={{ width: '95vw', maxWidth: 1180 }}
      >
        <OffcanvasHeader toggle={() => setDrawerCreate(false)}>
          <div>
            <h5 className="mb-0">Nueva nota {label}</h5>
            <small className="text-muted">Nota {label} electrónica DIAN</small>
          </div>
        </OffcanvasHeader>
        <OffcanvasBody className="px-4 py-3">
          <Row className="g-3">
            <Col xs={12}>
              <Label className="form-label mb-1">Cliente (nombre o razón social)</Label>
              <ClienteSelector
                value={clientName || null}
                onChange={(c: Cliente | null) => {
                  if (c) {
                    setClientName(c.name);
                    setClientNit(c.document_number || '');
                    if (c.email) setClientEmail(c.email);
                  } else {
                    setClientName('');
                    setClientNit('');
                  }
                }}
                fallbackLabel={clientName}
                allowCreate
              />
            </Col>
            <Col xs={4}>
              <Label className="form-label mb-1">Tipo doc.</Label>
              <Input
                type="select"
                value={clientDocType}
                onChange={(e) => setClientDocType(e.target.value)}
              >
                {DOC_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Input>
            </Col>
            <Col xs={8}>
              <Label className="form-label mb-1">Número</Label>
              <Input
                value={clientNit}
                onChange={(e) => setClientNit(e.target.value)}
                placeholder="900123456-7"
              />
            </Col>
            <Col xs={12}>
              <Label className="form-label mb-1">Email cliente (opcional)</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </Col>
            <Col xs={6}>
              <Label className="form-label mb-1">Fecha emisión</Label>
              <Input
                type="date"
                value={dateIssue}
                onChange={(e) => setDateIssue(e.target.value)}
              />
            </Col>
            <Col xs={6}>
              <Label className="form-label mb-1">Factura relacionada</Label>
              <Input
                type="select"
                value={relatedInvoice}
                onChange={(e) => setRelatedInvoice(e.target.value)}
                disabled={clientInvoices.length === 0}
              >
                <option value="">
                  {clientInvoices.length === 0
                    ? '-- Selecciona primero un cliente --'
                    : `-- Selecciona una factura (${clientInvoices.length}) --`}
                </option>
                {clientInvoices.map((inv: any) => {
                  const label = inv.invoice_number && String(inv.invoice_number).trim()
                    ? inv.invoice_number
                    : `F-${inv.id}`;
                  return (
                    <option key={inv.id} value={label}>
                      {label} · {String(inv.date || '').slice(0, 10)} · ${Number(inv.total || 0).toLocaleString('es-CO')}
                    </option>
                  );
                })}
              </Input>
              {clientInvoices.length === 0 && (clientName.trim() || clientNit.trim()) && (
                <small className="text-warning">
                  <i className="ri-alert-line me-1" />
                  No se encontraron facturas para este cliente.
                </small>
              )}
              {selectedInvoice && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 10px',
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#166534',
                  }}
                >
                  <div><strong>Factura {selectedInvoice.invoice_number || `F-${selectedInvoice.id}`}</strong></div>
                  <div>Cliente: {selectedInvoice.client_name || '—'}</div>
                  <div>
                    Fecha: {String(selectedInvoice.date || '').slice(0, 10)} · Total: ${Number(selectedInvoice.total || 0).toLocaleString('es-CO')}
                  </div>
                  {selectedInvoice.status && <div>Estado: {selectedInvoice.status}</div>}
                </div>
              )}
            </Col>
            <Col xs={12}>
              <Label className="form-label mb-1">Motivo</Label>
              <Input
                type="select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Input>
              {reason === 'Otro' && (
                <Input
                  className="mt-2"
                  placeholder="Describe el motivo"
                  value={reasonOther}
                  onChange={(e) => setReasonOther(e.target.value)}
                />
              )}
            </Col>
            <Col xs={12}>
              <Label className="form-label mb-1">
                Análisis / motivo detallado <span className="text-muted small">(trazabilidad)</span>
              </Label>
              <Input
                type="textarea"
                rows={3}
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder="Explica con detalle por qué se emite esta nota (soporte, causa raíz, acuerdo con el cliente, etc.)"
              />
            </Col>
            <Col xs={12}>
              <Label className="form-label mb-1">
                Responsable / aprobador <span className="text-muted small">(quien autoriza)</span>
              </Label>
              <Input
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Nombre de quien autoriza la emisión de esta nota"
              />
            </Col>
            <Col xs={12}>
              <Label className="form-label mb-1">Notas / observaciones</Label>
              <Input
                type="textarea"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Col>

            <Col xs={12}>
              {isFullAnnulment && (
                <div
                  className="mb-2"
                  style={{
                    padding: '10px 12px',
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#78350f',
                  }}
                >
                  <i className="ri-lock-line me-1" />
                  <strong>Anulación total</strong> — la nota cubre el 100% de la factura
                  {selectedInvoice ? ` ${selectedInvoice.invoice_number || `F-${selectedInvoice.id}`}` : ''}.
                  {' '}Los ítems se replican desde la factura y no son editables.
                  {!selectedInvoice && (
                    <div className="text-danger mt-1">
                      <i className="ri-alert-line me-1" />
                      Debes seleccionar una factura relacionada.
                    </div>
                  )}
                </div>
              )}
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Label className="form-label mb-0">Ítems</Label>
                <Button size="sm" color="light" onClick={addItem} disabled={isFullAnnulment}>
                  <i className="ri-add-line me-1" />
                  agregar ítem
                </Button>
              </div>
              <div className="table-responsive">
                <Table size="sm" className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 160 }}>Descripción</th>
                      <th style={{ width: 70 }}>Cant.</th>
                      <th style={{ width: 110 }}>V. unit.</th>
                      <th style={{ width: 70 }}>Desc %</th>
                      <th style={{ width: 70 }}>IVA %</th>
                      <th className="text-end" style={{ width: 110 }}>
                        Total
                      </th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const c = computeItem(it);
                      return (
                        <tr key={idx}>
                          <td>
                            <Input
                              bsSize="sm"
                              value={it.description}
                              disabled={isFullAnnulment}
                              onChange={(e) =>
                                updateItem(idx, { description: e.target.value })
                              }
                            />
                          </td>
                          <td>
                            <Input
                              bsSize="sm"
                              type="number"
                              min={0}
                              value={it.quantity}
                              disabled={isFullAnnulment}
                              onChange={(e) =>
                                updateItem(idx, { quantity: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td>
                            <Input
                              bsSize="sm"
                              type="number"
                              min={0}
                              value={it.unitPrice}
                              disabled={isFullAnnulment}
                              onChange={(e) =>
                                updateItem(idx, { unitPrice: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td>
                            <Input
                              bsSize="sm"
                              type="number"
                              min={0}
                              value={it.discount}
                              disabled={isFullAnnulment}
                              onChange={(e) =>
                                updateItem(idx, { discount: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td>
                            <Input
                              bsSize="sm"
                              type="number"
                              min={0}
                              value={it.tax}
                              disabled={isFullAnnulment}
                              onChange={(e) =>
                                updateItem(idx, { tax: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td
                            className="text-end"
                            style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}
                          >
                            {money(c.total)}
                          </td>
                          <td>
                            <Button
                              size="sm"
                              color="link"
                              className="text-danger p-0"
                              onClick={() => removeItem(idx)}
                              disabled={items.length === 1 || isFullAnnulment}
                            >
                              <i className="ri-delete-bin-line" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </Col>
          </Row>

          <Card className="mt-3 border-0 bg-light">
            <CardBody>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Subtotal</span>
                <span style={{ fontFamily: 'monospace' }}>{money(totals.sub)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Descuento</span>
                <span style={{ fontFamily: 'monospace' }}>-{money(totals.disc)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">IVA</span>
                <span style={{ fontFamily: 'monospace' }}>{money(totals.iva)}</span>
              </div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between align-items-center">
                <strong>Total</strong>
                <strong
                  className="text-primary"
                  style={{ fontFamily: 'monospace', fontSize: 18 }}
                >
                  {money(totals.total)}
                </strong>
              </div>
            </CardBody>
          </Card>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button color="light" onClick={() => setDrawerCreate(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button color="primary" disabled={!canSave || saving} onClick={handleSave}>
              {saving ? <Spinner size="sm" /> : 'Guardar nota'}
            </Button>
          </div>
        </OffcanvasBody>
      </Offcanvas>

      <Offcanvas
        direction="end"
        isOpen={!!drawerDetail}
        toggle={() => setDrawerDetail(null)}
        style={{ width: '95vw', maxWidth: 1180 }}
      >
        <OffcanvasHeader toggle={() => setDrawerDetail(null)}>
          <div>
            <h5 className="mb-0">Detalle de nota {label}</h5>
            <small className="text-muted">Nota {label} electrónica DIAN</small>
          </div>
        </OffcanvasHeader>
        <OffcanvasBody className="px-4 py-3">
          {drawerDetail && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <Badge color="primary" className="badge-soft-primary me-2">
                    {drawerDetail.note_number || `#${drawerDetail.id}`}
                  </Badge>
                  <small className="text-muted">
                    {drawerDetail.date ? String(drawerDetail.date).slice(0, 10) : ''}
                  </small>
                </div>
                {renderStatus(drawerDetail.status)}
              </div>

              <Card className="mb-3 shadow-sm">
                <CardBody>
                  <Row className="g-2">
                    <Col xs={12}>
                      <small className="text-muted d-block">Cliente</small>
                      <strong>{drawerDetail.client_name || '—'}</strong>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block">Documento</small>
                      {drawerDetail.client_doc_type || 'NIT'} {drawerDetail.client_nit || '—'}
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block">Factura relacionada</small>
                      {drawerDetail.related_invoice_number || '—'}
                    </Col>
                    {drawerDetail.client_email && (
                      <Col xs={12}>
                        <small className="text-muted d-block">Email</small>
                        {drawerDetail.client_email}
                      </Col>
                    )}
                  </Row>
                </CardBody>
              </Card>

              <div className="table-responsive mb-3">
                <Table size="sm" className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Descripción</th>
                      <th className="text-end">Cant.</th>
                      <th className="text-end">V. unit.</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(drawerDetail.items || []).map((it: any, i: number) => {
                      const qty = Number(it.quantity) || 0;
                      const up = Number(it.unit_price ?? it.unitPrice) || 0;
                      const tot =
                        Number(it.total) ||
                        computeItem({
                          description: '',
                          quantity: qty,
                          unitPrice: up,
                          tax: Number(it.tax) || 0,
                          discount: Number(it.discount) || 0,
                        }).total;
                      return (
                        <tr key={i}>
                          <td>{it.description || '—'}</td>
                          <td className="text-end">{qty}</td>
                          <td
                            className="text-end"
                            style={{ fontFamily: 'monospace' }}
                          >
                            {money(up)}
                          </td>
                          <td
                            className="text-end"
                            style={{ fontFamily: 'monospace' }}
                          >
                            {money(tot)}
                          </td>
                        </tr>
                      );
                    })}
                    {(!drawerDetail.items || drawerDetail.items.length === 0) && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-3">
                          Sin ítems registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              <Card className="border-0 bg-light mb-3">
                <CardBody>
                  <div className="d-flex justify-content-between align-items-center">
                    <strong>Total</strong>
                    <strong
                      className="text-primary"
                      style={{ fontFamily: 'monospace', fontSize: 18 }}
                    >
                      {money(Number(drawerDetail.total) || 0)}
                    </strong>
                  </div>
                </CardBody>
              </Card>

              <div className="mb-2">
                <small className="text-muted d-block">Motivo</small>
                {drawerDetail.reason || '—'}
              </div>
              {((drawerDetail as any).description || drawerDetail.notes) && (
                <div className="mb-2">
                  <small className="text-muted d-block">Notas</small>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{(drawerDetail as any).description || drawerDetail.notes}</div>
                </div>
              )}
            </>
          )}
        </OffcanvasBody>
      </Offcanvas>
    </div>
  );
};

export default Notas;
