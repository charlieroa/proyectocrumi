import React, { useEffect, useState, useCallback } from 'react';
import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    Col,
    Row,
    Spinner,
    Table
} from 'reactstrap';
import { api } from '../../../services/api';

interface ProviderStatus {
    provider: string;
    companyRegistered: boolean;
    testSetStatus: string;
    hasToken: boolean;
    hasPayrollApiPath: boolean;
    payrollApiPathConfigured: string | null;
    readyToSync: boolean;
    companyName: string | null;
    taxId: string | null;
    stats: {
        total_documents: number;
        prepared_documents: number;
        sent_documents: number;
        accepted_documents: number;
        error_documents: number;
    };
}

interface PayrollPeriod {
    id: number;
    year: number;
    month: number;
    period_type: string;
    period_number: number;
    status: string;
    employee_count: number;
    dian_status: string | null;
    total_neto: number;
    electronic_documents: number;
    prepared_documents: number;
    sent_documents: number;
    accepted_documents: number;
    error_documents: number;
}

interface PayrollDoc {
    id: number;
    employee_name: string;
    document_number: string;
    consecutive: string;
    dian_status: string;
    net_pay: number;
    cune: string | null;
    transmitted_at: string | null;
}

const fmtCOP = (n: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
}).format(n || 0);

const statusColorMap: Record<string, string> = {
    PREPARADO: 'warning',
    ENVIADO: 'info',
    ACEPTADO: 'success',
    PARCIAL: 'primary',
    ERROR: 'danger',
    RECHAZADO: 'danger',
    PENDIENTE: 'secondary'
};

interface Props {
    year: number;
    month: number;
}

const NominaElectronicaTab: React.FC<Props> = ({ year, month }) => {
    const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
    const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
    const [documents, setDocuments] = useState<PayrollDoc[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null);
    const [loading, setLoading] = useState(false);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [actionPeriodId, setActionPeriodId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const showError = (message: string) => {
        setError(message);
        setTimeout(() => setError(''), 5000);
    };

    const showSuccess = (message: string) => {
        setSuccess(message);
        setTimeout(() => setSuccess(''), 4000);
    };

    const fetchProviderStatus = useCallback(async () => {
        const response = await api.get('/alegra/payroll-electronic/status');
        setProviderStatus(response.data.data || null);
    }, []);

    const fetchPeriods = useCallback(async () => {
        const response = await api.get('/alegra/payroll-electronic/periods', {
            params: { year, month }
        });
        setPeriods(response.data.data || []);
    }, [year, month]);

    const fetchDocuments = useCallback(async (period: PayrollPeriod) => {
        setSelectedPeriod(period);
        setDocumentsLoading(true);
        try {
            const response = await api.get(`/alegra/payroll-electronic/periods/${period.id}/documents`);
            setDocuments(response.data.data || []);
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error cargando documentos de nómina electrónica');
        } finally {
            setDocumentsLoading(false);
        }
    }, []);

    const refreshAll = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([fetchProviderStatus(), fetchPeriods()]);
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error cargando integración de nómina electrónica');
        } finally {
            setLoading(false);
        }
    }, [fetchPeriods, fetchProviderStatus]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    const runPeriodAction = async (period: PayrollPeriod, action: 'prepare' | 'sync') => {
        setActionPeriodId(period.id);
        try {
            const response = await api.post(`/alegra/payroll-electronic/periods/${period.id}/${action}`);
            showSuccess(response.data.message || 'Proceso ejecutado correctamente');
            await refreshAll();
            await fetchDocuments(period);
        } catch (e: any) {
            showError(e?.response?.data?.error || `Error al ${action === 'prepare' ? 'preparar' : 'sincronizar'} el período`);
        } finally {
            setActionPeriodId(null);
        }
    };

    return (
        <div>
            {success && <Alert color="success" className="mb-3">{success}</Alert>}
            {error && <Alert color="danger" className="mb-3">{error}</Alert>}

            <Row className="g-3">
                <Col xl={4}>
                    <Card className="h-100">
                        <CardHeader>
                            <h6 className="card-title mb-0">
                                <i className="ri-links-line me-1"></i>
                                Proveedor de Nómina Electrónica
                            </h6>
                        </CardHeader>
                        <CardBody>
                            {loading && !providerStatus ? (
                                <div className="text-center py-4"><Spinner color="primary" /></div>
                            ) : (
                                <>
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <span className="fw-medium">Proveedor</span>
                                        <Badge color="success">{providerStatus?.provider || 'Activo'}</Badge>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span>Empresa registrada</span>
                                        <Badge color={providerStatus?.companyRegistered ? 'success' : 'secondary'}>
                                            {providerStatus?.companyRegistered ? 'Sí' : 'No'}
                                        </Badge>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span>Token servidor</span>
                                        <Badge color={providerStatus?.hasToken ? 'success' : 'secondary'}>
                                            {providerStatus?.hasToken ? 'OK' : 'Falta'}
                                        </Badge>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span>Ruta payroll API</span>
                                        <Badge color={providerStatus?.hasPayrollApiPath ? 'success' : 'warning'}>
                                            {providerStatus?.hasPayrollApiPath ? 'Configurada' : 'Pendiente'}
                                        </Badge>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <span>Listo para sincronizar</span>
                                        <Badge color={providerStatus?.readyToSync ? 'success' : 'warning'}>
                                            {providerStatus?.readyToSync ? 'Sí' : 'No'}
                                        </Badge>
                                    </div>
                                    {!providerStatus?.readyToSync && (
                                        <Alert color="warning" className="mb-0">
                                            Falta configurar la ruta `ALEGRA_PAYROLL_API_PATH` o registrar la empresa antes de transmitir.
                                        </Alert>
                                    )}
                                </>
                            )}
                        </CardBody>
                    </Card>
                </Col>

                <Col xl={8}>
                    <Card className="h-100">
                        <CardHeader>
                            <h6 className="card-title mb-0">
                                <i className="ri-bar-chart-box-line me-1"></i>
                                Resumen local
                            </h6>
                        </CardHeader>
                        <CardBody>
                            <Row className="g-3">
                                <Col md={3}><div className="border rounded p-3"><div className="text-muted fs-12">Documentos</div><div className="fs-4 fw-semibold">{providerStatus?.stats?.total_documents || 0}</div></div></Col>
                                <Col md={3}><div className="border rounded p-3"><div className="text-muted fs-12">Preparados</div><div className="fs-4 fw-semibold text-warning">{providerStatus?.stats?.prepared_documents || 0}</div></div></Col>
                                <Col md={3}><div className="border rounded p-3"><div className="text-muted fs-12">Enviados/Aceptados</div><div className="fs-4 fw-semibold text-info">{(providerStatus?.stats?.sent_documents || 0) + (providerStatus?.stats?.accepted_documents || 0)}</div></div></Col>
                                <Col md={3}><div className="border rounded p-3"><div className="text-muted fs-12">Con error</div><div className="fs-4 fw-semibold text-danger">{providerStatus?.stats?.error_documents || 0}</div></div></Col>
                            </Row>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            <Row className="g-3 mt-1">
                <Col lg={5}>
                    <Card>
                        <CardHeader>
                            <h6 className="card-title mb-0">
                                <i className="ri-file-list-3-line me-1"></i>
                                Períodos
                            </h6>
                        </CardHeader>
                        <CardBody>
                            {loading ? (
                                <div className="text-center py-4"><Spinner color="primary" /></div>
                            ) : periods.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <i className="ri-inbox-line fs-32 d-block mb-2"></i>
                                    No hay períodos listos para nómina electrónica.
                                </div>
                            ) : (
                                <div className="d-flex flex-column gap-2">
                                    {periods.map((period) => (
                                        <Card
                                            key={period.id}
                                            className={`border mb-0 ${selectedPeriod?.id === period.id ? 'border-primary' : ''}`}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => fetchDocuments(period)}
                                        >
                                            <CardBody className="py-3">
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div>
                                                        <div className="fw-medium">
                                                            {period.period_type === 'quincenal' ? 'Quincena' : 'Mensual'} {period.month}/{period.year}
                                                        </div>
                                                        <div className="text-muted fs-12">
                                                            {period.employee_count || 0} empleados
                                                        </div>
                                                    </div>
                                                    <Badge color={statusColorMap[period.dian_status || 'PENDIENTE'] || 'secondary'}>
                                                        {period.dian_status || 'PENDIENTE'}
                                                    </Badge>
                                                </div>
                                                <div className="d-flex justify-content-between fs-12 text-muted mb-2">
                                                    <span>Documentos: {period.electronic_documents || 0}</span>
                                                    <span>Neto: {fmtCOP(period.total_neto || 0)}</span>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <Button
                                                        color="warning"
                                                        size="sm"
                                                        className="w-100"
                                                        disabled={actionPeriodId === period.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            runPeriodAction(period, 'prepare');
                                                        }}
                                                    >
                                                        {actionPeriodId === period.id ? <Spinner size="sm" /> : 'Preparar'}
                                                    </Button>
                                                    <Button
                                                        color="primary"
                                                        size="sm"
                                                        className="w-100"
                                                        disabled={actionPeriodId === period.id}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            runPeriodAction(period, 'sync');
                                                        }}
                                                    >
                                                        {actionPeriodId === period.id ? <Spinner size="sm" /> : 'Sincronizar'}
                                                    </Button>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </Col>

                <Col lg={7}>
                    <Card>
                        <CardHeader>
                            <h6 className="card-title mb-0">
                                <i className="ri-file-text-line me-1"></i>
                                Documentos del período
                            </h6>
                        </CardHeader>
                        <CardBody>
                            {!selectedPeriod ? (
                                <div className="text-center py-4 text-muted">
                                    Selecciona un período para ver sus documentos.
                                </div>
                            ) : documentsLoading ? (
                                <div className="text-center py-4"><Spinner color="primary" /></div>
                            ) : documents.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    Este período aún no tiene documentos preparados.
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <Table className="table-hover align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Empleado</th>
                                                <th>Consecutivo</th>
                                                <th>Estado</th>
                                                <th className="text-end">Neto</th>
                                                <th>Transmisión</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {documents.map((doc) => (
                                                <tr key={doc.id}>
                                                    <td>
                                                        <div className="fw-medium">{doc.employee_name}</div>
                                                        <div className="text-muted fs-12">{doc.document_number}</div>
                                                    </td>
                                                    <td className="font-monospace">{doc.consecutive || '-'}</td>
                                                    <td>
                                                        <Badge color={statusColorMap[doc.dian_status] || 'secondary'}>
                                                            {doc.dian_status}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-end font-monospace">{fmtCOP(doc.net_pay || 0)}</td>
                                                    <td className="text-muted fs-12">
                                                        {doc.transmitted_at
                                                            ? new Date(doc.transmitted_at).toLocaleString('es-CO')
                                                            : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default NominaElectronicaTab;
