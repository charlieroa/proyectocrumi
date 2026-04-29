import React from 'react';
import Settings from '../../Pages/Profile/Settings/Settings';

/**
 * Wrapper thin: renderiza Settings en modo "singleTab" mostrando solo el
 * formulario de Datos de la Empresa (tab 1). Toda la lógica de fetch/save
 * de tenant + logo upload sigue corriendo dentro de Settings via useEffects.
 */
const EmpresaConfig: React.FC = () => <Settings singleTab="1" />;

export default EmpresaConfig;
