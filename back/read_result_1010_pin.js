const fs = require('fs');

try {
    const data = fs.readFileSync('final_result_1010_pin_hardcoded.txt', 'utf8');
    console.log(data);
} catch (e) {
    console.log('Error reading result file 1010 pin hardcoded: ' + e.message);
}
