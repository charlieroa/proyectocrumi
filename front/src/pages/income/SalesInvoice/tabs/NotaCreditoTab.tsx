// src/pages/income/SalesInvoice/tabs/NotaCreditoTab.tsx
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
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Label,
    Input,
    Button,
    Row,
    Col,
    FormGroup,
} from 'reactstrap';

// ============================================
// INTERFACES
// ============================================
interface CreditNoteItem {
    id: number;
    item: string;
    reference: string;
    price: string;
    discount: string;
    tax: string;
    description: string;
    quantity: number;
    total: number;
    // Campos línea (ref. Siigo / paridad con FacturaTab)
    costCenter: string;         // Centro de costo
    retentionRate: string;      // % Retención en la Fuente por línea (opcional)
    productId?: number | null;
    serviceId?: number | null;
    unitCost?: number | null;
}

interface NotaCreditoTabProps {
    config: DocumentConfig;
    isTestMode?: boolean; // Indica si estamos creando documentos para el Set de Pruebas
}

// ============================================
// MOCK DATA (copiado de FacturaTab.tsx)
// ============================================
// TODO: backend — reemplazar por fetch real de sucursales del tenant
const BRANCHES_MOCK = [
    { id: 1, label: 'Principal' },
    { id: 2, label: 'Sucursal Norte' },
];

// TODO: backend — reemplazar por fetch real de centros de costo
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

// Tipos de nota crédito
const CREDIT_NOTE_TYPES = [
    { value: 'anulacion-total', label: 'Anulación total' },
    { value: 'devolucion-total', label: 'Devolución total' },
    { value: 'devolucion-parcial', label: 'Devolución parcial' },
    { value: 'descuento-ajuste', label: 'Descuento / ajuste' },
];

// Catálogo de motivos (códigos DIAN 1-6 para nota crédito).
// `code` se envía al backend como `reason`; `label` es lo que ve el usuario.
const REASON_OPTIONS: { code: string; label: string }[] = [
    { code: '1', label: 'Devolución parcial de bienes o servicios' },
    { code: '2', label: 'Anulación de la factura' },
    { code: '3', label: 'Rebaja o descuento total' },
    { code: '4', label: 'Ajuste de precio' },
    { code: '5', label: 'Descuento parcial' },
    { code: '6', label: 'Otros' },
];
const REASON_OTHER_CODE = '6';

// ============================================
// COMPONENTE
// ============================================
const NotaCreditoTab: React.FC<NotaCreditoTabProps> = ({ config, isTestMode = false }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preloadInvoiceId = searchParams.get('invoiceId');

    // Clientes del módulo contable (tabla third_parties)
    const { customers: crmcontacts } = useAccountingCustomers();

    const [loading, setLoading] = useState(false);
    const [documentNumber] = useState('AUTO');
    const [logoUrl, setLogoUrl] = useState('');
    const [companyName] = useState('armadilloazul');

    // Modal confirmación
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
        creditNoteType: 'Nota Crédito',
        branchId: '1',
        warehouse: 'Principal',
        priceList: 'General',
        seller: '',
        clientDocType: 'CC',
        clientDocNumber: '',
        clientName: '',
        email: '',
        date: today,

        // Factura asociada
        associatedInvoice: '',
        associatedInvoiceDate: '',

        // Numeración nota crédito
        creditNotePrefix: 'NC',
        creditNoteNumber: '',

        // Clasificación NC
        creditNoteKind: 'devolucion-parcial', // devolucion-total | devolucion-parcial | descuento-ajuste

        // Motivo: ahora guarda el código DIAN (1..6); el texto libre va en reasonOther
        reason: REASON_OPTIONS[0].code,
        reasonOther: '',
        // Análisis libre del usuario para trazabilidad (se persiste en reason_detail)
        reasonDetail: '',
        // Responsable que autoriza la NC
        responsibleName: '',

        // Destino del crédito
        creditDestination: 'reintegro', // reintegro | credito-cuenta

        // Extras
        notes: '',
        terms:
            'Esta nota crédito disminuye el valor de la factura asociada según las condiciones pactadas entre las partes.'
    });

    const [items, setItems] = useState<CreditNoteItem[]>([
        {
            id: 1,
            item: '',
            reference: '',
            price: '',
            discount: '',
            tax: '',
            description: '',
            quantity: 1,
            total: 0,
            costCenter: '1',
            retentionRate: '0',
            productId: null,
            serviceId: null,
            unitCost: null,
        }
    ]);

    // Catálogo Productos & Servicios (para devolver stock al kardex)
    const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
    const [catalogServices, setCatalogServices] = useState<ServiceItem[]>([]);
    const [costCentersList, setCostCentersList] = useState<CostCenter[]>([]);
    useEffect(() => {
        const tid = getTenantIdFromToken();
        getProducts().then((r) => setCatalogProducts(r.data || [])).catch(() => {});
        if (tid) {
            getServicesByTenant(tid).then((r) => setCatalogServices(r.data || [])).catch(() => {});
        }
        getCostCenters().then((r) => setCostCentersList(r.data || [])).catch(() => {});
    }, []);
    const catalogOptions = useMemo(() => {
        const prods = catalogProducts.map((p) => ({
            type: 'product' as const,
            id: Number(p.id),
            name: p.name,
            sku: p.sku || '',
            price: Number(p.price ?? p.sale_price ?? 0),
            taxRate: Number(p.tax_rate ?? 0),
            unitCost: Number(p.cost ?? p.cost_price ?? 0),
        }));
        const svcs = catalogServices.map((s) => ({
            type: 'service' as const,
            id: Number(s.id),
            name: s.name,
            sku: s.sku || '',
            price: Number(s.price ?? 0),
            taxRate: Number(s.tax_rate ?? 0),
            unitCost: 0,
        }));
        return [...prods, ...svcs];
    }, [catalogProducts, catalogServices]);
    const linkCatalogToItem = (rowId: number, name: string) => {
        const match = catalogOptions.find((o) => o.name.toLowerCase() === name.toLowerCase().trim());
        setItems((prev) => prev.map((it) => {
            if (it.id !== rowId) return it;
            if (match) {
                return {
                    ...it, item: match.name, reference: match.sku,
                    price: it.price || String(match.price || ''),
                    tax: it.tax || String(match.taxRate || ''),
                    description: it.description || match.name,
                    productId: match.type === 'product' ? match.id : null,
                    serviceId: match.type === 'service' ? match.id : null,
                    unitCost: match.type === 'product' ? match.unitCost : 0,
                };
            }
            return { ...it, item: name, productId: null, serviceId: null, unitCost: null };
        }));
    };

    // Facturas reales del cliente seleccionado (reemplaza el mock anterior)
    const [clientInvoices, setClientInvoices] = useState<InvoiceSummary[]>([]);

    // Prefill desde ?invoiceId=X cuando se entra desde la lista de facturas.
    // Carga cliente, factura asociada y los items para poder replicarlos en la NC
    // (especialmente útil en "Anulación total" donde las líneas quedan bloqueadas).
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
                    associatedInvoice: invoiceLabel,
                    associatedInvoiceDate: String(inv.date_issue || '').slice(0, 10),
                }));
                const srcItems = Array.isArray(inv.items) ? inv.items : [];
                if (srcItems.length > 0) {
                    setItems(srcItems.map((it: any, idx: number) => ({
                        id: idx + 1,
                        item: it.description || '',
                        reference: '',
                        price: String(it.unit_price ?? ''),
                        discount: String(it.discount ?? ''),
                        tax: String(it.tax_rate ?? ''),
                        description: it.description || '',
                        quantity: Number(it.quantity) || 1,
                        total: Number(it.total) || 0,
                        costCenter: '1',
                        retentionRate: '0',
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

    // Al cambiar la factura asociada, autopoblar fecha y datos visibles
    useEffect(() => {
        const num = formData.associatedInvoice?.trim();
        if (!num) return;
        const match = clientInvoices.find(i => {
            const label = i.invoice_number && i.invoice_number.trim() ? i.invoice_number : `F-${i.id}`;
            return label === num;
        });
        if (match && match.date) {
            const iso = String(match.date).slice(0, 10);
            if (iso !== formData.associatedInvoiceDate) {
                setFormData(prev => ({ ...prev, associatedInvoiceDate: iso }));
            }
        }
    }, [formData.associatedInvoice, clientInvoices]);

    const selectedInvoice = React.useMemo(() => {
        const v = formData.associatedInvoice?.trim();
        if (!v) return undefined;
        return clientInvoices.find(i => {
            const label = i.invoice_number && i.invoice_number.trim() ? i.invoice_number : `F-${i.id}`;
            return label === v;
        });
    }, [clientInvoices, formData.associatedInvoice]);

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

        if (field === 'associatedInvoice') {
            const match = clientInvoices.find(inv => {
                const label = inv.invoice_number && inv.invoice_number.trim() ? inv.invoice_number : `F-${inv.id}`;
                return label === value;
            });
            if (match && match.date) {
                setFormData(prev => ({
                    ...prev,
                    associatedInvoice: value,
                    associatedInvoiceDate: String(match.date).slice(0, 10),
                }));
            }
        }

        // Si el usuario cambia el tipo a "Devolución total" o "Anulación total",
        // marcamos las cantidades en negativo (asumimos que los items actuales
        // representan la factura original). En anulación total además se
        // bloquea toda la edición de líneas más abajo (isLocked).
        if (field === 'creditNoteKind' && (value === 'devolucion-total' || value === 'anulacion-total')) {
            setItems(prev =>
                prev.map(i => ({
                    ...i,
                    quantity: -Math.abs(i.quantity || 1),
                }))
            );
        }
    };

    const addItem = () => {
        const newId = Math.max(...items.map(i => i.id), 0) + 1;
        setItems(prev => [
            ...prev,
            {
                id: newId,
                item: '',
                reference: '',
                price: '',
                discount: '',
                tax: '',
                description: '',
                quantity: 1,
                total: 0,
                costCenter: '1',
                retentionRate: '0',
                productId: null,
                serviceId: null,
                unitCost: null,
            }
        ]);
    };

    const removeItem = (id: number) => {
        if (items.length <= 1) return;
        // Bloqueado en devolución total y anulación total (deben reflejar la factura original)
        if (formData.creditNoteKind === 'devolucion-total' || formData.creditNoteKind === 'anulacion-total') return;
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const updateItem = (
        id: number,
        field: keyof CreditNoteItem,
        value: string | number
    ) => {
        setItems(prev =>
            prev.map(item => {
                if (item.id !== id) return item;

                const updated: CreditNoteItem = { ...item, [field]: value as any };

                const price = parseFloat(updated.price) || 0;
                const qty = updated.quantity || 0;
                const disc = parseFloat(updated.discount) || 0;
                const taxRate = parseFloat(updated.tax) || 0;

                const subtotal = price * qty;
                const discountAmount = subtotal * (disc / 100);
                const taxable = subtotal - discountAmount;
                const taxAmount = taxable * (taxRate / 100);

                updated.total = taxable + taxAmount;

                return updated;
            })
        );
    };

    // =========================
    // Totales
    // =========================
    const taxableBaseLine = (i: CreditNoteItem) => {
        const price = parseFloat(i.price) || 0;
        const qty = i.quantity || 0;
        const disc = parseFloat(i.discount) || 0;
        return price * qty * (1 - disc / 100);
    };

    const calculateSubtotal = () =>
        items.reduce(
            (sum, i) => sum + (parseFloat(i.price) || 0) * i.quantity,
            0
        );

    const calculateTotalDiscount = () =>
        items.reduce((sum, i) => {
            const price = parseFloat(i.price) || 0;
            const qty = i.quantity || 0;
            const disc = parseFloat(i.discount) || 0;
            return sum + price * qty * (disc / 100);
        }, 0);

    const calculateGrossValue = () => calculateSubtotal() - calculateTotalDiscount();

    const calculateTotalTax = () =>
        items.reduce((sum, i) => {
            const base = taxableBaseLine(i);
            const taxRate = parseFloat(i.tax) || 0;
            return sum + base * (taxRate / 100);
        }, 0);

    const calculateReteFuente = () =>
        items.reduce((sum, i) => {
            const base = taxableBaseLine(i);
            const rf = parseFloat(i.retentionRate) || 0;
            return sum + base * (rf / 100);
        }, 0);

    const calculateTotal = () =>
        calculateGrossValue() + calculateTotalTax() - calculateReteFuente();

    // =========================
    // Guardado backend (abre modal antes de confirmar)
    // =========================
    const handleSaveClick = () => {
        if (!formData.clientName) {
            return alert('Debes seleccionar un cliente');
        }

        if (!formData.associatedInvoice) {
            return alert('Debes indicar la factura asociada');
        }

        if (items.some(i => !i.item || !i.price)) {
            return alert('Completa todos los ítems (nombre y precio)');
        }

        if (formData.reason === REASON_OTHER_CODE && !formData.reasonOther.trim()) {
            return alert('Especifica el motivo de la nota crédito');
        }

        // Si la factura origen no tiene CUFE, no se puede emitir NC electrónica.
        // Avisamos antes de generar el documento (el backend la dejaría en BORRADOR).
        if (selectedInvoice && !selectedInvoice.cufe && (selectedInvoice.invoice_class === 'ELECTRONICA' || !selectedInvoice.invoice_class)) {
            const ok = window.confirm(
                'La factura asociada no tiene CUFE — todavía no fue aceptada por la DIAN. ' +
                'Si emitís la nota crédito ahora quedará en BORRADOR (no irá a DIAN). ¿Continuar igual?'
            );
            if (!ok) return;
        }

        // Email recomendado para que Alegra notifique al cliente.
        if (!formData.email && !window.confirm('El cliente no tiene email — Alegra no podrá notificarlo. ¿Continuar?')) {
            return;
        }

        setShowConfirmModal(true);
    };

    const doSubmit = async () => {
        setShowConfirmModal(false);
        setLoading(true);

        // El backend espera el código DIAN (1..6) en `reason`. El texto libre
        // de "Otros" se manda como descripción/notas para trazabilidad.
        const finalReason = formData.reason;
        const reasonLabel =
            formData.reason === REASON_OTHER_CODE && formData.reasonOther.trim()
                ? formData.reasonOther.trim()
                : (REASON_OPTIONS.find(r => r.code === formData.reason)?.label || '');

        // NOTA: el endpoint POST /credit-notes no cambia. Los campos nuevos
        // (creditNoteKind, creditDestination, branchId, prefijo/numero,
        // associatedInvoiceDate, costCenter y retentionRate por línea) se
        // envían como propiedades extra; el backend las ignora si no las maneja.
        const payload = {
            creditNoteType: formData.creditNoteType,
            clientDocType: formData.clientDocType,
            clientNit: formData.clientDocNumber || null,
            clientName: formData.clientName,
            clientEmail: formData.email || null,
            dateIssue: formData.date,
            warehouse: formData.warehouse,
            priceList: formData.priceList,
            sellerId: formData.seller || null,
            relatedInvoiceNumber: formData.associatedInvoice,
            reason: finalReason,
            reasonLabel,
            // El backend persiste reasonDetail en la columna reason_detail
            // Concatenamos motivo libre ("Otros") + análisis para no perder nada.
            reasonDetail: (() => {
                const otherPart = formData.reason === REASON_OTHER_CODE && formData.reasonOther.trim()
                    ? formData.reasonOther.trim() : '';
                const analysisPart = formData.reasonDetail.trim();
                return [otherPart, analysisPart].filter(Boolean).join(' — ') || null;
            })(),
            responsibleName: formData.responsibleName.trim() || null,
            // El backend lee creditNoteKind para activar validación de anulación total.
            // Lo enviamos también como noteType (alias compatible con el Drawer).
            noteType: formData.creditNoteKind === 'anulacion-total' ? 'anulacion-total' : null,
            // compat con el backend actual (reintegrar dinero vs crédito a cuenta)
            returnType:
                formData.creditDestination === 'reintegro'
                    ? 'devolucion-dinero'
                    : 'credito-ventas',
            terms: formData.terms || null,
            notes: formData.notes || null,
            items: items.map(i => ({
                item: i.item,
                quantity: Number(i.quantity),
                unitPrice: Number(i.price),
                discount: Number(i.discount) || 0,
                tax: Number(i.tax) || 0,
                description: i.description || null,
                costCenter: i.costCenter,
                retentionRate: Number(i.retentionRate) || 0,
                productId: i.productId ?? null,
                serviceId: i.serviceId ?? null,
                unitCost: i.unitCost ?? null,
            })),

            // --- Campos NUEVOS (extras, el backend los ignora si no los maneja) ---
            branchId: formData.branchId,
            creditNoteKind: formData.creditNoteKind,
            creditDestination: formData.creditDestination,
            creditNotePrefix: formData.creditNotePrefix,
            creditNoteNumber: formData.creditNoteNumber || null,
            associatedInvoiceDate: formData.associatedInvoiceDate || null,

            // Totales calculados (opcionales)
            subtotal: calculateSubtotal(),
            discount: calculateTotalDiscount(),
            grossValue: calculateGrossValue(),
            taxAmount: calculateTotalTax(),
            reteFuente: calculateReteFuente(),
            total: calculateTotal(),

            // Set de Pruebas - Modo prueba
            isTestMode: isTestMode || false
        };

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error(
                    'No se encontró token de autenticación. Inicia sesión de nuevo.'
                );
            }

            const response = await fetch(
                `${env.API_URL}/credit-notes`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al crear la nota crédito');
            }

            alert(
                `Nota crédito creada exitosamente\n\n` +
                `Número: ${data.creditNote?.number || 'N/D'}\n` +
                `Total: $${(data.creditNote?.total || calculateTotal()).toLocaleString()}`
            );

            navigate('/ingresos/documentos');
        } catch (error: any) {
            console.error('Error al guardar nota crédito:', error);
            alert(`Error al guardar la nota crédito:\n${error.message}`);
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

    const isTotalReturn = formData.creditNoteKind === 'devolucion-total';
    const isTotalCancel = formData.creditNoteKind === 'anulacion-total';
    const isLocked = isTotalCancel; // en anulación total los valores de la factura NO se pueden editar
    const lockedInputStyle = isLocked ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } : {};

    return (
        <div style={s.wrapper}>
            <div style={s.card}>
                {/* BARRA SUPERIOR GRIS */}
                <div style={s.topBar}>
                    <div>
                        <label style={s.topLabel}>Tipo de documento</label>
                        <select
                            style={{ ...s.topSelect, ...s.topSelectActive }}
                            value="Nota Crédito"
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
                        >
                            <option value="General">General</option>
                        </select>
                    </div>
                    <div>
                        <label style={s.topLabel}>Vendedor</label>
                        <select
                            style={{ ...s.topSelect, ...(isTestMode ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                            value={formData.seller}
                            onChange={e => !isTestMode && handleFormChange('seller', e.target.value)}
                            disabled={isTestMode}
                        >
                            <option value="">Buscar...</option>
                            <option value="1">Admin</option>
                        </select>
                    </div>
                </div>

                {/* HEADER: LOGO Y DATOS */}
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
                                        <i className="ri-image-add-line" />
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
                        <div style={s.invoiceNum}>{documentNumber}</div>
                    </div>
                </div>

                {/* BODY */}
                <div style={s.body}>
                    {/* GRID FORMULARIO */}
                    <div style={s.formGrid}>
                        {/* Documento cliente */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Documento <span style={s.required}>*</span>
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
                                        placeholder="Nº Identificación"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Nombre cliente (autocomplete + botón crear) */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Nombre o razón social <span style={s.required}>*</span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                                <div style={{ flex: 1 }}>
                                    <AutocompleteInput
                                        value={formData.clientName}
                                        onChange={(val) => handleFormChange('clientName', val)}
                                        options={clientNameOptions}
                                        placeholder="Buscar o escribir nombre..."
                                    />
                                </div>
                                <a
                                    href="/contabilidad/config/terceros"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Abrir listado de terceros en nueva pestaña"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        color: '#374151',
                                        textDecoration: 'none',
                                        backgroundColor: '#f9fafb',
                                        fontSize: '12px',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    <i className="ri-add-line" style={{ marginRight: 4 }} /> Nuevo
                                </a>
                            </div>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>
                                Si no aparece, creálo en <a href="/contabilidad/config/terceros" target="_blank" rel="noopener noreferrer">Terceros</a>.
                            </div>
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
                                list="associated-invoices-list"
                                style={s.input}
                                placeholder={clientInvoices.length > 0 ? 'Selecciona o escribe el número' : 'Selecciona primero un cliente'}
                                value={formData.associatedInvoice}
                                onChange={e =>
                                    handleFormChange('associatedInvoice', e.target.value)
                                }
                            />
                            <datalist id="associated-invoices-list">
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
                                                ⚠ Sin CUFE — la NC quedará en BORRADOR (no irá a DIAN).
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
                                value={formData.associatedInvoiceDate}
                                onChange={e =>
                                    handleFormChange('associatedInvoiceDate', e.target.value)
                                }
                            />
                        </div>

                        {/* Prefijo + Nº nota crédito */}
                        <div style={s.formField}>
                            <label style={s.label}>Prefijo / N° nota crédito</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    style={{ ...s.input, width: '90px' }}
                                    value={formData.creditNotePrefix}
                                    onChange={e => handleFormChange('creditNotePrefix', e.target.value)}
                                    placeholder="NC"
                                    maxLength={6}
                                />
                                <input
                                    type="text"
                                    style={{ ...s.input, flex: 1 }}
                                    value={formData.creditNoteNumber}
                                    onChange={e => handleFormChange('creditNoteNumber', e.target.value)}
                                    placeholder="0000 (autonumérico si se deja vacío)"
                                />
                            </div>
                        </div>

                        {/* Tipo de nota crédito */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Tipo de nota crédito <span style={s.required}>*</span>
                            </label>
                            <select
                                style={s.select}
                                value={formData.creditNoteKind}
                                onChange={e => handleFormChange('creditNoteKind', e.target.value)}
                            >
                                {CREDIT_NOTE_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            <small style={{ color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                                {formData.creditNoteKind === 'anulacion-total' && 'Anula la factura completa. Los valores de la factura no se pueden editar: se replican tal cual para que la NC la cancele por el mismo monto.'}
                                {formData.creditNoteKind === 'devolucion-total' && 'Anula toda la factura por devolución de mercancía. Las cantidades pasan a negativas y las filas no pueden eliminarse.'}
                                {formData.creditNoteKind === 'devolucion-parcial' && 'Edita las líneas que se devuelven parcialmente.'}
                                {formData.creditNoteKind === 'descuento-ajuste' && 'No implica devolución de mercancía, solo crédito a favor.'}
                            </small>
                        </div>

                        {/* Motivo (catálogo) */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Motivo <span style={s.required}>*</span>
                            </label>
                            <select
                                style={s.select}
                                value={formData.reason}
                                onChange={e => handleFormChange('reason', e.target.value)}
                            >
                                {REASON_OPTIONS.map(r => (
                                    <option key={r.code} value={r.code}>
                                        {r.code} — {r.label}
                                    </option>
                                ))}
                            </select>
                            {formData.reason === REASON_OTHER_CODE && (
                                <input
                                    type="text"
                                    style={{ ...s.input, marginTop: '8px' }}
                                    placeholder="Describe el motivo"
                                    value={formData.reasonOther}
                                    onChange={e => handleFormChange('reasonOther', e.target.value)}
                                />
                            )}
                        </div>

                        {/* Análisis libre para trazabilidad: causa raíz, soporte, acuerdo */}
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
                                placeholder="Explicá por qué se emite esta nota (causa raíz, acuerdo con el cliente, soporte, etc.)"
                            />
                        </div>

                        {/* Responsable / aprobador */}
                        <div style={{ ...s.formField, gridColumn: '1 / -1' }}>
                            <label style={s.label}>
                                Responsable / aprobador{' '}
                                <span style={{ color: '#6b7280', fontSize: 11 }}>(quién autoriza)</span>
                            </label>
                            <input
                                style={s.input}
                                value={formData.responsibleName}
                                onChange={e => handleFormChange('responsibleName', e.target.value)}
                                placeholder="Nombre de quien autoriza la NC"
                            />
                        </div>
                    </div>

                    {/* DESTINO DEL CRÉDITO */}
                    <div
                        style={{
                            padding: '16px',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: '#f9fafb',
                            marginBottom: '20px',
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="ri-refund-2-line" /> Destino del crédito
                        </div>
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                            <FormGroup check inline>
                                <Input
                                    type="radio"
                                    id="dest-reintegro"
                                    name="creditDestination"
                                    value="reintegro"
                                    checked={formData.creditDestination === 'reintegro'}
                                    onChange={e => handleFormChange('creditDestination', e.target.value)}
                                />
                                <Label for="dest-reintegro" check>
                                    <i className="ri-hand-coin-line" style={{ marginRight: 4 }} />
                                    Reintegrar dinero
                                </Label>
                            </FormGroup>
                            <FormGroup check inline>
                                <Input
                                    type="radio"
                                    id="dest-credito"
                                    name="creditDestination"
                                    value="credito-cuenta"
                                    checked={formData.creditDestination === 'credito-cuenta'}
                                    onChange={e => handleFormChange('creditDestination', e.target.value)}
                                />
                                <Label for="dest-credito" check>
                                    <i className="ri-wallet-3-line" style={{ marginRight: 4 }} />
                                    Crédito a cuenta
                                </Label>
                            </FormGroup>
                        </div>
                        <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '8px' }}>
                            {formData.creditDestination === 'reintegro'
                                ? 'El cliente recibirá el dinero de vuelta (salida de efectivo / reversa).'
                                : 'Queda a favor del cliente para aplicar en próximas facturas.'}
                        </small>
                    </div>

                    {/* TABLA DE ITEMS */}
                    <div style={s.tableWrapper}>
                        {/* TODO: backend — autopoblar estas líneas al elegir una factura del datalist
                            (GET /invoices/{id} y mapear items -> líneas). Mientras tanto, edición manual. */}
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    <th style={{ ...s.th, width: '20%' }}>Ítem</th>
                                    <th style={{ ...s.th, width: '18%' }}>Descripción</th>
                                    <th style={{ ...s.th, width: '11%' }}>C. Costo</th>
                                    <th style={{ ...s.th, width: '8%' }}>Cantidad</th>
                                    <th style={{ ...s.th, width: '11%' }}>V. Unitario</th>
                                    <th style={{ ...s.th, width: '7%' }}>% Desc</th>
                                    <th style={{ ...s.th, width: '8%' }}>% IVA</th>
                                    <th style={{ ...s.th, width: '7%' }}>% RF</th>
                                    <th style={{ ...s.th, width: '10%', textAlign: 'right' }}>Valor total</th>
                                    <th style={{ ...s.th, width: '3%' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.id}>
                                        <td style={s.td}>
                                            <input
                                                type="text"
                                                placeholder="Concepto / producto"
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                value={item.item}
                                                list={`nc-catalog-${item.id}`}
                                                readOnly={isLocked}
                                                onChange={e => {
                                                    updateItem(item.id, 'item', e.target.value);
                                                    linkCatalogToItem(item.id, e.target.value);
                                                }}
                                                onBlur={e => linkCatalogToItem(item.id, e.target.value)}
                                            />
                                            <datalist id={`nc-catalog-${item.id}`}>
                                                {catalogOptions.map((o) => (
                                                    <option key={`${o.type}-${o.id}`} value={o.name}>
                                                        {o.type === 'product' ? '[P]' : '[S]'} {o.sku ? `${o.sku} — ` : ''}{o.name}
                                                    </option>
                                                ))}
                                            </datalist>
                                            {(item.productId || item.serviceId) && (
                                                <div style={{ fontSize: 10, color: '#10b981', marginTop: 2 }}>
                                                    ✓ vinculado al catálogo
                                                </div>
                                            )}
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="text"
                                                placeholder="Descripción adicional"
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                value={item.description}
                                                readOnly={isLocked}
                                                onChange={e =>
                                                    updateItem(item.id, 'description', e.target.value)
                                                }
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <select
                                                style={{ ...s.selectCell, ...lockedInputStyle }}
                                                value={item.costCenter}
                                                disabled={isLocked}
                                                onChange={e =>
                                                    updateItem(item.id, 'costCenter', e.target.value)
                                                }
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
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                value={item.quantity}
                                                readOnly={isLocked}
                                                onChange={e =>
                                                    updateItem(
                                                        item.id,
                                                        'quantity',
                                                        parseInt(e.target.value) || 0
                                                    )
                                                }
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="number"
                                                placeholder="Precio uni"
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                value={item.price}
                                                readOnly={isLocked}
                                                onChange={e =>
                                                    updateItem(item.id, 'price', e.target.value)
                                                }
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="number"
                                                placeholder="%"
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                value={item.discount}
                                                readOnly={isLocked}
                                                onChange={e =>
                                                    updateItem(item.id, 'discount', e.target.value)
                                                }
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <select
                                                style={{ ...s.selectCell, ...lockedInputStyle }}
                                                value={item.tax}
                                                disabled={isLocked}
                                                onChange={e =>
                                                    updateItem(item.id, 'tax', e.target.value)
                                                }
                                            >
                                                <option value="">Impuesto</option>
                                                <option value="0">0%</option>
                                                <option value="5">IVA 5%</option>
                                                <option value="19">IVA 19%</option>
                                            </select>
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                placeholder="%"
                                                style={{ ...s.inputCell, ...lockedInputStyle }}
                                                value={item.retentionRate}
                                                readOnly={isLocked}
                                                onChange={e =>
                                                    updateItem(item.id, 'retentionRate', e.target.value)
                                                }
                                            />
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
                                                    ...((isTotalReturn || isTotalCancel) ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                                                }}
                                                onClick={() => removeItem(item.id)}
                                                disabled={isTotalReturn || isTotalCancel}
                                                title={
                                                    isTotalCancel
                                                        ? 'No se pueden eliminar líneas en Anulación total'
                                                        : isTotalReturn
                                                            ? 'No se pueden eliminar líneas en Devolución total'
                                                            : 'Eliminar línea'
                                                }
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
                            ...((isTotalReturn || isTotalCancel) ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                        }}
                        onClick={addItem}
                        disabled={isTotalReturn || isTotalCancel}
                        title={
                            isTotalCancel
                                ? 'Anulación total: no se pueden agregar líneas nuevas'
                                : isTotalReturn
                                    ? 'Devolución total: no se pueden agregar líneas nuevas'
                                    : ''
                        }
                    >
                        <i className="ri-add-line" /> Agregar línea
                    </button>

                    {/* FOOTER: Términos / Notas / Totales */}
                    <div style={s.footerGrid}>
                        <div style={s.leftFooter}>
                            <div style={{ width: '100%' }}>
                                <div style={s.textareaLabel}>
                                    Términos y condiciones
                                </div>
                                <textarea
                                    style={{ ...s.textarea, width: '100%', boxSizing: 'border-box' }}
                                    value={formData.terms}
                                    onChange={e => handleFormChange('terms', e.target.value)}
                                    rows={4}
                                />
                            </div>
                            <div style={{ width: '100%' }}>
                                <div style={s.textareaLabel}>Notas</div>
                                <textarea
                                    style={{ ...s.textarea, width: '100%', boxSizing: 'border-box' }}
                                    placeholder="Notas visibles en la nota crédito..."
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
                                <span>Descuentos</span>
                                <span>-$ {calculateTotalDiscount().toLocaleString()}</span>
                            </div>
                            <div style={{ ...s.totalRow, fontWeight: 600 }}>
                                <span>Valor bruto</span>
                                <span>$ {calculateGrossValue().toLocaleString()}</span>
                            </div>
                            <div style={s.totalRow}>
                                <span>IVA</span>
                                <span>$ {calculateTotalTax().toLocaleString()}</span>
                            </div>
                            <div style={s.totalRow}>
                                <span>ReteFuente</span>
                                <span>-$ {calculateReteFuente().toLocaleString()}</span>
                            </div>

                            <div
                                style={{
                                    ...s.totalFinal,
                                    backgroundColor: '#dcfce7',
                                    color: '#14532d',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginTop: '8px',
                                }}
                            >
                                <span>TOTAL NOTA CRÉDITO</span>
                                <span>$ {calculateTotal().toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BARRA DE BOTONES FIJA */}
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
                    <button
                        style={s.btnPrimary}
                        onClick={handleSaveClick}
                        disabled={loading}
                    >
                        {loading ? 'Guardando...' : 'Emitir nota crédito'}
                    </button>
                </div>
            </div>

            {/* ============================================ */}
            {/* MODAL DE CONFIRMACIÓN                         */}
            {/* ============================================ */}
            <Modal isOpen={showConfirmModal} toggle={() => setShowConfirmModal(false)} centered>
                <ModalHeader toggle={() => setShowConfirmModal(false)}>
                    <i className="ri-file-warning-line" style={{ marginRight: 8 }} />
                    Confirmar emisión de nota crédito
                </ModalHeader>
                <ModalBody>
                    <p style={{ fontSize: '15px' }}>
                        ¿Confirmar emisión de nota crédito por{' '}
                        <strong style={{ color: '#14532d' }}>
                            $ {calculateTotal().toLocaleString()}
                        </strong>{' '}
                        a <strong>{formData.clientName || '—'}</strong>?
                    </p>

                    <Row className="mt-3">
                        <Col md={6}>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>Factura asociada</div>
                            <div style={{ fontWeight: 600 }}>
                                <i className="ri-bill-line" style={{ marginRight: 4 }} />
                                {formData.associatedInvoice || '—'}
                            </div>
                            {formData.associatedInvoiceDate && (
                                <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                    Fecha: {formData.associatedInvoiceDate}
                                </div>
                            )}
                        </Col>
                        <Col md={6}>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>Destino del crédito</div>
                            <div style={{ fontWeight: 600 }}>
                                {formData.creditDestination === 'reintegro' ? (
                                    <>
                                        <i className="ri-hand-coin-line" style={{ marginRight: 4 }} />
                                        Reintegrar dinero
                                    </>
                                ) : (
                                    <>
                                        <i className="ri-wallet-3-line" style={{ marginRight: 4 }} />
                                        Crédito a cuenta
                                    </>
                                )}
                            </div>
                        </Col>
                    </Row>

                    <Row className="mt-3">
                        <Col md={6}>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>Tipo</div>
                            <div style={{ fontWeight: 600 }}>
                                {CREDIT_NOTE_TYPES.find(t => t.value === formData.creditNoteKind)?.label}
                            </div>
                        </Col>
                        <Col md={6}>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>Motivo</div>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                {formData.reason === REASON_OTHER_CODE
                                    ? (formData.reasonOther || 'Otros')
                                    : (REASON_OPTIONS.find(r => r.code === formData.reason)?.label || formData.reason)}
                            </div>
                        </Col>
                    </Row>

                    <p className="text-muted mt-3" style={{ fontSize: '11px' }}>
                        Esta acción registra la nota crédito en el sistema y no puede deshacerse.
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" outline onClick={() => setShowConfirmModal(false)}>
                        Cancelar
                    </Button>
                    <Button color="success" onClick={doSubmit} disabled={loading}>
                        <i className="ri-check-line" style={{ marginRight: 4 }} />
                        Emitir
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default NotaCreditoTab;
