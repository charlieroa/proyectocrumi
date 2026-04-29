import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, CardBody, Col, Input, Label, Row, Spinner, Table } from 'reactstrap';
import { API_BASE, fmtDate, money, useAuthHeaders } from '../shared';

type Period = { id: number | string; startDate?: string; endDate?: string; start_date?: string; end_date?: string; status?: string };
type PilaSummary = {
  eps?: number; afp?: number; arl?: number; caja?: number; icbf?: number; sena?: number;
  total?: number; employees?: number;
};

const Pila: React.FC = () => {
  const headers = useAuthHeaders();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selected, setSelected] = useState('');
  const [summary, setSummary] = useState<PilaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<{ color: string; text: string } | null>(null);

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/payroll/periods`, { headers });
      const d = await r.json();
      const list: Period[] = Array.isArray(d?.periods) ? d.periods : (Array.isArray(d) ? d : (d?.data || []));
      setPeriods(list);
      if (!selected && list[0]) setSelected(String(list[0].id));
    } catch { setPeriods([]); }
    setLoading(false);
  }, [headers, selected]);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  const loadSummary = useCallback(async (id: string) => {
    if (!id) { setSummary(null); return; }
    setLoadingSummary(true);
    try {
      const r = await fetch(`${API_BASE}/pila/summary?periodId=${id}`, { headers });
      const d = await r.json();
      setSummary(d?.summary || d || null);
    } catch { setSummary(null); }
    setLoadingSummary(false);
  }, [headers]);

  useEffect(() => { if (selected) loadSummary(selected); }, [selected, loadSummary]);

  const generate = async () => {
    if (!selected) return;
    setGenerating(true); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/pila/generate-flat-file`, {
        method: 'POST', headers, body: JSON.stringify({ periodId: selected }),
      });
      const ctype = r.headers.get('content-type') || '';
      if (ctype.includes('application/json')) {
        const d = await r.json();
        if (!r.ok || d?.success === false) throw new Error(d?.message || 'No se pudo generar');
        if (d?.url) window.open(d.url, '_blank');
        setMsg({ color: 'success', text: d?.message || 'Archivo PILA generado.' });
      } else {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `pila-${selected}.txt`; a.click();
        URL.revokeObjectURL(url);
        setMsg({ color: 'success', text: 'Archivo PILA descargado.' });
      }
    } catch (e: any) { setMsg({ color: 'danger', text: e?.message || 'Error' }); }
    setGenerating(false);
  };

  const rows: { label: string; key: keyof PilaSummary; color: string }[] = [
    { label: 'EPS (Salud)', key: 'eps', color: 'danger' },
    { label: 'AFP (Pensión)', key: 'afp', color: 'primary' },
    { label: 'ARL (Riesgos)', key: 'arl', color: 'warning' },
    { label: 'Caja de Compensación', key: 'caja', color: 'info' },
    { label: 'ICBF', key: 'icbf', color: 'success' },
    { label: 'SENA', key: 'sena', color: 'secondary' },
  ];

  return (
    <>
      <Card className="shadow-sm mb-3">
        <CardBody>
          <Row className="g-2 align-items-end">
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
              <Button color="warning" size="lg" disabled={!selected || generating} onClick={generate}>
                {generating ? <Spinner size="sm" /> : <><i className="ri-download-2-line me-1" /> Generar archivo plano PILA</>}
              </Button>
            </Col>
          </Row>
          {msg && <Alert color={msg.color} className="mt-3 mb-0" toggle={() => setMsg(null)}>{msg.text}</Alert>}
        </CardBody>
      </Card>

      <Card className="shadow-sm">
        <CardBody>
          <h6 className="mb-3">Resumen de aportes</h6>
          {loadingSummary ? (
            <div className="text-center py-4"><Spinner /></div>
          ) : !summary ? (
            <div className="text-center text-muted py-4">Selecciona un período para ver el resumen.</div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Concepto</th>
                    <th className="text-end">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.key}>
                      <td><i className={`ri-checkbox-blank-circle-fill fs-10 text-${r.color} me-2`} />{r.label}</td>
                      <td className="text-end font-monospace">${money(summary[r.key] as number)}</td>
                    </tr>
                  ))}
                  <tr className="table-light fw-bold">
                    <td>Total aportes</td>
                    <td className="text-end font-monospace">${money(summary.total ?? (rows.reduce((s, r) => s + Number(summary[r.key] || 0), 0)))}</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
};

export default Pila;
