import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { API_BASE, useAuthHeaders } from './shared';

export type AccountingSettings = Partial<{
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
}>;

const FIELD_LABELS: Record<string, string> = {
  cash_account_code: 'Caja',
  bank_account_code: 'Bancos',
  accounts_receivable_code: 'Clientes (CxC)',
  accounts_payable_code: 'Proveedores (CxP)',
  revenue_account_code: 'Ingresos',
  cost_account_code: 'Costos',
  expense_account_code: 'Gastos',
  vat_generated_code: 'IVA generado',
  vat_deductible_code: 'IVA descontable',
  withholding_source_code: 'Retefuente',
  withholding_ica_code: 'ReteICA',
  withholding_vat_code: 'ReteIVA',
};

const MODULE_REQUIREMENTS: Record<string, (keyof AccountingSettings)[]> = {
  compras: ['accounts_payable_code', 'expense_account_code', 'vat_deductible_code'],
  'documentos-soporte': ['accounts_payable_code', 'expense_account_code', 'withholding_source_code'],
  pagos: ['accounts_payable_code', 'bank_account_code'],
  cobros: ['accounts_receivable_code', 'bank_account_code'],
  ventas: ['accounts_receivable_code', 'revenue_account_code', 'vat_generated_code'],
  'notas-credito': ['accounts_receivable_code', 'revenue_account_code'],
  'notas-debito': ['accounts_receivable_code', 'revenue_account_code'],
};

const MODULE_LABELS: Record<string, string> = {
  compras: 'Facturas de compra',
  'documentos-soporte': 'Documentos soporte',
  pagos: 'Pagos a proveedores',
  cobros: 'Cobros de clientes',
  ventas: 'Facturas de venta',
  'notas-credito': 'Notas crédito',
  'notas-debito': 'Notas débito',
};

type ModuleKey = keyof typeof MODULE_REQUIREMENTS;

let settingsCache: AccountingSettings | null = null;

export const useConfigGuard = (moduleKey: ModuleKey) => {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AccountingSettings | null>(settingsCache);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    if (settingsCache) { setSettings(settingsCache); setChecked(true); return settingsCache; }
    try {
      const res = await fetch(`${API_BASE}/accounting/settings`, { headers });
      const data = await res.json();
      const s: AccountingSettings = data?.settings || data || {};
      settingsCache = s;
      setSettings(s);
      setChecked(true);
      return s;
    } catch {
      setChecked(true);
      return {};
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const missingFields = (s: AccountingSettings | null) => {
    if (!s) return MODULE_REQUIREMENTS[moduleKey];
    return MODULE_REQUIREMENTS[moduleKey].filter(f => !s[f] || String(s[f]).trim() === '');
  };

  const missing = missingFields(settings);
  const ready = checked && missing.length === 0;

  const alertAndGo = useCallback(async (): Promise<boolean> => {
    const s = settings || await load();
    const miss = missingFields(s);
    if (miss.length === 0) return true;

    const list = miss.map(f => `<li><strong>${FIELD_LABELS[f] || f}</strong></li>`).join('');
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Falta configuración contable',
      html: `Para operar <strong>${MODULE_LABELS[moduleKey]}</strong> necesitas configurar estas cuentas del PUC:<ul class="text-start mt-2">${list}</ul><p class="text-muted mt-2 mb-0 fs-12">Lo configuras una vez y nunca más lo tocas.</p>`,
      showCancelButton: true,
      confirmButtonText: 'Ir a configurar',
      cancelButtonText: 'Ahora no',
      confirmButtonColor: '#405189',
    });

    if (result.isConfirmed) {
      navigate('/contabilidad/config/contabilidad-maestra');
      return false;
    }
    return false;
  }, [settings, load, moduleKey, navigate]);

  return { settings, ready, missing, missingLabels: missing.map(f => FIELD_LABELS[f] || f), alertAndGo, reload: () => { settingsCache = null; return load(); } };
};

export const clearConfigCache = () => { settingsCache = null; };
