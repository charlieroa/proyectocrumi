const db = require('../config/db');

// Get all columns for the current tenant
exports.getColumns = async (req, res) => {
    const { tenant_id } = req.user;
    try {
        // Ensure default columns exist if none returned?
        // For now, just return what's in DB. Frontend can handle defaults or backend can auto-create.
        // Let's force consistent order.
        const query = `SELECT * FROM kanban_columns WHERE tenant_id = $1 ORDER BY display_order ASC;`;
        const { rows } = await db.query(query, [tenant_id]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching columns:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create a new column
exports.createColumn = async (req, res) => {
    const { tenant_id } = req.user;
    const { title, status_key, display_order } = req.body;

    try {
        const query = `
            INSERT INTO kanban_columns (tenant_id, title, status_key, display_order)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const { rows } = await db.query(query, [tenant_id, title, status_key, display_order || 0]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating column:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update a column
exports.updateColumn = async (req, res) => {
    const { id } = req.params;
    const { tenant_id } = req.user;
    const { title, status_key, display_order } = req.body;

    try {
        const query = `
            UPDATE kanban_columns
            SET title = COALESCE($1, title),
                status_key = COALESCE($2, status_key),
                display_order = COALESCE($3, display_order),
                updated_at = NOW()
            WHERE id = $4 AND tenant_id = $5
            RETURNING *;
        `;
        const { rows } = await db.query(query, [title, status_key, display_order, id, tenant_id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Column not found' });
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error updating column:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete a column
exports.deleteColumn = async (req, res) => {
    const { id } = req.params;
    const { tenant_id } = req.user;

    try {
        const query = `DELETE FROM kanban_columns WHERE id = $1 AND tenant_id = $2 RETURNING *;`;
        const { rows } = await db.query(query, [id, tenant_id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Column not found' });
        res.status(200).json({ message: 'Column deleted' });
    } catch (error) {
        console.error('Error deleting column:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
