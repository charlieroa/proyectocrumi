import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardBody, Col, Container, Dropdown, DropdownMenu, DropdownItem, DropdownToggle, Row, Spinner } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE, money, useAuthHeaders, tryFetchJson, extractArray } from './shared';

type Summary = {
  ventasMes: number;
  facturasEmitidas: number;
  cotizacionesAbiertas: number;
  clientesActivos: number;
};

const ComercialHub: React.FC = () => {
  document.title = 'Comercial | Bolti';
  const navigate = useNavigate();
  const headers = useAuthHeaders();
  const [newOpen, setNewOpen] = useState(false);
  const [summary, setSummary] = useState<Summary>({ ventasMes: 0, facturasEmitidas: 0, cotizacionesAbiertas: 0, clientesActivos: 0 });
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const invRes = await tryFetchJson([
      `${API_BASE}/invoices?type=sale`,
      `${API_BASE}/sales-invoices`,
    ], headers);
    const invoices = extractArray(invRes.data);
    const ventasMes = invoices
      .filter((i: any) => {
        const d = String(i.date || i.issue_date || i.created_at || '');
        return d.startsWith(ym);
      })
      .reduce((s: number, i: any) => s + Number(i.total || i.amount || 0), 0);

    const quoRes = await tryFetchJson([
      `${API_BASE}/quotes`,
      `${API_BASE}/cotizaciones`,
    ], headers);
    const quotes = extractArray(quoRes.data);
    const cotizacionesAbiertas = quotes.filter((q: any) => {
      const st = String(q.status || '').toUpperCase();
      return !st || st.includes('OPEN') || st.includes('ABIERT') || st.includes('PEND') || st.includes('DRAFT');
    }).length;

    const cliRes = await tryFetchJson([
      `${API_BASE}/accounting/third-parties?kind=CUSTOMER`,
    ], headers);
    const clientes = extractArray(cliRes.data);

    setSummary({
      ventasMes,
      facturasEmitidas: invoices.length,
      cotizacionesAbiertas,
      clientesActivos: clientes.length,
    });
    setLoading(false);
  }, [headers]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const kpis = [
    { label: 'Ventas del mes', value: summary.ventasMes, icon: 'ri-money-dollar-circle-line', color: 'success' },
    { label: 'Facturas emitidas', value: summary.facturasEmitidas, icon: 'ri-bill-line', color: 'warning', isCount: true },
    { label: 'Cotizaciones abiertas', value: summary.cotizacionesAbiertas, icon: 'ri-file-list-3-line', color: 'info', isCount: true },
    { label: 'Clientes activos', value: summary.clientesActivos, icon: 'ri-user-star-line', color: 'primary', isCount: true },
  ];

  const tiles: { path: string; title: string; desc: string; icon: string; color: string }[] = [
    { path: '/comercial-hub/embudo', title: 'Embudo de ventas', desc: 'Leads por etapa en formato kanban', icon: 'ri-funnel-line', color: 'primary' },
    { path: '/comercial-hub/oportunidades', title: 'Oportunidades', desc: 'Negocios en curso y proyecciones', icon: 'ri-briefcase-line', color: 'info' },
    { path: '/comercial-hub/cotizaciones', title: 'Cotizaciones', desc: 'Propuestas comerciales emitidas', icon: 'ri-file-list-3-line', color: 'success' },
    { path: '/comercial-hub/facturacion', title: 'Facturación', desc: 'Facturas de venta emitidas', icon: 'ri-bill-line', color: 'warning' },
    { path: '/comercial-hub/clientes', title: 'Clientes', desc: 'Cartera de clientes', icon: 'ri-user-star-line', color: 'secondary' },
  ];

  return (
    <Container fluid className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-0">Comercial</h4>
          <div className="text-muted fs-13">Clientes, ventas, cotizaciones y facturación.</div>
        </div>
        <Dropdown isOpen={newOpen} toggle={() => setNewOpen(v => !v)}>
          <DropdownToggle color="primary" caret size="lg">
            <i className="ri-add-line me-1" /> Nueva venta
          </DropdownToggle>
          <DropdownMenu end>
            <DropdownItem onClick={() => navigate('/comercial-hub/cotizaciones')}>
              <i className="ri-file-list-3-line me-2 text-success" /> Cotización
            </DropdownItem>
            <DropdownItem onClick={() => navigate('/ingresos/factura-venta/crear')}>
              <i className="ri-bill-line me-2 text-warning" /> Factura de venta
            </DropdownItem>
            <DropdownItem onClick={() => navigate('/comercial-hub/oportunidades')}>
              <i className="ri-briefcase-line me-2 text-info" /> Oportunidad
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      <Row className="g-3 mb-3">
        {kpis.map((k, i) => (
          <Col md={6} xl={3} key={i}>
            <Card className="shadow-sm h-100">
              <CardBody className="d-flex align-items-center">
                <div className={`avatar-sm rounded-circle d-flex align-items-center justify-content-center bg-${k.color}-subtle me-3`} style={{ width: 48, height: 48 }}>
                  <i className={`${k.icon} fs-24 text-${k.color}`} />
                </div>
                <div className="flex-grow-1">
                  <div className="text-muted fs-12">{k.label}</div>
                  <div className="fs-18 fw-semibold font-monospace">
                    {loading ? <Spinner size="sm" /> : (k.isCount ? Number(k.value || 0).toLocaleString('es-CO') : `$${money(k.value)}`)}
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-3">
        {tiles.map(t => (
          <Col md={6} xl={4} key={t.path}>
            <Card className="shadow-sm h-100" role="button" onClick={() => navigate(t.path)}
                  style={{ cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = '')}>
              <CardBody className="d-flex align-items-start">
                <div className={`avatar-md rounded bg-${t.color}-subtle d-flex align-items-center justify-content-center me-3`} style={{ width: 56, height: 56 }}>
                  <i className={`${t.icon} fs-28 text-${t.color}`} />
                </div>
                <div className="flex-grow-1">
                  <h6 className="mb-1">{t.title}</h6>
                  <div className="text-muted fs-13">{t.desc}</div>
                </div>
                <i className="ri-arrow-right-line text-muted fs-20 ms-2" />
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default ComercialHub;
