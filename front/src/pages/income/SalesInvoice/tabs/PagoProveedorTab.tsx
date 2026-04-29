import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentConfig } from '../Create';
import { env } from '../../../../env';
import { getCrumiFormStyles } from '../crumiFormStyles';

interface PagoProveedorTabProps {
  config: DocumentConfig;
}

const today = new Date().toISOString().split('T')[0];

const PagoProveedorTab: React.FC<PagoProveedorTabProps> = ({ config }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingPayables, setLoadingPayables] = useState(true);
  const [payables, setPayables] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    payableId: '',
    amount: '',
    paymentDate: today,
    paymentMethod: 'transferencia',
    bankAccountCode: '',
    notes: '',
  });

  useEffect(() => {
    const loadPayables = async () => {
      setLoadingPayables(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No se encontro el token de autenticacion.');

        const response = await fetch(`${env.API_URL}/accounting/accounts-payable`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'No se pudieron cargar las cuentas por pagar');
        }

        setPayables((data.payables || []).filter((row: any) => Number(row.balance_amount || 0) > 0.009));
      } catch (error) {
        console.error('Error cargando CxP:', error);
      } finally {
        setLoadingPayables(false);
      }
    };

    loadPayables();
  }, []);

  const selectedPayable = useMemo(
    () => payables.find((row) => String(row.id) === String(formData.payableId)),
    [payables, formData.payableId]
  );

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'payableId') {
        const payable = payables.find((row) => String(row.id) === String(value));
        if (payable) {
          next.amount = String(payable.balance_amount || '');
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!formData.payableId || !formData.amount) {
      alert('Selecciona una cuenta por pagar y el monto a aplicar.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No se encontro el token de autenticacion.');

      const response = await fetch(`${env.API_URL}/accounting/accounts-payable/apply-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          payableId: Number(formData.payableId),
          amount: Number(formData.amount),
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          bankAccountCode: formData.bankAccountCode || undefined,
          notes: formData.notes || null,
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'No se pudo aplicar el pago');
      }

      alert(`${config.title} registrado con exito para ${data.payable?.document_number || 'la cuenta por pagar'}`);
      navigate('/gastos/documentos?modulo=gastos&tipo=pagos');
    } catch (error: any) {
      console.error('Error registrando pago de proveedor:', error);
      alert(`Error al guardar:\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const s = getCrumiFormStyles(loading);

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.body}>
          <div style={s.sectionTitle}>Datos del pago</div>

          <div style={s.formGrid}>
            <div style={{ ...s.formField, gridColumn: 'span 2' }}>
              <label style={s.label}>
                Cuenta por pagar <span style={s.required}>*</span>
              </label>
              <select
                style={s.select}
                value={formData.payableId}
                onChange={(e) => handleChange('payableId', e.target.value)}
                disabled={loadingPayables}
              >
                <option value="">{loadingPayables ? 'Cargando...' : 'Selecciona una cuenta por pagar'}</option>
                {payables.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.document_number} - {row.supplier_name} - saldo ${Number(row.balance_amount || 0).toLocaleString('es-CO')}
                  </option>
                ))}
              </select>
            </div>

            <div style={s.formField}>
              <label style={s.label}>
                Fecha pago <span style={s.required}>*</span>
              </label>
              <input
                type="date"
                style={s.input}
                value={formData.paymentDate}
                onChange={(e) => handleChange('paymentDate', e.target.value)}
              />
            </div>

            <div style={s.formField}>
              <label style={s.label}>
                Monto <span style={s.required}>*</span>
              </label>
              <input
                type="number"
                min="0"
                style={s.input}
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
              />
            </div>

            <div style={s.formField}>
              <label style={s.label}>Metodo</label>
              <select
                style={s.select}
                value={formData.paymentMethod}
                onChange={(e) => handleChange('paymentMethod', e.target.value)}
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="consignacion">Consignacion</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>

            <div style={s.formField}>
              <label style={s.label}>Cuenta banco/caja</label>
              <input
                style={s.input}
                value={formData.bankAccountCode}
                onChange={(e) => handleChange('bankAccountCode', e.target.value)}
                placeholder="111005 o 110505"
              />
            </div>
          </div>

          {selectedPayable && (
            <div style={s.infoBox}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.75, marginBottom: '4px' }}>
                    Proveedor
                  </div>
                  <div style={{ fontWeight: 600 }}>{selectedPayable.supplier_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.75, marginBottom: '4px' }}>
                    Documento
                  </div>
                  <div style={{ fontWeight: 600 }}>{selectedPayable.document_number}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.75, marginBottom: '4px' }}>
                    Saldo
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    ${Number(selectedPayable.balance_amount || 0).toLocaleString('es-CO')}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={s.sectionTitle}>Notas</div>
          <div style={s.formField}>
            <textarea
              style={s.textarea}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Observaciones del egreso"
            />
          </div>
        </div>
      </div>

      <div style={s.bottomBar}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            style={s.btnSecondary}
            onClick={() => navigate('/gastos/documentos?modulo=gastos&tipo=pagos')}
          >
            Cancelar
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            style={s.btnPrimary}
            onClick={handleSave}
            disabled={loading || loadingPayables}
          >
            {loading ? 'Guardando...' : `Guardar ${config.title}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PagoProveedorTab;
