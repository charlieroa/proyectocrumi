import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Card, CardBody, Col, Row, Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import { API_BASE, useAuthHeaders, tryFetchJson, extractArray, STAGES, normalizeStage, money } from '../shared';

const EmbudoVentas: React.FC = () => {
  const headers = useAuthHeaders();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const leadsRes = await tryFetchJson([`${API_BASE}/crm/leads`], headers);
    const oppsRes = await tryFetchJson([`${API_BASE}/crm/opportunities`], headers);
    if (!leadsRes.ok && !oppsRes.ok) {
      setError('not-available');
    } else {
      const leads = extractArray(leadsRes.data).map((l: any) => ({ ...l, __type: 'lead' }));
      const opps = extractArray(oppsRes.data).map((o: any) => ({ ...o, __type: 'opportunity' }));
      setItems([...leads, ...opps]);
      setError(null);
    }
    setLoading(false);
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (error === 'not-available') {
    return (
      <Alert color="warning">
        Módulo no disponible, intenta desde <Link to="/crm">/crm</Link>
      </Alert>
    );
  }

  const byStage = (key: string) => items.filter(i => normalizeStage(i.stage) === key);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="text-muted fs-13">Oportunidades agrupadas por etapa. Clic en una tarjeta para ver el detalle.</div>
      </div>
      {items.length === 0 ? (
        <Alert color="info">Aún no hay leads ni oportunidades. Crea uno desde <Link to="/crm">/crm</Link>.</Alert>
      ) : (
        <Row className="g-2" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {STAGES.map(s => {
            const list = byStage(s.key);
            const total = list.reduce((a, b) => a + Number(b.value || b.amount || 0), 0);
            return (
              <Col key={s.key} style={{ minWidth: 240 }}>
                <Card className="shadow-sm h-100">
                  <CardBody>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <Badge color={s.color} pill>{s.label}</Badge>
                      <span className="text-muted fs-12">{list.length}</span>
                    </div>
                    <div className="text-muted fs-12 mb-2 font-monospace">${money(total)}</div>
                    <div className="d-flex flex-column gap-2">
                      {list.length === 0 && <div className="text-muted fs-12 fst-italic">Sin items</div>}
                      {list.map((it, idx) => (
                        <Card key={idx} className="border">
                          <CardBody className="p-2">
                            <div className="fw-semibold fs-13 text-truncate">{it.title || it.name || `#${it.id}`}</div>
                            <div className="text-muted fs-12 font-monospace">${money(it.value || it.amount || 0)}</div>
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </>
  );
};

export default EmbudoVentas;
