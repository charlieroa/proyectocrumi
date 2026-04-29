import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, Col, Container, Input, Row, Spinner, Table } from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { api } from '../../services/api';
import { buildAprobacionesSidebarSections } from './config/aprobacionesSidebar';

const AprobacionesPage: React.FC = () => {
    document.title = 'Aprobaciones | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [pending, setPending] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [statusFilter, setStatusFilter] = useState('');

    const fetchPending = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/aprobaciones/requests/my-pending');
            setPending(res.data || []);
        } catch (error) {
            console.error('[Aprobaciones] Error cargando pendientes:', error);
            setPending([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/aprobaciones/requests', { params: { status: statusFilter || undefined } });
            setRequests(res.data || []);
        } catch (error) {
            console.error('[Aprobaciones] Error cargando solicitudes:', error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    const fetchWorkflows = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/aprobaciones/workflows');
            setWorkflows(res.data || []);
        } catch (error) {
            console.error('[Aprobaciones] Error cargando flujos:', error);
            setWorkflows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/aprobaciones/history');
            setHistory(res.data || []);
        } catch (error) {
            console.error('[Aprobaciones] Error cargando historial:', error);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchPending();
            fetchRequests();
            fetchWorkflows();
            fetchHistory();
            return;
        }
        if (activeTab === 'pendientes') fetchPending();
        if (activeTab === 'solicitudes') fetchRequests();
        if (activeTab === 'flujos') fetchWorkflows();
        if (activeTab === 'historial') fetchHistory();
    }, [activeTab, fetchHistory, fetchPending, fetchRequests, fetchWorkflows]);

    const handleDecision = async (requestId: number, action: 'approve' | 'reject') => {
        const promptResult = await Swal.fire({
            icon: 'question',
            title: action === 'approve' ? 'Comentarios de aprobacion (opcional)' : 'Motivo del rechazo',
            input: 'text',
            showCancelButton: true,
            confirmButtonText: 'Sí',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1A1D1F',
        });
        if (!promptResult.isConfirmed) return;
        const comments = promptResult.value ?? '';
        try {
            await api.post(`/aprobaciones/requests/${requestId}/${action}`, { comments });
            fetchPending();
            fetchRequests();
            fetchHistory();
        } catch (error) {
            console.error(`[Aprobaciones] Error ${action}:`, error);
            Swal.fire({
                icon: 'error',
                title: `No fue posible ${action === 'approve' ? 'aprobar' : 'rechazar'} la solicitud.`,
                confirmButtonColor: '#1A1D1F',
            });
        }
    };

    const statusBadge = (status: string) => {
        const colorMap: Record<string, string> = { PENDIENTE: 'warning', APROBADA: 'success', RECHAZADA: 'danger' };
        return <Badge color={colorMap[status] || 'secondary'}>{status}</Badge>;
    };

    const metrics = useMemo(() => ({
        pendientes: pending.length,
        solicitudes: requests.length,
        flujos: workflows.length,
        resueltas: history.length,
    }), [history.length, pending.length, requests.length, workflows.length]);

    const renderPending = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Pendientes por decidir</h6></CardHeader>
            <CardBody>
                {loading ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
                    <Table responsive hover size="sm" className="mb-0">
                        <thead className="table-light"><tr><th>Entidad</th><th>Solicitante</th><th>Paso</th><th>Estado</th><th>Acciones</th></tr></thead>
                        <tbody>
                            {pending.length === 0 ? <tr><td colSpan={5} className="text-center text-muted py-3">Sin pendientes asignados</td></tr> : pending.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.entity_description || `${item.entity_type} #${item.entity_id}`}</td>
                                    <td>{item.requested_by_name || '-'}</td>
                                    <td>{item.step_order || item.current_step}</td>
                                    <td>{statusBadge(item.status)}</td>
                                    <td>
                                        <div className="d-flex gap-1">
                                            <Button size="sm" color="soft-success" onClick={() => handleDecision(item.id, 'approve')}>Aprobar</Button>
                                            <Button size="sm" color="soft-danger" onClick={() => handleDecision(item.id, 'reject')}>Rechazar</Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderRequests = () => (
        <Card>
            <CardHeader className="d-flex align-items-center justify-content-between">
                <h6 className="mb-0">Solicitudes</h6>
                <Input type="select" bsSize="sm" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">Todos los estados</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="APROBADA">Aprobada</option>
                    <option value="RECHAZADA">Rechazada</option>
                </Input>
            </CardHeader>
            <CardBody>
                {loading ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
                    <Table responsive hover size="sm" className="mb-0">
                        <thead className="table-light"><tr><th>Entidad</th><th>Solicitante</th><th>Workflow</th><th>Estado</th><th>Paso actual</th></tr></thead>
                        <tbody>
                            {requests.length === 0 ? <tr><td colSpan={5} className="text-center text-muted py-3">Sin solicitudes registradas</td></tr> : requests.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.entity_description || `${item.entity_type} #${item.entity_id}`}</td>
                                    <td>{item.requested_by_name || '-'}</td>
                                    <td>{item.workflow_id || '-'}</td>
                                    <td>{statusBadge(item.status)}</td>
                                    <td>{item.current_step || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderWorkflows = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Flujos configurados</h6></CardHeader>
            <CardBody>
                {loading ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
                    <Table responsive hover size="sm" className="mb-0">
                        <thead className="table-light"><tr><th>Nombre</th><th>Entidad</th><th>Pasos</th></tr></thead>
                        <tbody>
                            {workflows.length === 0 ? <tr><td colSpan={3} className="text-center text-muted py-3">Sin flujos configurados</td></tr> : workflows.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.name}</td>
                                    <td>{item.entity_type}</td>
                                    <td>{Array.isArray(item.steps) ? item.steps.length : 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderHistory = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Historial de decisiones</h6></CardHeader>
            <CardBody>
                {loading ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
                    <Table responsive hover size="sm" className="mb-0">
                        <thead className="table-light"><tr><th>Entidad</th><th>Estado final</th><th>Actualizada</th><th>Pasos</th></tr></thead>
                        <tbody>
                            {history.length === 0 ? <tr><td colSpan={4} className="text-center text-muted py-3">Sin historial disponible</td></tr> : history.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.entity_description || `${item.entity_type} #${item.entity_id}`}</td>
                                    <td>{statusBadge(item.status)}</td>
                                    <td>{item.updated_at ? new Date(item.updated_at).toLocaleString('es-CO') : '-'}</td>
                                    <td>{Array.isArray(item.steps) ? item.steps.length : 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderDashboard = () => (
        <>
            <Row className="g-3 mb-3">
                <Col md={3}><Card><CardBody className="text-center"><h4 className="mb-1">{metrics.pendientes}</h4><p className="text-muted mb-0">Pendientes</p></CardBody></Card></Col>
                <Col md={3}><Card><CardBody className="text-center"><h4 className="mb-1">{metrics.solicitudes}</h4><p className="text-muted mb-0">Solicitudes</p></CardBody></Card></Col>
                <Col md={3}><Card><CardBody className="text-center"><h4 className="mb-1">{metrics.flujos}</h4><p className="text-muted mb-0">Flujos</p></CardBody></Card></Col>
                <Col md={3}><Card><CardBody className="text-center"><h4 className="mb-1">{metrics.resueltas}</h4><p className="text-muted mb-0">Resueltas</p></CardBody></Card></Col>
            </Row>
            <Row className="g-3">
                <Col xl={7}>{renderPending()}</Col>
                <Col xl={5}>{renderWorkflows()}</Col>
            </Row>
        </>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return renderDashboard();
            case 'pendientes': return renderPending();
            case 'solicitudes': return renderRequests();
            case 'flujos': return renderWorkflows();
            case 'historial': return renderHistory();
            default: return renderDashboard();
        }
    };

    return (
        <div className="page-content">
            <Container fluid>
                <Row className="mb-3"><Col><h4 className="mb-0">Aprobaciones</h4></Col></Row>
                <ModuleLayout sections={buildAprobacionesSidebarSections()} activeItem={activeTab} onItemClick={setActiveTab}>
                    {renderContent()}
                </ModuleLayout>
            </Container>
        </div>
    );
};

export default AprobacionesPage;
