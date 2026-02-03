require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    user: 'crumiuser', // Using defaults but will override with sudo if run as root/postgres env
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('123456', salt);
        console.log('Generated Hash:', hash);

        // We can't rely on pool config from env if running as root without full env
        // So we'll print the SQL to stdout and pipe it to psql, similar to before.
        // This is safer than trying to get node-pg to connect if auth is tricky.

        const sql = `
      INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role_id, phone, status)
      VALUES (1, 'superadmin@crumi.ai', '${hash}', 'Super', 'Admin', 99, '3000000000', 'active')
      ON CONFLICT (email) DO UPDATE SET password_hash = '${hash}', role_id = 99, status = 'active';
    `;
        console.log(sql);

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
