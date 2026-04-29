// src/pages/income/SalesInvoice/Create.tsx
import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  FlaskConical,
  FileText,
  ClipboardList,
  Package,
  TrendingUp,
  TrendingDown,
  Wallet,
  ShoppingCart,
  FileMinus,
  FileEdit,
  Lock,
  AlertTriangle,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import Swal from 'sweetalert2';

import FacturaTab from './tabs/FacturaTab';
import CotizacionTab from './tabs/CotizacionTab';
import RemisionTab from './tabs/RemisionTab';
import NotaDebitoTab from './tabs/NotaDebitoTab';
import NotaCreditoTab from './tabs/NotaCreditoTab';
import PagoTab from './tabs/PagoTab';
import CompraTab from './tabs/CompraTab';
import PagoProveedorTab from './tabs/PagoProveedorTab';
import SetPruebasTab from './tabs/SetPruebasTab';

type SalesDocumentType =
  | 'set-pruebas'
  | 'factura'
  | 'cotizacion'
  | 'remision'
  | 'nota-debito'
  | 'nota-credito'
  | 'pago';

export type PurchaseDocumentType =
  | 'factura'
  | 'orden'
  | 'documento-soporte'
  | 'pago'
  | 'nota-ajuste'
  | 'nota-debito';

type DocumentType = SalesDocumentType | PurchaseDocumentType;

// Exporta esta interface
export interface DocumentConfig {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  numberLabel: string;
}

const SALES_DOCUMENT_CONFIGS: Record<SalesDocumentType, DocumentConfig> = {
  'set-pruebas': {
    title: 'Set de Pruebas',
    subtitle: 'Habilitacion DIAN',
    icon: '🧪',
    color: '#FF6B6B',
    numberLabel: ''
  },
  factura: {
    title: 'Factura de Ventas',
    subtitle: 'Documento fiscal',
    icon: '📄',
    color: '#00BFA5',
    numberLabel: 'Factura No.'
  },
  cotizacion: {
    title: 'Cotizacion',
    subtitle: 'Propuesta comercial',
    icon: '📋',
    color: '#2196F3',
    numberLabel: 'Cotizacion No.'
  },
  remision: {
    title: 'Remision',
    subtitle: 'Documento de entrega',
    icon: '📦',
    color: '#FF9800',
    numberLabel: 'Remision No.'
  },
  'nota-debito': {
    title: 'Nota Debito',
    subtitle: 'Ajuste a favor del vendedor',
    icon: '📈',
    color: '#E91E63',
    numberLabel: 'Nota Debito No.'
  },
  'nota-credito': {
    title: 'Nota Credito',
    subtitle: 'Ajuste a favor del cliente',
    icon: '📉',
    color: '#9C27B0',
    numberLabel: 'Nota Credito No.'
  },
  pago: {
    title: 'Recibo de Pago',
    subtitle: 'Registro de pago recibido',
    icon: '💰',
    color: '#4CAF50',
    numberLabel: 'Recibo No.'
  }
};

const PURCHASE_DOCUMENT_CONFIGS: Record<PurchaseDocumentType, DocumentConfig> = {
  factura: {
    title: 'Factura de Compra',
    subtitle: 'Documento de proveedor',
    icon: 'CP',
    color: '#FB8C00',
    numberLabel: 'Factura Proveedor No.'
  },
  orden: {
    title: 'Orden de Compra',
    subtitle: 'Solicitud a proveedor',
    icon: 'OC',
    color: '#607D8B',
    numberLabel: 'Orden No.'
  },
  'documento-soporte': {
    title: 'Documento Soporte',
    subtitle: 'Documento equivalente',
    icon: 'DS',
    color: '#8D6E63',
    numberLabel: 'Documento Soporte No.'
  },
  pago: {
    title: 'Pago a Proveedor',
    subtitle: 'Egreso aplicado',
    icon: 'PP',
    color: '#EC407A',
    numberLabel: 'Egreso No.'
  },
  'nota-ajuste': {
    title: 'Nota de Ajuste',
    subtitle: 'Ajuste de compra',
    icon: 'NA',
    color: '#7E57C2',
    numberLabel: 'Nota Ajuste No.'
  },
  'nota-debito': {
    title: 'Nota Debito Compra',
    subtitle: 'Incremento del proveedor',
    icon: 'ND',
    color: '#E53935',
    numberLabel: 'Nota Debito No.'
  }
};

// Lucide icon map for tabs
const SALES_TAB_ICONS: Record<SalesDocumentType, React.FC<any>> = {
  'set-pruebas': FlaskConical,
  factura: FileText,
  cotizacion: ClipboardList,
  remision: Package,
  'nota-debito': TrendingUp,
  'nota-credito': TrendingDown,
  pago: Wallet,
};

const PURCHASE_TAB_ICONS: Record<PurchaseDocumentType, React.FC<any>> = {
  factura: ShoppingCart,
  orden: ClipboardList,
  'documento-soporte': FileText,
  pago: Wallet,
  'nota-ajuste': FileEdit,
  'nota-debito': FileMinus,
};

// Color classes per tab
const SALES_TAB_COLORS: Record<SalesDocumentType, { active: string; icon: string }> = {
  'set-pruebas': { active: 'bg-red-500', icon: 'text-red-500 dark:text-red-400' },
  factura: { active: 'bg-teal-500', icon: 'text-teal-500 dark:text-teal-400' },
  cotizacion: { active: 'bg-blue-500', icon: 'text-blue-500 dark:text-blue-400' },
  remision: { active: 'bg-orange-500', icon: 'text-orange-500 dark:text-orange-400' },
  'nota-debito': { active: 'bg-pink-500', icon: 'text-pink-500 dark:text-pink-400' },
  'nota-credito': { active: 'bg-purple-500', icon: 'text-purple-500 dark:text-purple-400' },
  pago: { active: 'bg-green-500', icon: 'text-green-500 dark:text-green-400' },
};

const PURCHASE_TAB_COLORS: Record<PurchaseDocumentType, { active: string; icon: string }> = {
  factura: { active: 'bg-orange-500', icon: 'text-orange-500 dark:text-orange-400' },
  orden: { active: 'bg-slate-500', icon: 'text-slate-500 dark:text-slate-400' },
  'documento-soporte': { active: 'bg-stone-500', icon: 'text-stone-500 dark:text-stone-400' },
  pago: { active: 'bg-pink-500', icon: 'text-pink-500 dark:text-pink-400' },
  'nota-ajuste': { active: 'bg-violet-500', icon: 'text-violet-500 dark:text-violet-400' },
  'nota-debito': { active: 'bg-red-500', icon: 'text-red-500 dark:text-red-400' },
};

const SALES_TAB_ORDER: SalesDocumentType[] = [
  'set-pruebas',
  'factura',
  'cotizacion',
  'nota-debito',
  'nota-credito',
  'pago'
];

const PURCHASE_TAB_ORDER: PurchaseDocumentType[] = [
  'factura',
  'orden',
  'documento-soporte',
  'pago',
  'nota-ajuste',
  'nota-debito'
];

const Create: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPurchaseMode = location.pathname.startsWith('/gastos/');
  const tipoParam = searchParams.get('tipo') as DocumentType | null;
  const baseCreatePath = isPurchaseMode
    ? (location.pathname.startsWith('/gastos/factura-compra') ? '/gastos/factura-compra/crear' : '/gastos/nuevo')
    : '/ingresos/nuevo';
  const isTestMode = searchParams.get('test') === 'true';
  const [testSetCompleted, setTestSetCompleted] = useState<boolean>(false);
  const [testSetStatus, setTestSetStatus] = useState<string>('PENDIENTE');
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);

  // Estado para saber si el tenant necesita facturacion electronica
  const [needsElectronicInvoice, setNeedsElectronicInvoice] = useState<boolean | null>(null);

  // Determinar si estamos en modo prueba basado en el estado del Set de Pruebas
  const effectiveTestMode = isTestMode || testSetStatus === 'ENVIADO';

  // Determinar el tab inicial
  const getInitialTab = (): DocumentType => {
    if (tipoParam) {
      if (!isPurchaseMode && tipoParam in SALES_DOCUMENT_CONFIGS) return tipoParam;
      if (isPurchaseMode && tipoParam in PURCHASE_DOCUMENT_CONFIGS) return tipoParam;
    }
    return 'factura';
  };

  const [documentType, setDocumentType] = useState<DocumentType>(getInitialTab());

  // Verificar estado del Set de Pruebas y preferencia de facturacion electronica
  React.useEffect(() => {
    const checkStatus = async () => {
      if (isPurchaseMode) {
        setNeedsElectronicInvoice(false);
        setCheckingStatus(false);
        return;
      }

      try {
        const { api } = await import('../../../services/api');
        const { jwtDecode } = await import('jwt-decode');
        const { getToken } = await import('../../../services/auth');

        const token = getToken();
        if (token) {
          const decoded: any = jwtDecode(token);
          const tenantId = decoded?.user?.tenant_id || decoded?.tenant_id;
          if (tenantId) {
            try {
              const tenantRes = await api.get(`/tenants/${tenantId}`);
              const needsInvoice = tenantRes.data?.needs_electronic_invoice;
              setNeedsElectronicInvoice(needsInvoice);

              // Si ya existen datos fiscales minimos, inferimos que el usuario quiere
              // avanzar con el set de pruebas aunque aun no haya guardado la preferencia.
              if (needsInvoice === null || needsInvoice === undefined) {
                const hasTaxSetup = Boolean(
                  tenantRes.data?.tax_id &&
                  tenantRes.data?.business_name &&
                  tenantRes.data?.tax_id_type
                );

                if (hasTaxSetup) {
                  setNeedsElectronicInvoice(true);
                } else {
                  Swal.fire({
                    icon: 'info',
                    title: 'Configura tu facturacion',
                    text: 'Primero completa NIT, razon social y tipo de identificacion en Configuracion.',
                    confirmButtonText: 'Ir a Configuracion',
                    confirmButtonColor: '#6366f1',
                  }).then(() => {
                    navigate('/settings');
                  });
                  setCheckingStatus(false);
                  return;
                }
              }

              // If false, go directly to factura (no need to check test set)
              if (needsInvoice === false && !tipoParam) {
                setDocumentType('factura');
              }
            } catch (e) {
              console.error('Error cargando tenant:', e);
            }
          }
        }

        const response = await api.get('/alegra/test-set/status');
        if (response.data?.success) {
          setTestSetCompleted(response.data.isCompleted || false);
          setTestSetStatus(response.data.status || 'PENDIENTE');

          // If test set is approved and no tipo param, go to factura
          if (response.data.status === 'APROBADO' && !tipoParam) {
            setDocumentType('factura');
          }
        }
      } catch (e) {
        console.error('Error verificando estado:', e);
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
  }, [isPurchaseMode, navigate, tipoParam]);

  const handleElectronicInvoiceDecision = (needs: boolean) => {
    setNeedsElectronicInvoice(needs);
    if (!needs) {
      setDocumentType('factura');
      window.history.replaceState({}, '', `${baseCreatePath}?tipo=factura`);
    }
  };

  React.useEffect(() => {
    if (testSetStatus !== 'ENVIADO' && testSetStatus !== 'APROBADO') return;

    const checkTestSetStatus = async () => {
      try {
        const { api } = await import('../../../services/api');
        const response = await api.get('/alegra/test-set/status');
        if (response.data?.success) {
          setTestSetCompleted(response.data.isCompleted || false);
          setTestSetStatus(response.data.status || 'PENDIENTE');
        }
      } catch (e) {
        console.error('Error verificando estado:', e);
      }
    };

    const intervalId = setInterval(checkTestSetStatus, 30000);
    return () => clearInterval(intervalId);
  }, [testSetStatus]);

  const handleTabChange = (type: DocumentType) => {
    if (isPurchaseMode) {
      setDocumentType(type);
      window.history.replaceState({}, '', `${baseCreatePath}?tipo=${type}`);
      return;
    }

    // If electronic invoicing is off or test set is approved, allow all tabs freely
    if (needsElectronicInvoice === false || testSetStatus === 'APROBADO') {
      setDocumentType(type);
      window.history.replaceState({}, '', `${baseCreatePath}?tipo=${type}`);
      return;
    }

    const canUseAllDocuments = testSetCompleted || testSetStatus === 'ENVIADO' || testSetStatus === 'APROBADO';

    // If needs electronic but not approved, only allow cotizacion/remision/pago freely
    // Facturas, notas debito/credito need DIAN approval
    if (needsElectronicInvoice === true && !canUseAllDocuments) {
      const freeDocuments: DocumentType[] = ['cotizacion', 'remision', 'pago', 'set-pruebas'];
      if (!freeDocuments.includes(type)) {
        Swal.fire({
          icon: 'warning',
          title: 'Facturacion electronica pendiente',
          html: 'Las facturas y notas requieren aprobacion del set de pruebas DIAN.<br><br>Puedes crear cotizaciones y remisiones mientras tanto.',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#6366f1',
        });
        return;
      }
    }

    if (!canUseAllDocuments && type !== 'set-pruebas' && !effectiveTestMode) {
      Swal.fire({
        icon: 'warning',
        title: 'Set de Pruebas Pendiente',
        text: 'Debes completar el Set de Pruebas antes de poder usar otros tipos de documentos.',
        confirmButtonText: 'Ir a Set de Pruebas'
      }).then(() => {
        setDocumentType('set-pruebas');
        window.history.replaceState({}, '', `${baseCreatePath}?tipo=set-pruebas`);
      });
      return;
    }
    setDocumentType(type);
    const shouldUseTestMode = effectiveTestMode || testSetStatus === 'ENVIADO';
    const url = shouldUseTestMode ? `${baseCreatePath}?tipo=${type}&test=true` : `${baseCreatePath}?tipo=${type}`;
    window.history.replaceState({}, '', url);
  };

  const currentConfig = isPurchaseMode
    ? PURCHASE_DOCUMENT_CONFIGS[documentType as PurchaseDocumentType]
    : SALES_DOCUMENT_CONFIGS[documentType as SalesDocumentType];

  // Compute which tabs are visible:
  // - Hide 'set-pruebas' if: not needed OR already approved
  const visibleTabs = (isPurchaseMode ? PURCHASE_TAB_ORDER : SALES_TAB_ORDER).filter(type => {
    if (isPurchaseMode) return true;
    if (type === 'set-pruebas') {
      // Hide if electronic invoicing is off
      if (needsElectronicInvoice === false) return false;
      // Hide if test set is already approved (user should go to Settings for this)
      if (testSetStatus === 'APROBADO') return false;
      // Hide if user hasn't decided yet (will be redirected)
      if (needsElectronicInvoice === null) return false;
    }
    return true;
  });

  const isTabDisabled = (type: DocumentType): boolean => {
    if (isPurchaseMode) return false;
    if (needsElectronicInvoice === false) return false;
    if (testSetStatus === 'APROBADO') return false;

    const canUseAllDocuments = testSetCompleted || testSetStatus === 'ENVIADO';
    const documentsInTestSet: DocumentType[] = ['factura', 'nota-credito', 'nota-debito'];
    const disabled = !canUseAllDocuments && type !== 'set-pruebas' &&
      (!effectiveTestMode || !documentsInTestSet.includes(type));
    const testDisabled = effectiveTestMode && type === 'set-pruebas' && testSetStatus !== 'ENVIADO';
    return disabled || testDisabled;
  };

  const isInTestBanner = effectiveTestMode || testSetStatus === 'ENVIADO';

  // Banner for pending electronic invoicing
  const showPendingBanner = needsElectronicInvoice === true &&
    testSetStatus !== 'APROBADO' &&
    testSetStatus !== 'ENVIADO' &&
    !effectiveTestMode;

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <Link
          to="/contabilidad"
          className="inline-flex items-center gap-1.5 text-crumi-text-muted hover:text-crumi-text-primary transition-colors"
        >
          <ArrowLeft className="size-4" />
          Volver a Contabilidad
        </Link>
        <span className="text-crumi-text-muted/40">/</span>
        <Link to="/ingresos/factura-venta" className="text-crumi-text-muted hover:text-crumi-text-primary">
          Facturas de venta
        </Link>
        <span className="text-crumi-text-muted/40">/</span>
        <span className="text-crumi-text-primary font-medium">Nueva factura</span>
      </div>
    <div className="min-h-full">
      {/* Pending electronic invoicing banner */}
      {!isPurchaseMode && showPendingBanner && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Settings size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 flex-1">
            Facturacion electronica pendiente de configuracion. Completa el proceso en Configuracion para emitir facturas ante la DIAN.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Ir a Configuracion
          </button>
        </div>
      )}

      {/* Test mode banner */}
      {!isPurchaseMode && isInTestBanner && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex-1">
            {testSetStatus === 'ENVIADO'
              ? 'Modo Prueba (Sandbox): puedes probar mientras esperas aprobación DIAN'
              : 'Modo Prueba: Estas creando documentos para el Set de Pruebas DIAN'}
          </p>
          {testSetStatus !== 'ENVIADO' && (
            <button
              onClick={() => { window.location.href = '/ingresos/nuevo?tipo=set-pruebas'; }}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Volver a Set de Pruebas
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 crumi-scrollbar">
        {visibleTabs.map(type => {
          const Icon = isPurchaseMode
            ? PURCHASE_TAB_ICONS[type as PurchaseDocumentType]
            : SALES_TAB_ICONS[type as SalesDocumentType];
          const colors = isPurchaseMode
            ? PURCHASE_TAB_COLORS[type as PurchaseDocumentType]
            : SALES_TAB_COLORS[type as SalesDocumentType];
          const config = isPurchaseMode
            ? PURCHASE_DOCUMENT_CONFIGS[type as PurchaseDocumentType]
            : SALES_DOCUMENT_CONFIGS[type as SalesDocumentType];
          const isActive = documentType === type;
          const disabled = isTabDisabled(type);
          const showTestBadge = isInTestBanner && !disabled && type !== 'set-pruebas';

          return (
            <button
              key={type}
              onClick={() => handleTabChange(type)}
              disabled={disabled}
              title={disabled ? 'Completa el Set de Pruebas primero' : config.title}
              className={`
                relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap
                transition-all duration-200 shrink-0
                ${isActive
                  ? `${colors.active} text-white shadow-md`
                  : disabled
                    ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                    : 'bg-white dark:bg-crumi-surface-dark text-crumi-text-primary dark:text-crumi-text-dark-primary border border-gray-100 dark:border-gray-700/50 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600'
                }
              `}
            >
              <Icon size={16} className={isActive ? 'text-white' : disabled ? '' : colors.icon} />
              <span>{config.title}</span>
              {disabled && <Lock size={12} className="ml-0.5" />}
              {showTestBadge && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1.5 right-1.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-crumi-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
        {checkingStatus ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-crumi-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-crumi-text-muted dark:text-crumi-text-dark-muted">
                Verificando estado...
              </p>
            </div>
          </div>
        ) : (
          <>
            {!isPurchaseMode && documentType === 'set-pruebas' && <SetPruebasTab config={currentConfig} onElectronicInvoiceDecision={handleElectronicInvoiceDecision} />}
            {!isPurchaseMode && documentType === 'factura' && <FacturaTab config={currentConfig} isTestMode={effectiveTestMode || testSetStatus === 'ENVIADO'} />}
            {!isPurchaseMode && documentType === 'cotizacion' && <CotizacionTab config={currentConfig} isTestMode={effectiveTestMode || testSetStatus === 'ENVIADO'} />}
            {!isPurchaseMode && documentType === 'remision' && <RemisionTab config={currentConfig} isTestMode={effectiveTestMode || testSetStatus === 'ENVIADO'} />}
            {!isPurchaseMode && documentType === 'nota-debito' && <NotaDebitoTab config={currentConfig} isTestMode={effectiveTestMode || testSetStatus === 'ENVIADO'} />}
            {!isPurchaseMode && documentType === 'nota-credito' && <NotaCreditoTab config={currentConfig} isTestMode={effectiveTestMode || testSetStatus === 'ENVIADO'} />}
            {!isPurchaseMode && documentType === 'pago' && <PagoTab config={currentConfig} isTestMode={effectiveTestMode || testSetStatus === 'ENVIADO'} />}
            {isPurchaseMode && documentType !== 'pago' && <CompraTab config={currentConfig} documentType={documentType as PurchaseDocumentType} />}
            {isPurchaseMode && documentType === 'pago' && <PagoProveedorTab config={currentConfig} />}
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default Create;
