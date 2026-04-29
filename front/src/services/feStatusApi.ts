// src/services/feStatusApi.ts
import api from "./api";

export type FeMissing = "company" | "test_set" | "resolution" | "resolution_muisca" | "fe_enabled";
export type PayrollMissing = "company" | "test_set" | "alegra_token" | "payroll_api" | "employees";

export interface PayrollStatus {
  provider: string;
  ready: boolean;
  missing: PayrollMissing[];
  company_configured: boolean;
  test_set_ok: boolean;
  token_configured: boolean;
  api_path_configured: boolean;
  active_employees: number;
  documents_count: number;
}

export interface FeStatus {
  provider: "alegra" | "aliaddo" | "none";
  needs_fe: boolean;
  fe_enabled: boolean;
  ready: boolean;
  missing: FeMissing[];
  company: { configured: boolean };
  test_set: { configured: boolean; status: string | null; ok: boolean };
  resolution: {
    configured: boolean;
    prefix: string | null;
    range_start: number | string | null;
    range_end: number | string | null;
    valid_until: string | null;
    vigente: boolean;
    ok: boolean;
    muisca_linked?: boolean | null;
  };
  payroll: PayrollStatus;
}

export const getFeStatus = () => api.get<FeStatus>("/fe-status");
