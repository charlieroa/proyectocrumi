const fs = require('fs');

try {
    const data = fs.readFileSync('final_result_1001.txt', 'utf8');
    console.log(data);
} catch (e) {
    console.log('Error reading result file: ' + e.message);
}
