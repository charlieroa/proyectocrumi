// src/pages/income/SalesInvoice/tabs/NotaDebitoTab.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DocumentConfig } from '../Create';
import AutocompleteInput from '../../../../Components/AutocompleteInput';
import useAccountingCustomers from '../../../../Components/Contabilidad/useAccountingCustomers';
import { getCrumiFormStyles } from '../crumiFormStyles';
import { env } from '../../../../env';
import { getProducts, Product } from '../../../../services/productApi';
import { getServicesByTenant, ServiceItem } from '../../../../services/serviceApi';
import { getTenantIdFromToken } from '../../../../services/auth';
import { getCostCenters, CostCenter } from '../../../../services/costCenterApi';
import {
    Alert,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
} from 'reactstrap';

interface DebitNoteItem {
    id: number;
    item: string;
    description: string;
    costCenter: string;
    quantity: number;
    price: string;
    tax: string;
    total: number;
    productId?: number | null;
    serviceId?: number | null;
}

interface NotaDebitoTabProps {
    config: DocumentConfig;
    isTestMode?: boolean; // Indica si estamos creando documentos para el Set de Pruebas
}

// ============================================
// MOCK DATA (si no hay API aún, backend: TODO)
// ============================================
// TODO: backend — reemplazar por fetch real de sucursales del tenant (GET /branches)
const BRANCHES_MOCK = [
    { id: 1, label: 'Principal' },
    { id: 2, label: 'Sucursal Norte' },
];

// TODO: backend — reemplazar por fetch real de centros de costo (GET /cost-centers)
const COST_CENTERS_MOCK = [
    { id: '1', label: 'General' },
    { id: '2', label: 'Ventas' },
    { id: '3', label: 'Administración' },
];

type InvoiceSummary = {
    id: number | string;
    invoice_number?: string;
    client_name?: string;
    client_document_number?: string;
    date?: string;
    due_date?: string;
    total?: number | string;
    status?: string;
    cufe?: string | null;
    invoice_class?: string;
};

// Catálogo de motivos de nota débito (códigos DIAN 1-4).
// `code` se envía al backend como `reason`; `label` es lo que ve el usuario.
const DEBIT_REASONS: { code: string; label: string }[] = [
    { code: '1', label: 'Intereses' },
    { code: '2', label: 'Gastos por cobrar' },
    { code: '3', label: 'Cambio del valor' },
    { code: '4', label: 'Otros' },
];
const DEBIT_REASON_OTHER_CODE = '4';

// Tipos de nota débito. La anulación total NO aplica a NDs (una ND incrementa
// el valor de la factura, no la anula), así que solo dejamos "Ajuste".
const DEBIT_NOTE_TYPES = [
    { value: 'ajuste', label: 'Ajuste / cargo adicional' },
];

const NotaDebitoTab: React.FC<NotaDebitoTabProps> = ({ config, isTestMode = false }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preloadInvoiceId = searchParams.get('invoiceId');

    // Clientes del módulo contable (tabla third_parties)
    const { customers: crmcontacts } = useAccountingCustomers();

    const [loading, setLoading] = useState(false);
    const [documentNumber] = useState('AUTO');
    const [logoUrl, setLogoUrl] = useState('');
    const [companyName] = useState('armadilloazul');

    // Modal de confirmación
    const [showConfirmModal, setShowConfirmModal] = useState(false);

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
        documentType: 'Nota Débito',
        warehouse: 'Principal',
        priceList: 'General',
        branchId: '1',
        seller: '',
        clientDocType: 'CC',
        clientDocNumber: '',
        clientName: '',
        email: '',
        date: today,
        relatedInvoiceNumber: '',
        relatedInvoiceDate: '',
        debitPrefix: 'ND',
        debitNumber: '',
        debitKind: 'ajuste', // solo 'ajuste' (anulación total no aplica a ND)
        debitReason: '',
        debitReasonOther: '', // cuando se elige "Otro (especificar)"
        paymentMethod: 'Sin pago',
        notes: '',
        // Análisis libre para trazabilidad (se persiste en reason_detail)
        reasonDetail: '',
        // Responsable que autoriza
        responsibleName: ''
    });

    const emptyItem = (id: number): DebitNoteItem => ({
        id,
        item: '',
        description: '',
        costCenter: '1',
        quantity: 1,
        price: '',
        tax: '',
        total: 0,
        productId: null,
        serviceId: null,
    });

    const [items, setItems] = useState<DebitNoteItem[]>([emptyItem(1)]);

    // Catálogo Productos & Servicios
    const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
    const [catalogServices, setCatalogServices] = useState<ServiceItem[]>([]);
    const [costCentersList, setCostCentersList] = useState<CostCenter[]>([]);
    useEffect(() => {
        const tid = getTenantIdFromToken();
        getProducts().then((r) => setCatalogProducts(r.data || [])).catch(() => {});
        if (tid) getServicesByTenant(tid).then((r) => setCatalogServices(r.data || [])).catch(() => {});
        getCostCenters().then((r) => setCostCentersList(r.data || [])).catch(() => {});
    }, []);
    const catalogOptions = useMemo(() => {
        const prods = catalogProducts.map((p) => ({ type: 'product' as const, id: Number(p.id), name: p.name, sku: p.sku || '', price: Number(p.price ?? p.sale_price ?? 0), taxRate: Number(p.tax_rate ?? 0) }));
        const svcs = catalogServices.map((s) => ({ type: 'service' as const, id: Number(s.id), name: s.name, sku: s.sku || '', price: Number(s.price ?? 0), taxRate: Number(s.tax_rate ?? 0) }));
        return [...prods, ...svcs];
    }, [catalogProducts, catalogServices]);
    const linkCatalogToItem = (rowId: number, name: string) => {
        const match = catalogOptions.find((o) => o.name.toLowerCase() === name.toLowerCase().trim());
        setItems((prev) => prev.map((it) => {
            if (it.id !== rowId) return it;
            if (match) {
                return {
                    ...it, item: match.name,
                    price: it.price || String(match.price || ''),
                    tax: it.tax || String(match.taxRate || ''),
                    description: it.description || match.name,
                    productId: match.type === 'product' ? match.id : null,
                    serviceId: match.type === 'service' ? match.id : null,
                };
            }
            return { ...it, item: name, productId: null, serviceId: null };
        }));
    };

    // Facturas reales del cliente seleccionado
    const [clientInvoices, setClientInvoices] = useState<InvoiceSummary[]>([]);

    // Prefill desde ?invoiceId=X (shortcut desde la lista de facturas de venta).
    useEffect(() => {
        if (!preloadInvoiceId) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        const ctrl = new AbortController();
        fetch(`${env.API_URL}/invoices/${preloadInvoiceId}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ctrl.signal,
        })
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                const inv = d?.invoice;
                if (!inv) return;
                const invoiceLabel = inv.invoice_number || `F-${inv.id}`;
                setFormData(prev => ({
                    ...prev,
                    clientDocNumber: inv.client_document_number || inv.client_identification || inv.client_id || '',
                    clientName: inv.client_name || '',
                    email: inv.client_email || prev.email,
                    relatedInvoiceNumber: invoiceLabel,
                    relatedInvoiceDate: String(inv.date_issue || '').slice(0, 10),
                }));
                const srcItems = Array.isArray(inv.items) ? inv.items : [];
                if (srcItems.length > 0) {
                    setItems(srcItems.map((it: any, idx: number) => ({
                        id: idx + 1,
                        item: it.description || '',
                        description: it.description || '',
                        costCenter: '1',
                        quantity: Number(it.quantity) || 1,
                        price: String(it.unit_price ?? ''),
                        tax: String(it.tax_rate ?? ''),
                        total: Number(it.total) || 0,
                    })));
                }
            })
            .catch(() => { /* noop */ });
        return () => ctrl.abort();
    }, [preloadInvoiceId]);

    useEffect(() => {
        const doc = formData.clientDocNumber?.trim();
        const name = formData.clientName?.trim();
        if (!doc && !name) { setClientInvoices([]); return; }
        const token = localStorage.getItem('token');
        if (!token) { setClientInvoices([]); return; }
        const ctrl = new AbortController();
        const params = new URLSearchParams();
        if (doc) params.append('clientDocumentNumber', doc);
        if (name) params.append('clientName', name);
        fetch(`${env.API_URL}/invoices?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ctrl.signal,
        })
            .then(r => (r.ok ? r.json() : { invoices: [] }))
            .then(d => setClientInvoices(Array.isArray(d?.invoices) ? d.invoices : []))
            .catch(() => setClientInvoices([]));
        return () => ctrl.abort();
    }, [formData.clientDocNumber, formData.clientName]);

    useEffect(() => {
        const num = formData.relatedInvoiceNumber?.trim();
        if (!num) return;
        const match = clientInvoices.find(i => {
            const label = i.invoice_number && i.invoice_number.trim() ? i.invoice_number : `F-${i.id}`;
            return label === num;
        });
        if (match && match.date) {
            const iso = String(match.date).slice(0, 10);
            if (iso !== formData.relatedInvoiceDate) {
                setFormData(prev => ({ ...prev, relatedInvoiceDate: iso }));
            }
        }
    }, [formData.relatedInvoiceNumber, clientInvoices]);

    const selectedInvoice = useMemo(() => {
        const v = formData.relatedInvoiceNumber?.trim();
        if (!v) return undefined;
        return clientInvoices.find(i => {
            const label = i.invoice_number && i.invoice_number.trim() ? i.invoice_number : `F-${i.id}`;
            return label === v;
        });
    }, [clientInvoices, formData.relatedInvoiceNumber]);

    // =========================
    // Handlers básicos
    // =========================
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
                    clientDocNumber: foundClient.document_number || foundClient.identification || '',
                    clientDocType: foundClient.document_type || prev.clientDocType,
                    email: foundClient.email || '',
                }));
            }
        }

        // Auto-populate when client document number matches
        if (field === 'clientDocNumber') {
            const foundClient = crmcontacts.find((c: any) =>
                String(c.document_number || '') === value || String(c.identification || '') === value
            );
            if (foundClient) {
                const name = foundClient.name || `${foundClient.first_name || ''} ${foundClient.last_name || ''}`.trim();
                setFormData(prev => ({
                    ...prev,
                    clientDocNumber: value,
                    clientName: name,
                    clientDocType: foundClient.document_type || prev.clientDocType,
                    email: foundClient.email || ''
                }));
            }
        }

        // Preset: si el motivo es "Intereses" (código DIAN 1), auto-crear 1 línea preconfigurada
        if (field === 'debitReason' && value === '1') {
            setItems(() => [{
                id: 1,
                item: 'Intereses de mora',
                description: '',
                costCenter: '1',
                quantity: 1,
                price: '',
                tax: '0',
                total: 0,
            }]);
        }

    };

    const addItem = () => {
        const newId = Math.max(...items.map(i => i.id), 0) + 1;
        setItems(prev => [...prev, emptyItem(newId)]);
    };

    const removeItem = (id: number) => {
        if (items.length > 1) {
            setItems(prev => prev.filter(i => i.id !== id));
        }
    };

    const updateItem = (id: number, field: keyof DebitNoteItem, value: string | number) => {
        setItems(prev =>
            prev.map(item => {
                if (item.id !== id) return item;

                const updated: DebitNoteItem = { ...item, [field]: value } as DebitNoteItem;

                const price = parseFloat(updated.price) || 0;
                const qty = updated.quantity || 0;
                const taxRate = parseFloat(updated.tax) || 0;

                const subtotal = price * qty;
                const taxAmount = subtotal * (taxRate / 100);
                updated.total = subtotal + taxAmount;

                return updated;
            })
        );
    };

    // =========================
    // Cálculos (sin descuento ni retenciones — nota débito es por cargos)
    // =========================
    const calculateSubtotal = () =>
        items.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * i.quantity, 0);

    const calculateTotalTax = () =>
        items.reduce((sum, i) => {
            const price = parseFloat(i.price) || 0;
            const taxRate = parseFloat(i.tax) || 0;
            return sum + price * i.quantity * (taxRate / 100);
        }, 0);

    const calculateTotal = () => calculateSubtotal() + calculateTotalTax();

    // Código DIAN que se envía al backend (1..4).
    const resolvedReasonCode = formData.debitReason || '';
    // Texto humano para mostrar en el modal de confirmación.
    const resolvedReasonLabel = useMemo(() => {
        if (formData.debitReason === DEBIT_REASON_OTHER_CODE) {
            return formData.debitReasonOther?.trim() || 'Otros';
        }
        return DEBIT_REASONS.find(r => r.code === formData.debitReason)?.label || '';
    }, [formData.debitReason, formData.debitReasonOther]);

    // =========================
    // Validación previa a abrir modal
    // =========================
    const openConfirm = () => {
        if (!formData.clientName) {
            return alert('⚠️ Debes seleccionar un cliente');
        }
        if (!formData.relatedInvoiceNumber) {
            return alert('⚠️ Debes indicar la factura asociada');
        }
        if (!formData.debitReason) {
            return alert('⚠️ Debes seleccionar un motivo');
        }
        if (formData.debitReason === DEBIT_REASON_OTHER_CODE && !formData.debitReasonOther.trim()) {
            return alert('⚠️ Especifica el motivo en el campo de texto libre');
        }
        if (items.some(i => !i.item || !i.price)) {
            return alert('⚠️ Completa todos los ítems (concepto y valor unitario)');
        }

        // Si la factura origen no tiene CUFE, la ND quedará en BORRADOR.
        if (selectedInvoice && !selectedInvoice.cufe && (selectedInvoice.invoice_class === 'ELECTRONICA' || !selectedInvoice.invoice_class)) {
            const ok = window.confirm(
                'La factura asociada no tiene CUFE — todavía no fue aceptada por la DIAN. ' +
                'Si emitís la nota débito ahora quedará en BORRADOR (no irá a DIAN). ¿Continuar igual?'
            );
            if (!ok) return;
        }

        if (!formData.email && !window.confirm('El cliente no tiene email — Alegra no podrá notificarlo. ¿Continuar?')) {
            return;
        }

        setShowConfirmModal(true);
    };

    // =========================
    // Guardar en backend (el endpoint POST /debit-notes no se toca)
    // =========================
    const handleSave = async () => {
        setShowConfirmModal(false);
        setLoading(true);

        const paymentMeanCode = (() => {
            const map: Record<string, string> = {
                'Sin pago': '10',
                Efectivo: '10',
                Transferencia: '31',
                Tarjeta: '48',
                Consignación: '42'
            };
            return map[formData.paymentMethod] || '10';
        })();

        const payload = {
            clientId: formData.clientDocNumber || null,
            clientNit: formData.clientDocNumber || null,
            clientName: formData.clientName,
            clientDocType: formData.clientDocType,
            clientEmail: formData.email || null,
            relatedInvoiceNumber: formData.relatedInvoiceNumber,
            dateIssue: formData.date,
            warehouse: formData.warehouse,
            priceList: formData.priceList,
            paymentMethod: formData.paymentMethod === 'Sin pago' ? null : formData.paymentMethod,
            paymentMeanCode,
            notes: formData.notes || null,
            referenceNote: `Ajuste generado desde nota débito`,
            terms: null,
            // Código DIAN (1..4) y label humano. El backend usa `reason` como conceptCode.
            reason: resolvedReasonCode || '1',
            reasonLabel: resolvedReasonLabel || null,
            // Trazabilidad: persistir motivo libre + análisis en reason_detail
            reasonDetail: (() => {
                const otherPart = formData.debitReason === DEBIT_REASON_OTHER_CODE && formData.debitReasonOther.trim()
                    ? formData.debitReasonOther.trim() : '';
                const analysisPart = (formData.reasonDetail || '').trim();
                return [otherPart, analysisPart].filter(Boolean).join(' — ') || null;
            })(),
            responsibleName: formData.responsibleName.trim() || null,
            items: items.map(i => ({
                item: i.item,
                quantity: Number(i.quantity),
                unitPrice: Number(i.price),
                discount: 0,
                tax: Number(i.tax) || 0,
                productId: i.productId ?? null,
                serviceId: i.serviceId ?? null,
            })),
            // Campos nuevos como extras (no rompen el contrato del endpoint)
            extras: {
                branchId: formData.branchId,
                relatedInvoiceDate: formData.relatedInvoiceDate || null,
                debitPrefix: formData.debitPrefix,
                debitNumber: formData.debitNumber || null,
                debitKind: formData.debitKind, // 'ajuste' | 'anulacion-total'
                reasonCatalog: formData.debitReason,
                reasonOther: formData.debitReason === DEBIT_REASON_OTHER_CODE ? formData.debitReasonOther : null,
                itemsExtras: items.map(i => ({
                    id: i.id,
                    description: i.description,
                    costCenter: i.costCenter,
                })),
            },
            // Set de Pruebas - Modo prueba
            isTestMode: isTestMode || false
        };

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No se encontró token de autenticación.');

            const response = await fetch(`${env.API_URL}/debit-notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al crear la nota débito');
            }

            alert(
                `✅ Nota Débito creada exitosamente\n\n` +
                `Número: ${data.debitNote?.number || 'N/D'}\n` +
                `Total: $${(data.debitNote?.total || 0).toLocaleString()}`
            );

            navigate('/ingresos/documentos');
        } catch (err: any) {
            console.error('❌ Error al guardar nota débito:', err);
            alert(`Error al guardar la nota débito:\n${err.message}`);
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
    // OJO: usar el documento real (NIT/CC) del tercero, no el PK interno.
    const clientDocOptions = useMemo(() => {
        return (crmcontacts || [])
            .filter((c: any) => c.document_number || c.identification)
            .map((client: any) => {
                const name = client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim();
                const doc = String(client.document_number || client.identification || '');
                return {
                    value: doc,
                    label: doc,
                    sublabel: name
                };
            });
    }, [crmcontacts]);

    const isTotalCancel = formData.debitKind === 'anulacion-total';
    const isLocked = isTotalCancel; // en anulación total no se edita el valor de la factura
    const lockedInputStyle = isLocked ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {};

    return (
        <div style={s.wrapper}>
            <div style={s.card}>
                {/* Barra superior */}
                <div style={s.topBar}>
                    <div>
                        <label style={s.topLabel}>Tipo de documento</label>
                        <select
                            style={{ ...s.topSelect, ...s.topSelectActive }}
                            value="Nota Débito"
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
                    <div>
                        <label style={s.topLabel}>Sucursal</label>
                        <select
                            style={s.topSelect}
                            value={formData.branchId}
                            onChange={e => handleFormChange('branchId', e.target.value)}
                        >
                            {BRANCHES_MOCK.map(b => (
                                <option key={b.id} value={b.id}>{b.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={s.topLabel}>Lista de precios</label>
                        <select
                            style={{ ...s.topSelect, ...(isTestMode ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                            value={formData.priceList}
                            onChange={e => !isTestMode && handleFormChange('priceList', e.target.value)}
                            disabled={isTestMode}
                            title={isTestMode ? 'Campo no requerido para facturación electrónica' : ''}
                        >
                            <option value="General">General</option>
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
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                                        <i className="ri-camera-line" />
                                    </div>
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
                        <div style={s.invoiceNum}>
                            {documentNumber}
                            <span style={{ fontSize: '16px', color: '#9ca3af', cursor: 'pointer' }}>
                                <i className="ri-settings-3-line" />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={s.body}>
                    {/* Aviso informativo */}
                    <Alert color="info" className="d-flex align-items-start gap-2 mb-3">
                        <i className="ri-information-line fs-18 mt-1" />
                        <div>
                            <strong>¿Cuándo usar nota débito?</strong>
                            <div className="fs-13">
                                Para cargar montos adicionales sobre una factura emitida: intereses de mora,
                                ajustes al alza, gastos de cobranza. Si necesitas reducir el valor, usa{' '}
                                <strong>nota crédito</strong>.
                            </div>
                        </div>
                    </Alert>

                    {/* Header del formulario */}
                    <div style={s.formGrid}>
                        {/* Documento cliente */}
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
                                        placeholder="Nº de identificación"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cliente (nombre) — autocomplete */}
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

                        {/* Fecha de emisión */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Fecha de emisión <span style={s.required}>*</span>
                            </label>
                            <input
                                type="date"
                                style={s.input}
                                value={formData.date}
                                onChange={e => handleFormChange('date', e.target.value)}
                            />
                        </div>

                        {/* Factura asociada (datalist) */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Factura asociada <span style={s.required}>*</span>
                            </label>
                            <input
                                type="text"
                                list="debit-related-invoices"
                                style={s.input}
                                placeholder={clientInvoices.length > 0 ? 'Selecciona o escribe el número' : 'Selecciona primero un cliente'}
                                value={formData.relatedInvoiceNumber}
                                onChange={e => handleFormChange('relatedInvoiceNumber', e.target.value)}
                            />
                            <datalist id="debit-related-invoices">
                                {clientInvoices.map(inv => {
                                    const label = inv.invoice_number && inv.invoice_number.trim() ? inv.invoice_number : `F-${inv.id}`;
                                    return (
                                        <option key={inv.id} value={label}>
                                            {`${String(inv.date || '').slice(0,10)} · $${Number(inv.total || 0).toLocaleString('es-CO')}`}
                                        </option>
                                    );
                                })}
                            </datalist>
                            <small style={{ color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                                {clientInvoices.length === 0
                                    ? 'Este cliente no tiene facturas registradas'
                                    : `${clientInvoices.length} factura(s) del cliente`}
                            </small>
                            {selectedInvoice && (() => {
                                const hasCufe = !!selectedInvoice.cufe;
                                const isElectronic = selectedInvoice.invoice_class === 'ELECTRONICA' || !selectedInvoice.invoice_class;
                                const cufeWarn = isElectronic && !hasCufe;
                                return (
                                    <div style={{
                                        marginTop: 8,
                                        padding: '8px 10px',
                                        background: cufeWarn ? '#fef3c7' : '#f0fdf4',
                                        border: cufeWarn ? '1px solid #fbbf24' : '1px solid #86efac',
                                        borderRadius: 6,
                                        fontSize: 12,
                                        color: cufeWarn ? '#92400e' : '#166534',
                                    }}>
                                        <div><strong>Factura {selectedInvoice.invoice_number}</strong></div>
                                        <div>Cliente: {selectedInvoice.client_name || '—'}</div>
                                        <div>Fecha: {String(selectedInvoice.date || '').slice(0,10)} · Total: ${Number(selectedInvoice.total || 0).toLocaleString('es-CO')}</div>
                                        {selectedInvoice.status && <div>Estado: {selectedInvoice.status}</div>}
                                        {cufeWarn && (
                                            <div style={{ marginTop: 4, fontWeight: 600 }}>
                                                ⚠ Sin CUFE — la ND quedará en BORRADOR (no irá a DIAN).
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Fecha de la factura asociada */}
                        <div style={s.formField}>
                            <label style={s.label}>Fecha de la factura asociada</label>
                            <input
                                type="date"
                                style={s.input}
                                value={formData.relatedInvoiceDate}
                                onChange={e => handleFormChange('relatedInvoiceDate', e.target.value)}
                            />
                        </div>

                        {/* Prefijo / N° nota débito */}
                        <div style={s.formField}>
                            <label style={s.label}>Prefijo / N° nota débito</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    style={{ ...s.input, width: '80px' }}
                                    placeholder="ND"
                                    value={formData.debitPrefix}
                                    onChange={e => handleFormChange('debitPrefix', e.target.value)}
                                />
                                <input
                                    type="text"
                                    style={{ ...s.input, flex: 1 }}
                                    placeholder="Automático"
                                    value={formData.debitNumber}
                                    onChange={e => handleFormChange('debitNumber', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Tipo de nota débito */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Tipo de nota débito <span style={s.required}>*</span>
                            </label>
                            <select
                                style={s.select}
                                value={formData.debitKind}
                                onChange={e => handleFormChange('debitKind', e.target.value)}
                            >
                                {DEBIT_NOTE_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            <small style={{ color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                                {isTotalCancel
                                    ? 'Anulación total: la NC replica la factura original. Los valores no se pueden editar.'
                                    : 'Ajuste o cargo adicional sobre la factura (intereses, financiación, etc).'}
                            </small>
                        </div>

                        {/* Motivo (select catálogo) */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Motivo <span style={s.required}>*</span>
                            </label>
                            <select
                                style={{ ...s.select, ...(isTotalCancel ? lockedInputStyle : {}) }}
                                value={formData.debitReason}
                                disabled={isTotalCancel}
                                onChange={e => handleFormChange('debitReason', e.target.value)}
                            >
                                <option value="">Selecciona un motivo...</option>
                                {DEBIT_REASONS.map(r => (
                                    <option key={r.code} value={r.code}>
                                        {r.code} — {r.label}
                                    </option>
                                ))}
                            </select>
                            {formData.debitReason === DEBIT_REASON_OTHER_CODE && (
                                <input
                                    type="text"
                                    style={{ ...s.input, marginTop: '6px' }}
                                    placeholder="Especifica el motivo"
                                    value={formData.debitReasonOther}
                                    onChange={e => handleFormChange('debitReasonOther', e.target.value)}
                                />
                            )}
                        </div>

                        {/* Análisis libre y responsable (trazabilidad) */}
                        <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                            <label style={s.label}>
                                Análisis / motivo detallado{' '}
                                <span style={{ color: '#6b7280', fontSize: 11 }}>(trazabilidad)</span>
                            </label>
                            <textarea
                                style={{ ...s.textarea, width: '100%', boxSizing: 'border-box' }}
                                rows={3}
                                value={formData.reasonDetail}
                                onChange={e => handleFormChange('reasonDetail', e.target.value)}
                                placeholder="Explicá por qué se emite esta nota débito (causa raíz, soporte, acuerdo)"
                            />
                        </div>

                        <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                            <label style={s.label}>
                                Responsable / aprobador{' '}
                                <span style={{ color: '#6b7280', fontSize: 11 }}>(quién autoriza)</span>
                            </label>
                            <input
                                style={s.input}
                                value={formData.responsibleName}
                                onChange={e => handleFormChange('responsibleName', e.target.value)}
                                placeholder="Nombre de quien autoriza la ND"
                            />
                        </div>

                        {/* Correo */}
                        <div style={s.formField}>
                            <label style={s.label}>Correo</label>
                            <input
                                type="email"
                                style={s.input}
                                value={formData.email}
                                onChange={e => handleFormChange('email', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Tabla de líneas */}
                    <div style={s.tableWrapper}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    <th style={{ ...s.th, width: '22%' }}>Concepto</th>
                                    <th style={{ ...s.th, width: '22%' }}>Descripción</th>
                                    <th style={{ ...s.th, width: '14%' }}>C. Costo</th>
                                    <th style={{ ...s.th, width: '8%' }}>Cantidad</th>
                                    <th style={{ ...s.th, width: '12%' }}>V. Unitario</th>
                                    <th style={{ ...s.th, width: '10%' }}>% IVA</th>
                                    <th style={{ ...s.th, width: '10%', textAlign: 'right' }}>Valor total</th>
                                    <th style={{ ...s.th, width: '2%' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.id}>
                                        <td style={s.td}>
                                            <input
                                                type="text"
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                placeholder="Concepto"
                                                value={item.item}
                                                list={`nd-catalog-${item.id}`}
                                                readOnly={isLocked}
                                                onChange={e => {
                                                    updateItem(item.id, 'item', e.target.value);
                                                    linkCatalogToItem(item.id, e.target.value);
                                                }}
                                                onBlur={e => linkCatalogToItem(item.id, e.target.value)}
                                            />
                                            <datalist id={`nd-catalog-${item.id}`}>
                                                {catalogOptions.map((o) => (
                                                    <option key={`${o.type}-${o.id}`} value={o.name}>
                                                        {o.type === 'product' ? '[P]' : '[S]'} {o.sku ? `${o.sku} — ` : ''}{o.name}
                                                    </option>
                                                ))}
                                            </datalist>
                                            {(item.productId || item.serviceId) && (
                                                <div style={{ fontSize: 10, color: '#10b981', marginTop: 2 }}>✓ catálogo</div>
                                            )}
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="text"
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                placeholder="Descripción adicional"
                                                value={item.description}
                                                readOnly={isLocked}
                                                onChange={e => updateItem(item.id, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <select
                                                style={{ ...s.selectCell, ...lockedInputStyle }}
                                                value={item.costCenter}
                                                disabled={isLocked}
                                                onChange={e => updateItem(item.id, 'costCenter', e.target.value)}
                                            >
                                                <option value="">— Sin CC —</option>
                                                {costCentersList.length > 0
                                                    ? costCentersList.filter(cc => cc.is_active).map(cc => (
                                                        <option key={cc.id} value={cc.code}>{cc.code} — {cc.name}</option>
                                                    ))
                                                    : COST_CENTERS_MOCK.map(cc => (
                                                        <option key={cc.id} value={cc.id}>{cc.label}</option>
                                                    ))
                                                }
                                            </select>
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="number"
                                                min={1}
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                value={item.quantity}
                                                readOnly={isLocked}
                                                onChange={e =>
                                                    updateItem(
                                                        item.id,
                                                        'quantity',
                                                        parseInt(e.target.value || '1', 10)
                                                    )
                                                }
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="number"
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                placeholder="V. Unitario"
                                                value={item.price}
                                                readOnly={isLocked}
                                                onChange={e => updateItem(item.id, 'price', e.target.value)}
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <select
                                                style={{ ...s.selectCell, ...lockedInputStyle }}
                                                value={item.tax}
                                                disabled={isLocked}
                                                onChange={e => updateItem(item.id, 'tax', e.target.value)}
                                            >
                                                <option value="">% IVA</option>
                                                <option value="0">0%</option>
                                                <option value="5">5%</option>
                                                <option value="19">19%</option>
                                            </select>
                                        </td>
                                        <td
                                            style={{
                                                ...s.td,
                                                textAlign: 'right',
                                                paddingRight: '12px',
                                                fontWeight: 600
                                            }}
                                        >
                                            $ {item.total.toLocaleString()}
                                        </td>
                                        <td style={{ ...s.td, textAlign: 'center' }}>
                                            <button
                                                style={{
                                                    ...s.deleteBtn,
                                                    ...(isLocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                                                }}
                                                onClick={() => removeItem(item.id)}
                                                disabled={isLocked}
                                                title={isLocked ? 'No se pueden eliminar líneas en Anulación total' : 'Eliminar fila'}
                                            >
                                                <i className="ri-close-line" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button
                        style={{
                            ...s.addLineBtn,
                            ...(isLocked ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                        }}
                        onClick={addItem}
                        disabled={isLocked}
                        title={isLocked ? 'Anulación total: no se pueden agregar líneas nuevas' : ''}
                    >
                        + Agregar línea
                    </button>

                    {/* Footer: observaciones + totales */}
                    <div style={s.footerGrid}>
                        <div style={s.leftFooter}>
                            <div>
                                <div style={s.textareaLabel}>
                                    Observaciones
                                    <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>
                                        (Opcional)
                                    </span>
                                </div>
                                <textarea
                                    style={s.textarea}
                                    placeholder="Notas internas o visibles en el documento..."
                                    value={formData.notes}
                                    onChange={e => handleFormChange('notes', e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </div>

                        <div style={s.totalsBox}>
                            <div style={s.totalRow}>
                                <span>SubTotal</span>
                                <span>$ {calculateSubtotal().toLocaleString()}</span>
                            </div>
                            <div style={s.totalRow}>
                                <span>IVA</span>
                                <span>$ {calculateTotalTax().toLocaleString()}</span>
                            </div>
                            <div
                                style={{
                                    ...s.totalFinal,
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginTop: '4px',
                                }}
                            >
                                <span>TOTAL NOTA DÉBITO</span>
                                <span>$ {calculateTotal().toLocaleString()}</span>
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
                    <button style={s.btnSecondary} onClick={openConfirm} disabled={loading}>
                        Guardar y crear nueva
                    </button>
                    <button style={s.btnPrimary} onClick={openConfirm} disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* Modal de confirmación */}
            <Modal
                isOpen={showConfirmModal}
                toggle={() => setShowConfirmModal(false)}
                centered
            >
                <ModalHeader toggle={() => setShowConfirmModal(false)}>
                    <i className="ri-error-warning-line me-2 text-warning" />
                    Confirmar emisión de nota débito
                </ModalHeader>
                <ModalBody>
                    <p className="mb-3">
                        ¿Confirmar emisión de nota débito por{' '}
                        <strong>$ {calculateTotal().toLocaleString()}</strong> a{' '}
                        <strong>{formData.clientName || 'cliente'}</strong>?
                    </p>
                    <ul className="list-unstyled mb-0">
                        <li className="mb-1">
                            <strong>Motivo:</strong> {resolvedReasonLabel || '—'}
                        </li>
                        <li className="mb-1">
                            <strong>Factura asociada:</strong> {formData.relatedInvoiceNumber || '—'}
                        </li>
                        {formData.relatedInvoiceDate && (
                            <li className="mb-1">
                                <strong>Fecha factura:</strong> {formData.relatedInvoiceDate}
                            </li>
                        )}
                    </ul>
                </ModalBody>
                <ModalFooter>
                    <Button color="light" onClick={() => setShowConfirmModal(false)}>
                        Cancelar
                    </Button>
                    <Button color="warning" onClick={handleSave} disabled={loading}>
                        {loading ? 'Emitiendo...' : 'Emitir'}
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default NotaDebitoTab;
