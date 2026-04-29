// src/routes/nominaRoutes.js
// Rutas del módulo de Nómina Colombiana

const express = require('express');
const router = express.Router();
const nominaController = require('../controllers/nominaController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// =============================================
// EMPLEADOS
// =============================================
router.get('/empleados', nominaController.getEmployees);
router.get('/empleados/:id', nominaController.getEmployeeById);
router.post('/empleados', nominaController.createEmployee);
router.put('/empleados/:id', nominaController.updateEmployee);
router.delete('/empleados/:id', nominaController.deleteEmployee);

// Afiliaciones
router.get('/empleados/:id/afiliaciones', nominaController.getAffiliations);
router.put('/empleados/:id/afiliaciones', nominaController.updateAffiliations);

// Contratos
router.get('/empleados/:id/contratos', nominaController.getContracts);
router.post('/empleados/:id/contratos', nominaController.createContract);

// =============================================
// PERÍODOS DE NÓMINA
// =============================================
router.get('/periodos', nominaController.getPeriods);
router.post('/periodos', nominaController.createPeriod);
router.get('/periodos/:id', nominaController.getPeriodById);
router.delete('/periodos/:id', nominaController.deletePeriod);
router.put('/periodos/:id/aprobar', nominaController.approvePeriod);
router.get('/periodos/:id/contabilidad', nominaController.getPeriodAccountingStatus);
router.post('/periodos/:id/contabilizar', nominaController.accountPeriod);

// =============================================
// LIQUIDACIONES
// =============================================
router.get('/periodos/:id/liquidaciones', nominaController.getLiquidations);
router.post('/periodos/:id/liquidar', nominaController.generateLiquidations);
router.get('/periodos/:id/preliquidacion', nominaController.getPreLiquidation);
router.put('/liquidaciones/:id', nominaController.updateLiquidation);

// =============================================
// NOVEDADES
// =============================================
router.get('/novedades', nominaController.getNovelties);
router.post('/novedades', nominaController.createNovelty);
router.put('/novedades/:id', nominaController.updateNovelty);
router.delete('/novedades/:id', nominaController.deleteNovelty);

// =============================================
// SEGURIDAD SOCIAL / PILA
// =============================================
router.get('/periodos/:id/pila-preview', nominaController.getPilaPreview);
router.post('/periodos/:id/generar-pila', nominaController.generatePilaFile);

// =============================================
// RECLAMACIONES DE INCAPACIDADES
// =============================================
router.get('/incapacidades', nominaController.getDisabilityClaims);
router.post('/incapacidades', nominaController.createDisabilityClaim);
router.put('/incapacidades/:id', nominaController.updateDisabilityClaim);

// =============================================
// ENTIDADES DE SEGURIDAD SOCIAL (datos maestros)
// =============================================
router.get('/entidades-ss', nominaController.getSocialSecurityEntities);

// =============================================
// DASHBOARD
// =============================================
router.get('/dashboard/summary', nominaController.getDashboardSummary);
router.get('/dashboard/chart-data', nominaController.getDashboardChartData);

// =============================================
// REPORTES
// =============================================
router.get('/reportes/nomina-periodo', nominaController.getPayrollPeriodReport);
router.get('/reportes/consolidado-anual', nominaController.getAnnualConsolidated);
router.get('/reportes/certificado-ingresos/:empleadoId', nominaController.getIncomeCertificate);
router.get('/reportes/provisiones', nominaController.getProvisionsReport);

module.exports = router;
