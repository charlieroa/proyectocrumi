// src/pages/income/SalesInvoice/tabs/FacturaTab.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentConfig } from '../Create';
import AutocompleteInput from '../../../../Components/AutocompleteInput';
import useAccountingCustomers from '../../../../Components/Contabilidad/useAccountingCustomers';
import { api } from '../../../../services/api';
import CrumiModal from '../../../../Components/Common/CrumiModal';
import { jwtDecode } from 'jwt-decode';
import { getToken, getTenantIdFromToken } from '../../../../services/auth';
import { getProducts, Product } from '../../../../services/productApi';
import { getServicesByTenant, ServiceItem } from '../../../../services/serviceApi';
import { getCostCenters, CostCenter } from '../../../../services/costCenterApi';
import { getCrumiFormStyles } from '../crumiFormStyles';
import { env } from '../../../../env';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
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
    Alert,
} from 'reactstrap';

// ============================================
// INTERFACES
// ============================================
interface InvoiceItem {
    id: number;
    item: string;
    reference: string;
    price: string;
    discount: string;
    tax: string;
    description: string;
    quantity: number;
    total: number;
    // Nuevos campos solicitados por el contador (ref. Siigo)
    costCenter: string;         // Centro de costo
    retentionRate: string;      // % Retención en la Fuente por línea
    // Vínculo al catálogo Productos & Servicios (alimenta kardex y reportes por producto)
    productId?: number | null;
    serviceId?: number | null;
    unitCost?: number | null;
}

interface Client {
    idType: string;
    idNumber: string;
    name: string;
    email: string;
    phone: string;
    city: string;
    address: string;
}

// Anticipo aplicado a la factura
interface Advance {
    date: string;
    amount: number;
    method: string;      // 'efectivo' | 'transferencia' | 'pse' | 'cheque'
    reference: string;
}

// Forma de pago (ref. Siigo) — divide el total en varios medios de pago
type MetodoFormaPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'pse' | 'cheque' | 'otro';
interface FormaPago {
    id: string;
    metodo: MetodoFormaPago;
    monto: number;
    referencia?: string;
}

const METODOS_FORMA_PAGO: { value: MetodoFormaPago; label: string }[] = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'pse', label: 'PSE' },
    { value: 'tarjeta', label: 'Tarjeta' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'otro', label: 'Otro' },
];

interface FacturaTabProps {
    config: DocumentConfig;
    isTestMode?: boolean; // Indica si estamos creando documentos para el Set de Pruebas
}

// ============================================
// MOCK DATA (si no hay API aún, backend: TODO)
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

// Tipos de operación DIAN
const OPERATION_TYPES = [
    { value: '10', label: '10 - Estándar' },
    { value: '09', label: '09 - Mandatos' },
    { value: '11', label: '11 - Transporte' },
    { value: '12', label: '12 - Cambiario' },
    { value: '20', label: '20 - Nota crédito' },
    { value: '22', label: '22 - Nota débito' },
];

// ============================================
// COMPONENTE
// ============================================
const FacturaTab: React.FC<FacturaTabProps> = ({ config, isTestMode = false }) => {
    const navigate = useNavigate();

    // Clientes del módulo contable (tabla third_parties)
    const { customers: crmcontacts, refresh: refreshCustomers } = useAccountingCustomers();

    // Función para obtener tenantId del token
    const getTenantId = (): string | null => {
        try {
            const token = getToken();
            if (!token) return null;
            const decoded: any = jwtDecode(token);
            return decoded?.user?.tenant_id || decoded?.tenant_id || null;
        } catch {
            return null;
        }
    };

    // Cargar datos del tenant
    React.useEffect(() => {
        const loadTenantData = async () => {
            try {
                const tenantId = getTenantId();
                if (!tenantId) return;

                const { data } = await api.get(`/tenants/${tenantId}`);
                setTenantData(data);
                setCompanyName(data?.business_name || data?.name || 'Mi Empresa');

                // Cargar logo si existe
                if (data?.logo_url) {
                    const baseUrl = api.defaults.baseURL || '';
                    const logoUrlFinal = data.logo_url.startsWith('http')
                        ? data.logo_url
                        : `${baseUrl}${data.logo_url}`;
                    setLogoUrl(logoUrlFinal);
                }
            } catch (error) {
                console.error('Error al cargar datos del tenant:', error);
            }
        };

        loadTenantData();
    }, []);

    // Estados
    const [loading, setLoading] = useState(false);
    const [documentNumber, setDocumentNumber] = useState('');
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [logoUrl, setLogoUrl] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [tenantData, setTenantData] = useState<any>(null);

    // Estado facturación electrónica + siguiente consecutivo
    const [einvoicingStatus, setEinvoicingStatus] = useState<{
        invoicingReady: boolean;
        invoicingEnabled: boolean;
        resolutionConfigured: boolean;
        prefix: string | null;
        loaded: boolean;
    }>({ invoicingReady: false, invoicingEnabled: false, resolutionConfigured: false, prefix: null, loaded: false });

    // Cargar status DIAN + siguiente consecutivo al montar (sólo para factura nueva)
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get('/invoices/next-number');
                if (cancelled) return;
                if (data?.success) {
                    setEinvoicingStatus({
                        invoicingReady: !!data.invoicingReady,
                        invoicingEnabled: !!data.invoicingEnabled,
                        resolutionConfigured: !!data.resolutionConfigured,
                        prefix: data.prefix || null,
                        loaded: true,
                    });
                    if (data.invoicingReady && data.invoicingEnabled && data.nextNumber) {
                        setDocumentNumber(String(data.nextNumber));
                    }
                } else {
                    setEinvoicingStatus(s => ({ ...s, loaded: true }));
                }
            } catch {
                if (!cancelled) setEinvoicingStatus(s => ({ ...s, loaded: true }));
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Estado para modal de resultado DIAN
    const [showDianModal, setShowDianModal] = useState(false);
    const [dianResult, setDianResult] = useState<{
        success: boolean;
        demoMode: boolean;
        invoiceNumber: string;
        dianNumber: string;
        cufe: string;
        trackId: string;
        xmlPath: string;
        total: number;
        client: string;
    } | null>(null);

    // ---- Estados para el modal de Anticipos (pre-save) ----
    const [showAdvanceAskModal, setShowAdvanceAskModal] = useState(false);
    const [showAdvanceFormModal, setShowAdvanceFormModal] = useState(false);
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [advanceDraft, setAdvanceDraft] = useState<Advance>({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        method: 'efectivo',
        reference: '',
    });

    // ---- Modal de Recaudo (checkbox "Registrar pago") ----
    // Cuando el usuario marca "Registrar pago al guardar" y la factura se crea,
    // este modal recoge los datos del recibo y los envía a POST /payment-receipts.
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    // Guardamos la factura recién creada para poder vincular el recibo de cobro.
    const [createdInvoice, setCreatedInvoice] = useState<{ id: number | string; invoiceNumber: string; total: number } | null>(null);
    // Form local del modal de recaudo
    const [paymentForm, setPaymentForm] = useState<{
        paymentDate: string;
        amount: number;
        method: string;
        reference: string;
    }>({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: 0,
        method: 'Efectivo',
        reference: '',
    });
    const [savingPaymentReceipt, setSavingPaymentReceipt] = useState(false);

    // Default: fecha de vencimiento = hoy + 30 días
    const defaultDueDate = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    })();

    // Form data
    const [formData, setFormData] = useState({
        documentType: 'Factura de Ventas',
        warehouse: 'Principal',
        priceList: 'General',
        seller: '',
        clientDocType: 'CC',
        clientDocNumber: '',
        clientDocDV: '', // Dígito de verificación para NIT
        clientName: '',
        email: '',
        // Extras requeridos por DIAN/Alegra
        clientAddress: '',
        clientCity: 'Bogotá',
        clientDepartment: 'Bogotá D.C.',
        clientPhone: '',

        date: new Date().toISOString().split('T')[0],
        paymentForm: 'Contado',
        creditTermDays: '30', // plazo de crédito en días (solo aplica si paymentForm=Credito)
        paymentMethod: '',
        notes: '',
        terms: 'Este documento se asimila en todos sus efectos a una letra de cambio de conformidad con el Art. 774 del código de comercio. Autorizo que en caso de incumplimiento de esta obligación sea reportado a las centrales de riesgo, se cobrarán intereses de mora.',

        // ===== Nuevos campos de header (ref. Siigo) =====
        branchId: '1',              // Sucursal
        dueDate: defaultDueDate,    // Fecha de vencimiento
        orderPrefix: '',            // Prefijo de orden interna
        orderNumber: '',            // Nº de orden interna
        orderDate: '',              // Fecha de orden (opcional)
        operationType: '10',        // Tipo de operación DIAN
        icaRate: '0',               // % ICA / 1000
        negotiationPlace: '',       // Lugar de negociación
        taxFreeDay: false,          // Día sin IVA
        registerPayment: false,     // Registrar pago al guardar — abre modal de recaudo

        // Totales manuales
        impoConsumo: '0',           // Impuesto al consumo ingresado a mano
        reteIvaRate: '0',           // % ReteIVA general
    });


    // Items
    const [items, setItems] = useState<InvoiceItem[]>([
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

    // Catálogo de Productos & Servicios (para vincular líneas con kardex/reportes)
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

    /** Cuando el usuario escribe/selecciona en el campo "item": busca en catálogo y, si hay match exacto, vincula */
    const linkCatalogToItem = (rowId: number, name: string) => {
        const match = catalogOptions.find((o) => o.name.toLowerCase() === name.toLowerCase().trim());
        setItems((prev) =>
            prev.map((it) => {
                if (it.id !== rowId) return it;
                if (match) {
                    return {
                        ...it,
                        item: match.name,
                        reference: match.sku,
                        price: it.price || String(match.price || ''),
                        tax: it.tax || String(match.taxRate || ''),
                        description: it.description || match.name,
                        productId: match.type === 'product' ? match.id : null,
                        serviceId: match.type === 'service' ? match.id : null,
                        unitCost: match.type === 'product' ? match.unitCost : 0,
                    };
                }
                // Sin match: limpiar vínculo (texto libre)
                return { ...it, item: name, productId: null, serviceId: null, unitCost: null };
            })
        );
    };

    // Nuevo cliente
    const [newClient, setNewClient] = useState<Client>({
        idType: 'CC',
        idNumber: '',
        name: '',
        email: '',
        phone: '',
        city: '',
        address: ''
    });
    const [customerError, setCustomerError] = useState<string | null>(null);
    const [savingCustomer, setSavingCustomer] = useState(false);

    // ============================================
    // HANDLERS
    // ============================================
    const handleFormChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Auto-populate when client name matches
        if (field === 'clientName') {
            const foundClient = crmcontacts.find((c: any) => {
                const name = c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
                return name === value;
            });
            if (foundClient) {
                const docNumber = foundClient.identification || foundClient.id || '';
                setFormData(prev => ({
                    ...prev,
                    clientName: value,
                    clientDocNumber: String(docNumber),
                    email: foundClient.email || '',
                    clientAddress: foundClient.address || foundClient.street || '',
                    clientCity: foundClient.city || 'Bogotá',
                    clientPhone: foundClient.phone || foundClient.mobile || ''
                }));
            }
        }

        // Auto-populate when client document number matches
        if (field === 'clientDocNumber') {
            const foundClient = crmcontacts.find((c: any) => {
                const docNumber = String(c.identification || c.id || '');
                return docNumber === value;
            });
            if (foundClient) {
                const name = foundClient.name || `${foundClient.first_name || ''} ${foundClient.last_name || ''}`.trim();
                setFormData(prev => ({
                    ...prev,
                    clientDocNumber: value,
                    clientName: name,
                    email: foundClient.email || '',
                    clientAddress: foundClient.address || foundClient.street || '',
                    clientCity: foundClient.city || 'Bogotá',
                    clientPhone: foundClient.phone || foundClient.mobile || ''
                }));
            }
        }
    };

    const addItem = () => {
        const newId = Math.max(...items.map(i => i.id), 0) + 1;
        setItems([
            ...items,
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
        if (items.length > 1) setItems(items.filter(item => item.id !== id));
    };

    const updateItem = (id: number, field: keyof InvoiceItem, value: string | number) => {
        setItems(
            items.map(item => {
                if (item.id === id) {
                    const updated = { ...item, [field]: value } as InvoiceItem;

                    // Si está activo "Día sin IVA", forzar IVA 0
                    if (formData.taxFreeDay) {
                        updated.tax = '0';
                    }

                    // Calcular total de la línea (incluye RF como descuento neto)
                    const price = parseFloat(updated.price) || 0;
                    const qty = updated.quantity || 0;
                    const disc = parseFloat(updated.discount) || 0;
                    const taxRate = parseFloat(updated.tax) || 0;
                    const rfRate = parseFloat(updated.retentionRate) || 0;

                    const subtotal = price * qty;
                    const discountAmount = subtotal * (disc / 100);
                    const taxableBase = subtotal - discountAmount;
                    const taxAmount = taxableBase * (taxRate / 100);
                    const rfAmount = taxableBase * (rfRate / 100);

                    updated.total = taxableBase + taxAmount - rfAmount;
                    return updated;
                }
                return item;
            })
        );
    };

    // Si se activa "Día sin IVA", poner todas las líneas a 0%
    useEffect(() => {
        if (formData.taxFreeDay) {
            setItems(prev => prev.map(i => ({ ...i, tax: '0' })));
        }
    }, [formData.taxFreeDay]);

    // ============================================
    // CÁLCULOS DE TOTALES
    // ============================================
    const calculateSubtotal = () =>
        items.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * i.quantity, 0);

    const calculateTotalDiscount = () =>
        items.reduce(
            (sum, i) =>
                sum + (parseFloat(i.price) || 0) * i.quantity * ((parseFloat(i.discount) || 0) / 100),
            0
        );

    // Base gravable por línea (subtotal - descuento)
    const taxableBaseLine = (i: InvoiceItem) => {
        const price = parseFloat(i.price) || 0;
        const qty = i.quantity || 0;
        const disc = parseFloat(i.discount) || 0;
        return price * qty * (1 - disc / 100);
    };

    const calculateTotalTax = () =>
        items.reduce((sum, i) => {
            const base = taxableBaseLine(i);
            const taxRate = parseFloat(i.tax) || 0;
            return sum + base * (taxRate / 100);
        }, 0);

    // ReteFuente total (suma de RF por línea)
    const calculateReteFuente = () =>
        items.reduce((sum, i) => {
            const base = taxableBaseLine(i);
            const rf = parseFloat(i.retentionRate) || 0;
            return sum + base * (rf / 100);
        }, 0);

    const calculateGrossValue = () => calculateSubtotal() - calculateTotalDiscount();

    // ReteIVA = %reteIvaRate * IVA total
    const calculateReteIVA = () => {
        const rate = parseFloat(formData.reteIvaRate) || 0;
        return calculateTotalTax() * (rate / 100);
    };

    // ReteICA = valor bruto * %ICA/1000
    const calculateReteICA = () => {
        const ica = parseFloat(formData.icaRate) || 0;
        return (calculateGrossValue() * ica) / 1000;
    };

    const calculateImpoConsumo = () => parseFloat(formData.impoConsumo) || 0;

    const calculateAdvances = () => advances.reduce((s, a) => s + (a.amount || 0), 0);

    const calculateTotal = () => {
        const bruto = calculateGrossValue();
        const iva = calculateTotalTax();
        const impo = calculateImpoConsumo();
        const rf = calculateReteFuente();
        const reteIva = calculateReteIVA();
        const reteIca = calculateReteICA();
        const anticipos = calculateAdvances();
        return bruto + iva + impo - rf - reteIva - reteIca - anticipos;
    };

    // ============================================
    // GUARDAR EN BACKEND (CONECTADO)
    // ============================================
    // doSubmit: hace el POST real. handleSave decide antes si mostrar modal anticipo.
    // saveAsDraft=true → guarda local sin enviar a DIAN.
    const doSubmit = async (saveAsDraft = false) => {
        // 1. Validaciones
        if (!formData.clientName) {
            return alert('Debes seleccionar un cliente');
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            return alert('El correo del cliente no tiene formato válido');
        }
        for (let idx = 0; idx < items.length; idx++) {
            const i = items[idx];
            if (!i.item) return alert(`Línea ${idx + 1}: falta nombre del ítem`);
            const price = Number(i.price);
            if (!Number.isFinite(price) || price <= 0) return alert(`Línea ${idx + 1}: el precio debe ser mayor a 0`);
            const qty = Number(i.quantity);
            if (!Number.isFinite(qty) || qty <= 0) return alert(`Línea ${idx + 1}: la cantidad debe ser mayor a 0`);
        }

        setLoading(true);

        // 2. Mapeo de medio de pago a codigo DIAN
        const paymentMeanCode = (() => {
            const mapping: { [key: string]: string } = {
                'Efectivo': '10',
                'Transferencia': '31',
                'Tarjeta': '48',
                'Consignacion': '42'
            };
            return mapping[formData.paymentMethod] || '10';
        })();

        // 3. Construir payload unificado para alegraController.createInvoice
        // Este endpoint guarda localmente y envía a Alegra/DIAN si está habilitado
        const payload = {
            // Indicador de modo prueba
            isTestMode: isTestMode,
            // Si es borrador, el backend NO debe enviar a DIAN aunque la factura sea electrónica.
            saveAsDraft: saveAsDraft,

            // Invoice number
            number: documentNumber || undefined,
            invoice_number: documentNumber || undefined,

            // Customer data (Alegra format)
            customer: {
                identification: formData.clientDocNumber || '',
                dv: formData.clientDocDV || '',
                name: formData.clientName,
                email: formData.email || '',
                phone: formData.clientPhone || '',
                identificationType: formData.clientDocType || '13',
                address: {
                    address: formData.clientAddress || '',
                    city: formData.clientCity || '',
                    department: formData.clientDepartment || '',
                    country: 'CO'
                }
            },

            // Also flat fields for local DB
            clientName: formData.clientName,
            clientDocType: formData.clientDocType,
            clientNit: formData.clientDocNumber,
            email: formData.email || '',
            clientAddress: formData.clientAddress || '',
            clientCity: formData.clientCity || '',
            clientDepartment: formData.clientDepartment || '',
            clientPhone: formData.clientPhone || '',

            // Items (both formats) — incluye nuevos campos
            items: items.map(i => {
                const qty = Number(i.quantity) || 1;
                const unitPrice = Number(i.price) || 0;
                const discountPercent = Number(i.discount) || 0;
                const taxPercent = Number(i.tax) || 0;
                const rfPercent = Number(i.retentionRate) || 0;
                const lineSubtotal = qty * unitPrice;
                const discountAmount = lineSubtotal * (discountPercent / 100);
                const taxableAmount = lineSubtotal - discountAmount;
                const taxAmount = taxableAmount * (taxPercent / 100);
                const rfAmount = taxableAmount * (rfPercent / 100);
                const total = taxableAmount + taxAmount - rfAmount;

                return {
                    item: i.item,
                    description: i.description || i.item,
                    reference: i.reference || '',
                    quantity: qty,
                    unitPrice: unitPrice,
                    price: unitPrice,
                    discount: discountPercent,
                    tax: taxPercent,
                    taxRate: taxPercent,
                    taxAmount: taxAmount,
                    subtotal: lineSubtotal,
                    total: total,
                    totalLine: total,
                    // Vínculo a catálogo (alimenta kardex y reportes por producto)
                    productId: i.productId ?? null,
                    serviceId: i.serviceId ?? null,
                    unitCost: i.unitCost ?? null,
                    // Nuevos (backend los ignora si no los maneja — TODO: backend)
                    costCenter: i.costCenter,
                    retentionRate: rfPercent,
                    retentionAmount: rfAmount,
                };
            }),

            // Totals
            subtotal: calculateSubtotal(),
            taxAmount: calculateTotalTax(),
            tax_amount: calculateTotalTax(),
            discount: calculateTotalDiscount(),
            total: calculateTotal(),

            // Totales extendidos (props adicionales — backend los ignora si no las maneja)
            grossValue: calculateGrossValue(),
            impoConsumo: calculateImpoConsumo(),
            reteFuente: calculateReteFuente(),
            reteIvaRate: parseFloat(formData.reteIvaRate) || 0,
            reteIva: calculateReteIVA(),
            icaRate: parseFloat(formData.icaRate) || 0,
            reteIca: calculateReteICA(),
            advances: advances,          // TODO: backend — persistir anticipos
            advancesTotal: calculateAdvances(),

            // Date
            date: formData.date,
            dueDate: formData.dueDate || formData.date,

            // Header extendido (ref. Siigo) — TODO: backend
            branchId: formData.branchId,
            orderPrefix: formData.orderPrefix,
            orderNumber: formData.orderNumber,
            orderDate: formData.orderDate,
            operationType: formData.operationType,
            negotiationPlace: formData.negotiationPlace,
            taxFreeDay: formData.taxFreeDay,
            registerPayment: formData.registerPayment,

            // Payment
            paymentMethod: formData.paymentForm,
            payment_method: formData.paymentMethod,
            paymentMeanCode: paymentMeanCode,
            paymentMeans: paymentMeanCode,
            paymentForm: formData.paymentForm,                  // Contado | Credito
            creditTermDays: formData.paymentForm === 'Credito'
                ? Number(formData.creditTermDays) || 30
                : 0,

            // Notes
            notes: formData.notes || '',
            terms: formData.terms || '',
        };

        try {
            // 4. Enviar al endpoint unificado de Alegra
            const response = await api.post('/alegra/invoices', payload);
            const data = response.data;

            if (!data.success) {
                throw new Error(data.error || 'Error al guardar la factura');
            }

            // 5. Show result modal
            const dian = data.dian;
            const invoiceNumberFinal = data.invoice?.invoiceNumber || documentNumber || '';
            setDianResult({
                success: dian?.sent || !dian, // success if sent or if no DIAN needed
                demoMode: isTestMode,
                invoiceNumber: invoiceNumberFinal,
                dianNumber: dian?.data?.number || (dian?.cufe ? 'Enviada' : 'N/A'),
                cufe: dian?.cufe || 'No aplica',
                trackId: dian?.data?.trackId || dian?.data?.zipKey || 'N/A',
                xmlPath: '',
                total: payload.total,
                client: formData.clientName
            });
            setShowDianModal(true);

            // Guardar referencia a la factura creada para vincular el recibo de cobro
            const createdRef = {
                id: data.invoice?.id,
                invoiceNumber: invoiceNumberFinal,
                total: payload.total,
            };
            setCreatedInvoice(createdRef);

            // Si el usuario marcó "Registrar pago", abrir modal de recaudo
            if (formData.registerPayment && createdRef.id) {
                setPaymentForm({
                    paymentDate: formData.date,
                    amount: payload.total,
                    method: formData.paymentMethod || 'Efectivo',
                    reference: '',
                });
                setShowPaymentModal(true);
            }

            // Show warning if DIAN send failed but local save succeeded
            if (dian && !dian.sent) {
                console.warn('Factura guardada localmente pero fallo el envio a DIAN:', dian.error);
            }
        } catch (error: any) {
            console.error('Error al guardar factura:', error);
            const msg = error?.response?.data?.error || error?.message || 'Error desconocido';
            alert(`Error al guardar la factura:\n${msg}`);
        } finally {
            setLoading(false);
        }
    };

    // Intercepta Guardar: si no hay anticipos aún, pregunta primero.
    // asDraft=true → guarda como borrador (no envía a DIAN).
    const handleSave = (asDraft = false) => {
        if (advances.length === 0) {
            setShowAdvanceAskModal(true);
            (window as any).__crumi_pending_draft = asDraft; // flag temporal para el modal de anticipos
            return;
        }
        doSubmit(asDraft);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => setLogoUrl(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleAddClient = async () => {
        if (!newClient.name.trim() || !newClient.idNumber.trim()) {
            setCustomerError('Nombre y número de documento son obligatorios.');
            return;
        }
        setSavingCustomer(true);
        setCustomerError(null);
        try {
            const payload = {
                name: newClient.name.trim(),
                documentType: newClient.idType,
                documentNumber: newClient.idNumber.trim(),
                email: newClient.email?.trim() || null,
                phone: newClient.phone?.trim() || null,
                city: newClient.city?.trim() || null,
                address: newClient.address?.trim() || null,
                kind: 'CUSTOMER',
            };
            const res = await api.post('/accounting/third-parties', payload);
            const data = res?.data;
            if (!data?.success) {
                throw new Error(data?.error || data?.message || 'Respuesta inválida del servidor');
            }

            // éxito: autopoblar el form padre con el cliente recién creado
            setFormData(prev => ({
                ...prev,
                clientDocNumber: newClient.idNumber,
                clientName: newClient.name,
                email: newClient.email,
                clientPhone: newClient.phone || prev.clientPhone,
                clientCity: newClient.city || prev.clientCity,
                clientAddress: newClient.address || prev.clientAddress,
            }));

            // Refrescar lista de contactos del autocompletado
            try { refreshCustomers(); } catch { /* noop */ }

            // Close modal y limpiar
            setShowNewClientModal(false);
            const createdName = newClient.name;
            setNewClient({
                idType: 'CC',
                idNumber: '',
                name: '',
                email: '',
                phone: '',
                city: '',
                address: ''
            });

            // Confirmación visual
            Swal.fire({
                icon: 'success',
                title: 'Cliente creado',
                text: `${createdName} se guardó correctamente y quedó seleccionado en la factura.`,
                confirmButtonColor: '#8B5CF6',
                timer: 2200,
                timerProgressBar: true,
            });
        } catch (error: any) {
            console.error('Error creating customer:', error);
            const msg =
                error?.response?.data?.error ||
                error?.response?.data?.message ||
                error?.message ||
                'Error inesperado al crear el cliente';
            setCustomerError(msg);
        } finally {
            setSavingCustomer(false);
        }
    };

    // ============================================
    // ESTILOS ALEGRA
    // ============================================
    const s = getCrumiFormStyles(loading);

    // Autocomplete options for client name
    const clientNameOptions = useMemo(() => {
        return (crmcontacts || []).map((client: any) => {
            const name = client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim();
            // Obtener el número de identificación (cédula o NIT)
            const identification = client.identification || client.id_number || client.document_number || '';
            return {
                value: name,
                label: name,
                sublabel: identification ? `Doc: ${identification}` : undefined // Mostrar cédula/NIT en lugar del ID
            };
        });
    }, [crmcontacts]);

    // Autocomplete options for client document number
    const clientDocOptions = useMemo(() => {
        return (crmcontacts || []).map((client: any) => {
            const name = client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim();
            const docNumber = client.identification || client.id || '';
            return {
                value: String(docNumber),
                label: name, // Mostrar nombre en lugar del ID
                sublabel: `Doc: ${docNumber}` // Mostrar el documento como sublabel
            };
        });
    }, [crmcontacts]);

    // Función para calcular dígito de verificación del NIT
    const calcularDV = (nit: string): string => {
        if (!nit || nit.trim() === '') return '';

        // Limpiar el NIT (solo números)
        const nitLimpio = nit.replace(/\D/g, '');
        if (nitLimpio.length === 0) return '';

        const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
        const nitStr = nitLimpio.padStart(15, '0');
        let suma = 0;

        for (let i = 0; i < 15; i++) {
            suma += parseInt(nitStr[14 - i]) * primos[i];
        }

        const residuo = suma % 11;
        const dv = residuo > 1 ? 11 - residuo : residuo;
        return dv.toString();
    };

    // Calcular DV automáticamente cuando se selecciona NIT
    useEffect(() => {
        if (formData.clientDocType === 'NIT' && formData.clientDocNumber) {
            // Si el número ya tiene formato con guión, extraer solo el NIT
            const nitSinDV = formData.clientDocNumber.split('-')[0].replace(/\D/g, '');
            if (nitSinDV.length > 0) {
                const dv = calcularDV(nitSinDV);
                setFormData(prev => ({ ...prev, clientDocDV: dv }));
            } else {
                setFormData(prev => ({ ...prev, clientDocDV: '' }));
            }
        } else if (formData.clientDocType !== 'NIT') {
            // Limpiar DV si no es NIT
            setFormData(prev => ({ ...prev, clientDocDV: '' }));
        }
    }, [formData.clientDocType, formData.clientDocNumber]);

    // Confirmar el anticipo desde el modal
    const confirmAdvance = () => {
        if (!advanceDraft.amount || advanceDraft.amount <= 0) {
            alert('Ingresa un monto válido');
            return;
        }
        setAdvances(prev => [...prev, { ...advanceDraft }]);
        // Reset draft
        setAdvanceDraft({
            date: new Date().toISOString().split('T')[0],
            amount: 0,
            method: 'efectivo',
            reference: '',
        });
        setShowAdvanceFormModal(false);
        // Continuar con el submit
        doSubmit();
    };

    // ============================================
    // GUARDAR RECIBO DE COBRO (al cerrar el modal)
    // POST /payment-receipts
    // ============================================
    const savePaymentReceipt = async () => {
        if (!createdInvoice || !createdInvoice.id) {
            Swal.fire({
                icon: 'error',
                title: 'No se puede registrar el recibo',
                text: 'No se encontró la factura recién creada.',
                confirmButtonColor: '#1A1D1F',
            });
            return;
        }
        if (!paymentForm.amount || paymentForm.amount <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Monto inválido',
                text: 'Ingresa un monto mayor a 0.',
                confirmButtonColor: '#1A1D1F',
            });
            return;
        }

        setSavingPaymentReceipt(true);
        try {
            const payload = {
                clientName: formData.clientName,
                clientNit: formData.clientDocNumber,
                clientDocType: formData.clientDocType,
                paymentDate: paymentForm.paymentDate,
                paymentMethod: paymentForm.method,
                paymentMethods: [],
                bankName: null,
                transactionReference: paymentForm.reference || '',
                amount: paymentForm.amount,
                amountReceived: paymentForm.amount,
                notes: `Recaudo automático factura ${createdInvoice.invoiceNumber}`,
                invoices: [{
                    invoiceId: createdInvoice.id,
                    invoiceNumber: createdInvoice.invoiceNumber,
                    amountApplied: paymentForm.amount,
                    retefuente: 0,
                    reteIva: 0,
                    reteIca: 0,
                    impoconsumo: 0,
                }],
            };

            await api.post('/payment-receipts', payload);

            setShowPaymentModal(false);
            Swal.fire({
                icon: 'success',
                title: 'Recibo de cobro generado',
                text: `Se registró el recaudo de la factura ${createdInvoice.invoiceNumber}.`,
                confirmButtonColor: '#1A1D1F',
                timer: 2200,
                timerProgressBar: true,
            });
        } catch (error: any) {
            const msg =
                error?.response?.data?.error ||
                error?.response?.data?.message ||
                error?.message ||
                'Error desconocido al registrar el recibo';
            Swal.fire({
                icon: 'error',
                title: 'No se pudo registrar el recibo',
                text: msg,
                confirmButtonColor: '#1A1D1F',
            });
        } finally {
            setSavingPaymentReceipt(false);
        }
    };

    return (
        <div style={s.wrapper}>

            <div style={s.card}>
                {/* HEADER: LOGO Y DATOS */}
                <div style={s.header}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1, minWidth: 0 }}>
                        <label
                            style={{
                                width: 140,
                                height: 80,
                                border: logoUrl ? '1px solid #e5e7eb' : '2px dashed #d1d5db',
                                borderRadius: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                background: logoUrl ? '#fff' : '#f9fafb',
                                color: '#6b7280',
                                fontSize: 11,
                                flexShrink: 0,
                                position: 'relative',
                                overflow: 'hidden',
                                padding: 4,
                            }}
                            title={logoUrl ? 'Cambiar logo' : 'Subir logo de tu empresa (aparecerá impreso en la factura)'}
                        >
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                style={{ display: 'none' }}
                            />
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt="Logo de la empresa"
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                />
                            ) : (
                                <>
                                    <i className="ri-image-add-line" style={{ fontSize: 24, marginBottom: 4 }} />
                                    <div style={{ fontWeight: 600 }}>Subir logo</div>
                                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                                        Aparece en la factura
                                    </div>
                                </>
                            )}
                        </label>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            {isTestMode ? (
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={e => setCompanyName(e.target.value)}
                                    style={{
                                        border: '1px solid #d1d5db',
                                        borderRadius: 6,
                                        padding: '6px 10px',
                                        fontSize: 22,
                                        fontWeight: 700,
                                        color: '#111827',
                                        width: '100%',
                                        maxWidth: 400,
                                        background: '#fff',
                                    }}
                                    placeholder="Nombre de la empresa"
                                />
                            ) : (
                                <div
                                    style={{
                                        fontSize: 22,
                                        fontWeight: 700,
                                        color: '#111827',
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {companyName || 'Mi Empresa'}
                                </div>
                            )}
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '4px 14px',
                                    marginTop: 6,
                                    fontSize: 12,
                                    color: '#6b7280',
                                }}
                            >
                                {tenantData?.nit && (
                                    <span>
                                        <span style={{ fontWeight: 600, color: '#374151' }}>NIT:</span>{' '}
                                        {tenantData.nit}
                                        {tenantData?.dv ? `-${tenantData.dv}` : ''}
                                    </span>
                                )}
                                {tenantData?.email && (
                                    <span>
                                        <i className="ri-mail-line" /> {tenantData.email}
                                    </span>
                                )}
                                {tenantData?.phone && (
                                    <span>
                                        <i className="ri-phone-line" /> {tenantData.phone}
                                    </span>
                                )}
                                {tenantData?.address && (
                                    <span>
                                        <i className="ri-map-pin-line" /> {tenantData.address}
                                        {tenantData?.city ? `, ${tenantData.city}` : ''}
                                    </span>
                                )}
                                {!tenantData?.nit && !tenantData?.email && !tenantData?.phone && !tenantData?.address && (
                                    <a
                                        href="/contabilidad/config/empresa"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: '#1d4ed8', fontSize: 11, textDecoration: 'underline' }}
                                    >
                                        Completar datos de la empresa →
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={s.invoiceNumber}>
                        {(() => {
                            const configured = einvoicingStatus.invoicingReady && einvoicingStatus.invoicingEnabled;
                            if (!einvoicingStatus.loaded) {
                                return (
                                    <div style={{ color: '#6b7280', fontSize: 13 }}>Cargando…</div>
                                );
                            }
                            if (!configured) {
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                background: '#fee2e2',
                                                color: '#991b1b',
                                                border: '1px solid #fca5a5',
                                                borderRadius: 999,
                                                padding: '4px 10px',
                                                fontSize: 12,
                                                fontWeight: 600,
                                            }}
                                        >
                                            <i className="ri-error-warning-line" />
                                            Facturación electrónica sin configurar
                                        </span>
                                        <a
                                            href="/contabilidad/facturacion-electronica"
                                            style={{ fontSize: 12, color: '#1d4ed8', textDecoration: 'underline' }}
                                        >
                                            Ir a configuración DIAN →
                                        </a>
                                    </div>
                                );
                            }
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            background: '#dcfce7',
                                            color: '#166534',
                                            border: '1px solid #86efac',
                                            borderRadius: 999,
                                            padding: '4px 10px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                        }}
                                    >
                                        <i className="ri-shield-check-line" />
                                        Factura electrónica
                                        {einvoicingStatus.prefix ? ` · ${einvoicingStatus.prefix}` : ''}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={s.invoiceLabel}>No.</div>
                                        <input
                                            type="text"
                                            style={{
                                                ...s.invoiceNum,
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '6px',
                                                padding: '8px 12px',
                                                fontSize: '18px',
                                                fontWeight: 600,
                                                width: '150px',
                                                textAlign: 'center'
                                            }}
                                            value={documentNumber}
                                            onChange={e => setDocumentNumber(e.target.value)}
                                            placeholder="AUTO"
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* BODY: FORMULARIO */}
                <div style={s.body}>
                    {/* GRID DE FORMULARIO */}
                    {/* ── Fila 1 fija: Documento · Nombre · Correo ── */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: '14px 16px',
                            marginBottom: '14px',
                            alignItems: 'end',
                        }}
                    >
                        {/* Documento */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Documento <span style={s.required}>*</span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <select
                                    style={{ ...s.select, width: '80px' }}
                                    value={formData.clientDocType}
                                    onChange={e => handleFormChange('clientDocType', e.target.value)}
                                >
                                    <option value="CC">CC</option>
                                    <option value="NIT">NIT</option>
                                    <option value="CE">CE</option>
                                </select>
                                <div style={{ flex: 1, display: 'flex', gap: '8px', minWidth: 0 }}>
                                    <AutocompleteInput
                                        value={formData.clientDocNumber}
                                        onChange={(val) => handleFormChange('clientDocNumber', val)}
                                        options={clientDocOptions}
                                        placeholder="Buscar Nº de ID"
                                        style={{ flex: 1 }}
                                    />
                                    {formData.clientDocType === 'NIT' && (
                                        <input
                                            type="text"
                                            style={{
                                                ...s.input,
                                                width: '60px',
                                                textAlign: 'center',
                                                fontSize: '14px',
                                                fontWeight: 600
                                            }}
                                            value={formData.clientDocDV}
                                            onChange={e => handleFormChange('clientDocDV', e.target.value)}
                                            placeholder="DV"
                                            maxLength={1}
                                            title="Dígito de Verificación"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Nombre o razón social */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Nombre o razón social <span style={s.required}>*</span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <AutocompleteInput
                                        value={formData.clientName}
                                        onChange={(val) => handleFormChange('clientName', val)}
                                        options={clientNameOptions}
                                        placeholder="Seleccionar cliente"
                                    />
                                </div>
                                <button
                                    type="button"
                                    style={{
                                        ...s.newContactBtn,
                                        marginTop: 0,
                                        padding: '0 12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 8,
                                        whiteSpace: 'nowrap',
                                        background: '#fff',
                                        flexShrink: 0,
                                    }}
                                    title="Crear cliente nuevo"
                                    onClick={() => {
                                        setCustomerError(null);
                                        setNewClient({
                                            idType: 'CC',
                                            idNumber: formData.clientDocNumber || '',
                                            name: formData.clientName || '',
                                            email: formData.email || '',
                                            phone: formData.clientPhone || '',
                                            city: formData.clientCity || '',
                                            address: formData.clientAddress || '',
                                        });
                                        setShowNewClientModal(true);
                                    }}
                                >
                                    + Nuevo
                                </button>
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
                                placeholder="cliente@ejemplo.com"
                            />
                        </div>
                    </div>

                    {/* ── Resto del header (auto-fit) ── */}
                    <div style={s.formGrid}>
                        {/* Fecha */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Fecha <span style={s.required}>*</span>
                            </label>
                            <input
                                type="date"
                                style={s.input}
                                value={formData.date}
                                onChange={e => handleFormChange('date', e.target.value)}
                            />
                        </div>

                        {/* Fecha de vencimiento */}
                        <div style={s.formField}>
                            <label style={s.label}>Fecha de vencimiento</label>
                            <input
                                type="date"
                                style={s.input}
                                value={formData.dueDate}
                                onChange={e => handleFormChange('dueDate', e.target.value)}
                            />
                        </div>

                        {/* Forma de pago */}
                        <div style={s.formField}>
                            <label style={s.label}>
                                Forma de pago <span style={s.required}>*</span>
                            </label>
                            <select
                                style={s.select}
                                value={formData.paymentForm}
                                onChange={e => {
                                    const val = e.target.value;
                                    setFormData(prev => {
                                        const next: any = { ...prev, paymentForm: val };
                                        if (val === 'Credito') {
                                            const days = Number(prev.creditTermDays) || 30;
                                            const d = new Date(prev.date);
                                            if (!isNaN(d.getTime())) {
                                                d.setDate(d.getDate() + days);
                                                next.dueDate = d.toISOString().slice(0, 10);
                                            }
                                        } else {
                                            // Contado → vencimiento = fecha de emisión
                                            next.dueDate = prev.date;
                                        }
                                        return next;
                                    });
                                }}
                            >
                                <option value="Contado">Contado</option>
                                <option value="Credito">Crédito</option>
                            </select>
                        </div>

                        {/* Plazo de crédito (solo si Crédito) */}
                        {formData.paymentForm === 'Credito' && (
                            <div style={s.formField}>
                                <label style={s.label}>
                                    Plazo (días) <span style={s.required}>*</span>
                                </label>
                                <select
                                    style={s.select}
                                    value={formData.creditTermDays}
                                    onChange={e => {
                                        const days = Number(e.target.value) || 30;
                                        setFormData(prev => {
                                            const d = new Date(prev.date);
                                            let newDue = prev.dueDate;
                                            if (!isNaN(d.getTime())) {
                                                d.setDate(d.getDate() + days);
                                                newDue = d.toISOString().slice(0, 10);
                                            }
                                            return { ...prev, creditTermDays: String(days), dueDate: newDue };
                                        });
                                    }}
                                >
                                    <option value="30">30 días</option>
                                    <option value="60">60 días</option>
                                    <option value="90">90 días</option>
                                    <option value="180">180 días</option>
                                </select>
                                <small style={{ color: '#6b7280', fontSize: 11 }}>
                                    La fecha de vencimiento se ajusta automáticamente.
                                </small>
                            </div>
                        )}

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

                        {/* Prefijo - Nº orden interna */}
                        <div style={s.formField}>
                            <label style={s.label}>Prefijo - Nº orden interna</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    style={{ ...s.input, width: '80px' }}
                                    value={formData.orderPrefix}
                                    onChange={e => handleFormChange('orderPrefix', e.target.value)}
                                    placeholder="OC"
                                    maxLength={6}
                                />
                                <input
                                    type="number"
                                    style={{ ...s.input, flex: 1 }}
                                    value={formData.orderNumber}
                                    onChange={e => handleFormChange('orderNumber', e.target.value)}
                                    placeholder="0000"
                                />
                            </div>
                        </div>

                        {/* Fecha de orden */}
                        <div style={s.formField}>
                            <label style={s.label}>Fecha de orden</label>
                            <input
                                type="date"
                                style={s.input}
                                value={formData.orderDate}
                                onChange={e => handleFormChange('orderDate', e.target.value)}
                            />
                        </div>

                        {/* Tipo de operación */}
                        <div style={s.formField}>
                            <label style={s.label}>Tipo de operación (DIAN)</label>
                            <select
                                style={s.select}
                                value={formData.operationType}
                                onChange={e => handleFormChange('operationType', e.target.value)}
                            >
                                {OPERATION_TYPES.map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* % ICA/1000 */}
                        <div style={s.formField}>
                            <label style={s.label}>% ICA / 1000</label>
                            <input
                                type="number"
                                step="0.01"
                                style={s.input}
                                value={formData.icaRate}
                                onChange={e => handleFormChange('icaRate', e.target.value)}
                                placeholder="Ej: 9.66 (Bogotá)"
                            />
                        </div>

                        {/* Lugar de negociación */}
                        <div style={s.formField}>
                            <label style={s.label}>Lugar de negociación</label>
                            <input
                                type="text"
                                style={s.input}
                                value={formData.negotiationPlace}
                                onChange={e => handleFormChange('negotiationPlace', e.target.value)}
                                placeholder="Ciudad / municipio"
                            />
                        </div>

                        {/* --- CAMPOS EXTRA DIAN (cliente) --- */}
                        <div style={s.formField}>
                            <label style={s.label}>Dirección (DIAN) <span style={s.required}>*</span></label>
                            <input
                                type="text"
                                style={s.input}
                                value={formData.clientAddress}
                                onChange={e => handleFormChange('clientAddress', e.target.value)}
                                placeholder="Ej: Calle 123"
                            />
                        </div>

                        <div style={s.formField}>
                            <label style={s.label}>Ciudad <span style={s.required}>*</span></label>
                            <input
                                type="text"
                                style={s.input}
                                value={formData.clientCity}
                                onChange={e => handleFormChange('clientCity', e.target.value)}
                                placeholder="Ej: Bogotá"
                            />
                        </div>

                        <div style={s.formField}>
                            <label style={s.label}>Departamento</label>
                            <input
                                type="text"
                                style={s.input}
                                value={formData.clientDepartment}
                                onChange={e => handleFormChange('clientDepartment', e.target.value)}
                                placeholder="Ej: Cundinamarca"
                            />
                        </div>

                        <div style={s.formField}>
                            <label style={s.label}>Teléfono</label>
                            <input
                                type="text"
                                style={s.input}
                                value={formData.clientPhone}
                                onChange={e => handleFormChange('clientPhone', e.target.value)}
                                placeholder="Ej: 3001234567"
                            />
                        </div>
                    </div>

                    {/* Checkboxes del encabezado */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', padding: '12px 0 20px 0', borderTop: '1px dashed #e5e7eb', borderBottom: '1px dashed #e5e7eb', marginBottom: '20px' }}>
                        <FormGroup check inline>
                            <Input
                                type="checkbox"
                                id="taxFreeDay"
                                checked={formData.taxFreeDay}
                                onChange={e => handleFormChange('taxFreeDay', e.target.checked)}
                            />
                            <Label for="taxFreeDay" check>
                                <i className="ri-price-tag-3-line" style={{ marginRight: 4 }} />
                                Día sin IVA
                            </Label>
                        </FormGroup>

                        <FormGroup check inline>
                            <Input
                                type="checkbox"
                                id="registerPayment"
                                checked={formData.registerPayment}
                                onChange={e => handleFormChange('registerPayment', e.target.checked)}
                            />
                            <Label for="registerPayment" check>
                                <i className="ri-money-dollar-circle-line" style={{ marginRight: 4 }} />
                                Registrar pago al guardar
                            </Label>
                        </FormGroup>
                    </div>

                    {/* TABLA DE ITEMS */}
                    <div style={s.tableWrapper}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    <th style={{ ...s.th, width: '18%' }}>Ítem</th>
                                    <th style={{ ...s.th, width: '9%' }}>Ref.</th>
                                    <th style={{ ...s.th, width: '10%' }}>C. Costo</th>
                                    <th style={{ ...s.th, width: '9%' }}>Precio</th>
                                    <th style={{ ...s.th, width: '7%' }}>% Desc</th>
                                    <th style={{ ...s.th, width: '8%' }}>% IVA</th>
                                    <th style={{ ...s.th, width: '7%' }}>% RF</th>
                                    <th style={{ ...s.th, width: '14%' }}>Descripción</th>
                                    <th style={{ ...s.th, width: '6%' }}>Cant.</th>
                                    <th style={{ ...s.th, width: '9%', textAlign: 'right' }}>Total</th>
                                    <th style={{ ...s.th, width: '3%' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.id}>
                                        <td style={s.td}>
                                            <input
                                                type="text"
                                                placeholder="Buscar ítem facturable"
                                                style={s.inputCell}
                                                value={item.item}
                                                list={`catalog-options-${item.id}`}
                                                onChange={e => {
                                                    updateItem(item.id, 'item', e.target.value);
                                                    linkCatalogToItem(item.id, e.target.value);
                                                }}
                                                onBlur={e => linkCatalogToItem(item.id, e.target.value)}
                                            />
                                            <datalist id={`catalog-options-${item.id}`}>
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
                                                style={{ ...s.inputCell, backgroundColor: '#f9fafb' }}
                                                value={item.reference}
                                                disabled
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <select
                                                style={s.selectCell}
                                                value={item.costCenter}
                                                onChange={e => updateItem(item.id, 'costCenter', e.target.value)}
                                            >
                                                <option value="">— Sin centro de costo —</option>
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
                                                placeholder="Precio uni"
                                                style={s.inputCell}
                                                value={item.price}
                                                onChange={e => updateItem(item.id, 'price', e.target.value)}
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="number"
                                                placeholder="%"
                                                style={s.inputCell}
                                                value={item.discount}
                                                onChange={e => updateItem(item.id, 'discount', e.target.value)}
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <select
                                                style={s.selectCell}
                                                value={item.tax}
                                                onChange={e => updateItem(item.id, 'tax', e.target.value)}
                                                disabled={formData.taxFreeDay}
                                                title={formData.taxFreeDay ? 'Día sin IVA activo: todas las líneas a 0%' : ''}
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
                                                style={s.inputCell}
                                                value={item.retentionRate}
                                                onChange={e => updateItem(item.id, 'retentionRate', e.target.value)}
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="text"
                                                placeholder="Descripción adicional"
                                                style={s.inputCell}
                                                value={item.description}
                                                onChange={e => updateItem(item.id, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="number"
                                                min="1"
                                                style={s.inputCell}
                                                value={item.quantity}
                                                onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                            />
                                        </td>
                                        <td style={{ ...s.td, textAlign: 'right', paddingRight: '12px', fontWeight: 600 }}>
                                            $ {item.total.toLocaleString()}
                                        </td>
                                        <td style={{ ...s.td, textAlign: 'center' }}>
                                            <button style={s.deleteBtn} onClick={() => removeItem(item.id)}>
                                                <i className="ri-close-line" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button style={s.addLineBtn} onClick={addItem}>
                        <i className="ri-add-line" /> Agregar línea
                    </button>

                    {/* FOOTER: FIRMA + TOTALES */}
                    <div style={s.footerGrid}>
                        {/* Izquierda: Firma y Notas */}
                        <div style={s.leftFooter}>
                            <div style={s.signatureBox}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                                    <i className="ri-quill-pen-line" />
                                </div>
                                <div>Utilizar mi firma</div>
                                <div style={{ fontSize: '10px', color: '#d1d5db', marginTop: '4px' }}>178 x 51 píxeles</div>
                            </div>

                            <div style={{ width: '100%' }}>
                                <div style={s.textareaLabel}>
                                    Términos y condiciones
                                    {isTestMode && <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>(Opcional)</span>}
                                </div>
                                <textarea
                                    style={{ ...s.textarea, width: '100%', boxSizing: 'border-box', ...(isTestMode ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                                    value={formData.terms}
                                    onChange={e => !isTestMode && handleFormChange('terms', e.target.value)}
                                    disabled={isTestMode}
                                    rows={4}
                                    title={isTestMode ? 'Campo opcional para facturación electrónica' : ''}
                                />
                            </div>

                            <div style={{ width: '100%' }}>
                                <div style={s.textareaLabel}>
                                    Observaciones
                                    {isTestMode && <span style={{ fontSize: '11px', color: '#999', marginLeft: '8px' }}>(Opcional)</span>}
                                </div>
                                <textarea
                                    style={{ ...s.textarea, width: '100%', boxSizing: 'border-box', ...(isTestMode ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
                                    placeholder="Aquí puedes ingresar comentarios adicionales o información para tu cliente. Por ejemplo: 'Favor consignar a la cuenta No. 000000 del banco XYZ'"
                                    value={formData.notes}
                                    onChange={e => !isTestMode && handleFormChange('notes', e.target.value)}
                                    disabled={isTestMode}
                                    rows={4}
                                    title={isTestMode ? 'Campo opcional para facturación electrónica' : ''}
                                />
                            </div>
                        </div>

                        {/* Derecha: Totales */}
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

                            {/* ImpoConsumo (editable) */}
                            <div style={{ ...s.totalRow, alignItems: 'center' }}>
                                <span>ImpoConsumo</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.impoConsumo}
                                    onChange={e => handleFormChange('impoConsumo', e.target.value)}
                                    style={{ ...s.input, width: '110px', textAlign: 'right', padding: '4px 8px', fontSize: '13px' }}
                                />
                            </div>

                            <div style={s.totalRow}>
                                <span>ReteFuente</span>
                                <span>-$ {calculateReteFuente().toLocaleString()}</span>
                            </div>

                            {/* ReteIVA (editable %) */}
                            <div style={{ ...s.totalRow, alignItems: 'center' }}>
                                <span>ReteIVA (<input
                                    type="number"
                                    step="0.01"
                                    value={formData.reteIvaRate}
                                    onChange={e => handleFormChange('reteIvaRate', e.target.value)}
                                    style={{ width: '50px', padding: '2px 4px', fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '4px', textAlign: 'right' }}
                                /> %)</span>
                                <span>-$ {calculateReteIVA().toLocaleString()}</span>
                            </div>

                            <div style={s.totalRow}>
                                <span>ReteICA</span>
                                <span>-$ {calculateReteICA().toLocaleString()}</span>
                            </div>

                            {advances.length > 0 && (
                                <div style={s.totalRow}>
                                    <span>Anticipos ({advances.length})</span>
                                    <span>-$ {calculateAdvances().toLocaleString()}</span>
                                </div>
                            )}

                            <div style={s.totalFinal}>
                                <span>TOTAL NETO</span>
                                <span>$ {calculateTotal().toLocaleString()}</span>
                            </div>

                            <div
                                style={{
                                    marginTop: '20px',
                                    padding: '16px',
                                    backgroundColor: '#f0f9ff',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    color: '#0369a1'
                                }}
                            >
                                <strong>Pago recibido</strong>
                                <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
                                    Si te hicieron un pago asociado a esta venta puedes hacer aquí su registro.
                                </p>
                                <button
                                    style={{ ...s.newContactBtn, marginTop: '8px' }}
                                    onClick={() => setShowAdvanceFormModal(true)}
                                >
                                    <i className="ri-add-line" /> Agregar anticipo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BARRA DE BOTONES FIJA */}
            <div style={s.bottomBar}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={s.btnSecondary} onClick={() => navigate('/ingresos/documentos')}>
                        Cancelar
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={s.btnSecondary} onClick={() => handleSave(true)} disabled={loading}>
                        {loading ? 'Procesando...' : 'Guardar borrador'}
                    </button>
                    <button style={s.btnPrimary} onClick={() => handleSave(false)} disabled={loading}>
                        {loading ? 'Enviando a DIAN...' : 'Guardar y Enviar a DIAN'}
                    </button>
                </div>
            </div>

            {/* MODAL NUEVO CONTACTO */}
            <CrumiModal
                isOpen={showNewClientModal}
                toggle={() => setShowNewClientModal(false)}
                title="Nuevo cliente"
                subtitle="Registra un nuevo cliente"
                onSubmit={handleAddClient}
                submitText="Crear cliente"
                isSubmitting={savingCustomer}
                submitDisabled={!newClient.name.trim() || !newClient.idNumber.trim()}
            >
                {customerError && (
                    <Alert color="danger" className="d-flex align-items-start gap-2 mb-3">
                        <i className="ri-error-warning-line fs-18 mt-1" />
                        <div className="flex-grow-1">
                            <strong>No se pudo crear el cliente</strong>
                            <div className="fs-13">
                                {customerError.toLowerCase().includes('fetch') ||
                                customerError.toLowerCase().includes('network')
                                    ? 'No pudimos conectar con el servidor. Revisa que el backend esté corriendo.'
                                    : customerError}
                            </div>
                        </div>
                    </Alert>
                )}

                <Row className="g-3">
                    <Col md={6}>
                        <Label className="form-label">
                            Tipo doc. <span style={s.required}>*</span>
                        </Label>
                        <Input
                            type="select"
                            value={newClient.idType}
                            onChange={e => setNewClient({ ...newClient, idType: e.target.value })}
                        >
                            <option value="CC">CC - Cédula de ciudadanía</option>
                            <option value="NIT">NIT</option>
                            <option value="CE">CE - Cédula de extranjería</option>
                            <option value="PP">PP - Pasaporte</option>
                        </Input>
                    </Col>
                    <Col md={6}>
                        <Label className="form-label">
                            N° documento <span style={s.required}>*</span>
                        </Label>
                        <Input
                            type="text"
                            value={newClient.idNumber}
                            onChange={e => setNewClient({ ...newClient, idNumber: e.target.value })}
                        />
                    </Col>
                    <Col md={12}>
                        <Label className="form-label">
                            Razón social / Nombre <span style={s.required}>*</span>
                        </Label>
                        <Input
                            type="text"
                            value={newClient.name}
                            onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                        />
                    </Col>
                    <Col md={6}>
                        <Label className="form-label">Email</Label>
                        <Input
                            type="email"
                            value={newClient.email}
                            onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                        />
                    </Col>
                    <Col md={6}>
                        <Label className="form-label">Teléfono</Label>
                        <Input
                            type="text"
                            value={newClient.phone}
                            onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                        />
                    </Col>
                    <Col md={6}>
                        <Label className="form-label">Ciudad</Label>
                        <Input
                            type="text"
                            value={newClient.city}
                            onChange={e => setNewClient({ ...newClient, city: e.target.value })}
                        />
                    </Col>
                    <Col md={6}>
                        <Label className="form-label">Dirección</Label>
                        <Input
                            type="text"
                            value={newClient.address}
                            onChange={e => setNewClient({ ...newClient, address: e.target.value })}
                        />
                    </Col>
                </Row>
            </CrumiModal>

            {/* ============================================ */}
            {/* MODAL: ¿ANTICIPO? (pregunta previa al POST)  */}
            {/* ============================================ */}
            <Modal isOpen={showAdvanceAskModal} toggle={() => setShowAdvanceAskModal(false)} centered>
                <ModalHeader toggle={() => setShowAdvanceAskModal(false)}>
                    <i className="ri-wallet-3-line" style={{ marginRight: 8 }} />
                    ¿Quieres registrar un anticipo?
                </ModalHeader>
                <ModalBody>
                    <p>¿El cliente dejó un anticipo para esta factura?</p>
                    <p className="text-muted" style={{ fontSize: '12px' }}>
                        Si lo registras, el monto se restará del TOTAL y aparecerá en la línea "Anticipos".
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button
                        color="secondary"
                        outline
                        onClick={() => {
                            setShowAdvanceAskModal(false);
                            const asDraft = (window as any).__crumi_pending_draft === true;
                            (window as any).__crumi_pending_draft = undefined;
                            doSubmit(asDraft);
                        }}
                    >
                        No, continuar
                    </Button>
                    <Button
                        color="primary"
                        onClick={() => {
                            setShowAdvanceAskModal(false);
                            setShowAdvanceFormModal(true);
                        }}
                    >
                        <i className="ri-add-line" style={{ marginRight: 4 }} />
                        Sí, registrar
                    </Button>
                </ModalFooter>
            </Modal>

            {/* ============================================ */}
            {/* MODAL: REGISTRAR ANTICIPO (form)             */}
            {/* ============================================ */}
            <Modal isOpen={showAdvanceFormModal} toggle={() => setShowAdvanceFormModal(false)} centered>
                <ModalHeader toggle={() => setShowAdvanceFormModal(false)}>
                    <i className="ri-money-dollar-circle-line" style={{ marginRight: 8 }} />
                    Registrar anticipo
                </ModalHeader>
                <ModalBody>
                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Fecha</Label>
                                <Input
                                    type="date"
                                    value={advanceDraft.date}
                                    onChange={e => setAdvanceDraft({ ...advanceDraft, date: e.target.value })}
                                />
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Monto</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={advanceDraft.amount || ''}
                                    onChange={e => setAdvanceDraft({ ...advanceDraft, amount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0"
                                />
                            </FormGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Método</Label>
                                <Input
                                    type="select"
                                    value={advanceDraft.method}
                                    onChange={e => setAdvanceDraft({ ...advanceDraft, method: e.target.value })}
                                >
                                    <option value="efectivo">Efectivo</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="pse">PSE</option>
                                    <option value="cheque">Cheque</option>
                                </Input>
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label>Referencia</Label>
                                <Input
                                    type="text"
                                    value={advanceDraft.reference}
                                    onChange={e => setAdvanceDraft({ ...advanceDraft, reference: e.target.value })}
                                    placeholder="# comprobante / nota"
                                />
                            </FormGroup>
                        </Col>
                    </Row>
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" outline onClick={() => setShowAdvanceFormModal(false)}>
                        Cancelar
                    </Button>
                    <Button color="primary" onClick={confirmAdvance}>
                        <i className="ri-check-line" style={{ marginRight: 4 }} />
                        Aceptar y continuar
                    </Button>
                </ModalFooter>
            </Modal>

            {/* ============================================ */}
            {/* MODAL: RECAUDO (checkbox Registrar pago)     */}
            {/* Envía POST /payment-receipts                  */}
            {/* ============================================ */}
            <Modal isOpen={showPaymentModal} toggle={() => !savingPaymentReceipt && setShowPaymentModal(false)} centered>
                <ModalHeader toggle={() => !savingPaymentReceipt && setShowPaymentModal(false)}>
                    <i className="ri-bank-card-line" style={{ marginRight: 8 }} />
                    Registrar recaudo
                </ModalHeader>
                <ModalBody>
                    <p>
                        Registra el pago asociado a la factura{' '}
                        <strong>{createdInvoice?.invoiceNumber || ''}</strong>.
                    </p>
                    <FormGroup>
                        <Label>Fecha de pago</Label>
                        <Input
                            type="date"
                            value={paymentForm.paymentDate}
                            onChange={e => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label>Monto recibido</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentForm.amount || ''}
                            onChange={e => setPaymentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        />
                    </FormGroup>
                    <FormGroup>
                        <Label>Método</Label>
                        <Input
                            type="select"
                            value={paymentForm.method}
                            onChange={e => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
                        >
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="PSE">PSE</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Tarjeta">Tarjeta</option>
                        </Input>
                    </FormGroup>
                    <FormGroup>
                        <Label>Referencia (opcional)</Label>
                        <Input
                            type="text"
                            value={paymentForm.reference}
                            onChange={e => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                            placeholder="# comprobante / nota"
                        />
                    </FormGroup>
                </ModalBody>
                <ModalFooter>
                    <Button
                        color="secondary"
                        outline
                        onClick={() => setShowPaymentModal(false)}
                        disabled={savingPaymentReceipt}
                    >
                        Cerrar
                    </Button>
                    <Button color="primary" onClick={savePaymentReceipt} disabled={savingPaymentReceipt}>
                        {savingPaymentReceipt ? 'Guardando...' : 'Guardar recaudo'}
                    </Button>
                </ModalFooter>
            </Modal>

            {/* ============================================ */}
            {/* MODAL RESULTADO DIAN                          */}
            {/* ============================================ */}
            {showDianModal && dianResult && (
                <div style={s.modalOverlay}>
                    <div style={{ ...s.modal, width: '600px', position: 'relative' }}>
                        {/* Botón de cierre */}
                        <button
                            onClick={() => setShowDianModal(false)}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'rgba(255, 255, 255, 0.2)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                color: 'white',
                                fontSize: '20px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10000,
                                transition: 'all 0.2s',
                                lineHeight: '1'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            ×
                        </button>
                        <div style={{
                            padding: '24px',
                            background: dianResult.demoMode
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
                            color: 'white',
                            textAlign: 'center' as const
                        }}>
                            <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                                <i className={dianResult.success ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'} />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
                                {dianResult.success ? 'Factura Electrónica Creada' : 'Error en Factura'}
                            </h2>
                            {dianResult.demoMode && (
                                <div style={{
                                    marginTop: '8px',
                                    padding: '6px 16px',
                                    background: 'rgba(255,255,255,0.2)',
                                    borderRadius: '20px',
                                    display: 'inline-block',
                                    fontSize: '12px',
                                    fontWeight: 600
                                }}>
                                    <i className="ri-flask-line" style={{ marginRight: 4 }} />
                                    MODO DEMO - Sin conexión real a DIAN
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '24px' }}>
                            {/* Información principal */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '16px',
                                marginBottom: '20px'
                            }}>
                                <div style={{
                                    background: '#f8f9fa',
                                    padding: '16px',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                                        Número Interno
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                                        {dianResult.invoiceNumber}
                                    </div>
                                </div>
                                <div style={{
                                    background: '#f8f9fa',
                                    padding: '16px',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                                        Número DIAN
                                    </div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                                        {dianResult.dianNumber}
                                    </div>
                                </div>
                            </div>

                            {/* CUFE */}
                            <div style={{
                                background: '#fef3c7',
                                border: '1px solid #fcd34d',
                                padding: '16px',
                                borderRadius: '8px',
                                marginBottom: '16px'
                            }}>
                                <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '4px', fontWeight: 600 }}>
                                    <i className="ri-shield-keyhole-line" style={{ marginRight: 4 }} />
                                    CUFE (Código Único de Factura Electrónica)
                                </div>
                                <div style={{
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    color: '#78350f',
                                    wordBreak: 'break-all' as const
                                }}>
                                    {dianResult.cufe}
                                </div>
                            </div>

                            {/* Track ID y Cliente */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '16px',
                                marginBottom: '20px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                                        Track ID
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#374151' }}>
                                        {dianResult.trackId}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                                        Cliente
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#374151' }}>
                                        {dianResult.client}
                                    </div>
                                </div>
                            </div>

                            {/* Total */}
                            <div style={{
                                background: '#111827',
                                color: 'white',
                                padding: '16px 20px',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '24px'
                            }}>
                                <span style={{ fontSize: '14px' }}>Total Factura</span>
                                <span style={{ fontSize: '24px', fontWeight: 700 }}>
                                    ${dianResult.total?.toLocaleString('es-CO')} COP
                                </span>
                            </div>

                            {/* Botones */}
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {dianResult.xmlPath && (
                                    <a
                                        href={`${env.API_URL.replace('/api', '')}${dianResult.xmlPath}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            ...s.btnSecondary,
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <i className="ri-file-text-line" /> Ver XML
                                    </a>
                                )}
                                <button
                                    style={{ ...s.btnSecondary }}
                                    onClick={() => {
                                        navigator.clipboard.writeText(dianResult.cufe);
                                        alert('CUFE copiado al portapapeles');
                                    }}
                                >
                                    <i className="ri-clipboard-line" /> Copiar CUFE
                                </button>
                                <button
                                    style={{ ...s.btnPrimary, flex: 1 }}
                                    onClick={() => {
                                        setShowDianModal(false);
                                        navigate('/ingresos/documentos');
                                    }}
                                >
                                    Ir al Listado <i className="ri-arrow-right-line" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacturaTab;
