import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, CardBody, Col, Form, FormGroup, Input, Label, Row, Spinner, Table } from 'reactstrap';
import { API_BASE, fmtDate, money, useAuthHeaders } from '../shared';

type Period = { id: number | string; startDate?: string; endDate?: string; start_date?: string; end_date?: string; status?: string };
type Liquidation = {
  id: number | string;
  employeeName?: string; employee_name?: string;
  totalEarnings?: number; total_earnings?: number;
  totalDeductions?: number; total_deductions?: number;
  netPay?: number; net_pay?: number;
};

const Liquidar: React.FC = () => {
  const headers = useAuthHeaders();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [liquidating, setLiquidating] = useState(false);
  const [liqs, setLiqs] = useState<Liquidation[]>([]);
  const [msg, setMsg] = useState<{ color: string; text: string } | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/payroll/periods`, { headers });
      const d = await r.json();
      const list: Period[] = Array.isArray(d?.periods) ? d.periods : (Array.isArray(d) ? d : (d?.data || []));
      const open = list.filter(p => ['draft', 'open'].includes((p.status || '').toLowerCase()));
      setPeriods(open.length ? open : list);
      if (!selected && (open[0] || list[0])) setSelected(String((open[0] || list[0]).id));
    } catch (e) { console.error(e); setPeriods([]); }
    setLoading(false);
  }, [headers, selected]);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  const loadLiqs = useCallback(async (id: string) => {
    if (!id) { setLiqs([]); return; }
    try {
      const r = await fetch(`${API_BASE}/payroll/periods/${id}/liquidations`, { headers });
      const d = await r.json();
      const list = Array.isArray(d?.liquidations) ? d.liquidations : (Array.isArray(d) ? d : (d?.data || []));
      setLiqs(list);
    } catch { setLiqs([]); }
  }, [headers]);

  useEffect(() => { if (selected) loadLiqs(selected); }, [selected, loadLiqs]);

  const create = async () => {
    if (!startDate || !endDate) { setMsg({ color: 'warning', text: 'Define fechas de inicio y fin.' }); return; }
    setCreating(true); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/payroll/periods`, { method: 'POST', headers, body: JSON.stringify({ startDate, endDate }) });
      const d = await r.json();
      if (!r.ok || d?.success === false) throw new Error(d?.message || 'No se pudo crear');
      setMsg({ color: 'success', text: 'Período creado.' });
      setStartDate(''); setEndDate('');
      await loadPeriods();
    } catch (e: any) { setMsg({ color: 'danger', text: e?.message || 'Error creando período' }); }
    setCreating(false);
  };

  const liquidate = async () => {
    if (!selected) return;
    setLiquidating(true); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/payroll/periods/${selected}/liquidate`, { method: 'POST', headers });
      const d = await r.json();
      if (!r.ok || d?.success === false) throw new Error(d?.message || 'No se pudo liquidar');
      setMsg({ color: 'success', text: 'Período liquidado correctamente.' });
      await loadLiqs(selected);
    } catch (e: any) { setMsg({ color: 'danger', text: e?.message || 'Error al liquidar' }); }
    setLiquidating(false);
  };

  return (
    <>
      <Card className="shadow-sm mb-3">
        <CardBody>
          <h6 className="mb-3">Crear período nuevo</h6>
          <Form onSubmit={e => { e.preventDefault(); create(); }}>
            <Row className="g-2 align-items-end">
              <Col md={4}>
                <FormGroup className="mb-0">
                  <Label className="fs-12 mb-1">Inicio</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup className="mb-0">
                  <Label className="fs-12 mb-1">Fin</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </FormGroup>
              </Col>
              <Col md={4}>
                <Button color="primary" disabled={creating} onClick={create}>
                  {creating ? <Spinner size="sm" /> : <><i className="ri-add-line me-1" /> Crear período</>}
                </Button>
              </Col>
            </Row>
          </Form>
        </CardBody>
      </Card>

      <Card className="shadow-sm">
        <CardBody>
          <h6 className="mb-3">Liquidar período</h6>
          {msg && <Alert color={msg.color} toggle={() => setMsg(null)}>{msg.text}</Alert>}
          <Row className="g-2 align-items-end mb-3">
            <Col md={6}>
              <Label className="fs-12 mb-1">Período</Label>
              {loading ? <Spinner size="sm" /> : (
                <Input type="select" value={selected} onChange={e => setSelected(e.target.value)}>
                  <option value="">Selecciona un período</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>
                      {fmtDate(p.startDate || p.start_date)} — {fmtDate(p.endDate || p.end_date)} [{p.status || 'n/a'}]
                    </option>
                  ))}
                </Input>
              )}
            </Col>
            <Col md={6}>
              <Button color="success" size="lg" disabled={!selected || liquidating} onClick={liquidate}>
                {liquidating ? <Spinner size="sm" /> : <><i className="ri-calculator-line me-1" /> Liquidar este período</>}
              </Button>
            </Col>
          </Row>

          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Empleado</th>
                  <th className="text-end">Devengado</th>
                  <th className="text-end">Deducciones</th>
                  <th className="text-end">Neto</th>
                </tr>
              </thead>
              <tbody>
                {liqs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-muted py-4">Sin liquidaciones para este período.</td></tr>
                ) : liqs.map(l => (
                  <tr key={l.id}>
                    <td>{l.employeeName || l.employee_name || `ID ${l.id}`}</td>
                    <td className="text-end font-monospace">${money(l.totalEarnings ?? l.total_earnings ?? 0)}</td>
                    <td className="text-end font-monospace">${money(l.totalDeductions ?? l.total_deductions ?? 0)}</td>
                    <td className="text-end font-monospace fw-semibold">${money(l.netPay ?? l.net_pay ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </>
  );
};

export default Liquidar;
