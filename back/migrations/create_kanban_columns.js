require('dotenv').config();
const db = require('../src/config/db');

const createTable = async () => {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS kanban_columns (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                title VARCHAR(50) NOT NULL,
                status_key VARCHAR(50) NOT NULL,
                display_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;
        await db.query(query);
        console.log("Table 'kanban_columns' created successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error creating table:", error);
        process.exit(1);
    }
};

createTable();
