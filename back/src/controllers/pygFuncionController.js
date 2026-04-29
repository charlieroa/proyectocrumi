// src/controllers/pygFuncionController.js
// Estado de Resultado Integral por Funcion de Gastos (NIIF)

const db = require('../config/db');

// =============================================
// Clasificacion funcional por codigo PUC
// =============================================
// Devuelve la categoria funcional a partir del codigo de cuenta.
// Se evalua por prefijo de 4 digitos (subcuenta) cuando aplica,
// luego por clase (1 digito).
const classifyByFunction = (accountCode) => {
    if (!accountCode) return null;
    const code = String(accountCode);

    // Clase 4: Ingresos operacionales
    if (code.startsWith('4')) return 'INGRESOS';

    // Clase 6: Costo de ventas
    if (code.startsWith('6')) return 'COSTO_VENTAS';

    // Clase 7: Costo de produccion (se agrupa dentro de costo de ventas)
    if (code.startsWith('7')) return 'COSTO_VENTAS';

    // Clase 5: Gastos — depende de la cuenta (2 primeros digitos) y subcuenta (4)
    if (code.startsWith('5')) {
        const sub4 = code.substring(0, 4);
        const cuenta2 = code.substring(0, 2);

        // Gastos de administracion (cuenta 51)
        const gastosAdminSubs = [
            '5105', '5110', '5115', '5120', '5125', '5130',
            '5135', '5140', '5145', '5150', '5155', '5160',
            '5165', '5195', '5199'
        ];
        if (gastosAdminSubs.includes(sub4)) return 'GASTOS_ADMIN';
        if (cuenta2 === '51') return 'GASTOS_ADMIN';

        // Gastos de ventas (cuenta 52 completa)
        if (cuenta2 === '52') return 'GASTOS_VENTAS';

        // Gastos no operacionales (cuenta 53)
        if (cuenta2 === '53') return 'GASTOS_NO_OP';

        // Impuesto de renta (cuenta 54)
        if (cuenta2 === '54') return 'IMPUESTO_RENTA';

        // Otros codigos de clase 5 — por defecto, gastos de administracion
        return 'GASTOS_ADMIN';
    }

    return null;
};

// =============================================
// GET /accounting/income-statement/by-function
// =============================================
const getIncomeStatementByFunction = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const { startDate, endDate } = req.query;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'tenant_id requerido'
            });
        }

        // Validacion basica de fechas (formato YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (startDate && !dateRegex.test(startDate)) {
            return res.status(400).json({
                success: false,
                error: 'startDate invalido, use formato YYYY-MM-DD'
            });
        }
        if (endDate && !dateRegex.test(endDate)) {
            return res.status(400).json({
                success: false,
                error: 'endDate invalido, use formato YYYY-MM-DD'
            });
        }

        let dateFilter = '';
        const params = [tenantId];
        let paramIdx = 2;

        if (startDate) {
            dateFilter += ` AND je.entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            dateFilter += ` AND je.entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT
                jel.account_code,
                jel.account_name,
                COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0) AS amount
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1
               AND je.status = 'ACTIVO'
               AND (
                    jel.account_code LIKE '4%'
                 OR jel.account_code LIKE '5%'
                 OR jel.account_code LIKE '6%'
                 OR jel.account_code LIKE '7%'
               )
               ${dateFilter}
             GROUP BY jel.account_code, jel.account_name
             ORDER BY jel.account_code`,
            params
        );

        // Contenedores por categoria funcional
        const ingresos = [];
        const costoVentas = [];
        const gastosAdmin = [];
        const gastosVentas = [];
        const gastosNoOperacionales = [];
        const impuestoRenta = [];

        // Convencion de saldo:
        //  - Ingresos (clase 4): naturaleza credito => amount como viene (credit - debit)
        //  - Costos y gastos (5, 6, 7): naturaleza debito => invertimos signo
        for (const row of result.rows) {
            const code = row.account_code;
            const category = classifyByFunction(code);
            if (!category) continue;

            const rawAmount = Number(row.amount) || 0;

            let balance;
            if (code.startsWith('4')) {
                balance = rawAmount;
            } else {
                balance = -rawAmount;
            }

            const item = {
                account_code: row.account_code,
                account_name: row.account_name,
                balance
            };

            switch (category) {
                case 'INGRESOS':
                    ingresos.push(item);
                    break;
                case 'COSTO_VENTAS':
                    costoVentas.push(item);
                    break;
                case 'GASTOS_ADMIN':
                    gastosAdmin.push(item);
                    break;
                case 'GASTOS_VENTAS':
                    gastosVentas.push(item);
                    break;
                case 'GASTOS_NO_OP':
                    gastosNoOperacionales.push(item);
                    break;
                case 'IMPUESTO_RENTA':
                    impuestoRenta.push(item);
                    break;
                default:
                    break;
            }
        }

        const sumBalance = (arr) =>
            arr.reduce((acc, r) => acc + (Number(r.balance) || 0), 0);

        const totIngresos = sumBalance(ingresos);
        const totCostoVentas = sumBalance(costoVentas);
        const utilidadBruta = totIngresos - totCostoVentas;

        const totGastosAdmin = sumBalance(gastosAdmin);
        const totGastosVentas = sumBalance(gastosVentas);
        const utilidadOperacional = utilidadBruta - totGastosAdmin - totGastosVentas;

        const totGastosNoOp = sumBalance(gastosNoOperacionales);
        const utilidadAntesImpuestos = utilidadOperacional - totGastosNoOp;

        const totImpuestoRenta = sumBalance(impuestoRenta);
        const utilidadNeta = utilidadAntesImpuestos - totImpuestoRenta;

        return res.json({
            success: true,
            statement: {
                ingresos,
                costoVentas,
                gastosAdmin,
                gastosVentas,
                gastosNoOperacionales,
                impuestoRenta,
                totals: {
                    ingresos: totIngresos,
                    costoVentas: totCostoVentas,
                    utilidadBruta,
                    gastosAdmin: totGastosAdmin,
                    gastosVentas: totGastosVentas,
                    utilidadOperacional,
                    gastosNoOperacionales: totGastosNoOp,
                    utilidadAntesImpuestos,
                    impuestoRenta: totImpuestoRenta,
                    utilidadNeta
                },
                periodo: {
                    startDate: startDate || null,
                    endDate: endDate || null
                }
            }
        });
    } catch (error) {
        console.error('[PygFuncion] Error obteniendo estado de resultados por funcion:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getIncomeStatementByFunction
};
