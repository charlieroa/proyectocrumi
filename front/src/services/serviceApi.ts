// src/services/serviceApi.ts
import api from "./api";
import type { ItemPrice } from "./productApi";

export interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  duration_minutes?: number;
  category_id?: string;
  category_name?: string;
  commission_percent?: number;
  dian_uom_code?: string;
  tax_rate?: number;
  retention_rate?: number;
  tax_charge_id?: number | null;
  visible_in_invoices?: boolean;
  include_iva_in_price?: boolean;
  image_url?: string;
  is_active?: boolean;
  prices?: ItemPrice[];
}

const tenantPath = (tenantId: string | number) => `/services/tenant/${tenantId}`;

export const getServicesByTenant = (tenantId: string | number) =>
  api.get<ServiceItem[]>(tenantPath(tenantId));

export const getService = (id: string | number) =>
  api.get<ServiceItem>(`/services/${id}`);

export const createService = (data: Omit<ServiceItem, "id">) =>
  api.post<ServiceItem>("/services", data);

export const updateService = (id: string | number, data: Partial<ServiceItem>) =>
  api.put<ServiceItem>(`/services/${id}`, data);

export const deleteService = (id: string | number) =>
  api.delete(`/services/${id}`);

export const uploadServiceImage = (id: string | number, imageFile: File) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  return api.post<ServiceItem>(`/services/${id}/image`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
