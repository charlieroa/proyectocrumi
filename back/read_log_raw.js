const fs = require('fs');

try {
    const data = fs.readFileSync('debug_fetch_key_raw.txt', 'utf8');
    console.log(data);
} catch (e) {
    console.log('Error reading utf8, trying utf16le');
    const data = fs.readFileSync('debug_fetch_key_raw.txt', 'utf16le');
    console.log(data);
}
