require('dotenv').config();
const fs = require('fs');
const { getDocumentStatus } = require('./src/services/dianService');

const TRACK_ID = 'd8a76b0e-85f2-4f02-a6de-1c7d2e8563b9';

(async () => {
    try {
        const result = await getDocumentStatus(TRACK_ID);
        fs.writeFileSync('dian_error_log.json', JSON.stringify(result, null, 2));
        console.log("LOG WRITTEN");
    } catch (error) {
        console.error("ERROR:", error);
    }
})();
