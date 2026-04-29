import { useMemo } from 'react';
import { env } from '../../env';

export const API_BASE = env.API_URL;

export type ThirdPartyKind = 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE' | 'OTHER';

export type ThirdParty = {
  id: number | string;
  name: string;
  document_type?: string;
  document_number: string;
  kind?: ThirdPartyKind | string;
  roles?: string[];
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  department?: string;
};

export type ThirdPartySummary = {
  total: number;
  byKind: {
    CUSTOMER: number;
    SUPPLIER: number;
    EMPLOYEE: number;
    OTHER: number;
  };
};

export const money = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const useAuthHeaders = () => {
  const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
  return useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);
};

export const kindLabel = (k?: string) => {
  const map: Record<string, string> = {
    CUSTOMER: 'Cliente',
    SUPPLIER: 'Proveedor',
    EMPLOYEE: 'Empleado',
    OTHER: 'Otro',
  };
  return map[k || ''] || (k || '-');
};

export const kindColor = (k?: string) => {
  const map: Record<string, string> = {
    CUSTOMER: 'primary',
    SUPPLIER: 'warning',
    EMPLOYEE: 'success',
    OTHER: 'secondary',
  };
  return map[k || ''] || 'light';
};
