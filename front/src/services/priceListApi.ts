// src/services/priceListApi.ts
import api from "./api";

export interface PriceList {
  id: number;
  tenant_id: number;
  name: string;
  position: number;
  is_active: boolean;
}

export const getPriceLists = () => api.get<PriceList[]>("/price-lists");
export const createPriceList = (data: { name: string; position?: number }) =>
  api.post<PriceList>("/price-lists", data);
export const updatePriceList = (id: number, data: Partial<Pick<PriceList, "name" | "position" | "is_active">>) =>
  api.put<PriceList>(`/price-lists/${id}`, data);
export const deletePriceList = (id: number) => api.delete(`/price-lists/${id}`);
