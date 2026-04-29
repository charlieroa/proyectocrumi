import { useMemo } from 'react';
import { env } from '../../env';

export const API_BASE = env.API_URL;

export const money = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const useAuthHeaders = () => {
  const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
  return useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);
};

export const statusColor = (s?: string) => {
  const map: Record<string, string> = {
    draft: 'secondary', open: 'info', liquidated: 'primary',
    approved: 'success', closed: 'dark', rejected: 'danger',
    pending: 'warning', prepared: 'info', synced: 'success',
  };
  return map[(s || '').toLowerCase()] || 'light';
};

export const fmtDate = (d?: string | null) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('es-CO'); } catch { return String(d); }
};
