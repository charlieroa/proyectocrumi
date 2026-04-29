// src/Components/Common/ComplianceBanner.tsx
// Banner system-wide que avisa si la Facturación Electrónica o la Nómina Electrónica
// no están listas, con CTA al config faltante.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFeStatus, FeStatus } from '../../services/feStatusApi';
import { isAuthenticated } from '../../services/auth';

const SS_KEY = 'crumi-compliance-banner-dismissed-v1';

const labelFE: Record<string, string> = {
  company: 'falta datos de empresa',
  test_set: 'falta set de pruebas',
  resolution: 'falta resolución DIAN',
  fe_enabled: 'falta habilitar FE',
};

const labelPayroll: Record<string, string> = {
  company: 'falta datos de empresa',
  test_set: 'falta set de pruebas',
  alegra_token: 'falta token del proveedor',
  payroll_api: 'falta endpoint de nómina',
  employees: 'sin empleados activos',
};

const ComplianceBanner: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<FeStatus | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem(SS_KEY) === '1';
  });

  useEffect(() => {
    if (!isAuthenticated()) return;
    getFeStatus().then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  if (!status || dismissed) return null;
  if (status.ready && status.payroll.ready) return null; // todo bien
  if (!status.needs_fe && status.payroll.active_employees === 0) return null; // tenant que no usa FE ni nómina

  const dismiss = () => {
    sessionStorage.setItem(SS_KEY, '1');
    setDismissed(true);
  };

  const items: Array<{ kind: 'fe' | 'nom'; text: string; cta: string; to: string }> = [];

  if (status.needs_fe && !status.ready) {
    items.push({
      kind: 'fe',
      text: `Tu Facturación Electrónica no está lista — ${(status.missing || []).map((m) => labelFE[m] || m).join(' · ')}`,
      cta: 'Configurar FE',
      to: '/contabilidad/configurar-fe',
    });
  }

  if (!status.payroll.ready && status.payroll.active_employees > 0) {
    items.push({
      kind: 'nom',
      text: `Tu Nómina Electrónica no está configurada — ${(status.payroll.missing || []).map((m) => labelPayroll[m] || m).join(' · ')}`,
      cta: 'Configurar nómina',
      to: '/nomina-hub/nomina-electronica',
    });
  }

  if (items.length === 0) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #fef3c7 0%, #fde68a 100%)',
        borderBottom: '1px solid #f59e0b',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        color: '#92400e',
      }}
      role="alert"
    >
      <i className="ri-alarm-warning-line" style={{ fontSize: 18 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 280 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, fontSize: 13 }}>{it.text}</span>
            <button
              onClick={() => navigate(it.to)}
              style={{
                padding: '2px 10px',
                background: '#92400e',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {it.cta} →
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={dismiss}
        title="Ocultar por esta sesión"
        style={{
          padding: '4px 8px',
          background: 'transparent',
          color: '#92400e',
          border: 'none',
          cursor: 'pointer',
          fontSize: 18,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
};

export default ComplianceBanner;
