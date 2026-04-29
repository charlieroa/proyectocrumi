import React from 'react';
import ConfigFacturacion from '../../../Contabilidad/sections/ConfigFacturacion';

interface Props {
  tenantId?: string | null;
  onStatusChange?: () => void;
}

const FacturacionElectronicaSection: React.FC<Props> = () => {
  return <ConfigFacturacion />;
};

export default FacturacionElectronicaSection;
