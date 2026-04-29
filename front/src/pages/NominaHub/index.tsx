import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, Col, Container, Row, Spinner } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import { API_BASE, money, useAuthHeaders } from './shared';

type HubSummary = {
  employees: number;
  payrollMonth: number;
  pila: number;
  electronicDocs: number;
};

const NominaHub: React.FC = () => {
  document.title = 'Nómina | Bolti';
  const navigate = useNavigate();
  const headers = useAuthHeaders();
  const [summary, setSummary] = useState<HubSummary>({ employees: 0, payrollMonth: 0, pila: 0, electronicDocs: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const safeJson = async (url: string) => {
        try { const r = await fetch(url, { headers }); if (!r.ok) return null; return await r.json(); } catch { return null; }
      };
      const [emp, periods, ne] = await Promise.all([
        safeJson(`${API_BASE}/payroll/employees`),
        safeJson(`${API_BASE}/payroll/periods`),
        safeJson(`${API_BASE}/alegra/payroll-electronic/periods`),
      ]);

      const employees = Array.isArray(emp?.employees) ? emp.employees : (Array.isArray(emp) ? emp : (emp?.data || []));
      const activeEmployees = employees.filter((e: any) => !e.status || e.status === 'active' || e.active).length;

      const periodList = Array.isArray(periods?.periods) ? periods.periods : (Array.isArray(periods) ? periods : (periods?.data || []));
      const now = new Date();
      const monthTotal = periodList
        .filter((p: any) => {
          const d = new Date(p.startDate || p.start_date || p.endDate || p.end_date || 0);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((s: number, p: any) => s + Number(p.totalNet || p.total_net || p.total || 0), 0);

      const pilaTotal = periodList
        .filter((p: any) => {
          const d = new Date(p.startDate || p.start_date || 0);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((s: number, p: any) => s + Number(p.pilaAmount || p.pila_amount || 0), 0);

      const neList = Array.isArray(ne?.periods) ? ne.periods : (Array.isArray(ne) ? ne : (ne?.data || []));
      const emitted = neList.filter((p: any) => (p.status || p.electronicStatus) === 'synced' || p.syncedAt).length;

      setSummary({ employees: activeEmployees, payrollMonth: monthTotal, pila: pilaTotal, electronicDocs: emitted });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const kpis = [
    { label: 'Empleados activos', value: summary.employees, icon: 'ri-team-line', color: 'primary', isCount: true },
    { label: 'Nómina del mes', value: summary.payrollMonth, icon: 'ri-money-dollar-circle-line', color: 'success' },
    { label: 'Aportes PILA', value: summary.pila, icon: 'ri-heart-pulse-line', color: 'warning' },
    { label: 'Docs electrónicos', value: summary.electronicDocs, icon: 'ri-government-line', color: 'info', isCount: true },
  ];

  const tiles: { path: string; title: string; desc: string; icon: string; color: string }[] = [
    { path: '/nomina-hub/empleados', title: 'Empleados', desc: 'Listado y búsqueda de colaboradores', icon: 'ri-team-line', color: 'primary' },
    { path: '/nomina-hub/liquidar', title: 'Liquidar período', desc: 'Calcula devengado, deducciones y neto', icon: 'ri-calculator-line', color: 'success' },
    { path: '/nomina-hub/periodos', title: 'Períodos', desc: 'Draft, liquidados, aprobados y cerrados', icon: 'ri-calendar-2-line', color: 'info' },
    { path: '/nomina-hub/nomina-electronica', title: 'Nómina electrónica', desc: 'Preparar y sincronizar con la DIAN', icon: 'ri-government-line', color: 'dark' },
    { path: '/nomina-hub/pila', title: 'PILA', desc: 'Aportes a seguridad social y parafiscales', icon: 'ri-heart-pulse-line', color: 'warning' },
    { path: '/nomina-hub/reportes', title: 'Reportes', desc: 'Resumen, certificados y exportes', icon: 'ri-line-chart-line', color: 'secondary' },
  ];

  return (
    <Container fluid className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-0">Nómina</h4>
          <div className="text-muted fs-13">Todo en una pantalla. Clic en una tarjeta para abrirla.</div>
        </div>
        <Button color="primary" size="lg" onClick={() => navigate('/nomina-hub/liquidar')}>
          <i className="ri-add-line me-1" /> Nueva liquidación
        </Button>
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

export default NominaHub;
