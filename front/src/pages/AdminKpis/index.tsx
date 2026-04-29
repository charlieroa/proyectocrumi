import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface KpiData {
  overview: { tenants: number; users: number; thirdParties: number; employees: number };
  documents: {
    invoices: number; invoicesLast30Days: number; totalRevenue: number;
    quotes: number; creditNotes: number; debitNotes: number;
    remissions: number; paymentReceipts: number; accountsPayable: number; manualVouchers: number;
  };
  payroll: { employees: number; periods: number };
  recentInvoices: Array<{ id: number; invoice_number: string; client_name: string; total: number; created_at: string; tenant_name: string }>;
  tenantActivity: Array<{ id: number; business_name: string; created_at: string; user_count: number; invoice_count: number; total_revenue: number }>;
}

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);

const StatCard: React.FC<{ label: string; value: string; sub?: string; color: string }> = ({ label, value, sub, color }) => (
  <div className={`rounded-2xl p-5 bg-gradient-to-br ${color} text-white`}>
    <p className="text-sm font-medium opacity-80">{label}</p>
    <p className="text-2xl font-bold mt-1">{value}</p>
    {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
  </div>
);

const AdminKpisPage: React.FC = () => {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'KPIs de Uso | Bolti Admin';
    api.get('/kpis/platform')
      .then((res) => setData(res.data))
      .catch((err) => console.error('Error cargando KPIs:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-crumi-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-crumi-text-muted">
        Error cargando KPIs
      </div>
    );
  }

  const totalDocs = data.documents.invoices + data.documents.quotes + data.documents.creditNotes +
    data.documents.debitNotes + data.documents.remissions + data.documents.paymentReceipts +
    data.documents.accountsPayable + data.documents.manualVouchers;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 overflow-y-auto h-full crumi-scrollbar">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">KPIs de Uso - Plataforma</h1>
        <p className="text-sm text-crumi-text-muted dark:text-crumi-text-dark-muted">Vista general de toda la actividad</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Empresas" value={fmtNum(data.overview.tenants)} color="from-violet-500 to-purple-600" />
        <StatCard label="Usuarios" value={fmtNum(data.overview.users)} color="from-blue-500 to-blue-600" />
        <StatCard label="Terceros" value={fmtNum(data.overview.thirdParties)} color="from-emerald-500 to-emerald-600" />
        <StatCard label="Empleados" value={fmtNum(data.overview.employees)} color="from-amber-500 to-amber-600" />
      </div>

      {/* Document KPIs */}
      <div>
        <h2 className="text-lg font-bold dark:text-white mb-3">Documentos</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Facturas" value={fmtNum(data.documents.invoices)} sub={`${fmtNum(data.documents.invoicesLast30Days)} ultimos 30 dias`} color="from-slate-600 to-slate-700" />
          <StatCard label="Facturacion Total" value={fmt(data.documents.totalRevenue)} color="from-green-500 to-green-600" />
          <StatCard label="Cotizaciones" value={fmtNum(data.documents.quotes)} color="from-sky-500 to-sky-600" />
          <StatCard label="Notas Credito" value={fmtNum(data.documents.creditNotes)} color="from-rose-500 to-rose-600" />
          <StatCard label="Notas Debito" value={fmtNum(data.documents.debitNotes)} color="from-orange-500 to-orange-600" />
          <StatCard label="Remisiones" value={fmtNum(data.documents.remissions)} color="from-teal-500 to-teal-600" />
          <StatCard label="Recibos de Pago" value={fmtNum(data.documents.paymentReceipts)} color="from-indigo-500 to-indigo-600" />
          <StatCard label="Cuentas por Pagar" value={fmtNum(data.documents.accountsPayable)} color="from-pink-500 to-pink-600" />
          <StatCard label="Comprobantes" value={fmtNum(data.documents.manualVouchers)} color="from-cyan-500 to-cyan-600" />
          <StatCard label="Total Documentos" value={fmtNum(totalDocs)} color="from-gray-700 to-gray-900" />
        </div>
      </div>

      {/* Payroll */}
      <div>
        <h2 className="text-lg font-bold dark:text-white mb-3">Nomina</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Empleados" value={fmtNum(data.payroll.employees)} color="from-amber-500 to-amber-600" />
          <StatCard label="Periodos" value={fmtNum(data.payroll.periods)} color="from-lime-600 to-lime-700" />
        </div>
      </div>

      {/* Tenant Activity Table */}
      <div>
        <h2 className="text-lg font-bold dark:text-white mb-3">Actividad por Empresa</h2>
        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-3 font-semibold dark:text-white">Empresa</th>
                <th className="px-4 py-3 font-semibold dark:text-white text-center">Usuarios</th>
                <th className="px-4 py-3 font-semibold dark:text-white text-center">Facturas</th>
                <th className="px-4 py-3 font-semibold dark:text-white text-right">Facturacion</th>
                <th className="px-4 py-3 font-semibold dark:text-white text-right">Registro</th>
              </tr>
            </thead>
            <tbody>
              {data.tenantActivity.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium dark:text-white">{t.business_name || `Tenant #${t.id}`}</td>
                  <td className="px-4 py-3 text-center text-crumi-text-muted dark:text-crumi-text-dark-muted">{t.user_count}</td>
                  <td className="px-4 py-3 text-center text-crumi-text-muted dark:text-crumi-text-dark-muted">{t.invoice_count}</td>
                  <td className="px-4 py-3 text-right font-mono text-crumi-text-muted dark:text-crumi-text-dark-muted">{fmt(Number(t.total_revenue))}</td>
                  <td className="px-4 py-3 text-right text-crumi-text-muted dark:text-crumi-text-dark-muted">{new Date(t.created_at).toLocaleDateString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Invoices */}
      <div>
        <h2 className="text-lg font-bold dark:text-white mb-3">Ultimas Facturas</h2>
        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left">
                <th className="px-4 py-3 font-semibold dark:text-white">#</th>
                <th className="px-4 py-3 font-semibold dark:text-white">Cliente</th>
                <th className="px-4 py-3 font-semibold dark:text-white">Empresa</th>
                <th className="px-4 py-3 font-semibold dark:text-white text-right">Monto</th>
                <th className="px-4 py-3 font-semibold dark:text-white text-right">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.recentInvoices.map((inv) => (
                <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono text-xs dark:text-white">{inv.invoice_number || inv.id}</td>
                  <td className="px-4 py-3 dark:text-white">{inv.client_name}</td>
                  <td className="px-4 py-3 text-crumi-text-muted dark:text-crumi-text-dark-muted">{inv.tenant_name || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono dark:text-white">{fmt(Number(inv.total))}</td>
                  <td className="px-4 py-3 text-right text-crumi-text-muted dark:text-crumi-text-dark-muted">{new Date(inv.created_at).toLocaleDateString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminKpisPage;
