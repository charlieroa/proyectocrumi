require('dotenv').config();
const { pool } = require('../src/config/db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Creando tabla task_assignees para asignación múltiple...');
        
        await client.query('BEGIN');

        // Crear tabla de asignación múltiple
        await client.query(`
            CREATE TABLE IF NOT EXISTS task_assignees (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(task_id, user_id)
            );
        `);
        console.log('✓ Tabla task_assignees creada');

        // Crear índices para búsquedas rápidas
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
            CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);
        `);
        console.log('✓ Índices creados');

        // Migrar datos existentes: mover assigned_to a task_assignees
        const existingTasks = await client.query(`
            SELECT id, assigned_to FROM tasks WHERE assigned_to IS NOT NULL
        `);
        
        if (existingTasks.rows.length > 0) {
            console.log(`Migrando ${existingTasks.rows.length} tareas existentes...`);
            for (const task of existingTasks.rows) {
                await client.query(`
                    INSERT INTO task_assignees (task_id, user_id)
                    VALUES ($1, $2)
                    ON CONFLICT (task_id, user_id) DO NOTHING
                `, [task.id, task.assigned_to]);
            }
            console.log('✓ Tareas existentes migradas');
        }

        await client.query('COMMIT');
        console.log('✅ Migración completada exitosamente');
        
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error en migración:', e.message);
        throw e;
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
