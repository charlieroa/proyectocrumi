// Helper genérico para exportar reportes a Excel (.xlsx).
// Usa la librería xlsx (ya instalada, también usada por parseBulkUploadFile.ts).
//
// Uso típico:
//   downloadExcelReport(
//     'Balance',
//     ['Código', 'Nombre', 'Débito', 'Crédito', 'Saldo'],
//     rows.map(r => [r.account_code, r.account_name, r.debit, r.credit, r.balance]),
//     'balance_prueba_2026-04.xlsx',
//     { title: 'Balance de prueba', dateRange: '2026-01-01 a 2026-04-16' }
//   );
//
// Importante: pasa los números como `number` (no `string`), así Excel permite SUM().

import * as XLSX from 'xlsx';

export type CellValue = string | number | null | undefined;

export interface ReportMeta {
  title?: string;
  dateRange?: string;
  tenantName?: string;
  extra?: string[];
}

export const downloadExcelReport = (
  sheetName: string,
  headers: string[],
  rows: CellValue[][],
  filename: string,
  meta?: ReportMeta,
): void => {
  const aoa: CellValue[][] = [];

  if (meta) {
    if (meta.title) aoa.push([meta.title]);
    if (meta.tenantName) aoa.push([meta.tenantName]);
    if (meta.dateRange) aoa.push([`Período: ${meta.dateRange}`]);
    if (meta.extra && meta.extra.length > 0) aoa.push(...meta.extra.map(s => [s]));
    // línea en blanco como separador
    aoa.push([]);
  }

  aoa.push(headers);
  rows.forEach(r => aoa.push(r));

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Ancho aproximado por columna basado en el largo del header
  ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 2) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // max 31 chars por hoja
  XLSX.writeFile(wb, filename);
};

// Helper para aplanar una estructura jerárquica (secciones con items) en filas.
// Útil para Balance general, P&G, etc.
export const flattenSectioned = <T>(
  sections: { label: string; items: T[] }[],
  itemToRow: (item: T) => CellValue[],
): CellValue[][] => {
  const out: CellValue[][] = [];
  for (const s of sections) {
    // Fila de sección: primera celda = label, resto vacías
    out.push([s.label]);
    for (const it of s.items) {
      out.push(['', ...itemToRow(it)]);
    }
  }
  return out;
};
