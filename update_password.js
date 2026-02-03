require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    user: 'crumiuser',
    host: 'localhost',
    database: 'crumi',
    password: 'Crumi2024!',
    port: 5432,
});

async function run() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('123456', salt);
        console.log('Generated Hash:', hash);

        const client = await pool.connect();
        try {
            const query = `
            UPDATE users 
            SET password_hash = $1, status = 'active'
            WHERE email IN ('superadmin@crumi.ai', 'prueba@prueba.com', 'salon@salon.com')
        `;
            const res = await client.query(query, [hash]);
            console.log(`Updated ${res.rowCount} users.`);
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
