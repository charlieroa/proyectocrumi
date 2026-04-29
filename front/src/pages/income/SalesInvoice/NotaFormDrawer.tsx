// src/pages/income/SalesInvoice/NotaFormDrawer.tsx
//
// Drawer (Offcanvas) reutilizable para emitir Nota Crédito o Nota Débito.
// Replica el formulario de Contabilidad/sections/Notas.tsx para mantener
// una sola experiencia en todo el sistema.
//
// Se abre desde FacturaVentaLista (dropdown de acciones de la fila) pasando
// el `preloadInvoiceId` de la factura asociada. El drawer carga la factura,
// prellena cliente + ítems y emite al endpoint /credit-notes o /debit-notes.
//
// Agrega sobre el Notas.tsx original la opción "Anulación total": bloquea
// la edición del valor de la factura (concepto, cantidad, precio, desc, IVA).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Offcanvas,
    OffcanvasBody,
    OffcanvasHeader,
} from 'reactstrap';
import Swal from 'sweetalert2';
import { Lock } from 'lucide-react';
import { API_ROOT, money, useAuthHeaders } from '../../Contabilidad/shared';
import ClienteSelector, { Cliente } from '../../../Components/Contabilidad/ClienteSelector';
import { getCrumiFormStyles } from './crumiFormStyles';

export type NotaKind = 'credit' | 'debit';

type NoteItem = {
    description: string;
    quantity: number;
    unitPrice: number;
    tax: number;
    discount: number;
};

// Motivos de nota crédito (códigos DIAN 1-6).
// El `code` se envía al backend como `reason`; el `label` es lo que ve el usuario.
const REASONS_CREDIT: { code: string; label: string }[] = [
    { code: '1', label: 'Devolución parcial de bienes o servicios' },
    { code: '2', label: 'Anulación de la factura' },
    { code: '3', label: 'Rebaja o descuento total' },
    { code: '4', label: 'Ajuste de precio' },
    { code: '5', label: 'Descuento parcial' },
    { code: '6', label: 'Otros' },
];

// Motivos de nota débito (códigos DIAN 1-4).
const REASONS_DEBIT: { code: string; label: string }[] = [
    { code: '1', label: 'Intereses' },
    { code: '2', label: 'Gastos por cobrar' },
    { code: '3', label: 'Cambio del valor' },
    { code: '4', label: 'Otros' },
];

const DOC_TYPES = ['NIT', 'CC', 'CE', 'PP'];

const NOTE_TYPES = [
    { value: 'normal', label: 'Normal' },
    { value: 'anulacion-total', label: 'Anulación total' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyItem = (): NoteItem => ({
    description: '',
    quantity: 1,
    unitPrice: 0,
    tax: 19,
    discount: 0,
});

const computeItem = (it: NoteItem) => {
    const base = (it.quantity || 0) * (it.unitPrice || 0);
    const disc = base * ((it.discount || 0) / 100);
    const sub = base - disc;
    const iva = sub * ((it.tax || 0) / 100);
    const total = sub + iva;
    return { base, disc, sub, iva, total };
};

export interface NotaFormDrawerProps {
    isOpen: boolean;
    toggle: () => void;
    kind: NotaKind;
    preloadInvoiceId?: string | number | null;
    onSaved?: () => void;
}

const NotaFormDrawer: React.FC<NotaFormDrawerProps> = ({
    isOpen,
    toggle,
    kind,
    preloadInvoiceId,
    onSaved,
}) => {
    const headers = useAuthHeaders();
    const label = kind === 'credit' ? 'crédito' : 'débito';
    const endpoint = kind === 'credit' ? 'credit-notes' : 'debit-notes';
    const REASONS = kind === 'credit' ? REASONS_CREDIT : REASONS_DEBIT;
    const OTHER_CODE = kind === 'credit' ? '6' : '4';

    // Campos del formulario (mismos nombres que Notas.tsx)
    const [saving, setSaving] = useState(false);
    const [clientName, setClientName] = useState('');
    const [clientDocType, setClientDocType] = useState('NIT');
    const [clientNit, setClientNit] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [dateIssue, setDateIssue] = useState(todayIso());
    const [relatedInvoice, setRelatedInvoice] = useState('');
    // `reason` ahora es el CÓDIGO DIAN (1..6 / 1..4); `reasonOther` queda
    // como texto libre para detalle cuando se eligió "Otros".
    const [reason, setReason] = useState(REASONS[0].code);
    const [reasonOther, setReasonOther] = useState('');
    const [reasonDetail, setReasonDetail] = useState('');
    const [responsibleName, setResponsibleName] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<NoteItem[]>([emptyItem()]);

    // Campo nuevo: tipo de nota (normal vs anulación total)
    const [noteType, setNoteType] = useState<string>('normal');

    // Facturas del cliente (para el dropdown)
    const [clientInvoices, setClientInvoices] = useState<any[]>([]);

    const s = getCrumiFormStyles(saving);

    const resetForm = useCallback(() => {
        setClientName('');
        setClientDocType('NIT');
        setClientNit('');
        setClientEmail('');
        setDateIssue(todayIso());
        setRelatedInvoice('');
        setReason(REASONS[0].code);
        setReasonOther('');
        setReasonDetail('');
        setResponsibleName('');
        setNotes('');
        setItems([emptyItem()]);
        setNoteType('normal');
    }, [REASONS]);

    // Reset cuando se cierra
    useEffect(() => {
        if (!isOpen) resetForm();
    }, [isOpen, resetForm]);

    // Prefill desde la factura cuando el drawer se abre con preloadInvoiceId
    useEffect(() => {
        if (!isOpen || !preloadInvoiceId) return;
        const ctrl = new AbortController();
        fetch(`${API_ROOT}/invoices/${preloadInvoiceId}`, { headers, signal: ctrl.signal })
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                const inv = d?.invoice;
                if (!inv) return;
                setClientName(inv.client_name || '');
                setClientDocType(inv.client_document_type || 'NIT');
                setClientNit(inv.client_document_number || inv.client_identification || '');
                setClientEmail(inv.client_email || '');
                const number = inv.invoice_number && String(inv.invoice_number).trim()
                    ? inv.invoice_number
                    : `F-${inv.id}`;
                setRelatedInvoice(number);
                const invItems: any[] = Array.isArray(inv.items) ? inv.items : [];
                if (invItems.length > 0) {
                    setItems(invItems.map(it => ({
                        description: it.description || '',
                        quantity: Number(it.quantity) || 0,
                        unitPrice: Number(it.unit_price) || 0,
                        discount: Number(it.discount) || 0,
                        tax: Number(it.tax_rate) || 0,
                    })));
                }
            })
            .catch(() => { /* ignore */ });
        return () => ctrl.abort();
    }, [isOpen, preloadInvoiceId, headers]);

    // Cargar facturas del cliente cuando cambia el cliente (para el dropdown de factura relacionada)
    useEffect(() => {
        const doc = clientNit.trim();
        const name = clientName.trim();
        if (!isOpen || (!doc && !name)) { setClientInvoices([]); return; }
        const ctrl = new AbortController();
        const params = new URLSearchParams();
        if (doc) params.append('clientDocumentNumber', doc);
        if (name) params.append('clientName', name);
        fetch(`${API_ROOT}/invoices?${params.toString()}`, { headers, signal: ctrl.signal })
            .then((r) => (r.ok ? r.json() : { invoices: [] }))
            .then((d) => setClientInvoices(Array.isArray(d?.invoices) ? d.invoices : []))
            .catch(() => setClientInvoices([]));
        return () => ctrl.abort();
    }, [isOpen, clientNit, clientName, headers]);

    const selectedInvoice = useMemo(() => {
        const v = relatedInvoice.trim();
        if (!v) return undefined;
        return clientInvoices.find((i: any) => {
            const lbl = i.invoice_number && String(i.invoice_number).trim() ? i.invoice_number : `F-${i.id}`;
            return lbl === v;
        });
    }, [clientInvoices, relatedInvoice]);

    const totals = useMemo(() => {
        let sub = 0;
        let disc = 0;
        let iva = 0;
        let total = 0;
        items.forEach((it) => {
            const c = computeItem(it);
            sub += c.base;
            disc += c.disc;
            iva += c.iva;
            total += c.total;
        });
        return { sub, disc, iva, total };
    }, [items]);

    const isTotalCancel = noteType === 'anulacion-total';
    const isLocked = isTotalCancel;

    const updateItem = (idx: number, patch: Partial<NoteItem>) => {
        if (isLocked) return;
        setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    };
    const removeItem = (idx: number) => {
        if (isLocked) return;
        setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
    };
    const addItem = () => {
        if (isLocked) return;
        setItems((prev) => [...prev, emptyItem()]);
    };

    const validate = (): string | null => {
        if (!clientName.trim()) return 'Falta seleccionar el cliente.';
        if (!clientNit.trim()) return 'Falta el número de documento del cliente.';
        if (items.length === 0) return 'La nota debe tener al menos un ítem.';
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (!it.description.trim()) return `Línea ${i + 1}: falta la descripción.`;
            if (!it.quantity || it.quantity === 0) return `Línea ${i + 1}: la cantidad no puede ser cero.`;
        }
        return null;
    };

    const handleSave = async () => {
        const err = validate();
        if (err) {
            Swal.fire({
                icon: 'warning',
                title: 'No se puede guardar',
                text: err,
                confirmButtonColor: '#1A1D1F',
            });
            return;
        }
        setSaving(true);
        try {
            const body = {
                clientName: clientName.trim(),
                clientNit: clientNit.trim(),
                clientDocType,
                clientEmail: clientEmail.trim() || undefined,
                relatedInvoiceNumber: relatedInvoice.trim() || undefined,
                dateIssue,
                // El backend espera el código DIAN (1..6 / 1..4). El texto libre
                // de "Otros" lo enviamos en reasonDetail para trazabilidad.
                reason,
                reasonDetail:
                    reason === OTHER_CODE && reasonOther.trim()
                        ? `${reasonOther.trim()}${reasonDetail.trim() ? ` — ${reasonDetail.trim()}` : ''}`
                        : (reasonDetail.trim() || undefined),
                responsibleName: responsibleName.trim() || undefined,
                notes,
                noteType,
                items: items.map((it) => ({
                    description: it.description,
                    quantity: Number(it.quantity) || 0,
                    unitPrice: Number(it.unitPrice) || 0,
                    tax: Number(it.tax) || 0,
                    discount: Number(it.discount) || 0,
                })),
            };
            const res = await fetch(`${API_ROOT}/${endpoint}`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data && data.success) {
                toggle();
                resetForm();
                onSaved?.();
                if (data.partialFailure) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Nota creada, pero no se envió a DIAN',
                        text: data.message || (data.dian && data.dian.error) || 'Quedó en BORRADOR. Usá "Reenviar a DIAN" en la lista.',
                        confirmButtonColor: '#1A1D1F',
                    });
                }
            } else {
                Swal.fire({
                    icon: 'error',
                    title: (data && (data.error || data.message)) || 'No se pudo guardar la nota',
                    confirmButtonColor: '#1A1D1F',
                });
            }
        } catch (_e) {
            Swal.fire({
                icon: 'error',
                title: 'Error de red al guardar',
                confirmButtonColor: '#1A1D1F',
            });
        } finally {
            setSaving(false);
        }
    };

    // Estilo aplicado a inputs de la tabla cuando la nota está bloqueada
    // (anulación total). En ese caso no se permite editar valores de la factura.
    const lockedCellStyle: React.CSSProperties = isLocked
        ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' }
        : {};

    // Footer plano dentro del Offcanvas: NO usamos s.bottomBar (position:fixed)
    // porque rompe la disposición del drawer. En su lugar, sticky bottom dentro
    // del propio OffcanvasBody.
    const footerBarStyle: React.CSSProperties = {
        display: 'flex',
        gap: 12,
        justifyContent: 'flex-end',
        padding: '12px 0 0 0',
        marginTop: 16,
        borderTop: '1px solid #e5e7eb',
        position: 'sticky',
        bottom: 0,
        backgroundColor: '#ffffff',
        zIndex: 5,
    };

    return (
        <Offcanvas
            direction="end"
            isOpen={isOpen}
            toggle={toggle}
            style={{ width: '95vw', maxWidth: 1180 }}
        >
            <OffcanvasHeader toggle={toggle}>
                <div>
                    <h5 className="mb-0">Nueva nota {label}</h5>
                    <small className="text-muted">Nota {label} electrónica DIAN</small>
                </div>
            </OffcanvasHeader>
            <OffcanvasBody style={{ padding: 0 }}>
                <div style={{ ...s.wrapper, padding: '16px', paddingBottom: '16px', minHeight: 'auto' }}>
                    <div style={s.card}>
                        <div style={s.body}>
                            {/* Sección: Datos generales de la nota */}
                            <div style={s.sectionTitle}>
                                <i className="ri-file-list-3-line" /> Datos de la nota
                            </div>

                            <div style={s.formGrid}>
                                {/* Tipo de nota */}
                                <div style={s.formField}>
                                    <label style={s.label}>Tipo de nota</label>
                                    <select
                                        style={s.select}
                                        value={noteType}
                                        onChange={(e) => setNoteType(e.target.value)}
                                    >
                                        {NOTE_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                    <small style={{ color: '#6b7280', fontSize: 11 }}>
                                        {isTotalCancel
                                            ? 'Replica la factura original. Los valores de las líneas están bloqueados.'
                                            : 'Ajuste normal. Podés editar las líneas.'}
                                    </small>
                                </div>

                                {/* Fecha emisión */}
                                <div style={s.formField}>
                                    <label style={s.label}>
                                        Fecha emisión <span style={s.required}>*</span>
                                    </label>
                                    <input
                                        type="date"
                                        style={s.input}
                                        value={dateIssue}
                                        onChange={(e) => setDateIssue(e.target.value)}
                                    />
                                </div>
                            </div>

                            {isTotalCancel && (
                                <div style={{ ...s.infoBox, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <Lock size={16} style={{ marginTop: 2 }} />
                                    <div>
                                        <strong>Anulación total:</strong> no se pueden editar los valores
                                        de la factura. La nota replica concepto, cantidad, precio, descuento
                                        e IVA tal cual.
                                    </div>
                                </div>
                            )}

                            {/* Sección: Cliente */}
                            <div style={{ ...s.sectionTitle, marginTop: 8 }}>
                                <i className="ri-user-3-line" /> Cliente
                            </div>

                            <div style={s.formGrid}>
                                <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                                    <label style={s.label}>
                                        Cliente (nombre o razón social) <span style={s.required}>*</span>
                                    </label>
                                    <ClienteSelector
                                        value={clientName || null}
                                        onChange={(c: Cliente | null) => {
                                            if (c) {
                                                setClientName(c.name);
                                                setClientNit(c.document_number || '');
                                                if (c.document_type) setClientDocType(c.document_type);
                                                if (c.email) setClientEmail(c.email);
                                            } else {
                                                setClientName('');
                                                setClientNit('');
                                                setClientDocType('NIT');
                                                setClientEmail('');
                                            }
                                        }}
                                        fallbackLabel={clientName}
                                        allowCreate
                                    />
                                </div>

                                {clientName.trim() && clientNit.trim() ? (
                                    <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                                        <div
                                            style={{
                                                padding: '8px 10px',
                                                background: '#f9fafb',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: 8,
                                                fontSize: 13,
                                                color: '#374151',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <span>
                                                <strong>{clientDocType}</strong> · {clientNit}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => { setClientNit(''); setClientDocType('NIT'); }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#6b7280',
                                                    fontSize: 12,
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                }}
                                            >
                                                Editar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={s.formField}>
                                            <label style={s.label}>Tipo doc.</label>
                                            <select
                                                style={s.select}
                                                value={clientDocType}
                                                onChange={(e) => setClientDocType(e.target.value)}
                                            >
                                                {DOC_TYPES.map((d) => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={s.formField}>
                                            <label style={s.label}>Número</label>
                                            <input
                                                style={s.input}
                                                value={clientNit}
                                                onChange={(e) => setClientNit(e.target.value)}
                                                placeholder="900123456-7"
                                            />
                                        </div>
                                    </>
                                )}

                                <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                                    <label style={s.label}>Email cliente (opcional)</label>
                                    <input
                                        type="email"
                                        style={s.input}
                                        value={clientEmail}
                                        onChange={(e) => setClientEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Sección: Factura relacionada y motivo */}
                            <div style={{ ...s.sectionTitle, marginTop: 8 }}>
                                <i className="ri-link" /> Factura relacionada y motivo
                            </div>

                            <div style={s.formGrid}>
                                <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                                    <label style={s.label}>Factura relacionada</label>
                                    <select
                                        style={{
                                            ...s.select,
                                            opacity: clientInvoices.length === 0 ? 0.6 : 1,
                                            cursor: clientInvoices.length === 0 ? 'not-allowed' : 'pointer',
                                        }}
                                        value={relatedInvoice}
                                        onChange={(e) => setRelatedInvoice(e.target.value)}
                                        disabled={clientInvoices.length === 0}
                                    >
                                        <option value="">
                                            {clientInvoices.length === 0
                                                ? '-- Selecciona primero un cliente --'
                                                : `-- Selecciona una factura (${clientInvoices.length}) --`}
                                        </option>
                                        {clientInvoices.map((inv: any) => {
                                            const lbl = inv.invoice_number && String(inv.invoice_number).trim()
                                                ? inv.invoice_number
                                                : `F-${inv.id}`;
                                            return (
                                                <option key={inv.id} value={lbl}>
                                                    {lbl} · {String(inv.date || '').slice(0, 10)} · ${Number(inv.total || 0).toLocaleString('es-CO')}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {selectedInvoice && (
                                        <div
                                            style={{
                                                marginTop: 8,
                                                padding: '8px 10px',
                                                background: '#f0fdf4',
                                                border: '1px solid #86efac',
                                                borderRadius: 8,
                                                fontSize: 12,
                                                color: '#166534',
                                            }}
                                        >
                                            <div>
                                                <strong>Factura {selectedInvoice.invoice_number || `F-${selectedInvoice.id}`}</strong>
                                            </div>
                                            <div>Cliente: {selectedInvoice.client_name || '—'}</div>
                                            <div>
                                                Fecha: {String(selectedInvoice.date || '').slice(0, 10)} · Total: ${Number(selectedInvoice.total || 0).toLocaleString('es-CO')}
                                            </div>
                                            {selectedInvoice.status && <div>Estado: {selectedInvoice.status}</div>}
                                        </div>
                                    )}
                                </div>

                                <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                                    <label style={s.label}>Motivo (concepto DIAN)</label>
                                    <select
                                        style={s.select}
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    >
                                        {REASONS.map((r) => (
                                            <option key={r.code} value={r.code}>
                                                {r.code} — {r.label}
                                            </option>
                                        ))}
                                    </select>
                                    {reason === OTHER_CODE && (
                                        <input
                                            style={{ ...s.input, marginTop: 8 }}
                                            placeholder="Describe el motivo"
                                            value={reasonOther}
                                            onChange={(e) => setReasonOther(e.target.value)}
                                        />
                                    )}
                                </div>

                                <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                                    <label style={s.label}>
                                        Análisis / motivo detallado{' '}
                                        <span style={{ color: '#6b7280', fontSize: 11 }}>(trazabilidad)</span>
                                    </label>
                                    <textarea
                                        style={s.textarea}
                                        rows={3}
                                        value={reasonDetail}
                                        onChange={(e) => setReasonDetail(e.target.value)}
                                        placeholder="Explica con detalle por qué se emite esta nota (soporte, causa raíz, acuerdo con el cliente, etc.)"
                                    />
                                </div>

                                <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                                    <label style={s.label}>
                                        Responsable / aprobador{' '}
                                        <span style={{ color: '#6b7280', fontSize: 11 }}>(quien autoriza)</span>
                                    </label>
                                    <input
                                        style={s.input}
                                        value={responsibleName}
                                        onChange={(e) => setResponsibleName(e.target.value)}
                                        placeholder="Nombre de quien autoriza la emisión de esta nota"
                                    />
                                </div>

                                <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                                    <label style={s.label}>Notas / observaciones</label>
                                    <textarea
                                        style={s.textarea}
                                        rows={3}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Sección: Ítems */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginTop: 8,
                                    marginBottom: 12,
                                }}
                            >
                                <div style={{ ...s.sectionTitle, marginBottom: 0 }}>
                                    <i className="ri-list-check-2" /> Ítems
                                </div>
                                <button
                                    style={{
                                        ...s.btnSecondary,
                                        padding: '6px 12px',
                                        fontSize: '13px',
                                        opacity: isLocked ? 0.5 : 1,
                                        cursor: isLocked ? 'not-allowed' : 'pointer',
                                    }}
                                    onClick={addItem}
                                    disabled={isLocked}
                                    title={isLocked ? 'Bloqueado en anulación total' : ''}
                                >
                                    <i className="ri-add-line" /> agregar ítem
                                </button>
                            </div>

                            <div style={s.tableWrapper}>
                                <table style={s.table}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...s.th, minWidth: 160 }}>Descripción</th>
                                            <th style={{ ...s.th, width: 70 }}>Cant.</th>
                                            <th style={{ ...s.th, width: 110 }}>V. unit.</th>
                                            <th style={{ ...s.th, width: 70 }}>Desc %</th>
                                            <th style={{ ...s.th, width: 70 }}>IVA %</th>
                                            <th style={{ ...s.th, width: 110, textAlign: 'right' }}>Total</th>
                                            <th style={{ ...s.th, width: 40 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => {
                                            const c = computeItem(it);
                                            return (
                                                <tr key={idx}>
                                                    <td style={s.td}>
                                                        <input
                                                            style={{ ...s.inputCell, ...lockedCellStyle }}
                                                            value={it.description}
                                                            readOnly={isLocked}
                                                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                                                        />
                                                    </td>
                                                    <td style={s.td}>
                                                        <input
                                                            type="number"
                                                            style={{ ...s.inputCell, ...lockedCellStyle }}
                                                            value={it.quantity}
                                                            readOnly={isLocked}
                                                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                                                        />
                                                    </td>
                                                    <td style={s.td}>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            style={{ ...s.inputCell, ...lockedCellStyle }}
                                                            value={it.unitPrice}
                                                            readOnly={isLocked}
                                                            onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                                                        />
                                                    </td>
                                                    <td style={s.td}>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            style={{ ...s.inputCell, ...lockedCellStyle }}
                                                            value={it.discount}
                                                            readOnly={isLocked}
                                                            onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })}
                                                        />
                                                    </td>
                                                    <td style={s.td}>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            style={{ ...s.inputCell, ...lockedCellStyle }}
                                                            value={it.tax}
                                                            readOnly={isLocked}
                                                            onChange={(e) => updateItem(idx, { tax: Number(e.target.value) })}
                                                        />
                                                    </td>
                                                    <td
                                                        style={{
                                                            ...s.td,
                                                            textAlign: 'right',
                                                            paddingRight: '12px',
                                                            fontWeight: 600,
                                                            fontFamily: 'monospace',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {money(c.total)}
                                                    </td>
                                                    <td style={{ ...s.td, textAlign: 'center' }}>
                                                        <button
                                                            style={{
                                                                ...s.deleteBtn,
                                                                opacity: isLocked || items.length === 1 ? 0.4 : 1,
                                                                cursor: isLocked || items.length === 1 ? 'not-allowed' : 'pointer',
                                                            }}
                                                            disabled={isLocked || items.length === 1}
                                                            onClick={() => removeItem(idx)}
                                                        >
                                                            <i className="ri-delete-bin-line" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totales */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                                <div style={{ ...s.totalsBox, minWidth: 320 }}>
                                    <div style={s.totalRow}>
                                        <span>Subtotal</span>
                                        <span style={{ fontFamily: 'monospace' }}>{money(totals.sub)}</span>
                                    </div>
                                    <div style={s.totalRow}>
                                        <span>Descuento</span>
                                        <span style={{ fontFamily: 'monospace' }}>-{money(totals.disc)}</span>
                                    </div>
                                    <div style={s.totalRow}>
                                        <span>IVA</span>
                                        <span style={{ fontFamily: 'monospace' }}>{money(totals.iva)}</span>
                                    </div>
                                    <div style={s.totalFinal}>
                                        <span>Total</span>
                                        <span style={{ fontFamily: 'monospace' }}>{money(totals.total)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer plano dentro del Offcanvas (sticky bottom). */}
                            <div style={footerBarStyle}>
                                <button
                                    style={s.btnSecondary}
                                    onClick={toggle}
                                    disabled={saving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    style={s.btnPrimary}
                                    onClick={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? 'Guardando…' : `Emitir nota ${label}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </OffcanvasBody>
        </Offcanvas>
    );
};

export default NotaFormDrawer;
