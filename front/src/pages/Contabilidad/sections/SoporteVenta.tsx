import React, { useMemo, useState } from 'react';
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
  Table,
} from 'reactstrap';

type MetodoPago = 'efectivo' | 'transferencia' | 'pse' | 'tarjeta';

interface SoporteVentaRow {
  id: string;
  fecha: string;      // ISO yyyy-mm-dd
  cliente: string;
  descripcion: string;
  metodo: MetodoPago;
  monto: number;
}

const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  pse: 'PSE',
  tarjeta: 'Tarjeta',
};

const METODO_COLOR: Record<MetodoPago, string> = {
  efectivo: 'success',
  transferencia: 'info',
  pse: 'primary',
  tarjeta: 'warning',
};

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const LS_KEY = 'bolti_soportes_venta_draft_v1';

const loadInitial = (): SoporteVentaRow[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persist = (rows: SoporteVentaRow[]) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  } catch {
    /* storage lleno u otro error silencioso */
  }
};

const emptyDraft = (): Omit<SoporteVentaRow, 'id'> => ({
  fecha: new Date().toISOString().slice(0, 10),
  cliente: '',
  descripcion: '',
  metodo: 'transferencia',
  monto: 0,
});

const SoporteVenta: React.FC = () => {
  const [rows, setRows] = useState<SoporteVentaRow[]>(loadInitial);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<SoporteVentaRow, 'id'>>(emptyDraft);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      r =>
        r.cliente.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.fecha.includes(q)
    );
  }, [rows, search]);

  const total = useMemo(
    () => filtered.reduce((acc, r) => acc + (Number(r.monto) || 0), 0),
    [filtered]
  );

  const openNew = () => {
    setDraft(emptyDraft());
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const canSave =
    draft.cliente.trim().length > 0 &&
    draft.descripcion.trim().length > 0 &&
    Number(draft.monto) > 0 &&
    !!draft.fecha;

  const save = () => {
    if (!canSave) return;
    const next: SoporteVentaRow = {
      id: (globalThis.crypto?.randomUUID?.() ?? `sv-${Date.now()}`),
      fecha: draft.fecha,
      cliente: draft.cliente.trim(),
      descripcion: draft.descripcion.trim(),
      metodo: draft.metodo,
      monto: Number(draft.monto) || 0,
    };
    const updated = [next, ...rows];
    setRows(updated);
    persist(updated);
    setModalOpen(false);
  };

  const remove = (id: string) => {
    const updated = rows.filter(r => r.id !== id);
    setRows(updated);
    persist(updated);
  };

  return (
    <>
      <Card className="shadow-sm mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div className="d-flex align-items-center gap-2" style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
              <i className="ri-search-line text-muted" />
              <Input
                type="text"
                placeholder="Buscar por cliente, descripción o fecha…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                bsSize="sm"
              />
            </div>
            <Button color="primary" onClick={openNew}>
              <i className="ri-add-line me-1" /> Nuevo soporte
            </Button>
          </div>

          <Row className="g-3 mb-3">
            <Col md={4}>
              <div className="text-muted fs-12">Soportes registrados</div>
              <div className="fs-20 fw-semibold">{filtered.length}</div>
            </Col>
            <Col md={4}>
              <div className="text-muted fs-12">Total del período</div>
              <div className="fs-20 fw-semibold font-monospace">{money(total)}</div>
            </Col>
            <Col md={4}>
              <div className="text-muted fs-12">Estado</div>
              <Badge color="info" className="fs-12">
                Guardado local (sin envío DIAN)
              </Badge>
            </Col>
          </Row>

          {filtered.length === 0 ? (
            <Alert color="light" className="text-center mb-0">
              <i className="ri-inbox-line fs-32 text-muted d-block mb-2" />
              {rows.length === 0 ? (
                <>
                  <div className="fw-semibold mb-1">Todavía no hay soportes de venta</div>
                  <div className="text-muted fs-13 mb-3">
                    Los soportes de venta son registros internos — no se emiten ante la DIAN.
                    Úsalos para ventas que no requieren factura electrónica.
                  </div>
                  <Button color="primary" size="sm" onClick={openNew}>
                    <i className="ri-add-line me-1" /> Crear el primero
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
                    <th>Cliente</th>
                    <th>Descripción</th>
                    <th style={{ width: 140 }}>Método</th>
                    <th className="text-end" style={{ width: 140 }}>Monto</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td className="font-monospace fs-13">{r.fecha}</td>
                      <td className="fw-medium">{r.cliente}</td>
                      <td className="text-muted">{r.descripcion}</td>
                      <td>
                        <Badge color={METODO_COLOR[r.metodo]} className="fs-11">
                          {METODO_LABEL[r.metodo]}
                        </Badge>
                      </td>
                      <td className="text-end font-monospace">{money(r.monto)}</td>
                      <td className="text-end">
                        <Button
                          color="link"
                          size="sm"
                          className="text-danger p-1"
                          onClick={() => remove(r.id)}
                          title="Eliminar"
                        >
                          <i className="ri-delete-bin-line" />
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

      {/* Modal Crear */}
      <Modal isOpen={modalOpen} toggle={closeModal} centered size="md">
        <ModalHeader toggle={closeModal}>
          <span>Nuevo soporte de venta</span>
        </ModalHeader>
        <ModalBody>
          <Form onSubmit={e => { e.preventDefault(); save(); }}>
            <Row className="g-3">
              <Col md={6}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Fecha</Label>
                  <Input
                    type="date"
                    value={draft.fecha}
                    onChange={e => setDraft({ ...draft, fecha: e.target.value })}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Método de pago</Label>
                  <Input
                    type="select"
                    value={draft.metodo}
                    onChange={e => setDraft({ ...draft, metodo: e.target.value as MetodoPago })}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="pse">PSE</option>
                    <option value="tarjeta">Tarjeta</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md={12}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Cliente</Label>
                  <Input
                    type="text"
                    placeholder="Nombre o razón social"
                    value={draft.cliente}
                    onChange={e => setDraft({ ...draft, cliente: e.target.value })}
                    autoFocus
                  />
                </FormGroup>
              </Col>
              <Col md={12}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Descripción</Label>
                  <Input
                    type="textarea"
                    rows={2}
                    placeholder="¿Qué se vendió?"
                    value={draft.descripcion}
                    onChange={e => setDraft({ ...draft, descripcion: e.target.value })}
                  />
                </FormGroup>
              </Col>
              <Col md={12}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Monto</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    placeholder="0"
                    value={draft.monto || ''}
                    onChange={e => setDraft({ ...draft, monto: Number(e.target.value) || 0 })}
                  />
                  <div className="text-muted fs-12 mt-1">Valor en pesos colombianos.</div>
                </FormGroup>
              </Col>
            </Row>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={closeModal}>Cancelar</Button>
          <Button color="primary" onClick={save} disabled={!canSave}>
            <i className="ri-save-line me-1" /> Guardar soporte
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default SoporteVenta;
