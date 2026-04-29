import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from 'reactstrap';
import { DocumentConfig, PurchaseDocumentType } from '../Create';
import { env } from '../../../../env';
import PucPicker, { PucAccount } from '../../../../Components/Contabilidad/PucPicker';
import { getProducts, Product } from '../../../../services/productApi';
import { getServicesByTenant, ServiceItem } from '../../../../services/serviceApi';
import { getTenantIdFromToken } from '../../../../services/auth';
import { getCrumiFormStyles } from '../crumiFormStyles';

interface CompraTabProps {
  config: DocumentConfig;
  documentType: PurchaseDocumentType;
  onSaved?: (payable: any) => void;
  onCancel?: () => void;
  /** Si se pasa, el formulario opera en modo edición y hace PUT en vez de POST. */
  editingId?: number | null;
  /** Datos iniciales (header + items) para precargar en modo edición. */
  initialData?: any;
}

interface Supplier {
  name: string;
  identification?: string;
  documentType?: string;
  email?: string;
  phone?: string;
}

interface LineItem {
  id: string;
  concept_name: string;
  description: string;
  puc_code: string;
  puc_name: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  iva_pct: number;
  rf_pct: number;
  // Vínculo a catálogo (alimenta kardex)
  product_id?: number | null;
  service_id?: number | null;
  cost_center?: string;
}

interface Retention {
  id: string;
  type: 'RETEFUENTE' | 'RETEICA' | 'RETEIVA';
  pct: number;
}

const PURCHASE_DOCUMENT_CODE: Record<PurchaseDocumentType, string> = {
  factura: 'FACTURA_PROVEEDOR',
  orden: 'ORDEN_COMPRA',
  'documento-soporte': 'DOCUMENTO_SOPORTE',
  'nota-ajuste': 'NOTA_AJUSTE_COMPRA',
  'nota-debito': 'NOTA_DEBITO_PROVEEDOR',
  pago: 'PAGO_PROVEEDOR',
};

const SUCCESS_ROUTE: Record<PurchaseDocumentType, string> = {
  factura: '/gastos/documentos?modulo=gastos&tipo=facturas',
  orden: '/gastos/documentos?modulo=gastos&tipo=cotizaciones',
  'documento-soporte': '/gastos/documentos?modulo=gastos&tipo=remisiones',
  'nota-ajuste': '/gastos/documentos?modulo=gastos&tipo=devoluciones',
  'nota-debito': '/gastos/documentos?modulo=gastos&tipo=notas-debito',
  pago: '/gastos/documentos?modulo=gastos&tipo=pagos',
};

const today = new Date().toISOString().split('T')[0];
const newId = () => `l_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const emptyLine = (): LineItem => ({
  id: newId(),
  concept_name: '',
  description: '',
  puc_code: '',
  puc_name: '',
  quantity: 1,
  unit_price: 0,
  discount_pct: 0,
  iva_pct: 19,
  rf_pct: 0,
  product_id: null,
  service_id: null,
});

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;

const CompraTab: React.FC<CompraTabProps> = ({ config, documentType, onSaved, onCancel, editingId, initialData }) => {
  const navigate = useNavigate();
  const embedded = !!(onSaved || onCancel);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [accountsPuc, setAccountsPuc] = useState<PucAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [retentions, setRetentions] = useState<Retention[]>([]);

  // Catálogo Productos & Servicios (para vincular líneas con kardex)
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogServices, setCatalogServices] = useState<ServiceItem[]>([]);
  useEffect(() => {
    const tid = getTenantIdFromToken();
    getProducts().then((r) => setCatalogProducts(r.data || [])).catch(() => {});
    if (tid) {
      getServicesByTenant(tid).then((r) => setCatalogServices(r.data || [])).catch(() => {});
    }
  }, []);
  const catalogOptions = useMemo(() => {
    const prods = catalogProducts.map((p) => ({
      type: 'product' as const,
      id: Number(p.id),
      name: p.name,
      sku: p.sku || '',
      cost: Number(p.cost ?? p.cost_price ?? 0),
      taxRate: Number(p.tax_rate ?? 0),
      isInventoriable: p.is_inventoriable !== false,
    }));
    const svcs = catalogServices.map((s) => ({
      type: 'service' as const,
      id: Number(s.id),
      name: s.name,
      sku: s.sku || '',
      cost: 0,
      taxRate: Number(s.tax_rate ?? 0),
      isInventoriable: false,
    }));
    return [...prods, ...svcs];
  }, [catalogProducts, catalogServices]);

  const linkCatalogToLine = (lineId: string, name: string) => {
    const match = catalogOptions.find((o) => o.name.toLowerCase() === name.toLowerCase().trim());
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== lineId) return it;
        if (match) {
          // Producto inventariable → cuenta de inventario; servicio o no inventariable → cuenta de gasto
          const defaultPuc = match.type === 'product' && match.isInventoriable ? '1435' : '5135';
          return {
            ...it,
            concept_name: match.name,
            description: it.description || match.name,
            puc_code: it.puc_code || defaultPuc,
            puc_name: it.puc_name || (defaultPuc === '1435' ? 'Mercancías no fabricadas por la empresa' : 'Servicios'),
            unit_price: it.unit_price || match.cost,
            iva_pct: it.iva_pct || match.taxRate || 19,
            product_id: match.type === 'product' ? match.id : null,
            service_id: match.type === 'service' ? match.id : null,
          };
        }
        return { ...it, concept_name: name, product_id: null, service_id: null };
      })
    );
  };
  const [formData, setFormData] = useState({
    warehouseCode: 'PRINCIPAL',
    warehouseName: 'Principal',
    supplierName: '',
    supplierDocumentType: 'NIT',
    supplierDocumentNumber: '',
    supplierPhone: '',
    documentNumber: '',
    isElectronic: true,
    internalNumber: '',
    issueDate: today,
    dueDate: today,
    paymentForm: 'Contado',
    creditTermDays: '30',
    paymentMethod: '',
    purchaseOrderNumber: '',
    termsAndConditions: '',
    printableNotes: '',
    notes: '',
  });
  const [nextNumberPreview, setNextNumberPreview] = useState<string>('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '', documentType: 'NIT', identification: '', email: '', phone: '',
  });

  const addDaysToISO = (iso: string, days: number): string => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  // Cargar PUC
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${env.API_URL}/accounting/chart-of-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        const list = data?.accounts || data?.chartOfAccounts || data?.data || [];
        if (Array.isArray(list)) {
          setAccountsPuc(
            list.map((a: any) => ({
              code: String(a.code || a.account_code || ''),
              name: String(a.name || a.account_name || ''),
              account_type: a.account_type,
            })).filter((a: PucAccount) => a.code),
          );
        }
      })
      .catch(() => setAccountsPuc([]));
  }, []);

  // Consecutivo automático — sólo en modo creación. En edición conservamos el original.
  useEffect(() => {
    if (editingId != null && editingId > 0) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${env.API_URL}/accounting/accounts-payable/next-number?isElectronic=${formData.isElectronic ? 'true' : 'false'}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        if (data?.success) {
          const preview = data.preview || `${data.prefix || ''}-${data.nextNumber || ''}`.replace(/^-/, '');
          setNextNumberPreview(preview);
          setFormData(prev => ({ ...prev, internalNumber: preview }));
        }
      })
      .catch(() => setNextNumberPreview(''));
  }, [formData.isElectronic, editingId]);

  // Pre-fill en modo edición desde initialData (header + lines)
  useEffect(() => {
    if (!initialData || editingId == null) return;
    const d: any = initialData;
    setFormData(prev => ({
      ...prev,
      supplierName: d.supplier_name ?? d.supplierName ?? prev.supplierName,
      supplierDocumentType: d.supplier_document_type ?? prev.supplierDocumentType,
      supplierDocumentNumber: d.supplier_document_number ?? prev.supplierDocumentNumber,
      supplierPhone: d.supplier_phone ?? prev.supplierPhone,
      documentNumber: d.document_number ?? prev.documentNumber,
      internalNumber: d.internal_number ?? prev.internalNumber,
      isElectronic: d.is_electronic ?? prev.isElectronic,
      issueDate: (d.issue_date ? String(d.issue_date).slice(0, 10) : prev.issueDate),
      dueDate: (d.due_date ? String(d.due_date).slice(0, 10) : prev.dueDate),
      paymentForm: d.payment_form ?? prev.paymentForm,
      creditTermDays: String(d.credit_term_days ?? prev.creditTermDays ?? '30'),
      paymentMethod: d.payment_method ?? prev.paymentMethod,
      warehouseCode: d.warehouse_code ?? prev.warehouseCode,
      warehouseName: d.warehouse_name ?? prev.warehouseName,
      purchaseOrderNumber: d.purchase_order_number ?? prev.purchaseOrderNumber,
      termsAndConditions: d.terms_and_conditions ?? prev.termsAndConditions,
      printableNotes: d.printable_notes ?? prev.printableNotes,
      notes: d.notes ?? prev.notes,
    }));
    const linesArr: any[] = Array.isArray(d.lines) ? d.lines : (Array.isArray(d.items) ? d.items : []);
    if (linesArr.length > 0) {
      setItems(linesArr.map((l: any) => ({
        id: newId(),
        concept_name: l.concept_name || '',
        description: l.description || '',
        puc_code: String(l.puc_code || l.expense_account_code || ''),
        puc_name: l.puc_name || l.expense_account_name || '',
        quantity: Number(l.quantity) || 0,
        unit_price: Number(l.unit_price) || 0,
        discount_pct: Number(l.discount_pct ?? l.discount) || 0,
        iva_pct: Number(l.iva_pct ?? l.tax_rate) || 0,
        rf_pct: Number(l.rf_pct) || 0,
        product_id: l.product_id ?? null,
        service_id: l.service_id ?? null,
        cost_center: l.cost_center ?? undefined,
      })));
    }
  }, [editingId, initialData]);

  // Proveedores
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${env.API_URL}/accounting/third-parties?kind=SUPPLIER`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        const arr = (data?.thirdParties || data?.items || data || []) as any[];
        if (Array.isArray(arr)) {
          setSuppliers(arr.map((s: any) => ({
            name: String(s.name || s.business_name || ''),
            identification: s.identification || s.nit || s.document_number || '',
            documentType: s.document_type || s.identification_type || 'NIT',
            email: s.email || '',
            phone: s.phone || '',
          })).filter((s: Supplier) => s.name));
        }
      })
      .catch(() => setSuppliers([]));
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSupplierSelect = (name: string) => {
    const match = suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
    setFormData(prev => ({
      ...prev,
      supplierName: name,
      supplierDocumentType: match?.documentType || prev.supplierDocumentType,
      supplierDocumentNumber: match?.identification || prev.supplierDocumentNumber,
      supplierPhone: match?.phone || prev.supplierPhone,
    }));
  };

  const handlePaymentFormChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      paymentForm: val,
      dueDate: val === 'Credito'
        ? addDaysToISO(prev.issueDate, Number(prev.creditTermDays) || 30)
        : prev.issueDate,
    }));
  };

  const handleIssueDateChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      issueDate: val,
      dueDate: prev.paymentForm === 'Credito'
        ? addDaysToISO(val, Number(prev.creditTermDays) || 30)
        : val,
    }));
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const onLinePucChange = (id: string, code: string) => {
    const match = accountsPuc.find(a => a.code === code);
    setItems(prev => prev.map(it => it.id === id
      ? { ...it, puc_code: code, puc_name: match?.name || '', concept_name: it.concept_name || match?.name || '' }
      : it
    ));
  };

  const addItem = () => setItems(prev => [...prev, emptyLine()]);
  const removeItem = (id: string) => setItems(prev => (prev.length <= 1 ? prev : prev.filter(it => it.id !== id)));

  const computeLine = (l: LineItem) => {
    const subtotal = round2(l.quantity * l.unit_price);
    const discount = round2(subtotal * (l.discount_pct / 100));
    const base = round2(subtotal - discount);
    const iva = round2(base * (l.iva_pct / 100));
    const rf = round2(base * (l.rf_pct / 100));
    const total = round2(base + iva - rf);
    return { subtotal, discount, base, iva, rf, total };
  };

  const addRetention = (type: Retention['type']) => {
    setRetentions(prev => [...prev, { id: newId(), type, pct: 0 }]);
  };
  const removeRetention = (id: string) => setRetentions(prev => prev.filter(r => r.id !== id));

  const totals = useMemo(() => {
    let subtotal = 0, discountTotal = 0, baseTotal = 0, ivaTotal = 0, rfFromLines = 0;
    items.forEach(l => {
      const c = computeLine(l);
      subtotal += c.subtotal;
      discountTotal += c.discount;
      baseTotal += c.base;
      ivaTotal += c.iva;
      rfFromLines += c.rf;
    });
    let retefuenteGlobal = 0, reteIcaAmt = 0, reteIvaAmt = 0, reteIvaPct = 0, reteIcaPct = 0;
    retentions.forEach(r => {
      if (r.type === 'RETEFUENTE') retefuenteGlobal += round2(baseTotal * (r.pct / 100));
      else if (r.type === 'RETEICA') { reteIcaPct += r.pct; reteIcaAmt += round2(baseTotal * (r.pct / 1000)); }
      else if (r.type === 'RETEIVA') { reteIvaPct += r.pct; reteIvaAmt += round2(ivaTotal * (r.pct / 100)); }
    });
    const retefuenteTotal = round2(rfFromLines + retefuenteGlobal);
    const total = round2(baseTotal + ivaTotal - retefuenteTotal - reteIcaAmt - reteIvaAmt);
    return { subtotal: round2(subtotal), discountTotal: round2(discountTotal), baseTotal: round2(baseTotal), ivaTotal: round2(ivaTotal), retefuenteTotal, reteIcaAmt, reteIvaAmt, reteIvaPct, reteIcaPct, total };
  }, [items, retentions]);

  const createSupplierInline = async () => {
    if (!newSupplier.name.trim()) return setSaveError('Nombre del proveedor es obligatorio');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${env.API_URL}/accounting/third-parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newSupplier.name,
          document_type: newSupplier.documentType,
          document_number: newSupplier.identification,
          email: newSupplier.email,
          phone: newSupplier.phone,
          kind: 'SUPPLIER',
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setFormData(prev => ({
        ...prev,
        supplierName: newSupplier.name,
        supplierDocumentType: newSupplier.documentType,
        supplierDocumentNumber: newSupplier.identification,
        supplierPhone: newSupplier.phone,
      }));
      setSuppliers(prev => [...prev, { ...newSupplier } as Supplier]);
      setShowNewSupplier(false);
      setNewSupplier({ name: '', documentType: 'NIT', identification: '', email: '', phone: '' });
    } catch (e: any) {
      setSaveError(`No se pudo crear el proveedor: ${e.message}`);
    }
  };

  const buildPayload = () => ({
    supplierName: formData.supplierName,
    supplierDocumentType: formData.supplierDocumentType,
    supplierDocumentNumber: formData.supplierDocumentNumber || null,
    supplierPhone: formData.supplierPhone || null,
    documentType: PURCHASE_DOCUMENT_CODE[documentType],
    documentNumber: formData.documentNumber,
    internalNumber: formData.internalNumber || null,
    isElectronic: !!formData.isElectronic,
    issueDate: formData.issueDate,
    dueDate: formData.dueDate || formData.issueDate,
    paymentForm: formData.paymentForm,
    creditTermDays: formData.paymentForm === 'Credito' ? Number(formData.creditTermDays) || 30 : 0,
    paymentMethod: formData.paymentMethod || null,
    warehouseCode: formData.warehouseCode || null,
    warehouseName: formData.warehouseName || null,
    purchaseOrderNumber: formData.purchaseOrderNumber || null,
    termsAndConditions: formData.termsAndConditions || null,
    printableNotes: formData.printableNotes || null,
    notes: formData.notes || null,
    reteIvaPct: totals.reteIvaPct,
    reteIcaPct: totals.reteIcaPct,
    amount: totals.total,
    subtotalAmount: totals.baseTotal,
    taxAmount: totals.ivaTotal,
    withholdingSourceAmount: totals.retefuenteTotal,
    withholdingIcaAmount: totals.reteIcaAmt,
    withholdingVatAmount: totals.reteIvaAmt,
    items: items
      .filter(l => l.puc_code && l.quantity > 0)
      .map((l, idx) => ({
        line_no: idx + 1,
        concept_name: l.concept_name || l.puc_name,
        description: l.description,
        puc_code: l.puc_code,
        puc_name: l.puc_name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount_pct: l.discount_pct,
        iva_pct: l.iva_pct,
        rf_pct: l.rf_pct,
        product_id: l.product_id ?? null,
        service_id: l.service_id ?? null,
      })),
  });

  const doSave = async (): Promise<any | null> => {
    setSaveError(null);
    if (!formData.supplierName || !formData.documentNumber) {
      setSaveError('Proveedor y N° documento son obligatorios.');
      return null;
    }
    const validItems = items.filter(l => l.puc_code && l.quantity > 0 && l.unit_price > 0);
    if (validItems.length === 0) {
      setSaveError('Agrega al menos una línea con cuenta PUC, cantidad y precio.');
      return null;
    }
    if (totals.total <= 0) {
      setSaveError('El neto por pagar debe ser mayor a cero.');
      return null;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No se encontró el token.');
      const isEditing = editingId != null && editingId > 0;
      const url = isEditing
        ? `${env.API_URL}/accounting/accounts-payable/${editingId}`
        : `${env.API_URL}/accounting/accounts-payable`;
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo guardar');
      return data;
    } catch (e: any) {
      setSaveError(e.message || 'Error al guardar');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(prev => ({
      ...prev,
      supplierName: '', supplierDocumentNumber: '', supplierPhone: '',
      documentNumber: '', internalNumber: '', issueDate: today, dueDate: today,
      paymentMethod: '', purchaseOrderNumber: '', termsAndConditions: '', printableNotes: '', notes: '',
    }));
    setItems([emptyLine()]);
    setRetentions([]);
  };

  const handleSaveAndNavigate = async () => {
    const ok = await doSave();
    if (ok) {
      if (embedded) onSaved?.(ok.payable);
      else navigate(SUCCESS_ROUTE[documentType]);
    }
  };
  const handleSaveAndNew = async () => {
    const ok = await doSave();
    if (ok) resetForm();
  };
  const handleSaveAndPay = async () => {
    const ok = await doSave();
    if (ok) {
      if (embedded) onSaved?.(ok.payable);
      navigate(`/gastos/documentos?modulo=gastos&tipo=pagos&payableId=${ok.payable?.id || ''}`);
    }
  };
  const handleCancel = () => {
    if (embedded) onCancel?.();
    else navigate(SUCCESS_ROUTE[documentType]);
  };

  // ============================================
  // ESTILOS CRUMI
  // ============================================
  const s = getCrumiFormStyles(loading);

  // Estilo para el "badge" del tipo de retención (sustituye al <Badge> de reactstrap)
  const retentionBadgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 700,
    background: 'rgba(139,92,246,0.12)',
    color: '#8B5CF6',
    border: '1px solid rgba(139,92,246,0.25)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  };

  return (
    <div style={s.wrapper}>
      {saveError && (
        <Alert color="danger" toggle={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      <div style={s.card}>
        {/* HEADER: TIPO DE DOCUMENTO + CONSECUTIVO */}
        <div style={s.header}>
          <div>
            <div style={s.logoBox}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                <i className="ri-file-text-line" />
              </div>
              <div>{config?.title || 'Factura de compra'}</div>
            </div>
            <div style={s.companyName}>{config?.title || 'Factura de compra'}</div>
          </div>

          <div style={s.invoiceNumber}>
            <div style={s.invoiceLabel}>Consecutivo interno</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              <input
                type="text"
                style={{
                  ...s.input,
                  fontSize: '18px',
                  fontWeight: 600,
                  width: '180px',
                  textAlign: 'center',
                }}
                value={formData.internalNumber}
                onChange={e => handleChange('internalNumber', e.target.value)}
                placeholder={nextNumberPreview || 'AUTO'}
              />
            </div>
            <div style={{ ...s.invoiceLabel, marginTop: '12px' }}>N° factura del proveedor *</div>
            <input
              type="text"
              style={{
                ...s.input,
                fontSize: '15px',
                fontWeight: 600,
                width: '180px',
                textAlign: 'center',
              }}
              value={formData.documentNumber}
              onChange={e => handleChange('documentNumber', e.target.value)}
              placeholder="FC-2001"
            />
          </div>
        </div>

        {/* BODY */}
        <div style={s.body}>

          {/* ===== BLOQUE PROVEEDOR + DOCUMENTO ===== */}
          <div style={s.sectionTitle}>Proveedor y documento</div>
          <div style={s.formGrid}>
            <div style={s.formField}>
              <label style={s.label}>
                Proveedor <span style={s.required}>*</span>
              </label>
              <input
                list="crumi-suppliers"
                style={s.input}
                value={formData.supplierName}
                onChange={e => handleSupplierSelect(e.target.value)}
                placeholder="Buscar por nombre o NIT…"
              />
              <datalist id="crumi-suppliers">
                {suppliers.map(sp => (
                  <option key={sp.name} value={sp.name}>
                    {sp.identification || ''} {sp.email || ''}
                  </option>
                ))}
              </datalist>
              <button
                type="button"
                style={s.newContactBtn}
                onClick={() => setShowNewSupplier(prev => !prev)}
              >
                {showNewSupplier ? '× Cancelar' : '+ Nuevo proveedor'}
              </button>
            </div>

            <div style={s.formField}>
              <label style={s.label}>Tipo doc.</label>
              <select
                style={s.select}
                value={formData.supplierDocumentType}
                onChange={e => handleChange('supplierDocumentType', e.target.value)}
              >
                <option value="NIT">NIT</option>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PP">PP</option>
              </select>
            </div>

            <div style={s.formField}>
              <label style={s.label}>Identificación</label>
              <input
                type="text"
                style={s.input}
                value={formData.supplierDocumentNumber}
                onChange={e => handleChange('supplierDocumentNumber', e.target.value)}
                placeholder="900123456"
              />
            </div>

            <div style={s.formField}>
              <label style={s.label}>Teléfono</label>
              <input
                type="text"
                style={s.input}
                value={formData.supplierPhone}
                onChange={e => handleChange('supplierPhone', e.target.value)}
                placeholder="+57 300 …"
              />
            </div>

            <div style={s.formField}>
              <label style={s.label}>Bodega</label>
              <select
                style={s.select}
                value={formData.warehouseCode}
                onChange={e => {
                  const target = e.target as HTMLSelectElement;
                  const code = target.value;
                  const name = target.options[target.selectedIndex].text;
                  setFormData(p => ({ ...p, warehouseCode: code, warehouseName: name }));
                }}
              >
                <option value="PRINCIPAL">Principal</option>
                <option value="BOLTI">bolti</option>
              </select>
            </div>

            <div style={s.formField}>
              <label style={s.label}>
                N° factura <span style={s.required}>*</span>
              </label>
              <input
                type="text"
                style={s.input}
                value={formData.documentNumber}
                onChange={e => handleChange('documentNumber', e.target.value)}
                placeholder="FC-2001"
              />
            </div>

            <div style={s.formField}>
              <label style={s.label}>
                Consecutivo interno <span style={{ color: '#9A9FA5', fontWeight: 400 }}>(auto)</span>
              </label>
              <input
                type="text"
                style={s.input}
                value={formData.internalNumber}
                onChange={e => handleChange('internalNumber', e.target.value)}
                placeholder={nextNumberPreview}
              />
            </div>

            <div style={s.formField}>
              <label style={s.label}>Orden de compra</label>
              <input
                type="text"
                style={s.input}
                value={formData.purchaseOrderNumber}
                onChange={e => handleChange('purchaseOrderNumber', e.target.value)}
                placeholder="OC-0001 (opcional)"
              />
            </div>
          </div>

          {/* Mini-form inline: nuevo proveedor */}
          {showNewSupplier && (
            <div style={{ ...s.infoBox, marginBottom: '20px' }}>
              <div style={{ ...s.sectionTitle, fontSize: '13px', marginBottom: '12px' }}>
                Crear nuevo proveedor
              </div>
              <div style={s.formGrid}>
                <div style={s.formField}>
                  <label style={s.label}>Nombre</label>
                  <input
                    type="text"
                    style={s.input}
                    value={newSupplier.name}
                    onChange={e => setNewSupplier(sp => ({ ...sp, name: e.target.value }))}
                  />
                </div>
                <div style={s.formField}>
                  <label style={s.label}>Tipo</label>
                  <select
                    style={s.select}
                    value={newSupplier.documentType}
                    onChange={e => setNewSupplier(sp => ({ ...sp, documentType: e.target.value }))}
                  >
                    <option value="NIT">NIT</option>
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                  </select>
                </div>
                <div style={s.formField}>
                  <label style={s.label}>Identificación</label>
                  <input
                    type="text"
                    style={s.input}
                    value={newSupplier.identification}
                    onChange={e => setNewSupplier(sp => ({ ...sp, identification: e.target.value }))}
                  />
                </div>
                <div style={s.formField}>
                  <label style={s.label}>Email</label>
                  <input
                    type="email"
                    style={s.input}
                    value={newSupplier.email}
                    onChange={e => setNewSupplier(sp => ({ ...sp, email: e.target.value }))}
                  />
                </div>
                <div style={s.formField}>
                  <label style={s.label}>Teléfono</label>
                  <input
                    type="text"
                    style={s.input}
                    value={newSupplier.phone}
                    onChange={e => setNewSupplier(sp => ({ ...sp, phone: e.target.value }))}
                  />
                </div>
                <div style={{ ...s.formField, justifyContent: 'flex-end' }}>
                  <button type="button" style={s.btnPrimary} onClick={createSupplierInline}>
                    Crear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== FECHAS Y PAGO ===== */}
          <div style={s.sectionTitle}>Fechas y pago</div>
          <div style={s.formGrid}>
            <div style={s.formField}>
              <label style={s.label}>Emisión</label>
              <input
                type="date"
                style={s.input}
                value={formData.issueDate}
                onChange={e => handleIssueDateChange(e.target.value)}
              />
            </div>
            <div style={s.formField}>
              <label style={s.label}>Vencimiento</label>
              <input
                type="date"
                style={s.input}
                value={formData.dueDate}
                onChange={e => handleChange('dueDate', e.target.value)}
              />
            </div>
            <div style={s.formField}>
              <label style={s.label}>Forma de pago</label>
              <select
                style={s.select}
                value={formData.paymentForm}
                onChange={e => handlePaymentFormChange(e.target.value)}
              >
                <option value="Contado">Contado</option>
                <option value="Credito">Crédito</option>
              </select>
            </div>
            {formData.paymentForm === 'Credito' && (
              <div style={s.formField}>
                <label style={s.label}>Plazo</label>
                <select
                  style={s.select}
                  value={formData.creditTermDays}
                  onChange={e => {
                    const v = e.target.value;
                    setFormData(p => ({
                      ...p,
                      creditTermDays: v,
                      dueDate: addDaysToISO(p.issueDate, Number(v) || 30),
                    }));
                  }}
                >
                  <option value="30">30 días</option>
                  <option value="60">60 días</option>
                  <option value="90">90 días</option>
                  <option value="180">180 días</option>
                </select>
              </div>
            )}
            <div style={s.formField}>
              <label style={s.label}>Medio de pago</label>
              <select
                style={s.select}
                value={formData.paymentMethod}
                onChange={e => handleChange('paymentMethod', e.target.value)}
              >
                <option value="">Seleccionar</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Consignación">Consignación</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div style={s.formField}>
              <label style={s.label}>¿Factura electrónica?</label>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', paddingTop: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="elec"
                    checked={formData.isElectronic}
                    onChange={() => handleChange('isElectronic', true)}
                  />
                  Sí (DIAN)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="elec"
                    checked={!formData.isElectronic}
                    onChange={() => handleChange('isElectronic', false)}
                  />
                  Interna
                </label>
              </div>
            </div>
          </div>

          {/* ===== LÍNEAS ===== */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            <div style={s.sectionTitle}>Líneas de la factura</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={s.btnPrimary} onClick={addItem}>
                <i className="ri-add-line" /> Agregar línea
              </button>
              <span style={{ color: '#9A9FA5', fontSize: '12px', marginLeft: '8px' }}>Retención:</span>
              <button type="button" style={s.btnSecondary} onClick={() => addRetention('RETEFUENTE')}>Retefuente</button>
              <button type="button" style={s.btnSecondary} onClick={() => addRetention('RETEICA')}>ReteICA</button>
              <button type="button" style={s.btnSecondary} onClick={() => addRetention('RETEIVA')}>ReteIVA</button>
            </div>
          </div>

          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={{ ...s.th, width: '26%' }}>Concepto (cuenta PUC)</th>
                  <th style={{ ...s.th, width: '12%', textAlign: 'right' }}>Precio</th>
                  <th style={{ ...s.th, width: '8%', textAlign: 'center' }}>Desc %</th>
                  <th style={{ ...s.th, width: '8%', textAlign: 'center' }}>IVA %</th>
                  <th style={{ ...s.th, width: '8%', textAlign: 'center' }}>Cantidad</th>
                  <th style={{ ...s.th, width: '20%' }}>Observaciones</th>
                  <th style={{ ...s.th, width: '14%', textAlign: 'right' }}>Total</th>
                  <th style={{ ...s.th, width: '4%' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const c = computeLine(it);
                  return (
                    <tr key={it.id}>
                      <td style={{ ...s.td, padding: '10px 12px' }}>
                        <input
                          type="text"
                          placeholder="Producto/servicio del catálogo (opcional)"
                          value={it.concept_name || ''}
                          list={`catalog-compra-${it.id}`}
                          onChange={(e) => {
                            updateItem(it.id, { concept_name: e.target.value });
                            linkCatalogToLine(it.id, e.target.value);
                          }}
                          onBlur={(e) => linkCatalogToLine(it.id, e.target.value)}
                          style={{ ...s.input, marginBottom: '6px', width: '100%' }}
                        />
                        <datalist id={`catalog-compra-${it.id}`}>
                          {catalogOptions.map((o) => (
                            <option key={`${o.type}-${o.id}`} value={o.name}>
                              {o.type === 'product' ? '[P]' : '[S]'} {o.sku ? `${o.sku} — ` : ''}{o.name}
                            </option>
                          ))}
                        </datalist>
                        <PucPicker
                          value={it.puc_code}
                          onChange={(code) => onLinePucChange(it.id, code)}
                          accounts={accountsPuc}
                          placeholder="Buscar cuenta…"
                        />
                        {it.puc_code && (
                          <div style={{ color: '#9A9FA5', fontSize: '11px', marginTop: '4px' }}>
                            {it.puc_code} — {it.puc_name}
                          </div>
                        )}
                        {(it.product_id || it.service_id) && (
                          <div style={{ color: '#10b981', fontSize: '11px', marginTop: '4px' }}>
                            ✓ vinculado al catálogo (alimenta kardex)
                          </div>
                        )}
                      </td>
                      <td style={s.td}>
                        <input
                          type="number"
                          min="0"
                          style={{ ...s.inputCell, textAlign: 'right' }}
                          value={it.unit_price}
                          onChange={e => updateItem(it.id, { unit_price: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td style={s.td}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          style={{ ...s.inputCell, textAlign: 'center' }}
                          value={it.discount_pct}
                          onChange={e => updateItem(it.id, { discount_pct: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td style={s.td}>
                        <select
                          style={s.selectCell}
                          value={it.iva_pct}
                          onChange={e => updateItem(it.id, { iva_pct: Number(e.target.value) || 0 })}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="19">19%</option>
                        </select>
                      </td>
                      <td style={s.td}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          style={{ ...s.inputCell, textAlign: 'center' }}
                          value={it.quantity}
                          onChange={e => updateItem(it.id, { quantity: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td style={s.td}>
                        <input
                          type="text"
                          style={s.inputCell}
                          value={it.description}
                          onChange={e => updateItem(it.id, { description: e.target.value })}
                          placeholder="Observaciones"
                        />
                      </td>
                      <td style={{ ...s.td, padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                        {money(c.total)}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        {items.length > 1 && (
                          <button type="button" style={s.deleteBtn} onClick={() => removeItem(it.id)}>
                            <i className="ri-close-line" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ===== RETENCIONES DINÁMICAS ===== */}
          {retentions.length > 0 && (
            <>
              <div style={s.sectionTitle}>Retenciones aplicadas</div>
              <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {retentions.map(r => (
                  <div
                    key={r.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '160px 140px 1fr auto',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <span style={retentionBadgeStyle}>{r.type}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      style={s.input}
                      value={r.pct}
                      onChange={e => setRetentions(prev => prev.map(x => x.id === r.id ? { ...x, pct: Number(e.target.value) || 0 } : x))}
                      placeholder={r.type === 'RETEICA' ? 'x mil' : '%'}
                    />
                    <small style={{ color: '#9A9FA5', fontSize: '12px' }}>
                      {r.type === 'RETEICA' ? 'Por mil sobre base' : r.type === 'RETEIVA' ? '% sobre IVA' : '% sobre base'}
                    </small>
                    <button
                      type="button"
                      style={{ ...s.deleteBtn, fontSize: '13px' }}
                      onClick={() => removeRetention(r.id)}
                    >
                      Quitar retención
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ===== NOTAS + TOTALES ===== */}
          <div style={s.footerGrid}>
            <div style={s.leftFooter}>
              <div>
                <div style={s.sectionTitle}>Notas y términos</div>
                <div style={{ marginBottom: '14px' }}>
                  <div style={s.textareaLabel}>Términos y condiciones</div>
                  <textarea
                    rows={3}
                    style={s.textarea}
                    value={formData.termsAndConditions}
                    onChange={e => handleChange('termsAndConditions', e.target.value)}
                    placeholder="Visible en la impresión del documento"
                  />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <div style={s.textareaLabel}>Notas imprimibles</div>
                  <textarea
                    rows={2}
                    style={s.textarea}
                    value={formData.printableNotes}
                    onChange={e => handleChange('printableNotes', e.target.value)}
                    placeholder="Visible en la impresión del documento"
                  />
                </div>
                <div>
                  <div style={s.textareaLabel}>Notas internas</div>
                  <textarea
                    rows={2}
                    style={s.textarea}
                    value={formData.notes}
                    onChange={e => handleChange('notes', e.target.value)}
                    placeholder="Solo visible en Crumi"
                  />
                </div>
              </div>
            </div>

            <div>
              <div style={s.sectionTitle}>Totales</div>
              <div style={s.totalsBox}>
                <div style={s.totalRow}>
                  <span>Subtotal</span>
                  <strong>{money(totals.subtotal)}</strong>
                </div>
                <div style={s.totalRow}>
                  <span>Descuento</span>
                  <strong style={{ color: '#ef4444' }}>- {money(totals.discountTotal)}</strong>
                </div>
                <div style={s.totalRow}>
                  <span>Base</span>
                  <strong>{money(totals.baseTotal)}</strong>
                </div>
                <div style={s.totalRow}>
                  <span>IVA</span>
                  <strong>{money(totals.ivaTotal)}</strong>
                </div>
                {totals.retefuenteTotal > 0 && (
                  <div style={s.totalRow}>
                    <span>Retefuente</span>
                    <strong style={{ color: '#ef4444' }}>- {money(totals.retefuenteTotal)}</strong>
                  </div>
                )}
                {totals.reteIcaAmt > 0 && (
                  <div style={s.totalRow}>
                    <span>ReteICA</span>
                    <strong style={{ color: '#ef4444' }}>- {money(totals.reteIcaAmt)}</strong>
                  </div>
                )}
                {totals.reteIvaAmt > 0 && (
                  <div style={s.totalRow}>
                    <span>ReteIVA</span>
                    <strong style={{ color: '#ef4444' }}>- {money(totals.reteIvaAmt)}</strong>
                  </div>
                )}
                <div style={s.totalFinal}>
                  <span>Total a pagar</span>
                  <span>{money(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE BOTONES FIJA */}
      <div style={s.bottomBar}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="button" style={s.btnSecondary} onClick={handleCancel} disabled={loading}>
            Cancelar
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="button" style={s.btnSecondary} onClick={handleSaveAndPay} disabled={loading}>
            Guardar y agregar pago
          </button>
          <button type="button" style={s.btnSecondary} onClick={handleSaveAndNew} disabled={loading}>
            Guardar y crear nueva
          </button>
          <button type="button" style={s.btnPrimary} onClick={handleSaveAndNavigate} disabled={loading}>
            {loading ? 'Guardando…' : `Guardar ${config.title}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompraTab;
