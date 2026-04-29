import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, CardBody, Spinner, Table } from 'reactstrap';
import { API_BASE, fmtDate, money, statusColor, useAuthHeaders } from '../shared';

type Period = {
  id: number | string;
  startDate?: string; endDate?: string; start_date?: string; end_date?: string;
  status?: string;
  totalNet?: number; total_net?: number; total?: number;
};

const Periodos: React.FC = () => {
  const headers = useAuthHeaders();
  const [rows, setRows] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ color: string; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/payroll/periods`, { headers });
      const d = await r.json();
      const list: Period[] = Array.isArray(d?.periods) ? d.periods : (Array.isArray(d) ? d : (d?.data || []));
      setRows(list);
    } catch { setRows([]); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string | number) => {
    setBusy(String(id)); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/payroll/periods/${id}/approve`, { method: 'POST', headers });
      const d = await r.json();
      if (!r.ok || d?.success === false) throw new Error(d?.message || 'Error al aprobar');
      setMsg({ color: 'success', text: 'Período aprobado.' });
      await load();
    } catch (e: any) { setMsg({ color: 'danger', text: e?.message || 'Error' }); }
    setBusy(null);
  };

  return (
    <Card className="shadow-sm">
      <CardBody>
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h6 className="mb-0">Períodos de nómina</h6>
          <Button color="light" onClick={load}><i className="ri-refresh-line me-1" /> Refrescar</Button>
        </div>
        {msg && <Alert color={msg.color} toggle={() => setMsg(null)}>{msg.text}</Alert>}
        {loading ? (
          <div className="text-center py-4"><Spinner /></div>
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Estado</th>
                  <th className="text-end">Total neto</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted py-4">No hay períodos.</td></tr>
                ) : rows.map(p => {
                  const status = (p.status || '').toLowerCase();
                  const canApprove = status === 'liquidated';
                  return (
                    <tr key={p.id}>
                      <td>{fmtDate(p.startDate || p.start_date)}</td>
                      <td>{fmtDate(p.endDate || p.end_date)}</td>
                      <td><Badge color={statusColor(p.status)} className="text-uppercase">{p.status || 'n/a'}</Badge></td>
                      <td className="text-end font-monospace">${money(p.totalNet ?? p.total_net ?? p.total ?? 0)}</td>
                      <td className="text-end">
                        {canApprove && (
                          <Button size="sm" color="success" disabled={busy === String(p.id)} onClick={() => approve(p.id)}>
                            {busy === String(p.id) ? <Spinner size="sm" /> : <><i className="ri-check-line me-1" /> Aprobar</>}
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
  );
};

export default Periodos;
