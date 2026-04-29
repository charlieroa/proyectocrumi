const db = require('../config/db');

// Create a new task con asignación múltiple y checklist
exports.createTask = async (req, res) => {
    const { assignees, assigned_to, title, description, priority, due_date, task_tenant_id, checklist } = req.body;
    const { tenant_id: userTenantId, id: created_by, role_id } = req.user;

    const assigneeList = assignees && Array.isArray(assignees) && assignees.length > 0 
        ? assignees 
        : (assigned_to ? [assigned_to] : []);

    try {
        const isSuperAdmin = parseInt(role_id, 10) === 99;
        let effectiveTenantId = userTenantId;

        if (isSuperAdmin) {
            if (task_tenant_id) {
                effectiveTenantId = task_tenant_id;
            } else if (assigneeList.length > 0) {
                const userRes = await db.query('SELECT tenant_id FROM users WHERE id = $1', [assigneeList[0]]);
                if (userRes.rows.length > 0 && userRes.rows[0].tenant_id) {
                    effectiveTenantId = userRes.rows[0].tenant_id;
                }
            }
        }

        const taskQuery = `
            INSERT INTO tasks (tenant_id, assigned_to, title, description, priority, due_date, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const firstAssignee = assigneeList.length > 0 ? assigneeList[0] : null;
        const { rows } = await db.query(taskQuery, [effectiveTenantId, firstAssignee, title, description || null, priority, due_date, created_by]);
        const task = rows[0];

        // Insertar asignados
        if (assigneeList.length > 0) {
            for (const userId of assigneeList) {
                await db.query(`
                    INSERT INTO task_assignees (task_id, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT (task_id, user_id) DO NOTHING
                `, [task.id, userId]);
            }
        }

        // Insertar checklist items
        if (checklist && Array.isArray(checklist) && checklist.length > 0) {
            for (let i = 0; i < checklist.length; i++) {
                const item = checklist[i];
                if (item.text && item.text.trim()) {
                    await db.query(`
                        INSERT INTO task_checklist_items (task_id, text, completed, sort_order)
                        VALUES ($1, $2, $3, $4)
                    `, [task.id, item.text.trim(), item.completed || false, i]);
                }
            }
        }

        // Obtener checklist creado
        const checklistRes = await db.query(
            'SELECT id, text, completed, sort_order FROM task_checklist_items WHERE task_id = $1 ORDER BY sort_order',
            [task.id]
        );

        task.assignees = assigneeList;
        task.checklist = checklistRes.rows;
        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get tasks for a specific user (busca en task_assignees)
exports.getTasksByUser = async (req, res) => {
    const { userId } = req.params;
    const { tenant_id } = req.user;

    try {
        const query = `
            SELECT DISTINCT t.*, 
                   COALESCE(
                       (SELECT json_agg(json_build_object('id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'email', u.email))
                        FROM task_assignees ta2 
                        JOIN users u ON ta2.user_id = u.id 
                        WHERE ta2.task_id = t.id), '[]'
                   ) as assignees
            FROM tasks t
            JOIN task_assignees ta ON t.id = ta.task_id
            WHERE t.tenant_id = $1 AND ta.user_id = $2
            ORDER BY t.created_at DESC;
        `;
        const { rows } = await db.query(query, [tenant_id, userId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get ALL tasks for the tenant (or all tasks for Super Admin) con asignados
exports.getTasks = async (req, res) => {
    const { tenant_id, role_id, id: currentUserId } = req.user;
    const { assigned_to } = req.query;

    try {
        const isSuperAdmin = parseInt(role_id, 10) === 99;
        const isEmployee = parseInt(role_id, 10) === 3;
        let query;
        let params = [];

        // Subquery para checklist
        const checklistSubquery = `COALESCE(
            (SELECT json_agg(json_build_object('id', ci.id, 'text', ci.text, 'completed', ci.completed, 'sort_order', ci.sort_order) ORDER BY ci.sort_order)
             FROM task_checklist_items ci WHERE ci.task_id = t.id), '[]'
        )`;

        if (isSuperAdmin) {
            query = `
                SELECT t.*, ten.name as tenant_name,
                       COALESCE(
                           (SELECT json_agg(json_build_object('id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'email', u.email, 'tenant_name', tn.name))
                            FROM task_assignees ta 
                            JOIN users u ON ta.user_id = u.id 
                            LEFT JOIN tenants tn ON u.tenant_id = tn.id
                            WHERE ta.task_id = t.id), '[]'
                       ) as assignees,
                       ${checklistSubquery} as checklist
                FROM tasks t
                LEFT JOIN tenants ten ON t.tenant_id = ten.id
            `;
            if (assigned_to) {
                query += ` WHERE EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1)`;
                params.push(assigned_to);
            }
        } else if (isEmployee) {
            query = `
                SELECT t.*, ten.name as tenant_name,
                       COALESCE(
                           (SELECT json_agg(json_build_object('id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'email', u.email))
                            FROM task_assignees ta2 
                            JOIN users u ON ta2.user_id = u.id 
                            WHERE ta2.task_id = t.id), '[]'
                       ) as assignees,
                       ${checklistSubquery} as checklist
                FROM tasks t
                LEFT JOIN tenants ten ON t.tenant_id = ten.id
                WHERE EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1)
            `;
            params = [currentUserId];
        } else {
            query = `
                SELECT t.*,
                       COALESCE(
                           (SELECT json_agg(json_build_object('id', u.id, 'first_name', u.first_name, 'last_name', u.last_name, 'email', u.email))
                            FROM task_assignees ta 
                            JOIN users u ON ta.user_id = u.id 
                            WHERE ta.task_id = t.id), '[]'
                       ) as assignees,
                       ${checklistSubquery} as checklist
                FROM tasks t
                WHERE t.tenant_id = $1
            `;
            params = [tenant_id];

            if (assigned_to) {
                query += ` AND EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2)`;
                params.push(assigned_to);
            }
        }

        query += ` ORDER BY t.created_at DESC;`;

        const { rows } = await db.query(query, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching all tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update task details (including assignees)
exports.updateTask = async (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority, due_date, assignees } = req.body;
    const { tenant_id, role_id } = req.user;

    try {
        const isSuperAdmin = parseInt(role_id, 10) === 99;
        let query;
        let values;

        if (isSuperAdmin) {
            query = `
              UPDATE tasks
              SET title = COALESCE($1, title),
                  description = COALESCE($2, description),
                  status = COALESCE($3, status),
                  priority = COALESCE($4, priority),
                  due_date = COALESCE($5, due_date),
                  updated_at = NOW()
              WHERE id = $6
              RETURNING *;
            `;
            values = [title, description, status, priority, due_date, id];
        } else {
            query = `
              UPDATE tasks
              SET title = COALESCE($1, title),
                  description = COALESCE($2, description),
                  status = COALESCE($3, status),
                  priority = COALESCE($4, priority),
                  due_date = COALESCE($5, due_date),
                  updated_at = NOW()
              WHERE id = $6 AND tenant_id = $7
              RETURNING *;
            `;
            values = [title, description, status, priority, due_date, id, tenant_id];
        }

        const { rows } = await db.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = rows[0];

        // Si se enviaron asignados, actualizar task_assignees
        if (assignees && Array.isArray(assignees)) {
            // Eliminar asignados actuales
            await db.query('DELETE FROM task_assignees WHERE task_id = $1', [id]);
            
            // Insertar nuevos asignados
            for (const userId of assignees) {
                await db.query(`
                    INSERT INTO task_assignees (task_id, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT (task_id, user_id) DO NOTHING
                `, [id, userId]);
            }

            // Actualizar assigned_to con el primero (compatibilidad)
            if (assignees.length > 0) {
                await db.query('UPDATE tasks SET assigned_to = $1 WHERE id = $2', [assignees[0], id]);
            }
        }

        // Obtener asignados actualizados
        const assigneesRes = await db.query(`
            SELECT u.id, u.first_name, u.last_name, u.email
            FROM task_assignees ta
            JOIN users u ON ta.user_id = u.id
            WHERE ta.task_id = $1
        `, [id]);

        task.assignees = assigneesRes.rows;
        res.status(200).json(task);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete a task
exports.deleteTask = async (req, res) => {
    const { id } = req.params;
    const { tenant_id, role_id } = req.user;

    try {
        const isSuperAdmin = parseInt(role_id, 10) === 99;
        let query;
        let params;

        if (isSuperAdmin) {
            query = `DELETE FROM tasks WHERE id = $1 RETURNING *;`;
            params = [id];
        } else {
            query = `DELETE FROM tasks WHERE id = $1 AND tenant_id = $2 RETURNING *;`;
            params = [id, tenant_id];
        }

        const { rows } = await db.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // task_assignees se elimina automáticamente por ON DELETE CASCADE
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get users for task assignment o listado Configuración (Personal / Super Admin)
exports.getUsersForAssignment = async (req, res) => {
    const { tenant_id, role_id } = req.user || {};
    const roleFilter = req.query.role;

    try {
        let query;
        let params = [];

        const userRoleId = parseInt(role_id, 10);
        const isSuperAdmin = userRoleId === 99;

        if (isSuperAdmin && roleFilter === '99') {
            query = `SELECT u.id, u.first_name, u.last_name, u.email, u.role_id, u.status,
                            t.name as tenant_name, t.id as tenant_id
                     FROM users u
                     LEFT JOIN tenants t ON u.tenant_id = t.id
                     WHERE u.role_id = 99
                     ORDER BY u.first_name, u.last_name;`;
        } else if (isSuperAdmin) {
            query = `SELECT u.id, u.first_name, u.last_name, u.email, u.role_id, u.status,
                            t.name as tenant_name, t.id as tenant_id
                     FROM users u
                     LEFT JOIN tenants t ON u.tenant_id = t.id
                     WHERE (u.status IS NULL OR u.status = 'active')
                       AND (u.role_id = 3 OR u.role_id = 5)
                     ORDER BY t.name NULLS LAST, u.first_name, u.last_name;`;
        } else {
            query = `SELECT u.id, u.first_name, u.last_name, u.email, u.role_id, u.status,
                            t.name as tenant_name, t.id as tenant_id
                     FROM users u
                     LEFT JOIN tenants t ON u.tenant_id = t.id
                     WHERE u.tenant_id = $1 
                       AND (u.status IS NULL OR u.status = 'active')
                       AND (u.role_id = 3 OR u.role_id = 5)
                     ORDER BY u.first_name, u.last_name;`;
            params = [tenant_id];
        }

        const { rows } = await db.query(query, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('[getUsersForAssignment] Error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};

// ============ CHECKLIST ENDPOINTS ============

// Toggle checklist item completed
exports.toggleChecklistItem = async (req, res) => {
    const { itemId } = req.params;
    try {
        const { rows } = await db.query(
            'UPDATE task_checklist_items SET completed = NOT completed WHERE id = $1 RETURNING *',
            [itemId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error toggling checklist item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Add checklist item to task
exports.addChecklistItem = async (req, res) => {
    const { taskId } = req.params;
    const { text } = req.body;
    
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text is required' });
    }
    
    try {
        // Get max sort_order
        const maxRes = await db.query(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM task_checklist_items WHERE task_id = $1',
            [taskId]
        );
        const sortOrder = maxRes.rows[0].next_order;
        
        const { rows } = await db.query(
            'INSERT INTO task_checklist_items (task_id, text, sort_order) VALUES ($1, $2, $3) RETURNING *',
            [taskId, text.trim(), sortOrder]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error adding checklist item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete checklist item
exports.deleteChecklistItem = async (req, res) => {
    const { itemId } = req.params;
    try {
        const { rows } = await db.query(
            'DELETE FROM task_checklist_items WHERE id = $1 RETURNING *',
            [itemId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json({ message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting checklist item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
