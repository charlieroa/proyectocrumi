const fs = require('fs');

try {
    const content = fs.readFileSync('debug_key_full.log', 'utf8');

    // Look for TechnicalKey
    const keyMatch = content.match(/<TechnicalKey>(.*?)<\/TechnicalKey>/);
    if (keyMatch) {
        console.log('✅ TECHNICAL KEY FOUND:');
        console.log(keyMatch[1]);
    } else {
        console.log('❌ Technical Key NOT found in log.');

        // Look for OperationCode/Description
        const opCode = content.match(/<OperationCode>(.*?)<\/OperationCode>/);
        const opDesc = content.match(/<OperationDescription>(.*?)<\/OperationDescription>/);

        if (opCode) console.log(`OperationCode: ${opCode[1]}`);
        if (opDesc) console.log(`OperationDescription: ${opDesc[1]}`);

        // Print a snippet of raw XML to debug
        const rawXml = content.match(/<s:Body>(.*?)<\/s:Body>/);
        if (rawXml) {
            console.log('Snippet Body: ' + rawXml[1].substring(0, 500));
        } else {
            // Fallback print end of file
            console.log('Tail of log: ' + content.substring(content.length - 500));
        }
    }

} catch (e) {
    console.error(e);
}
