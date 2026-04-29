// Patch v2 ROBUSTO para src/controllers/invoiceController.js
// Mejoras sobre v1:
//  - Usa insertMovementRaw del kardexController (DRY, valida stock insuficiente,
//    actualiza products.stock+cost y normaliza balance/avg/round).
//  - Usa cuentas auxiliares correctas (settings.cost_account_code default 613595 /
//    inventario default 143505), no códigos de grupo PUC.
//  - Vincula journal_entry_id a cada inventory_movement tras crear el asiento.
//  - Inyecta líneas Db Costo / Cr Inventario al asiento de la FV (un solo asiento).
//  - Aborta la factura si algún producto tiene stock insuficiente.

const fs = require('fs');
const F = '/home/vps/bolti/backend/src/controllers/invoiceController.js';
let s = fs.readFileSync(F, 'utf8');

const MARK_DONE = 'INVOICE_ITEMS_KARDEX_PATCH_v2';
const MARK_V1 = 'INVOICE_ITEMS_KARDEX_PATCH_v1';
if (s.includes(MARK_DONE)) {
  console.log('ALREADY PATCHED v2');
  process.exit(0);
}
if (s.includes(MARK_V1)) {
  console.error('FILE HAS v1 PATCH APPLIED — restore from .bak.kardex_v1 before applying v2');
  process.exit(2);
}

// -------- 1) Asegurar require de insertMovementRaw --------
const requireMarker = `const accountingCoreService = require('../services/accountingCoreService');`;
const newRequireBlock = `const accountingCoreService = require('../services/accountingCoreService');
const { insertMovementRaw } = require('./kardexController');`;
if (!s.includes(requireMarker)) {
  console.error('MARKER NOT FOUND for require block (accountingCoreService)');
  process.exit(3);
}
if (!s.includes(`require('./kardexController')`)) {
  s = s.replace(requireMarker, newRequireBlock);
}

// -------- 2) INSERT INTO invoice_items con campos nuevos --------
const oldInsertBlock = `        for (const item of processedItems) {
            const insertItemQuery = \`
                INSERT INTO invoice_items (
                    invoice_id,
                    description,
                    quantity,
                    unit_price,
                    tax_rate,
                    tax_amount,
                    discount,
                    subtotal,
                    total,
                    unit,
                    created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
                )
            \`;

            await client.query(insertItemQuery, [
                invoiceId,
                item.description || item.item || 'Item',
                item.quantity,
                item.unitPrice,
                item.tax || 0,
                item.taxVal,
                item.discountVal || 0,
                item.lineBase - item.discountVal,
                item.lineTotal,
                item.unit || 'und'
            ]);
        }`;

const newInsertBlock = `        // ${MARK_DONE}
        for (const item of processedItems) {
            const __pid = item.productId || item.product_id || null;
            const __sid = item.serviceId || item.service_id || null;
            const __itype = __pid ? 'product' : (__sid ? 'service' : 'free');
            const __unitCost = Number(item.unitCost || item.unit_cost || 0) || null;

            const insertItemQuery = \`
                INSERT INTO invoice_items (
                    invoice_id,
                    product_id,
                    service_id,
                    item_type,
                    unit_cost,
                    description,
                    quantity,
                    unit_price,
                    tax_rate,
                    tax_amount,
                    discount,
                    subtotal,
                    total,
                    unit,
                    created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
                )
            \`;

            await client.query(insertItemQuery, [
                invoiceId,
                __pid,
                __sid,
                __itype,
                __unitCost,
                item.description || item.item || 'Item',
                item.quantity,
                item.unitPrice,
                item.tax || 0,
                item.taxVal,
                item.discountVal || 0,
                item.lineBase - item.discountVal,
                item.lineTotal,
                item.unit || 'und'
            ]);
        }

        // === KARDEX OUT por línea inventariable (vía insertMovementRaw) ===
        // No genera asiento aquí — el COGS se inyecta al asiento de la FV (ver más abajo).
        const __invMovementIds = [];
        let __totalCostOfSales = 0;
        for (const __it of processedItems) {
            const __pid = __it.productId || __it.product_id;
            if (!__pid) continue;
            const __pres = await client.query(
                'SELECT id, cost, is_inventoriable FROM products WHERE id = $1 AND tenant_id = $2',
                [__pid, tenantId]
            );
            if (!__pres.rows[0]) continue;
            const __prod = __pres.rows[0];
            if (__prod.is_inventoriable === false) continue;

            const __qty = Number(__it.quantity || 0);
            if (!(__qty > 0)) continue;

            // unitCost: el avg lo recalcula insertMovementRaw a partir del balance previo;
            // para OUT solo importa que exista costo previo. Pasamos el cost del producto
            // como hint si no hay balance (caso borde: producto sin movimientos previos).
            const { movement } = await insertMovementRaw(client, tenantId, {
                productId: __pid,
                type: 'OUT',
                quantity: __qty,
                unitCost: Number(__prod.cost) || 0,
                documentType: 'INVOICE',
                documentId: invoiceId,
                documentNumber: invoiceNumber,
                date: dateIssue,
                notes: \`Venta - factura \${invoiceNumber}\`,
                userId: userIdToSave,
            });
            __invMovementIds.push(movement.id);
            __totalCostOfSales += Number(movement.quantity) * Number(movement.average_cost);
        }
        const __invMarker = { totalCostOfSales: Math.round(__totalCostOfSales * 100) / 100, movementIds: __invMovementIds };`;

if (!s.includes(oldInsertBlock)) {
  console.error('MARKER NOT FOUND for invoice_items insert block');
  process.exit(4);
}
s = s.replace(oldInsertBlock, newInsertBlock);

// -------- 3) Inyectar líneas COGS al asiento + vincular journal_entry_id --------
const oldJournalCall = `            journalEntry = await accountingCoreService.insertJournalEntry(client, tenantId, {
                description,
                documentType: 'FACTURA_VENTA',
                documentId: invoiceId,
                documentNumber: invoiceNumber,
                entryDate,
                lines,
                userId: userIdToSave,
            });`;

const newJournalCall = `            // === Líneas Costo de ventas / Salida de inventario (kardex) ===
            if (__invMarker && __invMarker.totalCostOfSales > 0) {
                const __cv = __invMarker.totalCostOfSales;
                const __cogsAccount = (s && s.cost_account_code) || '613595';
                const __invAccount = (s && s.inventory_account_code) || '143505';
                lines.push({
                    account_code: __cogsAccount,
                    debit: __cv,
                    credit: 0,
                    description: description + ' - Costo de ventas',
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName,
                });
                lines.push({
                    account_code: __invAccount,
                    debit: 0,
                    credit: __cv,
                    description: description + ' - Salida de inventario',
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName,
                });
            }

            journalEntry = await accountingCoreService.insertJournalEntry(client, tenantId, {
                description,
                documentType: 'FACTURA_VENTA',
                documentId: invoiceId,
                documentNumber: invoiceNumber,
                entryDate,
                lines,
                userId: userIdToSave,
            });

            // Vincular journal_entry_id a los movimientos de inventario para trazabilidad
            if (journalEntry && __invMarker && __invMarker.movementIds && __invMarker.movementIds.length > 0) {
                await client.query(
                    \`UPDATE inventory_movements SET journal_entry_id = $1
                     WHERE id = ANY($2::int[]) AND tenant_id = $3\`,
                    [journalEntry.id, __invMarker.movementIds, tenantId]
                );
            }`;

if (!s.includes(oldJournalCall)) {
  console.error('MARKER NOT FOUND for journal call block');
  process.exit(5);
}
s = s.replace(oldJournalCall, newJournalCall);

fs.copyFileSync(F, F + '.bak.kardex_v2');
fs.writeFileSync(F, s);
console.log('PATCHED v2');
