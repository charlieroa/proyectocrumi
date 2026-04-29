// Patch ROBUSTO para src/controllers/creditNoteController.js
// Objetivo: que las NC de venta (motivo 1=devolución o 2=anulación) registren
// kardex IN vía insertMovementRaw (no solo UPDATE products.stock), y que el asiento
// de la NC incluya el reverso del costo de ventas:
//    Dr 143505 Inventario  / Cr 613595 Costo de ventas
//
// El costo unitario del IN se toma (en este orden):
//   1) inventory_movements OUT de la FV origen (más exacto: mismo costo que la salida)
//   2) invoice_items.unit_cost de la FV origen
//   3) products.cost (fallback)

const fs = require('fs');
const F = '/home/vps/bolti/backend/src/controllers/creditNoteController.js';
let s = fs.readFileSync(F, 'utf8');

const MARK_DONE = 'CREDITNOTE_KARDEX_PATCH_v1';
if (s.includes(MARK_DONE)) {
  console.log('ALREADY PATCHED');
  process.exit(0);
}

// -------- 1) Asegurar require de insertMovementRaw --------
const requireMarker = `const { validateTotalCancel } = require('../helpers/totalCancelValidator');`;
const newRequireBlock = `const { validateTotalCancel } = require('../helpers/totalCancelValidator');
const { insertMovementRaw } = require('./kardexController');`;
if (!s.includes(requireMarker)) {
  console.error('MARKER NOT FOUND for require block');
  process.exit(2);
}
if (!s.includes(`require('./kardexController')`)) {
  s = s.replace(requireMarker, newRequireBlock);
}

// -------- 2) Reemplazar bloque UPDATE products.stock por insertMovementRaw --------
const oldStockBlock = `            // Devolución de mercancía al stock cuando el motivo es devolución (DIAN 1)
            // o anulación total (DIAN 2). Solo actualizamos products.stock — el kardex
            // detallado se debe registrar manualmente vía /api/kardex/record-movement
            // si el tenant usa kardex (mezclar updates aquí causa desincronización porque
            // recordMovementInline parte de balance 0 si no hay apertura).
            // SAVEPOINT para no abortar la NC si el UPDATE falla.
            const conceptForKardex = isTotalCancel ? '2' : (resolvedConceptCode || '');
            if (item.productId && (conceptForKardex === '1' || conceptForKardex === '2')) {
                await client.query('SAVEPOINT kardex_sp');
                try {
                    await client.query(
                        \`UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3\`,
                        [Math.abs(item.quantity), item.productId, tenantId]
                    );
                    await client.query('RELEASE SAVEPOINT kardex_sp');
                } catch (kErr) {
                    await client.query('ROLLBACK TO SAVEPOINT kardex_sp');
                    console.warn('[creditNoteController] No se pudo actualizar stock:', kErr.message);
                }
            }
        }`;

const newStockBlock = `            // ${MARK_DONE}
            // Devolución de mercancía al inventario (motivo 1 devolución o 2 anulación).
            // Usa insertMovementRaw para alimentar kardex IN (sin asiento — se inyecta abajo).
            const conceptForKardex = isTotalCancel ? '2' : (resolvedConceptCode || '');
            if (item.productId && (conceptForKardex === '1' || conceptForKardex === '2')) {
                // Validamos producto inventariable
                const __pres = await client.query(
                    'SELECT id, cost, is_inventoriable FROM products WHERE id = $1 AND tenant_id = $2',
                    [item.productId, tenantId]
                );
                const __prod = __pres.rows[0];
                if (__prod && __prod.is_inventoriable !== false) {
                    const __qty = Math.abs(Number(item.quantity) || 0);
                    if (__qty > 0) {
                        // Buscar costo unitario de la salida original en kardex
                        let __unitCost = 0;
                        if (relatedInvoiceId) {
                            const __lastOut = await client.query(
                                \`SELECT unit_cost FROM inventory_movements
                                  WHERE tenant_id = $1 AND product_id = $2
                                    AND document_type = 'INVOICE' AND document_id = $3
                                    AND movement_type = 'OUT'
                                  ORDER BY id DESC LIMIT 1\`,
                                [tenantId, item.productId, Number(relatedInvoiceId)]
                            );
                            __unitCost = Number(__lastOut.rows[0]?.unit_cost || 0);
                            if (!__unitCost) {
                                const __ii = await client.query(
                                    \`SELECT unit_cost FROM invoice_items
                                      WHERE invoice_id = $1 AND product_id = $2
                                      ORDER BY id LIMIT 1\`,
                                    [Number(relatedInvoiceId), item.productId]
                                );
                                __unitCost = Number(__ii.rows[0]?.unit_cost || 0);
                            }
                        }
                        if (!__unitCost) __unitCost = Number(__prod.cost) || 0;

                        await client.query('SAVEPOINT kardex_sp');
                        try {
                            const { movement } = await insertMovementRaw(client, tenantId, {
                                productId: item.productId,
                                type: 'IN',
                                quantity: __qty,
                                unitCost: __unitCost,
                                documentType: 'CREDIT_NOTE',
                                documentId: creditNote.id,
                                documentNumber: noteNumber,
                                date: dateIssue || creditNote.date,
                                notes: \`Devolución venta - NC \${noteNumber}\`,
                                userId: createdBy,
                            });
                            __ncMovementIds.push(movement.id);
                            __ncCogsReversal += __qty * __unitCost;
                            await client.query('RELEASE SAVEPOINT kardex_sp');
                        } catch (kErr) {
                            await client.query('ROLLBACK TO SAVEPOINT kardex_sp');
                            console.warn('[creditNoteController] kardex IN falló:', kErr.message);
                        }
                    }
                }
            }
        }`;

if (!s.includes(oldStockBlock)) {
  console.error('MARKER NOT FOUND for stock update block');
  process.exit(3);
}
s = s.replace(oldStockBlock, newStockBlock);

// -------- 3) Inicializar acumuladores antes del bucle de items --------
const oldLoopOpen = `        for (const item of processedItems) {
            await client.query(
                \`INSERT INTO credit_note_items (`;

const newLoopOpen = `        // Acumuladores kardex/COGS reversal (consumidos al armar el asiento)
        const __ncMovementIds = [];
        let __ncCogsReversal = 0;

        for (const item of processedItems) {
            await client.query(
                \`INSERT INTO credit_note_items (`;

if (!s.includes(oldLoopOpen)) {
  console.error('MARKER NOT FOUND for loop open');
  process.exit(4);
}
s = s.replace(oldLoopOpen, newLoopOpen);

// -------- 4) Inyectar líneas de reverso de COGS al asiento + vincular journal_entry_id --------
const oldJournalCall = `            journalEntry = await insertJournalEntry(client, tenantId, {
                description: \`Nota crédito \${noteNumber} - \${clientName}\`,
                documentType: 'NOTA_CREDITO',
                documentId: creditNote.id,
                documentNumber: noteNumber,
                entryDate: dateIssue || creditNote.date || new Date(),
                lines,
                userId: createdBy,
            });
        }`;

const newJournalCall = `            // === Reverso costo de ventas (kardex IN devolución) ===
            if (__ncCogsReversal > 0) {
                const __cv = Math.round(__ncCogsReversal * 100) / 100;
                const __cogsAccount = (settings && settings.cost_account_code) || '613595';
                const __invAccount = (settings && settings.inventory_account_code) || '143505';
                lines.push({
                    account_code: __invAccount,
                    description: \`Reverso entrada inventario NC \${noteNumber}\`,
                    debit: __cv,
                    credit: 0,
                    third_party_document: clientNit || null,
                    third_party_name: clientName || null,
                });
                lines.push({
                    account_code: __cogsAccount,
                    description: \`Reverso costo de ventas NC \${noteNumber}\`,
                    debit: 0,
                    credit: __cv,
                    third_party_document: clientNit || null,
                    third_party_name: clientName || null,
                });
            }

            journalEntry = await insertJournalEntry(client, tenantId, {
                description: \`Nota crédito \${noteNumber} - \${clientName}\`,
                documentType: 'NOTA_CREDITO',
                documentId: creditNote.id,
                documentNumber: noteNumber,
                entryDate: dateIssue || creditNote.date || new Date(),
                lines,
                userId: createdBy,
            });

            if (journalEntry && __ncMovementIds.length > 0) {
                await client.query(
                    \`UPDATE inventory_movements SET journal_entry_id = $1
                      WHERE id = ANY($2::int[]) AND tenant_id = $3\`,
                    [journalEntry.id, __ncMovementIds, tenantId]
                );
            }
        }`;

if (!s.includes(oldJournalCall)) {
  console.error('MARKER NOT FOUND for journal call');
  process.exit(5);
}
s = s.replace(oldJournalCall, newJournalCall);

fs.copyFileSync(F, F + '.bak.kardex_v1');
fs.writeFileSync(F, s);
console.log('PATCHED');
