/**
 * Calendario Tributario DIAN 2026 - Colombia.
 *
 * Las fechas reales de vencimiento DIAN dependen del ultimo digito del NIT
 * (sin digito de verificacion). El patron general es: digitos bajos (1-2)
 * vencen primero en el mes, digitos altos (9-0) al final.
 *
 * Nota: fechas basadas en el patron tradicional DIAN. Ajustar con la
 * resolucion oficial DIAN 2026 si se requiere exactitud legal.
 */

// Helpers: calcular la fecha de vencimiento para un digito dentro de
// una ventana habil [startDay..endDay] de un mes. Saltos de ~1 dia habil
// por cada 2 digitos. Digito 1-2 = primer dia, 9-0 = ultimo dia.
const pad = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// digit (1..0 donde 0=10) -> offset de dia dentro de la ventana
// Tradicionalmente DIAN asigna dos digitos por dia habil.
const digitSlot = (d) => {
    // d viene como 0-9 (last digit); mapeo a slot 1..10 (0 -> 10)
    const order = d === 0 ? 10 : d;
    // 2 digitos por dia habil -> 5 slots
    return Math.ceil(order / 2); // 1..5
};

// Construye due_date para un digito dado la primera fecha de la ventana
// y avanzando 'slot-1' dias habiles aproximados (se aproxima con +dias calendario).
const dueForDigit = (year, month, firstDay, lastDigit) => {
    const slot = digitSlot(lastDigit);
    // Avanzar aprox 1 dia habil por slot (ajustado para fines de semana)
    const day = firstDay + (slot - 1);
    return toISO(year, month, day);
};

// Para declaraciones bimestrales (IVA), el calendario DIAN 2026 suele
// tener ventanas entre el 10 y el 26 del mes siguiente al cierre del bimestre.
const IVA_WINDOWS = [
    { periodLabel: 'Bimestre 1 Ene-Feb 2026', year: 2026, month: 3, firstDay: 10 },
    { periodLabel: 'Bimestre 2 Mar-Abr 2026', year: 2026, month: 5, firstDay: 12 },
    { periodLabel: 'Bimestre 3 May-Jun 2026', year: 2026, month: 7, firstDay: 10 },
    { periodLabel: 'Bimestre 4 Jul-Ago 2026', year: 2026, month: 9, firstDay: 10 },
    { periodLabel: 'Bimestre 5 Sep-Oct 2026', year: 2026, month: 11, firstDay: 10 },
    { periodLabel: 'Bimestre 6 Nov-Dic 2026', year: 2027, month: 1, firstDay: 13 }
];

// Retencion en la fuente mensual: vence entre el 10 y el 24 del mes siguiente.
const RETEFUENTE_WINDOWS = [
    { periodLabel: 'Enero 2026', year: 2026, month: 2, firstDay: 10 },
    { periodLabel: 'Febrero 2026', year: 2026, month: 3, firstDay: 10 },
    { periodLabel: 'Marzo 2026', year: 2026, month: 4, firstDay: 13 },
    { periodLabel: 'Abril 2026', year: 2026, month: 5, firstDay: 12 },
    { periodLabel: 'Mayo 2026', year: 2026, month: 6, firstDay: 10 },
    { periodLabel: 'Junio 2026', year: 2026, month: 7, firstDay: 10 },
    { periodLabel: 'Julio 2026', year: 2026, month: 8, firstDay: 11 },
    { periodLabel: 'Agosto 2026', year: 2026, month: 9, firstDay: 10 },
    { periodLabel: 'Septiembre 2026', year: 2026, month: 10, firstDay: 13 },
    { periodLabel: 'Octubre 2026', year: 2026, month: 11, firstDay: 10 },
    { periodLabel: 'Noviembre 2026', year: 2026, month: 12, firstDay: 10 },
    { periodLabel: 'Diciembre 2026', year: 2027, month: 1, firstDay: 13 }
];

// ICA bimestral Bogota: vence en ventanas similares a IVA pero distritales.
const ICA_WINDOWS = [
    { periodLabel: 'ICA Bimestre 1 2026', year: 2026, month: 3, firstDay: 17 },
    { periodLabel: 'ICA Bimestre 2 2026', year: 2026, month: 5, firstDay: 19 },
    { periodLabel: 'ICA Bimestre 3 2026', year: 2026, month: 7, firstDay: 17 },
    { periodLabel: 'ICA Bimestre 4 2026', year: 2026, month: 9, firstDay: 17 },
    { periodLabel: 'ICA Bimestre 5 2026', year: 2026, month: 11, firstDay: 17 },
    { periodLabel: 'ICA Bimestre 6 2026', year: 2027, month: 1, firstDay: 20 }
];

// Renta personas juridicas 2025 - dos cuotas (abril y junio 2026 aprox).
// Grandes contribuyentes: primera cuota febrero 2026.
const RENTA_WINDOWS = [
    { periodLabel: 'Renta PJ 2025 - 1a cuota', year: 2026, month: 4, firstDay: 8, desc: 'Primera cuota Renta 2025' },
    { periodLabel: 'Renta PJ 2025 - 2a cuota', year: 2026, month: 6, firstDay: 8, desc: 'Segunda cuota Renta 2025' }
];

// Informacion exogena nacional 2025 - mayo 2026.
const EXOGENA_WINDOW = { periodLabel: 'Informacion Exogena 2025', year: 2026, month: 5, firstDay: 5 };

// Medios magneticos distritales Bogota - junio 2026 aprox.
const MEDIOS_DISTRITALES_WINDOW = { periodLabel: 'Medios Magneticos Distritales 2025', year: 2026, month: 6, firstDay: 15 };

/**
 * Construye el calendario DIAN 2026 para un tenant segun el ultimo digito de su NIT.
 * @param {number|string} lastDigit - 0..9
 * @returns {Array<{tax_type, period_label, due_date, description}>}
 */
const buildDian2026Calendar = (lastDigit) => {
    const d = Number(lastDigit);
    if (Number.isNaN(d) || d < 0 || d > 9) {
        throw new Error(`Ultimo digito de NIT invalido: ${lastDigit}`);
    }

    const events = [];

    for (const w of IVA_WINDOWS) {
        events.push({
            tax_type: 'IVA',
            period_label: w.periodLabel,
            due_date: dueForDigit(w.year, w.month, w.firstDay, d),
            description: `Declaracion bimestral de IVA - Digito NIT ${d}`
        });
    }

    for (const w of RETEFUENTE_WINDOWS) {
        events.push({
            tax_type: 'RETEFUENTE',
            period_label: `Retefuente ${w.periodLabel}`,
            due_date: dueForDigit(w.year, w.month, w.firstDay, d),
            description: `Retencion en la fuente mensual - Digito NIT ${d}`
        });
    }

    for (const w of ICA_WINDOWS) {
        events.push({
            tax_type: 'RETEICA',
            period_label: w.periodLabel,
            due_date: dueForDigit(w.year, w.month, w.firstDay, d),
            description: `ICA bimestral Bogota - Digito NIT ${d}`
        });
    }

    for (const w of RENTA_WINDOWS) {
        events.push({
            tax_type: 'RENTA',
            period_label: w.periodLabel,
            due_date: dueForDigit(w.year, w.month, w.firstDay, d),
            description: `${w.desc} - Digito NIT ${d}`
        });
    }

    events.push({
        tax_type: 'OTRO',
        period_label: EXOGENA_WINDOW.periodLabel,
        due_date: dueForDigit(EXOGENA_WINDOW.year, EXOGENA_WINDOW.month, EXOGENA_WINDOW.firstDay, d),
        description: `Informacion exogena nacional DIAN ano gravable 2025 - Digito NIT ${d}`
    });

    events.push({
        tax_type: 'OTRO',
        period_label: MEDIOS_DISTRITALES_WINDOW.periodLabel,
        due_date: dueForDigit(MEDIOS_DISTRITALES_WINDOW.year, MEDIOS_DISTRITALES_WINDOW.month, MEDIOS_DISTRITALES_WINDOW.firstDay, d),
        description: `Medios magneticos distritales Bogota ano gravable 2025 - Digito NIT ${d}`
    });

    return events;
};

module.exports = { buildDian2026Calendar };
