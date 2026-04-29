const {
    listPendingMappingsData,
    listAllMappingsData,
    approveMappingEntry,
    rejectMappingEntry
} = require('../services/accountingMappingsService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

const getPendingMappings = async (req, res) => {
    try {
        const mappings = await listPendingMappingsData(resolveTenantId(req));
        res.json({ success: true, mappings, count: mappings.length });
    } catch (error) {
        console.error('[Accounting] Error obteniendo mappings pendientes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAllMappings = async (req, res) => {
    try {
        const mappings = await listAllMappingsData(resolveTenantId(req));
        res.json({ success: true, mappings, count: mappings.length });
    } catch (error) {
        console.error('[Accounting] Error obteniendo mappings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const approveMapping = async (req, res) => {
    try {
        const mapping = await approveMappingEntry({
            id: req.params.id,
            tenantId: req.user?.tenant_id,
            userId: req.user?.id
        });

        if (!mapping) {
            return res.status(404).json({ success: false, error: 'Mapping no encontrado' });
        }

        res.json({ success: true, mapping, message: 'Mapping aprobado' });
    } catch (error) {
        console.error('[Accounting] Error aprobando mapping:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const rejectMapping = async (req, res) => {
    try {
        const { accountCode, accountName } = req.body;

        if (!accountCode) {
            return res.status(400).json({ success: false, error: 'Debe proporcionar el código de cuenta correcto' });
        }

        const mapping = await rejectMappingEntry({
            id: req.params.id,
            tenantId: req.user?.tenant_id,
            userId: req.user?.id,
            accountCode,
            accountName
        });

        if (!mapping) {
            return res.status(404).json({ success: false, error: 'Mapping no encontrado' });
        }

        res.json({ success: true, mapping, message: 'Mapping corregido y aprobado' });
    } catch (error) {
        console.error('[Accounting] Error rechazando mapping:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getPendingMappings,
    getAllMappings,
    approveMapping,
    rejectMapping
};
