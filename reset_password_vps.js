require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Config string from what we saw on VPS .env
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:53121C4rl0@localhost:5432/crumi';

const pool = new Pool({
    connectionString: connectionString,
});

async function run() {
    try {
        const password = '123456';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        console.log('--- GENERATED HASH ---');
        console.log(hash);

        const client = await pool.connect();
        try {
            console.log('--- UPDATING DB ---');
            // Update both superadmin and the user's salon account
            const query = `
            UPDATE users 
            SET password_hash = $1, status = 'active'
            WHERE email IN ('superadmin@crumi.ai', 'salon@salon.com')
            RETURNING email, password_hash;
        `;
            const res = await client.query(query, [hash]);
            console.log(`Updated ${res.rowCount} users:`);
            res.rows.forEach(r => console.log(` - ${r.email}: ${r.password_hash.substring(0, 10)}...`));

            console.log('--- VERIFYING ---');
            const match = await bcrypt.compare(password, hash);
            console.log(`bcrypt.compare('${password}', hash) = ${match}`);

            if (match) {
                console.log('SUCCESS: Password set and verified valid in this environment.');
            } else {
                console.error('FAILURE: Generated hash does not match immediately!');
            }

        } finally {
            client.release();
        }
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await pool.end();
    }
}

run();
