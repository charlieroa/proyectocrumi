import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Container, Row, Col,
    Card, CardBody, CardHeader, Table, Badge, Input, Button,
    Spinner, Label
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { env } from '../../env';
import { buildCumplimientoSidebarSections } from './config/cumplimientoSidebar';

const API_BASE = env.API_URL;

const CumplimientoPage: React.FC = () => {
    document.title = 'Cumplimiento | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');

    // Dashboard
    const [dashboard, setDashboard] = useState<any>({ obligacionesActivas: 0, presentacionesVencidas: 0, presentacionesProximas: 0, riesgosAltos: 0 });
    const [dashboardLoading, setDashboardLoading] = useState(false);

    // Obligations
    const [obligations, setObligations] = useState<any[]>([]);
    const [obligationsLoading, setObligationsLoading] = useState(false);
    const [obligationForm, setObligationForm] = useState<any>({
        obligation_type: 'DIAN',
        name: '',
        description: '',
        frequency: 'MENSUAL',
        due_day: '',
        regulatory_reference: '',
    });

    // Filings
    const [filings, setFilings] = useState<any[]>([]);
    const [filingsLoading, setFilingsLoading] = useState(false);

    // Risks
    const [risks, setRisks] = useState<any[]>([]);
    const [risksLoading, setRisksLoading] = useState(false);

    // Auth
    const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // ---- Fetch functions ----

    const fetchDashboard = useCallback(async () => {
        setDashboardLoading(true);
        try {
            const res = await fetch(`${API_BASE}/cumplimiento/dashboard`, { headers });
            const json = await res.json();
            if (json.success) setDashboard(json.data);
        } catch (err) {
            console.error('Error fetching compliance dashboard:', err);
        } finally {
            setDashboardLoading(false);
        }
    }, []);

    const fetchObligations = useCallback(async () => {
        setObligationsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/cumplimiento/obligations`, { headers });
            const json = await res.json();
            setObligations(json.success ? json.data : []);
        } catch (err) {
            console.error('Error fetching obligations:', err);
        } finally {
            setObligationsLoading(false);
        }
    }, []);

    const fetchFilings = useCallback(async () => {
        setFilingsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/cumplimiento/filings`, { headers });
            const json = await res.json();
            setFilings(json.success ? json.data : []);
        } catch (err) {
            console.error('Error fetching filings:', err);
        } finally {
            setFilingsLoading(false);
        }
    }, []);

    const fetchRisks = useCallback(async () => {
        setRisksLoading(true);
        try {
            const res = await fetch(`${API_BASE}/cumplimiento/risks`, { headers });
            const json = await res.json();
            setRisks(json.success ? json.data : []);
        } catch (err) {
            console.error('Error fetching risks:', err);
        } finally {
            setRisksLoading(false);
        }
    }, []);

    const handleCreateObligation = async () => {
        try {
            const res = await fetch(`${API_BASE}/cumplimiento/obligations`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    ...obligationForm,
                    due_day: Number(obligationForm.due_day) || null,
                }),
            });
            if (res.ok) {
                setObligationForm({ obligation_type: 'DIAN', name: '', description: '', frequency: 'MENSUAL', due_day: '', regulatory_reference: '' });
                fetchObligations();
                setActiveTab('obligaciones');
            } else {
                const err = await res.json();
                Swal.fire({ icon: 'error', title: err.message || 'Error al crear obligacion', confirmButtonColor: '#1A1D1F' });
            }
        } catch (err) {
            console.error('Error creating obligation:', err);
        }
    };

    const handleMarkFiled = async (filingId: number) => {
        try {
            const res = await fetch(`${API_BASE}/cumplimiento/filings/${filingId}/mark-filed`, {
                method: 'POST',
                headers,
                body: JSON.stringify({}),
            });
            if (res.ok) fetchFilings();
        } catch (err) {
            console.error('Error marking filed:', err);
        }
    };

    // Tab change
    useEffect(() => {
        if (activeTab === 'dashboard') fetchDashboard();
        if (activeTab === 'obligaciones') fetchObligations();
        if (activeTab === 'presentaciones') fetchFilings();
        if (activeTab === 'matriz-riesgos') fetchRisks();
    }, [activeTab]);

    // Sidebar
    const sidebarSections = useMemo(() => buildCumplimientoSidebarSections(), []);

    // Status badge color
    const filingStatusColor = (s: string) => {
        switch (s) {
            case 'PRESENTADO': return 'success';
            case 'VENCIDO': return 'danger';
            case 'PENDIENTE': return 'warning';
            case 'EXENTO': return 'info';
            default: return 'secondary';
        }
    };

    const riskColor = (level: string) => {
        switch (level) {
            case 'ALTA': case 'ALTO': return 'danger';
            case 'MEDIA': case 'MEDIO': return 'warning';
            case 'BAJA': case 'BAJO': return 'success';
            default: return 'secondary';
        }
    };

    // ---- Render ----

    const renderDashboard = () => (
        <>
            {dashboardLoading ? (
                <div className="text-center py-4"><Spinner size="sm" /></div>
            ) : (
                <Row className="mb-3">
                    <Col md={3}>
                        <Card className="border shadow-sm">
                            <CardBody className="text-center">
                                <h6 className="text-muted mb-1">Obligaciones Activas</h6>
                                <h3 className="mb-0">{dashboard.obligacionesActivas}</h3>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="border shadow-sm">
                            <CardBody className="text-center">
                                <h6 className="text-muted mb-1">Pendientes</h6>
                                <h3 className="mb-0 text-warning">{dashboard.presentacionesProximas}</h3>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="border shadow-sm">
                            <CardBody className="text-center">
                                <h6 className="text-muted mb-1">Vencidas</h6>
                                <h3 className="mb-0 text-danger">{dashboard.presentacionesVencidas}</h3>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="border shadow-sm">
                            <CardBody className="text-center">
                                <h6 className="text-muted mb-1">Riesgos Altos</h6>
                                <h3 className="mb-0 text-danger">{dashboard.riesgosAltos}</h3>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
            )}
        </>
    );

    const renderObligaciones = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Obligaciones Regulatorias</h6></CardHeader>
            <CardBody>
                {obligationsLoading ? (
                    <div className="text-center py-4"><Spinner size="sm" /></div>
                ) : obligations.length === 0 ? (
                    <p className="text-center text-muted py-4">Sin obligaciones registradas</p>
                ) : (
                    <Table responsive hover size="sm">
                        <thead className="table-light">
                            <tr>
                                <th>Nombre</th>
                                <th>Entidad</th>
                                <th>Frecuencia</th>
                                <th>Dia Limite</th>
                                <th>Referencia</th>
                                <th>Activa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {obligations.map((o, i) => (
                                <tr key={i}>
                                    <td>{o.name}</td>
                                    <td><Badge color="info">{o.obligation_type}</Badge></td>
                                    <td>{o.frequency}</td>
                                    <td>{o.due_day || '-'}</td>
                                    <td>{o.regulatory_reference || '-'}</td>
                                    <td>
                                        <Badge color={o.is_active ? 'success' : 'secondary'} pill>
                                            {o.is_active ? 'Si' : 'No'}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderNuevaObligacion = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Nueva Obligacion</h6></CardHeader>
            <CardBody>
                <Row>
                    <Col md={4}>
                        <Label size="sm">Entidad Reguladora</Label>
                        <Input type="select" bsSize="sm" value={obligationForm.obligation_type}
                            onChange={e => setObligationForm({ ...obligationForm, obligation_type: e.target.value })}>
                            <option value="DIAN">DIAN</option>
                            <option value="SUPERSOCIEDADES">Supersociedades</option>
                            <option value="SIC">SIC</option>
                            <option value="UGPP">UGPP</option>
                            <option value="MIN_TRABAJO">Min. Trabajo</option>
                        </Input>
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Nombre</Label>
                        <Input bsSize="sm" value={obligationForm.name}
                            onChange={e => setObligationForm({ ...obligationForm, name: e.target.value })} />
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Frecuencia</Label>
                        <Input type="select" bsSize="sm" value={obligationForm.frequency}
                            onChange={e => setObligationForm({ ...obligationForm, frequency: e.target.value })}>
                            <option value="MENSUAL">Mensual</option>
                            <option value="BIMESTRAL">Bimestral</option>
                            <option value="TRIMESTRAL">Trimestral</option>
                            <option value="ANUAL">Anual</option>
                        </Input>
                    </Col>
                </Row>
                <Row className="mt-2">
                    <Col md={4}>
                        <Label size="sm">Dia Limite del Mes</Label>
                        <Input type="number" bsSize="sm" value={obligationForm.due_day}
                            onChange={e => setObligationForm({ ...obligationForm, due_day: e.target.value })} />
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Referencia Normativa</Label>
                        <Input bsSize="sm" value={obligationForm.regulatory_reference}
                            onChange={e => setObligationForm({ ...obligationForm, regulatory_reference: e.target.value })} />
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Descripcion</Label>
                        <Input type="textarea" bsSize="sm" value={obligationForm.description}
                            onChange={e => setObligationForm({ ...obligationForm, description: e.target.value })} />
                    </Col>
                </Row>
                <Row className="mt-3">
                    <Col>
                        <Button color="primary" onClick={handleCreateObligation}>
                            <i className="ri-save-line me-1"></i>Guardar Obligacion
                        </Button>
                    </Col>
                </Row>
            </CardBody>
        </Card>
    );

    const renderPresentaciones = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Presentaciones</h6></CardHeader>
            <CardBody>
                {filingsLoading ? (
                    <div className="text-center py-4"><Spinner size="sm" /></div>
                ) : filings.length === 0 ? (
                    <p className="text-center text-muted py-4">Sin presentaciones registradas</p>
                ) : (
                    <Table responsive hover size="sm">
                        <thead className="table-light">
                            <tr>
                                <th>Obligacion</th>
                                <th>Entidad</th>
                                <th>Periodo</th>
                                <th>Fecha Limite</th>
                                <th>Fecha Presentacion</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filings.map((f, i) => (
                                <tr key={i}>
                                    <td>{f.obligation_name}</td>
                                    <td><Badge color="info">{f.obligation_type}</Badge></td>
                                    <td>{f.period || '-'}</td>
                                    <td>{f.due_date ? new Date(f.due_date).toLocaleDateString('es-CO') : '-'}</td>
                                    <td>{f.filed_date ? new Date(f.filed_date).toLocaleDateString('es-CO') : '-'}</td>
                                    <td><Badge color={filingStatusColor(f.status)} pill>{f.status}</Badge></td>
                                    <td>
                                        {f.status === 'PENDIENTE' && (
                                            <Button color="success" size="sm" outline onClick={() => handleMarkFiled(f.id)}>
                                                Marcar Presentado
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderMatrizRiesgos = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Matriz de Riesgos</h6></CardHeader>
            <CardBody>
                {risksLoading ? (
                    <div className="text-center py-4"><Spinner size="sm" /></div>
                ) : risks.length === 0 ? (
                    <p className="text-center text-muted py-4">Sin riesgos registrados</p>
                ) : (
                    <Table responsive hover size="sm">
                        <thead className="table-light">
                            <tr>
                                <th>Categoria</th>
                                <th>Descripcion</th>
                                <th>Probabilidad</th>
                                <th>Impacto</th>
                                <th>Mitigacion</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {risks.map((r, i) => (
                                <tr key={i}>
                                    <td>{r.category || '-'}</td>
                                    <td>{r.description}</td>
                                    <td><Badge color={riskColor(r.probability)}>{r.probability}</Badge></td>
                                    <td><Badge color={riskColor(r.impact)}>{r.impact}</Badge></td>
                                    <td>{r.mitigation || '-'}</td>
                                    <td>
                                        <Badge color={r.status === 'MITIGADO' ? 'success' : r.status === 'EN_TRATAMIENTO' ? 'warning' : 'info'} pill>
                                            {r.status}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return renderDashboard();
            case 'obligaciones': return renderObligaciones();
            case 'nueva-obligacion': return renderNuevaObligacion();
            case 'presentaciones': return renderPresentaciones();
            case 'matriz-riesgos': return renderMatrizRiesgos();
            default: return renderDashboard();
        }
    };

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <Row className="mb-3"><Col>
                        <div className="d-flex align-items-center justify-content-between">
                            <h4 className="mb-0">Cumplimiento</h4>
                            <Button color="primary" size="sm" onClick={() => setActiveTab('nueva-obligacion')}>
                                <i className="ri-file-add-line me-1"></i>Nueva Obligacion
                            </Button>
                        </div>
                    </Col></Row>
                    <ModuleLayout
                        sections={sidebarSections}
                        activeItem={activeTab}
                        onItemClick={setActiveTab}
                    >
                        {renderContent()}
                    </ModuleLayout>
                </Container>
            </div>
        </React.Fragment>
    );
};

export default CumplimientoPage;
