// src/routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const { createInvoice, getInvoices, getInvoiceById, downloadInvoiceXML, viewInvoiceXML, downloadInvoicePDF, updateInvoice, cancelInvoice, getNextInvoiceNumber } = require('../controllers/invoiceController');
const authMiddleware = require('../middleware/authMiddleware');

// POST: Crear nueva factura
router.post('/', authMiddleware, createInvoice);

// GET: Siguiente consecutivo + estado de facturación electrónica
router.get('/next-number', authMiddleware, getNextInvoiceNumber);

// GET: Obtener listado de facturas
router.get('/', authMiddleware, getInvoices);

// GET: Descargar XML de una factura
router.get('/:id/download-xml', authMiddleware, downloadInvoiceXML);

// GET: Ver XML de una factura en el navegador
router.get('/:id/view-xml', authMiddleware, viewInvoiceXML);

// GET: Descargar PDF (representación gráfica) de una factura
router.get('/:id/download-pdf', authMiddleware, downloadInvoicePDF);

// GET: Detalle de una factura con sus items
router.get('/:id', authMiddleware, getInvoiceById);

// PUT: Editar factura (solo BORRADOR, no emitidas a DIAN)
router.put('/:id', authMiddleware, updateInvoice);

// POST: Anular factura (solo BORRADOR sin CUFE; emitidas requieren nota crédito)
router.post('/:id/cancel', authMiddleware, cancelInvoice);

module.exports = router;