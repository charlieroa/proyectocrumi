require('dotenv').config();

const invoiceController = require('../src/controllers/invoiceController');
const paymentReceiptController = require('../src/controllers/paymentReceiptController');
const { pool } = require('../src/config/db');

const TENANT_ID = 12;
const USER_ID = 11;
const INVOICE_TOTAL = 119000;

function createMockRes(label) {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      console.log(`\n[${label}]`);
      console.log(JSON.stringify({ statusCode: this.statusCode, body: payload }, null, 2));
      return this;
    },
    download() {
      throw new Error('download() no soportado en este script');
    },
  };
}

async function run() {
  const reqInvoice = {
    body: {
      clientId: '900123456',
      clientName: 'Cliente Prueba Contable',
      clientDocType: 'NIT',
      email: 'cliente.prueba@example.com',
      documentType: 'Factura de venta',
      warehouse: 'Principal',
      priceList: 'General',
      date: '2026-03-26',
      paymentMethod: 'Credito',
      paymentMeanCode: '30',
      notes: 'Factura de prueba ciclo contable',
      reference: 'DEMO-CICLO-001',
      terms: 'Pago a 30 dias',
      items: [
        {
          item: 'Servicio contable demo',
          description: 'Servicio de prueba del ciclo contable',
          reference: 'SERV-DEMO',
          quantity: 1,
          unitPrice: 100000,
          discount: 0,
          tax: 19,
        },
      ],
    },
    user: { id: USER_ID, role_id: 1, tenant_id: TENANT_ID },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'demo-accounting-cycle' },
  };

  const invoiceRes = createMockRes('invoice');
  await invoiceController.createInvoice(reqInvoice, invoiceRes);
  if (invoiceRes.statusCode >= 400) {
    throw new Error(`Fallo creando factura: ${JSON.stringify(invoiceRes.body)}`);
  }

  const invoiceId = invoiceRes.body?.invoice?.id;
  const invoiceNumber = invoiceRes.body?.invoice?.number;

  const reqReceipt = {
    body: {
      clientNit: '900123456',
      clientName: 'Cliente Prueba Contable',
      clientDocType: 'NIT',
      paymentDate: '2026-03-26',
      paymentMethod: 'Transferencia',
      bankName: 'Banco Demo',
      transactionReference: 'PAGO-DEMO-001',
      amount: INVOICE_TOTAL,
      amountReceived: INVOICE_TOTAL,
      notes: 'Pago de prueba ciclo contable',
      invoices: [
        {
          invoiceId,
          invoiceNumber,
          amountApplied: INVOICE_TOTAL,
        },
      ],
    },
    user: { id: USER_ID, role_id: 1, tenant_id: TENANT_ID },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'demo-accounting-cycle' },
  };

  const receiptRes = createMockRes('receipt');
  await paymentReceiptController.createPaymentReceipt(reqReceipt, receiptRes);
  if (receiptRes.statusCode >= 400) {
    throw new Error(`Fallo creando recibo: ${JSON.stringify(receiptRes.body)}`);
  }

  const summary = await pool.query(
    `
      WITH target_invoice AS (
        SELECT id, invoice_number, client_name, total, subtotal, tax_amount, payment_status, dian_status, date, reference
        FROM invoices
        WHERE id = $1 AND tenant_id = $2
      ),
      target_receivable AS (
        SELECT id, document_number, original_amount, paid_amount, balance_amount, status
        FROM accounts_receivable
        WHERE invoice_id = $1 AND tenant_id = $2
      ),
      invoice_journal AS (
        SELECT je.id, je.entry_number, je.document_type, je.document_number, je.total_debit, je.total_credit
        FROM journal_entries je
        WHERE je.tenant_id = $2 AND je.document_type = 'FACTURA' AND je.document_id = $1::text
      ),
      receipt_journal AS (
        SELECT je.id, je.entry_number, je.document_type, je.document_number, je.total_debit, je.total_credit
        FROM journal_entries je
        JOIN payment_receipts pr ON pr.receipt_number = je.document_number AND pr.tenant_id = je.tenant_id
        JOIN payment_receipt_invoices pri ON pri.receipt_id = pr.id
        WHERE je.tenant_id = $2 AND je.document_type = 'RECIBO_PAGO' AND pri.invoice_id = $1
      )
      SELECT json_build_object(
        'invoice', (SELECT row_to_json(t) FROM target_invoice t),
        'receivable', (SELECT row_to_json(t) FROM target_receivable t),
        'invoiceJournal', (SELECT row_to_json(t) FROM invoice_journal t),
        'receiptJournal', (SELECT row_to_json(t) FROM receipt_journal t)
      ) AS data
    `,
    [invoiceId, TENANT_ID]
  );

  const journalLines = await pool.query(
    `
      SELECT je.entry_number, jel.account_code, jel.account_name, jel.debit, jel.credit, jel.description
      FROM journal_entries je
      JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
      WHERE je.tenant_id = $2
        AND (
          (je.document_type = 'FACTURA' AND je.document_id = $1::text)
          OR (
            je.document_type = 'RECIBO_PAGO'
            AND je.document_number = (SELECT receipt_number FROM payment_receipts ORDER BY id DESC LIMIT 1)
          )
        )
      ORDER BY je.id, jel.id
    `,
    [invoiceId, TENANT_ID]
  );

  console.log('\n[summary]');
  console.log(JSON.stringify(summary.rows[0].data, null, 2));
  console.log('\n[journal_lines]');
  console.log(JSON.stringify(journalLines.rows, null, 2));
}

run()
  .catch((error) => {
    console.error('\n[demo-accounting-cycle] error');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
