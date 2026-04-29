// src/helpers/classifierEngine.js
// Motor de clasificación PUC - 4 capas de prioridad
// Asigna cuentas contables según producto/servicio sin usar IA/LLM

// =============================================
// UTILIDADES DE TEXTO
// =============================================

const STOPWORDS = new Set([
    'de', 'la', 'el', 'para', 'con', 'un', 'una', 'los', 'las', 'del',
    'en', 'por', 'al', 'se', 'es', 'que', 'su', 'y', 'o', 'a', 'e',
    'no', 'si', 'como', 'mas', 'pero', 'cada', 'este', 'esta', 'estos',
    'estas', 'ser', 'son', 'fue', 'han', 'muy', 'otro', 'otra'
]);

function normalize(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // quitar tildes
        .replace(/[^a-z0-9\s]/g, ' ')   // solo alfanumérico
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text) {
    const normalized = normalize(text);
    if (!normalized) return [];
    return normalized
        .split(' ')
        .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function jaccardSimilarity(tokensA, tokensB) {
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
}

// =============================================
// REGLAS PREDETERMINADAS (SEED)
// =============================================

const DEFAULT_RULES = [
    // MERCANCÍAS / INVENTARIOS (14)
    { keywords: 'televisor|tv|pantalla|monitor|display', account_code: '143505', account_name: 'MERCANCIAS NO FABRICADAS', category: 'PRODUCTO', priority: 10 },
    { keywords: 'computador|portatil|laptop|pc|tablet|ipad', account_code: '152805', account_name: 'EQUIPO DE COMPUTACION', category: 'PRODUCTO', priority: 10 },
    { keywords: 'celular|telefono|smartphone|iphone|movil', account_code: '152805', account_name: 'EQUIPO DE COMPUTACION', category: 'PRODUCTO', priority: 10 },
    { keywords: 'mueble|escritorio|silla|mesa|estanteria|archivador', account_code: '152405', account_name: 'EQUIPO DE OFICINA', category: 'PRODUCTO', priority: 10 },
    { keywords: 'impresora|escaner|scanner|fotocopiadora|toner', account_code: '152805', account_name: 'EQUIPO DE COMPUTACION', category: 'PRODUCTO', priority: 10 },
    { keywords: 'electrodomestico|nevera|refrigerador|lavadora|horno|microondas', account_code: '143505', account_name: 'MERCANCIAS NO FABRICADAS', category: 'PRODUCTO', priority: 10 },
    { keywords: 'cable|hdmi|usb|cargador|adaptador|accesorio', account_code: '143505', account_name: 'MERCANCIAS NO FABRICADAS', category: 'PRODUCTO', priority: 5 },
    { keywords: 'ropa|camisa|pantalon|vestido|calzado|zapato|tenis', account_code: '143505', account_name: 'MERCANCIAS NO FABRICADAS', category: 'PRODUCTO', priority: 5 },
    { keywords: 'alimento|comida|bebida|snack|cafe|agua', account_code: '143505', account_name: 'MERCANCIAS NO FABRICADAS', category: 'PRODUCTO', priority: 5 },
    { keywords: 'herramienta|taladro|destornillador|martillo|pinza', account_code: '152805', account_name: 'EQUIPO DE COMPUTACION', category: 'PRODUCTO', priority: 5 },
    { keywords: 'vehiculo|carro|moto|camion|bicicleta', account_code: '154005', account_name: 'AUTOS CAMIONETAS Y CAMPEROS', category: 'PRODUCTO', priority: 10 },
    { keywords: 'maquinaria|equipo|industrial|planta', account_code: '152005', account_name: 'MAQUINARIA Y EQUIPO', category: 'PRODUCTO', priority: 10 },

    // SERVICIOS (41)
    { keywords: 'consultoria|asesoria|coaching|mentoria', account_code: '416520', account_name: 'SERVICIOS PROFESIONALES', category: 'SERVICIO', priority: 10 },
    { keywords: 'corte|tinte|manicure|pedicure|belleza|spa|peluqueria|salon|cabello|unas|facial|masaje|depilacion', account_code: '416515', account_name: 'SERVICIOS PERSONALES', category: 'SERVICIO', priority: 10 },
    { keywords: 'desarrollo|software|programacion|web|aplicacion|app|sistema|plataforma', account_code: '416520', account_name: 'SERVICIOS TECNICOS', category: 'SERVICIO', priority: 10 },
    { keywords: 'diseno|grafico|logo|branding|marca|publicidad|marketing|seo|redes', account_code: '416520', account_name: 'SERVICIOS PROFESIONALES', category: 'SERVICIO', priority: 8 },
    { keywords: 'mantenimiento|reparacion|soporte|tecnico|instalacion', account_code: '416515', account_name: 'SERVICIOS TECNICOS', category: 'SERVICIO', priority: 8 },
    { keywords: 'capacitacion|formacion|curso|taller|seminario|conferencia', account_code: '416520', account_name: 'SERVICIOS EDUCATIVOS', category: 'SERVICIO', priority: 8 },
    { keywords: 'alquiler|arriendo|renta|canon|arrendamiento', account_code: '416515', account_name: 'SERVICIOS DE ARRENDAMIENTO', category: 'SERVICIO', priority: 10 },
    { keywords: 'limpieza|aseo|fumigacion|jardineria', account_code: '416515', account_name: 'SERVICIOS GENERALES', category: 'SERVICIO', priority: 5 },
    { keywords: 'vigilancia|seguridad|monitoreo|alarma', account_code: '416515', account_name: 'SERVICIOS DE SEGURIDAD', category: 'SERVICIO', priority: 8 },
    { keywords: 'salud|medico|medicina|odontologia|examen|laboratorio', account_code: '416520', account_name: 'SERVICIOS DE SALUD', category: 'SERVICIO', priority: 10 },

    // GASTOS OPERACIONALES (51)
    { keywords: 'honorario|contador|abogado|notaria|revisor', account_code: '511005', account_name: 'HONORARIOS', category: 'GASTO', priority: 10 },
    { keywords: 'arriendo|alquiler|renta|canon', account_code: '512010', account_name: 'ARRENDAMIENTOS', category: 'GASTO', priority: 9 },
    { keywords: 'energia|electrica|luz|agua|gas|acueducto|alcantarillado', account_code: '513530', account_name: 'SERVICIOS PUBLICOS', category: 'GASTO', priority: 10 },
    { keywords: 'internet|telefonia|plan|datos|celular|comunicacion', account_code: '513535', account_name: 'COMUNICACIONES', category: 'GASTO', priority: 10 },
    { keywords: 'papeleria|utiles|resma|boligrafo|lapiz|carpeta|tinta', account_code: '519510', account_name: 'UTILES Y PAPELERIA', category: 'GASTO', priority: 10 },
    { keywords: 'transporte|flete|envio|mensajeria|domicilio|courier', account_code: '514505', account_name: 'TRANSPORTES', category: 'GASTO', priority: 10 },
    { keywords: 'seguro|poliza|aseguradora|cobertura', account_code: '513005', account_name: 'SEGUROS', category: 'GASTO', priority: 10 },
    { keywords: 'publicidad|propaganda|anuncio|pauta|volante|aviso', account_code: '521505', account_name: 'PUBLICIDAD Y PROPAGANDA', category: 'GASTO', priority: 8 },
    { keywords: 'combustible|gasolina|diesel|acpm|peaje', account_code: '514510', account_name: 'COMBUSTIBLES Y LUBRICANTES', category: 'GASTO', priority: 10 },
    { keywords: 'restaurante|almuerzo|comida|cafeteria|refrigerio', account_code: '519525', account_name: 'RESTAURANTE Y CAFETERIA', category: 'GASTO', priority: 8 },
    { keywords: 'viaje|viatico|hospedaje|hotel|pasaje|aereo|tiquete', account_code: '519520', account_name: 'GASTOS DE VIAJE', category: 'GASTO', priority: 10 },
    { keywords: 'impuesto|ica|iva|predial|retencion|retefuente', account_code: '511505', account_name: 'IMPUESTOS', category: 'GASTO', priority: 10 },
    { keywords: 'depreciacion|amortizacion', account_code: '516005', account_name: 'DEPRECIACIONES', category: 'GASTO', priority: 10 },
    { keywords: 'comision|intermediacion|corretaje', account_code: '513520', account_name: 'COMISIONES', category: 'GASTO', priority: 8 },
    { keywords: 'salario|sueldo|nomina|prima|cesantia|vacacion', account_code: '510506', account_name: 'SUELDOS Y SALARIOS', category: 'GASTO', priority: 10 },
    { keywords: 'banco|transferencia|comision bancaria|cuota manejo|gmf|4x1000', account_code: '530505', account_name: 'GASTOS BANCARIOS', category: 'GASTO', priority: 8 },
    { keywords: 'aseo|elementos aseo|jabon|detergente|desinfectante', account_code: '519530', account_name: 'ELEMENTOS DE ASEO', category: 'GASTO', priority: 5 },
    { keywords: 'fotocopia|impresion|encuadernacion', account_code: '519515', account_name: 'FOTOCOPIAS', category: 'GASTO', priority: 5 },
];

// =============================================
// CUENTAS FALLBACK (Capa 4)
// =============================================

const FALLBACK_ACCOUNTS = {
    'FACTURA': { accountCode: '416515', accountName: 'ACTIVIDADES DE SERVICIOS' },
    'NOTA_CREDITO': { accountCode: '416515', accountName: 'ACTIVIDADES DE SERVICIOS' },
    'NOTA_DEBITO': { accountCode: '416515', accountName: 'ACTIVIDADES DE SERVICIOS' },
    'DOCUMENTO_SOPORTE': { accountCode: '519595', accountName: 'OTROS GASTOS' },
    'DEFAULT': { accountCode: '416515', accountName: 'ACTIVIDADES DE SERVICIOS' }
};

const IVA_ACCOUNTS = {
    'FACTURA': { debit: '130505', debitName: 'CLIENTES NACIONALES', credit: '240805', creditName: 'IVA GENERADO EN VENTAS' },
    'NOTA_CREDITO': { debit: '240805', debitName: 'IVA GENERADO EN VENTAS', credit: '130505', creditName: 'CLIENTES NACIONALES' },
    'NOTA_DEBITO': { debit: '130505', debitName: 'CLIENTES NACIONALES', credit: '240805', creditName: 'IVA GENERADO EN VENTAS' },
    'DOCUMENTO_SOPORTE': { debit: '240805', debitName: 'IVA DESCONTABLE EN COMPRAS', credit: '220505', creditName: 'PROVEEDORES NACIONALES' },
    'DEFAULT': { debit: '130505', debitName: 'CLIENTES NACIONALES', credit: '240805', creditName: 'IVA GENERADO EN VENTAS' }
};

const BANK_ACCOUNT = { code: '111005', name: 'MONEDA NACIONAL (BANCOS)' };

// =============================================
// CAPA 1: MEMORIA EXACTA (account_mappings aprobados)
// =============================================

async function searchExactMapping(client, tenantId, normalizedText, documentType) {
    try {
        const result = await client.query(
            `SELECT account_code, account_name, approved
             FROM account_mappings
             WHERE tenant_id = $1
               AND normalized_concept = $2
               AND (document_type = $3 OR document_type IS NULL)
               AND approved = true
             ORDER BY match_count DESC, last_used_at DESC
             LIMIT 1`,
            [tenantId, normalizedText, documentType]
        );

        if (result.rows.length > 0) {
            // Incrementar contador de uso
            await client.query(
                `UPDATE account_mappings SET match_count = match_count + 1, last_used_at = NOW()
                 WHERE tenant_id = $1 AND normalized_concept = $2 AND approved = true`,
                [tenantId, normalizedText]
            );
            return {
                accountCode: result.rows[0].account_code,
                accountName: result.rows[0].account_name,
                confidence: 1.0,
                source: 'MEMORIA_EXACTA'
            };
        }
        return null;
    } catch (error) {
        console.error('[Classifier] Error en búsqueda exacta:', error.message);
        return null;
    }
}

// =============================================
// CAPA 2: REGLAS POR KEYWORD (classification_rules)
// =============================================

async function searchKeywordRules(client, tenantId, normalizedText) {
    try {
        const result = await client.query(
            `SELECT keywords, account_code, account_name, category, priority
             FROM classification_rules
             WHERE tenant_id = $1 AND is_active = true
             ORDER BY priority DESC`,
            [tenantId]
        );

        let bestMatch = null;
        let bestScore = 0;

        for (const rule of result.rows) {
            const keywords = rule.keywords.split('|').map(k => k.trim().toLowerCase());
            for (const keyword of keywords) {
                if (normalizedText.includes(keyword)) {
                    // Puntuación: prioridad + longitud del keyword (mayor keyword = más específico)
                    const score = rule.priority + (keyword.length / 10);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = {
                            accountCode: rule.account_code,
                            accountName: rule.account_name,
                            confidence: Math.min(0.95, 0.85 + (rule.priority / 100)),
                            source: 'REGLA_KEYWORD'
                        };
                    }
                }
            }
        }

        return bestMatch;
    } catch (error) {
        console.error('[Classifier] Error en búsqueda de reglas:', error.message);
        return null;
    }
}

// =============================================
// CAPA 2b: REGLAS DEFAULT (si no hay reglas del tenant)
// =============================================

function searchDefaultRules(normalizedText) {
    let bestMatch = null;
    let bestScore = 0;

    for (const rule of DEFAULT_RULES) {
        const keywords = rule.keywords.split('|').map(k => k.trim().toLowerCase());
        for (const keyword of keywords) {
            if (normalizedText.includes(keyword)) {
                const score = rule.priority + (keyword.length / 10);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        accountCode: rule.account_code,
                        accountName: rule.account_name,
                        confidence: Math.min(0.90, 0.80 + (rule.priority / 100)),
                        source: 'REGLA_DEFAULT'
                    };
                }
            }
        }
    }

    return bestMatch;
}

// =============================================
// CAPA 3: SIMILITUD DE TOKENS (Jaccard)
// =============================================

async function searchSimilarMappings(client, tenantId, tokens) {
    try {
        const result = await client.query(
            `SELECT concept, normalized_concept, account_code, account_name, match_count
             FROM account_mappings
             WHERE tenant_id = $1 AND approved = true
             ORDER BY match_count DESC
             LIMIT 100`,
            [tenantId]
        );

        let bestMatch = null;
        let bestSimilarity = 0;

        for (const mapping of result.rows) {
            const mappingTokens = tokenize(mapping.normalized_concept || mapping.concept);
            const similarity = jaccardSimilarity(tokens, mappingTokens);

            if (similarity > bestSimilarity && similarity >= 0.35) {
                bestSimilarity = similarity;
                bestMatch = {
                    accountCode: mapping.account_code,
                    accountName: mapping.account_name,
                    confidence: Math.min(0.80, similarity),
                    source: 'SIMILITUD_TOKENS'
                };
            }
        }

        return bestMatch;
    } catch (error) {
        console.error('[Classifier] Error en búsqueda por similitud:', error.message);
        return null;
    }
}

// =============================================
// CAPA 2.5: CLASIFICACIÓN CON IA (OpenAI)
// Se activa cuando las capas de keywords y similitud fallan
// =============================================

async function searchAIClassification(tenantId, description, documentType) {
    try {
        const { aiClassifyItem } = require('../services/aiAccountingService');
        const result = await aiClassifyItem(tenantId, description, documentType);
        if (result && result.accountCode) {
            return {
                accountCode: result.accountCode,
                accountName: result.accountName,
                confidence: result.confidence,
                source: 'IA_CLASIFICACION',
                reasoning: result.reasoning
            };
        }
        return null;
    } catch (error) {
        console.warn('[Classifier] IA no disponible, continuando con fallback:', error.message);
        return null;
    }
}

// =============================================
// FUNCIÓN PRINCIPAL: classifyItem
// =============================================

async function classifyItem(client, tenantId, description, documentType) {
    const normalizedText = normalize(description);
    const tokens = tokenize(description);

    if (!normalizedText) {
        const fallback = FALLBACK_ACCOUNTS[documentType] || FALLBACK_ACCOUNTS['DEFAULT'];
        return { ...fallback, confidence: 0.0, source: 'FALLBACK_VACIO' };
    }

    // Capa 1: Memoria exacta
    const exactMatch = await searchExactMapping(client, tenantId, normalizedText, documentType);
    if (exactMatch) return exactMatch;

    // Capa 2: Reglas del tenant
    const keywordMatch = await searchKeywordRules(client, tenantId, normalizedText);
    if (keywordMatch) return keywordMatch;

    // Capa 2b: Reglas predeterminadas
    const defaultMatch = searchDefaultRules(normalizedText);
    if (defaultMatch) return defaultMatch;

    // Capa 3: Similitud de tokens
    const similarMatch = await searchSimilarMappings(client, tenantId, tokens);
    if (similarMatch) return similarMatch;

    // Capa 3.5: Clasificación con IA (OpenAI)
    const aiMatch = await searchAIClassification(tenantId, description, documentType);
    if (aiMatch) {
        // Guardar el resultado de IA como mapping para aprendizaje futuro
        try {
            const { learnMapping } = module.exports;
            await learnMapping(client, tenantId, description, aiMatch.accountCode, aiMatch.accountName, documentType, null, false);
        } catch (e) { /* no bloquear por error de guardado */ }
        return aiMatch;
    }

    // Capa 4: Fallback genérico
    const fallback = FALLBACK_ACCOUNTS[documentType] || FALLBACK_ACCOUNTS['DEFAULT'];
    return {
        accountCode: fallback.accountCode,
        accountName: fallback.accountName,
        confidence: 0.0,
        source: 'FALLBACK_GENERICO'
    };
}

// =============================================
// classifyDocumentItems — Clasifica y agrupa items
// =============================================

async function classifyDocumentItems(client, tenantId, items, documentType) {
    if (!items || items.length === 0) return [];

    const classified = [];

    for (const item of items) {
        const description = item.item || item.description || '';
        const classification = await classifyItem(client, tenantId, description, documentType);

        classified.push({
            ...item,
            description,
            accountCode: classification.accountCode,
            accountName: classification.accountName,
            confidence: classification.confidence,
            source: classification.source
        });
    }

    // Agrupar por cuenta
    const grouped = {};
    for (const item of classified) {
        const key = item.accountCode;
        if (!grouped[key]) {
            grouped[key] = {
                accountCode: item.accountCode,
                accountName: item.accountName,
                items: [],
                totalBase: 0,
                totalTax: 0,
                totalLine: 0,
                minConfidence: 1.0
            };
        }

        const base = (Number(item.lineBase) || Number(item.unitPrice) * Number(item.quantity)) - (Number(item.discountVal) || 0);
        grouped[key].items.push(item.description);
        grouped[key].totalBase += base;
        grouped[key].totalTax += Number(item.taxVal) || Number(item.taxAmount) || 0;
        grouped[key].totalLine += Number(item.lineTotal) || Number(item.totalLine) || 0;
        grouped[key].minConfidence = Math.min(grouped[key].minConfidence, item.confidence);
    }

    return Object.values(grouped);
}

// =============================================
// learnMapping — Guardar mapping aprobado
// =============================================

async function learnMapping(client, tenantId, concept, accountCode, accountName, documentType, userId, approved = false) {
    const normalizedConcept = normalize(concept);

    try {
        await client.query(
            `INSERT INTO account_mappings
                (tenant_id, concept, account_code, account_name, document_type, approved, approved_by, approved_at, normalized_concept, match_count, last_used_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, NOW())
             ON CONFLICT (tenant_id, concept, document_type)
             DO UPDATE SET
                account_code = EXCLUDED.account_code,
                account_name = EXCLUDED.account_name,
                approved = CASE WHEN EXCLUDED.approved THEN true ELSE account_mappings.approved END,
                approved_by = CASE WHEN EXCLUDED.approved THEN EXCLUDED.approved_by ELSE account_mappings.approved_by END,
                approved_at = CASE WHEN EXCLUDED.approved THEN NOW() ELSE account_mappings.approved_at END,
                match_count = account_mappings.match_count + 1,
                last_used_at = NOW()`,
            [
                tenantId,
                concept,
                accountCode,
                accountName,
                documentType,
                approved,
                approved ? userId : null,
                approved ? new Date() : null,
                normalizedConcept
            ]
        );
    } catch (error) {
        console.error('[Classifier] Error guardando mapping:', error.message);
    }
}

// =============================================
// seedDefaultRules — Seedear reglas para un tenant
// =============================================

async function seedDefaultRules(client, tenantId) {
    let count = 0;
    for (const rule of DEFAULT_RULES) {
        try {
            await client.query(
                `INSERT INTO classification_rules (tenant_id, keywords, account_code, account_name, category, priority)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (tenant_id, keywords, account_code) DO NOTHING`,
                [tenantId, rule.keywords, rule.account_code, rule.account_name, rule.category, rule.priority]
            );
            count++;
        } catch (error) {
            // Ignorar duplicados
        }
    }
    return count;
}

// =============================================
// EXPORTS
// =============================================

module.exports = {
    normalize,
    tokenize,
    jaccardSimilarity,
    classifyItem,
    classifyDocumentItems,
    learnMapping,
    seedDefaultRules,
    DEFAULT_RULES,
    FALLBACK_ACCOUNTS,
    IVA_ACCOUNTS,
    BANK_ACCOUNT
};
