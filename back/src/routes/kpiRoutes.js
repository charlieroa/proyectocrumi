const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/kpis/platform - KPIs globales de la plataforma (solo superadmin)
router.get('/platform', authMiddleware, async (req, res) => {
    try {
        if (req.user.role_id !== 99) {
            return res.status(403).json({ error: 'Solo superadmin' });
        }

        // Ejecutar todas las queries en paralelo
        const [
            tenantCount,
            userCount,
            invoiceCount,
            invoiceTotal,
            quoteCount,
            creditNoteCount,
            debitNoteCount,
            remissionCount,
            paymentReceiptCount,
            payableCount,
            voucherCount,
            employeeCount,
            periodCount,
            thirdPartyCount,
            recentInvoices,
            tenantActivity,
        ] = await Promise.all([
            db.query('SELECT COUNT(*) as total FROM tenants'),
            db.query('SELECT COUNT(*) as total FROM users'),
            db.query('SELECT COUNT(*) as total, COALESCE(SUM(total::numeric), 0) as revenue FROM invoices'),
            db.query('SELECT COUNT(*) as total FROM invoices WHERE created_at >= NOW() - INTERVAL \'30 days\''),
            db.query('SELECT COUNT(*) as total FROM quotes'),
            db.query('SELECT COUNT(*) as total FROM credit_notes'),
            db.query('SELECT COUNT(*) as total FROM debit_notes'),
            db.query('SELECT COUNT(*) as total FROM remissions'),
            db.query('SELECT COUNT(*) as total FROM payment_receipts'),
            db.query('SELECT COUNT(*) as total FROM accounts_payable'),
            db.query('SELECT COUNT(*) as total FROM manual_vouchers'),
            db.query('SELECT COUNT(*) as total FROM employees'),
            db.query('SELECT COUNT(*) as total FROM payroll_periods'),
            db.query('SELECT COUNT(*) as total FROM third_parties'),
            db.query(`SELECT i.id, i.invoice_number, i.client_name, i.total, i.created_at, t.business_name as tenant_name
                      FROM invoices i LEFT JOIN tenants t ON i.tenant_id = t.id
                      ORDER BY i.created_at DESC LIMIT 10`),
            db.query(`SELECT t.id, t.business_name, t.created_at,
                        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count,
                        (SELECT COUNT(*) FROM invoices inv WHERE inv.tenant_id = t.id) as invoice_count,
                        (SELECT COALESCE(SUM(total::numeric), 0) FROM invoices inv WHERE inv.tenant_id = t.id) as total_revenue
                      FROM tenants t ORDER BY t.created_at DESC LIMIT 20`),
        ]);

        res.json({
            overview: {
                tenants: Number(tenantCount.rows[0].total),
                users: Number(userCount.rows[0].total),
                thirdParties: Number(thirdPartyCount.rows[0].total),
                employees: Number(employeeCount.rows[0].total),
            },
            documents: {
                invoices: Number(invoiceCount.rows[0].total),
                invoicesLast30Days: Number(invoiceTotal.rows[0].total),
                totalRevenue: Number(invoiceCount.rows[0].revenue),
                quotes: Number(quoteCount.rows[0].total),
                creditNotes: Number(creditNoteCount.rows[0].total),
                debitNotes: Number(debitNoteCount.rows[0].total),
                remissions: Number(remissionCount.rows[0].total),
                paymentReceipts: Number(paymentReceiptCount.rows[0].total),
                accountsPayable: Number(payableCount.rows[0].total),
                manualVouchers: Number(voucherCount.rows[0].total),
            },
            payroll: {
                employees: Number(employeeCount.rows[0].total),
                periods: Number(periodCount.rows[0].total),
            },
            recentInvoices: recentInvoices.rows,
            tenantActivity: tenantActivity.rows,
        });
    } catch (error) {
        console.error('Error KPIs:', error.message);
        res.status(500).json({ error: 'Error obteniendo KPIs' });
    }
});

module.exports = router;
