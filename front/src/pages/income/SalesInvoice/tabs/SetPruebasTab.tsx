// SetPruebasTab.tsx - Alegra integration for test set management
import React, { useState, useEffect, useCallback } from 'react';
import { DocumentConfig } from '../Create';
import { api } from '../../../../services/api';
import { jwtDecode } from 'jwt-decode';
import { getToken } from '../../../../services/auth';
import Swal from 'sweetalert2';
import { getCrumiFormStyles } from '../crumiFormStyles';

interface SetPruebasTabProps {
  config: DocumentConfig;
  onElectronicInvoiceDecision?: (needs: boolean) => void;
}

type TestSetState = 'PENDIENTE' | 'ENVIADO' | 'APROBADO' | 'SIN_DATOS';

const SetPruebasTab: React.FC<SetPruebasTabProps> = ({ config, onElectronicInvoiceDecision }) => {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<TestSetState>('PENDIENTE');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [testSetId, setTestSetId] = useState('');
  const [sandboxMode, setSandboxMode] = useState(true);

  const getTenantId = (): string | null => {
    try {
      const token = getToken();
      if (!token) return null;
      const decoded: any = jwtDecode(token);
      return decoded?.user?.tenant_id || decoded?.tenant_id || null;
    } catch {
      return null;
    }
  };

  const checkStatus = useCallback(async () => {
    try {
      const tenantId = getTenantId();
      if (!tenantId) {
        setLoading(false);
        return;
      }

      const tenantResponse = await api.get(`/tenants/${tenantId}`);
      const data = tenantResponse.data;
      const configResponse = await api.get('/alegra/config').catch(() => ({ data: { config: { sandboxMode: true } } }));
      setSandboxMode(Boolean(configResponse.data?.config?.sandboxMode));

      const missing: string[] = [];
      if (!data.tax_id) missing.push('NIT/Identificacion');
      if (!data.business_name) missing.push('Razon Social');
      if (!data.tax_id_type) missing.push('Tipo de Identificacion');
      setMissingFields(missing);

      if (missing.length > 0) {
        setStatus('SIN_DATOS');
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/alegra/test-set/status');
        if (response.data?.success) {
          const newStatus = response.data.status || 'PENDIENTE';
          setStatus(newStatus as TestSetState);
          setTestSetId(response.data.testSetId || '');

          if (newStatus === 'APROBADO') {
            Swal.fire({
              icon: 'success',
              title: 'Habilitado!',
              text: 'Tu empresa ya está habilitada para facturar electrónicamente ante la DIAN.',
              confirmButtonText: 'Empezar a facturar'
            });
          }
        }
      } catch (e) {
        setStatus('PENDIENTE');
      }
    } catch (e) {
      console.error('Error verificando estado:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleSendTestInvoice = async () => {
    if (!sandboxMode && !testSetId.trim()) {
      Swal.fire({ icon: 'warning', title: 'Falta el TestSetID', text: 'Ingresa el código del set de pruebas entregado por la DIAN.' });
      return;
    }

    setSending(true);
    try {
      const response = await api.post('/alegra/test-set/send', { testSetId: testSetId.trim() });
      if (response.data?.success) {
        Swal.fire({
          icon: 'success',
          title: 'Enviado!',
          text: 'Set de pruebas enviado a la DIAN.',
        });
        setStatus('ENVIADO');
      } else {
        throw new Error(response.data?.error || 'Error al enviar');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo enviar.';
      Swal.fire({
        icon: 'error',
        title: 'Error al enviar',
        text: msg
      });
    } finally {
      setSending(false);
    }
  };

  const handleMarkApproved = async () => {
    setSending(true);
    try {
      const response = await api.get('/alegra/test-set/status');
      if (response.data?.success) {
        setStatus((response.data.status || 'PENDIENTE') as TestSetState);
        Swal.fire({
          icon: 'success',
          title: response.data.status === 'APROBADO' ? 'Habilitado!' : 'Estado actualizado',
          text: response.data.status === 'APROBADO'
            ? 'Set de pruebas aprobado. Ya puedes facturar electrónicamente.'
            : `Estado actual: ${response.data.status || 'PENDIENTE'}.`,
        });
      }
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: e?.response?.data?.error || 'No se pudo actualizar.' });
    } finally {
      setSending(false);
    }
  };

  const s = getCrumiFormStyles(loading || sending);

  // Detect dark mode for adaptive variant boxes (warning/success/danger)
  const dk = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Variant boxes — re-using s.infoBox shape but recoloring per state.
  // Warning (pendiente / enviado)
  const warningBox: React.CSSProperties = {
    padding: '20px',
    borderRadius: '12px',
    backgroundColor: dk ? 'rgba(252, 211, 77, 0.08)' : '#fef3c7',
    border: `1px solid ${dk ? 'rgba(252, 211, 77, 0.25)' : '#fcd34d'}`,
    color: dk ? '#fcd34d' : '#92400e',
    marginBottom: '20px',
    textAlign: 'center' as const,
  };
  const dangerBox: React.CSSProperties = {
    padding: '20px',
    borderRadius: '12px',
    backgroundColor: dk ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
    border: `1px solid ${dk ? 'rgba(239, 68, 68, 0.25)' : '#fecaca'}`,
    color: dk ? '#fca5a5' : '#7f1d1d',
    marginBottom: '20px',
    textAlign: 'center' as const,
  };
  const successBox: React.CSSProperties = {
    padding: '20px',
    borderRadius: '12px',
    backgroundColor: dk ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5',
    border: `1px solid ${dk ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0'}`,
    color: dk ? '#6ee7b7' : '#065f46',
    marginBottom: '20px',
    textAlign: 'center' as const,
  };

  // Centered narrow column inside the body
  const centerCol: React.CSSProperties = {
    maxWidth: '600px',
    margin: '0 auto',
  };

  const iconStyle: React.CSSProperties = { fontSize: '40px', marginBottom: '12px' };
  const cardTitleStyle: React.CSSProperties = { fontSize: '18px', fontWeight: 700, marginBottom: '8px' };
  const cardTextStyle: React.CSSProperties = { fontSize: '14px', margin: 0, lineHeight: 1.5 };

  // Title / subtitle reusing Crumi tokens via sectionTitle for the title.
  const titleStyle: React.CSSProperties = {
    ...(s.sectionTitle as React.CSSProperties),
    justifyContent: 'center',
    fontSize: '20px',
    marginBottom: '6px',
  };
  const subtitleStyle: React.CSSProperties = {
    fontSize: '13px',
    color: dk ? '#9A9FA5' : '#6b7280',
    textAlign: 'center' as const,
    marginBottom: '24px',
  };

  // ============ LOADING ============
  if (loading) {
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <div style={s.body}>
            <div style={{ ...centerCol, textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>&#8987;</div>
              <p style={{ color: dk ? '#9A9FA5' : '#6b7280', margin: 0 }}>Verificando estado...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ SIN_DATOS ============
  if (status === 'SIN_DATOS') {
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <div style={s.body}>
            <div style={centerCol}>
              <div style={titleStyle}>Set de Pruebas DIAN</div>
              <div style={subtitleStyle}>
                Antes de enviar el set de pruebas, completa la información de tu empresa
              </div>

              <div style={dangerBox}>
                <div style={iconStyle}>&#9888;&#65039;</div>
                <div style={cardTitleStyle}>Datos Incompletos</div>
                <p style={cardTextStyle}>La DIAN requiere la siguiente información:</p>
                <ul style={{ textAlign: 'left', marginTop: '12px', paddingLeft: '24px', fontWeight: 500 }}>
                  {missingFields.map((field, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{field}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <a
                  href="/settings"
                  style={{
                    ...(s.btnPrimary as React.CSSProperties),
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span>&#9881;&#65039;</span> Ir a Configuración
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ APROBADO ============
  if (status === 'APROBADO') {
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <div style={s.body}>
            <div style={centerCol}>
              <div style={successBox}>
                <div style={iconStyle}>&#9989;</div>
                <div style={cardTitleStyle}>¡Ya estás habilitado!</div>
                <p style={cardTextStyle}>
                  Tu empresa completó el Set de Pruebas y está habilitada para facturar electrónicamente ante la DIAN.
                  <br /><br />
                  Todos los tipos de documentos están disponibles. Selecciona cualquier pestaña para empezar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ ENVIADO ============
  if (status === 'ENVIADO') {
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <div style={s.body}>
            <div style={centerCol}>
              <div style={warningBox}>
                <div style={iconStyle}>&#8987;</div>
                <div style={cardTitleStyle}>Documentos de Prueba Enviados</div>
                <p style={cardTextStyle}>
                  Los documentos de prueba fueron enviados a la DIAN.
                  Verifica en el portal de la DIAN si fueron aprobados.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  style={{ ...(s.btnPrimary as React.CSSProperties), flex: 1 }}
                  onClick={handleMarkApproved}
                  disabled={sending}
                >
                  {sending ? 'Actualizando...' : 'Marcar como aprobado'}
                </button>
                <button
                  style={{ ...(s.btnSecondary as React.CSSProperties), flex: 1 }}
                  onClick={handleSendTestInvoice}
                  disabled={sending}
                >
                  Enviar otra prueba
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ PENDIENTE ============
  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.body}>
          <div style={centerCol}>
            <div style={titleStyle}>Set de Pruebas DIAN</div>
            <div style={subtitleStyle}>
              {sandboxMode
                ? 'Envía documentos de prueba a la DIAN (modo sandbox)'
                : 'Envía documentos de prueba a la DIAN'}
            </div>

            <div style={warningBox}>
              <div style={iconStyle}>&#128203;</div>
              <div style={cardTitleStyle}>Pendiente de Habilitación</div>
              <p style={cardTextStyle}>
                Asegúrate de haber registrado tu empresa en Configuración y pega aquí el TestSetID de la DIAN.
              </p>
            </div>

            {!sandboxMode && (
              <div style={{ ...(s.formField as React.CSSProperties), marginBottom: '14px' }}>
                <label style={s.label}>TestSetID DIAN</label>
                <input
                  type="text"
                  value={testSetId}
                  onChange={(e) => setTestSetId(e.target.value)}
                  placeholder="TestSetID DIAN"
                  style={s.input}
                />
              </div>
            )}

            <button
              style={{ ...(s.btnPrimary as React.CSSProperties), width: '100%', padding: '12px 24px' }}
              onClick={handleSendTestInvoice}
              disabled={sending}
            >
              {sending ? 'Enviando...' : 'Enviar factura de prueba'}
            </button>

            <p style={{ fontSize: '13px', color: dk ? '#9A9FA5' : '#6b7280', marginTop: '14px', textAlign: 'center' }}>
              Verifica el estado en el{' '}
              <a
                href="https://catalogo-vpfe-hab.dian.gov.co/User/Login"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: dk ? '#8B5CF6' : '#00bfa5', fontWeight: 600 }}
              >
                portal DIAN
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetPruebasTab;
