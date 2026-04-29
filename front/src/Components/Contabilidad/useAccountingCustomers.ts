// Hook para cargar clientes desde el módulo contable (third_parties).
// Reemplaza el viejo `getContacts` que apuntaba a la tabla `users` rol=4 (CRM legacy).
// Los formularios de SalesInvoice (Factura, Cotización, Nota Crédito/Débito,
// Pago, Remisión) crean clientes en `third_parties` pero antes leían desde `users`,
// por eso el dropdown salía vacío.
//
// Los aliases (first_name, last_name, street, mobile, id_number, etc.) se mantienen
// para no tocar los tabs que ya hacen `client.first_name || client.last_name`.

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';

export type AccountingCustomer = {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  identification: string;
  id_number: string;
  document_number: string;
  document_type: string;
  email: string;
  phone: string;
  mobile: string;
  address: string;
  street: string;
  city: string;
  department: string;
  dv: string;
  raw: any;
};

const splitName = (full: string): { first: string; last: string } => {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
};

const normalize = (tp: any): AccountingCustomer => {
  const { first, last } = splitName(tp?.name || '');
  const phone = tp?.phone || '';
  const address = tp?.address || '';
  const docNumber = tp?.document_number || '';
  return {
    id: String(tp?.id ?? ''),
    name: tp?.name || '',
    first_name: first,
    last_name: last,
    identification: docNumber,
    id_number: docNumber,
    document_number: docNumber,
    document_type: tp?.document_type || 'CC',
    email: tp?.email || '',
    phone,
    mobile: phone,
    address,
    street: address,
    city: tp?.city || '',
    department: tp?.department || '',
    dv: tp?.dv || '',
    raw: tp,
  };
};

const isCustomer = (tp: any): boolean =>
  tp?.kind === 'CUSTOMER' || (Array.isArray(tp?.roles) && tp.roles.includes('CUSTOMER'));

export function useAccountingCustomers() {
  const [customers, setCustomers] = useState<AccountingCustomer[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/accounting/third-parties');
      const list: any[] = data?.thirdParties || data?.data || [];
      setCustomers(list.filter(isCustomer).map(normalize));
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { customers, loading, refresh };
}

export default useAccountingCustomers;
