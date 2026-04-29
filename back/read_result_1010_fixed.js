const fs = require('fs');

try {
    const data = fs.readFileSync('final_result_1010_fixedtime.txt', 'utf8');
    console.log(data);
} catch (e) {
    console.log('Error reading result file 1010 fixed: ' + e.message);
}
