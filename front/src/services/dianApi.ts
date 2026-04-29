// src/services/dianApi.ts
import api from "./api";

export interface DianUom {
  code: string;
  description: string;
}

/** Catálogo oficial DIAN de unidades de medida para productos/servicios */
export const getDianUoms = () => api.get<DianUom[]>("/dian-uom");
