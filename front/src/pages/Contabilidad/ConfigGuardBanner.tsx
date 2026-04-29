import React from 'react';
import { Alert, Button } from 'reactstrap';
import { useConfigGuard } from './useConfigGuard';

type Props = { moduleKey: 'compras' | 'documentos-soporte' | 'pagos' | 'cobros' | 'ventas' | 'notas-credito' | 'notas-debito' };

const ConfigGuardBanner: React.FC<Props> = ({ moduleKey }) => {
  const { ready, missingLabels, alertAndGo } = useConfigGuard(moduleKey);
  if (ready) return null;
  return (
    <Alert color="warning" className="d-flex align-items-center justify-content-between mb-3">
      <div className="d-flex align-items-center gap-2">
        <i className="ri-error-warning-line fs-20" />
        <div>
          <strong>Falta configuración contable:</strong> {missingLabels.join(', ')}.
          <div className="fs-12 text-muted">Sin esto los asientos automáticos no se generarán correctamente.</div>
        </div>
      </div>
      <Button size="sm" color="warning" onClick={() => alertAndGo()}>
        Configurar <i className="ri-arrow-right-line ms-1" />
      </Button>
    </Alert>
  );
};

export default ConfigGuardBanner;
