import { api } from './api';

export const createInvoice = async (invoiceData: any) => {
    const response = await api.post('/invoices', invoiceData);
    return response.data;
};

export const getClients = async (tenantId: string) => {
    // Usamos la ruta que ya tienes para traer clientes
    const response = await api.get(`/users/tenant/${tenantId}/clients`);
    return response.data;
};

// Mock para buscar productos (luego lo conectas a tu endpoint real de productos)
export const searchProducts = async (query: string) => {
    // Aquí llamarías a: await api.get(`/products?search=${query}`);
    return [];
};