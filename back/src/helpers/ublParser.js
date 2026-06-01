'use strict';

/**
 * ublParser.js
 * ---------------------------------------------------------------------------
 * Parser de facturas electrónicas UBL 2.1 de la DIAN (Colombia).
 *
 * Soporta los tres tipos de documento tributario electrónico:
 *   - Invoice     (Factura de Venta)        -> documentKind: 'INVOICE'
 *   - CreditNote  (Nota Crédito)            -> documentKind: 'CREDIT_NOTE'
 *   - DebitNote   (Nota Débito)             -> documentKind: 'DEBIT_NOTE'
 *
 * También maneja el envoltorio AttachedDocument: la DIAN normalmente entrega
 * un <AttachedDocument> que contiene el XML real de la factura embebido como
 * CDATA dentro de cac:Attachment > cac:ExternalReference > cbc:Description.
 * En ese caso se extrae el CDATA y se reparsea recursivamente.
 *
 * Y abre ZIPs (.zip) extrayendo todos los .xml que contengan.
 *
 * CONTRATO PÚBLICO (NO cambiar firmas ni shape — otros módulos dependen):
 *
 *   async extractXmlDocuments(buffer, filename) -> Promise<string[]>
 *       Devuelve un array de strings XML. Si el archivo es .zip (o el buffer
 *       luce como ZIP) devuelve el contenido de todos los .xml internos.
 *       Si es .xml devuelve [contenido]. Decodifica como UTF-8 y quita BOM.
 *
 *   parseUbl(xmlString) -> objeto contable con este shape EXACTO:
 *   {
 *     documentKind: 'INVOICE'|'CREDIT_NOTE'|'DEBIT_NOTE'|'UNKNOWN',
 *     cufe: string|null,            // cbc:UUID (CUFE/CUDE)
 *     documentNumber: string|null,  // cbc:ID del documento
 *     issueDate: string|null,       // 'YYYY-MM-DD'
 *     dueDate: string|null,         // 'YYYY-MM-DD' o null
 *     currency: string,             // ej 'COP' (default 'COP')
 *     supplier: { name, nit, dv, fiscalRegime, email, address },
 *     customer: { name, nit, dv, email },
 *     lines: [ { lineNo, description, quantity, unitPrice,
 *                lineExtensionAmount, ivaPct, ivaAmount } ],
 *     taxes: { ivaAmount, ivaBase },
 *     withholdings: { reteFuenteAmount, reteIvaAmount, reteIcaAmount },
 *     totals: { lineExtensionAmount, taxExclusiveAmount,
 *               taxInclusiveAmount, payableAmount }
 *   }
 *
 * Notas de robustez: nunca lanza por campo faltante (usa null/0/[]). Si el XML
 * no parsea o no es UBL reconocible devuelve documentKind:'UNKNOWN'.
 *
 * Notas de namespaces: el XML usa prefijos cbc:/cac:. Con @xmldom/xmldom
 * getElementsByTagName('cbc:UUID') funciona con el prefijo literal porque
 * xmldom no resuelve namespaces por defecto. Las búsquedas dentro de una línea
 * se hacen sobre el nodo de la línea para no capturar nodos de otras líneas.
 * ---------------------------------------------------------------------------
 */

const { DOMParser } = require('@xmldom/xmldom');
const JSZip = require('jszip');

// --------------------------------------------------------------------------
// Helpers de bajo nivel
// --------------------------------------------------------------------------

/** Convierte cualquier cosa a número: Number(String(x).trim()) || 0 */
function num(x) {
  if (x === null || x === undefined) return 0;
  return Number(String(x).trim()) || 0;
}

/** Quita BOM y decodifica un Buffer como UTF-8. Acepta también strings. */
function bufferToUtf8(buffer) {
  if (buffer == null) return '';
  let str;
  if (Buffer.isBuffer(buffer)) {
    str = buffer.toString('utf8');
  } else if (typeof buffer === 'string') {
    str = buffer;
  } else if (buffer instanceof Uint8Array) {
    str = Buffer.from(buffer).toString('utf8');
  } else {
    str = String(buffer);
  }
  // Quitar BOM UTF-8 (﻿) si quedó al inicio.
  if (str.charCodeAt(0) === 0xfeff) str = str.slice(1);
  return str;
}

/**
 * Devuelve el textContent (trim) del PRIMER descendiente con ese tagName.
 * Si root es null o no hay coincidencia, devuelve null.
 */
function getText(root, tagName) {
  if (!root || typeof root.getElementsByTagName !== 'function') return null;
  const els = root.getElementsByTagName(tagName);
  if (!els || els.length === 0) return null;
  const txt = els[0].textContent;
  if (txt == null) return null;
  const trimmed = txt.trim();
  return trimmed === '' ? null : trimmed;
}

/** Devuelve el primer elemento descendiente con ese tagName, o null. */
function getEl(root, tagName) {
  if (!root || typeof root.getElementsByTagName !== 'function') return null;
  const els = root.getElementsByTagName(tagName);
  return els && els.length ? els[0] : null;
}

/** Devuelve un array (no live) con todos los descendientes con ese tagName. */
function getEls(root, tagName) {
  if (!root || typeof root.getElementsByTagName !== 'function') return [];
  const els = root.getElementsByTagName(tagName);
  const out = [];
  for (let i = 0; i < els.length; i++) out.push(els[i]);
  return out;
}

/** Atributo de un elemento (null si no existe). */
function getAttr(el, attr) {
  if (!el || typeof el.getAttribute !== 'function') return null;
  const v = el.getAttribute(attr);
  return v == null || v === '' ? null : v;
}

/** Recorta una fecha ISO a 'YYYY-MM-DD' (primeros 10 chars) o null. */
function isoDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (s.length < 10) return null;
  return s.slice(0, 10);
}

// --------------------------------------------------------------------------
// extractXmlDocuments
// --------------------------------------------------------------------------

/** Heurística: ¿el buffer empieza con la firma ZIP "PK\x03\x04"? */
function looksLikeZip(buffer) {
  if (!Buffer.isBuffer(buffer)) return false;
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 && // P
    buffer[1] === 0x4b && // K
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  );
}

/**
 * Extrae uno o varios XML de un buffer.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<string[]>}
 */
async function extractXmlDocuments(buffer, filename) {
  const name = (filename || '').toLowerCase();
  const isZipByName = name.endsWith('.zip');
  const buf = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer || '', typeof buffer === 'string' ? 'utf8' : undefined);

  if (isZipByName || looksLikeZip(buf)) {
    try {
      const zip = await JSZip.loadAsync(buf);
      const out = [];
      const entries = Object.keys(zip.files);
      for (const entryName of entries) {
        const file = zip.files[entryName];
        if (!file || file.dir) continue;
        if (!entryName.toLowerCase().endsWith('.xml')) continue;
        // Leer como nodebuffer para controlar la decodificación UTF-8 + BOM.
        const content = await file.async('nodebuffer');
        out.push(bufferToUtf8(content));
      }
      return out;
    } catch (err) {
      // Si falla la apertura del ZIP, intentar tratarlo como XML plano.
      const asText = bufferToUtf8(buf);
      return asText ? [asText] : [];
    }
  }

  // Caso .xml (o cualquier otra cosa): devolver el contenido como string.
  const text = bufferToUtf8(buf);
  return text ? [text] : [];
}

// --------------------------------------------------------------------------
// parseUbl
// --------------------------------------------------------------------------

/** Objeto vacío conforme al contrato, usado para casos UNKNOWN / error. */
function emptyResult() {
  return {
    documentKind: 'UNKNOWN',
    cufe: null,
    documentNumber: null,
    issueDate: null,
    dueDate: null,
    currency: null,
    supplier: { name: null, nit: null, dv: null, fiscalRegime: null, email: null, address: null },
    customer: { name: null, nit: null, dv: null, email: null },
    lines: [],
    taxes: { ivaAmount: 0, ivaBase: 0 },
    withholdings: { reteFuenteAmount: 0, reteIvaAmount: 0, reteIcaAmount: 0 },
    totals: { lineExtensionAmount: 0, taxExclusiveAmount: 0, taxInclusiveAmount: 0, payableAmount: 0 },
  };
}

/** Determina el tipo de documento a partir del localName del root. */
function kindFromRoot(localName) {
  switch (localName) {
    case 'Invoice':
      return 'INVOICE';
    case 'CreditNote':
      return 'CREDIT_NOTE';
    case 'DebitNote':
      return 'DEBIT_NOTE';
    default:
      return 'UNKNOWN';
  }
}

/** localName del elemento (sin prefijo de namespace). */
function localNameOf(el) {
  if (!el) return '';
  if (el.localName) return el.localName;
  const tn = el.tagName || el.nodeName || '';
  const idx = tn.indexOf(':');
  return idx >= 0 ? tn.slice(idx + 1) : tn;
}

/**
 * Extrae los datos de un tercero (Party) hacia el shape pedido.
 * @param {Element} partyEl  nodo cac:Party (o null)
 * @param {boolean} full     si true incluye fiscalRegime/address (proveedor)
 */
function parseParty(partyEl, full) {
  const base = full
    ? { name: null, nit: null, dv: null, fiscalRegime: null, email: null, address: null }
    : { name: null, nit: null, dv: null, email: null };

  if (!partyEl) return base;

  const taxScheme = getEl(partyEl, 'cac:PartyTaxScheme');

  // NIT: preferir CompanyID dentro de PartyTaxScheme; si no, PartyIdentification > ID.
  let companyIdEl = null;
  if (taxScheme) companyIdEl = getEl(taxScheme, 'cbc:CompanyID');
  if (!companyIdEl) {
    const idn = getEl(partyEl, 'cac:PartyIdentification');
    if (idn) companyIdEl = getEl(idn, 'cbc:ID');
  }
  if (companyIdEl) {
    const idTxt = companyIdEl.textContent ? companyIdEl.textContent.trim() : '';
    base.nit = idTxt === '' ? null : idTxt;
    base.dv = getAttr(companyIdEl, 'schemeID');
  }

  // Nombre: PartyName > Name, si no RegistrationName del tax scheme,
  // si no PartyLegalEntity > RegistrationName.
  const partyName = getEl(partyEl, 'cac:PartyName');
  let name = partyName ? getText(partyName, 'cbc:Name') : null;
  if (!name && taxScheme) name = getText(taxScheme, 'cbc:RegistrationName');
  if (!name) {
    const legal = getEl(partyEl, 'cac:PartyLegalEntity');
    if (legal) name = getText(legal, 'cbc:RegistrationName');
  }
  base.name = name || null;

  // Email: Contact > ElectronicMail.
  const contact = getEl(partyEl, 'cac:Contact');
  base.email = contact ? getText(contact, 'cbc:ElectronicMail') : null;

  if (full) {
    // Régimen fiscal: TaxLevelCode (ej 'O-13', 'R-99-PN') o el ID del TaxScheme.
    let regime = taxScheme ? getText(taxScheme, 'cbc:TaxLevelCode') : null;
    if (!regime && taxScheme) {
      const ts = getEl(taxScheme, 'cac:TaxScheme');
      if (ts) regime = getText(ts, 'cbc:Name') || getText(ts, 'cbc:ID');
    }
    if (!regime) regime = getText(partyEl, 'cbc:TaxLevelCode');
    base.fiscalRegime = regime || null;

    // Dirección: PhysicalLocation > Address, o RegistrationAddress del tax scheme.
    let addrEl = null;
    const physical = getEl(partyEl, 'cac:PhysicalLocation');
    if (physical) addrEl = getEl(physical, 'cac:Address');
    if (!addrEl && taxScheme) addrEl = getEl(taxScheme, 'cac:RegistrationAddress');
    if (!addrEl) addrEl = getEl(partyEl, 'cac:RegistrationAddress');
    if (!addrEl) addrEl = getEl(partyEl, 'cac:Address');
    base.address = buildAddress(addrEl);
  }

  return base;
}

/** Concatena las partes legibles de un cac:Address en una sola línea. */
function buildAddress(addrEl) {
  if (!addrEl) return null;
  const parts = [];
  // Línea de calle (AddressLine > Line).
  const addrLine = getEl(addrEl, 'cac:AddressLine');
  const line = addrLine ? getText(addrLine, 'cbc:Line') : null;
  if (line) parts.push(line);
  const city = getText(addrEl, 'cbc:CityName');
  if (city) parts.push(city);
  const dept = getText(addrEl, 'cbc:CountrySubentity');
  if (dept) parts.push(dept);
  const out = parts.join(', ').trim();
  return out === '' ? null : out;
}

/**
 * Extrae el IVA (esquema '01') de un contenedor con cac:TaxTotal.
 * Devuelve { ivaAmount, ivaBase, ivaPct } sumando subtotales de IVA.
 */
function extractIvaFrom(containerEl) {
  const res = { ivaAmount: 0, ivaBase: 0, ivaPct: 0 };
  if (!containerEl) return res;

  const taxTotals = getEls(containerEl, 'cac:TaxTotal');
  let pctSeen = false;
  for (const tt of taxTotals) {
    const subtotals = getEls(tt, 'cac:TaxSubtotal');
    if (subtotals.length === 0) {
      // TaxTotal sin subtotales: no podemos saber el esquema con certeza.
      continue;
    }
    for (const st of subtotals) {
      const cat = getEl(st, 'cac:TaxCategory');
      const scheme = cat ? getEl(cat, 'cac:TaxScheme') : getEl(st, 'cac:TaxScheme');
      const schemeId = scheme ? getText(scheme, 'cbc:ID') : null;
      // '01' = IVA en la DIAN.
      if (schemeId === '01') {
        res.ivaAmount += num(getText(st, 'cbc:TaxAmount'));
        res.ivaBase += num(getText(st, 'cbc:TaxableAmount'));
        const pct = getText(st, 'cbc:Percent') || (cat ? getText(cat, 'cbc:Percent') : null);
        if (pct != null && !pctSeen) {
          res.ivaPct = num(pct);
          pctSeen = true;
        }
      }
    }
  }
  return res;
}

/**
 * Extrae las retenciones de cabecera desde cac:WithholdingTaxTotal.
 * Esquemas DIAN: '06' ReteFuente(Renta), '05' ReteIVA, '07' ReteICA.
 */
function extractWithholdings(rootEl) {
  const res = { reteFuenteAmount: 0, reteIvaAmount: 0, reteIcaAmount: 0 };
  if (!rootEl) return res;

  // Solo los WithholdingTaxTotal directos del documento (cabecera). Los hijos
  // de línea, si existieran, también caen aquí; pero en UBL DIAN las
  // retenciones se reportan a nivel cabecera, así que sumamos todos.
  const wtts = getEls(rootEl, 'cac:WithholdingTaxTotal');
  for (const wtt of wtts) {
    const subtotals = getEls(wtt, 'cac:TaxSubtotal');
    if (subtotals.length === 0) continue;
    for (const st of subtotals) {
      const cat = getEl(st, 'cac:TaxCategory');
      const scheme = cat ? getEl(cat, 'cac:TaxScheme') : getEl(st, 'cac:TaxScheme');
      const schemeId = scheme ? getText(scheme, 'cbc:ID') : null;
      const amount = num(getText(st, 'cbc:TaxAmount'));
      switch (schemeId) {
        case '06':
          res.reteFuenteAmount += amount;
          break;
        case '05':
          res.reteIvaAmount += amount;
          break;
        case '07':
          res.reteIcaAmount += amount;
          break;
        default:
          break;
      }
    }
  }
  return res;
}

/** Parsea una línea (InvoiceLine / CreditNoteLine / DebitNoteLine). */
function parseLine(lineEl, lineNo, qtyTag) {
  const description =
    (function () {
      const item = getEl(lineEl, 'cac:Item');
      const d = item ? getText(item, 'cbc:Description') : null;
      return d || getText(lineEl, 'cbc:Description') || '';
    })();

  const quantity = num(getText(lineEl, qtyTag));
  const lineExtensionAmount = num(getText(lineEl, 'cbc:LineExtensionAmount'));

  const priceEl = getEl(lineEl, 'cac:Price');
  let unitPrice = priceEl ? num(getText(priceEl, 'cbc:PriceAmount')) : 0;
  // Fallback: si no hay PriceAmount y hay cantidad, derivar de la base.
  if (!unitPrice && quantity) unitPrice = lineExtensionAmount / quantity;

  const iva = extractIvaFrom(lineEl);

  return {
    lineNo,
    description,
    quantity,
    unitPrice,
    lineExtensionAmount,
    ivaPct: iva.ivaPct,
    ivaAmount: iva.ivaAmount,
  };
}

/** Extrae los totales desde LegalMonetaryTotal o RequestedMonetaryTotal. */
function extractTotals(rootEl) {
  const out = { lineExtensionAmount: 0, taxExclusiveAmount: 0, taxInclusiveAmount: 0, payableAmount: 0 };
  if (!rootEl) return out;
  const mon = getEl(rootEl, 'cac:LegalMonetaryTotal') || getEl(rootEl, 'cac:RequestedMonetaryTotal');
  if (!mon) return out;
  out.lineExtensionAmount = num(getText(mon, 'cbc:LineExtensionAmount'));
  out.taxExclusiveAmount = num(getText(mon, 'cbc:TaxExclusiveAmount'));
  out.taxInclusiveAmount = num(getText(mon, 'cbc:TaxInclusiveAmount'));
  out.payableAmount = num(getText(mon, 'cbc:PayableAmount'));
  return out;
}

/**
 * Parsea un string XML UBL y devuelve el objeto contable (ver contrato arriba).
 * @param {string} xmlString
 */
function parseUbl(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') return emptyResult();

  // Quitar BOM por si llega en string.
  let xml = xmlString;
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);

  let doc;
  try {
    // Silenciar el handler de errores para no romper por warnings de namespace.
    const parser = new DOMParser({
      errorHandler: { warning: function () {}, error: function () {}, fatalError: function () {} },
    });
    doc = parser.parseFromString(xml, 'text/xml');
  } catch (err) {
    return emptyResult();
  }
  if (!doc || !doc.documentElement) return emptyResult();

  const rootName = localNameOf(doc.documentElement);

  // --- Caso AttachedDocument: el XML real está embebido como CDATA. ---
  if (rootName === 'AttachedDocument') {
    const attachment = getEl(doc.documentElement, 'cac:Attachment');
    let embedded = null;
    if (attachment) {
      const extRef = getEl(attachment, 'cac:ExternalReference');
      const descEl = extRef ? getEl(extRef, 'cbc:Description') : null;
      if (descEl && descEl.textContent) {
        embedded = descEl.textContent.trim();
      }
    }
    if (embedded) {
      // Reparsear recursivamente el documento embebido (Invoice/CreditNote/DebitNote).
      return parseUbl(embedded);
    }
    // AttachedDocument sin contenido embebido reconocible.
    return emptyResult();
  }

  const documentKind = kindFromRoot(rootName);
  if (documentKind === 'UNKNOWN') {
    const res = emptyResult();
    return res;
  }

  const root = doc.documentElement;
  const result = emptyResult();
  result.documentKind = documentKind;

  // --- Cabecera ---
  result.cufe = getText(root, 'cbc:UUID');
  result.documentNumber = getText(root, 'cbc:ID');
  result.issueDate = isoDate(getText(root, 'cbc:IssueDate'));

  // dueDate: cbc:DueDate o, dentro de cac:PaymentMeans, cbc:PaymentDueDate.
  let due = getText(root, 'cbc:DueDate');
  if (!due) {
    const pm = getEl(root, 'cac:PaymentMeans');
    if (pm) due = getText(pm, 'cbc:PaymentDueDate');
  }
  if (!due) due = getText(root, 'cbc:PaymentDueDate');
  result.dueDate = isoDate(due);

  result.currency = getText(root, 'cbc:DocumentCurrencyCode') || 'COP';

  // --- Terceros ---
  const supplierParty = (function () {
    const wrap = getEl(root, 'cac:AccountingSupplierParty');
    return wrap ? getEl(wrap, 'cac:Party') : null;
  })();
  const customerParty = (function () {
    const wrap = getEl(root, 'cac:AccountingCustomerParty');
    return wrap ? getEl(wrap, 'cac:Party') : null;
  })();
  result.supplier = parseParty(supplierParty, true);
  result.customer = parseParty(customerParty, false);

  // --- Líneas ---
  let lineTag = 'cac:InvoiceLine';
  let qtyTag = 'cbc:InvoicedQuantity';
  if (documentKind === 'CREDIT_NOTE') {
    lineTag = 'cac:CreditNoteLine';
    qtyTag = 'cbc:CreditedQuantity';
  } else if (documentKind === 'DEBIT_NOTE') {
    lineTag = 'cac:DebitNoteLine';
    qtyTag = 'cbc:DebitedQuantity';
  }
  const lineEls = getEls(root, lineTag);
  result.lines = lineEls.map((el, i) => parseLine(el, i + 1, qtyTag));

  // --- IVA de cabecera ---
  // Importante: extraer SOLO los cac:TaxTotal directos del documento, no los
  // de las líneas. Recorremos los hijos del root buscando TaxTotal de cabecera.
  // Recolectar TaxTotal de cabecera (hijos directos del root).
  const headerTaxTotals = [];
  if (root.childNodes) {
    for (let i = 0; i < root.childNodes.length; i++) {
      const child = root.childNodes[i];
      if (child.nodeType === 1 && localNameOf(child) === 'TaxTotal') {
        headerTaxTotals.push(child);
      }
    }
  }
  let ivaAmount = 0;
  let ivaBase = 0;
  if (headerTaxTotals.length > 0) {
    for (const tt of headerTaxTotals) {
      // Reutilizamos extractIvaFrom envolviendo cada TaxTotal: como TaxTotal
      // contiene los TaxSubtotal, le pasamos un contenedor virtual con este nodo.
      const iva = extractIvaFromTaxTotalNode(tt);
      ivaAmount += iva.ivaAmount;
      ivaBase += iva.ivaBase;
    }
  } else {
    // Fallback: si no hay TaxTotal directos, usar todos los del documento.
    const iva = extractIvaFrom(root);
    ivaAmount = iva.ivaAmount;
    ivaBase = iva.ivaBase;
  }
  result.taxes = { ivaAmount, ivaBase };

  // --- Retenciones de cabecera ---
  result.withholdings = extractWithholdings(root);

  // --- Totales ---
  result.totals = extractTotals(root);

  return result;
}

/** Extrae IVA ('01') de un único nodo cac:TaxTotal. */
function extractIvaFromTaxTotalNode(taxTotalEl) {
  const res = { ivaAmount: 0, ivaBase: 0, ivaPct: 0 };
  if (!taxTotalEl) return res;
  const subtotals = getEls(taxTotalEl, 'cac:TaxSubtotal');
  for (const st of subtotals) {
    const cat = getEl(st, 'cac:TaxCategory');
    const scheme = cat ? getEl(cat, 'cac:TaxScheme') : getEl(st, 'cac:TaxScheme');
    const schemeId = scheme ? getText(scheme, 'cbc:ID') : null;
    if (schemeId === '01') {
      res.ivaAmount += num(getText(st, 'cbc:TaxAmount'));
      res.ivaBase += num(getText(st, 'cbc:TaxableAmount'));
    }
  }
  return res;
}

module.exports = {
  extractXmlDocuments,
  parseUbl,
};
