import React from 'react';
import { Card, CardBody, Col, Row } from 'reactstrap';

type Tile = { title: string; desc: string; icon: string; color: string; available?: boolean };

const tiles: Tile[] = [
  { title: 'Resumen de nómina', desc: 'Totales por período con devengado y deducciones', icon: 'ri-file-chart-line', color: 'primary' },
  { title: 'Nómina por período', desc: 'Detalle por empleado del período seleccionado', icon: 'ri-file-list-3-line', color: 'info' },
  { title: 'Certificados de ingresos', desc: 'Certificado anual por empleado (formato DIAN)', icon: 'ri-award-line', color: 'success' },
  { title: 'Histórico PILA', desc: 'Aportes a seguridad social por período', icon: 'ri-heart-pulse-line', color: 'warning' },
];

const Reportes: React.FC = () => {
  return (
    <Row className="g-3">
      {tiles.map(t => (
        <Col md={6} xl={3} key={t.title}>
          <Card className="shadow-sm h-100" role="button"
                style={{ cursor: 'pointer' }}
                onClick={() => alert(`${t.title}: próximamente.`)}>
            <CardBody>
              <div className={`avatar-md rounded bg-${t.color}-subtle d-flex align-items-center justify-content-center mb-3`} style={{ width: 56, height: 56 }}>
                <i className={`${t.icon} fs-28 text-${t.color}`} />
              </div>
              <h6 className="mb-1">{t.title}</h6>
              <div className="text-muted fs-13 mb-2">{t.desc}</div>
              <span className="badge bg-light text-muted">Próximamente</span>
            </CardBody>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default Reportes;
