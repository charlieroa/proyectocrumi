import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, CardBody, Spinner, Table } from 'reactstrap';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE, useAuthHeaders, tryFetchJson, extractArray, money } from '../shared';

const dianColor = (s?: string) => {
  const u = String(s || '').toUpperCase();
  if (u.includes('ACEPT') || u.includes('APPROV')) return 'success';
  if (u.includes('RECH') || u.includes('REJECT') || u.includes('ERROR')) return 'danger';
  if (u.includes('ENVIA') || u.includes('SENT')) return 'info';
  if (u.includes('PEND')) return 'warning';
  return 'secondary';
};

const Facturacion: React.FC = () => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await tryFetchJson([
      `${API_BASE}/invoices?type=sale`,
      `${API_BASE}/sales-invoices`,
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

  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (error === 'not-available') {
    return (
      <Alert color="warning">
        Módulo no disponible, intenta desde <Link to="/ingresos/factura-venta/crear">/ingresos/factura-venta/crear</Link>
      </Alert>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardBody>
        <div className="d-flex justify-content-end mb-3">
          <Button color="warning" size="lg" onClick={() => navigate('/ingresos/factura-venta/crear')}>
            <i className="ri-add-line me-1" /> Nueva factura
          </Button>
        </div>
        {items.length === 0 ? (
          <Alert color="info" className="mb-0">Aún no hay facturas de venta emitidas.</Alert>
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th className="text-end">Total</th>
                  <th>CUFE</th>
                  <th>Estado DIAN</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f, i) => (
                  <tr key={f.id ?? i}>
                    <td className="font-monospace">{f.number || f.invoice_number || `#${f.id}`}</td>
                    <td>{f.customer || f.customer_name || f.third_party_name || '-'}</td>
                    <td>{f.date || f.issue_date || '-'}</td>
                    <td className="text-end font-monospace">${money(f.total || f.amount || 0)}</td>
                    <td className="font-monospace fs-11 text-muted" title={f.cufe}>
                      {f.cufe ? `${String(f.cufe).slice(0, 12)}...` : '-'}
                    </td>
                    <td><Badge color={dianColor(f.dian_status || f.status)}>{f.dian_status || f.status || 'Pendiente'}</Badge></td>
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

export default Facturacion;
