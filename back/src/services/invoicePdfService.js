const PDFDocument = require('pdfkit');

const fmtMoney = (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const dianStatusLabel = (s) => {
    if (!s) return 'Sin enviar';
    if (s.endsWith('_MOCK')) return `${s.replace('_MOCK', '')} (sandbox)`;
    return s;
};

/**
 * Genera la representación gráfica (PDF) de una factura de venta y la escribe en `res`.
 * @param {object} args
 * @param {object} args.invoice  Fila completa de invoices (incluye campos client_*, totales, cufe, dian_status)
 * @param {Array}  args.items    Filas de invoice_items
 * @param {object} args.tenant   Datos del emisor (name, tax_id, address, phone, email)
 * @param {import('http').ServerResponse} args.res
 */
function streamInvoicePdf({ invoice, items, tenant, res }) {
    const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
    const filename = `factura-${invoice.invoice_number || invoice.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Encabezado emisor
    doc.fontSize(16).font('Helvetica-Bold').text(tenant?.name || 'Emisor', { continued: false });
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica');
    if (tenant?.tax_id) doc.text(`NIT: ${tenant.tax_id}`);
    if (tenant?.address) doc.text(tenant.address);
    if (tenant?.phone) doc.text(`Tel: ${tenant.phone}`);
    if (tenant?.email) doc.text(`Email: ${tenant.email}`);

    // Caja superior derecha con número y fecha
    const boxX = 380, boxY = 40, boxW = 180;
    doc.rect(boxX, boxY, boxW, 70).stroke();
    doc.fontSize(11).font('Helvetica-Bold').text('FACTURA DE VENTA', boxX + 8, boxY + 8, { width: boxW - 16, align: 'center' });
    doc.fontSize(10).font('Helvetica');
    doc.text(`No. ${invoice.invoice_number || invoice.id}`, boxX + 8, boxY + 28, { width: boxW - 16, align: 'center' });
    doc.fontSize(9);
    doc.text(`Fecha: ${fmtDate(invoice.date)}`, boxX + 8, boxY + 46);
    doc.text(`Vence: ${fmtDate(invoice.due_date)}`, boxX + 8, boxY + 58);

    doc.moveTo(40, 130).lineTo(572, 130).stroke();

    // Datos del cliente
    let cursorY = 140;
    doc.fontSize(10).font('Helvetica-Bold').text('Cliente', 40, cursorY);
    cursorY += 14;
    doc.fontSize(9).font('Helvetica');
    doc.text(invoice.client_name || '-', 40, cursorY);
    cursorY += 12;
    if (invoice.client_document_number) {
        doc.text(`${invoice.client_document_type || 'NIT'}: ${invoice.client_document_number}`, 40, cursorY);
        cursorY += 12;
    }
    if (invoice.client_address) { doc.text(invoice.client_address, 40, cursorY); cursorY += 12; }
    const cityLine = [invoice.client_city, invoice.client_department].filter(Boolean).join(', ');
    if (cityLine) { doc.text(cityLine, 40, cursorY); cursorY += 12; }
    if (invoice.client_phone) { doc.text(`Tel: ${invoice.client_phone}`, 40, cursorY); cursorY += 12; }
    if (invoice.client_email) { doc.text(invoice.client_email, 40, cursorY); cursorY += 12; }

    // Tabla de items
    const tableTop = Math.max(cursorY + 10, 230);
    const cols = [
        { label: 'Descripción', x: 40, w: 240 },
        { label: 'Cant.', x: 280, w: 50, align: 'right' },
        { label: 'V. Unit.', x: 330, w: 80, align: 'right' },
        { label: 'IVA %', x: 410, w: 50, align: 'right' },
        { label: 'Total', x: 460, w: 100, align: 'right' },
    ];

    doc.fontSize(9).font('Helvetica-Bold');
    doc.rect(40, tableTop - 4, 532, 18).fill('#eeeeee').stroke();
    doc.fillColor('#000');
    cols.forEach(c => {
        doc.text(c.label, c.x + 4, tableTop, { width: c.w - 8, align: c.align || 'left' });
    });

    let rowY = tableTop + 18;
    doc.font('Helvetica');
    (items || []).forEach((it) => {
        if (rowY > 720) {
            doc.addPage();
            rowY = 40;
        }
        const desc = it.description || '';
        const qty = Number(it.quantity) || 0;
        const unit = Number(it.unit_price) || 0;
        const taxRate = Number(it.tax_rate) || 0;
        const total = Number(it.total) || (qty * unit);
        doc.text(desc, cols[0].x + 4, rowY, { width: cols[0].w - 8 });
        doc.text(String(qty), cols[1].x + 4, rowY, { width: cols[1].w - 8, align: 'right' });
        doc.text(fmtMoney(unit), cols[2].x + 4, rowY, { width: cols[2].w - 8, align: 'right' });
        doc.text(`${taxRate}%`, cols[3].x + 4, rowY, { width: cols[3].w - 8, align: 'right' });
        doc.text(fmtMoney(total), cols[4].x + 4, rowY, { width: cols[4].w - 8, align: 'right' });
        const lines = Math.max(1, Math.ceil(doc.heightOfString(desc, { width: cols[0].w - 8 }) / 11));
        rowY += Math.max(14, lines * 12);
    });

    doc.moveTo(40, rowY + 4).lineTo(572, rowY + 4).stroke();
    rowY += 12;

    // Totales
    const totalsX = 380;
    const totalsW = 192;
    const drawTotal = (label, value, bold = false) => {
        if (rowY > 720) { doc.addPage(); rowY = 40; }
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        doc.text(label, totalsX, rowY, { width: 100, align: 'right' });
        doc.text(`$ ${fmtMoney(value)}`, totalsX + 100, rowY, { width: totalsW - 100, align: 'right' });
        rowY += 14;
    };
    drawTotal('Subtotal:', invoice.subtotal);
    if (Number(invoice.discount) > 0) drawTotal('Descuento:', invoice.discount);
    drawTotal('IVA:', invoice.tax_amount);
    drawTotal('TOTAL:', invoice.total, true);

    if (invoice.paid_amount != null) {
        drawTotal('Pagado:', invoice.paid_amount);
        drawTotal('Saldo:', invoice.balance_amount != null ? invoice.balance_amount : (Number(invoice.total) - Number(invoice.paid_amount)));
    }

    // CUFE / DIAN
    rowY += 8;
    if (rowY > 700) { doc.addPage(); rowY = 40; }
    doc.fontSize(8).font('Helvetica-Bold').text('Estado DIAN:', 40, rowY, { continued: true });
    doc.font('Helvetica').text(`  ${dianStatusLabel(invoice.dian_status)}`);
    rowY += 12;
    if (invoice.cufe) {
        doc.font('Helvetica-Bold').text('CUFE:', 40, rowY);
        rowY += 10;
        doc.font('Helvetica').fontSize(7).text(invoice.cufe, 40, rowY, { width: 532 });
        rowY += 14;
    }

    if (invoice.notes) {
        rowY += 6;
        if (rowY > 700) { doc.addPage(); rowY = 40; }
        doc.fontSize(8).font('Helvetica-Bold').text('Observaciones:', 40, rowY);
        rowY += 10;
        doc.font('Helvetica').text(String(invoice.notes), 40, rowY, { width: 532 });
    }

    doc.end();
}

module.exports = { streamInvoicePdf };
