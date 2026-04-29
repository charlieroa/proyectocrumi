// src/controllers/providerConnectionsController.js
// Controlador para el modulo de Conexiones Externas

const providerConnectionsQueryService = require('../services/providerConnectionsQueryService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

const getDashboard = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'tenant_id requerido' });

        const data = await providerConnectionsQueryService.getDashboard(tenantId);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error en getDashboard (connections):', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getConnections = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'tenant_id requerido' });

        const connections = await providerConnectionsQueryService.getConnections(tenantId);
        res.json({ success: true, data: connections });
    } catch (error) {
        console.error('Error en getConnections:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getConnectionById = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'tenant_id requerido' });

        const { id } = req.params;
        const connection = await providerConnectionsQueryService.getConnectionById(tenantId, id);
        if (!connection) return res.status(404).json({ success: false, error: 'Conexion no encontrada' });

        res.json({ success: true, data: connection });
    } catch (error) {
        console.error('Error en getConnectionById:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getSyncHistory = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'tenant_id requerido' });

        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const history = await providerConnectionsQueryService.getSyncHistory(tenantId, id, limit);
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Error en getSyncHistory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getSyncLogs = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'tenant_id requerido' });

        const limit = parseInt(req.query.limit) || 100;
        const logs = await providerConnectionsQueryService.getSyncLogs(tenantId, limit);
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Error en getSyncLogs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const testConnection = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'tenant_id requerido' });

        const { id } = req.params;
        const connection = await providerConnectionsQueryService.getConnectionById(tenantId, id);
        if (!connection) return res.status(404).json({ success: false, error: 'Conexion no encontrada' });

        // Health check basico: si la conexion existe y esta activa, responde OK
        const status = connection.status === 'ACTIVE' ? 'ok' : 'error';
        res.json({
            success: true,
            data: {
                connectionId: connection.id,
                providerName: connection.provider_name,
                status,
                message: status === 'ok' ? 'Conexion activa y respondiendo' : 'Conexion inactiva o con errores',
                testedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error en testConnection:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteConnection = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'tenant_id requerido' });

        const { id } = req.params;
        const connection = await providerConnectionsQueryService.getConnectionById(tenantId, id);
        if (!connection) return res.status(404).json({ success: false, error: 'Conexion no encontrada' });

        const db = require('../config/db');
        await db.query('DELETE FROM provider_connections WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        res.json({ success: true, message: 'Conexion eliminada correctamente' });
    } catch (error) {
        console.error('Error en deleteConnection:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getDashboard,
    getConnections,
    getConnectionById,
    getSyncHistory,
    getSyncLogs,
    testConnection,
    deleteConnection
};
