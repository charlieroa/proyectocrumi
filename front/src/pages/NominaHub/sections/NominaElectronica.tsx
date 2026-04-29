import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, CardBody, Col, Row, Spinner, Table } from 'reactstrap';
import { API_BASE, fmtDate, statusColor, useAuthHeaders } from '../shared';

type NEStatus = { enabled?: boolean; lastSync?: string; last_sync?: string; status?: string; message?: string };
type NEPeriod = {
  id: number | string; periodId?: number | string;
  startDate?: string; endDate?: string; start_date?: string; end_date?: string;
  electronicStatus?: string; status?: string; syncedAt?: string;
};

const NominaElectronica: React.FC = () => {
  const headers = useAuthHeaders();
  const [status, setStatus] = useState<NEStatus | null>(null);
  const [periods, setPeriods] = useState<NEPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ color: string; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetch(`${API_BASE}/alegra/payroll-electronic/status`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/alegra/payroll-electronic/periods`, { headers }).then(r => r.json()).catch(() => null),
      ]);
      setStatus(s?.status || s || null);
      const list = Array.isArray(p?.periods) ? p.periods : (Array.isArray(p) ? p : (p?.data || []));
      setPeriods(list);
    } catch { setStatus(null); setPeriods([]); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const act = async (path: 'prepare' | 'sync', periodId: string | number) => {
    setBusy(`${path}-${periodId}`); setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/alegra/payroll-electronic/${path}`, {
        method: 'POST', headers, body: JSON.stringify({ periodId }),
      });
      const d = await r.json();
      if (!r.ok || d?.success === false) throw new Error(d?.message || `Error al ${path}`);
      setMsg({ color: 'success', text: path === 'prepare' ? 'Período preparado.' : 'Período sincronizado con DIAN.' });
      await load();
    } catch (e: any) { setMsg({ color: 'danger', text: e?.message || 'Error' }); }
    setBusy(null);
  };

  const enabled = !!(status?.enabled);
  const lastSync = status?.lastSync || status?.last_sync;

  return (
    <>
      <Row className="g-3 mb-3">
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <CardBody className="d-flex align-items-center">
              <div className={`avatar-sm rounded-circle d-flex align-items-center justify-content-center bg-${enabled ? 'success' : 'warning'}-subtle me-3`} style={{ width: 48, height: 48 }}>
                <i className={`ri-government-line fs-24 text-${enabled ? 'success' : 'warning'}`} />
              </div>
              <div>
                <div className="text-muted fs-12">Estado DIAN</div>
                <div className="fs-16 fw-semibold">
                  {loading ? <Spinner size="sm" /> : (enabled ? 'Habilitado' : 'Pendiente de configuración')}
                </div>
                {status?.message && <div className="text-muted fs-12">{status.message}</div>}
              </div>
            </CardBody>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <CardBody className="d-flex align-items-center">
              <div className="avatar-sm rounded-circle d-flex align-items-center justify-content-center bg-info-subtle me-3" style={{ width: 48, height: 48 }}>
                <i className="ri-time-line fs-24 text-info" />
              </div>
              <div>
                <div className="text-muted fs-12">Última sincronización</div>
                <div className="fs-16 fw-semibold">{loading ? <Spinner size="sm" /> : fmtDate(lastSync)}</div>
              </div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <h6 className="mb-0">Períodos y su estado electrónico</h6>
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
                    <th>Estado electrónico</th>
                    <th>Sincronizado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-muted py-4">Sin períodos disponibles.</td></tr>
                  ) : periods.map(p => {
                    const pid = p.periodId || p.id;
                    const st = (p.electronicStatus || p.status || 'pending').toLowerCase();
                    return (
                      <tr key={String(pid)}>
                        <td>{fmtDate(p.startDate || p.start_date)}</td>
                        <td>{fmtDate(p.endDate || p.end_date)}</td>
                        <td><Badge color={statusColor(st)} className="text-uppercase">{st}</Badge></td>
                        <td>{fmtDate(p.syncedAt)}</td>
                        <td className="text-end">
                          <Button size="sm" color="info" className="me-1"
                                  disabled={busy === `prepare-${pid}` || st === 'synced'}
                                  onClick={() => act('prepare', pid!)}>
                            {busy === `prepare-${pid}` ? <Spinner size="sm" /> : <><i className="ri-file-edit-line me-1" />Preparar</>}
                          </Button>
                          <Button size="sm" color="success"
                                  disabled={busy === `sync-${pid}` || st === 'synced'}
                                  onClick={() => act('sync', pid!)}>
                            {busy === `sync-${pid}` ? <Spinner size="sm" /> : <><i className="ri-upload-cloud-line me-1" />Sincronizar</>}
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
    </>
  );
};

export default NominaElectronica;
