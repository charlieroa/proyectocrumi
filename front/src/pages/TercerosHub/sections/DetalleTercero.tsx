import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, Col, Row, Spinner, Table } from 'reactstrap';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { API_BASE, ThirdParty, kindColor, kindLabel, money, useAuthHeaders } from '../shared';

type Movement = {
  id: number | string;
  date: string;
  document?: string;
  description?: string;
  debit?: number;
  credit?: number;
  balance?: number;
};

const DetalleTercero: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const headers = useAuthHeaders();
  const stateTp: ThirdParty | undefined = (location.state as any)?.thirdParty;
  const [tercero, setTercero] = useState<ThirdParty | null>(stateTp || null);
  const [loading, setLoading] = useState(!stateTp);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingMov, setLoadingMov] = useState(false);

  const loadTercero = useCallback(async () => {
    if (stateTp) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/accounting/third-parties`, { headers });
      const data = await res.json();
      if (data.success) {
        const found = (data.thirdParties || []).find((t: ThirdParty) => String(t.id) === String(id));
        if (found) setTercero(found);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, id, stateTp]);

  const loadMovements = useCallback(async (docNumber: string) => {
    if (!docNumber) return;
    setLoadingMov(true);
    try {
      const qs = new URLSearchParams({ thirdParty: docNumber });
      const res = await fetch(`${API_BASE}/accounting/third-party-ledger?${qs.toString()}`, { headers });
      const data = await res.json();
      if (data.success) setMovements(data.movements || data.entries || []);
    } catch (e) { console.error(e); }
    setLoadingMov(false);
  }, [headers]);

  useEffect(() => { loadTercero(); }, [loadTercero]);
  useEffect(() => { if (tercero?.document_number) loadMovements(tercero.document_number); }, [tercero, loadMovements]);

  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (!tercero) {
    return (
      <Card className="shadow-sm">
        <CardBody className="text-center py-5 text-muted">
          <i className="ri-user-unfollow-line fs-32 d-block mb-2" />
          No se encontró el tercero.
          <div className="mt-3">
            <Button color="primary" onClick={() => navigate('/terceros-hub/lista')}>Ir a la lista</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-sm mb-3">
        <CardBody>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <h4 className="mb-0">{tercero.name}</h4>
                {tercero.roles && tercero.roles.length > 0 ? (
                  tercero.roles.map(r => (
                    <Badge key={r} color={kindColor(r)}>{kindLabel(r)}</Badge>
                  ))
                ) : (
                  <Badge color={kindColor(tercero.kind)}>{kindLabel(tercero.kind)}</Badge>
                )}
              </div>
              <div className="text-muted fs-13 font-monospace">
                {tercero.document_type || 'DOC'} · {tercero.document_number}
              </div>
            </div>
            <div className="d-flex gap-2">
              <Button color="light" onClick={() => navigate('/terceros-hub')}>
                <i className="ri-arrow-left-line me-1" /> Volver
              </Button>
              <Button
                color="primary"
                onClick={() => navigate(`/terceros-hub/${tercero.id}/editar`, { state: { thirdParty: tercero } })}
              >
                <i className="ri-pencil-line me-1" /> Editar
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Row className="g-3 mb-3">
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <h6 className="mb-3"><i className="ri-contacts-line me-1" /> Contacto</h6>
              <div className="mb-2"><span className="text-muted fs-12">Email:</span> <span>{tercero.email || '-'}</span></div>
              <div className="mb-2"><span className="text-muted fs-12">Teléfono:</span> <span>{tercero.phone || '-'}</span></div>
              <div className="mb-2"><span className="text-muted fs-12">Dirección:</span> <span>{tercero.address || '-'}</span></div>
              <div><span className="text-muted fs-12">Ciudad:</span> <span>{tercero.city || '-'}{tercero.department ? `, ${tercero.department}` : ''}</span></div>
            </CardBody>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <h6 className="mb-3"><i className="ri-file-list-3-line me-1" /> Ficha tributaria</h6>
              <div className="mb-2"><span className="text-muted fs-12">Tipo documento:</span> <span>{tercero.document_type || '-'}</span></div>
              <div className="mb-2"><span className="text-muted fs-12">Número:</span> <span className="font-monospace">{tercero.document_number}</span></div>
              <div><span className="text-muted fs-12">Clasificación:</span> <span>{kindLabel(tercero.kind)}</span></div>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <CardBody>
          <h6 className="mb-3"><i className="ri-exchange-line me-1" /> Últimos movimientos</h6>
          {loadingMov ? (
            <div className="text-center py-4"><Spinner size="sm" /></div>
          ) : movements.length === 0 ? (
            <div className="text-center py-4 text-muted">Sin movimientos registrados.</div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Documento</th>
                    <th>Descripción</th>
                    <th className="text-end">Débito</th>
                    <th className="text-end">Crédito</th>
                    <th className="text-end">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => (
                    <tr key={m.id}>
                      <td className="fs-13">{m.date}</td>
                      <td className="font-monospace fs-13">{m.document || '-'}</td>
                      <td className="fs-13">{m.description || '-'}</td>
                      <td className="text-end font-monospace">{money(m.debit)}</td>
                      <td className="text-end font-monospace">{money(m.credit)}</td>
                      <td className="text-end font-monospace fw-semibold">{money(m.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
};

export default DetalleTercero;
