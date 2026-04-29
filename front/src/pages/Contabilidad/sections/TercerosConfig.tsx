import React from 'react';
import Settings from '../../Pages/Profile/Settings/Settings';

/**
 * Wrapper thin: renderiza Settings en modo "singleTab" mostrando solo la
 * sección de Terceros (tab 10).
 */
const TercerosConfig: React.FC = () => <Settings singleTab="10" />;

export default TercerosConfig;
