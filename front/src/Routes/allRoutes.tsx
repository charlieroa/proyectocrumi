import React from 'react';
import { Navigate } from 'react-router-dom';
import ModulePageWrapper from '../Components/Common/ModulePageWrapper';

import ChatView from '../Components/Chat/ChatView';
import { LoginRedirect, RegisterRedirect } from '../Components/Auth/AuthRedirects';

import Calendar from '../pages/Calendar';
import DomainWorkspace from '../pages/Erp/DomainWorkspace';
import ModuleWorkspace from '../pages/Erp/ModuleWorkspace';
import OnboardingPage from '../pages/Onboarding';
import SalesInvoiceList from '../pages/income/SalesInvoice/List';
import FacturaVentaLista from '../pages/income/SalesInvoice/FacturaVentaLista';
import NuevoDocumento from '../pages/income/SalesInvoice/Create';
import CandidateList from '../pages/Crm/CrmContacts';
import ClienteDocumentosKanban from '../pages/Crm/ClienteDocumentosKanban';
import ClientesCRM from '../pages/Crm/ClientesCRM';
import SimplePage from '../pages/Pages/Profile/SimplePage/SimplePage';
import PointOfSale from '../pages/PointOfSale';
import PayrollPage from '../pages/Payroll';
import PayrollPreview from '../pages/Payroll/PayrollPreview';
import Logout from '../pages/Authentication/Logout';
import UserProfile from '../pages/Authentication/user-profile';
import ForgotPassword from '../pages/Authentication/ForgotPassword';
import ResetPassword from '../pages/Authentication/ResetPassword';
import Settings from '../pages/Pages/Profile/Settings/Settings';
import AuthGoogleCallback from '../pages/Authentication/AuthGoogleCallback';
import EmployeeKanban from '../pages/Tasks/EmployeeKanban';
import TaskDashboard from '../pages/Tasks/TaskDashboard';
import KanbanBoard from '../pages/Tasks/KanbanBoard';
import ContabilidadHub from '../pages/Contabilidad';
import { CapturaPage, NotasPage, ConsultasPage, ImpuestosPage as ImpuestosContablePage, DianStatusPage, ConfigFacturacionPage, ComprasPage, DocumentosSoportePage, PagosPage, CobrosPage, BancosPage, ExogenaPage, KardexPage, ActivosFijosPage, PlantillasAsientoPage, PucPage, SoporteVentaPage, DocumentoIngresoPage, ProductosServiciosPage, RemisionesPage, EmpresaConfigPage, FacturacionElectronicaConfigPage, ContabilidadMaestraConfigPage, TercerosConfigPage, CentrosCostoPage, FacturaVentaPage, FacturaVentaListaPage } from '../pages/Contabilidad/pages';
import TercerosHub from '../pages/TercerosHub';
import { ListaPage as TercerosLista, NuevoPage as TercerosNuevo, DetallePage as TercerosDetalle, EditarPage as TercerosEditar } from '../pages/TercerosHub/pages';
import NominaHub from '../pages/NominaHub';
import { EmpleadosPage as NominaEmpleados, LiquidarPage as NominaLiquidar, PeriodosPage as NominaPeriodos, NominaElectronicaPage, PilaPage as NominaPila, ReportesPage as NominaReportes } from '../pages/NominaHub/pages';
import ComercialHub from '../pages/ComercialHub';
import { EmbudoPage as ComercialEmbudo, OportunidadesPage as ComercialOportunidades, CotizacionesPage as ComercialCotizaciones, FacturacionPage as ComercialFacturacion, ClientesPage as ComercialClientes } from '../pages/ComercialHub/pages';
import ImpuestosPage from '../pages/Impuestos';
import TercerosPage from '../pages/Terceros';
import CotizacionesPage from '../pages/Cotizaciones';
import AprobacionesPage from '../pages/Aprobaciones';
import AuditoriaPage from '../pages/Auditoria';
import ContratosPage from '../pages/Contratos';
import CumplimientoPage from '../pages/Cumplimiento';
import EvidenciaPage from '../pages/Evidencia';
import ConexionesExternasPage from '../pages/ConexionesExternas';
import PilaPage from '../pages/Pila';
import CRMPage from '../pages/Crm';
import NominaPage from '../pages/Nomina';
import MiPortalPage from '../pages/MiPortal';
import MensajeriaPage from '../pages/Mensajeria';
import CompaniesList from '../pages/Crm/CompaniesList';
import NuevaEmpresa from '../pages/Empresas/NuevaEmpresa';
import ContadoresList from '../pages/Crm/ContadoresList';
import CrmCompanies from '../pages/Crm/CrmCompanies';
import InternalEmployeesPage from '../pages/Crm/InternalEmployeesPage';
import AllUsersPage from '../pages/Crm/AllUsersPage';
import AdminKpisPage from '../pages/AdminKpis';
import LandingPage from '../pages/Landing';
import ContabilidadProductoPage from '../pages/Producto/Contabilidad';

const semiPublicRoutes = [
  { path: '/dashboard', component: <ChatView /> },
  { path: '/chat', component: <ChatView /> },
];

const authProtectedRoutes = [
  { path: '/chat/workspace', component: <DomainWorkspace domainId="chat" /> },
  { path: '/base', component: <DomainWorkspace domainId="base" /> },
  { path: '/comercial', component: <DomainWorkspace domainId="comercial" /> },
  { path: '/contable', component: <DomainWorkspace domainId="contable" /> },
  { path: '/nomina/workspace', component: <DomainWorkspace domainId="nomina" /> },
  { path: '/legal', component: <DomainWorkspace domainId="legal" /> },
  { path: '/administrativo', component: <DomainWorkspace domainId="administrativo" /> },

  { path: '/base/terceros', component: <ModulePageWrapper><TercerosPage /></ModulePageWrapper> },
  { path: '/base/aprobaciones', component: <ModulePageWrapper><AprobacionesPage /></ModulePageWrapper> },
  { path: '/base/auditoria', component: <ModulePageWrapper><AuditoriaPage /></ModulePageWrapper> },
  { path: '/comercial/crm', component: <ModuleWorkspace moduleId="crm-leads" /> },
  { path: '/comercial/cotizaciones', component: <ModulePageWrapper><CotizacionesPage /></ModulePageWrapper> },
  { path: '/contable/alegra', component: <ModuleWorkspace moduleId="alegra-integration" /> },
  { path: '/contable/bancos', component: <ModuleWorkspace moduleId="banks" /> },
  { path: '/contable/impuestos', component: <ModulePageWrapper><ImpuestosPage /></ModulePageWrapper> },
  { path: '/nomina/empleados', component: <ModuleWorkspace moduleId="employees" /> },
  { path: '/nomina/pila', component: <ModulePageWrapper><PilaPage /></ModulePageWrapper> },
  { path: '/legal/contratos', component: <ModulePageWrapper><ContratosPage /></ModulePageWrapper> },
  { path: '/legal/cumplimiento', component: <ModulePageWrapper><CumplimientoPage /></ModulePageWrapper> },
  { path: '/legal/evidencia', component: <ModulePageWrapper><EvidenciaPage /></ModulePageWrapper> },
  { path: '/administrativo/conexiones', component: <ModulePageWrapper><ConexionesExternasPage /></ModulePageWrapper> },

  { path: '/onboarding', component: <ModulePageWrapper><OnboardingPage /></ModulePageWrapper> },
  // Rutas viejas redirigen a las nuevas en /contabilidad/*
  { path: '/ingresos/documentos', component: <Navigate to="/contabilidad/factura-venta" replace /> },
  { path: '/ingresos/factura-venta', component: <Navigate to="/contabilidad/factura-venta" replace /> },
  { path: '/gastos/documentos', component: <Navigate to="/contabilidad/compras" replace /> },
  { path: '/gastos/nuevo', component: <Navigate to="/contabilidad/compras" replace /> },
  { path: '/gastos/factura-compra', component: <Navigate to="/contabilidad/compras" replace /> },
  { path: '/gastos/factura-compra/crear', component: <Navigate to="/contabilidad/compras" replace /> },
  { path: '/calendar', component: <ModulePageWrapper><Calendar /></ModulePageWrapper> },
  { path: '/checkout', component: <ModulePageWrapper><PointOfSale /></ModulePageWrapper> },
  { path: '/clientes', component: <ClientesCRM /> },
  { path: '/clientes/:clientId/documentos', component: <ModulePageWrapper><ClienteDocumentosKanban /></ModulePageWrapper> },
  { path: '/stylists', component: <ModulePageWrapper><CandidateList /></ModulePageWrapper> },
  { path: '/stylists/:id', component: <ModulePageWrapper><SimplePage /></ModulePageWrapper> },
  { path: '/inventory', component: <Navigate to="/contabilidad/productos-servicios" replace /> },
  { path: '/inventory/:id', component: <Navigate to="/contabilidad/productos-servicios" replace /> },
  { path: '/payroll', component: <ModulePageWrapper><PayrollPage /></ModulePageWrapper> },
  { path: '/payroll/preview', component: <ModulePageWrapper><PayrollPreview /></ModulePageWrapper> },
  { path: '/settings', component: <ModulePageWrapper><Settings /></ModulePageWrapper> },
  { path: '/profile', component: <ModulePageWrapper><UserProfile /></ModulePageWrapper> },
  { path: '/apps/tasks-dashboard', component: <ModulePageWrapper><TaskDashboard /></ModulePageWrapper> },
  { path: '/apps/tasks/:employeeId', component: <ModulePageWrapper><EmployeeKanban /></ModulePageWrapper> },
  { path: '/tasks/kanban', component: <ModulePageWrapper><KanbanBoard /></ModulePageWrapper> },
  { path: '/contabilidad', component: <ModulePageWrapper><ContabilidadHub /></ModulePageWrapper> },
  { path: '/contabilidad/capturar', component: <ModulePageWrapper><CapturaPage /></ModulePageWrapper> },
  { path: '/contabilidad/consultas', component: <ModulePageWrapper><ConsultasPage /></ModulePageWrapper> },
  { path: '/contabilidad/notas/:kind', component: <ModulePageWrapper><NotasPage /></ModulePageWrapper> },
  { path: '/contabilidad/impuestos', component: <ModulePageWrapper><ImpuestosContablePage /></ModulePageWrapper> },
  { path: '/contabilidad/dian', component: <ModulePageWrapper><DianStatusPage /></ModulePageWrapper> },
  { path: '/contabilidad/configurar-fe', component: <ModulePageWrapper><ConfigFacturacionPage /></ModulePageWrapper> },
  { path: '/contabilidad/bancos', component: <ModulePageWrapper><BancosPage /></ModulePageWrapper> },
  { path: '/contabilidad/compras', component: <ModulePageWrapper><ComprasPage /></ModulePageWrapper> },
  { path: '/contabilidad/documentos-soporte', component: <ModulePageWrapper><DocumentosSoportePage /></ModulePageWrapper> },
  { path: '/contabilidad/pagos', component: <ModulePageWrapper><PagosPage /></ModulePageWrapper> },
  { path: '/contabilidad/cobros', component: <ModulePageWrapper><CobrosPage /></ModulePageWrapper> },
  { path: '/contabilidad/exogena', component: <ModulePageWrapper><ExogenaPage /></ModulePageWrapper> },
  { path: '/contabilidad/kardex', component: <ModulePageWrapper><KardexPage /></ModulePageWrapper> },
  { path: '/contabilidad/activos-fijos', component: <ModulePageWrapper><ActivosFijosPage /></ModulePageWrapper> },
  { path: '/contabilidad/plantillas', component: <ModulePageWrapper><PlantillasAsientoPage /></ModulePageWrapper> },
  { path: '/contabilidad/puc', component: <ModulePageWrapper><PucPage /></ModulePageWrapper> },
  { path: '/contabilidad/soporte-venta', component: <ModulePageWrapper><SoporteVentaPage /></ModulePageWrapper> },
  { path: '/contabilidad/recibos-caja', component: <ModulePageWrapper><CobrosPage /></ModulePageWrapper> },
  { path: '/contabilidad/documento-ingreso', component: <ModulePageWrapper><DocumentoIngresoPage /></ModulePageWrapper> },
  { path: '/contabilidad/productos-servicios', component: <ModulePageWrapper><ProductosServiciosPage /></ModulePageWrapper> },
  { path: '/contabilidad/centros-costo', component: <ModulePageWrapper><CentrosCostoPage /></ModulePageWrapper> },
  { path: '/contabilidad/factura-venta', component: <ModulePageWrapper><FacturaVentaListaPage /></ModulePageWrapper> },
  { path: '/contabilidad/factura-venta/crear', component: <Navigate to="/contabilidad/factura-venta?nuevo=1" replace /> },
  { path: '/ingresos/factura-venta/crear', component: <Navigate to="/contabilidad/factura-venta/crear" replace /> },
  { path: '/ingresos/nuevo', component: <Navigate to="/contabilidad/factura-venta/crear" replace /> },
  { path: '/contabilidad/remisiones', component: <ModulePageWrapper><RemisionesPage /></ModulePageWrapper> },
  // Configuración (secciones migradas desde /settings?tab=N a páginas independientes)
  { path: '/contabilidad/config/empresa', component: <ModulePageWrapper><EmpresaConfigPage /></ModulePageWrapper> },
  { path: '/contabilidad/config/facturacion-electronica', component: <ModulePageWrapper><FacturacionElectronicaConfigPage /></ModulePageWrapper> },
  { path: '/contabilidad/config/contabilidad-maestra', component: <ModulePageWrapper><ContabilidadMaestraConfigPage /></ModulePageWrapper> },
  { path: '/contabilidad/config/terceros', component: <ModulePageWrapper><TercerosConfigPage /></ModulePageWrapper> },

  { path: '/terceros-hub', component: <ModulePageWrapper><TercerosLista /></ModulePageWrapper> },
  { path: '/terceros-hub/resumen', component: <ModulePageWrapper><TercerosHub /></ModulePageWrapper> },
  { path: '/terceros-hub/lista', component: <ModulePageWrapper><TercerosLista /></ModulePageWrapper> },
  { path: '/terceros-hub/nuevo', component: <ModulePageWrapper><TercerosNuevo /></ModulePageWrapper> },
  { path: '/terceros-hub/:id/editar', component: <ModulePageWrapper><TercerosEditar /></ModulePageWrapper> },
  { path: '/terceros-hub/:id', component: <ModulePageWrapper><TercerosDetalle /></ModulePageWrapper> },

  { path: '/nomina-hub', component: <ModulePageWrapper><NominaHub /></ModulePageWrapper> },
  { path: '/nomina-hub/empleados', component: <ModulePageWrapper><NominaEmpleados /></ModulePageWrapper> },
  { path: '/nomina-hub/liquidar', component: <ModulePageWrapper><NominaLiquidar /></ModulePageWrapper> },
  { path: '/nomina-hub/periodos', component: <ModulePageWrapper><NominaPeriodos /></ModulePageWrapper> },
  { path: '/nomina-hub/nomina-electronica', component: <ModulePageWrapper><NominaElectronicaPage /></ModulePageWrapper> },
  { path: '/nomina-hub/pila', component: <ModulePageWrapper><NominaPila /></ModulePageWrapper> },
  { path: '/nomina-hub/reportes', component: <ModulePageWrapper><NominaReportes /></ModulePageWrapper> },

  { path: '/comercial-hub', component: <ModulePageWrapper><ComercialHub /></ModulePageWrapper> },
  { path: '/comercial-hub/embudo', component: <ModulePageWrapper><ComercialEmbudo /></ModulePageWrapper> },
  { path: '/comercial-hub/oportunidades', component: <ModulePageWrapper><ComercialOportunidades /></ModulePageWrapper> },
  { path: '/comercial-hub/cotizaciones', component: <ModulePageWrapper><ComercialCotizaciones /></ModulePageWrapper> },
  { path: '/comercial-hub/facturacion', component: <ModulePageWrapper><ComercialFacturacion /></ModulePageWrapper> },
  { path: '/comercial-hub/clientes', component: <ModulePageWrapper><ComercialClientes /></ModulePageWrapper> },
  { path: '/impuestos', component: <ModulePageWrapper><ImpuestosPage /></ModulePageWrapper> },
  { path: '/terceros', component: <ModulePageWrapper><TercerosPage /></ModulePageWrapper> },
  { path: '/cotizaciones', component: <ModulePageWrapper><CotizacionesPage /></ModulePageWrapper> },
  { path: '/crm', component: <ModulePageWrapper><CRMPage /></ModulePageWrapper> },
  { path: '/nomina', component: <ModulePageWrapper><NominaPage /></ModulePageWrapper> },
  { path: '/mensajeria', component: <MensajeriaPage /> },
  { path: '/mi-portal', component: <ModulePageWrapper><MiPortalPage /></ModulePageWrapper> },
  { path: '/empresas', component: <ModulePageWrapper><CompaniesList /></ModulePageWrapper> },
  { path: '/empresas/nueva', component: <ModulePageWrapper><NuevaEmpresa /></ModulePageWrapper> },
  { path: '/admin/kpis', component: <ModulePageWrapper><AdminKpisPage /></ModulePageWrapper> },
  { path: '/contadores', component: <ModulePageWrapper><ContadoresList /></ModulePageWrapper> },
  { path: '/empleados-internos', component: <ModulePageWrapper><InternalEmployeesPage /></ModulePageWrapper> },
  { path: '/usuarios-registrados', component: <ModulePageWrapper><AllUsersPage /></ModulePageWrapper> },
  { path: '/apps-crm-companies', component: <ModulePageWrapper><CrmCompanies /></ModulePageWrapper> },
];

const publicRoutes = [
  { path: '/', component: <LandingPage /> },
  { path: '/producto/contabilidad', component: <ContabilidadProductoPage /> },
  { path: '/logout', component: <Logout /> },
  { path: '/login', component: <LoginRedirect /> },
  { path: '/register', component: <RegisterRedirect /> },
  { path: '/register-tenant', component: <RegisterRedirect /> },
  { path: '/register-contador', component: <RegisterRedirect /> },
  { path: '/forgot-password', component: <ForgotPassword /> },
  { path: '/reset-password', component: <ResetPassword /> },
  { path: '/auth-google-callback', component: <AuthGoogleCallback /> },
];

export { authProtectedRoutes, publicRoutes, semiPublicRoutes };
