import { api } from './api';

type CrumiHandledAction = {
  handled: true;
  content: string;
};

type CrumiUnhandledAction = {
  handled: false;
};

type CrumiActionResult = CrumiHandledAction | CrumiUnhandledAction;

type IntentType =
  | 'dashboard'
  | 'trial_balance'
  | 'balance_sheet'
  | 'income_statement'
  | 'accounts_receivable'
  | 'accounts_payable'
  | 'tax_summary'
  | 'third_parties'
  | 'create_third_party'
  | 'sync_third_parties'
  | 'create_accounts_payable'
  | 'create_invoice'
  | 'register_payment'
  | 'create_manual_voucher'
  | 'third_party_ledger'
  | 'payroll_status'
  | 'guided_document';

type Intent = {
  type: IntentType;
  year?: number;
  month?: number;
  thirdParty?: string;
  documentType?: string;
  thirdPartyKind?: string;
  email?: string;
  documentNumber?: string;
  name?: string;
  amount?: number;
  expenseAccountCode?: string;
  paymentMethod?: string;
  invoiceNumber?: string;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  tax?: number;
  subtotalAmount?: number;
  withholdingSourceAmount?: number;
  withholdingIcaAmount?: number;
  withholdingVatAmount?: number;
  debitAccountCode?: string;
  creditAccountCode?: string;
  description?: string;
};

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const MONTH_NAMES = [
  '',
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const CURRENCY = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const formatMoney = (value: unknown): string => {
  const amount = Number(value || 0);
  return CURRENCY.format(Number.isFinite(amount) ? amount : 0);
};

const formatDate = (value?: string | null): string => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-CO');
};

const normalizeText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const extractPeriod = (text: string): Pick<Intent, 'year' | 'month'> => {
  const normalized = normalizeText(text);
  let month: number | undefined;
  let year: number | undefined;

  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (yearMatch) year = Number(yearMatch[1]);

  for (const [monthName, monthNumber] of Object.entries(MONTHS)) {
    if (normalized.includes(monthName)) {
      month = monthNumber;
      break;
    }
  }

  return { year, month };
};

const extractThirdParty = (text: string): string | undefined => {
  const normalized = normalizeText(text);
  const patterns = [
    /(?:cliente|tercero|proveedor)\s+([a-z0-9 .-]+)/i,
    /de\s+([a-z0-9 .-]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      if (value.length >= 3) return value;
    }
  }

  return undefined;
};

const detectIntent = (text: string): Intent | null => {
  const normalized = normalizeText(text);
  const period = extractPeriod(text);
  const amountMatch = normalized.match(/(?:monto|valor|total)\s*[:#-]?\s*([\d.,]+)/i);
  const parsedAmount = amountMatch?.[1]
    ? Number(amountMatch[1].replace(/\./g, '').replace(',', '.'))
    : undefined;

  if (/(sincroniza|sincronizar|actualiza|actualizar).*(terceros|maestro de terceros)/.test(normalized)) {
    return { type: 'sync_third_parties' };
  }

  if (/(crea|crear|registra|registrar).*(comprobante|ajuste contable|voucher)/.test(normalized)) {
    const debitMatch = normalized.match(/(?:debito|debitar|debe)\s*[:#-]?\s*(\d{4,10})/i);
    const creditMatch = normalized.match(/(?:credito|creditar|haber)\s*[:#-]?\s*(\d{4,10})/i);
    const descMatch = text.match(/(?:descripcion|concepto)\s*[:#-]?\s*([^\n]+)/i);
    return {
      type: 'create_manual_voucher',
      amount: parsedAmount,
      debitAccountCode: debitMatch?.[1],
      creditAccountCode: creditMatch?.[1],
      description: descMatch?.[1]?.trim(),
    };
  }

  if (/(registra|registrar|crear|crea).*(pago|recibo de pago|abono)/.test(normalized)) {
    const invoiceMatch = normalized.match(/(?:factura|invoice)\s*[:#-]?\s*([a-z0-9.-]+)/i);
    const clientMatch = text.match(/(?:cliente|a nombre de)\s*[:#-]?\s*([^\n,]+)/i);
    const paymentMethodMatch = normalized.match(/(?:metodo|medio|forma de pago)\s*[:#-]?\s*([a-z]+)/i);
    return {
      type: 'register_payment',
      invoiceNumber: invoiceMatch?.[1],
      name: clientMatch?.[1]?.trim(),
      amount: parsedAmount,
      paymentMethod: paymentMethodMatch?.[1] || 'transferencia',
    };
  }

  if (/(crea|crear|genera|generar|emite|emitir).*(factura|factura de venta)/.test(normalized)) {
    const clientMatch = text.match(/(?:cliente|a nombre de)\s*[:#-]?\s*([^\n,]+)/i);
    const docMatch = normalized.match(/(?:nit|cedula|documento)\s*[:#-]?\s*([a-z0-9.-]+)/i);
    const itemMatch = text.match(/(?:producto|item|concepto)\s*[:#-]?\s*([^\n,]+)/i);
    const qtyMatch = normalized.match(/(?:cantidad)\s*[:#-]?\s*([\d.,]+)/i);
    const priceMatch = normalized.match(/(?:precio|valor unitario|unitario)\s*[:#-]?\s*([\d.,]+)/i);
    const taxMatch = normalized.match(/(?:iva|impuesto|tax)\s*[:#-]?\s*([\d.,]+)/i);
    const qty = qtyMatch?.[1] ? Number(qtyMatch[1].replace(',', '.')) : undefined;
    const unitPrice = priceMatch?.[1] ? Number(priceMatch[1].replace(/\./g, '').replace(',', '.')) : undefined;
    const tax = taxMatch?.[1] ? Number(taxMatch[1].replace(',', '.')) : 0;
    return {
      type: 'create_invoice',
      name: clientMatch?.[1]?.trim(),
      documentNumber: docMatch?.[1],
      itemName: itemMatch?.[1]?.trim(),
      quantity: qty,
      unitPrice,
      tax,
    };
  }

  if (/(crea|crear|registra|registrar).*(tercero|cliente|proveedor)/.test(normalized)) {
    const kind = normalized.includes('proveedor') ? 'SUPPLIER' : 'CUSTOMER';
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const docMatch = normalized.match(/(?:nit|cedula|documento)\s*[:#-]?\s*([a-z0-9.-]+)/i);
    const nameMatch = text.match(/(?:nombre|cliente|proveedor|tercero)\s*[:#-]?\s*([^\n,]+)/i);
    return {
      type: 'create_third_party',
      thirdPartyKind: kind,
      email: emailMatch?.[0],
      documentNumber: docMatch?.[1],
      name: nameMatch?.[1]?.trim(),
    };
  }

  if (/(crea|crear|registra|registrar).*(cuenta por pagar|cxp|gasto|compra)/.test(normalized)) {
    const documentMatch = normalized.match(/(?:factura|documento|numero|número)\s*[:#-]?\s*([a-z0-9.-]+)/i);
    const supplierMatch = text.match(/(?:proveedor|a nombre de)\s*[:#-]?\s*([^\n,]+)/i);
    const accountMatch = normalized.match(/(?:cuenta|gasto)\s*[:#-]?\s*(\d{4,10})/i);
    const subtotalMatch = normalized.match(/(?:subtotal|base)\s*[:#-]?\s*([\d.,]+)/i);
    const ivaMatch = normalized.match(/(?:iva|impuesto)\s*[:#-]?\s*([\d.,]+)/i);
    const reteFuenteMatch = normalized.match(/(?:retefuente|retencion fuente)\s*[:#-]?\s*([\d.,]+)/i);
    const reteIcaMatch = normalized.match(/(?:reteica|retencion ica)\s*[:#-]?\s*([\d.,]+)/i);
    const reteVatMatch = normalized.match(/(?:reteiva|retencion iva)\s*[:#-]?\s*([\d.,]+)/i);

    return {
      type: 'create_accounts_payable',
      thirdPartyKind: 'SUPPLIER',
      name: supplierMatch?.[1]?.trim(),
      documentNumber: documentMatch?.[1],
      amount: parsedAmount,
      subtotalAmount: subtotalMatch?.[1] ? Number(subtotalMatch[1].replace(/\./g, '').replace(',', '.')) : parsedAmount,
      tax: ivaMatch?.[1] ? Number(ivaMatch[1].replace(/\./g, '').replace(',', '.')) : 0,
      withholdingSourceAmount: reteFuenteMatch?.[1] ? Number(reteFuenteMatch[1].replace(/\./g, '').replace(',', '.')) : 0,
      withholdingIcaAmount: reteIcaMatch?.[1] ? Number(reteIcaMatch[1].replace(/\./g, '').replace(',', '.')) : 0,
      withholdingVatAmount: reteVatMatch?.[1] ? Number(reteVatMatch[1].replace(/\./g, '').replace(',', '.')) : 0,
      expenseAccountCode: accountMatch?.[1],
    };
  }

  if (
    /(crear|haz|haga|genera|genera|registre|registrar|emitir|emite).*(factura|nota credito|nota debito|cotizacion|remision|recibo de pago)/.test(normalized) ||
    /(factura|nota credito|nota debito|cotizacion|remision|recibo de pago).*(crear|haz|generar|registrar|emitir)/.test(normalized)
  ) {
    let documentType = 'documento';
    if (normalized.includes('factura')) documentType = 'factura';
    else if (normalized.includes('nota credito')) documentType = 'nota credito';
    else if (normalized.includes('nota debito')) documentType = 'nota debito';
    else if (normalized.includes('cotizacion')) documentType = 'cotizacion';
    else if (normalized.includes('remision')) documentType = 'remision';
    else if (normalized.includes('recibo de pago')) documentType = 'recibo de pago';
    return { type: 'guided_document', documentType };
  }

  if (/(dashboard|resumen contable|resumen financiero|estado general|como va la empresa)/.test(normalized)) {
    return { type: 'dashboard' };
  }

  if (/(balance de prueba|trial balance|balance comprobacion)/.test(normalized)) {
    return { type: 'trial_balance', ...period };
  }

  if (/(balance general|estado de situacion financiera|situacion financiera)/.test(normalized)) {
    return { type: 'balance_sheet', ...period };
  }

  if (/(estado de resultados|perdidas y ganancias|pyg|p&g|utilidad del periodo)/.test(normalized)) {
    return { type: 'income_statement', ...period };
  }

  if (/(cartera|cuentas por cobrar|cxc|clientes me deben)/.test(normalized)) {
    return { type: 'accounts_receivable' };
  }

  if (/(cuentas por pagar|cxp|proveedores|debo a proveedores)/.test(normalized)) {
    return { type: 'accounts_payable' };
  }

  if (/(impuestos|retenciones|iva por pagar|resumen tributario)/.test(normalized)) {
    return { type: 'tax_summary', ...period };
  }

  if (/(terceros|maestro de terceros|lista de terceros|clientes y proveedores)/.test(normalized)) {
    return { type: 'third_parties' };
  }

  if (/(auxiliar por tercero|movimientos por tercero|estado de cuenta de|saldo de cliente|saldo de proveedor)/.test(normalized)) {
    return { type: 'third_party_ledger', thirdParty: extractThirdParty(text) };
  }

  if (/(nomina|nomina contable|periodo de nomina|estado de nomina)/.test(normalized)) {
    return { type: 'payroll_status', ...period };
  }

  return null;
};

const getDateRange = (year?: number, month?: number) => {
  if (!year) return {};
  if (!month) {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
};

const getPeriodLabel = (intent: Intent): string => {
  if (intent.month && intent.year) return ` para ${MONTH_NAMES[intent.month]} ${intent.year}`;
  if (intent.year) return ` para ${intent.year}`;
  return '';
};

const formatDashboard = (data: any): string => {
  const summary = data?.summary || {};
  return [
    '## Resumen contable',
    '',
    `- Ingresos acumulados: ${formatMoney(summary.ingresos)}`,
    `- Gastos acumulados: ${formatMoney(summary.gastos)}`,
    `- Costos acumulados: ${formatMoney(summary.costos)}`,
    `- Utilidad acumulada: ${formatMoney(summary.utilidad)}`,
    `- Asientos activos: ${Number(summary.totalAsientos || 0)}`,
    `- Mapeos pendientes: ${Number(summary.pendingMappings || 0)}`,
  ].join('\n');
};

const formatTrialBalance = (data: any, intent: Intent): string => {
  const rows = Array.isArray(data?.balance) ? data.balance : [];
  const totals = data?.totals || {};
  const topRows = rows
    .map((row: any) => ({
      code: row.account_code,
      name: row.account_name,
      balance: Number(row.balance || 0),
    }))
    .sort((a: any, b: any) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 8);

  return [
    `## Balance de prueba${getPeriodLabel(intent)}`,
    '',
    `- Debitos: ${formatMoney(totals.totalDebit)}`,
    `- Creditos: ${formatMoney(totals.totalCredit)}`,
    `- Cuadrado: ${totals.balanced ? 'Si' : 'No'}`,
    '',
    '| Cuenta | Nombre | Saldo |',
    '| --- | --- | ---: |',
    ...topRows.map((row: any) => `| ${row.code} | ${row.name} | ${formatMoney(row.balance)} |`),
  ].join('\n');
};

const topSectionRows = (rows: any[] = [], limit = 5) =>
  rows
    .map((row) => ({
      code: row.account_code,
      name: row.account_name,
      balance: Number(row.balance || 0),
    }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, limit);

const formatBalanceSheet = (data: any, intent: Intent): string => {
  const sheet = data?.balanceSheet || {};
  return [
    `## Balance general${getPeriodLabel(intent)}`,
    '',
    `- Activos: ${formatMoney(sheet.totalActivos)}`,
    `- Pasivos: ${formatMoney(sheet.totalPasivos)}`,
    `- Patrimonio: ${formatMoney(sheet.totalPatrimonio)}`,
    `- Cuadrado: ${sheet.balanced ? 'Si' : 'No'}`,
    '',
    '### Principales cuentas de activo',
    ...topSectionRows(sheet.activos).map((row) => `- ${row.code} ${row.name}: ${formatMoney(row.balance)}`),
    '',
    '### Principales cuentas de pasivo y patrimonio',
    ...[...topSectionRows(sheet.pasivos), ...topSectionRows(sheet.patrimonio)]
      .slice(0, 6)
      .map((row) => `- ${row.code} ${row.name}: ${formatMoney(row.balance)}`),
  ].join('\n');
};

const formatIncomeStatement = (data: any, intent: Intent): string => {
  const statement = data?.statement || {};
  const topRows = [...(statement.ingresos || []), ...(statement.gastos || []), ...(statement.costos || [])]
    .map((row: any) => ({
      name: row.account_name,
      code: row.account_code,
      amount: Number(row.amount || 0),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5);

  return [
    `## Estado de resultados${getPeriodLabel(intent)}`,
    '',
    `- Ingresos: ${formatMoney(statement.totalIngresos)}`,
    `- Costos: ${formatMoney(statement.totalCostos)}`,
    `- Gastos: ${formatMoney(statement.totalGastos)}`,
    `- Utilidad bruta: ${formatMoney(statement.utilidadBruta)}`,
    `- Utilidad neta: ${formatMoney(statement.utilidadNeta)}`,
    '',
    '### Rubros principales',
    ...topRows.map((row) => `- ${row.code} ${row.name}: ${formatMoney(row.amount)}`),
  ].join('\n');
};

const formatReceivables = (data: any): string => {
  const receivables = Array.isArray(data?.receivables) ? data.receivables : [];
  const summary = data?.summary || {};

  return [
    '## Cartera',
    '',
    `- Total original: ${formatMoney(summary.totalOriginal)}`,
    `- Recaudado: ${formatMoney(summary.totalPaid)}`,
    `- Saldo pendiente: ${formatMoney(summary.totalBalance)}`,
    `- Al dia: ${formatMoney(summary.byBucket?.['AL DIA'])}`,
    `- Vencido 1-30: ${formatMoney(summary.byBucket?.['1-30'])}`,
    `- Vencido 31-60: ${formatMoney(summary.byBucket?.['31-60'])}`,
    `- Vencido 61-90: ${formatMoney(summary.byBucket?.['61-90'])}`,
    `- Vencido 90+: ${formatMoney(summary.byBucket?.['90+'])}`,
    '',
    '| Documento | Cliente | Vence | Estado | Saldo |',
    '| --- | --- | --- | --- | ---: |',
    ...receivables.slice(0, 8).map((row: any) => `| ${row.document_number} | ${row.client_name || 'Sin nombre'} | ${formatDate(row.due_date || row.issue_date)} | ${row.status} | ${formatMoney(row.balance_amount)} |`),
  ].join('\n');
};

const formatPayables = (data: any): string => {
  const payables = Array.isArray(data?.payables) ? data.payables : [];
  const summary = data?.summary || {};

  return [
    '## Cuentas por pagar',
    '',
    `- Total original: ${formatMoney(summary.totalOriginal)}`,
    `- Pagado: ${formatMoney(summary.totalPaid)}`,
    `- Saldo pendiente: ${formatMoney(summary.totalBalance)}`,
    '',
    '| Documento | Proveedor | Vence | Estado | Saldo |',
    '| --- | --- | --- | --- | ---: |',
    ...payables.slice(0, 8).map((row: any) => `| ${row.document_number} | ${row.supplier_name || 'Sin nombre'} | ${formatDate(row.due_date || row.issue_date)} | ${row.status} | ${formatMoney(row.balance_amount)} |`),
  ].join('\n');
};

const formatTaxSummary = (data: any, intent: Intent): string => {
  const summary = data?.summary || {};
  return [
    `## Resumen tributario${getPeriodLabel(intent)}`,
    '',
    `- IVA generado: ${formatMoney(summary.vatGenerated)}`,
    `- IVA descontable: ${formatMoney(summary.vatDeductible)}`,
    `- IVA por pagar: ${formatMoney(summary.vatPayable)}`,
    `- Retefuente: ${formatMoney(summary.withholdingSource)}`,
    `- ReteICA: ${formatMoney(summary.withholdingIca)}`,
    `- ReteIVA: ${formatMoney(summary.withholdingVat)}`,
    `- Total retenciones: ${formatMoney(summary.totalWithholdings)}`,
    `- Base de compras: ${formatMoney(summary.purchaseSubtotal)}`,
    `- Neto por pagar a proveedores: ${formatMoney(summary.netPayable)}`,
  ].join('\n');
};

const formatThirdPartyLedger = (data: any, thirdParty?: string): string => {
  const summary = Array.isArray(data?.summary) ? data.summary : [];
  const movements = Array.isArray(data?.movements) ? data.movements : [];
  const summaryLines = summary.length > 0
    ? summary.slice(0, 5).map((row: any) => `- ${row.third_party_name} (${row.third_party_id}): saldo ${formatMoney(row.balance)}`)
    : ['- No encontre terceros con movimientos para ese filtro.'];

  return [
    `## Auxiliar por tercero${thirdParty ? `: ${thirdParty}` : ''}`,
    '',
    ...summaryLines,
    '',
    '| Fecha | Tercero | Documento | Debito | Credito | Saldo |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...movements.slice(0, 8).map((row: any) => `| ${formatDate(row.movement_date)} | ${row.third_party_name} | ${row.document_type} ${row.document_number} | ${formatMoney(row.debit)} | ${formatMoney(row.credit)} | ${formatMoney(row.running_balance)} |`),
  ].join('\n');
};

const formatThirdParties = (data: any): string => {
  const rows = Array.isArray(data?.thirdParties) ? data.thirdParties : [];
  const summary = data?.summary || {};

  return [
    '## Maestro de terceros',
    '',
    `- Total: ${Number(summary.total || 0)}`,
    `- Clientes: ${Number(summary.byKind?.CUSTOMER || 0)}`,
    `- Proveedores: ${Number(summary.byKind?.SUPPLIER || 0)}`,
    `- Empleados: ${Number(summary.byKind?.EMPLOYEE || 0)}`,
    `- Otros: ${Number(summary.byKind?.OTHER || 0)}`,
    '',
    '| Tipo | Nombre | Documento | Email |',
    '| --- | --- | --- | --- |',
    ...rows.slice(0, 10).map((row: any) => `| ${row.kind} | ${row.name} | ${row.document_number || 'Sin documento'} | ${row.email || 'Sin email'} |`),
  ].join('\n');
};

const formatPayrollStatus = async (intent: Intent): Promise<string> => {
  const periodResponse = await api.get('/nomina/periodos', {
    params: {
      ...(intent.year ? { year: intent.year } : {}),
      ...(intent.month ? { month: intent.month } : {}),
      page: 1,
      limit: 5,
    },
  });

  const periods = periodResponse.data?.data?.periods || [];
  const period = periods[0];

  if (!period) {
    return [
      '## Nomina',
      '',
      'No encontre periodos de nomina con ese filtro.',
      'Prueba con algo como `muestrame la nomina de marzo 2026`.',
    ].join('\n');
  }

  const accountingResponse = await api.get(`/nomina/periodos/${period.id}/contabilidad`);
  const accounting = accountingResponse.data?.data?.accounting || {};
  const summary = accountingResponse.data?.data?.summary || {};

  return [
    `## Nomina ${period.month}/${period.year}`,
    '',
    `- Estado del periodo: ${String(period.status || '').toUpperCase()}`,
    `- Estado contable: ${String(accounting.status || 'PENDIENTE').toUpperCase()}`,
    `- Asiento: ${accounting.journalEntryNumber || 'Sin asiento'}`,
    `- Fecha contabilizacion: ${accounting.postedAt ? formatDate(accounting.postedAt) : 'No contabilizado'}`,
    `- Devengado: ${formatMoney(summary.total_devengado)}`,
    `- Deducciones: ${formatMoney(summary.total_deductions)}`,
    `- Neto: ${formatMoney(summary.net_pay)}`,
    `- Costo empresa: ${formatMoney(summary.total_employer_cost)}`,
    ...(accounting.error ? [`- Error: ${accounting.error}`] : []),
  ].join('\n');
};

const buildGuidedDocumentMessage = (documentType = 'documento'): string =>
  [
    `## Crear ${documentType}`,
    '',
    `Puedo ayudarte a dejar listo el ${documentType}, pero para ejecutarlo bien necesito datos estructurados y no debo inventarlos desde el chat.`,
    '',
    'Enviamelo asi:',
    '',
    '```',
    'cliente:',
    'nit o cedula:',
    'fecha:',
    'items:',
    '- producto:',
    '  cantidad:',
    '  precio:',
    'impuestos:',
    'forma de pago:',
    '```',
    '',
    'Si prefieres, crealo desde `Nuevo` y luego te ayudo a revisar el impacto contable.',
  ].join('\n');

const buildGuidedThirdPartyMessage = (kindLabel: string): string =>
  [
    `## Crear ${kindLabel}`,
    '',
    `Puedo crearlo desde el maestro de terceros si me envias al menos estos datos:`,
    '',
    '```',
    'nombre:',
    'documento:',
    'email:',
    'telefono:',
    '```',
  ].join('\n');

const buildGuidedAccountsPayableMessage = (): string =>
  [
    '## Crear cuenta por pagar',
    '',
    'Enviamelo asi para ejecutarlo desde el chat:',
    '',
    '```',
    'proveedor:',
    'documento:',
    'subtotal:',
    'iva:',
    'retefuente:',
    'reteica:',
    'reteiva:',
    'monto neto:',
    'cuenta gasto:',
    '```',
    '',
    'Ejemplo: `crea una cuenta por pagar proveedor Acme SAS documento FC-1001 subtotal 100000 iva 19000 retefuente 2500 monto 116500 cuenta 519595`',
  ].join('\n');

const buildGuidedInvoiceMessage = (): string =>
  [
    '## Crear factura',
    '',
    'Enviamela asi para ejecutarla desde el chat:',
    '',
    '```',
    'cliente:',
    'documento:',
    'producto:',
    'cantidad:',
    'precio:',
    'iva:',
    '```',
    '',
    'Ejemplo: `crea factura cliente Comercial Demo documento 900123456 producto Servicio contable cantidad 1 precio 100000 iva 19`',
  ].join('\n');

const buildGuidedPaymentMessage = (): string =>
  [
    '## Registrar pago',
    '',
    'Enviamelo asi:',
    '',
    '```',
    'cliente:',
    'factura:',
    'monto:',
    'metodo de pago:',
    '```',
    '',
    'Ejemplo: `registra pago cliente Comercial Demo factura FV-000001 monto 119000 metodo transferencia`',
  ].join('\n');

const buildGuidedManualVoucherMessage = (): string =>
  [
    '## Crear comprobante manual',
    '',
    'Enviamelo asi:',
    '',
    '```',
    'concepto:',
    'monto:',
    'debito:',
    'credito:',
    '```',
    '',
    'Ejemplo: `crea comprobante concepto Ajuste caja menor monto 50000 debito 519595 credito 110505`',
  ].join('\n');

export const executeCrumiAction = async (text: string): Promise<CrumiActionResult> => {
  const intent = detectIntent(text);
  if (!intent) return { handled: false };

  try {
    if (intent.type === 'guided_document') {
      return {
        handled: true,
        content: buildGuidedDocumentMessage(intent.documentType),
      };
    }

    if (intent.type === 'create_third_party') {
      if (!intent.name || !intent.documentNumber) {
        return {
          handled: true,
          content: buildGuidedThirdPartyMessage(intent.thirdPartyKind === 'SUPPLIER' ? 'proveedor' : 'cliente'),
        };
      }

      const response = await api.post('/accounting/third-parties', {
        kind: intent.thirdPartyKind || 'CUSTOMER',
        documentType: 'CC',
        documentNumber: intent.documentNumber,
        name: intent.name,
        email: intent.email || null,
      });

      const thirdParty = response.data?.thirdParty;
      return {
        handled: true,
        content: [
          '## Tercero creado',
          '',
          `- Tipo: ${thirdParty?.kind || intent.thirdPartyKind}`,
          `- Nombre: ${thirdParty?.name || intent.name}`,
          `- Documento: ${thirdParty?.document_number || intent.documentNumber}`,
          `- Email: ${thirdParty?.email || intent.email || 'Sin email'}`,
        ].join('\n'),
      };
    }

    if (intent.type === 'sync_third_parties') {
      const response = await api.post('/accounting/third-parties/sync');
      const summary = response.data?.summary || {};
      return {
        handled: true,
        content: [
          '## Terceros sincronizados',
          '',
          `- Clientes sincronizados: ${Number(summary.customers || 0)}`,
          `- Proveedores sincronizados: ${Number(summary.suppliers || 0)}`,
          `- Empleados sincronizados: ${Number(summary.employees || 0)}`,
          `- Clientes desde cartera: ${Number(summary.receivableCustomers || 0)}`,
          `- Total en maestro: ${Number(summary.total || 0)}`,
        ].join('\n'),
      };
    }

    if (intent.type === 'create_accounts_payable') {
      if (!intent.name || !intent.documentNumber || !intent.amount || !intent.expenseAccountCode) {
        return {
          handled: true,
          content: buildGuidedAccountsPayableMessage(),
        };
      }

      const response = await api.post('/accounting/accounts-payable', {
        supplierName: intent.name,
        supplierDocumentType: 'NIT',
        supplierDocumentNumber: intent.documentNumber,
        documentType: 'FACTURA_PROVEEDOR',
        documentNumber: intent.documentNumber,
        amount: intent.amount,
        subtotalAmount: intent.subtotalAmount ?? intent.amount,
        taxAmount: intent.tax || 0,
        withholdingSourceAmount: intent.withholdingSourceAmount || 0,
        withholdingIcaAmount: intent.withholdingIcaAmount || 0,
        withholdingVatAmount: intent.withholdingVatAmount || 0,
        expenseAccountCode: intent.expenseAccountCode,
      });

      const payable = response.data?.payable;
      return {
        handled: true,
        content: [
          '## Cuenta por pagar creada',
          '',
          `- Proveedor: ${payable?.supplier_name || intent.name}`,
          `- Documento: ${payable?.document_number || intent.documentNumber}`,
          `- Monto: ${formatMoney(payable?.original_amount || intent.amount)}`,
          `- Estado: ${payable?.status || 'PENDIENTE'}`,
        ].join('\n'),
      };
    }

    if (intent.type === 'create_invoice') {
      if (!intent.name || !intent.documentNumber || !intent.itemName || !intent.quantity || !intent.unitPrice) {
        return {
          handled: true,
          content: buildGuidedInvoiceMessage(),
        };
      }

      const response = await api.post('/invoices', {
        clientId: intent.documentNumber,
        clientName: intent.name,
        clientDocType: 'NIT',
        documentType: 'Factura de venta',
        warehouse: 'Principal',
        priceList: 'General',
        items: [
          {
            item: intent.itemName,
            description: intent.itemName,
            quantity: intent.quantity,
            unitPrice: intent.unitPrice,
            discount: 0,
            tax: intent.tax || 0,
          },
        ],
        paymentMethod: 'Contado',
        paymentMeanCode: '10',
      });

      const invoice = response.data?.invoice;
      return {
        handled: true,
        content: [
          '## Factura creada',
          '',
          `- Numero: ${invoice?.number || 'Sin numero'}`,
          `- Cliente: ${invoice?.client || intent.name}`,
          `- Total: ${formatMoney(invoice?.total || ((intent.quantity || 0) * (intent.unitPrice || 0)))}`,
          `- Tipo: ${invoice?.documentType || 'Factura de venta'}`,
        ].join('\n'),
      };
    }

    if (intent.type === 'register_payment') {
      if (!intent.name || !intent.invoiceNumber || !intent.amount) {
        return {
          handled: true,
          content: buildGuidedPaymentMessage(),
        };
      }

      const response = await api.post('/payment-receipts', {
        clientName: intent.name,
        clientDocType: 'NIT',
        paymentMethod: intent.paymentMethod || 'transferencia',
        amount: intent.amount,
        amountReceived: intent.amount,
        invoices: [
          {
            invoiceNumber: intent.invoiceNumber,
            amountApplied: intent.amount,
          },
        ],
      });

      const paymentReceipt = response.data?.paymentReceipt;
      return {
        handled: true,
        content: [
          '## Pago registrado',
          '',
          `- Recibo: ${paymentReceipt?.number || 'Sin numero'}`,
          `- Cliente: ${paymentReceipt?.clientName || intent.name}`,
          `- Factura: ${intent.invoiceNumber}`,
          `- Monto: ${formatMoney(paymentReceipt?.amount || intent.amount)}`,
        ].join('\n'),
      };
    }

    if (intent.type === 'create_manual_voucher') {
      if (!intent.description || !intent.amount || !intent.debitAccountCode || !intent.creditAccountCode) {
        return {
          handled: true,
          content: buildGuidedManualVoucherMessage(),
        };
      }

      const response = await api.post('/accounting/manual-vouchers', {
        voucherType: 'AJUSTE_CONTABLE',
        description: intent.description,
        lines: [
          {
            account_code: intent.debitAccountCode,
            debit: intent.amount,
            credit: 0,
          },
          {
            account_code: intent.creditAccountCode,
            debit: 0,
            credit: intent.amount,
          },
        ],
      });

      const voucher = response.data?.voucher;
      return {
        handled: true,
        content: [
          '## Comprobante creado',
          '',
          `- Numero: ${voucher?.voucher_number || 'Sin numero'}`,
          `- Concepto: ${voucher?.description || intent.description}`,
          `- Debito: ${intent.debitAccountCode}`,
          `- Credito: ${intent.creditAccountCode}`,
          `- Monto: ${formatMoney(intent.amount)}`,
        ].join('\n'),
      };
    }

    if (intent.type === 'payroll_status') {
      return {
        handled: true,
        content: await formatPayrollStatus(intent),
      };
    }

    const params = getDateRange(intent.year, intent.month);

    switch (intent.type) {
      case 'dashboard': {
        const response = await api.get('/accounting/dashboard/summary');
        return { handled: true, content: formatDashboard(response.data) };
      }
      case 'trial_balance': {
        const response = await api.get('/accounting/trial-balance', { params });
        return { handled: true, content: formatTrialBalance(response.data, intent) };
      }
      case 'balance_sheet': {
        const response = await api.get('/accounting/balance-sheet', { params });
        return { handled: true, content: formatBalanceSheet(response.data, intent) };
      }
      case 'income_statement': {
        const response = await api.get('/accounting/income-statement', { params });
        return { handled: true, content: formatIncomeStatement(response.data, intent) };
      }
      case 'accounts_receivable': {
        const response = await api.get('/accounting/accounts-receivable');
        return { handled: true, content: formatReceivables(response.data) };
      }
      case 'accounts_payable': {
        const response = await api.get('/accounting/accounts-payable');
        return { handled: true, content: formatPayables(response.data) };
      }
      case 'tax_summary': {
        const response = await api.get('/accounting/tax-summary', { params });
        return { handled: true, content: formatTaxSummary(response.data, intent) };
      }
      case 'third_parties': {
        const response = await api.get('/accounting/third-parties');
        return { handled: true, content: formatThirdParties(response.data) };
      }
      case 'third_party_ledger': {
        const response = await api.get('/accounting/third-party-ledger', {
          params: intent.thirdParty ? { thirdParty: intent.thirdParty } : {},
        });
        return {
          handled: true,
          content: formatThirdPartyLedger(response.data, intent.thirdParty),
        };
      }
      default:
        return { handled: false };
    }
  } catch (error: any) {
    const serverError =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      'No pude ejecutar la accion solicitada.';

    return {
      handled: true,
      content: [
        '## No pude ejecutar esa accion',
        '',
        serverError,
        '',
        'Prueba con una instruccion mas directa:',
        '- `muestrame el balance general`',
        '- `muestrame la cartera`',
        '- `muestrame la nomina de marzo 2026`',
      ].join('\n'),
    };
  }
};
