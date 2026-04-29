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
import { buildContratosSidebarSections } from './config/contratosSidebar';

const API_BASE = env.API_URL;

const ContratosPage: React.FC = () => {
    document.title = 'Contratos | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');

    // Contracts state
    const [contracts, setContracts] = useState<any[]>([]);
    const [contractsLoading, setContractsLoading] = useState(false);
    const [selectedContract, setSelectedContract] = useState<any>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState('');
    const [filterType, setFilterType] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Form
    const [contractForm, setContractForm] = useState<any>({
        contract_type: 'LABORAL',
        title: '',
        party_name: '',
        start_date: '',
        end_date: '',
        value: '',
        notes: '',
    });

    // Amendments & Alerts
    const [amendments, setAmendments] = useState<any[]>([]);
    const [amendmentsLoading, setAmendmentsLoading] = useState(false);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(false);

    // Dashboard
    const [dashboard, setDashboard] = useState<any>({ total: 0, activos: 0, vencidos: 0, porVencer: 0, borradores: 0, terminados: 0 });
    const [dashboardLoading, setDashboardLoading] = useState(false);

    // Auth
    const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const fmt = (v: number) => Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

    // ---- Fetch functions ----

    const fetchDashboard = useCallback(async () => {
        setDashboardLoading(true);
        try {
            const res = await fetch(`${API_BASE}/contratos/dashboard`, { headers });
            const json = await res.json();
            if (json.success) setDashboard(json.data);
        } catch (err) {
            console.error('Error fetching contract dashboard:', err);
        } finally {
            setDashboardLoading(false);
        }
    }, []);

    const fetchContracts = useCallback(async () => {
        setContractsLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus) params.append('status', filterStatus);
            if (filterType) params.append('type', filterType);
            if (searchTerm) params.append('search', searchTerm);
            const res = await fetch(`${API_BASE}/contratos/contracts?${params}`, { headers });
            const json = await res.json();
            setContracts(json.success ? json.data : []);
        } catch (err) {
            console.error('Error fetching contracts:', err);
        } finally {
            setContractsLoading(false);
        }
    }, [filterStatus, filterType, searchTerm]);

    const fetchAlerts = useCallback(async () => {
        setAlertsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/contratos/alerts`, { headers });
            const json = await res.json();
            setAlerts(json.success ? json.data : []);
        } catch (err) {
            console.error('Error fetching alerts:', err);
        } finally {
            setAlertsLoading(false);
        }
    }, []);

    const fetchAmendments = useCallback(async (contractId: number) => {
        setAmendmentsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/contratos/contracts/${contractId}/amendments`, { headers });
            const json = await res.json();
            setAmendments(json.success ? json.data : []);
        } catch (err) {
            console.error('Error fetching amendments:', err);
        } finally {
            setAmendmentsLoading(false);
        }
    }, []);

    const handleCreateContract = async () => {
        try {
            const res = await fetch(`${API_BASE}/contratos/contracts`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    ...contractForm,
                    value: Number(contractForm.value) || 0,
                }),
            });
            if (res.ok) {
                setContractForm({ contract_type: 'LABORAL', title: '', party_name: '', start_date: '', end_date: '', value: '', notes: '' });
                fetchContracts();
                setActiveTab('listado');
            } else {
                const err = await res.json();
                Swal.fire({ icon: 'error', title: err.message || 'Error al crear contrato', confirmButtonColor: '#1A1D1F' });
            }
        } catch (err) {
            console.error('Error creating contract:', err);
        }
    };

    // Initial load & tab change
    useEffect(() => {
        if (activeTab === 'dashboard') fetchDashboard();
        if (activeTab === 'listado') fetchContracts();
        if (activeTab === 'alertas') fetchAlerts();
        if (activeTab === 'enmiendas' && selectedContract?.id) fetchAmendments(selectedContract.id);
    }, [activeTab, filterStatus, filterType, searchTerm]);

    // Sidebar
    const sidebarSections = useMemo(() => buildContratosSidebarSections(), []);

    // Status badge color
    const statusColor = (s: string) => {
        switch (s) {
            case 'ACTIVO': return 'success';
            case 'VENCIDO': return 'danger';
            case 'TERMINADO': return 'secondary';
            case 'BORRADOR': return 'warning';
            default: return 'info';
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
                                <h6 className="text-muted mb-1">Total Contratos</h6>
                                <h3 className="mb-0">{dashboard.total}</h3>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="border shadow-sm">
                            <CardBody className="text-center">
                                <h6 className="text-muted mb-1">Activos</h6>
                                <h3 className="mb-0 text-success">{dashboard.activos}</h3>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="border shadow-sm">
                            <CardBody className="text-center">
                                <h6 className="text-muted mb-1">Vencidos</h6>
                                <h3 className="mb-0 text-danger">{dashboard.vencidos}</h3>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col md={3}>
                        <Card className="border shadow-sm">
                            <CardBody className="text-center">
                                <h6 className="text-muted mb-1">Por Vencer</h6>
                                <h3 className="mb-0 text-warning">{dashboard.porVencer}</h3>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
            )}
        </>
    );

    const renderListado = () => (
        <Card>
            <CardHeader>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <h6 className="mb-0">Listado de Contratos</h6>
                    <div className="d-flex gap-2">
                        <Input type="select" bsSize="sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: 150 }}>
                            <option value="">Todos los estados</option>
                            <option value="BORRADOR">Borrador</option>
                            <option value="ACTIVO">Activo</option>
                            <option value="VENCIDO">Vencido</option>
                            <option value="TERMINADO">Terminado</option>
                        </Input>
                        <Input type="select" bsSize="sm" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ maxWidth: 180 }}>
                            <option value="">Todos los tipos</option>
                            <option value="LABORAL">Laboral</option>
                            <option value="COMERCIAL">Comercial</option>
                            <option value="ARRIENDO">Arriendo</option>
                            <option value="PRESTACION_SERVICIOS">Prestacion de Servicios</option>
                        </Input>
                        <Input type="text" bsSize="sm" placeholder="Buscar..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 200 }} />
                    </div>
                </div>
            </CardHeader>
            <CardBody>
                {contractsLoading ? (
                    <div className="text-center py-4"><Spinner size="sm" /></div>
                ) : contracts.length === 0 ? (
                    <p className="text-center text-muted py-4">No se encontraron contratos</p>
                ) : (
                    <Table responsive hover size="sm">
                        <thead className="table-light">
                            <tr>
                                <th>Titulo</th>
                                <th>Tipo</th>
                                <th>Contraparte</th>
                                <th>Inicio</th>
                                <th>Fin</th>
                                <th>Valor</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {contracts.map((c, i) => (
                                <tr key={i}>
                                    <td>{c.title}</td>
                                    <td><Badge color="info">{c.contract_type}</Badge></td>
                                    <td>{c.party_name || '-'}</td>
                                    <td>{c.start_date ? new Date(c.start_date).toLocaleDateString('es-CO') : '-'}</td>
                                    <td>{c.end_date ? new Date(c.end_date).toLocaleDateString('es-CO') : '-'}</td>
                                    <td>${fmt(c.value)}</td>
                                    <td><Badge color={statusColor(c.status)} pill>{c.status}</Badge></td>
                                    <td>
                                        <Button color="info" size="sm" outline onClick={() => {
                                            setSelectedContract(c);
                                            setActiveTab('enmiendas');
                                        }}>
                                            Ver
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderNuevo = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Nuevo Contrato</h6></CardHeader>
            <CardBody>
                <Row>
                    <Col md={4}>
                        <Label size="sm">Tipo de Contrato</Label>
                        <Input type="select" bsSize="sm" value={contractForm.contract_type}
                            onChange={e => setContractForm({ ...contractForm, contract_type: e.target.value })}>
                            <option value="LABORAL">Laboral</option>
                            <option value="COMERCIAL">Comercial</option>
                            <option value="ARRIENDO">Arriendo</option>
                            <option value="PRESTACION_SERVICIOS">Prestacion de Servicios</option>
                        </Input>
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Titulo</Label>
                        <Input bsSize="sm" value={contractForm.title}
                            onChange={e => setContractForm({ ...contractForm, title: e.target.value })} />
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Contraparte</Label>
                        <Input bsSize="sm" value={contractForm.party_name}
                            onChange={e => setContractForm({ ...contractForm, party_name: e.target.value })} />
                    </Col>
                </Row>
                <Row className="mt-2">
                    <Col md={3}>
                        <Label size="sm">Fecha Inicio</Label>
                        <Input type="date" bsSize="sm" value={contractForm.start_date}
                            onChange={e => setContractForm({ ...contractForm, start_date: e.target.value })} />
                    </Col>
                    <Col md={3}>
                        <Label size="sm">Fecha Fin</Label>
                        <Input type="date" bsSize="sm" value={contractForm.end_date}
                            onChange={e => setContractForm({ ...contractForm, end_date: e.target.value })} />
                    </Col>
                    <Col md={3}>
                        <Label size="sm">Valor</Label>
                        <Input type="number" bsSize="sm" value={contractForm.value}
                            onChange={e => setContractForm({ ...contractForm, value: e.target.value })} />
                    </Col>
                    <Col md={3}>
                        <Label size="sm">Notas</Label>
                        <Input type="textarea" bsSize="sm" value={contractForm.notes}
                            onChange={e => setContractForm({ ...contractForm, notes: e.target.value })} />
                    </Col>
                </Row>
                <Row className="mt-3">
                    <Col>
                        <Button color="primary" onClick={handleCreateContract}>
                            <i className="ri-save-line me-1"></i>Guardar Contrato
                        </Button>
                    </Col>
                </Row>
            </CardBody>
        </Card>
    );

    const renderAlertas = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Alertas Proximas (30 dias)</h6></CardHeader>
            <CardBody>
                {alertsLoading ? (
                    <div className="text-center py-4"><Spinner size="sm" /></div>
                ) : alerts.length === 0 ? (
                    <p className="text-center text-muted py-4">Sin alertas proximas</p>
                ) : (
                    <Table responsive hover size="sm">
                        <thead className="table-light">
                            <tr>
                                <th>Contrato</th>
                                <th>Tipo Alerta</th>
                                <th>Fecha</th>
                                <th>Mensaje</th>
                                <th>Notificado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alerts.map((a, i) => (
                                <tr key={i}>
                                    <td>{a.contract_title}</td>
                                    <td><Badge color="warning">{a.alert_type}</Badge></td>
                                    <td>{a.alert_date ? new Date(a.alert_date).toLocaleDateString('es-CO') : '-'}</td>
                                    <td>{a.message || '-'}</td>
                                    <td>
                                        <Badge color={a.notified ? 'success' : 'secondary'} pill>
                                            {a.notified ? 'Si' : 'No'}
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

    const renderEnmiendas = () => {
        if (!selectedContract) {
            return (
                <Card>
                    <CardBody className="text-center text-muted py-5">
                        <i className="ri-file-search-line" style={{ fontSize: 48 }}></i>
                        <p className="mt-2">Selecciona un contrato del listado</p>
                        <Button color="primary" size="sm" outline onClick={() => setActiveTab('listado')}>
                            Ir al Listado
                        </Button>
                    </CardBody>
                </Card>
            );
        }

        return (
            <Card>
                <CardHeader>
                    <h6 className="mb-0">Enmiendas - {selectedContract.title}</h6>
                </CardHeader>
                <CardBody>
                    {amendmentsLoading ? (
                        <div className="text-center py-4"><Spinner size="sm" /></div>
                    ) : amendments.length === 0 ? (
                        <p className="text-center text-muted py-4">Sin enmiendas registradas</p>
                    ) : (
                        <Table responsive hover size="sm">
                            <thead className="table-light">
                                <tr>
                                    <th>Tipo</th>
                                    <th>Descripcion</th>
                                    <th>Fecha Efectiva</th>
                                    <th>Fecha Creacion</th>
                                </tr>
                            </thead>
                            <tbody>
                                {amendments.map((a, i) => (
                                    <tr key={i}>
                                        <td>{a.amendment_type}</td>
                                        <td>{a.description}</td>
                                        <td>{a.effective_date ? new Date(a.effective_date).toLocaleDateString('es-CO') : '-'}</td>
                                        <td>{a.created_at ? new Date(a.created_at).toLocaleDateString('es-CO') : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return renderDashboard();
            case 'listado': return renderListado();
            case 'nuevo': return renderNuevo();
            case 'alertas': return renderAlertas();
            case 'enmiendas': return renderEnmiendas();
            default: return renderDashboard();
        }
    };

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <Row className="mb-3"><Col>
                        <div className="d-flex align-items-center justify-content-between">
                            <h4 className="mb-0">Contratos</h4>
                            <Button color="primary" size="sm" onClick={() => setActiveTab('nuevo')}>
                                <i className="ri-file-add-line me-1"></i>Nuevo Contrato
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

export default ContratosPage;
