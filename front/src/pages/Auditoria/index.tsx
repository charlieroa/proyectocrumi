import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardBody, CardHeader, Col, Container, Input, Row, Spinner, Table } from 'reactstrap';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { api } from '../../services/api';
import { buildAuditoriaSidebarSections } from './config/auditoriaSidebar';

const AuditoriaPage: React.FC = () => {
    document.title = 'Auditoria | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<any>({ total: 0, byModule: [], bySeverity: [], byAction: [], recentActivity: [] });
    const [events, setEvents] = useState<any[]>([]);
    const [filters, setFilters] = useState({ module: '', severity: '', search: '' });

    const fetchSummary = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/auditoria/summary');
            setSummary(res.data || { total: 0, byModule: [], bySeverity: [], byAction: [], recentActivity: [] });
        } catch (error) {
            console.error('[Auditoria] Error cargando resumen:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/auditoria/events', {
                params: {
                    module: filters.module || undefined,
                    severity: filters.severity || undefined,
                    search: filters.search || undefined,
                    limit: 100,
                },
            });
            setEvents(res.data?.events || []);
        } catch (error) {
            console.error('[Auditoria] Error cargando eventos:', error);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [filters.module, filters.search, filters.severity]);

    useEffect(() => {
        if (activeTab === 'dashboard' || activeTab === 'actividad') {
            fetchSummary();
        }
        if (activeTab === 'eventos') {
            fetchEvents();
        }
    }, [activeTab, fetchEvents, fetchSummary]);

    const severityBadge = (severity: string) => {
        const colorMap: Record<string, string> = { INFO: 'info', WARN: 'warning', WARNING: 'warning', ERROR: 'danger', CRITICAL: 'dark' };
        return <Badge color={colorMap[severity] || 'secondary'}>{severity || 'N/A'}</Badge>;
    };

    const topModules = useMemo(() => (summary.byModule || []).slice(0, 5), [summary.byModule]);
    const topActions = useMemo(() => (summary.byAction || []).slice(0, 5), [summary.byAction]);

    const renderDashboard = () => (
        <>
            <Row className="g-3 mb-3">
                <Col md={3}><Card><CardBody className="text-center"><h4 className="mb-1">{summary.total || 0}</h4><p className="text-muted mb-0">Eventos totales</p></CardBody></Card></Col>
                <Col md={3}><Card><CardBody className="text-center"><h4 className="mb-1">{(summary.bySeverity || []).length}</h4><p className="text-muted mb-0">Niveles activos</p></CardBody></Card></Col>
                <Col md={3}><Card><CardBody className="text-center"><h4 className="mb-1">{topModules.length}</h4><p className="text-muted mb-0">Modulos con trazas</p></CardBody></Card></Col>
                <Col md={3}><Card><CardBody className="text-center"><h4 className="mb-1">{topActions.length}</h4><p className="text-muted mb-0">Acciones frecuentes</p></CardBody></Card></Col>
            </Row>
            <Row className="g-3">
                <Col xl={6}>
                    <Card>
                        <CardHeader><h6 className="mb-0">Eventos por modulo</h6></CardHeader>
                        <CardBody>
                            <Table responsive size="sm" className="mb-0">
                                <thead className="table-light"><tr><th>Modulo</th><th className="text-end">Eventos</th></tr></thead>
                                <tbody>
                                    {topModules.length === 0 ? <tr><td colSpan={2} className="text-center text-muted py-3">Sin datos</td></tr> : topModules.map((item: any) => (
                                        <tr key={item.module}><td>{item.module || 'Sin modulo'}</td><td className="text-end">{item.count}</td></tr>
                                    ))}
                                </tbody>
                            </Table>
                        </CardBody>
                    </Card>
                </Col>
                <Col xl={6}>
                    <Card>
                        <CardHeader><h6 className="mb-0">Acciones mas frecuentes</h6></CardHeader>
                        <CardBody>
                            <Table responsive size="sm" className="mb-0">
                                <thead className="table-light"><tr><th>Accion</th><th className="text-end">Eventos</th></tr></thead>
                                <tbody>
                                    {topActions.length === 0 ? <tr><td colSpan={2} className="text-center text-muted py-3">Sin datos</td></tr> : topActions.map((item: any) => (
                                        <tr key={item.action}><td>{item.action || 'Sin accion'}</td><td className="text-end">{item.count}</td></tr>
                                    ))}
                                </tbody>
                            </Table>
                        </CardBody>
                    </Card>
                </Col>
            </Row>
        </>
    );

    const renderEvents = () => (
        <Card>
            <CardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <h6 className="mb-0">Eventos de auditoria</h6>
                <div className="d-flex gap-2">
                    <Input bsSize="sm" placeholder="Modulo" value={filters.module} onChange={(e) => setFilters((prev) => ({ ...prev, module: e.target.value }))} />
                    <Input type="select" bsSize="sm" value={filters.severity} onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}>
                        <option value="">Todas las severidades</option>
                        <option value="INFO">Info</option>
                        <option value="WARN">Warn</option>
                        <option value="ERROR">Error</option>
                        <option value="CRITICAL">Critical</option>
                    </Input>
                    <Input bsSize="sm" placeholder="Buscar" value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} />
                </div>
            </CardHeader>
            <CardBody>
                {loading ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
                    <Table responsive hover size="sm" className="mb-0">
                        <thead className="table-light"><tr><th>Fecha</th><th>Modulo</th><th>Accion</th><th>Usuario</th><th>Severidad</th><th>Descripcion</th></tr></thead>
                        <tbody>
                            {events.length === 0 ? <tr><td colSpan={6} className="text-center text-muted py-3">Sin eventos para los filtros aplicados</td></tr> : events.map((event) => (
                                <tr key={event.id}>
                                    <td>{event.created_at ? new Date(event.created_at).toLocaleString('es-CO') : '-'}</td>
                                    <td>{event.module || '-'}</td>
                                    <td>{event.action || '-'}</td>
                                    <td>{event.user_name || '-'}</td>
                                    <td>{severityBadge(event.severity)}</td>
                                    <td>{event.description || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderRecentActivity = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Actividad reciente</h6></CardHeader>
            <CardBody>
                {loading ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
                    <Table responsive hover size="sm" className="mb-0">
                        <thead className="table-light"><tr><th>Fecha</th><th>Modulo</th><th>Usuario</th><th>Descripcion</th></tr></thead>
                        <tbody>
                            {(summary.recentActivity || []).length === 0 ? <tr><td colSpan={4} className="text-center text-muted py-3">Sin actividad reciente</td></tr> : (summary.recentActivity || []).map((item: any) => (
                                <tr key={item.id}>
                                    <td>{item.created_at ? new Date(item.created_at).toLocaleString('es-CO') : '-'}</td>
                                    <td>{item.module || '-'}</td>
                                    <td>{item.user_name || '-'}</td>
                                    <td>{item.description || '-'}</td>
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
            case 'eventos': return renderEvents();
            case 'actividad': return renderRecentActivity();
            default: return renderDashboard();
        }
    };

    return (
        <div className="page-content">
            <Container fluid>
                <Row className="mb-3"><Col><h4 className="mb-0">Auditoria</h4></Col></Row>
                <ModuleLayout sections={buildAuditoriaSidebarSections()} activeItem={activeTab} onItemClick={setActiveTab}>
                    {renderContent()}
                </ModuleLayout>
            </Container>
        </div>
    );
};

export default AuditoriaPage;
