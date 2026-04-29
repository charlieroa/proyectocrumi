import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardBody, Col, Container, Input, Row, Spinner } from 'reactstrap';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { api } from '../../services/api';
import SeguridadSocialTab from '../Nomina/tabs/SeguridadSocialTab';
import { buildPilaSidebarSections } from './config/pilaSidebar';

const PilaPage: React.FC = () => {
    document.title = 'PILA | Bolti';

    const now = new Date();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [loading, setLoading] = useState(false);
    const [periods, setPeriods] = useState<any[]>([]);

    const fetchPeriods = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/nomina/periodos', { params: { year: selectedYear, month: selectedMonth } });
            setPeriods(res.data?.periodos || []);
        } catch (error) {
            console.error('[PILA] Error cargando periodos:', error);
            setPeriods([]);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        fetchPeriods();
    }, [fetchPeriods]);

    const summary = useMemo(() => ({
        total: periods.length,
        cerrados: periods.filter((item) => item.status === 'cerrado').length,
        abiertos: periods.filter((item) => item.status !== 'cerrado').length,
    }), [periods]);

    const months = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
    ];
    const years = Array.from({ length: 5 }, (_, index) => now.getFullYear() - 2 + index);

    const renderDashboard = () => (
        <>
            <Row className="g-3 mb-3">
                <Col md={4}><Card><CardBody className="text-center"><h4 className="mb-1">{summary.total}</h4><p className="text-muted mb-0">Periodos encontrados</p></CardBody></Card></Col>
                <Col md={4}><Card><CardBody className="text-center"><h4 className="mb-1 text-success">{summary.cerrados}</h4><p className="text-muted mb-0">Cerrados</p></CardBody></Card></Col>
                <Col md={4}><Card><CardBody className="text-center"><h4 className="mb-1 text-warning">{summary.abiertos}</h4><p className="text-muted mb-0">En trabajo</p></CardBody></Card></Col>
            </Row>
            <Card>
                <CardBody>
                    {loading ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
                        <div className="text-muted">PILA queda disponible como flujo dedicado para calcular aportes y generar el archivo plano del periodo seleccionado.</div>
                    )}
                </CardBody>
            </Card>
        </>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return renderDashboard();
            case 'calculo': return <SeguridadSocialTab year={selectedYear} month={selectedMonth} />;
            default: return renderDashboard();
        }
    };

    return (
        <div className="page-content">
            <Container fluid>
                <Row className="mb-3">
                    <Col>
                        <div className="d-flex align-items-center justify-content-between">
                            <h4 className="mb-0">PILA</h4>
                            <div className="d-flex gap-2 align-items-center">
                                <Input type="select" bsSize="sm" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ width: 140 }}>
                                    {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                                </Input>
                                <Input type="select" bsSize="sm" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: 100 }}>
                                    {years.map((year) => <option key={year} value={year}>{year}</option>)}
                                </Input>
                            </div>
                        </div>
                    </Col>
                </Row>
                <ModuleLayout sections={buildPilaSidebarSections()} activeItem={activeTab} onItemClick={setActiveTab}>
                    {renderContent()}
                </ModuleLayout>
            </Container>
        </div>
    );
};

export default PilaPage;
