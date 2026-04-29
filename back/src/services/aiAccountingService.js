// src/services/aiAccountingService.js
// Servicio de IA Contable - Automatización estilo AX1
// Clasificación inteligente, conciliación bancaria IA, predicción de flujo de caja,
// detección de errores contables, auto-causación

const db = require('../config/db');
const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// =============================================
// HELPER: Llamada a OpenAI
// =============================================

async function callOpenAI(messages, { maxTokens = 1000, temperature = 0.2, jsonMode = true } = {}) {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurada');
    }

    const body = {
        model: OPENAI_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
    };

    if (jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        body,
        {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Respuesta vacía de OpenAI');

    return jsonMode ? JSON.parse(content) : content;
}

// =============================================
// 1. CLASIFICACIÓN INTELIGENTE CON IA
// Capa 2.5 del classifierEngine - cuando keywords fallan
// =============================================

async function aiClassifyItem(tenantId, description, documentType) {
    // Obtener PUC del tenant para dar contexto
    const pucResult = await db.query(
        `SELECT account_code, account_name, account_type
         FROM chart_of_accounts
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY account_code
         LIMIT 200`,
        [tenantId]
    );

    const pucList = pucResult.rows
        .map(r => `${r.account_code} - ${r.account_name} (${r.account_type})`)
        .join('\n');

    const messages = [
        {
            role: 'system',
            content: `Eres un contador colombiano experto en el PUC (Plan Único de Cuentas).
Tu tarea es clasificar ítems de documentos contables en la cuenta PUC correcta.

REGLAS:
- Solo usa cuentas del PUC proporcionado
- Para facturas de venta: usa cuentas de ingreso (41xx) para el ingreso y 1305 para CxC
- Para compras/gastos: usa cuentas de gasto (51xx, 52xx, 53xx) o activo según aplique
- Para notas crédito: invierte la cuenta original
- Responde SIEMPRE en JSON con: { "account_code": "XXXXXX", "account_name": "NOMBRE", "confidence": 0.0-1.0, "reasoning": "explicación breve" }

PUC disponible del tenant:
${pucList}`
        },
        {
            role: 'user',
            content: `Clasifica este ítem:
Descripción: "${description}"
Tipo de documento: ${documentType || 'FACTURA'}

Responde en JSON.`
        }
    ];

    const result = await callOpenAI(messages, { maxTokens: 300, temperature: 0.1 });

    return {
        accountCode: result.account_code,
        accountName: result.account_name,
        confidence: Math.min(Number(result.confidence) || 0.75, 0.92),
        source: 'IA_CLASIFICACION',
        reasoning: result.reasoning || ''
    };
}

/**
 * Clasificación batch - múltiples ítems de una vez (más eficiente)
 */
async function aiClassifyBatch(tenantId, items, documentType) {
    const pucResult = await db.query(
        `SELECT account_code, account_name, account_type
         FROM chart_of_accounts
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY account_code
         LIMIT 200`,
        [tenantId]
    );

    const pucList = pucResult.rows
        .map(r => `${r.account_code} - ${r.account_name} (${r.account_type})`)
        .join('\n');

    const itemsList = items
        .map((item, i) => `${i + 1}. "${item.description || item.item || ''}"`)
        .join('\n');

    const messages = [
        {
            role: 'system',
            content: `Eres un contador colombiano experto en el PUC.
Clasifica TODOS los ítems en sus cuentas PUC correctas.
Responde en JSON: { "classifications": [{ "index": 1, "account_code": "XXXXXX", "account_name": "NOMBRE", "confidence": 0.0-1.0 }, ...] }

PUC disponible:
${pucList}`
        },
        {
            role: 'user',
            content: `Clasifica estos ítems (tipo documento: ${documentType || 'FACTURA'}):\n${itemsList}`
        }
    ];

    const result = await callOpenAI(messages, { maxTokens: 1500, temperature: 0.1 });

    return (result.classifications || []).map(c => ({
        index: c.index,
        accountCode: c.account_code,
        accountName: c.account_name,
        confidence: Math.min(Number(c.confidence) || 0.75, 0.92),
        source: 'IA_CLASIFICACION_BATCH'
    }));
}

// =============================================
// 2. CONCILIACIÓN BANCARIA INTELIGENTE
// Matching por descripción + monto + fecha con IA
// =============================================

async function aiBankReconciliation(tenantId, bankTransactionId) {
    // Obtener la transacción bancaria
    const txResult = await db.query(
        `SELECT bt.*, tb.name AS bank_name, tb.account_code
         FROM bank_transactions bt
         INNER JOIN tenant_banks tb ON tb.id = bt.bank_id
         WHERE bt.id = $1 AND bt.tenant_id = $2`,
        [bankTransactionId, tenantId]
    );

    const bankTx = txResult.rows[0];
    if (!bankTx) throw new Error('Transacción bancaria no encontrada');

    const txAmount = Number(bankTx.amount || 0);
    const txDate = bankTx.transaction_date;
    const txDesc = bankTx.description || '';
    const txType = (bankTx.transaction_type || 'ABONO').toUpperCase();

    // Buscar candidatos con tolerancia de monto (±5%) y fecha (±15 días)
    const tolerance = txAmount * 0.05;
    const candidates = await db.query(
        `SELECT
            je.id AS journal_entry_id,
            je.entry_number,
            je.entry_date,
            je.description AS je_description,
            je.document_type,
            je.document_number,
            jel.account_code,
            jel.description AS line_description,
            CASE WHEN $3 = 'ABONO' THEN jel.debit ELSE jel.credit END AS amount
         FROM journal_entries je
         INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
         WHERE je.tenant_id = $1
           AND jel.account_code = $2
           AND ABS(CASE WHEN $3 = 'ABONO' THEN COALESCE(jel.debit, 0) ELSE COALESCE(jel.credit, 0) END - $4) <= $5
           AND je.entry_date BETWEEN ($6::date - INTERVAL '15 days') AND ($6::date + INTERVAL '15 days')
           AND NOT EXISTS (
               SELECT 1 FROM bank_reconciliation_lines brl
               INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
               WHERE brl.journal_entry_id = je.id AND br.status <> 'ANULADA'
           )
         ORDER BY ABS(CASE WHEN $3 = 'ABONO' THEN COALESCE(jel.debit, 0) ELSE COALESCE(jel.credit, 0) END - $4) ASC,
                  ABS(je.entry_date - $6::date) ASC
         LIMIT 30`,
        [tenantId, bankTx.account_code, txType, txAmount, tolerance, txDate]
    );

    if (candidates.rows.length === 0) {
        return { bankTransaction: bankTx, matches: [], aiSuggestion: null };
    }

    // Pedir a la IA que rankee los candidatos
    const candidatesList = candidates.rows.map((c, i) => ({
        index: i + 1,
        entry_number: c.entry_number,
        date: c.entry_date,
        amount: Number(c.amount),
        description: c.je_description || c.line_description,
        document_type: c.document_type,
        document_number: c.document_number
    }));

    const messages = [
        {
            role: 'system',
            content: `Eres un asistente de conciliación bancaria. Analiza una transacción bancaria y sus posibles coincidencias en el libro contable.
Evalúa: similitud de monto, cercanía de fecha, similitud de descripción/concepto.
Responde en JSON: {
  "best_match_index": <número o null si ninguno es confiable>,
  "confidence": 0.0-1.0,
  "reasoning": "explicación breve",
  "ranked": [{ "index": N, "score": 0.0-1.0 }, ...]
}`
        },
        {
            role: 'user',
            content: `TRANSACCIÓN BANCARIA:
- Descripción: "${txDesc}"
- Monto: $${txAmount.toLocaleString('es-CO')}
- Fecha: ${txDate}
- Tipo: ${txType}
- Banco: ${bankTx.bank_name}
- Referencia: ${bankTx.reference || 'N/A'}

CANDIDATOS DEL LIBRO CONTABLE:
${JSON.stringify(candidatesList, null, 2)}

¿Cuál es la mejor coincidencia?`
        }
    ];

    const aiResult = await callOpenAI(messages, { maxTokens: 500, temperature: 0.1 });

    // Mapear resultado con datos completos
    const matches = (aiResult.ranked || []).map(r => {
        const candidate = candidates.rows[r.index - 1];
        if (!candidate) return null;
        return {
            ...candidate,
            amount: Number(candidate.amount),
            aiScore: r.score,
            isTopMatch: r.index === aiResult.best_match_index
        };
    }).filter(Boolean);

    return {
        bankTransaction: bankTx,
        matches,
        aiSuggestion: {
            bestMatchIndex: aiResult.best_match_index,
            confidence: aiResult.confidence,
            reasoning: aiResult.reasoning,
            bestMatch: aiResult.best_match_index
                ? candidates.rows[aiResult.best_match_index - 1]
                : null
        }
    };
}

/**
 * Auto-conciliar todas las transacciones pendientes de un banco
 */
async function aiAutoReconcile(tenantId, bankId, minConfidence = 0.85) {
    const pendingTx = await db.query(
        `SELECT bt.id
         FROM bank_transactions bt
         WHERE bt.tenant_id = $1
           AND bt.bank_id = $2
           AND bt.status IN ('PENDIENTE', 'IMPORTADA')
           AND (bt.matched_amount IS NULL OR bt.matched_amount < bt.amount)
         ORDER BY bt.transaction_date DESC
         LIMIT 50`,
        [tenantId, bankId]
    );

    const results = { matched: 0, skipped: 0, errors: 0, details: [] };

    for (const tx of pendingTx.rows) {
        try {
            const suggestion = await aiBankReconciliation(tenantId, tx.id);

            if (suggestion.aiSuggestion?.confidence >= minConfidence && suggestion.aiSuggestion?.bestMatch) {
                results.details.push({
                    bankTransactionId: tx.id,
                    journalEntryId: suggestion.aiSuggestion.bestMatch.journal_entry_id,
                    confidence: suggestion.aiSuggestion.confidence,
                    reasoning: suggestion.aiSuggestion.reasoning,
                    status: 'suggested'
                });
                results.matched++;
            } else {
                results.skipped++;
            }
        } catch (err) {
            results.errors++;
            results.details.push({
                bankTransactionId: tx.id,
                error: err.message,
                status: 'error'
            });
        }
    }

    return results;
}

// =============================================
// 3. PREDICCIÓN DE FLUJO DE CAJA
// =============================================

async function aiCashFlowPrediction(tenantId, monthsAhead = 3) {
    // Obtener datos históricos de los últimos 12 meses
    const historicalData = await db.query(
        `SELECT
            DATE_TRUNC('month', je.entry_date) AS month,
            SUM(CASE WHEN jel.account_code LIKE '41%' THEN jel.credit - jel.debit ELSE 0 END) AS ingresos,
            SUM(CASE WHEN jel.account_code LIKE '51%' OR jel.account_code LIKE '52%' OR jel.account_code LIKE '53%'
                THEN jel.debit - jel.credit ELSE 0 END) AS gastos,
            SUM(CASE WHEN jel.account_code LIKE '11%' THEN jel.debit - jel.credit ELSE 0 END) AS flujo_bancos
         FROM journal_entries je
         INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
         WHERE je.tenant_id = $1
           AND je.entry_date >= (CURRENT_DATE - INTERVAL '12 months')
           AND je.status = 'POSTED'
         GROUP BY DATE_TRUNC('month', je.entry_date)
         ORDER BY month ASC`,
        [tenantId]
    );

    // Obtener CxC y CxP pendientes
    const receivables = await db.query(
        `SELECT COALESCE(SUM(
            CASE WHEN jel.account_code LIKE '1305%' THEN jel.debit - jel.credit ELSE 0 END
         ), 0) AS total_cxc
         FROM journal_entries je
         INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
         WHERE je.tenant_id = $1 AND je.status = 'POSTED'`,
        [tenantId]
    );

    const payables = await db.query(
        `SELECT COALESCE(SUM(
            CASE WHEN jel.account_code LIKE '2205%' THEN jel.credit - jel.debit ELSE 0 END
         ), 0) AS total_cxp
         FROM journal_entries je
         INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
         WHERE je.tenant_id = $1 AND je.status = 'POSTED'`,
        [tenantId]
    );

    // Saldo actual en bancos
    const bankBalance = await db.query(
        `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS saldo_bancos
         FROM journal_entries je
         INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
         WHERE je.tenant_id = $1
           AND jel.account_code LIKE '11%'
           AND je.status = 'POSTED'`,
        [tenantId]
    );

    const historical = historicalData.rows.map(r => ({
        month: r.month,
        ingresos: Number(r.ingresos || 0),
        gastos: Number(r.gastos || 0),
        flujo_neto: Number(r.ingresos || 0) - Number(r.gastos || 0),
        flujo_bancos: Number(r.flujo_bancos || 0)
    }));

    const messages = [
        {
            role: 'system',
            content: `Eres un analista financiero experto en flujo de caja para empresas colombianas.
Analiza los datos históricos y predice el flujo de caja futuro.

Responde en JSON:
{
  "current_status": {
    "health": "bueno|regular|crítico",
    "summary": "resumen en 1-2 oraciones"
  },
  "predictions": [
    {
      "month": "YYYY-MM",
      "ingresos_estimados": N,
      "gastos_estimados": N,
      "flujo_neto": N,
      "saldo_proyectado": N,
      "confidence": 0.0-1.0
    }
  ],
  "risks": ["riesgo 1", "riesgo 2"],
  "recommendations": ["recomendación 1", "recomendación 2"],
  "trends": {
    "ingresos": "creciente|estable|decreciente",
    "gastos": "creciente|estable|decreciente"
  }
}`
        },
        {
            role: 'user',
            content: `DATOS DE LA EMPRESA:

Saldo actual en bancos: $${Number(bankBalance.rows[0]?.saldo_bancos || 0).toLocaleString('es-CO')}
Cuentas por cobrar: $${Number(receivables.rows[0]?.total_cxc || 0).toLocaleString('es-CO')}
Cuentas por pagar: $${Number(payables.rows[0]?.total_cxp || 0).toLocaleString('es-CO')}

HISTÓRICO MENSUAL (últimos 12 meses):
${JSON.stringify(historical, null, 2)}

Genera predicción para los próximos ${monthsAhead} meses.`
        }
    ];

    const prediction = await callOpenAI(messages, { maxTokens: 1500, temperature: 0.3 });

    return {
        historical,
        currentBalance: Number(bankBalance.rows[0]?.saldo_bancos || 0),
        accountsReceivable: Number(receivables.rows[0]?.total_cxc || 0),
        accountsPayable: Number(payables.rows[0]?.total_cxp || 0),
        ...prediction
    };
}

// =============================================
// 4. DETECCIÓN DE ERRORES CONTABLES
// =============================================

async function aiAuditEntries(tenantId, options = {}) {
    const { startDate, endDate, limit = 50 } = options;

    const where = ['je.tenant_id = $1', "je.status = 'POSTED'"];
    const params = [tenantId];

    if (startDate) {
        params.push(startDate);
        where.push(`je.entry_date >= $${params.length}`);
    }
    if (endDate) {
        params.push(endDate);
        where.push(`je.entry_date <= $${params.length}`);
    }

    // Obtener asientos con sus líneas
    const entries = await db.query(
        `SELECT
            je.id, je.entry_number, je.entry_date, je.description,
            je.document_type, je.document_number,
            je.total_debit, je.total_credit,
            json_agg(json_build_object(
                'account_code', jel.account_code,
                'account_name', COALESCE(coa.account_name, jel.account_code),
                'debit', jel.debit,
                'credit', jel.credit,
                'description', jel.description
            ) ORDER BY jel.id) AS lines
         FROM journal_entries je
         INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
         LEFT JOIN chart_of_accounts coa ON coa.account_code = jel.account_code AND coa.tenant_id = je.tenant_id
         WHERE ${where.join(' AND ')}
         GROUP BY je.id
         ORDER BY je.entry_date DESC
         LIMIT $${params.length + 1}`,
        [...params, limit]
    );

    if (entries.rows.length === 0) {
        return { issues: [], summary: 'No hay asientos para auditar', score: 100 };
    }

    // Preparar resumen para IA (no enviar todo, solo lo necesario)
    const entriesSummary = entries.rows.map(e => ({
        number: e.entry_number,
        date: e.entry_date,
        description: e.description,
        type: e.document_type,
        total_debit: Number(e.total_debit),
        total_credit: Number(e.total_credit),
        balanced: Math.abs(Number(e.total_debit) - Number(e.total_credit)) < 0.01,
        lines: e.lines.map(l => ({
            account: `${l.account_code} ${l.account_name}`,
            debit: Number(l.debit),
            credit: Number(l.credit),
            desc: l.description
        }))
    }));

    const messages = [
        {
            role: 'system',
            content: `Eres un auditor contable colombiano experto. Analiza asientos contables buscando errores comunes:

1. Asientos desbalanceados (débito ≠ crédito)
2. Cuentas mal clasificadas (ej: gasto en cuenta de activo)
3. Naturaleza invertida (ej: ingreso al débito, gasto al crédito)
4. Duplicados potenciales (mismo monto, fecha similar, descripción similar)
5. Montos inusuales o atípicos
6. Descripciones vacías o genéricas
7. Cuentas de mayor usadas donde debería haber auxiliar
8. Falta de tercero en CxC o CxP

Responde en JSON:
{
  "issues": [
    {
      "entry_number": "X",
      "severity": "alta|media|baja",
      "type": "DESBALANCE|CLASIFICACION|NATURALEZA|DUPLICADO|ATIPICO|DESCRIPCION|OTRO",
      "description": "explicación del problema",
      "suggestion": "cómo corregirlo"
    }
  ],
  "score": 0-100,
  "summary": "resumen general de la salud contable",
  "patterns": ["patrón observado 1", "patrón 2"]
}`
        },
        {
            role: 'user',
            content: `Audita estos ${entriesSummary.length} asientos contables:\n${JSON.stringify(entriesSummary, null, 2)}`
        }
    ];

    const auditResult = await callOpenAI(messages, { maxTokens: 2000, temperature: 0.2 });

    return {
        entriesAnalyzed: entries.rows.length,
        ...auditResult
    };
}

// =============================================
// 5. AUTO-CAUSACIÓN DESDE TEXTO/DOCUMENTO
// Genera asientos contables desde descripción en lenguaje natural
// =============================================

async function aiAutoCausacion(tenantId, input) {
    const { text, amount, date, documentType, thirdParty } = input;

    // Obtener PUC
    const pucResult = await db.query(
        `SELECT account_code, account_name, account_type
         FROM chart_of_accounts
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY account_code
         LIMIT 200`,
        [tenantId]
    );

    const pucList = pucResult.rows
        .map(r => `${r.account_code} - ${r.account_name} (${r.account_type})`)
        .join('\n');

    // Buscar tercero si se proporcionó
    let thirdPartyInfo = '';
    if (thirdParty) {
        const tpResult = await db.query(
            `SELECT id, name, document_number, fiscal_regime
             FROM third_parties
             WHERE tenant_id = $1
               AND (name ILIKE $2 OR document_number LIKE $2)
             LIMIT 1`,
            [tenantId, `%${thirdParty}%`]
        );
        if (tpResult.rows[0]) {
            thirdPartyInfo = `\nTercero encontrado: ${tpResult.rows[0].name} (${tpResult.rows[0].document_number})`;
        }
    }

    const messages = [
        {
            role: 'system',
            content: `Eres un contador colombiano que genera asientos contables a partir de descripciones en lenguaje natural.

REGLAS:
- Usa SOLO cuentas del PUC proporcionado
- El asiento DEBE estar balanceado (débito = crédito)
- Incluye IVA cuando aplique (19%)
- Para retenciones en la fuente, usa las cuentas 2365xx
- Para IVA ventas: 2408, IVA compras: 2408 (descontable)

Responde en JSON:
{
  "description": "descripción del asiento",
  "document_type": "FACTURA|GASTO|PAGO|NOTA_CREDITO|AJUSTE|NOMINA|OTRO",
  "lines": [
    {
      "account_code": "XXXXXX",
      "account_name": "NOMBRE",
      "debit": 0,
      "credit": 0,
      "description": "detalle línea"
    }
  ],
  "total_debit": N,
  "total_credit": N,
  "tax_breakdown": {
    "base": N,
    "iva": N,
    "retefuente": N,
    "reteica": N
  },
  "confidence": 0.0-1.0,
  "warnings": ["advertencia si hay algo ambiguo"]
}

PUC disponible:
${pucList}`
        },
        {
            role: 'user',
            content: `Genera el asiento contable para:
"${text}"
${amount ? `Monto: $${Number(amount).toLocaleString('es-CO')}` : ''}
${date ? `Fecha: ${date}` : ''}
${documentType ? `Tipo: ${documentType}` : ''}
${thirdPartyInfo}`
        }
    ];

    const result = await callOpenAI(messages, { maxTokens: 1500, temperature: 0.1 });

    // Validar que esté balanceado
    const totalDebit = (result.lines || []).reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalCredit = (result.lines || []).reduce((sum, l) => sum + Number(l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        result.warnings = result.warnings || [];
        result.warnings.push(`Asiento desbalanceado: débito=${totalDebit}, crédito=${totalCredit}. Revise antes de contabilizar.`);
        result.balanced = false;
    } else {
        result.balanced = true;
    }

    result.total_debit = totalDebit;
    result.total_credit = totalCredit;

    return result;
}

// =============================================
// 6. ANÁLISIS INTELIGENTE DE DOCUMENTOS
// Extrae datos contables de texto de factura/recibo
// =============================================

async function aiParseDocument(text) {
    const messages = [
        {
            role: 'system',
            content: `Eres un experto en lectura de documentos contables colombianos.
Extrae la información estructurada de facturas, recibos, notas crédito/débito.

Responde en JSON:
{
  "document_type": "FACTURA|NOTA_CREDITO|NOTA_DEBITO|RECIBO|CUENTA_COBRO|OTRO",
  "document_number": "número",
  "date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD o null",
  "supplier": {
    "name": "nombre",
    "nit": "NIT",
    "address": "dirección",
    "phone": "teléfono"
  },
  "customer": {
    "name": "nombre",
    "nit": "NIT"
  },
  "items": [
    {
      "description": "descripción",
      "quantity": N,
      "unit_price": N,
      "tax_rate": N,
      "tax_amount": N,
      "total": N
    }
  ],
  "subtotal": N,
  "tax_total": N,
  "discount": N,
  "total": N,
  "payment_method": "CONTADO|CREDITO",
  "cufe": "CUFE si existe",
  "confidence": 0.0-1.0
}`
        },
        {
            role: 'user',
            content: `Extrae los datos de este documento:\n\n${text}`
        }
    ];

    return await callOpenAI(messages, { maxTokens: 1500, temperature: 0.1 });
}

// =============================================
// 7. ASISTENTE CONTABLE (Chat)
// Responde preguntas contables con contexto del tenant
// =============================================

async function aiAccountingChat(tenantId, question, conversationHistory = []) {
    // Obtener contexto financiero rápido
    const context = await db.query(
        `SELECT
            (SELECT COUNT(*) FROM journal_entries WHERE tenant_id = $1 AND status = 'POSTED') AS total_asientos,
            (SELECT COALESCE(SUM(jel.debit - jel.credit), 0) FROM journal_entries je
             INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
             WHERE je.tenant_id = $1 AND jel.account_code LIKE '11%' AND je.status = 'POSTED') AS saldo_bancos,
            (SELECT COALESCE(SUM(jel.debit - jel.credit), 0) FROM journal_entries je
             INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
             WHERE je.tenant_id = $1 AND jel.account_code LIKE '1305%' AND je.status = 'POSTED') AS cxc,
            (SELECT COALESCE(SUM(jel.credit - jel.debit), 0) FROM journal_entries je
             INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
             WHERE je.tenant_id = $1 AND jel.account_code LIKE '2205%' AND je.status = 'POSTED') AS cxp`,
        [tenantId]
    );

    const ctx = context.rows[0] || {};

    const messages = [
        {
            role: 'system',
            content: `Eres el Contador IA de Crumi, un asistente contable experto en normatividad colombiana (NIIF, PUC, DIAN).

CONTEXTO DE LA EMPRESA:
- Asientos contabilizados: ${ctx.total_asientos || 0}
- Saldo en bancos: $${Number(ctx.saldo_bancos || 0).toLocaleString('es-CO')}
- Cuentas por cobrar: $${Number(ctx.cxc || 0).toLocaleString('es-CO')}
- Cuentas por pagar: $${Number(ctx.cxp || 0).toLocaleString('es-CO')}

REGLAS:
- Responde siempre en español colombiano
- Sé conciso pero preciso
- Si te preguntan algo que requiere acción, sugiere los pasos específicos
- Referencia normativas cuando aplique (NIIF, Estatuto Tributario, decretos)
- Si no estás seguro, dilo claramente`
        },
        ...conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content
        })),
        { role: 'user', content: question }
    ];

    const response = await callOpenAI(messages, { maxTokens: 1000, temperature: 0.4, jsonMode: false });

    return { answer: response, context: ctx };
}

// =============================================
// EXPORTS
// =============================================

module.exports = {
    // Clasificación
    aiClassifyItem,
    aiClassifyBatch,
    // Conciliación
    aiBankReconciliation,
    aiAutoReconcile,
    // Flujo de caja
    aiCashFlowPrediction,
    // Auditoría
    aiAuditEntries,
    // Auto-causación
    aiAutoCausacion,
    // Parsing
    aiParseDocument,
    // Chat
    aiAccountingChat,
    // Helper
    callOpenAI
};
