import { useMemo } from 'react';
import { env } from '../../env';

export const API_BASE = env.API_URL;

export const money = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const useAuthHeaders = () => {
  const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
  return useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);
};

export type Lead = {
  id: number | string;
  name?: string;
  title?: string;
  stage?: string;
  value?: number | string;
  amount?: number | string;
  customer?: string;
  client?: string;
  expected_close?: string;
  close_date?: string;
};

export type Quote = {
  id: number | string;
  number?: string;
  quote_number?: string;
  customer?: string;
  customer_name?: string;
  third_party_name?: string;
  date?: string;
  created_at?: string;
  total?: number | string;
  amount?: number | string;
  status?: string;
};

export type Invoice = {
  id: number | string;
  number?: string;
  invoice_number?: string;
  customer?: string;
  customer_name?: string;
  third_party_name?: string;
  date?: string;
  issue_date?: string;
  total?: number | string;
  amount?: number | string;
  cufe?: string;
  dian_status?: string;
  status?: string;
};

export type Customer = {
  id: number | string;
  name: string;
  document_number?: string;
  nit?: string;
  email?: string;
  phone?: string;
  city?: string;
  kind?: string;
};

export const tryFetchJson = async (urls: string[], headers: Record<string, string>) => {
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        return { ok: true, data, url };
      }
    } catch (e) {
      // try next
    }
  }
  return { ok: false, data: null, url: null };
};

export const extractArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.leads)) return data.leads;
  if (Array.isArray(data.opportunities)) return data.opportunities;
  if (Array.isArray(data.quotes)) return data.quotes;
  if (Array.isArray(data.cotizaciones)) return data.cotizaciones;
  if (Array.isArray(data.invoices)) return data.invoices;
  if (Array.isArray(data.facturas)) return data.facturas;
  if (Array.isArray(data.customers)) return data.customers;
  if (Array.isArray(data.clientes)) return data.clientes;
  if (Array.isArray(data.thirdParties)) return data.thirdParties;
  if (Array.isArray(data.third_parties)) return data.third_parties;
  return [];
};

export const STAGES = [
  { key: 'NEW', label: 'Nuevo', color: 'secondary' },
  { key: 'CONTACTED', label: 'Contactado', color: 'info' },
  { key: 'QUALIFIED', label: 'Calificado', color: 'primary' },
  { key: 'PROPOSAL', label: 'Propuesta', color: 'warning' },
  { key: 'WON', label: 'Cerrado ganado', color: 'success' },
  { key: 'LOST', label: 'Cerrado perdido', color: 'danger' },
];

export const normalizeStage = (s?: string): string => {
  if (!s) return 'NEW';
  const u = s.toUpperCase();
  if (u.includes('NUEV') || u.includes('NEW')) return 'NEW';
  if (u.includes('CONTACT')) return 'CONTACTED';
  if (u.includes('CALIF') || u.includes('QUALIF')) return 'QUALIFIED';
  if (u.includes('PROPU') || u.includes('PROPOS')) return 'PROPOSAL';
  if (u.includes('GAN') || u.includes('WON')) return 'WON';
  if (u.includes('PERD') || u.includes('LOST')) return 'LOST';
  return u;
};
