import { useMemo } from 'react';
import { env } from '../../env';

export const API_BASE = env.API_URL;
export const API_ROOT = API_BASE.replace(/\/accounting.*/, '').replace(/\/$/, '');

export type Account = { id: number; code: string; name: string; account_type?: string };
export type ThirdParty = { id: number; name: string; document_number: string; kind?: string; roles?: string[] };

// El backend devuelve `account_code`/`account_name` (columnas DB).
// La UI usa `code`/`name`. Este helper normaliza aceptando cualquiera de los dos.
export const normalizeAccount = (a: any): Account => ({
  id: a.id,
  code: a.code ?? a.account_code ?? '',
  name: a.name ?? a.account_name ?? '',
  account_type: a.account_type,
});

export const money = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const useAuthHeaders = () => {
  const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
  return useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);
};

export const accountTypeColor = (t?: string) => {
  const map: Record<string, string> = {
    ACTIVO: 'primary', PASIVO: 'danger', PATRIMONIO: 'success',
    INGRESO: 'info', GASTO: 'warning', COSTO: 'secondary',
  };
  return map[t || ''] || 'light';
};
