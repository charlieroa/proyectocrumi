import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, Spinner, Table } from 'reactstrap';
import { env } from '../../../env';

const API_BASE = env.API_URL;

type Props = {
    year: number;
};

const PeriodosTab: React.FC<Props> = ({ year }) => {
    const [loading, setLoading] = useState(false);
    const [periods, setPeriods] = useState<any[]>([]);
    const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const fetchPeriods = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ year: String(year), limit: '100', page: '1' });
            const res = await fetch(`${API_BASE}/nomina/periodos?${params}`, { headers });
            const data = await res.json();
            if (data.success) {
                setPeriods(data.data?.periods || []);
            }
        } catch (error) {
            console.error('[Nomina][PeriodosTab] Error obteniendo periodos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPeriods();
    }, [year]);

    const handleAccount = async (periodId: number) => {
        try {
            const res = await fetch(`${API_BASE}/nomina/periodos/${periodId}/contabilizar`, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'No se pudo contabilizar el periodo');
                return;
            }
            await fetchPeriods();
        } catch (error) {
            console.error('[Nomina][PeriodosTab] Error contabilizando periodo:', error);
        }
    };

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return (
        <Card>
            <CardHeader className="d-flex justify-content-between align-items-center">
                <h6 className="card-title mb-0">Periodos y Contabilizacion</h6>
                <Button color="soft-primary" size="sm" onClick={fetchPeriods}>Actualizar</Button>
            </CardHeader>
            <CardBody>
                {loading ? (
                    <div className="text-center py-4"><Spinner color="primary" /></div>
                ) : (
                    <div className="table-responsive">
                        <Table className="table-hover align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>Periodo</th>
                                    <th>Estado</th>
                                    <th>Contable</th>
                                    <th>Asiento</th>
                                    <th className="text-end">Neto</th>
                                    <th className="text-end">Costo empresa</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {periods.map((period: any) => {
                                    const canAccount = ['preliquidado', 'aprobado', 'transmitido', 'pagado'].includes(String(period.status || '').toLowerCase());
                                    const accountingStatus = period.accounting_status || 'PENDIENTE';
                                    return (
                                        <tr key={period.id}>
                                            <td>
                                                <div className="fw-semibold">{months[Number(period.month) - 1] || `Mes ${period.month}`} {period.year}</div>
                                                <div className="text-muted fs-12">Periodo #{period.period_number || 1}</div>
                                            </td>
                                            <td>
                                                <Badge color={period.status === 'aprobado' ? 'success' : period.status === 'preliquidado' ? 'warning' : 'secondary'}>
                                                    {period.status}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Badge color={accountingStatus === 'CONTABILIZADO' ? 'success' : accountingStatus === 'ERROR' ? 'danger' : 'warning'}>
                                                    {accountingStatus}
                                                </Badge>
                                                {period.accounting_error ? <div className="text-danger fs-12 mt-1">{period.accounting_error}</div> : null}
                                            </td>
                                            <td>
                                                <div className="fw-medium">{period.accounting_journal_number || period.accounting_journal_number_live || '-'}</div>
                                                <div className="text-muted fs-12">{period.accounting_posted_at ? new Date(period.accounting_posted_at).toLocaleString('es-CO') : 'Sin contabilizar'}</div>
                                            </td>
                                            <td className="text-end font-monospace">${Number(period.total_neto || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                            <td className="text-end font-monospace">${Number(period.total_costo_empresa || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                            <td className="text-end">
                                                {canAccount && accountingStatus !== 'CONTABILIZADO' ? (
                                                    <Button color="success" size="sm" onClick={() => handleAccount(period.id)}>
                                                        Contabilizar
                                                    </Button>
                                                ) : (
                                                    <span className="text-muted fs-12">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </div>
                )}
            </CardBody>
        </Card>
    );
};

export default PeriodosTab;
