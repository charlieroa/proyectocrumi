// src/controllers/nominaController.js
// Controlador completo del módulo de Nómina - Colombia
// Gestiona empleados, períodos, liquidaciones, novedades, nómina electrónica, PILA e incapacidades

const db = require('../config/db');
const { calculateLiquidation, getPayrollConfig } = require('../helpers/payrollEngine');
const { calculatePilaSummary, generatePilaFlatFile } = require('../services/pilaService');
const {
    getPayrollAccountingSnapshot,
    accountPayrollPeriod
} = require('../helpers/payrollAccountingHelper');
const { upsertThirdParty } = require('../helpers/thirdPartyHelper');

// =============================================
// EMPLEADOS
// =============================================

/**
 * Listar empleados del tenant con búsqueda, filtro de estado y paginación.
 * GET /api/nomina/empleados?search=&status=&page=1&limit=20
 */
exports.getEmployees = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { search, status, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let whereClause = 'WHERE e.tenant_id = $1';
        const params = [tenant_id];
        let paramIdx = 2;

        if (status) {
            whereClause += ` AND e.status = $${paramIdx}`;
            params.push(status);
            paramIdx++;
        }

        if (search) {
            whereClause += ` AND (
                e.first_name ILIKE $${paramIdx} OR
                e.last_name ILIKE $${paramIdx} OR
                e.document_number ILIKE $${paramIdx} OR
                e.email ILIKE $${paramIdx} OR
                e.position ILIKE $${paramIdx}
            )`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM employees e ${whereClause}`,
            params
        );

        const result = await db.query(
            `SELECT e.id, e.document_type, e.document_number, e.first_name, e.last_name,
                    e.email, e.phone, e.position, e.department, e.base_salary, e.salary_type,
                    e.contract_type, e.hire_date, e.status, e.created_at
             FROM employees e
             ${whereClause}
             ORDER BY e.last_name ASC, e.first_name ASC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            [...params, Number(limit), offset]
        );

        const total = parseInt(countResult.rows[0].total);

        return res.json({
            success: true,
            data: {
                employees: result.rows,
                total,
                page: Number(page),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('[Nomina] Error obteniendo empleados:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener empleados' });
    }
};

/**
 * Obtener empleado por ID con afiliaciones y contrato activo.
 * GET /api/nomina/empleados/:id
 */
exports.getEmployeeById = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        const empResult = await db.query(
            `SELECT * FROM employees WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        if (empResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
        }

        const affiliationResult = await db.query(
            `SELECT * FROM employee_affiliations WHERE employee_id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        const contractResult = await db.query(
            `SELECT * FROM employee_contracts
             WHERE employee_id = $1 AND tenant_id = $2 AND status = 'active'
             ORDER BY start_date DESC LIMIT 1`,
            [id, tenant_id]
        );

        const employee = empResult.rows[0];

        employee.affiliations = affiliationResult.rows[0] || null;
        employee.active_contract = contractResult.rows[0] || null;

        return res.json({ success: true, data: employee });
    } catch (error) {
        console.error('[Nomina] Error obteniendo empleado:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener empleado' });
    }
};

/**
 * Crear empleado con registro de afiliación inicial.
 * POST /api/nomina/empleados
 */
exports.createEmployee = async (req, res) => {
    const client = await db.getClient();
    try {
        const { tenant_id } = req.user;
        const {
            document_type, document_number, first_name, last_name, email, phone,
            address, city, department_geo, birth_date, gender, hire_date,
            contract_type, position, department, cost_center, base_salary,
            salary_type, payment_frequency, works_saturdays, bank_name,
            bank_account_type, bank_account_number, arl_risk_class,
            // Afiliaciones opcionales
            eps_code, eps_name, afp_code, afp_name, arl_code, arl_name,
            ccf_code, ccf_name, eps_affiliation_number, afp_affiliation_number
        } = req.body;

        if (!document_number || !first_name || !last_name || !base_salary) {
            return res.status(400).json({
                success: false,
                error: 'Campos obligatorios: document_number, first_name, last_name, base_salary'
            });
        }

        await client.query('BEGIN');

        // Verificar duplicado por documento
        const existing = await client.query(
            `SELECT id FROM employees WHERE tenant_id = $1 AND document_number = $2`,
            [tenant_id, document_number]
        );
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, error: 'Ya existe un empleado con este número de documento' });
        }

        const empResult = await client.query(
            `INSERT INTO employees (
                tenant_id, document_type, document_number, first_name, last_name, email, phone,
                address, city, department_geo, birth_date, gender, hire_date,
                contract_type, position, department, cost_center, base_salary,
                salary_type, payment_frequency, works_saturdays, bank_name,
                bank_account_type, bank_account_number, arl_risk_class, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 'active'
            ) RETURNING *`,
            [
                tenant_id, document_type || 'CC', document_number, first_name, last_name,
                email, phone, address, city, department_geo, birth_date, gender,
                hire_date || new Date().toISOString().split('T')[0],
                contract_type || 'indefinido', position, department, cost_center,
                base_salary, salary_type || 'fijo', payment_frequency || 'mensual',
                works_saturdays || false, bank_name, bank_account_type, bank_account_number,
                arl_risk_class || 1
            ]
        );

        const employee = empResult.rows[0];

        // Crear registro de afiliación inicial
        await client.query(
            `INSERT INTO employee_affiliations (
                employee_id, tenant_id, eps_code, eps_name, afp_code, afp_name,
                arl_code, arl_name, ccf_code, ccf_name,
                eps_affiliation_number, afp_affiliation_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                employee.id, tenant_id, eps_code, eps_name, afp_code, afp_name,
                arl_code, arl_name, ccf_code, ccf_name,
                eps_affiliation_number, afp_affiliation_number
            ]
        );

        await client.query('COMMIT');
        return res.status(201).json({ success: true, data: employee });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Nomina] Error creando empleado:', error);
        return res.status(500).json({ success: false, error: 'Error interno al crear empleado' });
    } finally {
        client.release();
    }
};

/**
 * Actualizar datos del empleado.
 * PUT /api/nomina/empleados/:id
 */
exports.updateEmployee = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;
        const {
            document_type, document_number, first_name, last_name, email, phone,
            address, city, department_geo, birth_date, gender, hire_date, termination_date,
            contract_type, position, department, cost_center, base_salary,
            salary_type, payment_frequency, works_saturdays, bank_name,
            bank_account_type, bank_account_number, arl_risk_class, status
        } = req.body;

        const result = await db.query(
            `UPDATE employees SET
                document_type = COALESCE($1, document_type),
                document_number = COALESCE($2, document_number),
                first_name = COALESCE($3, first_name),
                last_name = COALESCE($4, last_name),
                email = COALESCE($5, email),
                phone = COALESCE($6, phone),
                address = COALESCE($7, address),
                city = COALESCE($8, city),
                department_geo = COALESCE($9, department_geo),
                birth_date = COALESCE($10, birth_date),
                gender = COALESCE($11, gender),
                hire_date = COALESCE($12, hire_date),
                termination_date = COALESCE($13, termination_date),
                contract_type = COALESCE($14, contract_type),
                position = COALESCE($15, position),
                department = COALESCE($16, department),
                cost_center = COALESCE($17, cost_center),
                base_salary = COALESCE($18, base_salary),
                salary_type = COALESCE($19, salary_type),
                payment_frequency = COALESCE($20, payment_frequency),
                works_saturdays = COALESCE($21, works_saturdays),
                bank_name = COALESCE($22, bank_name),
                bank_account_type = COALESCE($23, bank_account_type),
                bank_account_number = COALESCE($24, bank_account_number),
                arl_risk_class = COALESCE($25, arl_risk_class),
                status = COALESCE($26, status),
                updated_at = NOW()
             WHERE id = $27 AND tenant_id = $28
             RETURNING *`,
            [
                document_type, document_number, first_name, last_name, email, phone,
                address, city, department_geo, birth_date, gender, hire_date, termination_date,
                contract_type, position, department, cost_center, base_salary,
                salary_type, payment_frequency, works_saturdays, bank_name,
                bank_account_type, bank_account_number, arl_risk_class, status,
                id, tenant_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
        }

        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[Nomina] Error actualizando empleado:', error);
        return res.status(500).json({ success: false, error: 'Error interno al actualizar empleado' });
    }
};

/**
 * Soft delete: marcar empleado como inactivo.
 * DELETE /api/nomina/empleados/:id
 */
exports.deleteEmployee = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        const result = await db.query(
            `UPDATE employees SET status = 'inactive', termination_date = CURRENT_DATE, updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2 AND status = 'active'
             RETURNING id, first_name, last_name, status`,
            [id, tenant_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Empleado no encontrado o ya inactivo' });
        }

        return res.json({ success: true, data: result.rows[0], message: 'Empleado desactivado correctamente' });
    } catch (error) {
        console.error('[Nomina] Error eliminando empleado:', error);
        return res.status(500).json({ success: false, error: 'Error interno al eliminar empleado' });
    }
};

// =============================================
// AFILIACIONES
// =============================================

/**
 * Obtener afiliaciones de un empleado.
 * GET /api/nomina/empleados/:id/afiliaciones
 */
exports.getAffiliations = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        const result = await db.query(
            `SELECT ea.*, e.first_name, e.last_name, e.document_number
             FROM employee_affiliations ea
             JOIN employees e ON ea.employee_id = e.id
             WHERE ea.employee_id = $1 AND ea.tenant_id = $2`,
            [id, tenant_id]
        );

        return res.json({ success: true, data: result.rows[0] || null });
    } catch (error) {
        console.error('[Nomina] Error obteniendo afiliaciones:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener afiliaciones' });
    }
};

/**
 * Crear o actualizar afiliaciones de un empleado (upsert).
 * PUT /api/nomina/empleados/:id/afiliaciones
 */
exports.updateAffiliations = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;
        const {
            eps_code, eps_name, afp_code, afp_name, arl_code, arl_name,
            ccf_code, ccf_name, eps_affiliation_number, afp_affiliation_number
        } = req.body;

        // Verificar que el empleado existe
        const empCheck = await db.query(
            `SELECT id FROM employees WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );
        if (empCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
        }

        const result = await db.query(
            `INSERT INTO employee_affiliations (
                employee_id, tenant_id, eps_code, eps_name, afp_code, afp_name,
                arl_code, arl_name, ccf_code, ccf_name,
                eps_affiliation_number, afp_affiliation_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (employee_id) DO UPDATE SET
                eps_code = COALESCE(EXCLUDED.eps_code, employee_affiliations.eps_code),
                eps_name = COALESCE(EXCLUDED.eps_name, employee_affiliations.eps_name),
                afp_code = COALESCE(EXCLUDED.afp_code, employee_affiliations.afp_code),
                afp_name = COALESCE(EXCLUDED.afp_name, employee_affiliations.afp_name),
                arl_code = COALESCE(EXCLUDED.arl_code, employee_affiliations.arl_code),
                arl_name = COALESCE(EXCLUDED.arl_name, employee_affiliations.arl_name),
                ccf_code = COALESCE(EXCLUDED.ccf_code, employee_affiliations.ccf_code),
                ccf_name = COALESCE(EXCLUDED.ccf_name, employee_affiliations.ccf_name),
                eps_affiliation_number = COALESCE(EXCLUDED.eps_affiliation_number, employee_affiliations.eps_affiliation_number),
                afp_affiliation_number = COALESCE(EXCLUDED.afp_affiliation_number, employee_affiliations.afp_affiliation_number)
            RETURNING *`,
            [
                id, tenant_id, eps_code, eps_name, afp_code, afp_name,
                arl_code, arl_name, ccf_code, ccf_name,
                eps_affiliation_number, afp_affiliation_number
            ]
        );

        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[Nomina] Error actualizando afiliaciones:', error);
        return res.status(500).json({ success: false, error: 'Error interno al actualizar afiliaciones' });
    }
};

// =============================================
// CONTRATOS
// =============================================

/**
 * Listar contratos de un empleado.
 * GET /api/nomina/empleados/:id/contratos
 */
exports.getContracts = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        const result = await db.query(
            `SELECT * FROM employee_contracts
             WHERE employee_id = $1 AND tenant_id = $2
             ORDER BY start_date DESC`,
            [id, tenant_id]
        );

        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('[Nomina] Error obteniendo contratos:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener contratos' });
    }
};

/**
 * Crear nuevo contrato para un empleado.
 * POST /api/nomina/empleados/:id/contratos
 */
exports.createContract = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;
        const {
            contract_type, start_date, end_date, base_salary,
            position, department, notes, document_url
        } = req.body;

        if (!contract_type || !start_date || !base_salary) {
            return res.status(400).json({
                success: false,
                error: 'Campos obligatorios: contract_type, start_date, base_salary'
            });
        }

        // Verificar que el empleado existe
        const empCheck = await db.query(
            `SELECT id FROM employees WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );
        if (empCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
        }

        // Desactivar contratos activos anteriores
        await db.query(
            `UPDATE employee_contracts SET status = 'inactive'
             WHERE employee_id = $1 AND tenant_id = $2 AND status = 'active'`,
            [id, tenant_id]
        );

        const result = await db.query(
            `INSERT INTO employee_contracts (
                employee_id, tenant_id, contract_type, start_date, end_date,
                base_salary, position, department, notes, document_url, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
            RETURNING *`,
            [id, tenant_id, contract_type, start_date, end_date, base_salary, position, department, notes, document_url]
        );

        // Actualizar salario y datos del empleado con el nuevo contrato
        await db.query(
            `UPDATE employees SET
                base_salary = $1, contract_type = $2, position = COALESCE($3, position),
                department = COALESCE($4, department), updated_at = NOW()
             WHERE id = $5 AND tenant_id = $6`,
            [base_salary, contract_type, position, department, id, tenant_id]
        );

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[Nomina] Error creando contrato:', error);
        return res.status(500).json({ success: false, error: 'Error interno al crear contrato' });
    }
};

// =============================================
// PERÍODOS DE NÓMINA
// =============================================

/**
 * Listar períodos de nómina con filtros.
 * GET /api/nomina/periodos?year=&month=&status=
 */
exports.getPeriods = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { year, month, status, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let whereClause = 'WHERE pp.tenant_id = $1';
        const params = [tenant_id];
        let paramIdx = 2;

        if (year) {
            whereClause += ` AND pp.year = $${paramIdx}`;
            params.push(Number(year));
            paramIdx++;
        }
        if (month) {
            whereClause += ` AND pp.month = $${paramIdx}`;
            params.push(Number(month));
            paramIdx++;
        }
        if (status) {
            whereClause += ` AND pp.status = $${paramIdx}`;
            params.push(status);
            paramIdx++;
        }

        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM payroll_periods pp ${whereClause}`,
            params
        );

        const result = await db.query(
            `SELECT pp.*,
                    u_created.first_name || ' ' || COALESCE(u_created.last_name, '') as created_by_name,
                    u_approved.first_name || ' ' || COALESCE(u_approved.last_name, '') as approved_by_name
             FROM payroll_periods pp
             LEFT JOIN users u_created ON pp.created_by = u_created.id
             LEFT JOIN users u_approved ON pp.approved_by = u_approved.id
             ${whereClause}
             ORDER BY pp.year DESC, pp.month DESC, pp.period_number DESC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            [...params, Number(limit), offset]
        );

        const total = parseInt(countResult.rows[0].total);

        return res.json({
            success: true,
            data: {
                periods: result.rows,
                total,
                page: Number(page),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('[Nomina] Error obteniendo períodos:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener períodos' });
    }
};

/**
 * Crear nuevo período de nómina.
 * POST /api/nomina/periodos
 */
exports.createPeriod = async (req, res) => {
    try {
        const { tenant_id, id: user_id } = req.user;
        const {
            period_type, year, month, period_number,
            start_date, end_date, payment_date, notes
        } = req.body;

        if (!year || !month || !start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'Campos obligatorios: year, month, start_date, end_date'
            });
        }

        // Verificar que no exista un período duplicado
        const existing = await db.query(
            `SELECT id FROM payroll_periods
             WHERE tenant_id = $1 AND year = $2 AND month = $3 AND period_number = $4`,
            [tenant_id, year, month, period_number || 1]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'Ya existe un período con estos parámetros' });
        }

        const result = await db.query(
            `INSERT INTO payroll_periods (
                tenant_id, period_type, year, month, period_number,
                start_date, end_date, payment_date, status, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'borrador', $9, $10)
            RETURNING *`,
            [
                tenant_id, period_type || 'mensual', year, month,
                period_number || 1, start_date, end_date,
                payment_date || end_date, notes, user_id
            ]
        );

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[Nomina] Error creando período:', error);
        return res.status(500).json({ success: false, error: 'Error interno al crear período' });
    }
};

/**
 * Obtener período por ID con resumen de totales.
 * GET /api/nomina/periodos/:id
 */
exports.getPeriodById = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        const periodResult = await db.query(
            `SELECT pp.*,
                    u_created.first_name || ' ' || COALESCE(u_created.last_name, '') as created_by_name,
                    u_approved.first_name || ' ' || COALESCE(u_approved.last_name, '') as approved_by_name
             FROM payroll_periods pp
             LEFT JOIN users u_created ON pp.created_by = u_created.id
             LEFT JOIN users u_approved ON pp.approved_by = u_approved.id
             WHERE pp.id = $1 AND pp.tenant_id = $2`,
            [id, tenant_id]
        );

        if (periodResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Período no encontrado' });
        }

        // Obtener resumen de liquidaciones del período
        const summaryResult = await db.query(
            `SELECT
                COUNT(*) as employee_count,
                COALESCE(SUM(total_devengado), 0) as total_devengado,
                COALESCE(SUM(total_deductions), 0) as total_deducido,
                COALESCE(SUM(net_pay), 0) as total_neto,
                COALESCE(SUM(total_employer_cost), 0) as total_costo_empresa,
                COALESCE(SUM(total_provisions), 0) as total_provisiones
             FROM payroll_liquidations
             WHERE period_id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        const period = periodResult.rows[0];
        period.summary = summaryResult.rows[0];

        return res.json({ success: true, data: period });
    } catch (error) {
        console.error('[Nomina] Error obteniendo período:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener período' });
    }
};

/**
 * Eliminar período (solo si está en borrador).
 * DELETE /api/nomina/periodos/:id
 */
exports.deletePeriod = async (req, res) => {
    const client = await db.getClient();
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        await client.query('BEGIN');

        // Verificar estado
        const periodCheck = await client.query(
            `SELECT status FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        if (periodCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Período no encontrado' });
        }

        if (periodCheck.rows[0].status !== 'borrador') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Solo se pueden eliminar períodos en estado borrador'
            });
        }

        // Eliminar liquidaciones asociadas
        await client.query(
            `DELETE FROM payroll_liquidations WHERE period_id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        // Eliminar novedades asociadas
        await client.query(
            `DELETE FROM payroll_novelties WHERE period_id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        // Eliminar período
        await client.query(
            `DELETE FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        await client.query('COMMIT');
        return res.json({ success: true, message: 'Período eliminado correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Nomina] Error eliminando período:', error);
        return res.status(500).json({ success: false, error: 'Error interno al eliminar período' });
    } finally {
        client.release();
    }
};

/**
 * Aprobar período de nómina.
 * PUT /api/nomina/periodos/:id/aprobar
 */
exports.approvePeriod = async (req, res) => {
    const client = await db.getClient();
    const { tenant_id, id: user_id } = req.user;
    const { id } = req.params;

    try {
        await client.query('BEGIN');

        const periodCheck = await client.query(
            `SELECT pp.status, COUNT(pl.id) as liquidation_count
             FROM payroll_periods pp
             LEFT JOIN payroll_liquidations pl ON pp.id = pl.period_id
             WHERE pp.id = $1 AND pp.tenant_id = $2
             GROUP BY pp.id, pp.status`,
            [id, tenant_id]
        );

        if (periodCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Período no encontrado' });
        }

        const { status, liquidation_count } = periodCheck.rows[0];

        if (status === 'aprobado' || status === 'pagado' || status === 'transmitido') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: `El período ya está en estado: ${status}` });
        }

        if (parseInt(liquidation_count, 10) === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'No se puede aprobar un período sin liquidaciones. Primero genere las liquidaciones.'
            });
        }

        const result = await client.query(
            `UPDATE payroll_periods SET
                status = 'aprobado',
                approved_by = $1,
                approved_at = NOW(),
                accounting_status = COALESCE(accounting_status, 'PENDIENTE'),
                accounting_error = NULL,
                updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3
             RETURNING *`,
            [user_id, id, tenant_id]
        );

        await client.query(
            `UPDATE payroll_periods pp SET
                total_devengado = sub.total_devengado,
                total_deducido = sub.total_deducido,
                total_neto = sub.total_neto,
                total_costo_empresa = sub.total_costo_empresa,
                employee_count = sub.emp_count
             FROM (
                SELECT
                    period_id,
                    COALESCE(SUM(total_devengado), 0) as total_devengado,
                    COALESCE(SUM(total_deductions), 0) as total_deducido,
                    COALESCE(SUM(net_pay), 0) as total_neto,
                    COALESCE(SUM(total_employer_cost), 0) as total_costo_empresa,
                    COUNT(*) as emp_count
                FROM payroll_liquidations WHERE period_id = $1
                GROUP BY period_id
             ) sub
             WHERE pp.id = sub.period_id AND pp.id = $1`,
            [id]
        );

        const accounting = await accountPayrollPeriod(client, tenant_id, id, user_id);

        await client.query('COMMIT');
        return res.json({
            success: true,
            data: result.rows[0],
            accounting,
            message: 'Período aprobado y contabilizado correctamente'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Nomina] Error aprobando período:', error);
        await db.query(
            `UPDATE payroll_periods
             SET accounting_status = 'ERROR',
                 accounting_error = $1,
                 updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3`,
            [error.message, id, tenant_id]
        ).catch(() => null);
        return res.status(500).json({ success: false, error: 'Error interno al aprobar período', details: error.message });
    } finally {
        client.release();
    }
};

/**
 * Obtener estado contable del periodo.
 * GET /api/nomina/periodos/:id/contabilidad
 */
exports.getPeriodAccountingStatus = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        const snapshot = await getPayrollAccountingSnapshot(db, tenant_id, id);
        if (!snapshot) {
            return res.status(404).json({ success: false, error: 'Período no encontrado' });
        }

        const { period, summary } = snapshot;
        return res.json({
            success: true,
            data: {
                period,
                summary,
                accounting: {
                    status: period.accounting_status || 'PENDIENTE',
                    journalEntryId: period.accounting_journal_entry_id || null,
                    journalEntryNumber: period.accounting_journal_number || period.accounting_journal_number_live || null,
                    postedAt: period.accounting_posted_at || null,
                    error: period.accounting_error || null
                }
            }
        });
    } catch (error) {
        console.error('[Nomina] Error obteniendo estado contable del período:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener estado contable' });
    }
};

/**
 * Contabilizar un periodo de nómina.
 * POST /api/nomina/periodos/:id/contabilizar
 */
exports.accountPeriod = async (req, res) => {
    const client = await db.getClient();
    try {
        const { tenant_id, id: user_id } = req.user;
        const { id } = req.params;

        await client.query('BEGIN');

        const periodResult = await client.query(
            `SELECT status, accounting_status
             FROM payroll_periods
             WHERE id = $1 AND tenant_id = $2
             LIMIT 1`,
            [id, tenant_id]
        );

        if (periodResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Período no encontrado' });
        }

        const period = periodResult.rows[0];
        if (!['preliquidado', 'aprobado', 'transmitido', 'pagado'].includes(period.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `El período debe estar preliquidado o aprobado para contabilizar. Estado actual: ${period.status}`
            });
        }

        const accounting = await accountPayrollPeriod(client, tenant_id, id, user_id);
        await client.query('COMMIT');

        return res.json({
            success: true,
            accounting,
            message: `Nómina contabilizada con asiento ${accounting.journalEntryNumber}`
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Nomina] Error contabilizando período:', error);
        await db.query(
            `UPDATE payroll_periods
             SET accounting_status = 'ERROR',
                 accounting_error = $1,
                 updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3`,
            [error.message, req.params.id, req.user?.tenant_id]
        ).catch(() => null);
        return res.status(500).json({ success: false, error: 'Error interno al contabilizar período', details: error.message });
    } finally {
        client.release();
    }
};

// =============================================
// LIQUIDACIONES
// =============================================

/**
 * Listar liquidaciones de un período con información de empleado.
 * GET /api/nomina/periodos/:id/liquidaciones
 */
exports.getLiquidations = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        const result = await db.query(
            `SELECT pl.*,
                    e.first_name, e.last_name, e.document_number, e.document_type,
                    e.position, e.department
             FROM payroll_liquidations pl
             JOIN employees e ON pl.employee_id = e.id
             WHERE pl.period_id = $1 AND pl.tenant_id = $2
             ORDER BY e.last_name ASC, e.first_name ASC`,
            [id, tenant_id]
        );

        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('[Nomina] Error obteniendo liquidaciones:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener liquidaciones' });
    }
};

/**
 * Generar liquidaciones para todos los empleados activos de un período.
 * POST /api/nomina/periodos/:id/liquidar
 */
exports.generateLiquidations = async (req, res) => {
    const client = await db.getClient();
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        await client.query('BEGIN');

        // Obtener período
        const periodResult = await client.query(
            `SELECT * FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        if (periodResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Período no encontrado' });
        }

        const period = periodResult.rows[0];

        if (period.status !== 'borrador' && period.status !== 'preliquidado') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Solo se pueden generar liquidaciones en períodos en borrador o preliquidados'
            });
        }

        // Eliminar liquidaciones anteriores del período
        await client.query(
            `DELETE FROM payroll_liquidations WHERE period_id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        // Obtener configuración del año
        const config = getPayrollConfig(period.year);

        // Obtener todos los empleados activos
        const employeesResult = await client.query(
            `SELECT e.*, ea.eps_code, ea.eps_name, ea.afp_code, ea.afp_name,
                    ea.arl_code, ea.arl_name, ea.ccf_code, ea.ccf_name
             FROM employees e
             LEFT JOIN employee_affiliations ea ON e.id = ea.employee_id
             WHERE e.tenant_id = $1 AND e.status = 'active'`,
            [tenant_id]
        );

        if (employeesResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'No hay empleados activos para liquidar' });
        }

        const liquidations = [];

        for (const employee of employeesResult.rows) {
            // Obtener novedades del empleado para este período
            const noveltiesResult = await client.query(
                `SELECT * FROM payroll_novelties
                 WHERE employee_id = $1 AND period_id = $2 AND tenant_id = $3
                   AND status = 'pendiente'`,
                [employee.id, id, tenant_id]
            );

            // Calcular liquidación usando el motor de nómina
            const liquidation = calculateLiquidation(employee, period, noveltiesResult.rows, config);
            const normalizedLiquidation = {
                salary_days: liquidation.period?.workedDays ?? 30,
                base_salary: liquidation.employee?.baseSalary ?? 0,
                worked_days: liquidation.period?.effectiveWorkedDays ?? liquidation.period?.workedDays ?? 30,
                salary_amount: liquidation.earnings?.proportionalSalary ?? 0,
                transport_allowance: liquidation.earnings?.transportAllowance ?? 0,
                overtime_day: liquidation.overtime?.HED?.value ?? 0,
                overtime_night: liquidation.overtime?.HEN?.value ?? 0,
                overtime_holiday_day: liquidation.overtime?.HEDD?.value ?? 0,
                overtime_holiday_night: liquidation.overtime?.HEDN?.value ?? 0,
                night_surcharge: liquidation.overtime?.RN?.value ?? 0,
                holiday_surcharge: liquidation.overtime?.RDD?.value ?? 0,
                holiday_night_surcharge: liquidation.overtime?.RDN?.value ?? 0,
                commissions: liquidation.earnings?.commissions ?? 0,
                bonuses: liquidation.earnings?.bonuses ?? 0,
                disability_pay: liquidation.earnings?.sickLeavePayment ?? 0,
                vacation_pay: 0,
                other_income: liquidation.earnings?.otherIncome ?? 0,
                total_devengado: liquidation.summary?.totalEarnings ?? 0,
                health_employee: liquidation.deductions?.salud ?? 0,
                pension_employee: liquidation.deductions?.pension ?? 0,
                solidarity_fund: liquidation.deductions?.fondoSolidaridad ?? 0,
                withholding_tax: liquidation.deductions?.withholdingTax ?? 0,
                other_deductions: liquidation.deductions?.otherDeductions ?? 0,
                loan_deductions: 0,
                total_deductions: liquidation.summary?.totalDeductions ?? 0,
                net_pay: liquidation.summary?.netPay ?? 0,
                health_employer: liquidation.employerContributions?.saludEmpleador ?? 0,
                pension_employer: liquidation.employerContributions?.pensionEmpleador ?? 0,
                arl_employer: liquidation.employerContributions?.arl ?? 0,
                sena_employer: liquidation.employerContributions?.sena ?? 0,
                icbf_employer: liquidation.employerContributions?.icbf ?? 0,
                ccf_employer: liquidation.employerContributions?.cajaCompensacion ?? 0,
                total_employer_cost: liquidation.summary?.totalEmployerCost ?? 0,
                prima_provision: liquidation.provisions?.prima ?? 0,
                cesantias_provision: liquidation.provisions?.cesantias ?? 0,
                intereses_cesantias_provision: liquidation.provisions?.interesesCesantias ?? 0,
                vacaciones_provision: liquidation.provisions?.vacaciones ?? 0,
                total_provisions: liquidation.provisions?.totalProvisions ?? 0,
                ibc_health: liquidation.ibc?.value ?? 0,
                ibc_pension: liquidation.ibc?.value ?? 0,
                ibc_arl: liquidation.ibc?.value ?? 0,
                ibc_ccf: liquidation.ibc?.value ?? 0
            };

            // Insertar liquidación construyendo columnas y valores desde una sola lista
            // para evitar desalineaciones entre el SQL y el arreglo de parámetros.
            const liquidationRow = {
                period_id: id,
                employee_id: employee.id,
                tenant_id,
                salary_days: normalizedLiquidation.salary_days,
                base_salary: normalizedLiquidation.base_salary,
                worked_days: normalizedLiquidation.worked_days,
                salary_amount: normalizedLiquidation.salary_amount,
                transport_allowance: normalizedLiquidation.transport_allowance,
                overtime_day: normalizedLiquidation.overtime_day,
                overtime_night: normalizedLiquidation.overtime_night,
                overtime_holiday_day: normalizedLiquidation.overtime_holiday_day,
                overtime_holiday_night: normalizedLiquidation.overtime_holiday_night,
                night_surcharge: normalizedLiquidation.night_surcharge,
                holiday_surcharge: normalizedLiquidation.holiday_surcharge,
                holiday_night_surcharge: normalizedLiquidation.holiday_night_surcharge,
                commissions: normalizedLiquidation.commissions,
                bonuses: normalizedLiquidation.bonuses,
                disability_pay: normalizedLiquidation.disability_pay,
                vacation_pay: normalizedLiquidation.vacation_pay,
                other_income: normalizedLiquidation.other_income,
                total_devengado: normalizedLiquidation.total_devengado,
                health_employee: normalizedLiquidation.health_employee,
                pension_employee: normalizedLiquidation.pension_employee,
                solidarity_fund: normalizedLiquidation.solidarity_fund,
                withholding_tax: normalizedLiquidation.withholding_tax,
                other_deductions: normalizedLiquidation.other_deductions,
                loan_deductions: normalizedLiquidation.loan_deductions,
                total_deductions: normalizedLiquidation.total_deductions,
                net_pay: normalizedLiquidation.net_pay,
                health_employer: normalizedLiquidation.health_employer,
                pension_employer: normalizedLiquidation.pension_employer,
                arl_employer: normalizedLiquidation.arl_employer,
                sena_employer: normalizedLiquidation.sena_employer,
                icbf_employer: normalizedLiquidation.icbf_employer,
                ccf_employer: normalizedLiquidation.ccf_employer,
                total_employer_cost: normalizedLiquidation.total_employer_cost,
                prima_provision: normalizedLiquidation.prima_provision,
                cesantias_provision: normalizedLiquidation.cesantias_provision,
                intereses_cesantias_provision: normalizedLiquidation.intereses_cesantias_provision,
                vacaciones_provision: normalizedLiquidation.vacaciones_provision,
                total_provisions: normalizedLiquidation.total_provisions,
                ibc_health: normalizedLiquidation.ibc_health,
                ibc_pension: normalizedLiquidation.ibc_pension,
                ibc_arl: normalizedLiquidation.ibc_arl,
                ibc_ccf: normalizedLiquidation.ibc_ccf,
                status: 'liquidado'
            };

            const liquidationColumns = Object.keys(liquidationRow);
            const liquidationValues = liquidationColumns.map((key) => liquidationRow[key]);
            const liquidationPlaceholders = liquidationColumns.map((_, index) => `$${index + 1}`).join(', ');

            const liqResult = await client.query(
                `INSERT INTO payroll_liquidations (${liquidationColumns.join(', ')})
                 VALUES (${liquidationPlaceholders})
                 RETURNING *`,
                liquidationValues
            );

            liquidations.push(liqResult.rows[0]);

            // Marcar novedades como aplicadas
            if (noveltiesResult.rows.length > 0) {
                await client.query(
                    `UPDATE payroll_novelties SET status = 'aplicada'
                     WHERE employee_id = $1 AND period_id = $2 AND tenant_id = $3 AND status = 'pendiente'`,
                    [employee.id, id, tenant_id]
                );
            }
        }

        // Actualizar período con totales y estado
        const totals = liquidations.reduce((acc, liq) => ({
            total_devengado: acc.total_devengado + Number(liq.total_devengado || 0),
            total_deducido: acc.total_deducido + Number(liq.total_deductions || 0),
            total_neto: acc.total_neto + Number(liq.net_pay || 0),
            total_costo_empresa: acc.total_costo_empresa + Number(liq.total_employer_cost || 0)
        }), { total_devengado: 0, total_deducido: 0, total_neto: 0, total_costo_empresa: 0 });

          await client.query(
              `UPDATE payroll_periods SET
                  status = 'preliquidado',
                  total_devengado = $1, total_deducido = $2, total_neto = $3,
                  total_costo_empresa = $4, employee_count = $5,
                  accounting_status = 'PENDIENTE',
                  accounting_journal_entry_id = NULL,
                  accounting_journal_number = NULL,
                  accounting_posted_at = NULL,
                  accounting_error = NULL,
                  updated_at = NOW()
               WHERE id = $6`,
              [
                  totals.total_devengado, totals.total_deducido,
                  totals.total_neto, totals.total_costo_empresa,
                liquidations.length, id
            ]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            data: {
                liquidations_count: liquidations.length,
                totals,
                liquidations
            },
            message: `Liquidaciones generadas para ${liquidations.length} empleados`
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Nomina] Error generando liquidaciones:', error);
        return res.status(500).json({ success: false, error: 'Error interno al generar liquidaciones' });
    } finally {
        client.release();
    }
};

/**
 * Vista previa de preliquidación sin guardar.
 * GET /api/nomina/periodos/:id/preliquidacion
 */
exports.getPreLiquidation = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        // Obtener período
        const periodResult = await db.query(
            `SELECT * FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        if (periodResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Período no encontrado' });
        }

        const period = periodResult.rows[0];
        const config = getPayrollConfig(period.year);

        // Obtener empleados activos con afiliaciones
        const employeesResult = await db.query(
            `SELECT e.*, ea.eps_code, ea.eps_name, ea.afp_code, ea.afp_name,
                    ea.arl_code, ea.arl_name, ea.ccf_code, ea.ccf_name
             FROM employees e
             LEFT JOIN employee_affiliations ea ON e.id = ea.employee_id
             WHERE e.tenant_id = $1 AND e.status = 'active'`,
            [tenant_id]
        );

        const previews = [];

        for (const employee of employeesResult.rows) {
            const noveltiesResult = await db.query(
                `SELECT * FROM payroll_novelties
                 WHERE employee_id = $1 AND period_id = $2 AND tenant_id = $3
                   AND status = 'pendiente'`,
                [employee.id, id, tenant_id]
            );

            const liquidation = calculateLiquidation(employee, period, noveltiesResult.rows, config);

            previews.push({
                employee_id: employee.id,
                employee_name: `${employee.first_name} ${employee.last_name}`,
                document_number: employee.document_number,
                position: employee.position,
                department: employee.department,
                novelties_count: noveltiesResult.rows.length,
                ...liquidation
            });
        }

        const totals = previews.reduce((acc, liq) => ({
            total_devengado: acc.total_devengado + Number(liq.total_devengado || 0),
            total_deductions: acc.total_deductions + Number(liq.total_deductions || 0),
            total_neto: acc.total_neto + Number(liq.net_pay || 0),
            total_employer_cost: acc.total_employer_cost + Number(liq.total_employer_cost || 0)
        }), { total_devengado: 0, total_deductions: 0, total_neto: 0, total_employer_cost: 0 });

        return res.json({
            success: true,
            data: {
                period,
                employee_count: previews.length,
                totals,
                previews
            }
        });
    } catch (error) {
        console.error('[Nomina] Error generando preliquidación:', error);
        return res.status(500).json({ success: false, error: 'Error interno al generar preliquidación' });
    }
};

/**
 * Ajuste manual de una liquidación.
 * PUT /api/nomina/liquidaciones/:id
 */
exports.updateLiquidation = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;
        const {
            overtime_day, overtime_night, overtime_holiday_day, overtime_holiday_night,
            night_surcharge, holiday_surcharge, holiday_night_surcharge,
            commissions, bonuses, disability_pay, vacation_pay, other_income,
            other_deductions, loan_deductions, notes
        } = req.body;

        // Verificar que la liquidación existe y el período está en estado editable
        const liqCheck = await db.query(
            `SELECT pl.*, pp.status as period_status
             FROM payroll_liquidations pl
             JOIN payroll_periods pp ON pl.period_id = pp.id
             WHERE pl.id = $1 AND pl.tenant_id = $2`,
            [id, tenant_id]
        );

        if (liqCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Liquidación no encontrada' });
        }

          if (liqCheck.rows[0].period_status === 'aprobado' || liqCheck.rows[0].period_status === 'pagado') {
              return res.status(400).json({
                  success: false,
                  error: 'No se puede modificar una liquidación de un período aprobado o pagado'
              });
          }

          if (liqCheck.rows[0].accounting_status === 'CONTABILIZADO') {
              return res.status(400).json({
                  success: false,
                  error: 'No se puede modificar una liquidación de un período contabilizado'
              });
          }

          const current = liqCheck.rows[0];

        // Recalcular totales con los nuevos valores
        const newOvertime = Number(overtime_day ?? current.overtime_day) +
            Number(overtime_night ?? current.overtime_night) +
            Number(overtime_holiday_day ?? current.overtime_holiday_day) +
            Number(overtime_holiday_night ?? current.overtime_holiday_night);

        const newSurcharges = Number(night_surcharge ?? current.night_surcharge) +
            Number(holiday_surcharge ?? current.holiday_surcharge) +
            Number(holiday_night_surcharge ?? current.holiday_night_surcharge);

        const newTotalDevengado = Number(current.salary_amount) +
            Number(current.transport_allowance) +
            newOvertime + newSurcharges +
            Number(commissions ?? current.commissions) +
            Number(bonuses ?? current.bonuses) +
            Number(disability_pay ?? current.disability_pay) +
            Number(vacation_pay ?? current.vacation_pay) +
            Number(other_income ?? current.other_income);

        const newTotalDeductions = Number(current.health_employee) +
            Number(current.pension_employee) +
            Number(current.solidarity_fund) +
            Number(current.withholding_tax) +
            Number(other_deductions ?? current.other_deductions) +
            Number(loan_deductions ?? current.loan_deductions);

        const newNetPay = newTotalDevengado - newTotalDeductions;

        const result = await db.query(
            `UPDATE payroll_liquidations SET
                overtime_day = COALESCE($1, overtime_day),
                overtime_night = COALESCE($2, overtime_night),
                overtime_holiday_day = COALESCE($3, overtime_holiday_day),
                overtime_holiday_night = COALESCE($4, overtime_holiday_night),
                night_surcharge = COALESCE($5, night_surcharge),
                holiday_surcharge = COALESCE($6, holiday_surcharge),
                holiday_night_surcharge = COALESCE($7, holiday_night_surcharge),
                commissions = COALESCE($8, commissions),
                bonuses = COALESCE($9, bonuses),
                disability_pay = COALESCE($10, disability_pay),
                vacation_pay = COALESCE($11, vacation_pay),
                other_income = COALESCE($12, other_income),
                other_deductions = COALESCE($13, other_deductions),
                loan_deductions = COALESCE($14, loan_deductions),
                total_devengado = $15,
                total_deductions = $16,
                net_pay = $17
             WHERE id = $18 AND tenant_id = $19
             RETURNING *`,
            [
                overtime_day, overtime_night, overtime_holiday_day, overtime_holiday_night,
                night_surcharge, holiday_surcharge, holiday_night_surcharge,
                commissions, bonuses, disability_pay, vacation_pay, other_income,
                other_deductions, loan_deductions,
                newTotalDevengado, newTotalDeductions, newNetPay,
                id, tenant_id
            ]
        );

        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[Nomina] Error actualizando liquidación:', error);
        return res.status(500).json({ success: false, error: 'Error interno al actualizar liquidación' });
    }
};

// =============================================
// NOVEDADES
// =============================================

/**
 * Listar novedades con filtros.
 * GET /api/nomina/novedades?employee_id=&period_id=&novelty_type=
 */
exports.getNovelties = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { employee_id, period_id, novelty_type, status, page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let whereClause = 'WHERE pn.tenant_id = $1';
        const params = [tenant_id];
        let paramIdx = 2;

        if (employee_id) {
            whereClause += ` AND pn.employee_id = $${paramIdx}`;
            params.push(employee_id);
            paramIdx++;
        }
        if (period_id) {
            whereClause += ` AND pn.period_id = $${paramIdx}`;
            params.push(period_id);
            paramIdx++;
        }
        if (novelty_type) {
            whereClause += ` AND pn.novelty_type = $${paramIdx}`;
            params.push(novelty_type);
            paramIdx++;
        }
        if (status) {
            whereClause += ` AND pn.status = $${paramIdx}`;
            params.push(status);
            paramIdx++;
        }

        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM payroll_novelties pn ${whereClause}`,
            params
        );

        const result = await db.query(
            `SELECT pn.*, e.first_name, e.last_name, e.document_number
             FROM payroll_novelties pn
             JOIN employees e ON pn.employee_id = e.id
             ${whereClause}
             ORDER BY pn.created_at DESC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            [...params, Number(limit), offset]
        );

        const total = parseInt(countResult.rows[0].total);

        return res.json({
            success: true,
            data: {
                novelties: result.rows,
                total,
                page: Number(page),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('[Nomina] Error obteniendo novedades:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener novedades' });
    }
};

/**
 * Crear nueva novedad.
 * POST /api/nomina/novedades
 */
exports.createNovelty = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const {
            employee_id, period_id, novelty_type, quantity, amount,
            start_date, end_date, description, eps_name, diagnosis
        } = req.body;

        if (!employee_id || !period_id || !novelty_type) {
            return res.status(400).json({
                success: false,
                error: 'Campos obligatorios: employee_id, period_id, novelty_type'
            });
        }

        // Verificar que el empleado existe
        const empCheck = await db.query(
            `SELECT id FROM employees WHERE id = $1 AND tenant_id = $2`,
            [employee_id, tenant_id]
        );
        if (empCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
        }

        // Verificar que el período existe y está editable
        const periodCheck = await db.query(
            `SELECT status FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
            [period_id, tenant_id]
        );
        if (periodCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Período no encontrado' });
        }
        if (periodCheck.rows[0].status === 'aprobado' || periodCheck.rows[0].status === 'pagado') {
            return res.status(400).json({
                success: false,
                error: 'No se pueden agregar novedades a un período aprobado o pagado'
            });
        }

        const result = await db.query(
            `INSERT INTO payroll_novelties (
                tenant_id, employee_id, period_id, novelty_type, quantity, amount,
                start_date, end_date, description, eps_name, diagnosis, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendiente')
            RETURNING *`,
            [
                tenant_id, employee_id, period_id, novelty_type,
                quantity || 0, amount || 0, start_date, end_date,
                description, eps_name, diagnosis
            ]
        );

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[Nomina] Error creando novedad:', error);
        return res.status(500).json({ success: false, error: 'Error interno al crear novedad' });
    }
};

/**
 * Actualizar novedad existente.
 * PUT /api/nomina/novedades/:id
 */
exports.updateNovelty = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;
        const {
            novelty_type, quantity, amount, start_date, end_date,
            description, eps_name, diagnosis, status
        } = req.body;

        const result = await db.query(
            `UPDATE payroll_novelties SET
                novelty_type = COALESCE($1, novelty_type),
                quantity = COALESCE($2, quantity),
                amount = COALESCE($3, amount),
                start_date = COALESCE($4, start_date),
                end_date = COALESCE($5, end_date),
                description = COALESCE($6, description),
                eps_name = COALESCE($7, eps_name),
                diagnosis = COALESCE($8, diagnosis),
                status = COALESCE($9, status)
             WHERE id = $10 AND tenant_id = $11
             RETURNING *`,
            [
                novelty_type, quantity, amount, start_date, end_date,
                description, eps_name, diagnosis, status,
                id, tenant_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Novedad no encontrada' });
        }

        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[Nomina] Error actualizando novedad:', error);
        return res.status(500).json({ success: false, error: 'Error interno al actualizar novedad' });
    }
};

/**
 * Eliminar novedad.
 * DELETE /api/nomina/novedades/:id
 */
exports.deleteNovelty = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        const result = await db.query(
            `DELETE FROM payroll_novelties WHERE id = $1 AND tenant_id = $2 AND status = 'pendiente'
             RETURNING id`,
            [id, tenant_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Novedad no encontrada o ya fue aplicada'
            });
        }

        return res.json({ success: true, message: 'Novedad eliminada correctamente' });
    } catch (error) {
        console.error('[Nomina] Error eliminando novedad:', error);
        return res.status(500).json({ success: false, error: 'Error interno al eliminar novedad' });
    }
};

// =============================================
// PILA
// =============================================

/**
 * Vista previa del cálculo de PILA para un período.
 * GET /api/nomina/periodos/:id/pila-preview
 */
exports.getPilaPreview = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        // Obtener liquidaciones del período
        const liquidationsResult = await db.query(
            `SELECT pl.* FROM payroll_liquidations pl
             WHERE pl.period_id = $1 AND pl.tenant_id = $2`,
            [id, tenant_id]
        );

        if (liquidationsResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No hay liquidaciones para este período. Genere las liquidaciones primero.'
            });
        }

        // Obtener empleados y afiliaciones
        const employeeIds = liquidationsResult.rows.map(l => l.employee_id);
        const employeesResult = await db.query(
            `SELECT * FROM employees WHERE id = ANY($1) AND tenant_id = $2`,
            [employeeIds, tenant_id]
        );

        const affiliationsResult = await db.query(
            `SELECT * FROM employee_affiliations WHERE employee_id = ANY($1) AND tenant_id = $2`,
            [employeeIds, tenant_id]
        );

        const periodResult = await db.query(
            `SELECT * FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        const config = getPayrollConfig(periodResult.rows[0].year);

        const pilaSummary = calculatePilaSummary(
            liquidationsResult.rows,
            employeesResult.rows,
            affiliationsResult.rows,
            config
        );

        return res.json({ success: true, data: pilaSummary });
    } catch (error) {
        console.error('[Nomina] Error generando vista previa PILA:', error);
        return res.status(500).json({ success: false, error: 'Error interno al generar vista previa PILA' });
    }
};

/**
 * Generar archivo plano PILA (stub - retorna JSON summary).
 * POST /api/nomina/periodos/:id/generar-pila
 */
exports.generatePilaFile = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        // Obtener datos necesarios
        const liquidationsResult = await db.query(
            `SELECT pl.* FROM payroll_liquidations pl
             WHERE pl.period_id = $1 AND pl.tenant_id = $2`,
            [id, tenant_id]
        );

        if (liquidationsResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No hay liquidaciones para este período'
            });
        }

        const employeeIds = liquidationsResult.rows.map(l => l.employee_id);
        const employeesResult = await db.query(
            `SELECT * FROM employees WHERE id = ANY($1) AND tenant_id = $2`,
            [employeeIds, tenant_id]
        );

        const affiliationsResult = await db.query(
            `SELECT * FROM employee_affiliations WHERE employee_id = ANY($1) AND tenant_id = $2`,
            [employeeIds, tenant_id]
        );

        const periodResult = await db.query(
            `SELECT * FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        // Obtener info del tenant/empresa
        const tenantResult = await db.query(
            `SELECT * FROM tenants WHERE id = $1`,
            [tenant_id]
        );

        const config = getPayrollConfig(periodResult.rows[0].year);

        const pilaSummary = calculatePilaSummary(
            liquidationsResult.rows,
            employeesResult.rows,
            affiliationsResult.rows,
            config
        );

        const flatFileContent = generatePilaFlatFile(pilaSummary, tenantResult.rows[0] || {});

        return res.json({
            success: true,
            data: {
                summary: pilaSummary,
                flat_file_content: flatFileContent,
                period: periodResult.rows[0],
                employee_count: employeesResult.rows.length
            },
            message: 'Archivo PILA generado correctamente'
        });
    } catch (error) {
        console.error('[Nomina] Error generando archivo PILA:', error);
        return res.status(500).json({ success: false, error: 'Error interno al generar archivo PILA' });
    }
};

// =============================================
// INCAPACIDADES
// =============================================

/**
 * Listar reclamaciones de incapacidad.
 * GET /api/nomina/incapacidades?employee_id=&status=
 */
exports.getDisabilityClaims = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { employee_id, status, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let whereClause = 'WHERE dc.tenant_id = $1';
        const params = [tenant_id];
        let paramIdx = 2;

        if (employee_id) {
            whereClause += ` AND dc.employee_id = $${paramIdx}`;
            params.push(employee_id);
            paramIdx++;
        }
        if (status) {
            whereClause += ` AND dc.status = $${paramIdx}`;
            params.push(status);
            paramIdx++;
        }

        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM disability_claims dc ${whereClause}`,
            params
        );

        const result = await db.query(
            `SELECT dc.*, e.first_name, e.last_name, e.document_number
             FROM disability_claims dc
             JOIN employees e ON dc.employee_id = e.id
             ${whereClause}
             ORDER BY dc.start_date DESC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            [...params, Number(limit), offset]
        );

        const total = parseInt(countResult.rows[0].total);

        return res.json({
            success: true,
            data: {
                claims: result.rows,
                total,
                page: Number(page),
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('[Nomina] Error obteniendo incapacidades:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener incapacidades' });
    }
};

/**
 * Crear reclamación de incapacidad.
 * POST /api/nomina/incapacidades
 */
exports.createDisabilityClaim = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const {
            employee_id, claim_type, entity_name, diagnosis,
            start_date, end_date, total_days, daily_rate, total_amount,
            amount_claimed, filing_date, filing_number, notes
        } = req.body;

        if (!employee_id || !claim_type || !start_date || !end_date) {
            return res.status(400).json({
                success: false,
                error: 'Campos obligatorios: employee_id, claim_type, start_date, end_date'
            });
        }

        // Verificar que el empleado existe
        const empCheck = await db.query(
            `SELECT id, base_salary FROM employees WHERE id = $1 AND tenant_id = $2`,
            [employee_id, tenant_id]
        );
        if (empCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
        }

        // Calcular días y valor diario si no se proporcionan
        const calculatedDays = total_days || Math.ceil(
            (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)
        ) + 1;
        const calculatedDailyRate = daily_rate || (Number(empCheck.rows[0].base_salary) / 30);
        const calculatedTotalAmount = total_amount || (calculatedDays * calculatedDailyRate);

        const result = await db.query(
            `INSERT INTO disability_claims (
                tenant_id, employee_id, claim_type, entity_name, diagnosis,
                start_date, end_date, total_days, daily_rate, total_amount,
                amount_claimed, amount_recovered, status, filing_date, filing_number, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 'pendiente', $12, $13, $14)
            RETURNING *`,
            [
                tenant_id, employee_id, claim_type, entity_name, diagnosis,
                start_date, end_date, calculatedDays, calculatedDailyRate,
                calculatedTotalAmount, amount_claimed || calculatedTotalAmount,
                filing_date, filing_number, notes
            ]
        );

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[Nomina] Error creando incapacidad:', error);
        return res.status(500).json({ success: false, error: 'Error interno al crear incapacidad' });
    }
};

/**
 * Actualizar reclamación de incapacidad.
 * PUT /api/nomina/incapacidades/:id
 */
exports.updateDisabilityClaim = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;
        const {
            claim_type, entity_name, diagnosis, start_date, end_date,
            total_days, daily_rate, total_amount, amount_claimed,
            amount_recovered, status, filing_date, filing_number, notes
        } = req.body;

        const result = await db.query(
            `UPDATE disability_claims SET
                claim_type = COALESCE($1, claim_type),
                entity_name = COALESCE($2, entity_name),
                diagnosis = COALESCE($3, diagnosis),
                start_date = COALESCE($4, start_date),
                end_date = COALESCE($5, end_date),
                total_days = COALESCE($6, total_days),
                daily_rate = COALESCE($7, daily_rate),
                total_amount = COALESCE($8, total_amount),
                amount_claimed = COALESCE($9, amount_claimed),
                amount_recovered = COALESCE($10, amount_recovered),
                status = COALESCE($11, status),
                filing_date = COALESCE($12, filing_date),
                filing_number = COALESCE($13, filing_number),
                notes = COALESCE($14, notes)
             WHERE id = $15 AND tenant_id = $16
             RETURNING *`,
            [
                claim_type, entity_name, diagnosis, start_date, end_date,
                total_days, daily_rate, total_amount, amount_claimed,
                amount_recovered, status, filing_date, filing_number, notes,
                id, tenant_id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Incapacidad no encontrada' });
        }

        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[Nomina] Error actualizando incapacidad:', error);
        return res.status(500).json({ success: false, error: 'Error interno al actualizar incapacidad' });
    }
};

// =============================================
// ENTIDADES DE SEGURIDAD SOCIAL
// =============================================

/**
 * Listar entidades de seguridad social.
 * GET /api/nomina/entidades?entity_type=EPS
 */
exports.getSocialSecurityEntities = async (req, res) => {
    try {
        const { entity_type } = req.query;

        let whereClause = 'WHERE is_active = true';
        const params = [];
        let paramIdx = 1;

        if (entity_type) {
            whereClause += ` AND entity_type = $${paramIdx}`;
            params.push(entity_type.toUpperCase());
            paramIdx++;
        }

        const result = await db.query(
            `SELECT * FROM social_security_entities ${whereClause} ORDER BY entity_type, name`,
            params
        );

        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('[Nomina] Error obteniendo entidades:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener entidades' });
    }
};

// =============================================
// DASHBOARD
// =============================================

/**
 * Resumen del dashboard de nómina.
 * GET /api/nomina/dashboard/resumen
 */
exports.getDashboardSummary = async (req, res) => {
    try {
        const { tenant_id } = req.user;

        // Empleados activos
        const activeEmployeesResult = await db.query(
            `SELECT COUNT(*) as total FROM employees WHERE tenant_id = $1 AND status = 'active'`,
            [tenant_id]
        );

        // Total nómina del mes actual
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        const monthlyPayrollResult = await db.query(
            `SELECT
                COALESCE(SUM(total_neto), 0) as total_neto,
                COALESCE(SUM(total_costo_empresa), 0) as total_costo_empresa
             FROM payroll_periods
             WHERE tenant_id = $1 AND year = $2 AND month = $3`,
            [tenant_id, currentYear, currentMonth]
        );

        // Novedades pendientes
        const pendingNoveltiesResult = await db.query(
            `SELECT COUNT(*) as total FROM payroll_novelties
             WHERE tenant_id = $1 AND status = 'pendiente'`,
            [tenant_id]
        );

        // Último período
        const lastPeriodResult = await db.query(
            `SELECT id, year, month, period_number, status, total_neto, employee_count
             FROM payroll_periods
             WHERE tenant_id = $1
             ORDER BY year DESC, month DESC, period_number DESC
             LIMIT 1`,
            [tenant_id]
        );

        // Incapacidades pendientes
        const pendingDisabilitiesResult = await db.query(
            `SELECT COUNT(*) as total FROM disability_claims
             WHERE tenant_id = $1 AND status IN ('pendiente', 'radicada')`,
            [tenant_id]
        );

        return res.json({
            success: true,
            data: {
                activeEmployees: parseInt(activeEmployeesResult.rows[0].total),
                totalPayrollMonth: Number(monthlyPayrollResult.rows[0].total_neto),
                totalEmployerCost: Number(monthlyPayrollResult.rows[0].total_costo_empresa),
                pendingNovelties: parseInt(pendingNoveltiesResult.rows[0].total),
                pendingDisabilities: parseInt(pendingDisabilitiesResult.rows[0].total),
                lastPeriodStatus: lastPeriodResult.rows[0] || null
            }
        });
    } catch (error) {
        console.error('[Nomina] Error obteniendo dashboard:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener dashboard' });
    }
};

/**
 * Datos de gráficas para dashboard (últimos 12 meses).
 * GET /api/nomina/dashboard/graficas
 */
exports.getDashboardChartData = async (req, res) => {
    try {
        const { tenant_id } = req.user;

        const monthlyResult = await db.query(
            `SELECT
                year, month,
                TO_CHAR(TO_DATE(year || '-' || month || '-01', 'YYYY-MM-DD'), 'Mon YYYY') as label,
                COALESCE(SUM(total_devengado), 0) as total_devengado,
                COALESCE(SUM(total_deducido), 0) as total_deducido,
                COALESCE(SUM(total_neto), 0) as total_neto,
                COALESCE(SUM(total_costo_empresa), 0) as total_costo_empresa,
                COALESCE(SUM(employee_count), 0) as employee_count
             FROM payroll_periods
             WHERE tenant_id = $1
               AND TO_DATE(year || '-' || month || '-01', 'YYYY-MM-DD') >= (CURRENT_DATE - INTERVAL '12 months')
             GROUP BY year, month
             ORDER BY year ASC, month ASC`,
            [tenant_id]
        );

        // Distribución por departamento
        const departmentResult = await db.query(
            `SELECT
                e.department,
                COUNT(*) as employee_count,
                COALESCE(SUM(e.base_salary), 0) as total_salary
             FROM employees e
             WHERE e.tenant_id = $1 AND e.status = 'active' AND e.department IS NOT NULL
             GROUP BY e.department
             ORDER BY total_salary DESC
             LIMIT 10`,
            [tenant_id]
        );

        return res.json({
            success: true,
            data: {
                monthly: monthlyResult.rows,
                departments: departmentResult.rows
            }
        });
    } catch (error) {
        console.error('[Nomina] Error obteniendo datos de gráficas:', error);
        return res.status(500).json({ success: false, error: 'Error interno al obtener datos de gráficas' });
    }
};

// =============================================
// REPORTES
// =============================================

/**
 * Reporte detallado de un período de nómina.
 * GET /api/nomina/reportes/periodo/:id
 */
exports.getPayrollPeriodReport = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { id } = req.params;

        const periodResult = await db.query(
            `SELECT * FROM payroll_periods WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );

        if (periodResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Período no encontrado' });
        }

        const liquidationsResult = await db.query(
            `SELECT pl.*,
                    e.first_name, e.last_name, e.document_type, e.document_number,
                    e.position, e.department, e.bank_name, e.bank_account_type,
                    e.bank_account_number
             FROM payroll_liquidations pl
             JOIN employees e ON pl.employee_id = e.id
             WHERE pl.period_id = $1 AND pl.tenant_id = $2
             ORDER BY e.department, e.last_name`,
            [id, tenant_id]
        );

        // Agrupar por departamento
        const byDepartment = {};
        liquidationsResult.rows.forEach(liq => {
            const dept = liq.department || 'Sin departamento';
            if (!byDepartment[dept]) {
                byDepartment[dept] = { employees: [], totals: { devengado: 0, deducido: 0, neto: 0 } };
            }
            byDepartment[dept].employees.push(liq);
            byDepartment[dept].totals.devengado += Number(liq.total_devengado || 0);
            byDepartment[dept].totals.deducido += Number(liq.total_deductions || 0);
            byDepartment[dept].totals.neto += Number(liq.net_pay || 0);
        });

        const grandTotals = liquidationsResult.rows.reduce((acc, liq) => ({
            total_devengado: acc.total_devengado + Number(liq.total_devengado || 0),
            total_deductions: acc.total_deductions + Number(liq.total_deductions || 0),
            total_net_pay: acc.total_net_pay + Number(liq.net_pay || 0),
            total_employer_cost: acc.total_employer_cost + Number(liq.total_employer_cost || 0),
            total_provisions: acc.total_provisions + Number(liq.total_provisions || 0)
        }), { total_devengado: 0, total_deductions: 0, total_net_pay: 0, total_employer_cost: 0, total_provisions: 0 });

        return res.json({
            success: true,
            data: {
                period: periodResult.rows[0],
                employee_count: liquidationsResult.rows.length,
                grand_totals: grandTotals,
                by_department: byDepartment,
                liquidations: liquidationsResult.rows
            }
        });
    } catch (error) {
        console.error('[Nomina] Error generando reporte de período:', error);
        return res.status(500).json({ success: false, error: 'Error interno al generar reporte' });
    }
};

/**
 * Consolidado anual por empleado.
 * GET /api/nomina/reportes/consolidado-anual?year=2026
 */
exports.getAnnualConsolidated = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { year } = req.query;

        if (!year) {
            return res.status(400).json({ success: false, error: 'Se requiere el parámetro year' });
        }

        const result = await db.query(
            `SELECT
                e.id as employee_id, e.first_name, e.last_name,
                e.document_type, e.document_number, e.position, e.department,
                COUNT(pl.id) as periods_count,
                COALESCE(SUM(pl.salary_amount), 0) as total_salary,
                COALESCE(SUM(pl.transport_allowance), 0) as total_transport,
                COALESCE(SUM(pl.overtime_day + pl.overtime_night + pl.overtime_holiday_day + pl.overtime_holiday_night), 0) as total_overtime,
                COALESCE(SUM(pl.commissions), 0) as total_commissions,
                COALESCE(SUM(pl.bonuses), 0) as total_bonuses,
                COALESCE(SUM(pl.total_devengado), 0) as total_devengado,
                COALESCE(SUM(pl.health_employee), 0) as total_health_employee,
                COALESCE(SUM(pl.pension_employee), 0) as total_pension_employee,
                COALESCE(SUM(pl.solidarity_fund), 0) as total_solidarity_fund,
                COALESCE(SUM(pl.withholding_tax), 0) as total_withholding_tax,
                COALESCE(SUM(pl.total_deductions), 0) as total_deductions,
                COALESCE(SUM(pl.net_pay), 0) as total_net_pay,
                COALESCE(SUM(pl.total_employer_cost), 0) as total_employer_cost,
                COALESCE(SUM(pl.total_provisions), 0) as total_provisions
             FROM employees e
             JOIN payroll_liquidations pl ON e.id = pl.employee_id
             JOIN payroll_periods pp ON pl.period_id = pp.id
             WHERE e.tenant_id = $1 AND pp.year = $2
             GROUP BY e.id, e.first_name, e.last_name, e.document_type,
                      e.document_number, e.position, e.department
             ORDER BY e.last_name, e.first_name`,
            [tenant_id, Number(year)]
        );

        const grandTotals = result.rows.reduce((acc, row) => ({
            total_devengado: acc.total_devengado + Number(row.total_devengado),
            total_deductions: acc.total_deductions + Number(row.total_deductions),
            total_net_pay: acc.total_net_pay + Number(row.total_net_pay),
            total_employer_cost: acc.total_employer_cost + Number(row.total_employer_cost)
        }), { total_devengado: 0, total_deductions: 0, total_net_pay: 0, total_employer_cost: 0 });

        return res.json({
            success: true,
            data: {
                year: Number(year),
                employee_count: result.rows.length,
                grand_totals: grandTotals,
                employees: result.rows
            }
        });
    } catch (error) {
        console.error('[Nomina] Error generando consolidado anual:', error);
        return res.status(500).json({ success: false, error: 'Error interno al generar consolidado anual' });
    }
};

/**
 * Certificado de ingresos y retenciones de un empleado.
 * GET /api/nomina/reportes/certificado-ingresos?employee_id=&year=
 */
exports.getIncomeCertificate = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { employee_id, year } = req.query;

        if (!employee_id || !year) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren los parámetros employee_id y year'
            });
        }

        // Datos del empleado
        const empResult = await db.query(
            `SELECT e.*, ea.eps_name, ea.afp_name
             FROM employees e
             LEFT JOIN employee_affiliations ea ON e.id = ea.employee_id
             WHERE e.id = $1 AND e.tenant_id = $2`,
            [employee_id, tenant_id]
        );

        if (empResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
        }

        // Consolidado del año
        const consolidatedResult = await db.query(
            `SELECT
                COALESCE(SUM(pl.salary_amount), 0) as total_salary,
                COALESCE(SUM(pl.transport_allowance), 0) as total_transport,
                COALESCE(SUM(pl.commissions + pl.bonuses), 0) as total_other_income,
                COALESCE(SUM(pl.total_devengado), 0) as total_devengado,
                COALESCE(SUM(pl.health_employee), 0) as total_health,
                COALESCE(SUM(pl.pension_employee), 0) as total_pension,
                COALESCE(SUM(pl.solidarity_fund), 0) as total_solidarity,
                COALESCE(SUM(pl.withholding_tax), 0) as total_withholding,
                COALESCE(SUM(pl.total_deductions), 0) as total_deductions,
                COALESCE(SUM(pl.net_pay), 0) as total_net_pay,
                COUNT(pl.id) as periods_count
             FROM payroll_liquidations pl
             JOIN payroll_periods pp ON pl.period_id = pp.id
             WHERE pl.employee_id = $1 AND pl.tenant_id = $2 AND pp.year = $3`,
            [employee_id, tenant_id, Number(year)]
        );

        const employee = empResult.rows[0];
        const consolidated = consolidatedResult.rows[0];

        return res.json({
            success: true,
            data: {
                certificate_year: Number(year),
                employee: {
                    id: employee.id,
                    first_name: employee.first_name,
                    last_name: employee.last_name,
                    document_type: employee.document_type,
                    document_number: employee.document_number,
                    position: employee.position,
                    department: employee.department,
                    eps_name: employee.eps_name,
                    afp_name: employee.afp_name
                },
                income: {
                    salary: Number(consolidated.total_salary),
                    transport_allowance: Number(consolidated.total_transport),
                    other_income: Number(consolidated.total_other_income),
                    total_income: Number(consolidated.total_devengado)
                },
                deductions: {
                    health: Number(consolidated.total_health),
                    pension: Number(consolidated.total_pension),
                    solidarity_fund: Number(consolidated.total_solidarity),
                    withholding_tax: Number(consolidated.total_withholding),
                    total_deductions: Number(consolidated.total_deductions)
                },
                net_pay: Number(consolidated.total_net_pay),
                periods_count: parseInt(consolidated.periods_count)
            }
        });
    } catch (error) {
        console.error('[Nomina] Error generando certificado de ingresos:', error);
        return res.status(500).json({ success: false, error: 'Error interno al generar certificado' });
    }
};

/**
 * Reporte de provisiones.
 * GET /api/nomina/reportes/provisiones?year=&month=
 */
exports.getProvisionsReport = async (req, res) => {
    try {
        const { tenant_id } = req.user;
        const { year, month } = req.query;

        let whereClause = 'WHERE pp.tenant_id = $1';
        const params = [tenant_id];
        let paramIdx = 2;

        if (year) {
            whereClause += ` AND pp.year = $${paramIdx}`;
            params.push(Number(year));
            paramIdx++;
        }
        if (month) {
            whereClause += ` AND pp.month = $${paramIdx}`;
            params.push(Number(month));
            paramIdx++;
        }

        const result = await db.query(
            `SELECT
                e.id as employee_id, e.first_name, e.last_name,
                e.document_number, e.position, e.department,
                COALESCE(SUM(pl.prima_provision), 0) as prima_provision,
                COALESCE(SUM(pl.cesantias_provision), 0) as cesantias_provision,
                COALESCE(SUM(pl.intereses_cesantias_provision), 0) as intereses_cesantias_provision,
                COALESCE(SUM(pl.vacaciones_provision), 0) as vacaciones_provision,
                COALESCE(SUM(pl.total_provisions), 0) as total_provisions
             FROM payroll_liquidations pl
             JOIN employees e ON pl.employee_id = e.id
             JOIN payroll_periods pp ON pl.period_id = pp.id
             ${whereClause}
             GROUP BY e.id, e.first_name, e.last_name, e.document_number,
                      e.position, e.department
             ORDER BY e.last_name, e.first_name`,
            params
        );

        const totals = result.rows.reduce((acc, row) => ({
            prima: acc.prima + Number(row.prima_provision),
            cesantias: acc.cesantias + Number(row.cesantias_provision),
            intereses_cesantias: acc.intereses_cesantias + Number(row.intereses_cesantias_provision),
            vacaciones: acc.vacaciones + Number(row.vacaciones_provision),
            total: acc.total + Number(row.total_provisions)
        }), { prima: 0, cesantias: 0, intereses_cesantias: 0, vacaciones: 0, total: 0 });

        return res.json({
            success: true,
            data: {
                filters: { year: year ? Number(year) : null, month: month ? Number(month) : null },
                employee_count: result.rows.length,
                totals,
                employees: result.rows
            }
        });
    } catch (error) {
        console.error('[Nomina] Error generando reporte de provisiones:', error);
        return res.status(500).json({ success: false, error: 'Error interno al generar reporte de provisiones' });
    }
};
