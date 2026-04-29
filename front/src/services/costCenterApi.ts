// src/services/costCenterApi.ts
import api from "./api";

export interface CostCenter {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

export const getCostCenters = () => api.get<CostCenter[]>("/cost-centers");
export const createCostCenter = (data: { code: string; name: string; description?: string }) =>
  api.post<CostCenter>("/cost-centers", data);
export const updateCostCenter = (id: number, data: Partial<CostCenter>) =>
  api.put<CostCenter>(`/cost-centers/${id}`, data);
export const deleteCostCenter = (id: number) => api.delete(`/cost-centers/${id}`);
