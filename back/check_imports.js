console.log("1. Importing dianConfig...");
try { require('./src/config/dianConfig'); console.log("   OK"); } catch (e) { console.error("   FAIL", e.message); }

console.log("2. Importing dianHelper...");
try { require('./src/helpers/dianHelper'); console.log("   OK"); } catch (e) { console.error("   FAIL", e.message); }

console.log("3. Importing dianSignatureHelper...");
try { require('./src/helpers/dianSignatureHelper'); console.log("   OK"); } catch (e) { console.error("   FAIL", e.message); }

console.log("4. Importing xadesEpesHelper...");
try { require('./src/helpers/xadesEpesHelper'); console.log("   OK"); } catch (e) { console.error("   FAIL", e.message); }

console.log("5. Importing creditNoteTemplate...");
try { require('./src/helpers/creditNoteTemplate'); console.log("   OK"); } catch (e) { console.error("   FAIL", e.message); }
