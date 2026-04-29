import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Container, Row, Col,
    Card, CardBody, CardHeader, Table, Badge, Button,
    Spinner, Input, Label, Collapse
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { env } from '../../env';
import { buildConexionesSidebarSections } from './config/conexionesSidebar';

const API_BASE = env.API_URL;

const ConexionesExternasPage: React.FC = () => {
    document.title = 'Conexiones Externas | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');

    // Data state
    const [connections, setConnections] = useState<any[]>([]);
    const [selectedConnection, setSelectedConnection] = useState<string>('');
    const [syncHistory, setSyncHistory] = useState<any[]>([]);
    const [syncLogs, setSyncLogs] = useState<any[]>([]);
    const [dashboard, setDashboard] = useState<any>({ connections: { total: 0, active: 0 }, recentSyncs: 0 });

    // Loading states
    const [loadingDashboard, setLoadingDashboard] = useState(false);
    const [loadingConnections, setLoadingConnections] = useState(false);
    const [loadingSyncHistory, setLoadingSyncHistory] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // Expanded sync jobs (for events)
    const [expandedJob, setExpandedJob] = useState<string | null>(null);

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = useMemo(() => ({
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    }), [token]);

    // --- Fetchers ---
    const fetchDashboard = useCallback(async () => {
        setLoadingDashboard(true);
        try {
            const res = await fetch(`${API_BASE}/connections/dashboard`, { headers });
            const json = await res.json();
            if (json.success) setDashboard(json.data);
        } catch (e) { console.error('Error fetchDashboard:', e); }
        setLoadingDashboard(false);
    }, [headers]);

    const fetchConnections = useCallback(async () => {
        setLoadingConnections(true);
        try {
            const res = await fetch(`${API_BASE}/connections`, { headers });
            const json = await res.json();
            if (json.success) setConnections(json.data);
        } catch (e) { console.error('Error fetchConnections:', e); }
        setLoadingConnections(false);
    }, [headers]);

    const fetchSyncHistory = useCallback(async (connectionId: string) => {
        setLoadingSyncHistory(true);
        try {
            const res = await fetch(`${API_BASE}/connections/${connectionId}/sync-history`, { headers });
            const json = await res.json();
            if (json.success) setSyncHistory(json.data);
        } catch (e) { console.error('Error fetchSyncHistory:', e); }
        setLoadingSyncHistory(false);
    }, [headers]);

    const fetchLogs = useCallback(async () => {
        setLoadingLogs(true);
        try {
            const res = await fetch(`${API_BASE}/connections/logs`, { headers });
            const json = await res.json();
            if (json.success) setSyncLogs(json.data);
        } catch (e) { console.error('Error fetchLogs:', e); }
        setLoadingLogs(false);
    }, [headers]);

    const testConnection = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE}/connections/${id}/test`, { method: 'POST', headers });
            const json = await res.json();
            if (json.success) {
                const isOk = json.data.status === 'ok';
                Swal.fire({
                    icon: isOk ? 'success' : 'error',
                    title: `Test: ${isOk ? 'OK' : 'ERROR'} - ${json.data.message}`,
                    confirmButtonColor: '#1A1D1F',
                });
            } else {
                Swal.fire({ icon: 'error', title: 'Error al probar conexion: ' + (json.error || 'desconocido'), confirmButtonColor: '#1A1D1F' });
            }
        } catch (e) { console.error('Error testConnection:', e); }
    };

    const deleteConnection = async (id: string) => {
        const confirmRes = await Swal.fire({
            icon: 'question',
            title: '¿Confirmar?',
            text: 'Estas seguro de eliminar esta conexion?',
            showCancelButton: true,
            confirmButtonText: 'Sí',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1A1D1F',
        });
        if (!confirmRes.isConfirmed) return;
        try {
            const res = await fetch(`${API_BASE}/connections/${id}`, { method: 'DELETE', headers });
            const json = await res.json();
            if (json.success) {
                fetchConnections();
                fetchDashboard();
            } else {
                Swal.fire({ icon: 'error', title: 'Error al eliminar: ' + (json.error || 'desconocido'), confirmButtonColor: '#1A1D1F' });
            }
        } catch (e) { console.error('Error deleteConnection:', e); }
    };

    // --- Effects ---
    useEffect(() => {
        if (activeTab === 'dashboard') fetchDashboard();
        if (activeTab === 'conexiones') fetchConnections();
        if (activeTab === 'logs') fetchLogs();
    }, [activeTab, fetchDashboard, fetchConnections, fetchLogs]);

    useEffect(() => {
        if (activeTab === 'sync-history' && selectedConnection) {
            fetchSyncHistory(selectedConnection);
        }
    }, [activeTab, selectedConnection, fetchSyncHistory]);

    // Load connections for the sync-history selector
    useEffect(() => {
        if (activeTab === 'sync-history' && connections.length === 0) {
            fetchConnections();
        }
    }, [activeTab, connections.length, fetchConnections]);

    const sidebarSections = useMemo(() => buildConexionesSidebarSections(), []);

    const statusBadge = (status: string) => {
        const map: Record<string, string> = { ACTIVE: 'success', INACTIVE: 'secondary', ERROR: 'danger' };
        return <Badge color={map[status] || 'info'}>{status}</Badge>;
    };

    const formatDate = (d: string | null) => {
        if (!d) return '-';
        return new Date(d).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    };

    // --- Render tabs ---
    const renderDashboard = () => (
        <>
            {loadingDashboard ? (
                <div className="text-center py-4"><Spinner color="primary" /></div>
            ) : (
                <Row className="g-3">
                    <Col md={4}>
                        <Card>
                            <CardBody className="text-center">
                                <h4 className="mb-1">{dashboard.connections.total}</h4>
                                <p className="text-muted mb-0">Total Conexiones</p>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col md={4}>
                        <Card>
                            <CardBody className="text-center">
                                <h4 className="mb-1 text-success">{dashboard.connections.active}</h4>
                                <p className="text-muted mb-0">Activas</p>
                            </CardBody>
                        </Card>
                    </Col>
                    <Col md={4}>
                        <Card>
                            <CardBody className="text-center">
                                <h4 className="mb-1 text-info">{dashboard.recentSyncs}</h4>
                                <p className="text-muted mb-0">Syncs Ultima Semana</p>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
            )}
        </>
    );

    const renderConexiones = () => (
        <Card>
            <CardHeader className="d-flex align-items-center justify-content-between">
                <h5 className="mb-0">Conexiones</h5>
                <Button size="sm" color="soft-primary" onClick={fetchConnections}>
                    <i className="ri-refresh-line me-1" /> Actualizar
                </Button>
            </CardHeader>
            <CardBody>
                {loadingConnections ? (
                    <div className="text-center py-4"><Spinner color="primary" /></div>
                ) : connections.length === 0 ? (
                    <p className="text-muted text-center">No hay conexiones configuradas.</p>
                ) : (
                    <div className="table-responsive">
                        <Table className="table-hover align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Proveedor</th>
                                    <th>Estado</th>
                                    <th>Ultimo Sync</th>
                                    <th>Total Syncs</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {connections.map((c: any) => (
                                    <tr key={c.id}>
                                        <td className="fw-medium">{c.provider_name}</td>
                                        <td>{statusBadge(c.status)}</td>
                                        <td>{formatDate(c.last_sync_at)}</td>
                                        <td>{c.total_syncs || 0}</td>
                                        <td>
                                            <Button size="sm" color="soft-info" className="me-1" onClick={() => testConnection(c.id)}>
                                                <i className="ri-pulse-line me-1" /> Probar
                                            </Button>
                                            <Button size="sm" color="soft-danger" onClick={() => deleteConnection(c.id)}>
                                                <i className="ri-delete-bin-line me-1" /> Eliminar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                )}
            </CardBody>
        </Card>
    );

    const renderNuevaConexion = () => (
        <Card>
            <CardHeader>
                <h5 className="mb-0">Nueva Conexion</h5>
            </CardHeader>
            <CardBody>
                <div className="text-center py-4">
                    <i className="ri-plug-line fs-1 text-primary mb-3 d-block" />
                    <h5>Configurar nueva conexion externa</h5>
                    <p className="text-muted">
                        Las conexiones externas permiten sincronizar datos con la DIAN y otros servicios.
                        Actualmente se soporta la integración para facturación electrónica ante la DIAN.
                    </p>
                    <p className="text-muted">
                        Para configurar una nueva conexión, dirígete al módulo de <strong>Facturación Electrónica</strong>{' '}
                        desde Contabilidad, donde podrás registrar tu empresa y activar la sincronización automática
                        de facturas, notas crédito y notas débito.
                    </p>
                    <Button color="primary" onClick={() => window.location.href = '/contable/alegra'}>
                        <i className="ri-external-link-line me-1" /> Ir a Integracion Alegra
                    </Button>
                </div>
            </CardBody>
        </Card>
    );

    const renderSyncHistory = () => (
        <Card>
            <CardHeader>
                <h5 className="mb-0">Historial de Sincronizacion</h5>
            </CardHeader>
            <CardBody>
                <Row className="mb-3">
                    <Col md={6}>
                        <Label>Seleccionar conexion</Label>
                        <Input
                            type="select"
                            value={selectedConnection}
                            onChange={(e) => setSelectedConnection(e.target.value)}
                        >
                            <option value="">-- Seleccionar --</option>
                            {connections.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.provider_name}</option>
                            ))}
                        </Input>
                    </Col>
                </Row>

                {!selectedConnection ? (
                    <p className="text-muted text-center">Selecciona una conexion para ver su historial.</p>
                ) : loadingSyncHistory ? (
                    <div className="text-center py-4"><Spinner color="primary" /></div>
                ) : syncHistory.length === 0 ? (
                    <p className="text-muted text-center">No hay registros de sincronizacion.</p>
                ) : (
                    <div className="table-responsive">
                        <Table className="table-hover align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Fecha</th>
                                    <th>Estado</th>
                                    <th>Eventos</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {syncHistory.map((job: any) => (
                                    <React.Fragment key={job.id}>
                                        <tr>
                                            <td>{formatDate(job.created_at)}</td>
                                            <td>{statusBadge(job.status)}</td>
                                            <td>{job.events ? job.events.length : 0}</td>
                                            <td>
                                                <Button
                                                    size="sm"
                                                    color="soft-secondary"
                                                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                                                >
                                                    {expandedJob === job.id ? 'Ocultar' : 'Ver eventos'}
                                                </Button>
                                            </td>
                                        </tr>
                                        {expandedJob === job.id && job.events && (
                                            <tr>
                                                <td colSpan={4} className="p-0">
                                                    <Collapse isOpen={true}>
                                                        <div className="p-3 bg-light">
                                                            <Table size="sm" className="mb-0">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Tipo</th>
                                                                        <th>Entidad</th>
                                                                        <th>Mensaje</th>
                                                                        <th>Fecha</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {job.events.map((ev: any) => (
                                                                        <tr key={ev.id}>
                                                                            <td><Badge color="info">{ev.event_type}</Badge></td>
                                                                            <td>{ev.entity_type || '-'}</td>
                                                                            <td>{ev.message || '-'}</td>
                                                                            <td>{formatDate(ev.created_at)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </Table>
                                                        </div>
                                                    </Collapse>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                )}
            </CardBody>
        </Card>
    );

    const renderLogs = () => (
        <Card>
            <CardHeader className="d-flex align-items-center justify-content-between">
                <h5 className="mb-0">Logs de Sincronizacion</h5>
                <Button size="sm" color="soft-primary" onClick={fetchLogs}>
                    <i className="ri-refresh-line me-1" /> Actualizar
                </Button>
            </CardHeader>
            <CardBody>
                {loadingLogs ? (
                    <div className="text-center py-4"><Spinner color="primary" /></div>
                ) : syncLogs.length === 0 ? (
                    <p className="text-muted text-center">No hay logs de sincronizacion.</p>
                ) : (
                    <div className="table-responsive">
                        <Table className="table-hover align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Fecha</th>
                                    <th>Proveedor</th>
                                    <th>Tipo Evento</th>
                                    <th>Entidad</th>
                                    <th>Mensaje</th>
                                </tr>
                            </thead>
                            <tbody>
                                {syncLogs.map((log: any) => (
                                    <tr key={log.id}>
                                        <td>{formatDate(log.created_at)}</td>
                                        <td className="fw-medium">{log.provider_name}</td>
                                        <td><Badge color="info">{log.event_type}</Badge></td>
                                        <td>{log.entity_type || '-'}</td>
                                        <td>{log.message || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                )}
            </CardBody>
        </Card>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return renderDashboard();
            case 'conexiones': return renderConexiones();
            case 'nueva': return renderNuevaConexion();
            case 'sync-history': return renderSyncHistory();
            case 'logs': return renderLogs();
            default: return renderDashboard();
        }
    };

    return (
        <div className="page-content">
            <Container fluid>
                <Row className="mb-3">
                    <Col>
                        <h4 className="mb-0">Conexiones Externas</h4>
                    </Col>
                </Row>
                <ModuleLayout
                    sections={sidebarSections}
                    activeItem={activeTab}
                    onItemClick={(id: string) => setActiveTab(id)}
                >
                    {renderContent()}
                </ModuleLayout>
            </Container>
        </div>
    );
};

export default ConexionesExternasPage;
