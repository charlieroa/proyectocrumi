import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Input,
  Label,
  Nav,
  NavItem,
  NavLink,
  Offcanvas,
  OffcanvasBody,
  OffcanvasHeader,
  Row,
  Spinner,
  Table,
  TabContent,
  TabPane,
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { Plus, Scale, Package, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { API_BASE, API_ROOT, money, useAuthHeaders } from '../shared';

type Product = {
  id: number;
  name: string;
  sku?: string;
  cost?: number | string;
  stock?: number | string;
};

type Movement = {
  id: number;
  movement_date: string;
  movement_type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number | string;
  unit_cost: number | string;
  average_cost: number | string;
  balance_quantity: number | string;
  balance_value: number | string;
  document_type?: string;
  document_number?: string;
  notes?: string;
  product_code?: string;
  product_name?: string;
};

type SummaryRow = {
  product_id: number;
  code?: string;
  name?: string;
  quantity: number | string;
  average_cost: number | string;
  total_value: number | string;
  last_movement_date?: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const firstOfMonthIso = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const TYPE_COLORS: Record<string, string> = { IN: 'success', OUT: 'danger', ADJUST: 'info' };
const TYPE_LABEL: Record<string, string> = { IN: 'Entrada', OUT: 'Salida', ADJUST: 'Ajuste' };

const MONO: React.CSSProperties = { fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' };

const emptyMovementForm = () => ({
  productId: '',
  type: 'IN' as 'IN' | 'OUT' | 'ADJUST',
  quantity: '',
  unitCost: '',
  date: todayIso(),
  notes: '',
});

const Kardex: React.FC = () => {
  const headers = useAuthHeaders();

  const [activeTab, setActiveTab] = useState<'kardex' | 'summary'>('kardex');

  const [products, setProducts] = useState<Product[]>([]);
  const [productPick, setProductPick] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [startDate, setStartDate] = useState(firstOfMonthIso());
  const [endDate, setEndDate] = useState(todayIso());

  const [movements, setMovements] = useState<Movement[]>([]);
  const [currentBalance, setCurrentBalance] = useState<{ qty: number; value: number; avg: number }>({
    qty: 0, value: 0, avg: 0,
  });
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [summaryDate, setSummaryDate] = useState(todayIso());
  const [summaryTotals, setSummaryTotals] = useState<{ totalValue: number; totalUnits: number }>({
    totalValue: 0, totalUnits: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyMovementForm());
  const [saving, setSaving] = useState(false);

  const [countOpen, setCountOpen] = useState(false);
  const [countQty, setCountQty] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [countSaving, setCountSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const candidates = [`${API_ROOT}/products`, `${API_BASE}/products`];
      for (const url of candidates) {
        try {
          const res = await fetch(url, { headers });
          if (!res.ok) continue;
          const data = await res.json();
          const list = data?.products || data?.data || (Array.isArray(data) ? data : []);
          if (Array.isArray(list) && list.length >= 0) {
            setProducts(list);
            return;
          }
        } catch (_) {}
      }
      setProducts([]);
    } catch {
      setProducts([]);
    }
  }, [headers]);

  const loadKardex = useCallback(async () => {
    if (!selectedProduct) {
      setMovements([]);
      setCurrentBalance({ qty: 0, value: 0, avg: 0 });
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        productId: String(selectedProduct.id),
        startDate,
        endDate,
      });
      const res = await fetch(`${API_BASE}/kardex?${qs.toString()}`, { headers });
      const data = await res.json();
      if (data?.success) {
        setMovements(data.movements || []);
        const cb = data.currentBalance || {};
        setCurrentBalance({
          qty: Number(cb.balance_quantity || 0),
          value: Number(cb.balance_value || 0),
          avg: Number(cb.average_cost || 0),
        });
      } else {
        setMovements([]);
      }
    } catch {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [headers, selectedProduct, startDate, endDate]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/kardex/summary?date=${summaryDate}`, { headers });
      const data = await res.json();
      if (data?.success) {
        setSummary(data.items || []);
        setSummaryTotals(data.totals || { totalValue: 0, totalUnits: 0 });
      } else {
        setSummary([]);
      }
    } catch {
      setSummary([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [headers, summaryDate]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadKardex(); }, [loadKardex]);
  useEffect(() => {
    if (activeTab === 'summary') loadSummary();
  }, [activeTab, loadSummary]);

  const onPickProduct = (value: string) => {
    setProductPick(value);
    const m = products.find(
      (p) => p.name === value || p.sku === value || `${p.sku || ''} - ${p.name}` === value,
    );
    if (m) setSelectedProduct(m);
  };

  const lastMovementDate = useMemo(() => {
    if (!movements.length) return '-';
    return movements[movements.length - 1].movement_date?.slice(0, 10) || '-';
  }, [movements]);

  const openCreate = () => {
    setForm({
      ...emptyMovementForm(),
      productId: selectedProduct ? String(selectedProduct.id) : '',
    });
    setCreateOpen(true);
  };

  const saveMovement = async () => {
    if (!form.productId) { Swal.fire({ icon: 'info', title: 'Selecciona un producto', confirmButtonColor: '#1A1D1F' }); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { Swal.fire({ icon: 'info', title: 'Cantidad inválida', confirmButtonColor: '#1A1D1F' }); return; }
    if (form.type === 'IN' && (!form.unitCost || Number(form.unitCost) <= 0)) {
      Swal.fire({ icon: 'info', title: 'Para entradas debes indicar costo unitario', confirmButtonColor: '#1A1D1F' }); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/kardex/movement`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: Number(form.productId),
          type: form.type,
          quantity: Number(form.quantity),
          unitCost: form.unitCost ? Number(form.unitCost) : 0,
          date: form.date,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setCreateOpen(false);
        setForm(emptyMovementForm());
        loadKardex();
      } else {
        Swal.fire({ icon: 'error', title: data?.error || 'No se pudo registrar el movimiento', confirmButtonColor: '#1A1D1F' });
      }
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Error: ' + (e?.message || ''), confirmButtonColor: '#1A1D1F' });
    } finally {
      setSaving(false);
    }
  };

  const openCount = () => {
    if (!selectedProduct) { Swal.fire({ icon: 'info', title: 'Selecciona un producto primero', confirmButtonColor: '#1A1D1F' }); return; }
    setCountQty(String(currentBalance.qty));
    setCountNotes('');
    setCountOpen(true);
  };

  const savePhysicalCount = async () => {
    if (!selectedProduct) return;
    if (countQty === '' || isNaN(Number(countQty))) { alert('Cantidad inválida'); return; }
    setCountSaving(true);
    try {
      const res = await fetch(`${API_BASE}/kardex/physical-count`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: selectedProduct.id,
          actualQuantity: Number(countQty),
          notes: countNotes,
          date: todayIso(),
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setCountOpen(false);
        loadKardex();
      } else {
        alert(data?.error || 'No se pudo registrar el conteo');
      }
    } catch (e: any) {
      alert('Error: ' + (e?.message || ''));
    } finally {
      setCountSaving(false);
    }
  };

  // KPI card reutilizable (mismo estilo que DS / Factura de Venta / Compras)
  const KpiCard: React.FC<{
    label: string;
    value: React.ReactNode;
    Icon: React.ComponentType<any>;
    color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
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
      {/* Acciones (título y "Volver" los provee SectionPage) */}
      <div className="d-flex justify-content-end mb-3 gap-2">
        <Button color="light" onClick={openCount} disabled={!selectedProduct} className="d-inline-flex align-items-center gap-1">
          <Scale size={14} /> Conteo físico
        </Button>
        <Button color="primary" onClick={openCreate} className="d-inline-flex align-items-center gap-1">
          <Plus size={14} /> Nuevo movimiento
        </Button>
      </div>

      <Nav tabs className="mb-3">
        <NavItem>
          <NavLink active={activeTab === 'kardex'} onClick={() => setActiveTab('kardex')} style={{ cursor: 'pointer' }}>
            <i className="ri-list-check-2 me-1" /> Kardex por producto
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} style={{ cursor: 'pointer' }}>
            <i className="ri-stack-line me-1" /> Resumen por producto
          </NavLink>
        </NavItem>
      </Nav>

      <TabContent activeTab={activeTab}>
        <TabPane tabId="kardex">
          <Card className="border-0 shadow-sm mb-3">
            <CardBody>
              <Row className="g-2 align-items-end">
                <Col md={5}>
                  <Label className="form-label mb-1 small">Producto</Label>
                  <Input
                    list="kardex-products"
                    placeholder="Código o nombre del producto"
                    value={productPick}
                    onChange={(e) => onPickProduct(e.target.value)}
                  />
                  <datalist id="kardex-products">
                    {products.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.sku} - stock {p.stock}
                      </option>
                    ))}
                  </datalist>
                </Col>
                <Col md={3}>
                  <Label className="form-label mb-1 small">Desde</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Col>
                <Col md={3}>
                  <Label className="form-label mb-1 small">Hasta</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </Col>
                <Col md={1}>
                  <Button color="light" onClick={loadKardex} disabled={!selectedProduct} className="w-100">
                    <i className="ri-refresh-line" />
                  </Button>
                </Col>
              </Row>
            </CardBody>
          </Card>

          <Row className="g-3 mb-3">
            <Col md={6} xl={3}>
              <KpiCard label="Saldo actual" value={Number(currentBalance.qty).toLocaleString('es-CO')} Icon={Package} color="primary" />
            </Col>
            <Col md={6} xl={3}>
              <KpiCard label="Valor del inventario" value={`$${money(currentBalance.value)}`} Icon={DollarSign} color="success" />
            </Col>
            <Col md={6} xl={3}>
              <KpiCard label="Costo promedio" value={`$${money(currentBalance.avg)}`} Icon={TrendingUp} color="warning" />
            </Col>
            <Col md={6} xl={3}>
              <KpiCard label="Último movimiento" value={lastMovementDate} Icon={Calendar} color="info" />
            </Col>
          </Row>

          <Card className="border-0 shadow-sm">
            <CardBody>
              {!selectedProduct ? (
                <div className="text-center py-5">
                  <i className="ri-search-line" style={{ fontSize: 48, color: '#adb5bd' }} />
                  <p className="text-muted mt-3 mb-0">Selecciona un producto para ver su kardex.</p>
                </div>
              ) : loading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : movements.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ri-inbox-line" style={{ fontSize: 48, color: '#adb5bd' }} />
                  <p className="text-muted mt-3 mb-0">Sin movimientos en el rango seleccionado.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Fecha</th>
                        <th>Documento</th>
                        <th>Tipo</th>
                        <th className="text-end">Cantidad</th>
                        <th className="text-end">Costo unit.</th>
                        <th className="text-end">Costo prom.</th>
                        <th className="text-end">Saldo cant.</th>
                        <th className="text-end">Saldo valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id}>
                          <td>{m.movement_date?.slice(0, 10)}</td>
                          <td>
                            <div className="small">{m.document_type || '-'}</div>
                            <div className="text-muted small">{m.document_number || ''}</div>
                          </td>
                          <td>
                            <Badge color={TYPE_COLORS[m.movement_type] || 'secondary'}>
                              {TYPE_LABEL[m.movement_type] || m.movement_type}
                            </Badge>
                          </td>
                          <td className="text-end" style={MONO}>{Number(m.quantity).toLocaleString('es-CO')}</td>
                          <td className="text-end" style={MONO}>${money(m.unit_cost)}</td>
                          <td className="text-end" style={MONO}>${money(m.average_cost)}</td>
                          <td className="text-end fw-medium" style={MONO}>{Number(m.balance_quantity).toLocaleString('es-CO')}</td>
                          <td className="text-end fw-medium" style={MONO}>${money(m.balance_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </TabPane>

        <TabPane tabId="summary">
          <Card className="border-0 shadow-sm mb-3">
            <CardBody>
              <Row className="g-2 align-items-end">
                <Col md={3}>
                  <Label className="form-label mb-1 small">Fecha de corte</Label>
                  <Input type="date" value={summaryDate} onChange={(e) => setSummaryDate(e.target.value)} />
                </Col>
                <Col md={3}>
                  <Button color="light" onClick={loadSummary} className="w-100">
                    <i className="ri-refresh-line me-1" /> Actualizar
                  </Button>
                </Col>
                <Col md={6} className="text-end">
                  <div className="text-muted small">Valor total del inventario</div>
                  <h4 className="mb-0 text-success" style={MONO}>${money(summaryTotals.totalValue)}</h4>
                </Col>
              </Row>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardBody>
              {summaryLoading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : summary.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ri-inbox-line" style={{ fontSize: 48, color: '#adb5bd' }} />
                  <p className="text-muted mt-3 mb-0">Sin productos para mostrar.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th className="text-end">Cantidad</th>
                        <th className="text-end">Costo prom.</th>
                        <th className="text-end">Valor total</th>
                        <th>Último mov.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((r) => (
                        <tr key={r.product_id}>
                          <td>{r.code || '-'}</td>
                          <td>{r.name || '-'}</td>
                          <td className="text-end" style={MONO}>{Number(r.quantity).toLocaleString('es-CO')}</td>
                          <td className="text-end" style={MONO}>${money(r.average_cost)}</td>
                          <td className="text-end fw-medium" style={MONO}>${money(r.total_value)}</td>
                          <td>{r.last_movement_date?.slice(0, 10) || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </TabPane>
      </TabContent>

      <Offcanvas direction="end" isOpen={createOpen} toggle={() => setCreateOpen(!createOpen)} style={{ width: 480 }}>
        <OffcanvasHeader toggle={() => setCreateOpen(false)}>Nuevo movimiento de kardex</OffcanvasHeader>
        <OffcanvasBody>
          <Row className="g-3">
            <Col md={12}>
              <Label className="form-label">Producto</Label>
              <Input
                type="select"
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
              >
                <option value="">Seleccionar...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku ? `${p.sku} - ` : ''}{p.name}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={6}>
              <Label className="form-label">Tipo</Label>
              <Input
                type="select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              >
                <option value="IN">Entrada</option>
                <option value="OUT">Salida</option>
                <option value="ADJUST">Ajuste</option>
              </Input>
            </Col>
            <Col md={6}>
              <Label className="form-label">Fecha</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Col>
            <Col md={6}>
              <Label className="form-label">Cantidad</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Col>
            <Col md={6}>
              <Label className="form-label">
                Costo unitario {form.type === 'IN' ? '(requerido)' : '(opcional)'}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                disabled={form.type === 'OUT'}
              />
            </Col>
            <Col md={12}>
              <Label className="form-label">Notas</Label>
              <Input
                type="textarea"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Col>
            <Col md={12} className="d-flex justify-content-end gap-2 mt-2">
              <Button color="light" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</Button>
              <Button color="primary" onClick={saveMovement} disabled={saving}>
                {saving ? <Spinner size="sm" /> : <><i className="ri-save-line me-1" />Registrar</>}
              </Button>
            </Col>
          </Row>
        </OffcanvasBody>
      </Offcanvas>

      <Offcanvas direction="end" isOpen={countOpen} toggle={() => setCountOpen(!countOpen)} style={{ width: 420 }}>
        <OffcanvasHeader toggle={() => setCountOpen(false)}>Conteo físico</OffcanvasHeader>
        <OffcanvasBody>
          {selectedProduct && (
            <>
              <div className="mb-3">
                <div className="text-muted small">Producto</div>
                <div className="fw-medium">{selectedProduct.name}</div>
                <div className="small text-muted">{selectedProduct.sku}</div>
              </div>
              <div className="alert alert-info small">
                Actualmente registra <strong style={MONO}>{Number(currentBalance.qty).toLocaleString('es-CO')}</strong> unidades.
                Ingresa la cantidad real contada y se generará un ajuste automático.
              </div>
              <Row className="g-3">
                <Col md={12}>
                  <Label className="form-label">Cantidad contada</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={countQty}
                    onChange={(e) => setCountQty(e.target.value)}
                  />
                </Col>
                <Col md={12}>
                  <Label className="form-label">Notas / responsable</Label>
                  <Input
                    type="textarea"
                    rows={3}
                    value={countNotes}
                    onChange={(e) => setCountNotes(e.target.value)}
                  />
                </Col>
                <Col md={12} className="d-flex justify-content-end gap-2 mt-2">
                  <Button color="light" onClick={() => setCountOpen(false)} disabled={countSaving}>Cancelar</Button>
                  <Button color="primary" onClick={savePhysicalCount} disabled={countSaving}>
                    {countSaving ? <Spinner size="sm" /> : <><i className="ri-check-line me-1" />Aplicar ajuste</>}
                  </Button>
                </Col>
              </Row>
            </>
          )}
        </OffcanvasBody>
      </Offcanvas>
    </div>
  );
};

export default Kardex;
