const bcrypt = require('bcryptjs');

async function run() {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('123456', salt);
    // Print SQL directly to stdout
    console.log(`UPDATE users SET password_hash = '${hash}', status = 'active' WHERE email IN ('superadmin@crumi.ai', 'prueba@prueba.com', 'salon@salon.com');`);
}

run();
