import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, CardBody, Input, Spinner, Table } from 'reactstrap';
import { Link } from 'react-router-dom';
import { API_BASE, useAuthHeaders, tryFetchJson, extractArray, STAGES, normalizeStage, money } from '../shared';

const Oportunidades: React.FC = () => {
  const headers = useAuthHeaders();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await tryFetchJson([`${API_BASE}/crm/opportunities`], headers);
    if (!res.ok) {
      setError('not-available');
    } else {
      setItems(extractArray(res.data));
      setError(null);
    }
    setLoading(false);
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => filter ? items.filter(i => normalizeStage(i.stage) === filter) : items,
    [items, filter]
  );

  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (error === 'not-available') {
    return (
      <Alert color="warning">
        Módulo no disponible, intenta desde <Link to="/crm">/crm</Link>
      </Alert>
    );
  }

  const stageInfo = (key: string) => STAGES.find(s => s.key === key) || { label: key, color: 'secondary' };

  return (
    <Card className="shadow-sm">
      <CardBody>
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div style={{ width: 240 }}>
            <Input type="select" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">Todas las etapas</option>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Input>
          </div>
          <Link to="/crm"><Button color="primary" outline><i className="ri-external-link-line me-1" /> Abrir CRM</Button></Link>
        </div>
        {filtered.length === 0 ? (
          <Alert color="info" className="mb-0">No hay oportunidades para mostrar.</Alert>
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Cliente</th>
                  <th className="text-end">Valor estimado</th>
                  <th>Etapa</th>
                  <th>Fecha cierre</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => {
                  const st = normalizeStage(o.stage);
                  const info = stageInfo(st);
                  return (
                    <tr key={o.id ?? i}>
                      <td>{o.title || o.name || `#${o.id}`}</td>
                      <td>{o.customer || o.client || o.customer_name || '-'}</td>
                      <td className="text-end font-monospace">${money(o.value || o.amount || 0)}</td>
                      <td><Badge color={info.color}>{info.label}</Badge></td>
                      <td>{o.expected_close || o.close_date || '-'}</td>
                      <td className="text-end">
                        <Link to="/crm"><Button size="sm" color="light"><i className="ri-eye-line" /></Button></Link>
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

export default Oportunidades;
