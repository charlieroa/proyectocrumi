const fs = require('fs');

try {
    const data = fs.readFileSync('debug_fetch_key.txt', 'utf16le'); // Try UTF-16LE
    console.log(data);
} catch (e) {
    console.log('Error reading utf16le, trying utf8');
    const data = fs.readFileSync('debug_fetch_key.txt', 'utf8');
    console.log(data);
}
