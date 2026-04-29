// src/pages/income/SalesInvoice/tabs/PagoTab.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentConfig } from '../Create';
import AutocompleteInput from '../../../../Components/AutocompleteInput';
import useAccountingCustomers from '../../../../Components/Contabilidad/useAccountingCustomers';
import { getCrumiFormStyles } from '../crumiFormStyles';
import { env } from '../../../../env';

interface PaymentInvoice {
    id: number;
    invoiceNumber: string;
    amount: string;
    balance?: number;
}

interface PendingReceivable {
    invoice_id: number | string;
    invoice_number: string;
    client_name: string;
    client_nit: string;
    issue_date?: string;
    due_date?: string;
    total: number;
    paid: number;
    balance: number;
}

interface PagoTabProps {
    config: DocumentConfig;
    isTestMode?: boolean; // Indica si estamos creando documentos para el Set de Pruebas
}

const PagoTab: React.FC<PagoTabProps> = ({ config, isTestMode = false }) => {
    const navigate = useNavigate();

    // Clientes del módulo contable (tabla third_parties)
    const { customers: crmcontacts } = useAccountingCustomers();

    const [loading, setLoading] = useState(false);
    const [documentNumber] = useState('AUTO');
    const [logoUrl, setLogoUrl] = useState('');
    const [companyName] = useState('armadilloazul');

    // Navigation for document type
    const handleDocumentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const map: Record<string, string> = {
            'Factura de Ventas': 'factura',
            'Cotización': 'cotizacion',
            'Remisión': 'remision',
            'Nota Débito': 'nota-debito',
            'Nota Crédito': 'nota-credito',
            'Recibo de Pago': 'pago'
        };
        const selectedLabel = e.target.value;
        const typeParam = map[selectedLabel];
        if (typeParam) {
            navigate(`/ingresos/factura-venta/crear?tipo=${typeParam}`);
            window.location.href = `/ingresos/factura-venta/crear?tipo=${typeParam}`;
        }
    };

    const today = new Date().toISOString().split('T')[0];

    const [formData, setFormData] = useState({
        clientDocType: 'CC',
        clientDocNumber: '',
        clientName: '',
        email: '',
        dateIssue: today,
        paymentDate: today,
        paymentMethod: '',
        amount: '',
        amountReceived: '',
        bankName: '',
        bankAccount: '',
        transactionReference: '',
        concept: '',
        notes: ''
    });

    const [invoices, setInvoices] = useState<PaymentInvoice[]>([
        { id: 1, invoiceNumber: '', amount: '' }
    ]);

    const [pendingReceivables, setPendingReceivables] = useState<PendingReceivable[]>([]);

    const loadPendingReceivables = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const r = await fetch(`${env.API_URL}/accounting/accounts-receivable`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!r.ok) return;
            const d = await r.json();
            const raw: any[] = d.receivables || [];
            const normalized: PendingReceivable[] = raw
                .map((v: any) => ({
                    invoice_id: v.invoice_id ?? v.id,
                    invoice_number: v.invoice_number ?? v.document_number,
                    client_name: v.client_name,
                    client_nit: v.client_nit ?? v.client_document_number ?? '',
                    issue_date: v.issue_date ? String(v.issue_date).slice(0, 10) : undefined,
                    due_date: v.due_date ? String(v.due_date).slice(0, 10) : undefined,
                    total: Number(v.total ?? v.original_amount ?? 0),
                    paid: Number(v.paid ?? v.paid_amount ?? 0),
                    balance: Number(v.balance ?? v.balance_amount ?? 0),
                }))
                .filter((v: PendingReceivable) => v.balance > 0);
            setPendingReceivables(normalized);
        } catch {
            setPendingReceivables([]);
        }
    }, []);

    useEffect(() => {
        loadPendingReceivables();
    }, [loadPendingReceivables]);

    const clientPendingInvoices = useMemo(() => {
        const nit = (formData.clientDocNumber || '').trim();
        const name = (formData.clientName || '').trim().toLowerCase();
        if (!nit && !name) return [];
        return pendingReceivables.filter(v => {
            if (nit && String(v.client_nit || '') === nit) return true;
            if (name && (v.client_name || '').toLowerCase() === name) return true;
            return false;
        });
    }, [pendingReceivables, formData.clientDocNumber, formData.clientName]);

    useEffect(() => {
        if (clientPendingInvoices.length === 0) return;
        setInvoices(prev => {
            const filled = prev.filter(p => p.invoiceNumber).length;
            if (filled > 0) return prev;
            return clientPendingInvoices.map((v, idx) => ({
                id: idx + 1,
                invoiceNumber: String(v.invoice_number),
                amount: String(v.balance.toFixed(2)),
                balance: v.balance,
            }));
        });
    }, [clientPendingInvoices]);

    const handleFormChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Auto-populate when client name matches
        if (field === 'clientName') {
            const foundClient = crmcontacts.find((c: any) =>
                `${c.first_name} ${c.last_name}`.trim() === value || c.name === value
            );
            if (foundClient) {
                setFormData(prev => ({
                    ...prev,
                    clientName: value,
                    clientDocNumber: foundClient.id || '',
                    email: foundClient.email || '',
                }));
            }
        }

        // Auto-populate when client document number matches
        if (field === 'clientDocNumber') {
            const foundClient = crmcontacts.find((c: any) =>
                String(c.id) === value || String(c.identification || '') === value
            );
            if (foundClient) {
                const name = foundClient.name || `${foundClient.first_name || ''} ${foundClient.last_name || ''}`.trim();
                setFormData(prev => ({
                    ...prev,
                    clientDocNumber: value,
                    clientName: name,
                    email: foundClient.email || ''
                }));
            }
        }
    };

    const addInvoiceLine = () => {
        const newId = Math.max(...invoices.map(i => i.id), 0) + 1;
        setInvoices(prev => [...prev, { id: newId, invoiceNumber: '', amount: '' }]);
    };

    const removeInvoiceLine = (id: number) => {
        if (invoices.length <= 1) return;
        setInvoices(prev => prev.filter(i => i.id !== id));
    };

    const updateInvoiceLine = (id: number, field: keyof PaymentInvoice, value: string) => {
        setInvoices(prev =>
            prev.map(i => (i.id === id ? { ...i, [field]: value } : i))
        );
    };

    const totalApplied = () =>
        invoices.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

    const amountNumber = parseFloat(formData.amount) || 0;
    const amountReceivedNumber =
        parseFloat(formData.amountReceived || formData.amount) || amountNumber;

    const changeAmount = amountReceivedNumber - amountNumber;

    // =========================
    // Guardar
    // =========================
    const handleSave = async () => {
        if (!formData.clientName) {
            return alert('⚠️ Debes seleccionar un cliente');
        }
        if (!formData.paymentMethod) {
            return alert('⚠️ Debes seleccionar un medio de pago');
        }
        if (!formData.amount || amountNumber <= 0) {
            return alert('⚠️ El valor del pago debe ser mayor a 0');
        }

        setLoading(true);

        const paymentMeanCode = (() => {
            const map: Record<string, string> = {
                Efectivo: '10',
                Transferencia: '31',
                Tarjeta: '48',
                Consignación: '42'
            };
            return map[formData.paymentMethod] || '10';
        })();

        const payload = {
            clientDocType: formData.clientDocType,
            clientNit: formData.clientDocNumber || null,
            clientName: formData.clientName,
            clientEmail: formData.email || null,
            dateIssue: formData.dateIssue,
            paymentDate: formData.paymentDate,
            amount: amountNumber,
            amountReceived: amountReceivedNumber,
            paymentMethod: formData.paymentMethod,
            paymentMeanCode,
            bankName: formData.bankName || null,
            bankAccount: formData.bankAccount || null,
            transactionReference: formData.transactionReference || null,
            concept: formData.concept || 'Pago recibido',
            notes: formData.notes || null,
            invoices: invoices
                .filter(i => i.invoiceNumber && i.amount)
                .map(i => ({
                    invoiceNumber: i.invoiceNumber,
                    amountApplied: parseFloat(i.amount) || 0
                })),
            // Set de Pruebas - Modo prueba (aunque recibos no son parte del set)
            isTestMode: isTestMode || false
        };

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No se encontró token de autenticación.');

            const response = await fetch(`${env.API_URL}/payment-receipts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al crear el recibo de pago');
            }

            alert(
                `✅ Recibo de pago creado exitosamente\n\n` +
                `Número: ${data.receipt?.number || 'N/D'}\n` +
                `Valor: $${(data.receipt?.amount || amountNumber).toLocaleString()}`
            );

            navigate('/ingresos/documentos');
        } catch (err: any) {
            console.error('❌ Error al guardar recibo de pago:', err);
            alert(`Error al guardar el recibo de pago:\n${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setLogoUrl(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    // =========================
    // Estilos
    // =========================
    const s = getCrumiFormStyles(loading);

    // Autocomplete options for client name
    const clientNameOptions = useMemo(() => {
        return (crmcontacts || []).map((client: any) => {
            const name = client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim();
            return {
                value: name,
                label: name,
                sublabel: client.email || `ID: ${client.id}`
            };
        });
    }, [crmcontacts]);

    // Autocomplete options for client document number
    const clientDocOptions = useMemo(() => {
        return (crmcontacts || []).map((client: any) => {
            const name = client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim();
            return {
                value: String(client.id),
                label: String(client.id),
                sublabel: name
            };
        });
    }, [crmcontacts]);

    return (
        <div style={s.wrapper}>
            <div style={s.card}>
                {/* Barra superior */}
                <div style={s.topBar}>
                    <div>
                        <label style={s.topLabel}>Tipo de documento</label>
                        <select
                            style={{ ...s.topSelect, ...s.topSelectActive }}
                            value="Recibo de Pago"
                            onChange={handleDocumentTypeChange}
                        >
                            <option value="Factura de Ventas">Factura de Ventas</option>
                            <option value="Cotización">Cotización</option>
                            <option value="Remisión">Remisión</option>
                            <option value="Nota Débito">Nota Débito</option>
                            <option value="Nota Crédito">Nota Crédito</option>
                            <option value="Recibo de Pago">Recibo de Pago</option>
                        </select>
                    </div>
                </div>

                {/* Header */}
                <div style={s.header}>
                    <div>
                        <label style={s.logoBox}>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                style={{ display: 'none' }}
                            />
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" style={s.logoImage} />
                            ) : (
                                <>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                                    <div>Utilizar mi logo</div>
                                    <div
                                        style={{
                                            fontSize: '10px',
                                            color: '#d1d5db',
                                            marginTop: '4px'
                                        }}
                                    >
                                        178 x 51 píxeles
                                    </div>
                                </>
                            )}
                        </label>
                        <div style={s.companyName}>{companyName}</div>
                    </div>

                    <div style={s.invoiceNumber}>
                        <div style={s.invoiceLabel}>{config.numberLabel}</div>
                        <div style={s.invoiceNum}>{documentNumber}</div>
                    </div>
                </div>

                {/* Body */}
                <div style={s.body}>
                    {/* Formulario principal */}
                    <div style={s.formGrid}>
                        {/* Doc cliente */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Documento del cliente <span style={s.required}>*</span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    style={{ ...s.select, width: '80px' }}
                                    value={formData.clientDocType}
                                    onChange={e => handleFormChange('clientDocType', e.target.value)}
                                >
                                    <option value="CC">CC</option>
                                    <option value="NIT">NIT</option>
                                    <option value="CE">CE</option>
                                </select>
                                <div style={{ flex: 1 }}>
                                    <AutocompleteInput
                                        value={formData.clientDocNumber}
                                        onChange={(val) => handleFormChange('clientDocNumber', val)}
                                        options={clientDocOptions}
                                        placeholder="Nº identificación"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Fecha emisión */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Fecha del recibo <span style={s.required}>*</span>
                            </label>
                            <input
                                type="date"
                                style={s.input}
                                value={formData.dateIssue}
                                onChange={e => handleFormChange('dateIssue', e.target.value)}
                            />
                        </div>

                        {/* Fecha pago */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Fecha de pago <span style={s.required}>*</span>
                            </label>
                            <input
                                type="date"
                                style={s.input}
                                value={formData.paymentDate}
                                onChange={e => handleFormChange('paymentDate', e.target.value)}
                            />
                        </div>

                        {/* Nombre */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Nombre o razón social <span style={s.required}>*</span>
                            </label>
                            <AutocompleteInput
                                value={formData.clientName}
                                onChange={(val) => handleFormChange('clientName', val)}
                                options={clientNameOptions}
                                placeholder="Nombre del cliente"
                            />
                        </div>

                        {/* Medio de pago */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Medio de pago <span style={s.required}>*</span>
                            </label>
                            <select
                                style={s.select}
                                value={formData.paymentMethod}
                                onChange={e => handleFormChange('paymentMethod', e.target.value)}
                            >
                                <option value="">Seleccionar</option>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Tarjeta">Tarjeta</option>
                                <option value="Consignación">Consignación</option>
                            </select>
                        </div>

                        {/* Valor pago */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Valor del pago <span style={s.required}>*</span>
                            </label>
                            <input
                                type="number"
                                style={s.input}
                                placeholder="0"
                                value={formData.amount}
                                onChange={e => handleFormChange('amount', e.target.value)}
                            />
                        </div>

                        {/* Email */}
                        <div style={s.formField}>
                            <label style={s.label}>Correo</label>
                            <input
                                type="email"
                                style={s.input}
                                value={formData.email}
                                onChange={e => handleFormChange('email', e.target.value)}
                            />
                        </div>

                        {/* Valor recibido */}
                        <div style={s.formField}>
                            <label style={s.label}>Valor recibido</label>
                            <input
                                type="number"
                                style={s.input}
                                placeholder="Si es igual al pago puedes dejarlo vacío"
                                value={formData.amountReceived}
                                onChange={e => handleFormChange('amountReceived', e.target.value)}
                            />
                        </div>

                        {/* Banco */}
                        <div style={s.formField}>
                            <label style={s.label}>Banco</label>
                            <input
                                type="text"
                                style={s.input}
                                value={formData.bankName}
                                onChange={e => handleFormChange('bankName', e.target.value)}
                            />
                        </div>

                        {/* Cuenta */}
                        <div style={s.formField}>
                            <label style={s.label}>Cuenta / Nº tarjeta</label>
                            <input
                                type="text"
                                style={s.input}
                                value={formData.bankAccount}
                                onChange={e => handleFormChange('bankAccount', e.target.value)}
                            />
                        </div>

                        {/* Referencia */}
                        <div style={s.formField}>
                            <label style={s.label}>Referencia de transacción</label>
                            <input
                                type="text"
                                style={s.input}
                                value={formData.transactionReference}
                                onChange={e =>
                                    handleFormChange('transactionReference', e.target.value)
                                }
                            />
                        </div>
                    </div>

                    {/* Tabla de facturas pendientes del cliente */}
                    <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6b7280' }}>
                        {formData.clientName || formData.clientDocNumber ? (
                            clientPendingInvoices.length > 0 ? (
                                <>Facturas pendientes del cliente: <strong>{clientPendingInvoices.length}</strong></>
                            ) : (
                                <>Este cliente no tiene facturas pendientes. Puedes ingresar el número manualmente.</>
                            )
                        ) : (
                            <>Selecciona primero un cliente para ver sus facturas pendientes.</>
                        )}
                    </div>
                    <div style={s.tableWrapper}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    <th style={{ ...s.th, width: '55%' }}>Factura</th>
                                    <th style={{ ...s.th, width: '20%' }}>Saldo pendiente</th>
                                    <th style={{ ...s.th, width: '20%' }}>Monto aplicado</th>
                                    <th style={{ ...s.th, width: '5%' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(line => {
                                    const selected = clientPendingInvoices.find(
                                        p => String(p.invoice_number) === String(line.invoiceNumber)
                                    );
                                    return (
                                    <tr key={line.id}>
                                        <td style={s.td}>
                                            {clientPendingInvoices.length > 0 ? (
                                                <select
                                                    style={s.inputCell}
                                                    value={line.invoiceNumber}
                                                    onChange={e => {
                                                        const num = e.target.value;
                                                        const pend = clientPendingInvoices.find(
                                                            p => String(p.invoice_number) === num
                                                        );
                                                        setInvoices(prev => prev.map(i =>
                                                            i.id === line.id
                                                                ? {
                                                                    ...i,
                                                                    invoiceNumber: num,
                                                                    amount: pend ? String(pend.balance.toFixed(2)) : i.amount,
                                                                    balance: pend?.balance,
                                                                }
                                                                : i
                                                        ));
                                                    }}
                                                >
                                                    <option value="">Seleccionar factura</option>
                                                    {clientPendingInvoices.map(p => (
                                                        <option key={p.invoice_id} value={p.invoice_number}>
                                                            {p.invoice_number} — saldo ${p.balance.toLocaleString('es-CO')}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    style={s.inputCell}
                                                    placeholder="Número o referencia de la factura"
                                                    value={line.invoiceNumber}
                                                    onChange={e =>
                                                        updateInvoiceLine(line.id, 'invoiceNumber', e.target.value)
                                                    }
                                                />
                                            )}
                                        </td>
                                        <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>
                                            {selected ? `$${selected.balance.toLocaleString('es-CO')}` : '—'}
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="number"
                                                style={s.inputCell}
                                                placeholder="0"
                                                value={line.amount}
                                                max={selected?.balance}
                                                onChange={e =>
                                                    updateInvoiceLine(line.id, 'amount', e.target.value)
                                                }
                                            />
                                        </td>
                                        <td style={{ ...s.td, textAlign: 'center' }}>
                                            <button
                                                style={s.deleteBtn}
                                                onClick={() => removeInvoiceLine(line.id)}
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <button style={s.addLineBtn} onClick={addInvoiceLine}>
                        + Agregar factura
                    </button>

                    {/* Footer */}
                    <div style={s.footerGrid}>
                        <div style={s.leftFooter}>
                            <div>
                                <div style={s.textareaLabel}>Concepto del pago</div>
                                <textarea
                                    style={s.textarea}
                                    placeholder="Ej: Abono a factura 001, pago total, anticipo..."
                                    value={formData.concept}
                                    onChange={e => handleFormChange('concept', e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div>
                                <div style={s.textareaLabel}>Notas</div>
                                <textarea
                                    style={s.textarea}
                                    placeholder="Notas visibles en el recibo..."
                                    value={formData.notes}
                                    onChange={e => handleFormChange('notes', e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </div>

                        <div style={s.totalsBox}>
                            <div style={s.totalRow}>
                                <span>Valor del pago</span>
                                <span>$ {amountNumber.toLocaleString()}</span>
                            </div>
                            <div style={s.totalRow}>
                                <span>Valor recibido</span>
                                <span>$ {amountReceivedNumber.toLocaleString()}</span>
                            </div>
                            <div style={s.totalRow}>
                                <span>Cambio</span>
                                <span>$ {changeAmount.toLocaleString()}</span>
                            </div>
                            <div style={s.totalRow}>
                                <span>Total aplicado a facturas</span>
                                <span>$ {totalApplied().toLocaleString()}</span>
                            </div>
                            <div style={s.totalFinal}>
                                <span>Saldo no aplicado</span>
                                <span>$ {(amountNumber - totalApplied()).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Barra inferior */}
            <div style={s.bottomBar}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        style={s.btnSecondary}
                        onClick={() => navigate('/ingresos/documentos')}
                    >
                        Cancelar
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={s.btnSecondary} onClick={handleSave} disabled={loading}>
                        Guardar y crear nuevo
                    </button>
                    <button style={s.btnPrimary} onClick={handleSave} disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PagoTab;
