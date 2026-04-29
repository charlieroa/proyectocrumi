// src/pages/income/SalesInvoice/tabs/CotizacionTab.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentConfig } from '../Create';
import AutocompleteInput from '../../../../Components/AutocompleteInput';
import useAccountingCustomers from '../../../../Components/Contabilidad/useAccountingCustomers';
import { api } from '../../../../services/api';
import { getCrumiFormStyles } from '../crumiFormStyles';
import CrumiModal from '../../../../Components/Common/CrumiModal';
import { env } from '../../../../env';
import { getProducts, Product } from '../../../../services/productApi';
import { getServicesByTenant, ServiceItem } from '../../../../services/serviceApi';
import { getTenantIdFromToken, getToken } from '../../../../services/auth';
import { getCostCenters, CostCenter } from '../../../../services/costCenterApi';
import {
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
    costCenter: string;         // Centro de costo (por línea)
    retentionRate: string;      // % Retención en la Fuente ESTIMADA por línea
    productId?: number | null;
    serviceId?: number | null;
}

interface Client {
    idType: string;
    idNumber: string;
    name: string;
    email: string;
}

interface CotizacionTabProps {
    config: DocumentConfig;
    isTestMode?: boolean; // Indica si estamos creando documentos para el Set de Pruebas
}

// ============================================
// MOCK DATA (TODO: backend — fetch real)
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

// ============================================
// COMPONENTE
// ============================================
const CotizacionTab: React.FC<CotizacionTabProps> = ({ config, isTestMode = false }) => {
    const navigate = useNavigate();

    // Clientes del módulo contable (tabla third_parties)
    const { customers: crmcontacts, refresh: refreshCustomers } = useAccountingCustomers();

    // Estados
    const [loading, setLoading] = useState(false);
    const [documentNumber] = useState('AUTO');
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [logoUrl, setLogoUrl] = useState('');
    const [companyName] = useState('armadilloazul');

    // Modal confirmación al guardar (¿enviar por email?)

    // Toast/Alert para PDF (futuro)

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

    // Default: vencimiento = hoy + 15 días (default validez)
    const defaultValidityDays = 15;
    const addDaysISO = (isoDate: string, days: number) => {
        const d = new Date(isoDate);
        if (isNaN(d.getTime())) return '';
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };
    const todayISO = new Date().toISOString().split('T')[0];

    // Form data
    const [formData, setFormData] = useState({
        documentType: 'Cotización',
        warehouse: 'Principal',
        priceList: 'General',
        seller: '',
        clientDocType: 'CC',
        clientDocNumber: '',
        clientName: '',
        email: '',
        date: todayISO,
        validityDays: String(defaultValidityDays),
        validUntil: addDaysISO(todayISO, defaultValidityDays),
        paymentForm: 'Contado',
        paymentMethod: '',
        notes: '',
        terms: 'Esta cotización es válida por 15 días. Los precios están sujetos a cambios sin previo aviso.',

        // ===== Nuevos campos de header (ref. Siigo) =====
        branchId: '1',              // TODO: backend — sucursal
        orderPrefix: '',            // Prefijo de cotización interna
        orderNumber: '',            // N° cotización interna
        costCenterGlobal: '1',      // TODO: backend — centro de costo global
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
        }
    ]);

    // Catálogo Productos & Servicios (trazabilidad en cotizaciones)
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
                    ...it, item: match.name, reference: match.sku,
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

    // Nuevo cliente
    const [newClient, setNewClient] = useState<Client>({
        idType: 'CC - Cédula de ciudadanía',
        idNumber: '',
        name: '',
        email: ''
    });

    // ============================================
    // HANDLERS
    // ============================================
    const handleFormChange = (field: string, value: any) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };

            // Autocalcular fecha vencimiento cuando cambian fecha o validez
            if (field === 'date') {
                const days = parseInt(prev.validityDays) || 0;
                next.validUntil = addDaysISO(value, days);
            }
            if (field === 'validityDays') {
                const days = parseInt(value) || 0;
                next.validUntil = addDaysISO(prev.date, days);
            }

            return next;
        });

        // Auto-populate when client name matches
        if (field === 'clientName') {
            const foundClient = crmcontacts.find((c: any) =>
                `${c.first_name} ${c.last_name}`.trim() === value || c.name === value
            );
            if (foundClient) {
                setFormData(prev => ({
                    ...prev,
                    clientName: value,
                    clientDocNumber: foundClient.identification || foundClient.id || '',
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
                costCenter: formData.costCenterGlobal || '1',
                retentionRate: '0',
                productId: null,
                serviceId: null,
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

                    // total = (cantidad × v.unitario) × (1 - %desc/100) × (1 + %iva/100 - %rf/100)
                    const price = parseFloat(updated.price) || 0;
                    const qty = updated.quantity || 0;
                    const disc = parseFloat(updated.discount) || 0;
                    const taxRate = parseFloat(updated.tax) || 0;
                    const rfRate = parseFloat(updated.retentionRate) || 0;

                    const subtotal = price * qty;
                    const afterDiscount = subtotal * (1 - disc / 100);
                    const netFactor = 1 + taxRate / 100 - rfRate / 100;

                    updated.total = afterDiscount * netFactor;
                    return updated;
                }
                return item;
            })
        );
    };

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

    const taxableBaseLine = (i: InvoiceItem) => {
        const price = parseFloat(i.price) || 0;
        const qty = i.quantity || 0;
        const disc = parseFloat(i.discount) || 0;
        return price * qty * (1 - disc / 100);
    };

    const calculateGrossValue = () => calculateSubtotal() - calculateTotalDiscount();

    const calculateTotalTax = () =>
        items.reduce((sum, i) => {
            const base = taxableBaseLine(i);
            const taxRate = parseFloat(i.tax) || 0;
            return sum + base * (taxRate / 100);
        }, 0);

    // ReteFuente ESTIMADA (en cotización no se causa; sólo informativa)
    const calculateReteFuente = () =>
        items.reduce((sum, i) => {
            const base = taxableBaseLine(i);
            const rf = parseFloat(i.retentionRate) || 0;
            return sum + base * (rf / 100);
        }, 0);

    const calculateTotal = () =>
        calculateGrossValue() + calculateTotalTax() - calculateReteFuente();

    // ============================================
    // GUARDAR COTIZACIÓN
    // ============================================
    const validateAndOpenSaveModal = () => {
        if (!formData.clientName) {
            return alert('Debes seleccionar un cliente');
        }
        if (items.some(i => !i.item || !i.price)) {
            return alert('Completa todos los items (nombre y precio)');
        }
        doSubmit();
    };

    const doSubmit = async () => {
        setLoading(true);

        const payload = {
            clientId: formData.clientDocNumber || null,
            clientName: formData.clientName,
            clientDocType: formData.clientDocType,
            clientPhone: (formData as any).clientPhone || null,
            clientAddress: (formData as any).clientAddress || null,
            email: formData.email,
            seller: formData.seller || null,
            date: formData.date,
            validUntil: formData.validUntil || null,
            paymentForm: formData.paymentForm,
            paymentMethod: formData.paymentMethod || null,
            notes: formData.notes,
            terms: formData.terms,
            items: items.map(i => ({
                item: i.item,
                reference: i.reference || '',
                description: i.description || '',
                quantity: Number(i.quantity),
                unitPrice: Number(i.price),
                discount: Number(i.discount) || 0,
                tax: Number(i.tax) || 0,
                productId: i.productId ?? null,
                serviceId: i.serviceId ?? null,
                costCenter: i.costCenter,
                retentionRate: Number(i.retentionRate) || 0,
            })),
            branchId: formData.branchId || null,
            orderPrefix: formData.orderPrefix || null,
            orderNumber: formData.orderNumber || null,
            costCenterGlobal: formData.costCenterGlobal || null,
            subtotal: calculateSubtotal(),
            discount: calculateTotalDiscount(),
            grossValue: calculateGrossValue(),
            taxAmount: calculateTotalTax(),
            total: calculateTotal(),
            isTestMode: isTestMode || false,
        };

        try {
            const token = getToken();

            if (!token) {
                throw new Error('No se encontró token de autenticación. Por favor inicia sesión.');
            }

            const response = await fetch(`${env.API_URL}/quotes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al guardar la cotización');
            }

            alert(
                `Cotización creada exitosamente!\n\n` +
                `Número: ${data.quote.number}\n` +
                `Cliente: ${data.quote.clientName}\n` +
                `Total: $${Number(data.quote.total).toLocaleString()}`
            );

            navigate('/ingresos/documentos');
        } catch (error: any) {
            console.error('Error al guardar cotización:', error);
            alert(`Error al guardar la cotización:\n${error.message}`);
        } finally {
            setLoading(false);
        }
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
        if (!newClient.name || !newClient.idNumber) {
            alert('Por favor completa nombre e identificación');
            return;
        }

        try {
            // Normaliza el tipo de documento (el select trae "CC - Cédula..."; el backend espera el código)
            const docType = (newClient.idType || 'CC').split(' ')[0].trim() || 'CC';
            const payload = {
                kind: 'CUSTOMER',
                name: newClient.name,
                document_type: docType,
                document_number: newClient.idNumber,
                email: newClient.email,
            };
            const res = await api.post('/accounting/third-parties', payload);
            if (!res?.data?.success) {
                throw new Error(res?.data?.message || 'Respuesta inválida del servidor');
            }

            setFormData(prev => ({
                ...prev,
                clientDocNumber: newClient.idNumber,
                clientName: newClient.name,
                email: newClient.email
            }));
            setShowNewClientModal(false);
            setNewClient({ idType: 'CC - Cédula de ciudadanía', idNumber: '', name: '', email: '' });

            refreshCustomers();

        } catch (error: any) {
            console.error("Error creating contact:", error);
            const msg = error?.response?.data?.message || error?.message || 'Error desconocido';
            alert('Error al crear el contacto: ' + msg);
        }
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
    const clientDocOptions = useMemo(() => {
        return (crmcontacts || []).map((client: any) => {
            const name = client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim();
            const docNumber = client.identification || client.id || '';
            return {
                value: String(docNumber),
                label: String(docNumber),
                sublabel: name
            };
        });
    }, [crmcontacts]);

    return (
        <div style={s.wrapper}>
            <div style={s.card}>
                {/* BARRA SUPERIOR */}
                <div style={s.topBar}>
                    <div>
                        <label style={s.topLabel}>Tipo de documento</label>
                        <select
                            style={{ ...s.topSelect, ...s.topSelectActive }}
                            value="Cotización"
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
                        <label style={s.topLabel}>Bodega</label>
                        <select
                            style={s.topSelect}
                            value={formData.warehouse}
                            onChange={e => handleFormChange('warehouse', e.target.value)}
                        >
                            <option value="Principal">Principal</option>
                        </select>
                    </div>
                    {/* Sucursal — TODO: backend */}
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
                            style={s.topSelect}
                            value={formData.priceList}
                            onChange={e => handleFormChange('priceList', e.target.value)}
                        >
                            <option value="General">General</option>
                        </select>
                    </div>
                    <div>
                        <label style={s.topLabel}>Vendedor</label>
                        <select
                            style={s.topSelect}
                            value={formData.seller}
                            onChange={e => handleFormChange('seller', e.target.value)}
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
                            <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" style={s.logoImage} />
                            ) : (
                                <>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                                        <i className="ri-camera-line" />
                                    </div>
                                    <div>Utilizar mi logo</div>
                                    <div style={{ fontSize: '10px', color: '#d1d5db', marginTop: '4px' }}>178 x 51 píxeles</div>
                                </>
                            )}
                        </label>
                        <div style={s.companyName}>{companyName}</div>
                    </div>

                    <div style={s.invoiceNumber}>
                        <div style={s.invoiceLabel}>No.</div>
                        <div style={s.invoiceNum}>
                            {documentNumber}
                            <span style={{ fontSize: '16px', color: '#9ca3af', cursor: 'pointer' }}>
                                <i className="ri-settings-3-line" />
                            </span>
                        </div>
                    </div>
                </div>

                {/* BODY: FORMULARIO */}
                <div style={s.body}>
                    {/* Header fields en grid Reactstrap */}
                    <Row className="g-3 mb-3">
                        {/* Documento (tipo + número) */}
                        <Col md={4}>
                            <Label style={s.label}>
                                Documento <span style={s.required}>*</span>
                            </Label>
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
                                        placeholder="Buscar Nº de ID"
                                    />
                                </div>
                            </div>
                        </Col>

                        {/* Nombre o razón social */}
                        <Col md={4}>
                            <Label style={s.label}>
                                Nombre o razón social <span style={s.required}>*</span>
                            </Label>
                            <AutocompleteInput
                                value={formData.clientName}
                                onChange={(val) => handleFormChange('clientName', val)}
                                options={clientNameOptions}
                                placeholder="Seleccionar cliente"
                            />
                            <button style={s.newContactBtn} onClick={() => setShowNewClientModal(true)}>
                                <i className="ri-add-line" /> Nuevo contacto
                            </button>
                        </Col>

                        {/* Correo */}
                        <Col md={4}>
                            <Label style={s.label}>Correo</Label>
                            <Input
                                type="email"
                                style={s.input}
                                value={formData.email}
                                onChange={e => handleFormChange('email', e.target.value)}
                            />
                        </Col>

                        {/* Fecha de emisión */}
                        <Col md={4}>
                            <Label style={s.label}>
                                Fecha de emisión <span style={s.required}>*</span>
                            </Label>
                            <Input
                                type="date"
                                style={s.input}
                                value={formData.date}
                                onChange={e => handleFormChange('date', e.target.value)}
                            />
                        </Col>

                        {/* Validez (días) */}
                        <Col md={4}>
                            <Label style={s.label}>Validez (días)</Label>
                            <Input
                                type="number"
                                min="1"
                                style={s.input}
                                value={formData.validityDays}
                                onChange={e => handleFormChange('validityDays', e.target.value)}
                                placeholder="15"
                            />
                        </Col>

                        {/* Fecha de vencimiento (readonly, autocalc) */}
                        <Col md={4}>
                            <Label style={s.label}>Fecha de vencimiento</Label>
                            <Input
                                type="date"
                                readOnly
                                style={{ ...s.input, backgroundColor: '#f9fafb' }}
                                value={formData.validUntil}
                                title="Se calcula automáticamente con la validez"
                            />
                        </Col>

                        {/* Prefijo + N° cotización interna */}
                        <Col md={4}>
                            <Label style={s.label}>Prefijo / N° cotización interna</Label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Input
                                    type="text"
                                    style={{ ...s.input, width: '90px' }}
                                    value={formData.orderPrefix}
                                    onChange={e => handleFormChange('orderPrefix', e.target.value)}
                                    placeholder="COT"
                                    maxLength={6}
                                />
                                <Input
                                    type="text"
                                    style={{ ...s.input, flex: 1 }}
                                    value={formData.orderNumber}
                                    onChange={e => handleFormChange('orderNumber', e.target.value)}
                                    placeholder="0000"
                                />
                            </div>
                        </Col>

                        {/* Centro de costo global — TODO: backend */}
                        <Col md={4}>
                            <Label style={s.label}>Centro de costo global</Label>
                            <select
                                style={s.select}
                                value={formData.costCenterGlobal}
                                onChange={e => handleFormChange('costCenterGlobal', e.target.value)}
                            >
                                <option value="">— Sin CC global —</option>
                                {costCentersList.length > 0
                                    ? costCentersList.filter(cc => cc.is_active).map(cc => (
                                        <option key={cc.id} value={cc.code}>{cc.code} — {cc.name}</option>
                                    ))
                                    : COST_CENTERS_MOCK.map(cc => (
                                        <option key={cc.id} value={cc.id}>{cc.label}</option>
                                    ))
                                }
                            </select>
                        </Col>

                        {/* Forma de pago */}
                        <Col md={4}>
                            <Label style={s.label}>
                                Forma de pago <span style={s.required}>*</span>
                            </Label>
                            <select
                                style={s.select}
                                value={formData.paymentForm}
                                onChange={e => handleFormChange('paymentForm', e.target.value)}
                            >
                                <option value="Contado">Contado</option>
                                <option value="Credito">Crédito</option>
                            </select>
                        </Col>

                        {/* Medio de pago */}
                        <Col md={4}>
                            <Label style={s.label}>Medio de pago</Label>
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
                        </Col>

                        {/* Observaciones */}
                        <Col md={8}>
                            <Label style={s.label}>Observaciones</Label>
                            <Input
                                type="text"
                                style={s.input}
                                value={formData.notes}
                                onChange={e => handleFormChange('notes', e.target.value)}
                                placeholder="Notas visibles en la cotización..."
                            />
                        </Col>
                    </Row>

                    {/* TABLA DE ITEMS */}
                    <div style={s.tableWrapper}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    <th style={{ ...s.th, width: '18%' }}>Ítem/Concepto</th>
                                    <th style={{ ...s.th, width: '16%' }}>Descripción</th>
                                    <th style={{ ...s.th, width: '10%' }}>C. Costo</th>
                                    <th style={{ ...s.th, width: '7%' }}>Cant.</th>
                                    <th style={{ ...s.th, width: '10%' }}>V. Unitario</th>
                                    <th style={{ ...s.th, width: '7%' }}>% Desc</th>
                                    <th style={{ ...s.th, width: '8%' }}>% IVA</th>
                                    <th style={{ ...s.th, width: '8%' }}>% RF est.</th>
                                    <th style={{ ...s.th, width: '13%', textAlign: 'right' }}>Valor total</th>
                                    <th style={{ ...s.th, width: '3%' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.id}>
                                        <td style={s.td}>
                                            <input
                                                type="text"
                                                placeholder="Buscar ítem / concepto"
                                                style={s.inputCell}
                                                value={item.item}
                                                list={`cot-catalog-${item.id}`}
                                                onChange={e => {
                                                    updateItem(item.id, 'item', e.target.value);
                                                    linkCatalogToItem(item.id, e.target.value);
                                                }}
                                                onBlur={e => linkCatalogToItem(item.id, e.target.value)}
                                            />
                                            <datalist id={`cot-catalog-${item.id}`}>
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
                                                placeholder="Descripción adicional"
                                                style={s.inputCell}
                                                value={item.description}
                                                onChange={e => updateItem(item.id, 'description', e.target.value)}
                                            />
                                        </td>
                                        {/* Centro de costo por línea (real desde catálogo) */}
                                        <td style={s.td}>
                                            <select
                                                style={s.selectCell}
                                                value={item.costCenter}
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
                                                min="1"
                                                style={s.inputCell}
                                                value={item.quantity}
                                                onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                            />
                                        </td>
                                        <td style={s.td}>
                                            <input
                                                type="number"
                                                placeholder="V. unitario"
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
                                            >
                                                <option value="">IVA</option>
                                                <option value="0">0%</option>
                                                <option value="5">IVA 5%</option>
                                                <option value="19">IVA 19%</option>
                                            </select>
                                        </td>
                                        {/* % RF estimado — TODO: backend (solo informativo en cotización) */}
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
                                                title="Retención en la fuente estimada (no se causa en cotización)"
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
                        <div style={s.leftFooter}>
                            <div style={s.signatureBox}>
                                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                                    <i className="ri-quill-pen-line" />
                                </div>
                                <div>Utilizar mi firma</div>
                                <div style={{ fontSize: '10px', color: '#d1d5db', marginTop: '4px' }}>178 x 51 píxeles</div>
                            </div>

                            <div style={{ width: '100%' }}>
                                <div style={s.textareaLabel}>Términos y condiciones</div>
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
                                    placeholder="Notas visibles en la cotización..."
                                    value={formData.notes}
                                    onChange={e => handleFormChange('notes', e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </div>

                        {/* Totales (SIN ImpoConsumo / ReteIVA / ReteICA) */}
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
                            {/* ReteFuente estimada — TODO: backend (informativa) */}
                            <div style={s.totalRow} title="Estimada — no se causa en cotización">
                                <span>
                                    ReteFuente estimada
                                    <i className="ri-information-line" style={{ marginLeft: 4, color: '#9ca3af' }} />
                                </span>
                                <span>-$ {calculateReteFuente().toLocaleString()}</span>
                            </div>
                            <div style={s.totalFinal}>
                                <span>TOTAL COTIZADO</span>
                                <span>$ {calculateTotal().toLocaleString()}</span>
                            </div>

                            <div
                                style={{
                                    marginTop: '16px',
                                    padding: '12px',
                                    backgroundColor: '#fef9c3',
                                    border: '1px dashed #facc15',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    color: '#713f12'
                                }}
                            >
                                <i className="ri-information-line" style={{ marginRight: 4 }} />
                                Las retenciones mostradas son estimadas y sólo se causan al emitir la factura.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BARRA INFERIOR */}
            <div style={s.bottomBar}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={s.btnSecondary} onClick={() => navigate('/ingresos/documentos')}>
                        Cancelar
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={s.btnSecondary} onClick={validateAndOpenSaveModal} disabled={loading}>
                        Guardar y crear nueva
                    </button>
                    <button style={s.btnPrimary} onClick={validateAndOpenSaveModal} disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar cotización'}
                    </button>
                </div>
            </div>

            {/* MODAL NUEVO CONTACTO */}
            <CrumiModal
                isOpen={showNewClientModal}
                toggle={() => setShowNewClientModal(false)}
                title="Nuevo contacto"
                subtitle="Registra un nuevo cliente o proveedor"
                onSubmit={handleAddClient}
                submitText="Crear contacto"
            >
                <div className="flex gap-3 mb-6">
                    <button className="flex-1 py-2.5 rounded-lg font-semibold text-xs bg-crumi-accent/10 text-crumi-accent border-2 border-crumi-accent">
                        Cliente
                    </button>
                    <button className="flex-1 py-2.5 rounded-lg font-semibold text-xs bg-white dark:bg-crumi-surface-dark text-crumi-text-muted dark:text-crumi-text-dark-muted border border-gray-200 dark:border-gray-700">
                        Proveedor
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-crumi-text-primary dark:text-crumi-text-dark-primary mb-1">
                            Tipo de identificacion <span className="text-crumi-danger">*</span>
                        </label>
                        <select
                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-crumi-surface-dark text-crumi-text-primary dark:text-crumi-text-dark-primary focus:ring-2 focus:ring-crumi-accent/30 focus:border-crumi-accent outline-none transition-all"
                            value={newClient.idType}
                            onChange={e => setNewClient({ ...newClient, idType: e.target.value })}
                        >
                            <option value="CC - Cédula de ciudadanía">CC - Cedula de ciudadania</option>
                            <option value="NIT">NIT</option>
                            <option value="CE">CE</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-crumi-text-primary dark:text-crumi-text-dark-primary mb-1">
                            Número de identificación <span className="text-crumi-danger">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-crumi-surface-dark text-crumi-text-primary dark:text-crumi-text-dark-primary focus:ring-2 focus:ring-crumi-accent/30 focus:border-crumi-accent outline-none transition-all"
                            value={newClient.idNumber}
                            onChange={e => setNewClient({ ...newClient, idNumber: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-crumi-text-primary dark:text-crumi-text-dark-primary mb-1">
                            Nombre <span className="text-crumi-danger">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-crumi-surface-dark text-crumi-text-primary dark:text-crumi-text-dark-primary focus:ring-2 focus:ring-crumi-accent/30 focus:border-crumi-accent outline-none transition-all"
                            value={newClient.name}
                            onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-crumi-text-primary dark:text-crumi-text-dark-primary mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-crumi-surface-dark text-crumi-text-primary dark:text-crumi-text-dark-primary focus:ring-2 focus:ring-crumi-accent/30 focus:border-crumi-accent outline-none transition-all"
                            value={newClient.email}
                            onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                        />
                    </div>
                </div>
            </CrumiModal>
        </div>
    );
};

export default CotizacionTab;
