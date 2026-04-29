import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import PucEditorModal from './PucEditorModal';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  Spinner,
  Table,
  Nav,
  NavItem,
  NavLink,
} from 'reactstrap';
import { api } from '../../../../services/api';
import TipoDocumentoSelect from '../../../../Components/Contabilidad/TipoDocumentoSelect';
import {
  TIPOS_LS_KEY,
  TipoDocumento,
  TipoDocumentoApplies,
  loadTipos,
  removeTipo,
} from '../../../../Components/Contabilidad/TiposDocumento';

type Props = {
  tenantId: string;
};

type AccountingSettings = {
  accounting_method: string;
  reporting_basis: string;
  fiscal_year_start_month: number;
  allow_manual_entries: boolean;
  lock_closed_periods: boolean;
  default_cost_center_required: boolean;
  cash_account_code: string;
  bank_account_code: string;
  accounts_receivable_code: string;
  accounts_payable_code: string;
  revenue_account_code: string;
  cost_account_code: string;
  expense_account_code: string;
  vat_generated_code: string;
  vat_deductible_code: string;
  withholding_source_code: string;
  withholding_ica_code: string;
  withholding_vat_code: string;
  rounding_account_code: string;
  fx_difference_account_code: string;
};

type PucAccount = { id?: string | number; code: string; name: string; account_type?: string };

type DocumentConfig = {
  document_type: string;
  prefix?: string;
  debit_account_code?: string;
  credit_account_code?: string;
  tax_account_code?: string;
  affects_portfolio?: boolean;
  auto_post?: boolean;
  requires_electronic_support?: boolean;
};

const emptySettings: AccountingSettings = {
  accounting_method: 'causacion',
  reporting_basis: 'local',
  fiscal_year_start_month: 1,
  allow_manual_entries: true,
  lock_closed_periods: true,
  default_cost_center_required: false,
  cash_account_code: '',
  bank_account_code: '',
  accounts_receivable_code: '',
  accounts_payable_code: '',
  revenue_account_code: '',
  cost_account_code: '',
  expense_account_code: '',
  vat_generated_code: '',
  vat_deductible_code: '',
  withholding_source_code: '',
  withholding_ica_code: '',
  withholding_vat_code: '',
  rounding_account_code: '',
  fx_difference_account_code: '',
};

const DEFAULT_DOC_ORDER = [
  'FACTURA',
  'NOTA_CREDITO',
  'NOTA_DEBITO',
  'RECIBO_PAGO',
  'COMPROBANTE_EGRESO',
  'AJUSTE_CONTABLE',
  'NOMINA',
];

const DOC_LABELS: Record<string, string> = {
  FACTURA: 'Factura de venta',
  NOTA_CREDITO: 'Nota crédito',
  NOTA_DEBITO: 'Nota débito',
  RECIBO_PAGO: 'Recibo de pago',
  COMPROBANTE_EGRESO: 'Comprobante de egreso',
  AJUSTE_CONTABLE: 'Ajuste contable',
  NOMINA: 'Nómina',
};

const ACCOUNT_FIELDS: Array<{
  field: keyof AccountingSettings;
  label: string;
  help: string;
}> = [
  { field: 'cash_account_code', label: 'Caja', help: 'Cuenta donde se registran los movimientos en efectivo.' },
  { field: 'bank_account_code', label: 'Bancos', help: 'Cuenta por defecto para movimientos bancarios.' },
  { field: 'accounts_receivable_code', label: 'Clientes / Cuentas por cobrar', help: 'Se debita cuando facturas a crédito a un cliente.' },
  { field: 'accounts_payable_code', label: 'Proveedores / Cuentas por pagar', help: 'Se acredita cuando recibes una compra a crédito.' },
  { field: 'revenue_account_code', label: 'Ingresos', help: 'Cuenta donde se acreditan tus ventas.' },
  { field: 'cost_account_code', label: 'Costos', help: 'Cuenta de costo de ventas / productos vendidos.' },
  { field: 'expense_account_code', label: 'Gastos', help: 'Cuenta de gastos operacionales por defecto.' },
  { field: 'vat_generated_code', label: 'IVA generado', help: 'IVA que cobras en tus ventas (pasivo).' },
  { field: 'vat_deductible_code', label: 'IVA descontable', help: 'IVA que pagas en tus compras (activo).' },
  { field: 'withholding_source_code', label: 'Retención en la fuente (retefuente)', help: 'Retenciones practicadas a proveedores.' },
  { field: 'withholding_ica_code', label: 'Retención ICA (reteICA)', help: 'Retención por impuesto de industria y comercio.' },
  { field: 'withholding_vat_code', label: 'Retención IVA (reteIVA)', help: 'Retención sobre IVA a proveedores.' },
  { field: 'rounding_account_code', label: 'Redondeos', help: 'Diferencias mínimas al cuadrar asientos.' },
  { field: 'fx_difference_account_code', label: 'Diferencia en cambio (moneda extranjera)', help: 'Ajuste por variación de tasa de cambio en operaciones en divisas.' },
];

const ACCOUNT_GROUPS: Array<{
  key: string;
  label: string;
  icon: string;
  fields: Array<keyof AccountingSettings>;
}> = [
  {
    key: 'caja',
    label: 'Caja y bancos',
    icon: 'ri-bank-line',
    fields: ['cash_account_code', 'bank_account_code'],
  },
  {
    key: 'cartera',
    label: 'Cartera',
    icon: 'ri-user-received-line',
    fields: ['accounts_receivable_code', 'accounts_payable_code'],
  },
  {
    key: 'operacion',
    label: 'Operación',
    icon: 'ri-exchange-line',
    fields: ['revenue_account_code', 'cost_account_code', 'expense_account_code'],
  },
  {
    key: 'impuestos',
    label: 'Impuestos',
    icon: 'ri-percent-line',
    fields: [
      'vat_generated_code',
      'vat_deductible_code',
      'withholding_source_code',
      'withholding_ica_code',
      'withholding_vat_code',
    ],
  },
  {
    key: 'otras',
    label: 'Otras',
    icon: 'ri-more-2-line',
    fields: ['rounding_account_code', 'fx_difference_account_code'],
  },
];

const PUC_TEMPLATE: Partial<AccountingSettings> = {
  cash_account_code: '110505',
  bank_account_code: '111005',
  accounts_receivable_code: '130505',
  accounts_payable_code: '220505',
  revenue_account_code: '413595',
  cost_account_code: '613595',
  expense_account_code: '519595',
  vat_generated_code: '240805',
  vat_deductible_code: '240810',
  withholding_source_code: '236540',
  withholding_ica_code: '236801',
  withholding_vat_code: '236703',
  rounding_account_code: '539595',
  fx_difference_account_code: '421040',
};

type TabKey = 'params' | 'accounts' | 'documents' | 'doctypes' | 'banks' | 'costcenters';

const APPLIES_LABEL: Record<TipoDocumentoApplies, string> = {
  compra: 'Compras',
  venta: 'Ventas',
  ambos: 'Ambos',
};

const APPLIES_COLOR: Record<TipoDocumentoApplies, string> = {
  compra: 'info',
  venta: 'success',
  ambos: 'secondary',
};

const parseCodeFromValue = (raw: string): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  const m = trimmed.match(/^([0-9A-Za-z.-]+)\s*[—-]\s*.+$/);
  return (m ? m[1] : trimmed).trim();
};

const AccountingMasterSection: React.FC<Props> = ({ tenantId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('params');

  const [settings, setSettings] = useState<AccountingSettings>(emptySettings);
  const [initialSettings, setInitialSettings] = useState<AccountingSettings>(emptySettings);
  const [documentConfigs, setDocumentConfigs] = useState<DocumentConfig[]>([]);
  const [initialDocumentConfigs, setInitialDocumentConfigs] = useState<DocumentConfig[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [pucAccounts, setPucAccounts] = useState<PucAccount[]>([]);

  const [newBank, setNewBank] = useState({
    name: '',
    account_type: 'corriente',
    account_number: '',
    account_code: '',
    branch: '',
    is_default: false,
  });
  const [newCostCenter, setNewCostCenter] = useState({ code: '', name: '', description: '' });
  const [addingBank, setAddingBank] = useState(false);
  const [addingCostCenter, setAddingCostCenter] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [pucOpen, setPucOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Tipos de documento (FC, DSA, FV, NC, etc.) persistidos en localStorage
  const [docTypes, setDocTypes] = useState<TipoDocumento[]>(() => loadTipos());
  const [docTypeAddOpen, setDocTypeAddOpen] = useState(false);
  const [docTypeAddSel, setDocTypeAddSel] = useState<string>('');

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TIPOS_LS_KEY) setDocTypes(loadTipos());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleDeleteDocType = async (code: string) => {
    const result = await Swal.fire({
      title: `¿Eliminar "${code}"?`,
      text: 'Ya no aparecerá en los selectores. Las facturas existentes mantienen su tipo guardado.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f06548',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    const next = removeTipo(code);
    setDocTypes(next);
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  };

  const loadAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError('');
    try {
      const [settingsRes, configsRes, banksRes, costCentersRes, pucRes] = await Promise.all([
        api.get(`/accounting/settings?tenantId=${tenantId}`),
        api.get(`/accounting/document-configs?tenantId=${tenantId}`),
        api.get(`/accounting/banks?tenantId=${tenantId}`),
        api.get(`/accounting/cost-centers?tenantId=${tenantId}`),
        api.get('/accounting/chart-of-accounts').catch(() => ({ data: { success: false, accounts: [] } })),
      ]);

      if (settingsRes.data?.success && settingsRes.data.settings) {
        const merged = { ...emptySettings, ...settingsRes.data.settings };
        setSettings(merged);
        setInitialSettings(merged);
      } else {
        setSettings(emptySettings);
        setInitialSettings(emptySettings);
      }
      const cfgs: DocumentConfig[] = configsRes.data?.success ? configsRes.data.configs || [] : [];
      setDocumentConfigs(cfgs);
      setInitialDocumentConfigs(JSON.parse(JSON.stringify(cfgs)));
      if (banksRes.data?.success) setBanks(banksRes.data.banks || []);
      if (costCentersRes.data?.success) setCostCenters(costCentersRes.data.costCenters || []);
      if (pucRes.data?.success) setPucAccounts(pucRes.data.accounts || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo cargar la configuración contable');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const pucByCode = useMemo(() => {
    const m = new Map<string, PucAccount>();
    pucAccounts.forEach((a) => m.set(String(a.code), a));
    return m;
  }, [pucAccounts]);

  const isValidCode = (code: string) => {
    if (!code) return true;
    if (pucAccounts.length === 0) return true;
    return pucByCode.has(String(code).trim());
  };

  const orderedConfigs = useMemo(() => {
    const byType = new Map(documentConfigs.map((cfg) => [cfg.document_type, cfg]));
    return DEFAULT_DOC_ORDER.map((type) => byType.get(type)).filter(Boolean) as DocumentConfig[];
  }, [documentConfigs]);

  const accountsFilled = ACCOUNT_FIELDS.filter((f) => ((settings as any)[f.field] || '').toString().trim().length > 0).length;
  const docsFilled = orderedConfigs.filter(
    (c) => (c.debit_account_code || '').trim() && (c.credit_account_code || '').trim(),
  ).length;

  const paramsComplete = !!settings.accounting_method && !!settings.reporting_basis && !!settings.fiscal_year_start_month;
  const accountsComplete = accountsFilled === ACCOUNT_FIELDS.length;
  const docsComplete = orderedConfigs.length > 0 && docsFilled === orderedConfigs.length;
  const banksComplete = banks.length > 0;
  const costCentersComplete = costCenters.length > 0;

  const hasSettingsChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [settings, initialSettings],
  );
  const hasDocumentChanges = useMemo(
    () => JSON.stringify(documentConfigs) !== JSON.stringify(initialDocumentConfigs),
    [documentConfigs, initialDocumentConfigs],
  );
  const hasAnyChanges = hasSettingsChanges || hasDocumentChanges;

  const handleSettingChange = (field: keyof AccountingSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleCodeBlur = (field: keyof AccountingSettings) => {
    const raw = (settings as any)[field] || '';
    const code = parseCodeFromValue(raw);
    if (code !== raw) handleSettingChange(field, code);
  };

  const handleDocChange = (docType: string, patch: Partial<DocumentConfig>) => {
    setDocumentConfigs((prev) => prev.map((c) => (c.document_type === docType ? { ...c, ...patch } : c)));
  };

  const handleDocCodeBlur = (docType: string, field: keyof DocumentConfig) => {
    const cfg = documentConfigs.find((c) => c.document_type === docType);
    if (!cfg) return;
    const raw = (cfg as any)[field] || '';
    const code = parseCodeFromValue(raw);
    if (code !== raw) handleDocChange(docType, { [field]: code } as any);
  };

  const saveAll = async () => {
    setSaving(true);
    setError('');
    try {
      if (hasSettingsChanges) {
        const { data } = await api.put('/accounting/settings', { tenantId, settings });
        if (data?.success && data.settings) {
          const merged = { ...emptySettings, ...data.settings };
          setSettings(merged);
          setInitialSettings(merged);
        } else {
          setInitialSettings(settings);
        }
      }
      if (hasDocumentChanges) {
        const changed = documentConfigs.filter((cfg) => {
          const prev = initialDocumentConfigs.find((c) => c.document_type === cfg.document_type);
          return JSON.stringify(prev) !== JSON.stringify(cfg);
        });
        await Promise.all(
          changed.map((cfg) =>
            api.put(`/accounting/document-configs/${cfg.document_type}`, { tenantId, ...cfg }),
          ),
        );
        setInitialDocumentConfigs(JSON.parse(JSON.stringify(documentConfigs)));
      }
      showSuccess('Cambios guardados correctamente');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const saveBank = async () => {
    if (!newBank.name.trim()) {
      setError('El nombre del banco es obligatorio');
      return;
    }
    try {
      const { data } = await api.post('/accounting/banks', { tenantId, ...newBank });
      if (data?.success) {
        setNewBank({ name: '', account_type: 'corriente', account_number: '', account_code: '', branch: '', is_default: false });
        showSuccess('Banco guardado');
        loadAll();
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo guardar el banco');
    }
  };

  const deleteBank = async (id: string | number) => {
    try {
      await api.delete(`/accounting/banks/${id}`);
      showSuccess('Banco eliminado');
      loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo eliminar el banco');
    }
  };

  const saveCostCenter = async () => {
    if (!newCostCenter.code.trim() || !newCostCenter.name.trim()) {
      setError('Código y nombre del centro de costo son obligatorios');
      return;
    }
    try {
      const { data } = await api.post('/accounting/cost-centers', { tenantId, ...newCostCenter });
      if (data?.success) {
        setNewCostCenter({ code: '', name: '', description: '' });
        showSuccess('Centro de costo guardado');
        loadAll();
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo guardar el centro de costo');
    }
  };

  const deleteCostCenter = async (id: string | number) => {
    try {
      await api.delete(`/accounting/cost-centers/${id}`);
      showSuccess('Centro de costo eliminado');
      loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo eliminar el centro de costo');
    }
  };

  const applyPucTemplate = async () => {
    const hasAnyValue = ACCOUNT_FIELDS.some(
      (f) => ((settings as any)[f.field] || '').toString().trim().length > 0,
    );
    if (hasAnyValue) {
      const result = await Swal.fire({
        title: 'Aplicar plantilla PUC Colombia',
        html: 'Ya tienes cuentas por defecto configuradas.<br/><br/>Al continuar se <b>sobreescribirán los códigos por defecto</b> con los del PUC Colombia estándar.<br/><br/><small class="text-muted">No se borran cuentas creadas en tu plan de cuentas, solo se actualizan los valores por defecto de esta pantalla.</small>',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, aplicar plantilla',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0ab39c',
        cancelButtonColor: '#f06548',
        reverseButtons: true,
      });
      if (!result.isConfirmed) return;
    }
    setSettings((prev) => ({ ...prev, ...PUC_TEMPLATE } as AccountingSettings));
    showSuccess('Plantilla PUC Colombia aplicada. Recuerda guardar los cambios.');
  };

  const fieldLabel = (f: keyof AccountingSettings) =>
    ACCOUNT_FIELDS.find((x) => x.field === f)?.label || String(f);

  const hasVal = (f: keyof AccountingSettings) =>
    ((settings as any)[f] || '').toString().trim().length > 0;

  const moduleChecks = useMemo(() => {
    const hasBankOrCash =
      hasVal('bank_account_code') || hasVal('cash_account_code') || banks.length > 0;
    const items: Array<{ name: string; ok: boolean; missing: string[] }> = [];

    const check = (
      name: string,
      reqs: Array<{ ok: boolean; label: string }>,
    ) => {
      const missing = reqs.filter((r) => !r.ok).map((r) => r.label);
      items.push({ name, ok: missing.length === 0, missing });
    };

    check('Ventas', [
      { ok: hasVal('accounts_receivable_code'), label: fieldLabel('accounts_receivable_code') },
      { ok: hasVal('revenue_account_code'), label: fieldLabel('revenue_account_code') },
      { ok: hasVal('vat_generated_code'), label: fieldLabel('vat_generated_code') },
    ]);
    check('Compras', [
      { ok: hasVal('accounts_payable_code'), label: fieldLabel('accounts_payable_code') },
      { ok: hasVal('expense_account_code'), label: fieldLabel('expense_account_code') },
      { ok: hasVal('vat_deductible_code'), label: fieldLabel('vat_deductible_code') },
    ]);
    check('Documentos soporte', [
      { ok: hasVal('accounts_payable_code'), label: fieldLabel('accounts_payable_code') },
      { ok: hasVal('expense_account_code'), label: fieldLabel('expense_account_code') },
      { ok: hasVal('withholding_source_code'), label: fieldLabel('withholding_source_code') },
    ]);
    check('Pagos', [
      { ok: hasBankOrCash, label: 'Al menos un banco registrado, cuenta de bancos o caja' },
    ]);
    check('Cobros', [
      { ok: hasVal('accounts_receivable_code'), label: fieldLabel('accounts_receivable_code') },
      { ok: hasBankOrCash, label: 'Al menos un banco registrado, cuenta de bancos o caja' },
    ]);
    check('Notas crédito / débito', [
      { ok: hasVal('accounts_receivable_code'), label: fieldLabel('accounts_receivable_code') },
      { ok: hasVal('revenue_account_code'), label: fieldLabel('revenue_account_code') },
    ]);
    check('Nómina', [
      { ok: hasVal('expense_account_code'), label: fieldLabel('expense_account_code') },
    ]);

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, banks]);

  const missingAccountsCount = ACCOUNT_FIELDS.length - accountsFilled;

  const codeOr = (f: keyof AccountingSettings) =>
    ((settings as any)[f] || '').toString().trim() || (PUC_TEMPLATE as any)[f] || '';

  const fmt = (n: number) =>
    n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const journalPreviews = useMemo(() => {
    const ar = codeOr('accounts_receivable_code');
    const ap = codeOr('accounts_payable_code');
    const rev = codeOr('revenue_account_code');
    const exp = codeOr('expense_account_code');
    const vatG = codeOr('vat_generated_code');
    const vatD = codeOr('vat_deductible_code');
    const bank = codeOr('bank_account_code');
    return [
      {
        title: 'Factura de venta $100.000 + IVA 19%',
        rows: [
          { type: 'Dr', code: ar, value: 119000 },
          { type: 'Cr', code: rev, value: 100000 },
          { type: 'Cr', code: vatG, value: 19000 },
        ],
      },
      {
        title: 'Factura de compra $100.000 + IVA 19%',
        rows: [
          { type: 'Dr', code: exp, value: 100000 },
          { type: 'Dr', code: vatD, value: 19000 },
          { type: 'Cr', code: ap, value: 119000 },
        ],
      },
      {
        title: 'Pago a proveedor $119.000',
        rows: [
          { type: 'Dr', code: ap, value: 119000 },
          { type: 'Cr', code: bank, value: 119000 },
        ],
      },
      {
        title: 'Cobro de cliente $119.000',
        rows: [
          { type: 'Dr', code: bank, value: 119000 },
          { type: 'Cr', code: ar, value: 119000 },
        ],
      },
      {
        title: 'Nota crédito $100.000 (inversa factura)',
        rows: [
          { type: 'Dr', code: rev, value: 100000 },
          { type: 'Dr', code: vatG, value: 19000 },
          { type: 'Cr', code: ar, value: 119000 },
        ],
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  if (loading) {
    return (
      <Card className="mt-4">
        <CardBody className="text-center py-5">
          <Spinner color="primary" />
          <div className="mt-2 text-muted">Cargando configuración contable...</div>
        </CardBody>
      </Card>
    );
  }

  const statusBadge = (ok: boolean, missingCount?: number) => (
    <span
      className={`ms-2 d-inline-block rounded-circle ${ok ? 'bg-success' : 'bg-warning'}`}
      style={{ width: 8, height: 8 }}
      title={ok ? 'Configurado' : (typeof missingCount === 'number' && missingCount > 0 ? `Incompleto (${missingCount})` : 'Incompleto')}
    />
  );

  const pucDatalist = (
    <datalist id="puc-list">
      {pucAccounts.map((a) => (
        <option key={`${a.code}-${a.id ?? ''}`} value={`${a.code} — ${a.name}`} />
      ))}
    </datalist>
  );

  return (
    <div className="mt-4 position-relative">
      {pucDatalist}

      {error && (
        <Alert color="danger" className="d-flex justify-content-between align-items-center">
          <span><i className="ri-error-warning-line me-2" />{error}</span>
          <Button size="sm" color="danger" outline onClick={loadAll}>
            <i className="ri-refresh-line me-1" />Reintentar
          </Button>
        </Alert>
      )}
      {success && (
        <Alert color="success">
          <i className="ri-check-double-line me-2" />{success}
        </Alert>
      )}

      <Card className="mb-3 border-0 shadow-sm">
        <CardBody className="py-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex flex-wrap gap-4">
              <div>
                <div className="text-muted fs-11 text-uppercase">Cuentas</div>
                <div className="fs-5 fw-semibold mb-0">
                  {accountsFilled}<span className="text-muted fs-6">/{ACCOUNT_FIELDS.length}</span>
                </div>
              </div>
              <div>
                <div className="text-muted fs-11 text-uppercase">Documentos</div>
                <div className="fs-5 fw-semibold mb-0">
                  {docsFilled}<span className="text-muted fs-6">/{orderedConfigs.length || DEFAULT_DOC_ORDER.length}</span>
                </div>
              </div>
              <div>
                <div className="text-muted fs-11 text-uppercase">Bancos</div>
                <div className="fs-5 fw-semibold mb-0">{banks.length}</div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button color="info" outline size="sm" onClick={() => setPucOpen(true)}>
                <i className="ri-book-2-line me-1" />Plan de cuentas
              </Button>
              <Button color="secondary" outline size="sm" onClick={applyPucTemplate}>
                <i className="ri-magic-line me-1" />Plantilla PUC Colombia
              </Button>
              <Button color="primary" size="sm" onClick={() => setValidateOpen(true)}>
                <i className="ri-shield-check-line me-1" />Validar
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-0" style={{ overflowX: 'auto' }}>
          <Nav pills className="flex-nowrap gap-1" style={{ whiteSpace: 'nowrap' }}>
            <NavItem>
              <NavLink
                href="#"
                active={activeTab === 'params'}
                onClick={(e) => { e.preventDefault(); setActiveTab('params'); }}
                className="px-3 py-2"
              >
                <i className="ri-settings-3-line me-1" />Parámetros {statusBadge(paramsComplete)}
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                href="#"
                active={activeTab === 'accounts'}
                onClick={(e) => { e.preventDefault(); setActiveTab('accounts'); }}
                className="px-3 py-2"
              >
                <i className="ri-bank-card-line me-1" />Cuentas {statusBadge(accountsComplete, missingAccountsCount)}
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                href="#"
                active={activeTab === 'documents'}
                onClick={(e) => { e.preventDefault(); setActiveTab('documents'); }}
                className="px-3 py-2"
              >
                <i className="ri-file-list-3-line me-1" />Documentos {statusBadge(docsComplete)}
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                href="#"
                active={activeTab === 'doctypes'}
                onClick={(e) => { e.preventDefault(); setActiveTab('doctypes'); }}
                className="px-3 py-2"
              >
                <i className="ri-price-tag-3-line me-1" />Tipos de documento
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                href="#"
                active={activeTab === 'banks'}
                onClick={(e) => { e.preventDefault(); setActiveTab('banks'); }}
                className="px-3 py-2"
              >
                <i className="ri-bank-line me-1" />Bancos {statusBadge(banksComplete)}
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink
                href="#"
                active={activeTab === 'costcenters'}
                onClick={(e) => { e.preventDefault(); setActiveTab('costcenters'); }}
                className="px-3 py-2"
              >
                <i className="ri-building-2-line me-1" />Centros {statusBadge(costCentersComplete)}
              </NavLink>
            </NavItem>
          </Nav>
        </CardHeader>
        <CardBody>
          {activeTab === 'params' && (
            <div>
              <h6 className="mb-3">Parámetros contables</h6>
              <Row className="g-3">
                <Col md={4}>
                  <Label className="form-label">Método contable</Label>
                  <Input
                    type="select"
                    value={settings.accounting_method}
                    onChange={(e) => handleSettingChange('accounting_method', e.target.value)}
                  >
                    <option value="causacion">Causación</option>
                    <option value="caja">Caja</option>
                  </Input>
                  <small className="text-muted">
                    Causación = registras ventas/compras cuando ocurren (estándar colombiano). Caja =
                    registras solo cuando entra/sale el dinero.
                  </small>
                </Col>
                <Col md={4}>
                  <Label className="form-label">Base de reporte</Label>
                  <Input
                    type="select"
                    value={settings.reporting_basis}
                    onChange={(e) => handleSettingChange('reporting_basis', e.target.value)}
                  >
                    <option value="local">Local</option>
                    <option value="niif">NIIF</option>
                  </Input>
                  <small className="text-muted">
                    Local = PUC colombiano estándar. NIIF = normas internacionales.
                  </small>
                </Col>
                <Col md={4}>
                  <Label className="form-label">Mes inicio fiscal</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={settings.fiscal_year_start_month}
                    onChange={(e) => handleSettingChange('fiscal_year_start_month', Number(e.target.value) || 1)}
                  />
                  <small className="text-muted">
                    En Colombia normalmente enero (1). Solo cambiar si tu empresa tiene año fiscal distinto.
                  </small>
                </Col>
                <Col md={4}>
                  <div className="p-3 border rounded h-100">
                    <div className="form-check form-switch">
                      <Input
                        className="form-check-input"
                        type="checkbox"
                        checked={settings.allow_manual_entries}
                        onChange={(e) => handleSettingChange('allow_manual_entries', e.target.checked)}
                      />
                      <Label className="form-check-label fw-semibold">Permitir asientos manuales</Label>
                    </div>
                    <small className="text-muted d-block mt-1">
                      Si está activo, el contador puede crear asientos a mano además de los automáticos.
                    </small>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="p-3 border rounded h-100">
                    <div className="form-check form-switch">
                      <Input
                        className="form-check-input"
                        type="checkbox"
                        checked={settings.lock_closed_periods}
                        onChange={(e) => handleSettingChange('lock_closed_periods', e.target.checked)}
                      />
                      <Label className="form-check-label fw-semibold">Bloquear periodos cerrados</Label>
                    </div>
                    <small className="text-muted d-block mt-1">
                      Una vez cerrado un mes, nadie puede crear/editar asientos en él. Recomendado: activado.
                    </small>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="p-3 border rounded h-100">
                    <div className="form-check form-switch">
                      <Input
                        className="form-check-input"
                        type="checkbox"
                        checked={settings.default_cost_center_required}
                        onChange={(e) => handleSettingChange('default_cost_center_required', e.target.checked)}
                      />
                      <Label className="form-check-label fw-semibold">Exigir centro de costo</Label>
                    </div>
                    <small className="text-muted d-block mt-1">
                      Si lo activas, ningún asiento puede guardarse sin centro de costo asignado.
                    </small>
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div>
              <h6 className="mb-1">Cuentas PUC por defecto</h6>
              <p className="text-muted small mb-3">
                Al empezar a escribir, el campo te sugiere cuentas del Plan Único de Cuentas. Si el
                código no existe en tu PUC, el campo se marcará en rojo.
              </p>
              {ACCOUNT_GROUPS.map((group) => {
                const groupFields = ACCOUNT_FIELDS.filter((f) => group.fields.includes(f.field));
                return (
                  <Card className="border mb-3" key={group.key}>
                    <CardHeader className="bg-light py-2">
                      <span className="small fw-semibold text-uppercase text-muted">
                        <i className={`${group.icon} me-2`} />
                        {group.label}
                      </span>
                    </CardHeader>
                    <CardBody>
                      <Row className="g-3">
                        {groupFields.map(({ field, label, help }) => {
                          const value = (settings as any)[field] || '';
                          const invalid = value && !isValidCode(parseCodeFromValue(value));
                          return (
                            <Col md={6} lg={4} key={field}>
                              <Label className="form-label">{label}</Label>
                              <Input
                                list="puc-list"
                                value={value}
                                onChange={(e) => handleSettingChange(field, e.target.value)}
                                onBlur={() => handleCodeBlur(field)}
                                placeholder="Ej: 110505"
                                className={invalid ? 'is-invalid' : ''}
                              />
                              <small className="text-muted d-block">{help}</small>
                              {invalid && (
                                <small className="text-danger d-block">
                                  Código no encontrado en el PUC.
                                </small>
                              )}
                            </Col>
                          );
                        })}
                      </Row>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              <h6 className="mb-1">Documentos contables</h6>
              <p className="text-muted small mb-3">
                Define el comportamiento contable de cada documento. &quot;Débito&quot; es la cuenta que se
                debita, &quot;Crédito&quot; la que se acredita. &quot;Auto-post&quot; significa que el asiento se registra
                en el momento de crear el documento.
              </p>
              <div className="table-responsive">
                <Table className="align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ minWidth: 160 }}>Documento</th>
                      <th style={{ minWidth: 90 }}>Prefijo</th>
                      <th style={{ minWidth: 220 }}>Débito</th>
                      <th style={{ minWidth: 220 }}>Crédito</th>
                      <th style={{ minWidth: 220 }}>Impuesto</th>
                      <th className="text-center">Afecta cartera</th>
                      <th className="text-center">Auto-post</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedConfigs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">
                          No hay documentos configurados aún.
                        </td>
                      </tr>
                    )}
                    {orderedConfigs.map((cfg) => {
                      const debitInvalid = cfg.debit_account_code && !isValidCode(parseCodeFromValue(cfg.debit_account_code));
                      const creditInvalid = cfg.credit_account_code && !isValidCode(parseCodeFromValue(cfg.credit_account_code));
                      const taxInvalid = cfg.tax_account_code && !isValidCode(parseCodeFromValue(cfg.tax_account_code));
                      return (
                        <tr key={cfg.document_type}>
                          <td>
                            <div className="fw-semibold">{DOC_LABELS[cfg.document_type] || cfg.document_type}</div>
                            <div className="text-muted small">{cfg.document_type}</div>
                            {cfg.requires_electronic_support && (
                              <Badge color="info" className="mt-1">Electrónico</Badge>
                            )}
                          </td>
                          <td>
                            <Input
                              bsSize="sm"
                              value={cfg.prefix || ''}
                              onChange={(e) => handleDocChange(cfg.document_type, { prefix: e.target.value })}
                            />
                          </td>
                          <td>
                            <Input
                              bsSize="sm"
                              list="puc-list"
                              value={cfg.debit_account_code || ''}
                              onChange={(e) => handleDocChange(cfg.document_type, { debit_account_code: e.target.value })}
                              onBlur={() => handleDocCodeBlur(cfg.document_type, 'debit_account_code')}
                              className={debitInvalid ? 'is-invalid' : ''}
                              placeholder="Código"
                            />
                          </td>
                          <td>
                            <Input
                              bsSize="sm"
                              list="puc-list"
                              value={cfg.credit_account_code || ''}
                              onChange={(e) => handleDocChange(cfg.document_type, { credit_account_code: e.target.value })}
                              onBlur={() => handleDocCodeBlur(cfg.document_type, 'credit_account_code')}
                              className={creditInvalid ? 'is-invalid' : ''}
                              placeholder="Código"
                            />
                          </td>
                          <td>
                            <Input
                              bsSize="sm"
                              list="puc-list"
                              value={cfg.tax_account_code || ''}
                              onChange={(e) => handleDocChange(cfg.document_type, { tax_account_code: e.target.value })}
                              onBlur={() => handleDocCodeBlur(cfg.document_type, 'tax_account_code')}
                              className={taxInvalid ? 'is-invalid' : ''}
                              placeholder="Código"
                            />
                          </td>
                          <td className="text-center">
                            <div className="form-check form-switch d-inline-block">
                              <Input
                                type="checkbox"
                                checked={!!cfg.affects_portfolio}
                                onChange={(e) => handleDocChange(cfg.document_type, { affects_portfolio: e.target.checked })}
                              />
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="form-check form-switch d-inline-block">
                              <Input
                                type="checkbox"
                                checked={!!cfg.auto_post}
                                onChange={(e) => handleDocChange(cfg.document_type, { auto_post: e.target.checked })}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              <Card className="border mt-3">
                <CardHeader
                  className="bg-light py-2 d-flex justify-content-between align-items-center"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setPreviewOpen((v) => !v)}
                >
                  <span className="small fw-semibold">
                    <i className="ri-eye-line me-2" />
                    Previsualización del asiento que genera cada documento
                  </span>
                  <i className={previewOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
                </CardHeader>
                {previewOpen && (
                  <CardBody>
                    <p className="text-muted small mb-3">
                      Ejemplos generados con los códigos del setup actual (si un campo está vacío,
                      se usa el código estándar PUC Colombia).
                    </p>
                    <Row className="g-3">
                      {journalPreviews.map((prev) => (
                        <Col md={6} key={prev.title}>
                          <div className="border rounded p-2 h-100">
                            <div className="fw-semibold small mb-2">{prev.title}</div>
                            <Table size="sm" className="mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th style={{ width: 50 }}>Tipo</th>
                                  <th>Cuenta</th>
                                  <th className="text-end">Valor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {prev.rows.map((r, i) => (
                                  <tr key={i}>
                                    <td>
                                      <Badge color={r.type === 'Dr' ? 'primary' : 'secondary'}>
                                        {r.type}
                                      </Badge>
                                    </td>
                                    <td><code>{r.code || '-'}</code></td>
                                    <td className="text-end">${fmt(r.value)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </CardBody>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'doctypes' && (
            <div>
              <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
                <div>
                  <h6 className="mb-1">Tipos de documento</h6>
                  <div className="text-muted fs-12">
                    Prefijos usados en compras/ventas (FC, DSA, FV, NC, ND, RC, CE...). Se
                    guardan en tu navegador.
                  </div>
                </div>
                {!docTypeAddOpen ? (
                  <Button color="primary" size="sm" onClick={() => setDocTypeAddOpen(true)}>
                    <i className="ri-add-line me-1" />Agregar tipo
                  </Button>
                ) : (
                  <div className="d-flex align-items-center gap-2" style={{ minWidth: 320 }}>
                    <div style={{ flex: 1 }}>
                      <TipoDocumentoSelect
                        filter="ambos"
                        value={docTypeAddSel}
                        onChange={(code) => {
                          setDocTypeAddSel(code);
                          setDocTypes(loadTipos());
                        }}
                        includeAllOption
                        allOptionLabel="— elegí o crea nuevo —"
                      />
                    </div>
                    <Button
                      color="light"
                      size="sm"
                      onClick={() => { setDocTypeAddOpen(false); setDocTypeAddSel(''); }}
                      title="Cerrar"
                    >
                      <i className="ri-close-line" />
                    </Button>
                  </div>
                )}
              </div>

              {docTypes.length === 0 ? (
                <div className="text-center py-5 border rounded bg-light">
                  <i className="ri-price-tag-3-line" style={{ fontSize: 36 }} />
                  <div className="mt-2 fw-semibold">Aún no hay tipos de documento</div>
                  <div className="text-muted small">
                    Usa el selector de arriba y elige &quot;+ Crear nuevo tipo…&quot;.
                  </div>
                </div>
              ) : (
                <Table className="align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 120 }}>Código</th>
                      <th>Nombre</th>
                      <th style={{ width: 140 }}>Aplica a</th>
                      <th className="text-end" style={{ width: 120 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docTypes.map((t) => (
                      <tr key={t.code}>
                        <td><code>{t.code}</code></td>
                        <td className="fw-semibold">{t.name}</td>
                        <td>
                          <Badge color={APPLIES_COLOR[t.applies]}>
                            {APPLIES_LABEL[t.applies]}
                          </Badge>
                        </td>
                        <td className="text-end">
                          <Button
                            color="danger"
                            outline
                            size="sm"
                            onClick={() => handleDeleteDocType(t.code)}
                            title="Eliminar tipo"
                          >
                            <i className="ri-delete-bin-line" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          )}

          {activeTab === 'banks' && (
            <div>
              <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
                <div>
                  <h6 className="mb-1">Bancos</h6>
                  <div className="text-muted fs-12">Cuentas bancarias usadas para conciliación y recibos de pago.</div>
                </div>
                {!addingBank && (
                  <Button color="primary" size="sm" onClick={() => setAddingBank(true)}>
                    <i className="ri-add-line me-1" />Agregar banco
                  </Button>
                )}
              </div>
              {addingBank && (
                <Card className="border mb-3 bg-light">
                  <CardBody className="py-3">
                    <Row className="g-2">
                      <Col md={6}>
                        <Label className="form-label fs-12 mb-1">Nombre del banco *</Label>
                        <Input bsSize="sm" value={newBank.name} onChange={(e) => setNewBank((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Bancolombia" />
                      </Col>
                      <Col md={6}>
                        <Label className="form-label fs-12 mb-1">Número de cuenta</Label>
                        <Input bsSize="sm" value={newBank.account_number} onChange={(e) => setNewBank((p) => ({ ...p, account_number: e.target.value }))} placeholder="123-456789-00" />
                      </Col>
                      <Col md={3}>
                        <Label className="form-label fs-12 mb-1">Tipo</Label>
                        <Input bsSize="sm" type="select" value={newBank.account_type} onChange={(e) => setNewBank((p) => ({ ...p, account_type: e.target.value }))}>
                          <option value="corriente">Corriente</option>
                          <option value="ahorros">Ahorros</option>
                        </Input>
                      </Col>
                      <Col md={3}>
                        <Label className="form-label fs-12 mb-1">Cuenta PUC</Label>
                        <Input bsSize="sm" list="puc-list" value={newBank.account_code} onChange={(e) => setNewBank((p) => ({ ...p, account_code: e.target.value }))} onBlur={() => setNewBank((p) => ({ ...p, account_code: parseCodeFromValue(p.account_code) }))} placeholder="111005" />
                      </Col>
                      <Col md={3}>
                        <Label className="form-label fs-12 mb-1">Sucursal</Label>
                        <Input bsSize="sm" value={newBank.branch} onChange={(e) => setNewBank((p) => ({ ...p, branch: e.target.value }))} placeholder="Opcional" />
                      </Col>
                      <Col md={3} className="d-flex align-items-end">
                        <div className="form-check form-switch mb-1">
                          <Input className="form-check-input" type="checkbox" id="bank-default" checked={newBank.is_default} onChange={(e) => setNewBank((p) => ({ ...p, is_default: e.target.checked }))} />
                          <Label for="bank-default" className="form-check-label fs-12">Por defecto</Label>
                        </div>
                      </Col>
                      <Col md={12} className="d-flex justify-content-end gap-2 mt-1">
                        <Button color="light" size="sm" onClick={() => { setAddingBank(false); setNewBank({ name: '', account_type: 'corriente', account_number: '', account_code: '', branch: '', is_default: false }); }}>Cancelar</Button>
                        <Button color="primary" size="sm" onClick={async () => { await saveBank(); setAddingBank(false); }}>
                          <i className="ri-save-line me-1" />Guardar banco
                        </Button>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              )}

              {banks.length === 0 ? (
                <div className="text-center py-5 border rounded bg-light">
                  <i className="ri-bank-line" style={{ fontSize: 36 }} />
                  <div className="mt-2 fw-semibold">Aún no has registrado bancos</div>
                  <div className="text-muted small">
                    Agrega tu primera cuenta bancaria usando el formulario de arriba.
                  </div>
                </div>
              ) : (
                <Table className="align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Banco</th>
                      <th>Tipo / Número</th>
                      <th>Cuenta PUC</th>
                      <th>Sucursal</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banks.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <span className="fw-semibold">{b.name}</span>
                          {b.is_default && <Badge color="success" className="ms-2">Default</Badge>}
                        </td>
                        <td>
                          <span className="text-capitalize">{b.account_type}</span>
                          {b.account_number ? ` · ${b.account_number}` : ''}
                        </td>
                        <td><code>{b.account_code || '-'}</code></td>
                        <td>{b.branch || '-'}</td>
                        <td className="text-end">
                          <Button color="danger" outline size="sm" onClick={() => deleteBank(b.id)}>
                            <i className="ri-delete-bin-line" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          )}

          {activeTab === 'costcenters' && (
            <div>
              <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
                <div>
                  <h6 className="mb-1">Centros de costo</h6>
                  <div className="text-muted fs-12">Para análisis por unidad de negocio y vista del contador.</div>
                </div>
                {!addingCostCenter && (
                  <Button color="primary" size="sm" onClick={() => setAddingCostCenter(true)}>
                    <i className="ri-add-line me-1" />Agregar centro
                  </Button>
                )}
              </div>
              {addingCostCenter && (
                <Card className="border mb-3 bg-light">
                  <CardBody className="py-3">
                    <Row className="g-2">
                      <Col md={3}>
                        <Label className="form-label fs-12 mb-1">Código *</Label>
                        <Input bsSize="sm" value={newCostCenter.code} onChange={(e) => setNewCostCenter((p) => ({ ...p, code: e.target.value }))} placeholder="CC01" />
                      </Col>
                      <Col md={9}>
                        <Label className="form-label fs-12 mb-1">Nombre *</Label>
                        <Input bsSize="sm" value={newCostCenter.name} onChange={(e) => setNewCostCenter((p) => ({ ...p, name: e.target.value }))} placeholder="Administración" />
                      </Col>
                      <Col md={12}>
                        <Label className="form-label fs-12 mb-1">Descripción</Label>
                        <Input bsSize="sm" value={newCostCenter.description} onChange={(e) => setNewCostCenter((p) => ({ ...p, description: e.target.value }))} placeholder="Opcional" />
                      </Col>
                      <Col md={12} className="d-flex justify-content-end gap-2 mt-1">
                        <Button color="light" size="sm" onClick={() => { setAddingCostCenter(false); setNewCostCenter({ code: '', name: '', description: '' }); }}>Cancelar</Button>
                        <Button color="primary" size="sm" onClick={async () => { await saveCostCenter(); setAddingCostCenter(false); }}>
                          <i className="ri-save-line me-1" />Guardar centro
                        </Button>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              )}

              {costCenters.length === 0 ? (
                <div className="text-center py-5 border rounded bg-light">
                  <i className="ri-building-2-line" style={{ fontSize: 36 }} />
                  <div className="mt-2 fw-semibold">Aún no hay centros de costo</div>
                  <div className="text-muted small">
                    Crea al menos uno si quieres analizar resultados por área.
                  </div>
                </div>
              ) : (
                <Table className="align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>Descripción</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costCenters.map((cc) => (
                      <tr key={cc.id}>
                        <td><code>{cc.code}</code></td>
                        <td className="fw-semibold">{cc.name}</td>
                        <td className="text-muted">{cc.description || '-'}</td>
                        <td className="text-end">
                          <Button color="danger" outline size="sm" onClick={() => deleteCostCenter(cc.id)}>
                            <i className="ri-delete-bin-line" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <div
        className="sticky-bottom mt-3 py-2 px-3 bg-white border-top d-flex justify-content-between align-items-center"
        style={{ bottom: 0, zIndex: 10 }}
      >
        <div className="text-muted small">
          {hasAnyChanges ? (
            <><i className="ri-edit-circle-line me-1 text-warning" />Tienes cambios sin guardar</>
          ) : (
            <><i className="ri-check-line me-1 text-success" />Todo está guardado</>
          )}
        </div>
        <Button color="primary" onClick={saveAll} disabled={saving || !hasAnyChanges}>
          {saving ? (
            <><Spinner size="sm" className="me-2" />Guardando...</>
          ) : (
            <><i className="ri-save-line me-1" />Guardar cambios</>
          )}
        </Button>
      </div>

      <Modal isOpen={validateOpen} toggle={() => setValidateOpen(false)} size="md">
        <ModalHeader toggle={() => setValidateOpen(false)}>
          <i className="ri-shield-check-line me-2" />
          Validación de la configuración contable
        </ModalHeader>
        <ModalBody>
          <p className="text-muted small">
            Módulos que pueden operar con la configuración actual:
          </p>
          <ul className="list-unstyled mb-0">
            {moduleChecks.map((m) => (
              <li key={m.name} className="d-flex align-items-start py-2 border-bottom">
                <span
                  className={`me-2 fw-bold ${m.ok ? 'text-success' : 'text-danger'}`}
                  style={{ fontSize: 18, minWidth: 20 }}
                >
                  {m.ok ? '\u2713' : '\u2715'}
                </span>
                <div className="flex-grow-1">
                  <div className="fw-semibold">{m.name}</div>
                  {!m.ok && m.missing.length > 0 && (
                    <small className="text-danger">
                      Falta: {m.missing.join(', ')}
                    </small>
                  )}
                  {m.ok && (
                    <small className="text-muted">Listo para operar.</small>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={() => setValidateOpen(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </Modal>
      <PucEditorModal isOpen={pucOpen} onClose={() => setPucOpen(false)} />
    </div>
  );
};

export default AccountingMasterSection;
