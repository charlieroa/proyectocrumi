import React from 'react';
import Settings from '../../Pages/Profile/Settings/Settings';

/**
 * Wrapper thin: renderiza Settings en modo "singleTab" mostrando solo la
 * sección de Facturación Electrónica DIAN (tab 8).
 */
const FacturacionElectronicaConfig: React.FC = () => <Settings singleTab="8" />;

export default FacturacionElectronicaConfig;
