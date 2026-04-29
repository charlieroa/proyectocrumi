const crypto = require('crypto');

function calculateDV(nit) {
    const weights = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
    const strNit = nit.toString();
    let sum = 0;

    // Pad NIT to 15 chars (though effectively we just align right)
    // Actually simpler: iterate backwards
    for (let i = 0; i < strNit.length; i++) {
        const digit = parseInt(strNit[strNit.length - 1 - i]);
        sum += digit * weights[14 - i];
    }

    const remainder = sum % 11;
    if (remainder === 0) return 0;
    if (remainder === 1) return 1;
    return 11 - remainder;
}

const NIT = '222222222222';
console.log(`NIT: ${NIT}, Calculated DV: ${calculateDV(NIT)}`);
