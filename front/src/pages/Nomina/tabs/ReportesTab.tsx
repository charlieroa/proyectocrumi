import React, { useState } from 'react';
import {
    Card, CardBody, CardHeader, Row, Col, Table, Badge, Button,
    Input, Spinner, Alert
} from 'reactstrap';
import { api } from '../../../services/api';

interface ReportesTabProps {
    year: number;
    month: number;
}

const fmt = (n: number) => Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const ReportesTab: React.FC<ReportesTabProps> = ({ year, month }) => {
    const [activeReport, setActiveReport] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [reportData, setReportData] = useState<any>(null);

    // For period report
    const [reportYear, setReportYear] = useState(year);
    const [reportMonth, setReportMonth] = useState(month);

    // For employee-specific reports
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [certYear, setCertYear] = useState(year);

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/nomina/empleados?status=active');
            if (res.data.success) setEmployees(res.data.employees || []);
        } catch (e) { console.error(e); }
    };

    const fetchPeriodReport = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/nomina/reportes/nomina-periodo?year=${reportYear}&month=${reportMonth}`);
            if (res.data.success) {
                setReportData(res.data.report);
            } else {
                setError(res.data.error || 'Error al cargar reporte');
            }
        } catch (e: any) {
            setError(e.response?.data?.error || 'Error al cargar reporte');
        }
        setLoading(false);
    };

    const fetchAnnualConsolidated = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/nomina/reportes/consolidado-anual?year=${certYear}`);
            if (res.data.success) {
                setReportData(res.data.report);
            } else {
                setError(res.data.error || 'Error al cargar reporte');
            }
        } catch (e: any) {
            setError(e.response?.data?.error || 'Error al cargar reporte');
        }
        setLoading(false);
    };

    const fetchIncomeCertificate = async () => {
        if (!selectedEmployee) { setError('Seleccione un empleado'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/nomina/reportes/certificado-ingresos/${selectedEmployee}?year=${certYear}`);
            if (res.data.success) {
                setReportData(res.data.certificate);
            } else {
                setError(res.data.error || 'Error al cargar certificado');
            }
        } catch (e: any) {
            setError(e.response?.data?.error || 'Error al cargar certificado');
        }
        setLoading(false);
    };

    const fetchProvisions = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/nomina/reportes/provisiones?year=${reportYear}&month=${reportMonth}`);
            if (res.data.success) {
                setReportData(res.data.report);
            } else {
                setError(res.data.error || 'Error al cargar provisiones');
            }
        } catch (e: any) {
            setError(e.response?.data?.error || 'Error al cargar provisiones');
        }
        setLoading(false);
    };

    const reports = [
        {
            id: 'periodo',
            title: 'Reporte de Nómina por Período',
            icon: 'ri-file-list-3-line',
            color: 'primary',
            description: 'Detalle completo de la liquidación de nómina para un período específico'
        },
        {
            id: 'anual',
            title: 'Consolidado Anual',
            icon: 'ri-calendar-check-line',
            color: 'success',
            description: 'Resumen anual de nomina por empleado con totales acumulados'
        },
        {
            id: 'certificado',
            title: 'Certificado de Ingresos y Retenciones',
            icon: 'ri-file-text-line',
            color: 'info',
            description: 'Certificado Art. 378 ET para declaracion de renta del empleado'
        },
        {
            id: 'provisiones',
            title: 'Provisiones de Prestaciones Sociales',
            icon: 'ri-funds-box-line',
            color: 'warning',
            description: 'Prima, cesantias, intereses cesantias y vacaciones provisionadas'
        }
    ];

    const handleSelectReport = (reportId: string) => {
        setActiveReport(reportId);
        setReportData(null);
        setError('');
        if (reportId === 'certificado' && employees.length === 0) {
            fetchEmployees();
        }
    };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    return (
        <>
            {!activeReport ? (
                <Row>
                    {reports.map(report => (
                        <Col md={6} lg={3} key={report.id}>
                            <Card className="card-animate" style={{ cursor: 'pointer' }}
                                onClick={() => handleSelectReport(report.id)}>
                                <CardBody className="text-center py-4">
                                    <div className={`avatar-sm mx-auto mb-3`}>
                                        <div className={`avatar-title bg-${report.color}-subtle text-${report.color} rounded-circle fs-24`}>
                                            <i className={report.icon}></i>
                                        </div>
                                    </div>
                                    <h6>{report.title}</h6>
                                    <p className="text-muted fs-12 mb-0">{report.description}</p>
                                </CardBody>
                            </Card>
                        </Col>
                    ))}
                </Row>
            ) : (
                <>
                    <Button color="light" size="sm" className="mb-3" onClick={() => setActiveReport(null)}>
                        <i className="ri-arrow-left-line me-1"></i> Volver a Reportes
                    </Button>

                    {/* REPORTE POR PERIODO */}
                    {activeReport === 'periodo' && (
                        <Card>
                            <CardHeader>
                                <h6 className="card-title mb-0">Reporte de Nómina por Período</h6>
                            </CardHeader>
                            <CardBody>
                                <Row className="mb-3 align-items-end">
                                    <Col md={3}>
                                        <label className="form-label">Mes</label>
                                        <Input type="select" bsSize="sm" value={reportMonth}
                                            onChange={e => setReportMonth(Number(e.target.value))}>
                                            {monthNames.map((m, i) => (
                                                <option key={i} value={i + 1}>{m}</option>
                                            ))}
                                        </Input>
                                    </Col>
                                    <Col md={2}>
                                        <label className="form-label">Ano</label>
                                        <Input type="select" bsSize="sm" value={reportYear}
                                            onChange={e => setReportYear(Number(e.target.value))}>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </Input>
                                    </Col>
                                    <Col md={2}>
                                        <Button color="primary" size="sm" onClick={fetchPeriodReport}>
                                            <i className="ri-search-line me-1"></i>Consultar
                                        </Button>
                                    </Col>
                                </Row>
                                {error && <Alert color="danger">{error}</Alert>}
                                {loading ? (
                                    <div className="text-center py-4"><Spinner color="primary" /></div>
                                ) : reportData && Array.isArray(reportData.liquidations) ? (
                                    <div className="table-responsive">
                                        <Table className="table-hover table-nowrap align-middle mb-0" size="sm">
                                            <thead>
                                                <tr>
                                                    <th>Empleado</th>
                                                    <th className="text-end">Devengado</th>
                                                    <th className="text-end">Deducciones</th>
                                                    <th className="text-end">Neto</th>
                                                    <th className="text-end">Costo Empresa</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.liquidations.map((l: any, i: number) => (
                                                    <tr key={i}>
                                                        <td className="fw-medium">{l.first_name} {l.last_name}</td>
                                                        <td className="text-end font-monospace">{fmt(l.total_devengado)}</td>
                                                        <td className="text-end font-monospace text-danger">{fmt(l.total_deductions)}</td>
                                                        <td className="text-end font-monospace fw-bold text-success">{fmt(l.net_pay)}</td>
                                                        <td className="text-end font-monospace">{fmt(l.total_employer_cost)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="table-light fw-bold">
                                                    <td>TOTALES</td>
                                                    <td className="text-end font-monospace">
                                                        {fmt(reportData.liquidations.reduce((s: number, l: any) => s + Number(l.total_devengado), 0))}
                                                    </td>
                                                    <td className="text-end font-monospace text-danger">
                                                        {fmt(reportData.liquidations.reduce((s: number, l: any) => s + Number(l.total_deductions), 0))}
                                                    </td>
                                                    <td className="text-end font-monospace text-success">
                                                        {fmt(reportData.liquidations.reduce((s: number, l: any) => s + Number(l.net_pay), 0))}
                                                    </td>
                                                    <td className="text-end font-monospace">
                                                        {fmt(reportData.liquidations.reduce((s: number, l: any) => s + Number(l.total_employer_cost), 0))}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </Table>
                                    </div>
                                ) : !loading && (
                                    <div className="text-center py-4 text-muted">
                                        <i className="ri-file-list-3-line fs-36 d-block mb-2"></i>
                                        <p>Seleccione un periodo y haga clic en Consultar</p>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    )}

                    {/* CONSOLIDADO ANUAL */}
                    {activeReport === 'anual' && (
                        <Card>
                            <CardHeader>
                                <h6 className="card-title mb-0">Consolidado Anual</h6>
                            </CardHeader>
                            <CardBody>
                                <Row className="mb-3 align-items-end">
                                    <Col md={2}>
                                        <label className="form-label">Ano</label>
                                        <Input type="select" bsSize="sm" value={certYear}
                                            onChange={e => setCertYear(Number(e.target.value))}>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </Input>
                                    </Col>
                                    <Col md={2}>
                                        <Button color="primary" size="sm" onClick={fetchAnnualConsolidated}>
                                            <i className="ri-search-line me-1"></i>Consultar
                                        </Button>
                                    </Col>
                                </Row>
                                {error && <Alert color="danger">{error}</Alert>}
                                {loading ? (
                                    <div className="text-center py-4"><Spinner color="primary" /></div>
                                ) : reportData && Array.isArray(reportData.employees) ? (
                                    <div className="table-responsive">
                                        <Table className="table-hover table-nowrap align-middle mb-0" size="sm">
                                            <thead>
                                                <tr>
                                                    <th>Empleado</th>
                                                    <th className="text-end">Total Devengado</th>
                                                    <th className="text-end">Total Deducciones</th>
                                                    <th className="text-end">Total Neto Pagado</th>
                                                    <th className="text-end">Total Aportes Empresa</th>
                                                    <th className="text-center">Periodos</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.employees.map((e: any, i: number) => (
                                                    <tr key={i}>
                                                        <td className="fw-medium">{e.first_name} {e.last_name}</td>
                                                        <td className="text-end font-monospace">{fmt(e.total_devengado)}</td>
                                                        <td className="text-end font-monospace">{fmt(e.total_deductions)}</td>
                                                        <td className="text-end font-monospace fw-bold">{fmt(e.total_net_pay)}</td>
                                                        <td className="text-end font-monospace">{fmt(e.total_employer_cost)}</td>
                                                        <td className="text-center"><Badge color="info">{e.period_count}</Badge></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                ) : !loading && (
                                    <div className="text-center py-4 text-muted">
                                        <i className="ri-calendar-check-line fs-36 d-block mb-2"></i>
                                        <p>Seleccione un ano y haga clic en Consultar</p>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    )}

                    {/* CERTIFICADO DE INGRESOS */}
                    {activeReport === 'certificado' && (
                        <Card>
                            <CardHeader>
                                <h6 className="card-title mb-0">Certificado de Ingresos y Retenciones</h6>
                            </CardHeader>
                            <CardBody>
                                <Row className="mb-3 align-items-end">
                                    <Col md={4}>
                                        <label className="form-label">Empleado</label>
                                        <Input type="select" bsSize="sm" value={selectedEmployee}
                                            onChange={e => setSelectedEmployee(e.target.value)}>
                                            <option value="">Seleccionar empleado...</option>
                                            {employees.map((emp: any) => (
                                                <option key={emp.id} value={emp.id}>
                                                    {emp.first_name} {emp.last_name} - {emp.document_number}
                                                </option>
                                            ))}
                                        </Input>
                                    </Col>
                                    <Col md={2}>
                                        <label className="form-label">Ano</label>
                                        <Input type="select" bsSize="sm" value={certYear}
                                            onChange={e => setCertYear(Number(e.target.value))}>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </Input>
                                    </Col>
                                    <Col md={2}>
                                        <Button color="primary" size="sm" onClick={fetchIncomeCertificate}>
                                            <i className="ri-file-text-line me-1"></i>Generar
                                        </Button>
                                    </Col>
                                </Row>
                                {error && <Alert color="danger">{error}</Alert>}
                                {loading ? (
                                    <div className="text-center py-4"><Spinner color="primary" /></div>
                                ) : reportData ? (
                                    <Card className="border">
                                        <CardBody>
                                            <div className="text-center mb-4">
                                                <h5>CERTIFICADO DE INGRESOS Y RETENCIONES</h5>
                                                <p className="text-muted">Art. 378 Estatuto Tributario - Ano Gravable {certYear}</p>
                                            </div>
                                            <Row className="mb-3">
                                                <Col md={6}>
                                                    <p><strong>Empleado:</strong> {reportData.employee_name}</p>
                                                    <p><strong>Documento:</strong> {reportData.document_type} {reportData.document_number}</p>
                                                </Col>
                                                <Col md={6}>
                                                    <p><strong>Cargo:</strong> {reportData.position}</p>
                                                    <p><strong>Periodo:</strong> Enero - Diciembre {certYear}</p>
                                                </Col>
                                            </Row>
                                            <Table bordered size="sm">
                                                <thead className="table-light">
                                                    <tr><th colSpan={2}>Concepto</th><th className="text-end">Valor Anual</th></tr>
                                                </thead>
                                                <tbody>
                                                    <tr><td colSpan={2}>Salarios y demas pagos laborales</td><td className="text-end font-monospace">{fmt(reportData.total_salarios || 0)}</td></tr>
                                                    <tr><td colSpan={2}>Cesantias e intereses de cesantias</td><td className="text-end font-monospace">{fmt(reportData.total_cesantias || 0)}</td></tr>
                                                    <tr><td colSpan={2}>Gastos de representacion y similares</td><td className="text-end font-monospace">{fmt(reportData.total_otros || 0)}</td></tr>
                                                    <tr className="table-light fw-bold"><td colSpan={2}>TOTAL INGRESOS BRUTOS</td><td className="text-end font-monospace">{fmt(reportData.total_ingresos || 0)}</td></tr>
                                                    <tr><td colSpan={2}>Aportes obligatorios salud</td><td className="text-end font-monospace">{fmt(reportData.total_salud || 0)}</td></tr>
                                                    <tr><td colSpan={2}>Aportes obligatorios pension</td><td className="text-end font-monospace">{fmt(reportData.total_pension || 0)}</td></tr>
                                                    <tr><td colSpan={2}>Fondo de solidaridad pensional</td><td className="text-end font-monospace">{fmt(reportData.total_fsp || 0)}</td></tr>
                                                    <tr className="table-warning fw-bold"><td colSpan={2}>RETENCION EN LA FUENTE</td><td className="text-end font-monospace">{fmt(reportData.total_retencion || 0)}</td></tr>
                                                    <tr className="table-success fw-bold"><td colSpan={2}>TOTAL PAGOS NETOS</td><td className="text-end font-monospace">{fmt(reportData.total_neto || 0)}</td></tr>
                                                </tbody>
                                            </Table>
                                        </CardBody>
                                    </Card>
                                ) : !loading && (
                                    <div className="text-center py-4 text-muted">
                                        <i className="ri-file-text-line fs-36 d-block mb-2"></i>
                                        <p>Seleccione un empleado y ano para generar el certificado</p>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    )}

                    {/* PROVISIONES */}
                    {activeReport === 'provisiones' && (
                        <Card>
                            <CardHeader>
                                <h6 className="card-title mb-0">Provisiones de Prestaciones Sociales</h6>
                            </CardHeader>
                            <CardBody>
                                <Row className="mb-3 align-items-end">
                                    <Col md={3}>
                                        <label className="form-label">Mes</label>
                                        <Input type="select" bsSize="sm" value={reportMonth}
                                            onChange={e => setReportMonth(Number(e.target.value))}>
                                            {monthNames.map((m, i) => (
                                                <option key={i} value={i + 1}>{m}</option>
                                            ))}
                                        </Input>
                                    </Col>
                                    <Col md={2}>
                                        <label className="form-label">Ano</label>
                                        <Input type="select" bsSize="sm" value={reportYear}
                                            onChange={e => setReportYear(Number(e.target.value))}>
                                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                                        </Input>
                                    </Col>
                                    <Col md={2}>
                                        <Button color="primary" size="sm" onClick={fetchProvisions}>
                                            <i className="ri-search-line me-1"></i>Consultar
                                        </Button>
                                    </Col>
                                </Row>
                                {error && <Alert color="danger">{error}</Alert>}
                                {loading ? (
                                    <div className="text-center py-4"><Spinner color="primary" /></div>
                                ) : reportData && Array.isArray(reportData.provisions) ? (
                                    <>
                                        <Row className="mb-3">
                                            {[
                                                { label: 'Prima', key: 'total_prima', color: 'primary' },
                                                { label: 'Cesantias', key: 'total_cesantias', color: 'success' },
                                                { label: 'Int. Cesantias', key: 'total_intereses', color: 'info' },
                                                { label: 'Vacaciones', key: 'total_vacaciones', color: 'warning' },
                                            ].map((item, i) => (
                                                <Col md={3} key={i}>
                                                    <Card className={`border border-${item.color}-subtle`}>
                                                        <CardBody className="py-3 text-center">
                                                            <p className="text-muted mb-1 fs-12">{item.label}</p>
                                                            <h5 className={`text-${item.color} mb-0`}>
                                                                {fmt(reportData.totals?.[item.key] || 0)}
                                                            </h5>
                                                        </CardBody>
                                                    </Card>
                                                </Col>
                                            ))}
                                        </Row>
                                        <div className="table-responsive">
                                            <Table className="table-hover table-nowrap align-middle mb-0" size="sm">
                                                <thead>
                                                    <tr>
                                                        <th>Empleado</th>
                                                        <th className="text-end">Prima</th>
                                                        <th className="text-end">Cesantias</th>
                                                        <th className="text-end">Int. Cesantias</th>
                                                        <th className="text-end">Vacaciones</th>
                                                        <th className="text-end">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reportData.provisions.map((p: any, i: number) => (
                                                        <tr key={i}>
                                                            <td className="fw-medium">{p.first_name} {p.last_name}</td>
                                                            <td className="text-end font-monospace">{fmt(p.prima_provision)}</td>
                                                            <td className="text-end font-monospace">{fmt(p.cesantias_provision)}</td>
                                                            <td className="text-end font-monospace">{fmt(p.intereses_cesantias_provision)}</td>
                                                            <td className="text-end font-monospace">{fmt(p.vacaciones_provision)}</td>
                                                            <td className="text-end font-monospace fw-bold">{fmt(p.total_provisions)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </>
                                ) : !loading && (
                                    <div className="text-center py-4 text-muted">
                                        <i className="ri-funds-box-line fs-36 d-block mb-2"></i>
                                        <p>Seleccione un periodo para ver las provisiones</p>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    )}
                </>
            )}
        </>
    );
};

export default ReportesTab;
