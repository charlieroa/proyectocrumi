const quoteService = require('../services/quoteService');

const resolveTenantId = (req) => req.user?.tenant_id || req.headers['x-tenant-id'] || null;

const getQuotes = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const quotes = await quoteService.getQuotes(tenantId, req.query);
        const dashboard = await quoteService.getDashboard(tenantId);
        res.json({ success: true, quotes, dashboard });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const getQuoteById = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const quote = await quoteService.getQuoteById(tenantId, req.params.id);
        if (!quote) return res.status(404).json({ success: false, error: 'No encontrada' });
        res.json({ success: true, quote });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const updateQuote = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const quote = await quoteService.updateQuote(tenantId, req.params.id, req.body);
        if (!quote) return res.status(404).json({ success: false, error: 'No encontrada' });
        res.json({ success: true, quote });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const deleteQuote = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        await quoteService.deleteQuote(tenantId, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const updateQuoteStatus = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const quote = await quoteService.updateQuoteStatus(tenantId, req.params.id, req.body.status);
        res.json({ success: true, quote });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

const convertToInvoice = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const invoice = await quoteService.convertToInvoice(tenantId, req.params.id, userId);
        res.json({ success: true, invoice });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = { getQuotes, getQuoteById, updateQuote, deleteQuote, updateQuoteStatus, convertToInvoice };
