// src/controllers/libroOficialController.js
// Controladores para los Libros Oficiales exigidos por la DIAN:
//   - Libro Oficial de Compras
//   - Libro Oficial de Ventas
//   - Libro de Inventarios y Balance (snapshot fiscal de cuentas al cierre)
//
// Todos los endpoints exigen autenticacion (authMiddleware) y se aislan
// por tenant_id (multi-tenant).

const db = require('../config/db');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

// =============================================================
// 1) LIBRO OFICIAL DE COMPRAS
// GET /accounting/libro-oficial/compras?startDate&endDate
// =============================================================
const getLibroCompras = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'tenantId es obligatorio' });
        }

        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Los parametros startDate y endDate son obligatorios (YYYY-MM-DD)'
            });
        }

        const params = [tenantId, startDate, endDate];
        const result = await db.query(
            `SELECT
                ap.id,
                ap.issue_date,
                ap.due_date,
                ap.supplier_document_type,
                ap.supplier_document_number,
                ap.supplier_name,
                ap.document_type,
                ap.document_number,
                ap.currency,
                ap.status,
                COALESCE(ap.subtotal_amount, 0)::numeric            AS base_amount,
                COALESCE(ap.tax_amount, 0)::numeric                 AS iva_amount,
                COALESCE(ap.withholding_source_amount, 0)::numeric  AS retefuente_amount,
                COALESCE(ap.withholding_vat_amount, 0)::numeric     AS reteiva_amount,
                COALESCE(ap.withholding_ica_amount, 0)::numeric     AS reteica_amount,
                COALESCE(ap.original_amount, 0)::numeric            AS total_amount
             FROM accounts_payable ap
             WHERE ap.tenant_id = $1
               AND ap.issue_date BETWEEN $2 AND $3
             ORDER BY ap.issue_date ASC, ap.id ASC`,
            params
        );

        const compras = result.rows.map((row, idx) => ({
            consecutivo: idx + 1,
            id: row.id,
            fecha: row.issue_date,
            fecha_vencimiento: row.due_date,
            proveedor_tipo_documento: row.supplier_document_type || '',
            proveedor_numero_documento: row.supplier_document_number || '',
            proveedor_nombre: row.supplier_name || '',
            tipo_documento: row.document_type || '',
            numero_factura: row.document_number || '',
            moneda: row.currency || 'COP',
            estado: row.status || '',
            base_gravable: toNumber(row.base_amount),
            iva_descontable: toNumber(row.iva_amount),
            retefuente: toNumber(row.retefuente_amount),
            reteiva: toNumber(row.reteiva_amount),
            reteica: toNumber(row.reteica_amount),
            total: toNumber(row.total_amount)
        }));

        const totals = compras.reduce(
            (acc, r) => ({
                base: acc.base + r.base_gravable,
                iva: acc.iva + r.iva_descontable,
                retefuente: acc.retefuente + r.retefuente,
                reteIva: acc.reteIva + r.reteiva,
                reteIca: acc.reteIca + r.reteica,
                total: acc.total + r.total
            }),
            { base: 0, iva: 0, retefuente: 0, reteIva: 0, reteIca: 0, total: 0 }
        );

        Object.keys(totals).forEach((k) => { totals[k] = Number(totals[k].toFixed(2)); });

        return res.json({
            success: true,
            periodo: { startDate, endDate },
            compras,
            totals,
            count: compras.length
        });
    } catch (error) {
        console.error('[LibroOficial] Error obteniendo libro de compras:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================================
// 2) LIBRO OFICIAL DE VENTAS
// GET /accounting/libro-oficial/ventas?startDate&endDate
//
// Fuente primaria: accounts_receivable (tiene columnas de IVA y
// retenciones practicadas por el cliente). Si una factura aun no
// genero CxC (invoice sin registrar en AR), caera de este listado
// oficial (solo reportan facturas con asiento contable, que es lo
// correcto para la DIAN).
// =============================================================
const getLibroVentas = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'tenantId es obligatorio' });
        }

        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Los parametros startDate y endDate son obligatorios (YYYY-MM-DD)'
            });
        }

        const params = [tenantId, startDate, endDate];
        const result = await db.query(
            `SELECT
                ar.id,
                ar.issue_date,
                ar.due_date,
                ar.client_document_type,
                ar.client_document_number,
                ar.client_name,
                ar.document_type,
                ar.document_number,
                ar.currency,
                ar.status,
                COALESCE(ar.subtotal_amount, 0)::numeric            AS base_amount,
                COALESCE(ar.tax_amount, 0)::numeric                 AS iva_amount,
                COALESCE(ar.withholding_source_amount, 0)::numeric  AS retefuente_amount,
                COALESCE(ar.withholding_vat_amount, 0)::numeric     AS reteiva_amount,
                COALESCE(ar.withholding_ica_amount, 0)::numeric     AS reteica_amount,
                COALESCE(ar.original_amount, 0)::numeric            AS total_amount
             FROM accounts_receivable ar
             WHERE ar.tenant_id = $1
               AND ar.issue_date BETWEEN $2 AND $3
             ORDER BY ar.issue_date ASC, ar.id ASC`,
            params
        );

        const ventas = result.rows.map((row, idx) => ({
            consecutivo: idx + 1,
            id: row.id,
            fecha: row.issue_date,
            fecha_vencimiento: row.due_date,
            cliente_tipo_documento: row.client_document_type || '',
            cliente_numero_documento: row.client_document_number || '',
            cliente_nombre: row.client_name || '',
            tipo_documento: row.document_type || '',
            numero_factura: row.document_number || '',
            moneda: row.currency || 'COP',
            estado: row.status || '',
            base_gravable: toNumber(row.base_amount),
            iva_generado: toNumber(row.iva_amount),
            retefuente: toNumber(row.retefuente_amount),
            reteiva: toNumber(row.reteiva_amount),
            reteica: toNumber(row.reteica_amount),
            total: toNumber(row.total_amount)
        }));

        const totals = ventas.reduce(
            (acc, r) => ({
                base: acc.base + r.base_gravable,
                iva: acc.iva + r.iva_generado,
                retefuente: acc.retefuente + r.retefuente,
                reteIva: acc.reteIva + r.reteiva,
                reteIca: acc.reteIca + r.reteica,
                total: acc.total + r.total
            }),
            { base: 0, iva: 0, retefuente: 0, reteIva: 0, reteIca: 0, total: 0 }
        );

        Object.keys(totals).forEach((k) => { totals[k] = Number(totals[k].toFixed(2)); });

        return res.json({
            success: true,
            periodo: { startDate, endDate },
            ventas,
            totals,
            count: ventas.length
        });
    } catch (error) {
        console.error('[LibroOficial] Error obteniendo libro de ventas:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================================
// 3) LIBRO DE INVENTARIOS Y BALANCE
// GET /accounting/libro-oficial/inventarios-balance?date=YYYY-MM-DD
//
// Snapshot fiscal de saldos por cuenta del PUC al cierre del periodo.
// Entrega por cuenta: saldo inicial del anio, debitos y creditos
// acumulados del periodo anio->fecha, y saldo final.
// Similar a getTrialBalance pero orientado a cierre fiscal.
// =============================================================
const getLibroInventariosYBalance = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'tenantId es obligatorio' });
        }

        const { date } = req.query;
        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'El parametro date (YYYY-MM-DD) es obligatorio'
            });
        }

        // Limites del anio fiscal correspondiente a la fecha dada
        const year = new Date(date).getUTCFullYear();
        if (!Number.isFinite(year)) {
            return res.status(400).json({ success: false, error: 'date invalido, use formato YYYY-MM-DD' });
        }
        const yearStart = `${year}-01-01`;

        // Agregamos: saldo_inicial (movimientos previos al anio),
        // debitos y creditos del periodo anio->fecha, y saldo_final.
        const result = await db.query(
            `SELECT
                jel.account_code,
                MAX(jel.account_name) AS account_name,
                CASE
                    WHEN jel.account_code LIKE '1%' THEN 'ACTIVO'
                    WHEN jel.account_code LIKE '2%' THEN 'PASIVO'
                    WHEN jel.account_code LIKE '3%' THEN 'PATRIMONIO'
                    WHEN jel.account_code LIKE '4%' THEN 'INGRESO'
                    WHEN jel.account_code LIKE '5%' THEN 'GASTO'
                    WHEN jel.account_code LIKE '6%' THEN 'COSTO_VENTAS'
                    WHEN jel.account_code LIKE '7%' THEN 'COSTO_PRODUCCION'
                    WHEN jel.account_code LIKE '8%' THEN 'ORDEN_DEUDORA'
                    WHEN jel.account_code LIKE '9%' THEN 'ORDEN_ACREEDORA'
                    ELSE 'OTRO'
                END AS account_type,
                COALESCE(SUM(CASE WHEN je.entry_date < $2
                                  THEN jel.debit - jel.credit ELSE 0 END), 0)::numeric AS saldo_inicial,
                COALESCE(SUM(CASE WHEN je.entry_date BETWEEN $2 AND $3
                                  THEN jel.debit ELSE 0 END), 0)::numeric AS debitos_periodo,
                COALESCE(SUM(CASE WHEN je.entry_date BETWEEN $2 AND $3
                                  THEN jel.credit ELSE 0 END), 0)::numeric AS creditos_periodo,
                COALESCE(SUM(CASE WHEN je.entry_date <= $3
                                  THEN jel.debit - jel.credit ELSE 0 END), 0)::numeric AS saldo_final
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1
               AND je.status = 'ACTIVO'
               AND je.entry_date <= $3
             GROUP BY jel.account_code
             ORDER BY jel.account_code ASC`,
            [tenantId, yearStart, date]
        );

        const cuentas = result.rows
            .map((row) => ({
                codigo: row.account_code,
                nombre: row.account_name || '',
                tipo: row.account_type,
                saldo_inicial: toNumber(row.saldo_inicial),
                debitos: toNumber(row.debitos_periodo),
                creditos: toNumber(row.creditos_periodo),
                saldo_final: toNumber(row.saldo_final)
            }))
            // Descartar cuentas totalmente en cero (sin movimiento ni saldo).
            .filter((c) => c.saldo_inicial !== 0 || c.debitos !== 0 || c.creditos !== 0 || c.saldo_final !== 0);

        const totals = cuentas.reduce(
            (acc, c) => ({
                saldoInicial: acc.saldoInicial + c.saldo_inicial,
                debitos: acc.debitos + c.debitos,
                creditos: acc.creditos + c.creditos,
                saldoFinal: acc.saldoFinal + c.saldo_final
            }),
            { saldoInicial: 0, debitos: 0, creditos: 0, saldoFinal: 0 }
        );
        Object.keys(totals).forEach((k) => { totals[k] = Number(totals[k].toFixed(2)); });

        return res.json({
            success: true,
            date,
            year,
            cuentas,
            totals,
            count: cuentas.length
        });
    } catch (error) {
        console.error('[LibroOficial] Error obteniendo libro de inventarios y balance:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getLibroCompras,
    getLibroVentas,
    getLibroInventariosYBalance
};
