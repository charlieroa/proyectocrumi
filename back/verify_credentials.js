const key = '85cfe5435c77853e84caaa79e14216a9c68c21';
const pin = '10226';
const id = '2e596e42-daf8-48ef-83d8-b6e9d02c090e';
const nit = '902006720';

console.log(`Key: '${key}' - Length: ${key.length}`);
console.log(`PIN: '${pin}' - Length: ${pin.length}`);
console.log(`ID: '${id}' - Length: ${id.length}`);
console.log(`NIT: '${nit}' - Length: ${nit.length}`);

if (key.length !== 39 && key.length !== 64) console.log('WARNING: Key length unusual (Standard is 64 hex for SHA256 or similar? No, Technical Key is usually a GUID or Hash).');
// 85cfe543 5c77 853e 84ca aa79e14216a9 c68c21 -> Looks like concatenated GUID parts?
// 8+4+4+4+12 = 32.
// "85cfe5435c77853e84caaa79e14216a9c68c21" has 38 chars?
// Let's count.
