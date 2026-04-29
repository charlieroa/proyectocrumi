// Helper genérico para exportar reportes a PDF (A4 portrait) con diseño contable profesional.
// Incluye cabecera por página, secciones con acento de color, totales y bloque de firmas
// (Contador + Revisor Fiscal) con línea para firma manual y Tarjeta Profesional opcional.
//
// Uso típico:
//   downloadPdfReport(
//     ['Código', 'Nombre', 'Débito', 'Crédito', 'Saldo'],
//     rows,
//     'balance_prueba_2026-04.pdf',
//     {
//       title: 'Balance de prueba',
//       tenantName: 'DIDIMOSOFT S.A.S',
//       tenantTaxId: '900.123.456-7',
//       dateRange: '2026-01-01 a 2026-04-24',
//       signatures: [
//         { role: 'Contador', name: 'Juan Pérez', tpNumber: 'TP 123456-T' },
//         { role: 'Revisor Fiscal', name: 'Ana Gómez', tpNumber: 'TP 654321-T' },
//       ],
//     },
//   );

import { jsPDF } from 'jspdf';
import autoTable, { RowInput, Styles } from 'jspdf-autotable';

export type CellValue = string | number | null | undefined;

export interface PdfSignature {
  role: string;
  name?: string;
  tpNumber?: string;
}

export interface PdfReportMeta {
  title: string;
  tenantName?: string;
  tenantTaxId?: string;
  dateRange?: string;
  subtitle?: string;
  logoDataUrl?: string;
  extra?: string[];
  signatures?: PdfSignature[];
}

export interface PdfSection {
  label: string;
  items: CellValue[][];
  total?: { label: string; value: CellValue };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
}

// ---------- Layout constants (mm) ----------
const PAGE_MARGIN = 15;
const HEADER_HEIGHT = 22;
const FOOTER_HEIGHT = 12;
const SIGNATURE_BLOCK_HEIGHT = 50;
const SIGNATURE_LINE_WIDTH = 50;

// ---------- Color palette (RGB) ----------
const COLORS: Record<string, [number, number, number]> = {
  primary: [54, 95, 145],
  success: [39, 121, 79],
  warning: [194, 124, 14],
  danger: [176, 42, 55],
  info: [38, 116, 158],
  secondary: [107, 114, 128],
};
const TABLE_HEADER_BG: [number, number, number] = [45, 55, 72];
const TABLE_ALT_BG: [number, number, number] = [245, 247, 250];
const MUTED: [number, number, number] = [110, 118, 129];
const HAIRLINE: [number, number, number] = [210, 214, 220];

// ---------- Formatting helpers ----------
const NUMERIC_HEADER_HINTS = [
  'total',
  'valor',
  'monto',
  'débito',
  'debito',
  'crédito',
  'credito',
  'saldo',
  '$',
  'importe',
  'cantidad',
  'subtotal',
];

const isNumericHeader = (header: string): boolean => {
  const h = header.toLowerCase();
  return NUMERIC_HEADER_HINTS.some(k => h.includes(k));
};

const columnHasNumbers = (rows: CellValue[][], colIdx: number): boolean => {
  for (const r of rows) {
    const v = r[colIdx];
    if (typeof v === 'number' && Number.isFinite(v)) return true;
  }
  return false;
};

const detectNumericColumns = (headers: string[], rows: CellValue[][]): boolean[] => {
  return headers.map((h, i) => isNumericHeader(h) || columnHasNumbers(rows, i));
};

const formatColombianCurrency = (n: number): string => {
  const isInt = Number.isInteger(n);
  const abs = Math.abs(n);
  const formatted = isInt
    ? abs.toLocaleString('es-CO', { maximumFractionDigits: 0 })
    : abs.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = n < 0 ? '-' : '';
  return `${sign}$${formatted}`;
};

const formatCell = (v: CellValue, numeric: boolean): string => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    return numeric ? formatColombianCurrency(v) : String(v);
  }
  return String(v);
};

const formatDateTime = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ---------- Header & footer (drawn per page) ----------
const drawHeader = (doc: jsPDF, meta: PdfReportMeta): void => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Left block: tenant
  doc.setTextColor(20, 24, 31);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(meta.tenantName || '', PAGE_MARGIN, PAGE_MARGIN);

  if (meta.tenantTaxId) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(`NIT: ${meta.tenantTaxId}`, PAGE_MARGIN, PAGE_MARGIN + 5);
  }

  // Right block: title + dateRange
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 24, 31);
  doc.text(meta.title, pageWidth - PAGE_MARGIN, PAGE_MARGIN, { align: 'right' });

  if (meta.dateRange) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(meta.dateRange, pageWidth - PAGE_MARGIN, PAGE_MARGIN + 5, { align: 'right' });
  }

  // Hairline
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.2);
  doc.line(PAGE_MARGIN, PAGE_MARGIN + HEADER_HEIGHT - 6, pageWidth - PAGE_MARGIN, PAGE_MARGIN + HEADER_HEIGHT - 6);

  // Reset
  doc.setTextColor(20, 24, 31);
};

const drawFooter = (doc: jsPDF, pageNum: number, totalPages: number): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - PAGE_MARGIN + 2;

  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.2);
  doc.line(PAGE_MARGIN, y - 5, pageWidth - PAGE_MARGIN, y - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Generado: ${formatDateTime(new Date())}`, PAGE_MARGIN, y);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - PAGE_MARGIN, y, { align: 'right' });
  doc.setTextColor(20, 24, 31);
};

const applyHeaderFooterToAllPages = (doc: jsPDF, meta: PdfReportMeta): void => {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawHeader(doc, meta);
    drawFooter(doc, i, total);
  }
};

// ---------- Subtitle / extra lines under the header ----------
const drawSubtitle = (doc: jsPDF, meta: PdfReportMeta, startY: number): number => {
  let y = startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const lines: string[] = [];
  if (meta.subtitle) lines.push(meta.subtitle);
  if (meta.extra && meta.extra.length > 0) lines.push(...meta.extra);
  if (lines.length === 0) return y;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  for (const ln of lines) {
    doc.text(ln, PAGE_MARGIN, y);
    y += 4.2;
  }
  doc.setTextColor(20, 24, 31);
  return y + 2;
};

// ---------- Signature block ----------
const ensureSpaceForSignatures = (doc: jsPDF, currentY: number): number => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - PAGE_MARGIN - FOOTER_HEIGHT;
  const remaining = bottomLimit - currentY;
  if (remaining < SIGNATURE_BLOCK_HEIGHT) {
    doc.addPage();
    return PAGE_MARGIN + HEADER_HEIGHT + 4;
  }
  return currentY + 20; // ~20mm gap before signatures
};

const drawSignatureBlock = (doc: jsPDF, meta: PdfReportMeta, startY: number): void => {
  const sigs: PdfSignature[] =
    meta.signatures && meta.signatures.length > 0
      ? meta.signatures
      : [{ role: 'Contador' }, { role: 'Revisor Fiscal' }];

  const pageWidth = doc.internal.pageSize.getWidth();
  const usable = pageWidth - PAGE_MARGIN * 2;
  const colWidth = usable / sigs.length;
  const lineY = startY + 10;

  sigs.forEach((sig, i) => {
    const centerX = PAGE_MARGIN + colWidth * i + colWidth / 2;
    const lineX1 = centerX - SIGNATURE_LINE_WIDTH / 2;
    const lineX2 = centerX + SIGNATURE_LINE_WIDTH / 2;

    // Signature line
    doc.setDrawColor(80, 88, 99);
    doc.setLineWidth(0.3);
    doc.line(lineX1, lineY, lineX2, lineY);

    // Role (small caps bold 9pt)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 24, 31);
    doc.text(sig.role.toUpperCase(), centerX, lineY + 5, { align: 'center' });

    // Name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(sig.name || '', centerX, lineY + 10, { align: 'center' });

    // Tarjeta profesional
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(sig.tpNumber || '', centerX, lineY + 14.5, { align: 'center' });
    doc.setTextColor(20, 24, 31);
  });
};

// ---------- Grand totals ----------
const drawGrandTotals = (
  doc: jsPDF,
  totals: { label: string; value: CellValue }[],
  startY: number,
): number => {
  if (!totals || totals.length === 0) return startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = startY + 2;

  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2, y, pageWidth - PAGE_MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 24, 31);
  for (const t of totals) {
    const valueStr = typeof t.value === 'number' ? formatColombianCurrency(t.value) : String(t.value ?? '');
    doc.text(`${t.label}:`, pageWidth - PAGE_MARGIN - 50, y, { align: 'right' });
    doc.text(valueStr, pageWidth - PAGE_MARGIN, y, { align: 'right' });
    y += 5.5;
  }
  return y + 2;
};

// ---------- Table rendering helpers ----------
const buildColumnStyles = (
  headers: string[],
  numericCols: boolean[],
): Record<string, Partial<Styles>> => {
  const styles: Record<string, Partial<Styles>> = {};
  headers.forEach((_h, i) => {
    if (numericCols[i]) {
      styles[i] = { halign: 'right' };
    }
  });
  return styles;
};

const formatRowsForTable = (rows: CellValue[][], numericCols: boolean[]): RowInput[] => {
  return rows.map(r =>
    r.map((cell, i) => formatCell(cell, numericCols[i])),
  ) as RowInput[];
};

// Draw a colored accent bar + section label
const drawSectionHeader = (
  doc: jsPDF,
  label: string,
  color: [number, number, number],
  y: number,
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const barX = PAGE_MARGIN;
  const barY = y;
  const barH = 6;

  doc.setFillColor(...color);
  doc.rect(barX, barY, 3, barH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 24, 31);
  doc.text(label, barX + 5, barY + barH - 1.5);

  return barY + barH + 2;
};

// ---------- Public: flat tabular report ----------
export const downloadPdfReport = (
  headers: string[],
  rows: CellValue[][],
  filename: string,
  meta: PdfReportMeta,
): void => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const startY = PAGE_MARGIN + HEADER_HEIGHT + 2;
  const afterSubtitleY = drawSubtitle(doc, meta, startY);

  const numericCols = detectNumericColumns(headers, rows);
  const body = formatRowsForTable(rows, numericCols);
  const columnStyles = buildColumnStyles(headers, numericCols);

  autoTable(doc, {
    head: [headers],
    body,
    startY: afterSubtitleY,
    theme: 'grid',
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: PAGE_MARGIN + HEADER_HEIGHT, bottom: PAGE_MARGIN + FOOTER_HEIGHT },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      lineColor: HAIRLINE,
      lineWidth: 0.1,
      textColor: [20, 24, 31],
    },
    headStyles: {
      fillColor: TABLE_HEADER_BG,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: { fillColor: TABLE_ALT_BG },
    columnStyles,
  });

  // @ts-ignore - autoTable attaches lastAutoTable to doc
  const finalY: number = doc.lastAutoTable?.finalY ?? afterSubtitleY;

  const sigY = ensureSpaceForSignatures(doc, finalY);
  drawSignatureBlock(doc, meta, sigY);

  applyHeaderFooterToAllPages(doc, meta);
  doc.save(filename);
};

// ---------- Public: sectioned report ----------
export const downloadPdfSectionedReport = (
  headers: string[],
  sections: PdfSection[],
  grandTotals: { label: string; value: CellValue }[],
  filename: string,
  meta: PdfReportMeta,
): void => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const startY = PAGE_MARGIN + HEADER_HEIGHT + 2;
  let y = drawSubtitle(doc, meta, startY);

  // Gather all rows to consistently detect numeric columns across the report
  const allRows: CellValue[][] = sections.flatMap(s => s.items);
  const numericCols = detectNumericColumns(headers, allRows);
  const columnStyles = buildColumnStyles(headers, numericCols);

  sections.forEach((section, idx) => {
    const accent = COLORS[section.color || 'primary'];
    y = drawSectionHeader(doc, section.label, accent, y);

    const body = formatRowsForTable(section.items, numericCols);

    // If section has a total, append as a styled footer row
    const foot: RowInput[] | undefined = section.total
      ? [
          headers.map((_h, i) => {
            if (i === 0) return section.total!.label;
            if (i === headers.length - 1) {
              return typeof section.total!.value === 'number'
                ? formatColombianCurrency(section.total!.value)
                : String(section.total!.value ?? '');
            }
            return '';
          }) as RowInput,
        ]
      : undefined;

    autoTable(doc, {
      head: [headers],
      body,
      foot,
      startY: y,
      theme: 'grid',
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: PAGE_MARGIN + HEADER_HEIGHT, bottom: PAGE_MARGIN + FOOTER_HEIGHT },
      styles: {
        fontSize: 9,
        cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
        lineColor: HAIRLINE,
        lineWidth: 0.1,
        textColor: [20, 24, 31],
      },
      headStyles: {
        fillColor: TABLE_HEADER_BG,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      footStyles: {
        fillColor: [235, 239, 245],
        textColor: [20, 24, 31],
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles: { fillColor: TABLE_ALT_BG },
      columnStyles,
    });

    // @ts-ignore - autoTable attaches lastAutoTable to doc
    y = (doc.lastAutoTable?.finalY ?? y) + (idx < sections.length - 1 ? 6 : 4);
  });

  y = drawGrandTotals(doc, grandTotals, y);

  const sigY = ensureSpaceForSignatures(doc, y);
  drawSignatureBlock(doc, meta, sigY);

  applyHeaderFooterToAllPages(doc, meta);
  doc.save(filename);
};
