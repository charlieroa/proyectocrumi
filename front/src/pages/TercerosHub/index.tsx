import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardBody, Col, Container, Row, Spinner } from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { API_BASE, ThirdPartySummary, useAuthHeaders } from './shared';
import NuevoTerceroModal from '../../Components/Common/NuevoTerceroModal';

const TercerosHub: React.FC = () => {
  document.title = 'Terceros | Bolti';
  const navigate = useNavigate();
  const headers = useAuthHeaders();
  const [summary, setSummary] = useState<ThirdPartySummary>({ total: 0, byKind: { CUSTOMER: 0, SUPPLIER: 0, EMPLOYEE: 0, OTHER: 0 } });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [newTpOpen, setNewTpOpen] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/accounting/third-parties`, { headers });
      const data = await res.json();
      if (data.success && data.summary) {
        setSummary({
          total: data.summary.total || 0,
          byKind: {
            CUSTOMER: data.summary.byKind?.CUSTOMER || 0,
            SUPPLIER: data.summary.byKind?.SUPPLIER || 0,
            EMPLOYEE: data.summary.byKind?.EMPLOYEE || 0,
            OTHER: data.summary.byKind?.OTHER || 0,
          },
        });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const handleSync = useCallback(async () => {
    const confirmRes = await Swal.fire({
      icon: 'question',
      title: '¿Confirmar?',
      text: '¿Sincronizar terceros desde el proveedor tecnológico? Esto puede tardar unos segundos.',
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A1D1F',
    });
    if (!confirmRes.isConfirmed) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/accounting/third-parties/sync`, { method: 'POST', headers });
      const data = await res.json();
      if (data.success) {
        await loadSummary();
        Swal.fire({ icon: 'success', title: 'Sincronización completada', confirmButtonColor: '#1A1D1F' });
      } else {
        Swal.fire({ icon: 'error', title: 'No se pudo sincronizar', confirmButtonColor: '#1A1D1F' });
      }
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: 'error', title: 'Error al sincronizar', confirmButtonColor: '#1A1D1F' });
    }
    setSyncing(false);
  }, [headers, loadSummary]);

  const kpis = [
    { label: 'Total terceros', value: summary.total, icon: 'ri-group-line', color: 'primary' },
    { label: 'Clientes', value: summary.byKind.CUSTOMER, icon: 'ri-user-star-line', color: 'info' },
    { label: 'Proveedores', value: summary.byKind.SUPPLIER, icon: 'ri-truck-line', color: 'warning' },
    { label: 'Empleados', value: summary.byKind.EMPLOYEE, icon: 'ri-user-settings-line', color: 'success' },
  ];

  const tiles: { path?: string; onClick?: () => void; title: string; desc: string; icon: string; color: string }[] = [
    { path: '/terceros-hub/lista', title: 'Lista unificada', desc: 'Clientes, proveedores, empleados y otros', icon: 'ri-group-line', color: 'primary' },
    { path: '/terceros-hub/lista?tab=movimientos', title: 'Movimientos por tercero', desc: 'Consulta el libro auxiliar por tercero', icon: 'ri-exchange-line', color: 'info' },
    { onClick: handleSync, title: 'Importar terceros', desc: 'Sincroniza terceros desde el proveedor tecnológico', icon: 'ri-cloud-line', color: 'secondary' },
  ];

  return (
    <Container fluid className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <Button color="light" size="sm" onClick={() => navigate(-1)} title="Volver">
            <i className="ri-arrow-left-line me-1" /> Volver
          </Button>
          <div>
            <h4 className="mb-0">Terceros</h4>
            <div className="text-muted fs-13">Clientes, proveedores, empleados y otros</div>
          </div>
        </div>
        <div className="d-flex gap-2">
          <Button color="info" outline onClick={handleSync} disabled={syncing}>
            {syncing ? <Spinner size="sm" /> : <i className="ri-refresh-line me-1" />} Sincronizar desde Alegra
          </Button>
          <Button color="primary" size="lg" onClick={() => setNewTpOpen(true)}>
            <i className="ri-add-line me-1" /> Nuevo tercero
          </Button>
        </div>
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
                    {loading ? <Spinner size="sm" /> : Number(k.value || 0).toLocaleString('es-CO')}
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-3">
        {tiles.map((t, i) => (
          <Col md={6} xl={4} key={i}>
            <Card
              className="shadow-sm h-100"
              role="button"
              onClick={() => (t.onClick ? t.onClick() : t.path && navigate(t.path))}
              style={{ cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = '')}
            >
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

      <NuevoTerceroModal isOpen={newTpOpen} onClose={() => setNewTpOpen(false)} />
    </Container>
  );
};

export default TercerosHub;
