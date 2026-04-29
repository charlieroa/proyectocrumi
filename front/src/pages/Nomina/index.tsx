import React, { useEffect, useState, useCallback, lazy, Suspense, useMemo } from 'react';
import {
    Container, Row, Col,
    Card, CardBody, Input, Spinner
} from 'reactstrap';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import type { ModuleSidebarSection } from '../../Components/Common/ModuleSidebar';
import { env } from '../../env';

const EmpleadosTab = lazy(() => import('./tabs/EmpleadosTab'));
const LiquidacionTab = lazy(() => import('./tabs/LiquidacionTab'));
const NovedadesTab = lazy(() => import('./tabs/NovedadesTab'));
const ReportesTab = lazy(() => import('./tabs/ReportesTab'));
const PeriodosTab = lazy(() => import('./tabs/PeriodosTab'));

const API_BASE = env.API_URL;

const TabLoader = () => (
    <div className="text-center py-4"><Spinner color="primary" /></div>
);

const NóminaPage: React.FC = () => {
    document.title = 'Nómina | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);

    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

    const [summary, setSummary] = useState({
        empleadosActivos: 0,
        totalNóminaMes: 0,
        costoEmpresa: 0,
        novedadesPendientes: 0,
        lastPeriodStatus: ''
    });

    const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    const fetchDashboard = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/nomina/dashboard/summary`, { headers });
            const data = await res.json();
            if (data.success && data.summary) setSummary(data.summary);
        } catch (e) {
            console.error('Dashboard error:', e);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        fetchDashboard().finally(() => setLoading(false));
    }, [fetchDashboard]);

    const months = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
        { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
        { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
        { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
        { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
    ];

    const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

    const fmt = (n: number) => new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(n);

    const sidebarSections: ModuleSidebarSection[] = useMemo(() => [
        {
            id: 'general',
            title: 'General',
            items: [{ id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' }],
        },
        {
            id: 'gestion',
            title: 'Gestión',
            items: [
                { id: 'empleados', label: 'Empleados', icon: 'ri-team-line' },
                { id: 'novedades', label: 'Novedades', icon: 'ri-file-edit-line' },
            ],
        },
        {
            id: 'liquidacion',
            title: 'Liquidación',
            items: [{ id: 'liquidacion', label: 'Liquidación', icon: 'ri-calculator-line' }],
        },
        {
            id: 'contabilidad',
            title: 'Contabilidad',
            items: [{ id: 'periodos', label: 'Periodos contables', icon: 'ri-bank-line' }],
        },
        {
            id: 'reportes',
            title: 'Reportes',
            items: [{ id: 'reportes', label: 'Reportes', icon: 'ri-file-chart-line' }],
        },
    ], []);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <>
                        {/* Widgets */}
                        <Row>
                            {[
                                { label: 'Empleados Activos', value: summary.empleadosActivos, icon: 'ri-team-line', color: 'primary' },
                                { label: 'Total Nómina Mes', value: fmt(summary.totalNóminaMes), icon: 'ri-money-dollar-circle-line', color: 'success' },
                                { label: 'Costo Empresa', value: fmt(summary.costoEmpresa), icon: 'ri-building-2-line', color: 'info' },
                                { label: 'Novedades Pendientes', value: summary.novedadesPendientes, icon: 'ri-file-warning-line', color: 'warning' },
                            ].map((w, idx) => (
                                <Col key={idx} md={6} xl={3}>
                                    <Card className="card-animate">
                                        <CardBody>
                                            <div className="d-flex justify-content-between">
                                                <div>
                                                    <p className="text-uppercase text-muted fw-medium fs-12 mb-2">{w.label}</p>
                                                    <h4 className="fs-22 fw-semibold mb-0">
                                                        {loading ? <span className="placeholder-glow"><span className="placeholder col-6"></span></span> : w.value}
                                                    </h4>
                                                </div>
                                                <div className={`avatar-sm rounded-circle bg-${w.color}-subtle d-flex align-items-center justify-content-center`}>
                                                    <i className={`${w.icon} text-${w.color} fs-20`}></i>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                        <Card>
                            <CardBody>
                                {loading ? (
                                    <div className="text-center py-4"><Spinner color="primary" /></div>
                                ) : (
                                    <div className="text-center py-4">
                                        <i className="ri-dashboard-line fs-36 d-block mb-2 text-muted"></i>
                                        <h5>Resumen de Nómina</h5>
                                        <p className="text-muted">
                                            {summary.empleadosActivos} empleados activos |
                                            Último período: {summary.lastPeriodStatus || 'Sin periodos'}
                                        </p>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </>
                );
            case 'empleados':
                return <EmpleadosTab year={selectedYear} month={selectedMonth} />;
            case 'liquidacion':
                return <LiquidacionTab year={selectedYear} month={selectedMonth} />;
            case 'novedades':
                return <NovedadesTab year={selectedYear} month={selectedMonth} />;
            case 'reportes':
                return <ReportesTab year={selectedYear} month={selectedMonth} />;
            case 'periodos':
                return <PeriodosTab year={selectedYear} />;
            default:
                return null;
        }
    };

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    {/* Header */}
                    <Row className="mb-3">
                        <Col>
                            <div className="d-flex align-items-center justify-content-between">
                                <h4 className="mb-0">Nómina</h4>
                                <div className="d-flex gap-2 align-items-center">
                                    <Input type="select" bsSize="sm" value={selectedMonth}
                                        onChange={e => setSelectedMonth(Number(e.target.value))}
                                        style={{ width: 140 }}>
                                        {months.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </Input>
                                    <Input type="select" bsSize="sm" value={selectedYear}
                                        onChange={e => setSelectedYear(Number(e.target.value))}
                                        style={{ width: 100 }}>
                                        {years.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </Input>
                                </div>
                            </div>
                        </Col>
                    </Row>

                    {/* Module layout: sidebar + content */}
                    <ModuleLayout
                        sections={sidebarSections}
                        activeItem={activeTab}
                        onItemClick={setActiveTab}
                    >
                        <Suspense fallback={<TabLoader />}>
                            {renderContent()}
                        </Suspense>
                    </ModuleLayout>
                </Container>
            </div>
        </React.Fragment>
    );
};

export default NóminaPage;
