// Helper compartido para parsear archivos de carga masiva. Soporta CSV
// (via PapaParse) y Excel .xlsx / .xls (via SheetJS). Devuelve siempre un
// arreglo de objetos con claves string normalizadas.
//
// Uso:
//   const rows = await parseBulkUploadFile(file);
//   // rows: Array<Record<string, string>>
//
// Las claves se mantienen tal cual vienen en el header de la primera fila.
// Valores se castean a string y se hace .trim() básico en el helper
// consumidor.

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type BulkRow = Record<string, string>;

const isExcel = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls');
};

const isCsv = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return name.endsWith('.csv') || name.endsWith('.txt');
};

const parseExcel = (file: File): Promise<BulkRow[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buf, { type: 'array' });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) {
          reject(new Error('El archivo Excel no tiene hojas.'));
          return;
        }
        const ws = wb.Sheets[firstSheet];
        // defval: '' fuerza celdas vacías a string vacío (no undefined)
        // raw: false convierte números/fechas a su forma string formateada
        const rows = XLSX.utils.sheet_to_json<BulkRow>(ws, { defval: '', raw: false });
        // Normalizar: todo a string
        const normalized = rows.map((row) => {
          const out: BulkRow = {};
          Object.entries(row).forEach(([k, v]) => {
            out[k] = v === null || v === undefined ? '' : String(v);
          });
          return out;
        });
        resolve(normalized);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });

const parseCsv = (file: File): Promise<BulkRow[]> =>
  new Promise((resolve, reject) => {
    Papa.parse<BulkRow>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new Error(`Error leyendo CSV: ${result.errors[0].message}`));
          return;
        }
        const normalized = (result.data || []).map((row) => {
          const out: BulkRow = {};
          Object.entries(row).forEach(([k, v]) => {
            out[k] = v === null || v === undefined ? '' : String(v);
          });
          return out;
        });
        resolve(normalized);
      },
      error: (err) => reject(err instanceof Error ? err : new Error(String(err))),
    });
  });

export const parseBulkUploadFile = async (file: File): Promise<BulkRow[]> => {
  if (isExcel(file)) return parseExcel(file);
  if (isCsv(file)) return parseCsv(file);
  throw new Error('Formato no soportado. Usa .xlsx, .xls o .csv.');
};

// Descarga una plantilla Excel con los headers dados y una fila de ejemplo opcional.
export const downloadExcelTemplate = (
  headers: string[],
  exampleRows: string[][] = [],
  filename = 'plantilla.xlsx',
): void => {
  const aoa = [headers, ...exampleRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  XLSX.writeFile(wb, filename);
};

// Descarga una plantilla CSV.
export const downloadCsvTemplate = (
  headers: string[],
  exampleRows: string[][] = [],
  filename = 'plantilla.csv',
): void => {
  const csv = [headers.join(','), ...exampleRows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
