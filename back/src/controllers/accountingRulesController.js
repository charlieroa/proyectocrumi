const {
    listClassificationRulesData,
    createClassificationRuleEntry,
    updateClassificationRuleEntry,
    deactivateClassificationRuleEntry,
    seedClassificationRules
} = require('../services/accountingRulesService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

const getClassificationRules = async (req, res) => {
    try {
        const rules = await listClassificationRulesData(resolveTenantId(req));
        res.json({ success: true, rules, count: rules.length });
    } catch (error) {
        console.error('[Accounting] Error obteniendo reglas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createClassificationRule = async (req, res) => {
    try {
        const { keywords, accountCode, accountName, category, priority } = req.body;

        if (!keywords || !accountCode) {
            return res.status(400).json({ success: false, error: 'Keywords y código de cuenta son obligatorios' });
        }

        const rule = await createClassificationRuleEntry({
            tenantId: req.user?.tenant_id,
            keywords,
            accountCode,
            accountName,
            category,
            priority
        });

        res.status(201).json({ success: true, rule });
    } catch (error) {
        console.error('[Accounting] Error creando regla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const updateClassificationRule = async (req, res) => {
    try {
        const rule = await updateClassificationRuleEntry({
            id: req.params.id,
            tenantId: req.user?.tenant_id,
            keywords: req.body?.keywords,
            accountCode: req.body?.accountCode,
            accountName: req.body?.accountName,
            category: req.body?.category,
            priority: req.body?.priority,
            isActive: req.body?.isActive
        });

        if (!rule) {
            return res.status(404).json({ success: false, error: 'Regla no encontrada' });
        }

        res.json({ success: true, rule });
    } catch (error) {
        console.error('[Accounting] Error actualizando regla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteClassificationRule = async (req, res) => {
    try {
        const rule = await deactivateClassificationRuleEntry({
            id: req.params.id,
            tenantId: req.user?.tenant_id
        });

        if (!rule) {
            return res.status(404).json({ success: false, error: 'Regla no encontrada' });
        }

        res.json({ success: true, message: 'Regla desactivada' });
    } catch (error) {
        console.error('[Accounting] Error desactivando regla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const seedRules = async (req, res) => {
    try {
        const count = await seedClassificationRules(req.user?.tenant_id);
        res.json({ success: true, message: `${count} reglas seedeadas`, count });
    } catch (error) {
        console.error('[Accounting] Error seedeando reglas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getClassificationRules,
    createClassificationRule,
    updateClassificationRule,
    deleteClassificationRule,
    seedRules
};
