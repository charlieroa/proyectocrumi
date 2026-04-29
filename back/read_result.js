const fs = require('fs');

try {
    // Try waiting a bit if file is being written? No, command finished.
    const data = fs.readFileSync('final_result.txt', 'utf8');
    console.log(data);
} catch (e) {
    console.log('Error reading result file: ' + e.message);
}
