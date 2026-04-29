require('dotenv').config();
const { pool } = require('./src/config/db');

async function createTasksTable() {
    try {
        console.log('Creating "tasks" table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
                priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
                due_date TIMESTAMP,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('"tasks" table created successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Error creating table:', e);
        process.exit(1);
    }
}

createTasksTable();
