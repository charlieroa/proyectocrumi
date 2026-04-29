import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import { toast } from 'react-toastify';
import ClienteSelector, { Cliente } from '../../../Components/Contabilidad/ClienteSelector';
import { api } from '../../../services/api';
import { getProducts, Product } from '../../../services/productApi';

type RemissionStatus = 'BORRADOR' | 'ENTREGADA' | 'FACTURADA' | 'ANULADA';

interface RemissionRow {
  id: number;
  remission_number: string;
  client_name: string;
  client_id: number | null;
  client_document_type: string | null;
  client_document_number: string | null;
  client_email: string | null;
  client_address: string | null;
  date: string;
  subtotal: number | string;
  tax_amount: number | string;
  discount: number | string;
  total: number | string;
  notes: string | null;
  status: RemissionStatus;
  converted_to_invoice_id: number | null;
  created_at?: string;
  updated_at?: string;
}

interface DraftItem {
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // percent
  tax: number;      // percent
}

interface Draft {
  date: string;
  deliveryAddress: string;
  notes: string;
  items: DraftItem[];
}

const STATUS_COLOR: Record<RemissionStatus, string> = {
  BORRADOR: 'secondary',
  ENTREGADA: 'info',
  FACTURADA: 'success',
  ANULADA: 'danger',
};

const STATUS_LABEL: Record<RemissionStatus, string> = {
  BORRADOR: 'Borrador',
  ENTREGADA: 'Entregada',
  FACTURADA: 'Facturada',
  ANULADA: 'Anulada',
};

const emptyDraft = (): Draft => ({
  date: new Date().toISOString().slice(0, 10),
  deliveryAddress: '',
  notes: '',
  items: [{ productId: null, description: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0 }],
});

const toNum = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const fmtMoney = (v: number | string | null | undefined): string => {
  const n = toNum(v);
  return n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
};

const computeLineTotal = (it: DraftItem): number => {
  const base = (it.quantity || 0) * (it.unitPrice || 0);
  const discountValue = base * (it.discount || 0) / 100;
  const taxable = base - discountValue;
  const taxValue = taxable * (it.tax || 0) / 100;
  return taxable + taxValue;
};

const errMsg = (e: any): string =>
  e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Error desconocido';

const showError = (e: any, fallback: string) => {
  const msg = errMsg(e) || fallback;
  try { toast.error(msg); } catch { alert(msg); }
};

const Remisiones: React.FC = () => {
  const [rows, setRows] = useState<RemissionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [clienteSelected, setClienteSelected] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await api.get('/remissions');
      const data = (res.data?.data ?? []) as RemissionRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showError(e, 'No se pudo cargar el listado de remisiones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  // Cargar productos al abrir modal (si aún no se cargaron)
  useEffect(() => {
    if (!modalOpen || products.length > 0) return;
    getProducts()
      .then(r => setProducts(Array.isArray(r.data) ? r.data : []))
      .catch(e => console.warn('No se pudieron cargar los productos', errMsg(e)));
  }, [modalOpen, products.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      r =>
        (r.client_name || '').toLowerCase().includes(q) ||
        (r.remission_number || '').toLowerCase().includes(q) ||
        (r.client_address || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openNew = () => {
    setDraft(emptyDraft());
    setClienteSelected(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const canSave =
    !!clienteSelected &&
    draft.items.some(
      i => i.description.trim().length > 0 && i.quantity > 0 && i.unitPrice >= 0,
    );

  const addItem = () =>
    setDraft(d => ({
      ...d,
      items: [...d.items, { productId: null, description: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0 }],
    }));

  const removeItem = (idx: number) =>
    setDraft(d => ({
      ...d,
      items: d.items.length <= 1 ? d.items : d.items.filter((_, i) => i !== idx),
    }));

  const updateItem = (idx: number, patch: Partial<DraftItem>) =>
    setDraft(d => ({
      ...d,
      items: d.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));

  const pickProduct = (idx: number, prodIdRaw: string) => {
    if (!prodIdRaw) {
      updateItem(idx, { productId: null });
      return;
    }
    const p = products.find(pp => String(pp.id) === String(prodIdRaw));
    if (!p) {
      updateItem(idx, { productId: null });
      return;
    }
    updateItem(idx, {
      productId: Number(p.id),
      description: p.name,
      unitPrice: toNum(p.sale_price),
      tax: toNum(p.tax_rate),
    });
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let total = 0;
    for (const it of draft.items) {
      const base = (it.quantity || 0) * (it.unitPrice || 0);
      const dv = base * (it.discount || 0) / 100;
      const taxable = base - dv;
      const tv = taxable * (it.tax || 0) / 100;
      subtotal += base;
      discount += dv;
      tax += tv;
      total += taxable + tv;
    }
    return { subtotal, discount, tax, total };
  }, [draft.items]);

  const save = async () => {
    if (!canSave || !clienteSelected || saving) return;
    setSaving(true);
    try {
      const payload = {
        clientId: clienteSelected.id ? Number(clienteSelected.id) : null,
        clientNit: clienteSelected.document_number || null,
        clientName: clienteSelected.name,
        clientDocType: clienteSelected.document_type || 'CC',
        clientEmail: clienteSelected.email || null,
        deliveryAddress: draft.deliveryAddress.trim() || null,
        dateIssue: draft.date,
        notes: draft.notes.trim() || null,
        items: draft.items
          .filter(i => i.description.trim().length > 0 && i.quantity > 0)
          .map(i => ({
            description: i.description.trim(),
            quantity: Number(i.quantity) || 0,
            unitPrice: Number(i.unitPrice) || 0,
            tax: Number(i.tax) || 0,
            discount: Number(i.discount) || 0,
            productId: i.productId ?? null,
          })),
      };
      await api.post('/remissions', payload);
      try { toast.success('Remisión creada'); } catch { /* noop */ }
      setModalOpen(false);
      setDraft(emptyDraft());
      setClienteSelected(null);
      await fetchList();
    } catch (e) {
      showError(e, 'No se pudo crear la remisión');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: number, status: RemissionStatus) => {
    try {
      const res = await api.patch(`/remissions/${id}/status`, { status });
      const updated = (res.data?.data ?? null) as RemissionRow | null;
      if (updated) {
        setRows(prev => prev.map(r => (r.id === id ? updated : r)));
      } else {
        await fetchList();
      }
    } catch (e) {
      showError(e, 'No se pudo cambiar el estado');
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('¿Eliminar esta remisión?')) return;
    try {
      await api.delete(`/remissions/${id}`);
      try { toast.success('Remisión eliminada'); } catch { /* noop */ }
      await fetchList();
    } catch (e) {
      showError(e, 'No se pudo eliminar');
    }
  };

  const convert = async (id: number) => {
    if (!window.confirm('¿Convertir esta remisión en factura de venta?')) return;
    try {
      const res = await api.post(`/remissions/${id}/convert-to-invoice`);
      const inv = res.data?.invoice;
      try {
        toast.success(inv?.number ? `Factura ${inv.number} generada` : 'Factura generada');
      } catch { /* noop */ }
      await fetchList();
    } catch (e) {
      showError(e, 'No se pudo convertir a factura');
    }
  };

  const pendingCount = filtered.filter(
    r => r.status === 'BORRADOR' || r.status === 'ENTREGADA',
  ).length;

  return (
    <>
      <Card className="shadow-sm mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div className="d-flex align-items-center gap-2" style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
              <i className="ri-search-line text-muted" />
              <Input
                type="text"
                placeholder="Buscar por cliente, número o dirección…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                bsSize="sm"
              />
            </div>
            <Button color="primary" onClick={openNew}>
              <i className="ri-add-line me-1" /> Nueva remisión
            </Button>
          </div>

          <Row className="g-3 mb-3">
            <Col md={4}>
              <div className="text-muted fs-12">Remisiones</div>
              <div className="fs-20 fw-semibold">{filtered.length}</div>
            </Col>
            <Col md={4}>
              <div className="text-muted fs-12">Pendientes de facturar</div>
              <div className="fs-20 fw-semibold">{pendingCount}</div>
            </Col>
            <Col md={4}>
              <div className="text-muted fs-12">Estado</div>
              <Badge color="info" className="fs-12">Sincronizado con backend</Badge>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-4">
              <Spinner size="sm" /> <span className="text-muted ms-2">Cargando…</span>
            </div>
          ) : filtered.length === 0 ? (
            <Alert color="light" className="text-center mb-0">
              <i className="ri-truck-line fs-32 text-muted d-block mb-2" />
              {rows.length === 0 ? (
                <>
                  <div className="fw-semibold mb-1">Todavía no hay remisiones</div>
                  <div className="text-muted fs-13 mb-3">
                    Una remisión es la nota de entrega de mercancía antes de facturar —
                    sirve para dejar constancia de lo que salió del inventario.
                  </div>
                  <Button color="primary" size="sm" onClick={openNew}>
                    <i className="ri-add-line me-1" /> Crear la primera
                  </Button>
                </>
              ) : (
                <div className="text-muted fs-13">No hay resultados para &quot;{search}&quot;.</div>
              )}
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 110 }}>Fecha</th>
                    <th style={{ width: 130 }}>N° Remisión</th>
                    <th>Cliente</th>
                    <th>Dirección de entrega</th>
                    <th className="text-end" style={{ width: 130 }}>Total</th>
                    <th style={{ width: 140 }}>Estado</th>
                    <th className="text-end" style={{ width: 160 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const locked = r.status === 'FACTURADA' || r.status === 'ANULADA';
                    return (
                      <tr key={r.id}>
                        <td className="font-monospace fs-13">{r.date}</td>
                        <td className="font-monospace fw-medium">{r.remission_number}</td>
                        <td className="fw-medium">{r.client_name}</td>
                        <td className="text-muted">{r.client_address || '—'}</td>
                        <td className="text-end fw-medium">{fmtMoney(r.total)}</td>
                        <td>
                          {r.status === 'FACTURADA' ? (
                            <Badge color={STATUS_COLOR[r.status]} pill className="fs-11">
                              {STATUS_LABEL[r.status]}
                            </Badge>
                          ) : (
                            <Input
                              type="select"
                              bsSize="sm"
                              value={r.status}
                              onChange={e => changeStatus(r.id, e.target.value as RemissionStatus)}
                              style={{ width: 130 }}
                            >
                              <option value="BORRADOR">Borrador</option>
                              <option value="ENTREGADA">Entregada</option>
                              <option value="ANULADA">Anulada</option>
                            </Input>
                          )}
                        </td>
                        <td className="text-end">
                          {!locked && (
                            <Button
                              color="link"
                              size="sm"
                              className="text-success p-1"
                              onClick={() => convert(r.id)}
                              title="Convertir a factura"
                            >
                              <i className="ri-bill-line" />
                            </Button>
                          )}
                          <Button
                            color="link"
                            size="sm"
                            className="text-danger p-1"
                            onClick={() => remove(r.id)}
                            title="Eliminar"
                            disabled={r.status === 'FACTURADA'}
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
          )}
        </CardBody>
      </Card>

      {/* Modal crear */}
      <Modal isOpen={modalOpen} toggle={closeModal} centered size="lg">
        <ModalHeader toggle={closeModal}>
          <span>Nueva remisión</span>
        </ModalHeader>
        <ModalBody>
          <Form onSubmit={e => { e.preventDefault(); save(); }}>
            <Row className="g-3 mb-3">
              <Col md={4}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Fecha</Label>
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={e => setDraft({ ...draft, date: e.target.value })}
                  />
                </FormGroup>
              </Col>
              <Col md={8}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Cliente</Label>
                  <ClienteSelector
                    value={clienteSelected ? clienteSelected.id : null}
                    onChange={(c: Cliente | null) => setClienteSelected(c)}
                    fallbackLabel={clienteSelected?.name}
                    allowCreate
                  />
                </FormGroup>
              </Col>
              <Col md={12}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Dirección de entrega</Label>
                  <Input
                    type="text"
                    placeholder="Calle / Cra / Apto / Ciudad"
                    value={draft.deliveryAddress}
                    onChange={e => setDraft({ ...draft, deliveryAddress: e.target.value })}
                  />
                </FormGroup>
              </Col>
            </Row>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <Label className="fs-13 mb-0 fw-semibold">Ítems entregados</Label>
              <Button color="light" size="sm" onClick={addItem}>
                <i className="ri-add-line me-1" /> Agregar ítem
              </Button>
            </div>
            <div className="table-responsive mb-3">
              <Table size="sm" className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 160 }}>Producto</th>
                    <th style={{ minWidth: 180 }}>Descripción</th>
                    <th style={{ width: 80 }}>Cant.</th>
                    <th style={{ width: 110 }}>Precio</th>
                    <th style={{ width: 80 }}>Desc.%</th>
                    <th style={{ width: 80 }}>Imp.%</th>
                    <th className="text-end" style={{ width: 110 }}>Total</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <Input
                          type="select"
                          bsSize="sm"
                          value={it.productId == null ? '' : String(it.productId)}
                          onChange={e => pickProduct(idx, e.target.value)}
                        >
                          <option value="">— Libre —</option>
                          {products.map(p => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name}{p.sku ? ` (${p.sku})` : ''}
                            </option>
                          ))}
                        </Input>
                      </td>
                      <td>
                        <Input
                          type="text"
                          bsSize="sm"
                          value={it.description}
                          onChange={e => updateItem(idx, { description: e.target.value })}
                          placeholder="Descripción del ítem"
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          bsSize="sm"
                          min={0}
                          value={it.quantity || ''}
                          onChange={e => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          bsSize="sm"
                          min={0}
                          value={it.unitPrice || ''}
                          onChange={e => updateItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          bsSize="sm"
                          min={0}
                          max={100}
                          value={it.discount || ''}
                          onChange={e => updateItem(idx, { discount: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          bsSize="sm"
                          min={0}
                          max={100}
                          value={it.tax || ''}
                          onChange={e => updateItem(idx, { tax: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="text-end fs-13">{fmtMoney(computeLineTotal(it))}</td>
                      <td className="text-end">
                        <Button
                          color="link"
                          size="sm"
                          className="text-danger p-1"
                          disabled={draft.items.length <= 1}
                          onClick={() => removeItem(idx)}
                        >
                          <i className="ri-close-line" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="text-end text-muted fs-13">Subtotal</td>
                    <td className="text-end fs-13" colSpan={2}>{fmtMoney(totals.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="text-end text-muted fs-13">Descuento</td>
                    <td className="text-end fs-13" colSpan={2}>− {fmtMoney(totals.discount)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="text-end text-muted fs-13">Impuesto</td>
                    <td className="text-end fs-13" colSpan={2}>{fmtMoney(totals.tax)}</td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="text-end fw-semibold">Total</td>
                    <td className="text-end fw-semibold" colSpan={2}>{fmtMoney(totals.total)}</td>
                  </tr>
                </tfoot>
              </Table>
            </div>

            <FormGroup className="mb-0">
              <Label className="fs-13">Observaciones</Label>
              <Input
                type="textarea"
                rows={2}
                placeholder="Opcional — condiciones de entrega, transportadora, etc."
                value={draft.notes}
                onChange={e => setDraft({ ...draft, notes: e.target.value })}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={closeModal} disabled={saving}>Cancelar</Button>
          <Button color="primary" onClick={save} disabled={!canSave || saving}>
            {saving ? <Spinner size="sm" /> : <i className="ri-save-line me-1" />}
            {saving ? ' Guardando…' : ' Guardar remisión'}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default Remisiones;
