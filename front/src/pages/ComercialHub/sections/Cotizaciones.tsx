import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Button, Spinner } from 'reactstrap';

// Sección legacy del Hub Comercial — redirige al módulo canónico de cotizaciones
// (`/cotizaciones`), que tiene la lógica completa: filtros, KPIs por estado,
// transiciones de workflow y conversión a factura. Mantener un duplicado aquí
// causaba dobles fetch y desincronización con el backend.
const Cotizaciones: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate('/cotizaciones', { replace: true }), 50);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <Alert color="info" className="mb-0">
      <Spinner size="sm" className="me-2" />
      Cotizaciones se gestionan desde su módulo dedicado.{' '}
      <Button color="link" className="p-0 align-baseline" onClick={() => navigate('/cotizaciones')}>
        Ir ahora
      </Button>
    </Alert>
  );
};

export default Cotizaciones;
// Fallback en caso de que React Router prefiera redirección declarativa.
export const CotizacionesRedirect: React.FC = () => <Navigate to="/cotizaciones" replace />;
