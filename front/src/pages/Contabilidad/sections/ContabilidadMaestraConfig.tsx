import React from 'react';
import Settings from '../../Pages/Profile/Settings/Settings';

/**
 * Wrapper thin: renderiza Settings en modo "singleTab" mostrando solo la
 * sección de Contabilidad Maestra (tab 9).
 */
const ContabilidadMaestraConfig: React.FC = () => <Settings singleTab="9" />;

export default ContabilidadMaestraConfig;
