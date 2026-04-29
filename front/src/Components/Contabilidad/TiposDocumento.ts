// Helper reutilizable para gestionar "tipos de documento" (FC, DSA, FV, NC, etc.)
// Persistencia en localStorage bajo la key TIPOS_LS_KEY (no requiere backend).
// Usado por el selector en Compras y por la sección de gestión en
// ContabilidadMaestraConfig / AccountingMasterSection.

export type TipoDocumentoApplies = 'compra' | 'venta' | 'ambos';

export type TipoDocumento = {
  code: string; // FC, DSA, FV, NC, ND, RC, CE, etc.
  name: string; // "Factura de compra"
  applies: TipoDocumentoApplies;
};

export const TIPOS_DOCUMENTO_SEED: TipoDocumento[] = [
  { code: 'FC', name: 'Factura de compra', applies: 'compra' },
  { code: 'DSA', name: 'Documento soporte (DSA)', applies: 'compra' },
  { code: 'FV', name: 'Factura de venta', applies: 'venta' },
  { code: 'NC', name: 'Nota crédito', applies: 'ambos' },
  { code: 'ND', name: 'Nota débito', applies: 'ambos' },
  { code: 'RC', name: 'Recibo de caja', applies: 'venta' },
  { code: 'CE', name: 'Comprobante de egreso', applies: 'compra' },
];

export const TIPOS_LS_KEY = 'bolti_tipos_documento_v1';

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeCode = (code: string) =>
  (code || '').toString().trim().toUpperCase();

const sanitizeTipo = (raw: any): TipoDocumento | null => {
  if (!raw || typeof raw !== 'object') return null;
  const code = normalizeCode(raw.code);
  const name = (raw.name || '').toString().trim();
  const appliesRaw = (raw.applies || '').toString().trim().toLowerCase();
  if (!code || !name) return null;
  const applies: TipoDocumentoApplies =
    appliesRaw === 'compra' || appliesRaw === 'venta' || appliesRaw === 'ambos'
      ? (appliesRaw as TipoDocumentoApplies)
      : 'ambos';
  return { code, name, applies };
};

export function loadTipos(): TipoDocumento[] {
  if (!isBrowser()) return [...TIPOS_DOCUMENTO_SEED];
  try {
    const raw = window.localStorage.getItem(TIPOS_LS_KEY);
    if (!raw) return [...TIPOS_DOCUMENTO_SEED];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...TIPOS_DOCUMENTO_SEED];
    const cleaned = parsed
      .map(sanitizeTipo)
      .filter((t): t is TipoDocumento => t !== null);
    // Dedup por code (primero gana)
    const seen = new Set<string>();
    const out: TipoDocumento[] = [];
    for (const t of cleaned) {
      if (seen.has(t.code)) continue;
      seen.add(t.code);
      out.push(t);
    }
    return out.length > 0 ? out : [...TIPOS_DOCUMENTO_SEED];
  } catch {
    return [...TIPOS_DOCUMENTO_SEED];
  }
}

export function saveTipos(list: TipoDocumento[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(TIPOS_LS_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}

export function addTipo(t: TipoDocumento): TipoDocumento[] {
  const clean = sanitizeTipo(t);
  if (!clean) return loadTipos();
  const list = loadTipos();
  const idx = list.findIndex((x) => x.code === clean.code);
  const next = idx >= 0
    ? list.map((x, i) => (i === idx ? clean : x))
    : [...list, clean];
  saveTipos(next);
  return next;
}

export function removeTipo(code: string): TipoDocumento[] {
  const c = normalizeCode(code);
  const next = loadTipos().filter((x) => x.code !== c);
  saveTipos(next);
  return next;
}

export function filterTipos(
  list: TipoDocumento[],
  filter: TipoDocumentoApplies,
): TipoDocumento[] {
  if (filter === 'ambos') return list;
  // Para 'compra' mostramos los de compra + ambos. Ídem inverso para 'venta'.
  return list.filter((t) => t.applies === filter || t.applies === 'ambos');
}
