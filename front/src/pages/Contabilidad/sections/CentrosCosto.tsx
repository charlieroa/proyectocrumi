import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  CostCenter,
  getCostCenters,
  createCostCenter,
  updateCostCenter,
  deleteCostCenter,
} from '../../../services/costCenterApi';

interface Draft {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

const emptyDraft = (): Draft => ({ code: '', name: '', description: '', is_active: true });

const CentrosCosto: React.FC = () => {
  const [rows, setRows] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<'Activos' | 'Inactivos' | 'Todos'>('Activos');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await getCostCenters();
      setRows(r.data || []);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'Error cargando centros de costo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterEstado === 'Activos' && !r.is_active) return false;
      if (filterEstado === 'Inactivos' && r.is_active) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, filterEstado]);

  const openNew = () => {
    setEditId(null);
    setDraft(emptyDraft());
    setModalOpen(true);
  };

  const openEdit = (r: CostCenter) => {
    setEditId(r.id);
    setDraft({
      code: r.code,
      name: r.name,
      description: r.description || '',
      is_active: r.is_active,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditId(null);
  };

  const save = async () => {
    if (!draft.code.trim() || !draft.name.trim()) {
      setErrorMsg('Código y nombre son obligatorios.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        code: draft.code.trim().toUpperCase(),
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        is_active: draft.is_active,
      };
      if (editId) {
        await updateCostCenter(editId, payload);
      } else {
        await createCostCenter(payload);
      }
      await load();
      setModalOpen(false);
      setEditId(null);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: CostCenter) => {
    if (!window.confirm(`¿Desactivar centro de costo "${r.code} — ${r.name}"?`)) return;
    try {
      await deleteCostCenter(r.id);
      await load();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'No se pudo eliminar.');
    }
  };

  const toggleActivo = async (r: CostCenter) => {
    try {
      await updateCostCenter(r.id, { is_active: !r.is_active });
      await load();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'No se pudo actualizar.');
    }
  };

  return (
    <>
      <Card className="shadow-sm mb-3">
        <CardBody>
          {errorMsg && (
            <Alert color="danger" toggle={() => setErrorMsg(null)} className="mb-3">
              {errorMsg}
            </Alert>
          )}

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 className="mb-0">Centros de costo</h5>
            <Button color="primary" onClick={openNew}>
              <i className="ri-add-line me-1" /> Nuevo centro de costo
            </Button>
          </div>

          <Row className="g-2 mb-3 align-items-end">
            <Col md={6}>
              <Label className="fs-13 mb-1">Buscar</Label>
              <Input
                type="text"
                placeholder="Código, nombre, descripción…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                bsSize="sm"
              />
            </Col>
            <Col md={3}>
              <Label className="fs-13 mb-1">Estado</Label>
              <Input
                type="select"
                bsSize="sm"
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value as any)}
              >
                <option value="Activos">Activos</option>
                <option value="Inactivos">Inactivos</option>
                <option value="Todos">Todos</option>
              </Input>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-5">
              <Spinner color="primary" /> <div className="text-muted mt-2">Cargando…</div>
            </div>
          ) : filtered.length === 0 ? (
            <Alert color="light" className="text-center mb-0">
              <i className="ri-pie-chart-line fs-32 text-muted d-block mb-2" />
              {rows.length === 0 ? (
                <>
                  <div className="fw-semibold mb-1">Aún no hay centros de costo</div>
                  <div className="text-muted fs-13 mb-3">
                    Crea CC como "Ventas", "Administración", "Producción" para clasificar gastos e
                    ingresos.
                  </div>
                  <Button color="primary" size="sm" onClick={openNew}>
                    <i className="ri-add-line me-1" /> Crear el primero
                  </Button>
                </>
              ) : (
                <div className="text-muted fs-13">No hay resultados con los filtros actuales.</div>
              )}
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 140 }}>Código</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th style={{ width: 100 }}>Estado</th>
                    <th className="text-end" style={{ width: 130 }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="font-monospace fw-medium">{r.code}</td>
                      <td>
                        <Button
                          color="link"
                          className="p-0 text-start text-decoration-none fw-medium"
                          onClick={() => openEdit(r)}
                        >
                          {r.name}
                        </Button>
                      </td>
                      <td className="text-muted fs-13">{r.description || '—'}</td>
                      <td>
                        <Badge color={r.is_active ? 'success' : 'light'} className="fs-11">
                          {r.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <Button
                          color="link"
                          size="sm"
                          className="text-primary p-1"
                          onClick={() => openEdit(r)}
                          title="Editar"
                        >
                          <i className="ri-edit-line" />
                        </Button>
                        <Button
                          color="link"
                          size="sm"
                          className="text-secondary p-1"
                          onClick={() => toggleActivo(r)}
                          title={r.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <i className="ri-toggle-line" />
                        </Button>
                        <Button
                          color="link"
                          size="sm"
                          className="text-danger p-1"
                          onClick={() => remove(r)}
                          title="Desactivar"
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

      <Modal isOpen={modalOpen} toggle={closeModal} centered backdrop="static">
        <ModalHeader toggle={closeModal}>
          {editId ? 'Editar centro de costo' : 'Nuevo centro de costo'}
        </ModalHeader>
        <ModalBody>
          <Form onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Row className="g-3">
              <Col md={4}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">
                    Código <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="CC01"
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                    autoFocus
                  />
                </FormGroup>
              </Col>
              <Col md={8}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">
                    Nombre <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="Ej: Ventas / Administración / Producción"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </FormGroup>
              </Col>
              <Col md={12}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Descripción (opcional)</Label>
                  <Input
                    type="textarea"
                    rows={2}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </FormGroup>
              </Col>
              <Col md={12}>
                <FormGroup check className="mb-0">
                  <Input
                    type="checkbox"
                    id="cc-active"
                    checked={draft.is_active}
                    onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  />
                  <Label check htmlFor="cc-active" className="fs-13">
                    Activo
                  </Label>
                </FormGroup>
              </Col>
            </Row>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={closeModal} disabled={saving}>
            Cancelar
          </Button>
          <Button color="primary" onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <i className="ri-save-line me-1" />}
            {editId ? ' Guardar' : ' Crear'}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default CentrosCosto;
