const https = require('https');

const options = {
    method: 'GET',
    rejectUnauthorized: false,
    timeout: 10000
};

console.log('⏳ Getting DIAN Server Headers from vpfe.dian.gov.co...');

const req = https.request('https://vpfe.dian.gov.co/WcfDianCustomerServices.svc', options, (res) => {
    console.log('✅ Connection Successful');
    console.log('📅 DIAN Server Date Header:', res.headers.date);
    // console.log('All Headers:', JSON.stringify(res.headers));
});

req.on('error', (e) => {
    console.error('❌ Connection Error:', e.message);
});

req.on('timeout', () => {
    console.error('❌ Timeout');
    req.abort();
});

req.end();
