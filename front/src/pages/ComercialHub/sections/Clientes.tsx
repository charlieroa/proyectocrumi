import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, CardBody, Input, Spinner, Table } from 'reactstrap';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE, useAuthHeaders, tryFetchJson, extractArray } from '../shared';

const Clientes: React.FC = () => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await tryFetchJson([
      `${API_BASE}/accounting/third-parties?kind=CUSTOMER`,
    ], headers);
    if (!res.ok) {
      setError('not-available');
    } else {
      setItems(extractArray(res.data));
      setError(null);
    }
    setLoading(false);
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter(c =>
      String(c.name || '').toLowerCase().includes(s) ||
      String(c.document_number || c.nit || '').toLowerCase().includes(s) ||
      String(c.email || '').toLowerCase().includes(s)
    );
  }, [items, q]);

  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (error === 'not-available') {
    return (
      <Alert color="warning">
        Módulo no disponible, intenta desde <Link to="/terceros-hub">/terceros-hub</Link>
      </Alert>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardBody>
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div style={{ width: 280 }}>
            <Input placeholder="Buscar por nombre, NIT o email..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Button color="primary" onClick={() => navigate('/terceros-hub/nuevo')}>
            <i className="ri-add-line me-1" /> Nuevo cliente
          </Button>
        </div>
        {filtered.length === 0 ? (
          <Alert color="info" className="mb-0">No hay clientes para mostrar.</Alert>
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>NIT / Documento</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id ?? i}>
                    <td>{c.name || '-'}</td>
                    <td className="font-monospace">{c.document_number || c.nit || '-'}</td>
                    <td>{c.email || '-'}</td>
                    <td>{c.phone || '-'}</td>
                    <td>{c.city || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default Clientes;
