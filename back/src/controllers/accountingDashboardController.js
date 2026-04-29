const {
    getDashboardSummaryData,
    getDashboardChartData
} = require('../services/accountingDashboardService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

const getDashboardSummary = async (req, res) => {
    try {
        const summary = await getDashboardSummaryData(resolveTenantId(req));
        res.json({ success: true, summary });
    } catch (error) {
        console.error('[Accounting] Error obteniendo dashboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getChartData = async (req, res) => {
    try {
        const chartData = await getDashboardChartData(resolveTenantId(req));
        res.json({ success: true, chartData });
    } catch (error) {
        console.error('[Accounting] Error obteniendo datos de gráficas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getDashboardSummary,
    getChartData
};
