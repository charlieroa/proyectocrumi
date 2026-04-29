import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
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
import { API_ROOT, money, useAuthHeaders } from '../shared';

type Category =
  | 'EDIFICIO'
  | 'VEHICULO'
  | 'EQUIPO_OFICINA'
  | 'MAQUINARIA'
  | 'MUEBLES'
  | 'OTRO';

type AssetStatus = 'ACTIVO' | 'DADO_DE_BAJA' | 'VENDIDO';

type Asset = {
  id: number;
  code?: string | null;
  name: string;
  description?: string | null;
  category?: Category | string;
  acquisition_date: string;
  acquisition_cost: number | string;
  useful_life_months: number;
  depreciation_method?: string;
  salvage_value?: number | string;
  accumulated_depreciation: number | string;
  asset_account_code: string;
  dep_accumulated_account_code: string;
  dep_expense_account_code: string;
  status: AssetStatus | string;
  notes?: string | null;
  book_value?: number;
  monthly_depreciation?: number;
  months_remaining?: number;
};

type DepRow = {
  id: number;
  asset_id: number;
  asset_name?: string;
  asset_code?: string;
  period_year: number;
  period_month: number;
  depreciation_amount: number | string;
  journal_entry_id?: number | null;
  journal_entry_number?: string | null;
};

const CATEGORY_PRESET: Record<
  Category,
  { asset: string; accum: string; expense: string; label: string; color: string }
> = {
  EDIFICIO: { asset: '1516', accum: '1596', expense: '5160', label: 'Edificio', color: 'primary' },
  VEHICULO: { asset: '1540', accum: '1596', expense: '5160', label: 'Vehículo', color: 'info' },
  EQUIPO_OFICINA: { asset: '1524', accum: '1596', expense: '5160', label: 'Equipo de oficina', color: 'warning' },
  MAQUINARIA: { asset: '1520', accum: '1596', expense: '5160', label: 'Maquinaria', color: 'danger' },
  MUEBLES: { asset: '1524', accum: '1596', expense: '5160', label: 'Muebles', color: 'success' },
  OTRO: { asset: '1500', accum: '1596', expense: '5160', label: 'Otro', color: 'secondary' },
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVO: 'success',
  DADO_DE_BAJA: 'secondary',
  VENDIDO: 'warning',
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => {
  const preset = CATEGORY_PRESET.EQUIPO_OFICINA;
  return {
    code: '',
    name: '',
    description: '',
    category: 'EQUIPO_OFICINA' as Category,
    acquisition_date: todayIso(),
    acquisition_cost: 0,
    useful_life_months: 60,
    salvage_value: 0,
    asset_account_code: preset.asset,
    dep_accumulated_account_code: preset.accum,
    dep_expense_account_code: preset.expense,
    notes: '',
  };
};

const ActivosFijos: React.FC = () => {
  const headers = useAuthHeaders();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AssetStatus>('all');

  const [drawerCreate, setDrawerCreate] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [drawerDetail, setDrawerDetail] = useState<Asset | null>(null);
  const [history, setHistory] = useState<DepRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [depYear, setDepYear] = useState(new Date().getFullYear());
  const [depMonth, setDepMonth] = useState(new Date().getMonth() + 1);
  const [depRunning, setDepRunning] = useState(false);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/fixed-assets`, { headers });
      const data = await res.json();
      setAssets(data?.success ? data.assets || [] : []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const loadHistory = useCallback(
    async (assetId: number) => {
      setLoadingHistory(true);
      try {
        const res = await fetch(
          `${API_ROOT}/fixed-assets/depreciation-history?assetId=${assetId}`,
          { headers }
        );
        const data = await res.json();
        setHistory(data?.success ? data.depreciations || [] : []);
      } catch {
        setHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    },
    [headers]
  );

  const openDetail = async (a: Asset) => {
    setDrawerDetail(a);
    await loadHistory(a.id);
  };

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${a.code || ''} ${a.name || ''} ${a.category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [assets, search, statusFilter]);

  const kpis = useMemo(() => {
    let count = 0;
    let cost = 0;
    let acc = 0;
    let book = 0;
    for (const a of assets) {
      if (a.status !== 'ACTIVO') continue;
      count += 1;
      cost += Number(a.acquisition_cost || 0);
      acc += Number(a.accumulated_depreciation || 0);
      book += Number(a.book_value || 0);
    }
    return { count, cost, acc, book };
  }, [assets]);

  const monthPreview = useMemo(() => {
    let total = 0;
    let n = 0;
    for (const a of assets) {
      if (a.status !== 'ACTIVO') continue;
      const monthly = Number(a.monthly_depreciation || 0);
      const remaining = Number(a.book_value || 0) - Number(a.salvage_value || 0);
      const amount = Math.min(monthly, Math.max(0, remaining));
      if (amount > 0) {
        total += amount;
        n += 1;
      }
    }
    return { total, count: n };
  }, [assets]);

  const setCategory = (cat: Category) => {
    const p = CATEGORY_PRESET[cat];
    setForm((f) => ({
      ...f,
      category: cat,
      asset_account_code: p.asset,
      dep_accumulated_account_code: p.accum,
      dep_expense_account_code: p.expense,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDrawerCreate(true);
  };

  const openEdit = (a: Asset) => {
    setEditing(a);
    setForm({
      code: a.code || '',
      name: a.name,
      description: a.description || '',
      category: (a.category as Category) || 'OTRO',
      acquisition_date: String(a.acquisition_date).slice(0, 10),
      acquisition_cost: Number(a.acquisition_cost),
      useful_life_months: Number(a.useful_life_months),
      salvage_value: Number(a.salvage_value || 0),
      asset_account_code: a.asset_account_code,
      dep_accumulated_account_code: a.dep_accumulated_account_code,
      dep_expense_account_code: a.dep_expense_account_code,
      notes: a.notes || '',
    });
    setDrawerCreate(true);
  };

  const canSave =
    form.name.trim().length > 0 &&
    Number(form.acquisition_cost) > 0 &&
    Number(form.useful_life_months) > 0 &&
    !!form.asset_account_code &&
    !!form.dep_accumulated_account_code &&
    !!form.dep_expense_account_code;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const url = editing
        ? `${API_ROOT}/fixed-assets/${editing.id}`
        : `${API_ROOT}/fixed-assets`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data?.success) {
        setDrawerCreate(false);
        await loadAssets();
      } else {
        alert(data?.error || 'No se pudo guardar');
      }
    } catch {
      alert('Error de red');
    } finally {
      setSaving(false);
    }
  };

  const handleDispose = async (a: Asset) => {
    if (!window.confirm(`¿Dar de baja el activo "${a.name}"? Se generará el asiento contable de baja.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_ROOT}/fixed-assets/${a.id}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          disposal_date: todayIso(),
          disposal_value: 0,
          generate_journal: true,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setDrawerDetail(null);
        await loadAssets();
      } else {
        alert(data?.error || 'No se pudo dar de baja');
      }
    } catch {
      alert('Error de red');
    }
  };

  const handleDepreciate = async () => {
    setDepRunning(true);
    try {
      const res = await fetch(`${API_ROOT}/fixed-assets/depreciate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ year: depYear, month: depMonth }),
      });
      const data = await res.json();
      if (data?.success) {
        alert(
          `Depreciación registrada.\nActivos procesados: ${data.assets_processed}\nTotal: $${money(
            data.total_depreciation
          )}\nAsiento: ${data.journal?.entryNumber || '—'}`
        );
        setConfirmOpen(false);
        await loadAssets();
      } else {
        alert(data?.error || 'No se pudo depreciar');
      }
    } catch {
      alert('Error de red');
    } finally {
      setDepRunning(false);
    }
  };

  const renderCategory = (c?: string) => {
    const preset = CATEGORY_PRESET[(c as Category) || 'OTRO'] || CATEGORY_PRESET.OTRO;
    return (
      <Badge color={preset.color} className={`badge-soft-${preset.color}`}>
        {preset.label}
      </Badge>
    );
  };

  const renderStatus = (s?: string) => {
    const color = STATUS_COLORS[s || ''] || 'light';
    return (
      <Badge color={color} className={`badge-soft-${color}`}>
        {s || '—'}
      </Badge>
    );
  };

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h4 className="mb-1">Activos fijos y depreciación</h4>
          <small className="text-muted">
            Gestión de activos fijos con depreciación lineal mensual automática.
          </small>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="position-relative">
            <Input
              type="text"
              placeholder="Buscar activo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32, minWidth: 220 }}
            />
            <i
              className="ri-search-line position-absolute"
              style={{ left: 10, top: 8, color: '#888' }}
            />
          </div>
          <Input
            type="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ maxWidth: 180 }}
          >
            <option value="all">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="DADO_DE_BAJA">Dados de baja</option>
            <option value="VENDIDO">Vendidos</option>
          </Input>
          <Button color="light" onClick={openCreate}>
            <i className="ri-add-line me-1" />
            Nuevo activo
          </Button>
          <Button color="primary" onClick={() => setConfirmOpen(true)}>
            <i className="ri-calendar-check-line me-1" />
            Depreciar mes
          </Button>
        </div>
      </div>

      <Alert color="info" className="d-flex align-items-start gap-2">
        <i className="ri-information-line" style={{ fontSize: 18, marginTop: 2 }} />
        <div>
          Los activos se deprecian mensualmente. Ejecuta <strong>"Depreciar mes"</strong> al cierre
          de cada mes para registrar el gasto contable automáticamente.
        </div>
      </Alert>

      <Row className="g-3 mb-3">
        <Col md={3} sm={6}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <small className="text-muted d-block">Total activos (vigentes)</small>
              <h4 className="mb-0 mt-1">{kpis.count}</h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <small className="text-muted d-block">Costo histórico</small>
              <h4 className="mb-0 mt-1" style={{ fontFamily: 'monospace' }}>
                ${money(kpis.cost)}
              </h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <small className="text-muted d-block">Depreciación acumulada</small>
              <h4 className="mb-0 mt-1 text-warning" style={{ fontFamily: 'monospace' }}>
                ${money(kpis.acc)}
              </h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3} sm={6}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <small className="text-muted d-block">Valor en libros</small>
              <h4 className="mb-0 mt-1 text-primary" style={{ fontFamily: 'monospace' }}>
                ${money(kpis.book)}
              </h4>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <CardBody className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="ri-archive-line" style={{ fontSize: 48, opacity: 0.4 }} />
              <div className="mt-2">No hay activos fijos registrados.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Adquisición</th>
                    <th className="text-end">Costo</th>
                    <th className="text-end">Dep. acumulada</th>
                    <th className="text-end">Valor en libros</th>
                    <th className="text-end">Meses rest.</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr
                      key={a.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => openDetail(a)}
                    >
                      <td>
                        <Badge color="dark" className="badge-soft-dark">
                          {a.code || `#${a.id}`}
                        </Badge>
                      </td>
                      <td>
                        <strong>{a.name}</strong>
                      </td>
                      <td>{renderCategory(a.category)}</td>
                      <td>{String(a.acquisition_date).slice(0, 10)}</td>
                      <td className="text-end" style={{ fontFamily: 'monospace' }}>
                        {money(a.acquisition_cost)}
                      </td>
                      <td className="text-end text-warning" style={{ fontFamily: 'monospace' }}>
                        {money(a.accumulated_depreciation)}
                      </td>
                      <td className="text-end text-primary" style={{ fontFamily: 'monospace' }}>
                        {money(a.book_value || 0)}
                      </td>
                      <td className="text-end">{a.months_remaining ?? '—'}</td>
                      <td>{renderStatus(a.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <Offcanvas
        isOpen={drawerCreate}
        toggle={() => setDrawerCreate(false)}
        direction="end"
        style={{ width: 560 }}
      >
        <OffcanvasHeader toggle={() => setDrawerCreate(false)}>
          {editing ? 'Editar activo fijo' : 'Nuevo activo fijo'}
        </OffcanvasHeader>
        <OffcanvasBody>
          <Row className="g-3">
            <Col xs={4}>
              <Label className="form-label mb-1">Código</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="AF-001"
              />
            </Col>
            <Col xs={8}>
              <Label className="form-label mb-1">Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Computador Dell Latitude"
              />
            </Col>
            <Col xs={6}>
              <Label className="form-label mb-1">Categoría</Label>
              <Input
                type="select"
                value={form.category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {Object.entries(CATEGORY_PRESET).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.label}
                  </option>
                ))}
              </Input>
            </Col>
            <Col xs={6}>
              <Label className="form-label mb-1">Fecha de adquisición</Label>
              <Input
                type="date"
                value={form.acquisition_date}
                onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })}
              />
            </Col>
            <Col xs={6}>
              <Label className="form-label mb-1">Costo de adquisición</Label>
              <Input
                type="number"
                min={0}
                value={form.acquisition_cost}
                onChange={(e) =>
                  setForm({ ...form, acquisition_cost: Number(e.target.value) })
                }
              />
            </Col>
            <Col xs={3}>
              <Label className="form-label mb-1">Vida útil (meses)</Label>
              <Input
                type="number"
                min={1}
                value={form.useful_life_months}
                onChange={(e) =>
                  setForm({ ...form, useful_life_months: Number(e.target.value) })
                }
              />
            </Col>
            <Col xs={3}>
              <Label className="form-label mb-1">Valor residual</Label>
              <Input
                type="number"
                min={0}
                value={form.salvage_value}
                onChange={(e) =>
                  setForm({ ...form, salvage_value: Number(e.target.value) })
                }
              />
            </Col>
            <Col xs={12}>
              <small className="text-muted">
                Cuota mensual estimada:{' '}
                <strong>
                  $
                  {money(
                    Number(form.useful_life_months) > 0
                      ? (Number(form.acquisition_cost) - Number(form.salvage_value)) /
                          Number(form.useful_life_months)
                      : 0
                  )}
                </strong>
              </small>
            </Col>
            <Col xs={4}>
              <Label className="form-label mb-1">Cuenta activo</Label>
              <Input
                value={form.asset_account_code}
                onChange={(e) =>
                  setForm({ ...form, asset_account_code: e.target.value })
                }
              />
            </Col>
            <Col xs={4}>
              <Label className="form-label mb-1">Dep. acumulada</Label>
              <Input
                value={form.dep_accumulated_account_code}
                onChange={(e) =>
                  setForm({ ...form, dep_accumulated_account_code: e.target.value })
                }
              />
            </Col>
            <Col xs={4}>
              <Label className="form-label mb-1">Gasto depreciación</Label>
              <Input
                value={form.dep_expense_account_code}
                onChange={(e) =>
                  setForm({ ...form, dep_expense_account_code: e.target.value })
                }
              />
            </Col>
            <Col xs={12}>
              <Label className="form-label mb-1">Notas</Label>
              <Input
                type="textarea"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Col>
          </Row>

          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button
              color="light"
              onClick={() => setDrawerCreate(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button color="primary" disabled={!canSave || saving} onClick={handleSave}>
              {saving ? <Spinner size="sm" /> : editing ? 'Guardar cambios' : 'Crear activo'}
            </Button>
          </div>
        </OffcanvasBody>
      </Offcanvas>

      <Offcanvas
        isOpen={!!drawerDetail}
        toggle={() => setDrawerDetail(null)}
        direction="end"
        style={{ width: 600 }}
      >
        <OffcanvasHeader toggle={() => setDrawerDetail(null)}>
          Detalle de activo fijo
        </OffcanvasHeader>
        <OffcanvasBody>
          {drawerDetail && (
            <>
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <Badge color="dark" className="badge-soft-dark me-2">
                    {drawerDetail.code || `#${drawerDetail.id}`}
                  </Badge>
                  <h5 className="d-inline-block mb-0">{drawerDetail.name}</h5>
                  <div className="mt-1">
                    {renderCategory(drawerDetail.category)} {renderStatus(drawerDetail.status)}
                  </div>
                </div>
              </div>

              <Card className="mb-3 border-0 bg-light">
                <CardBody>
                  <Row className="g-2">
                    <Col xs={6}>
                      <small className="text-muted d-block">Fecha de adquisición</small>
                      <strong>{String(drawerDetail.acquisition_date).slice(0, 10)}</strong>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block">Vida útil</small>
                      <strong>{drawerDetail.useful_life_months} meses</strong>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block">Costo</small>
                      <strong style={{ fontFamily: 'monospace' }}>
                        ${money(drawerDetail.acquisition_cost)}
                      </strong>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block">Valor residual</small>
                      <strong style={{ fontFamily: 'monospace' }}>
                        ${money(drawerDetail.salvage_value || 0)}
                      </strong>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block">Depreciación acumulada</small>
                      <strong className="text-warning" style={{ fontFamily: 'monospace' }}>
                        ${money(drawerDetail.accumulated_depreciation)}
                      </strong>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block">Valor en libros</small>
                      <strong className="text-primary" style={{ fontFamily: 'monospace' }}>
                        ${money(drawerDetail.book_value || 0)}
                      </strong>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block">Cuota mensual</small>
                      <strong style={{ fontFamily: 'monospace' }}>
                        ${money(drawerDetail.monthly_depreciation || 0)}
                      </strong>
                    </Col>
                    <Col xs={6}>
                      <small className="text-muted d-block">Meses restantes</small>
                      <strong>{drawerDetail.months_remaining ?? '—'}</strong>
                    </Col>
                    <Col xs={12}>
                      <small className="text-muted d-block">Cuentas PUC</small>
                      <span className="me-2">
                        Activo: <strong>{drawerDetail.asset_account_code}</strong>
                      </span>
                      <span className="me-2">
                        Acum: <strong>{drawerDetail.dep_accumulated_account_code}</strong>
                      </span>
                      <span>
                        Gasto: <strong>{drawerDetail.dep_expense_account_code}</strong>
                      </span>
                    </Col>
                    {drawerDetail.notes && (
                      <Col xs={12}>
                        <small className="text-muted d-block">Notas</small>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{drawerDetail.notes}</div>
                      </Col>
                    )}
                  </Row>
                </CardBody>
              </Card>

              <div className="d-flex gap-2 mb-3">
                <Button color="light" size="sm" onClick={() => openEdit(drawerDetail)}>
                  <i className="ri-edit-line me-1" />
                  Editar
                </Button>
                {drawerDetail.status === 'ACTIVO' && (
                  <Button
                    color="danger"
                    size="sm"
                    outline
                    onClick={() => handleDispose(drawerDetail)}
                  >
                    <i className="ri-delete-bin-line me-1" />
                    Dar de baja
                  </Button>
                )}
              </div>

              <h6 className="mb-2">
                <i className="ri-history-line me-1" />
                Historial de depreciaciones
              </h6>
              {loadingHistory ? (
                <div className="text-center py-3">
                  <Spinner size="sm" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-3 text-muted small">
                  Sin depreciaciones registradas.
                </div>
              ) : (
                <div className="table-responsive">
                  <Table size="sm" className="align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Período</th>
                        <th className="text-end">Monto</th>
                        <th>Asiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td>
                            {h.period_year}-{String(h.period_month).padStart(2, '0')}
                          </td>
                          <td className="text-end" style={{ fontFamily: 'monospace' }}>
                            {money(h.depreciation_amount)}
                          </td>
                          <td>
                            {h.journal_entry_number ? (
                              <Badge color="info" className="badge-soft-info">
                                {h.journal_entry_number}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </>
          )}
        </OffcanvasBody>
      </Offcanvas>

      <Modal isOpen={confirmOpen} toggle={() => setConfirmOpen(false)} centered>
        <ModalHeader toggle={() => setConfirmOpen(false)}>
          Depreciar mes
        </ModalHeader>
        <ModalBody>
          <Row className="g-2 mb-3">
            <Col xs={6}>
              <Label className="form-label mb-1">Año</Label>
              <Input
                type="number"
                value={depYear}
                onChange={(e) => setDepYear(Number(e.target.value))}
              />
            </Col>
            <Col xs={6}>
              <Label className="form-label mb-1">Mes</Label>
              <Input
                type="select"
                value={depMonth}
                onChange={(e) => setDepMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Input>
            </Col>
          </Row>

          <Alert color="warning" className="mb-2">
            <div>
              Vas a registrar la depreciación de{' '}
              <strong>
                {MONTH_NAMES[depMonth - 1]} {depYear}
              </strong>
              .
            </div>
            <hr className="my-2" />
            <div className="d-flex justify-content-between">
              <span>Activos a procesar:</span>
              <strong>{monthPreview.count}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span>Gasto total estimado:</span>
              <strong style={{ fontFamily: 'monospace' }}>
                ${money(monthPreview.total)}
              </strong>
            </div>
          </Alert>
          <small className="text-muted">
            Se generará un asiento contable consolidado tipo DEPRECIACION_MENSUAL. Si el período ya
            fue depreciado, la operación será rechazada.
          </small>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setConfirmOpen(false)} disabled={depRunning}>
            Cancelar
          </Button>
          <Button color="primary" onClick={handleDepreciate} disabled={depRunning || monthPreview.count === 0}>
            {depRunning ? <Spinner size="sm" /> : 'Confirmar y depreciar'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default ActivosFijos;
