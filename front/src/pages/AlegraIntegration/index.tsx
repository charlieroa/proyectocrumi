import React, { useEffect, useState, useCallback } from 'react';
import {
    Container, Row, Col,
    Card, CardBody, CardHeader, Table, Badge, Input, Button,
    Spinner, Label
} from 'reactstrap';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import type { ModuleSidebarSection } from '../../Components/Common/ModuleSidebar';
import { env } from '../../env';
import { buildAlegraSidebarSections } from './config/alegraSidebar';

const API_BASE = env.API_URL;

const AlegraIntegrationPage: React.FC = () => {
    document.title = 'Integración Facturación Electrónica | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);

    // Config state
    const [config, setConfig] = useState<any>({});
    // Company state
    const [companyInfo, setCompanyInfo] = useState<any>({});
    // Test set state
    const [testSetStatus, setTestSetStatus] = useState<any>({});
    // Invoices state
    const [invoices, setInvoices] = useState<any[]>([]);
    // DIAN reference data
    const [departments, setDepartments] = useState<any[]>([]);
    const [municipalities, setMunicipalities] = useState<any[]>([]);
    const [taxRegimes, setTaxRegimes] = useState<any[]>([]);
    const [identificationTypes, setIdentificationTypes] = useState<any[]>([]);
    // Provider status
    const [providerStatus, setProviderStatus] = useState<any>({});

    const sidebarSections = buildAlegraSidebarSections();

    const getAuthHeaders = useCallback(() => {
        const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        return headers;
    }, []);

    // ── Fetch functions ──

    const fetchConfig = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/alegra/config`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (err) {
            console.error('Error fetching Alegra config:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    const fetchProviderStatus = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/alegra/provider/status`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setProviderStatus(data);
            }
        } catch (err) {
            console.error('Error fetching provider status:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    const fetchCompany = useCallback(async (companyId: string) => {
        if (!companyId) return;
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/alegra/company/${companyId}`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setCompanyInfo(data);
            }
        } catch (err) {
            console.error('Error fetching company:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    const fetchTestSetStatus = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/alegra/test-set/status`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setTestSetStatus(data);
            }
        } catch (err) {
            console.error('Error fetching test set status:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    const sendTestSet = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/alegra/test-set/send`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setTestSetStatus(data);
            }
        } catch (err) {
            console.error('Error sending test set:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    const generateTestDocs = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/alegra/test-set/generate`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setTestSetStatus((prev: any) => ({ ...prev, generated: data }));
            }
        } catch (err) {
            console.error('Error generating test documents:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    const fetchDepartments = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/alegra/dian/departments`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setDepartments(Array.isArray(data) ? data : data.departments || []);
            }
        } catch (err) {
            console.error('Error fetching departments:', err);
        }
    }, [getAuthHeaders]);

    const fetchTaxRegimes = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/alegra/dian/tax-regimes`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setTaxRegimes(Array.isArray(data) ? data : data.taxRegimes || []);
            }
        } catch (err) {
            console.error('Error fetching tax regimes:', err);
        }
    }, [getAuthHeaders]);

    const fetchIdentificationTypes = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/alegra/dian/identification-types`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setIdentificationTypes(Array.isArray(data) ? data : data.identificationTypes || []);
            }
        } catch (err) {
            console.error('Error fetching identification types:', err);
        }
    }, [getAuthHeaders]);

    // ── Effects ──

    useEffect(() => {
        fetchConfig();
        fetchProviderStatus();
    }, [fetchConfig, fetchProviderStatus]);

    useEffect(() => {
        if (activeTab === 'empresa' && config?.companyId) {
            fetchCompany(config.companyId);
        }
        if (activeTab === 'test-set') {
            fetchTestSetStatus();
        }
        if (activeTab === 'tablas-dian') {
            fetchDepartments();
            fetchTaxRegimes();
            fetchIdentificationTypes();
        }
    }, [activeTab, config?.companyId, fetchCompany, fetchTestSetStatus, fetchDepartments, fetchTaxRegimes, fetchIdentificationTypes]);

    // ── Render helpers ──

    const renderDashboard = () => (
        <Row>
            <Col lg={4}>
                <Card>
                    <CardHeader><h5 className="mb-0">Estado de Conexion</h5></CardHeader>
                    <CardBody>
                        <div className="d-flex align-items-center mb-3">
                            <i className={`ri-wifi-line fs-24 me-2 ${providerStatus?.connected ? 'text-success' : 'text-danger'}`}></i>
                            <span className="fw-medium">
                                {providerStatus?.connected ? 'Conectado' : 'Desconectado'}
                            </span>
                        </div>
                        <div className="mb-2">
                            <Label className="text-muted mb-1 d-block">Modo</Label>
                            <Badge color={config?.sandbox ? 'warning' : 'success'}>
                                {config?.sandbox ? 'Sandbox' : 'Produccion'}
                            </Badge>
                        </div>
                        <div className="mb-2">
                            <Label className="text-muted mb-1 d-block">Proveedor</Label>
                            <span>{providerStatus?.provider || 'Proveedor tecnológico'}</span>
                        </div>
                    </CardBody>
                </Card>
            </Col>
            <Col lg={4}>
                <Card>
                    <CardHeader><h5 className="mb-0">Empresa</h5></CardHeader>
                    <CardBody>
                        <div className="mb-2">
                            <Label className="text-muted mb-1 d-block">Razon Social</Label>
                            <span>{config?.companyName || companyInfo?.name || '-'}</span>
                        </div>
                        <div className="mb-2">
                            <Label className="text-muted mb-1 d-block">NIT</Label>
                            <span>{config?.nit || companyInfo?.nit || '-'}</span>
                        </div>
                        <div className="mb-2">
                            <Label className="text-muted mb-1 d-block">Company ID</Label>
                            <span>{config?.companyId || '-'}</span>
                        </div>
                    </CardBody>
                </Card>
            </Col>
            <Col lg={4}>
                <Card>
                    <CardHeader><h5 className="mb-0">Resumen</h5></CardHeader>
                    <CardBody>
                        <div className="mb-2">
                            <Label className="text-muted mb-1 d-block">Documentos Enviados</Label>
                            <span className="fs-20 fw-semibold">{providerStatus?.documentsSent || 0}</span>
                        </div>
                        <div className="mb-2">
                            <Label className="text-muted mb-1 d-block">Ultima Sincronizacion</Label>
                            <span>{providerStatus?.lastSync ? new Date(providerStatus.lastSync).toLocaleString() : '-'}</span>
                        </div>
                        <div className="mb-2">
                            <Label className="text-muted mb-1 d-block">Set de Pruebas</Label>
                            <Badge color={providerStatus?.testSetApproved ? 'success' : 'secondary'}>
                                {providerStatus?.testSetApproved ? 'Aprobado' : 'Pendiente'}
                            </Badge>
                        </div>
                    </CardBody>
                </Card>
            </Col>
        </Row>
    );

    const renderConfig = () => (
        <Row>
            <Col lg={8}>
                <Card>
                    <CardHeader><h5 className="mb-0">Configuración API proveedor tecnológico</h5></CardHeader>
                    <CardBody>
                        {loading ? <div className="text-center py-4"><Spinner /></div> : (
                            <div>
                                <div className="mb-3">
                                    <Label className="fw-medium">URL Base</Label>
                                    <Input type="text" value={config?.baseUrl || ''} readOnly />
                                </div>
                                <div className="mb-3">
                                    <Label className="fw-medium">Modo Sandbox</Label>
                                    <div>
                                        <Badge color={config?.sandbox ? 'warning' : 'success'} className="fs-12">
                                            {config?.sandbox ? 'Sandbox (Pruebas)' : 'Produccion'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <Label className="fw-medium">Estado del Token</Label>
                                    <div>
                                        <Badge color={config?.tokenActive ? 'success' : 'danger'} className="fs-12">
                                            {config?.tokenActive ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <Label className="fw-medium">API Key</Label>
                                    <Input type="text" value={config?.apiKey ? '••••••••' + config.apiKey.slice(-4) : '-'} readOnly />
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </Col>
        </Row>
    );

    const renderEmpresa = () => (
        <Row>
            <Col lg={8}>
                <Card>
                    <CardHeader><h5 className="mb-0">Informacion de Empresa</h5></CardHeader>
                    <CardBody>
                        {loading ? <div className="text-center py-4"><Spinner /></div> : (
                            <div>
                                <Row>
                                    <Col md={6} className="mb-3">
                                        <Label className="fw-medium">NIT</Label>
                                        <Input type="text" value={companyInfo?.nit || config?.nit || ''} readOnly />
                                    </Col>
                                    <Col md={6} className="mb-3">
                                        <Label className="fw-medium">Razon Social</Label>
                                        <Input type="text" value={companyInfo?.name || config?.companyName || ''} readOnly />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6} className="mb-3">
                                        <Label className="fw-medium">Direccion</Label>
                                        <Input type="text" value={companyInfo?.address || ''} readOnly />
                                    </Col>
                                    <Col md={6} className="mb-3">
                                        <Label className="fw-medium">Regimen Tributario</Label>
                                        <Input type="text" value={companyInfo?.taxRegime || ''} readOnly />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6} className="mb-3">
                                        <Label className="fw-medium">Departamento</Label>
                                        <Input type="text" value={companyInfo?.department || ''} readOnly />
                                    </Col>
                                    <Col md={6} className="mb-3">
                                        <Label className="fw-medium">Municipio</Label>
                                        <Input type="text" value={companyInfo?.municipality || ''} readOnly />
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6} className="mb-3">
                                        <Label className="fw-medium">Email</Label>
                                        <Input type="text" value={companyInfo?.email || ''} readOnly />
                                    </Col>
                                    <Col md={6} className="mb-3">
                                        <Label className="fw-medium">Telefono</Label>
                                        <Input type="text" value={companyInfo?.phone || ''} readOnly />
                                    </Col>
                                </Row>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </Col>
        </Row>
    );

    const renderTestSet = () => (
        <Row>
            <Col lg={8}>
                <Card>
                    <CardHeader className="d-flex align-items-center justify-content-between">
                        <h5 className="mb-0">Set de Pruebas DIAN</h5>
                        <div>
                            <Button color="primary" size="sm" className="me-2" onClick={sendTestSet} disabled={loading}>
                                {loading ? <Spinner size="sm" /> : <><i className="ri-send-plane-line me-1"></i> Enviar Set</>}
                            </Button>
                            <Button color="secondary" size="sm" onClick={generateTestDocs} disabled={loading}>
                                {loading ? <Spinner size="sm" /> : <><i className="ri-file-add-line me-1"></i> Generar Documentos</>}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardBody>
                        {loading ? <div className="text-center py-4"><Spinner /></div> : (
                            <div>
                                <div className="mb-3">
                                    <Label className="fw-medium">Estado</Label>
                                    <div>
                                        <Badge color={testSetStatus?.approved ? 'success' : testSetStatus?.sent ? 'info' : 'secondary'} className="fs-12">
                                            {testSetStatus?.approved ? 'Aprobado' : testSetStatus?.sent ? 'Enviado' : 'Pendiente'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <Label className="fw-medium">Test Set ID</Label>
                                    <Input type="text" value={testSetStatus?.testSetId || '-'} readOnly />
                                </div>
                                {testSetStatus?.results && (
                                    <div className="mb-3">
                                        <Label className="fw-medium">Resultados</Label>
                                        <Table bordered size="sm">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Documento</th>
                                                    <th>Estado</th>
                                                    <th>Mensaje</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(Array.isArray(testSetStatus.results) ? testSetStatus.results : []).map((r: any, i: number) => (
                                                    <tr key={i}>
                                                        <td>{r.document || r.type || '-'}</td>
                                                        <td>
                                                            <Badge color={r.status === 'approved' || r.status === 'success' ? 'success' : 'warning'}>
                                                                {r.status}
                                                            </Badge>
                                                        </td>
                                                        <td>{r.message || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </Col>
        </Row>
    );

    const renderEstado = () => (
        <Row>
            <Col lg={8}>
                <Card>
                    <CardHeader>
                        <h5 className="mb-0">Estado del Proveedor</h5>
                    </CardHeader>
                    <CardBody>
                        {loading ? <div className="text-center py-4"><Spinner /></div> : (
                            <div>
                                <div className="mb-3">
                                    <Label className="fw-medium">Conexion</Label>
                                    <div>
                                        <Badge color={providerStatus?.connected ? 'success' : 'danger'} className="fs-12">
                                            {providerStatus?.connected ? 'Conectado' : 'Desconectado'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <Label className="fw-medium">Ultima Sincronizacion</Label>
                                    <Input type="text" value={providerStatus?.lastSync ? new Date(providerStatus.lastSync).toLocaleString() : 'Sin datos'} readOnly />
                                </div>
                                <div className="mb-3">
                                    <Label className="fw-medium">Documentos Enviados</Label>
                                    <Input type="text" value={String(providerStatus?.documentsSent || 0)} readOnly />
                                </div>
                                <div className="mb-3">
                                    <Label className="fw-medium">Documentos Aceptados</Label>
                                    <Input type="text" value={String(providerStatus?.documentsAccepted || 0)} readOnly />
                                </div>
                                <div className="mb-3">
                                    <Label className="fw-medium">Documentos Rechazados</Label>
                                    <Input type="text" value={String(providerStatus?.documentsRejected || 0)} readOnly />
                                </div>
                                <Button color="soft-primary" size="sm" onClick={fetchProviderStatus} disabled={loading}>
                                    <i className="ri-refresh-line me-1"></i> Actualizar
                                </Button>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </Col>
        </Row>
    );

    const renderFacturas = () => (
        <Row>
            <Col lg={12}>
                <Card>
                    <CardHeader>
                        <h5 className="mb-0">Facturas Electronicas</h5>
                    </CardHeader>
                    <CardBody>
                        {loading ? <div className="text-center py-4"><Spinner /></div> : (
                            <div className="table-responsive">
                                <Table bordered hover size="sm">
                                    <thead className="table-light">
                                        <tr>
                                            <th>ID</th>
                                            <th>Fecha</th>
                                            <th>Cliente</th>
                                            <th>Monto</th>
                                            <th>Estado DIAN</th>
                                            <th>CUFE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center text-muted py-4">
                                                    No hay facturas registradas
                                                </td>
                                            </tr>
                                        ) : (
                                            invoices.map((inv: any) => (
                                                <tr key={inv.id}>
                                                    <td>{inv.id}</td>
                                                    <td>{inv.date ? new Date(inv.date).toLocaleDateString() : '-'}</td>
                                                    <td>{inv.clientName || inv.client || '-'}</td>
                                                    <td className="text-end">${Number(inv.amount || 0).toLocaleString()}</td>
                                                    <td>
                                                        <Badge color={
                                                            inv.dianStatus === 'approved' ? 'success' :
                                                            inv.dianStatus === 'rejected' ? 'danger' :
                                                            inv.dianStatus === 'pending' ? 'warning' : 'secondary'
                                                        }>
                                                            {inv.dianStatus || 'N/A'}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-truncate" style={{ maxWidth: '200px' }}>{inv.cufe || '-'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </Col>
        </Row>
    );

    const renderNotas = () => (
        <Row>
            <Col lg={12}>
                <Card>
                    <CardHeader>
                        <h5 className="mb-0">Notas Credito / Debito</h5>
                    </CardHeader>
                    <CardBody>
                        <div className="text-center py-4">
                            <i className="ri-file-copy-2-line fs-48 text-muted mb-3 d-block"></i>
                            <p className="text-muted mb-2">
                                Las notas crédito y débito se generan automáticamente al emitir.
                            </p>
                            <p className="text-muted small">
                                Utilice los endpoints <code>POST /alegra/credit-notes</code> y <code>POST /alegra/debit-notes</code> para crear nuevos documentos.
                            </p>
                        </div>
                    </CardBody>
                </Card>
            </Col>
        </Row>
    );

    const renderTablasDian = () => (
        <Row>
            <Col lg={12}>
                <Card className="mb-3">
                    <CardHeader><h5 className="mb-0">Departamentos</h5></CardHeader>
                    <CardBody>
                        {departments.length === 0 ? (
                            <p className="text-muted text-center py-3">Cargando datos...</p>
                        ) : (
                            <div className="table-responsive" style={{ maxHeight: '300px' }}>
                                <Table bordered size="sm" className="mb-0">
                                    <thead className="table-light sticky-top">
                                        <tr>
                                            <th>Codigo</th>
                                            <th>Nombre</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {departments.map((d: any, i: number) => (
                                            <tr key={i}>
                                                <td>{d.code || d.id || i + 1}</td>
                                                <td>{d.name || d.description || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </CardBody>
                </Card>

                <Card className="mb-3">
                    <CardHeader><h5 className="mb-0">Regimenes Tributarios</h5></CardHeader>
                    <CardBody>
                        {taxRegimes.length === 0 ? (
                            <p className="text-muted text-center py-3">Cargando datos...</p>
                        ) : (
                            <div className="table-responsive" style={{ maxHeight: '300px' }}>
                                <Table bordered size="sm" className="mb-0">
                                    <thead className="table-light sticky-top">
                                        <tr>
                                            <th>Codigo</th>
                                            <th>Nombre</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {taxRegimes.map((r: any, i: number) => (
                                            <tr key={i}>
                                                <td>{r.code || r.id || i + 1}</td>
                                                <td>{r.name || r.description || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </CardBody>
                </Card>

                <Card className="mb-3">
                    <CardHeader><h5 className="mb-0">Tipos de Identificacion</h5></CardHeader>
                    <CardBody>
                        {identificationTypes.length === 0 ? (
                            <p className="text-muted text-center py-3">Cargando datos...</p>
                        ) : (
                            <div className="table-responsive" style={{ maxHeight: '300px' }}>
                                <Table bordered size="sm" className="mb-0">
                                    <thead className="table-light sticky-top">
                                        <tr>
                                            <th>Codigo</th>
                                            <th>Nombre</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {identificationTypes.map((t: any, i: number) => (
                                            <tr key={i}>
                                                <td>{t.code || t.id || i + 1}</td>
                                                <td>{t.name || t.description || '-'}</td>
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
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return renderDashboard();
            case 'config':
                return renderConfig();
            case 'empresa':
                return renderEmpresa();
            case 'test-set':
                return renderTestSet();
            case 'estado':
                return renderEstado();
            case 'facturas':
                return renderFacturas();
            case 'notas':
                return renderNotas();
            case 'tablas-dian':
                return renderTablasDian();
            default:
                return renderDashboard();
        }
    };

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <Row className="mb-3"><Col>
                        <h4 className="mb-0">Integración Facturación Electrónica</h4>
                    </Col></Row>
                    <ModuleLayout sections={sidebarSections} activeItem={activeTab} onItemClick={setActiveTab}>
                        {renderContent()}
                    </ModuleLayout>
                </Container>
            </div>
        </React.Fragment>
    );
};

export default AlegraIntegrationPage;
