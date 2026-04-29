// src/helpers/sequenceHelper.js

/**
 * Obtiene el siguiente número de factura y actualiza la secuencia.
 * IMPORTANTE: Debe usarse dentro de una transacción SQL.
 * * @param {Object} client - El cliente de base de datos de la transacción actual
 * @param {string} tenantId - El ID de la empresa
 * @param {string} code - El tipo de documento (ej: 'FACTURA')
 */
const getNextSequence = async (client, tenantId, code = 'FACTURA', customPrefix = null) => {
    try {
        const defaultPrefixes = {
            FACTURA: 'FV',
            FACTURA_INTERNA: 'INT',
            COMPRA_ELEC: 'FC',
            COMPRA_INT: 'CI',
            COTIZACION: 'COT',
            REMISION: 'REM',
            ND: 'ND',
            NC: 'NC',
            RP: 'RP'
        };

        // 1. SELECT FOR UPDATE: Bloquea la fila para que nadie más tome este número
        const query = `
            SELECT id, prefix, current_number
            FROM document_sequences
            WHERE tenant_id = $1 AND document_type = $2
            FOR UPDATE
        `;

        const res = await client.query(query, [tenantId, code]);

        let sequence = res.rows[0];

        if (!sequence) {
            const prefix = customPrefix || defaultPrefixes[code] || code;
            const inserted = await client.query(
                `
                INSERT INTO document_sequences (tenant_id, document_type, prefix, current_number)
                VALUES ($1, $2, $3, 0)
                RETURNING id, prefix, current_number
                `,
                [tenantId, code, prefix]
            );
            sequence = inserted.rows[0];
        }

        const nextNumber = sequence.current_number + 1;

        // 3. Actualizamos el contador en la BD
        const updateQuery = `
            UPDATE document_sequences 
            SET current_number = $1
            WHERE id = $2
        `;

        await client.query(updateQuery, [nextNumber, sequence.id]);

        // 4. Retornamos el formato listo para guardar
        const fullNumber = sequence.prefix
            ? `${sequence.prefix}-${nextNumber}`
            : `${nextNumber}`;

        return {
            prefix: sequence.prefix,
            number: nextNumber,
            fullNumber: fullNumber // Ej: "POS-1"
        };

    } catch (error) {
        throw error;
    }
};

module.exports = { getNextSequence };
