const {
    getAccountsReceivableReportData,
    getThirdPartyLedgerData
} = require('../services/receivablesQueryService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query?.tenantId || req.body?.tenantId;

const getAccountsReceivableReport = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await getAccountsReceivableReportData(tenantId, req.query);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[Receivables] Error obteniendo cartera:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getThirdPartyLedger = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await getThirdPartyLedgerData(tenantId, req.query);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[Receivables] Error obteniendo auxiliar por tercero:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getAccountsReceivableReport,
    getThirdPartyLedger,
};
