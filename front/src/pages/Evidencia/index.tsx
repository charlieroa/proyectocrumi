import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardBody, CardHeader, Col, Container, Row, Spinner, Table } from 'reactstrap';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { api } from '../../services/api';
import { buildEvidenciaSidebarSections } from './config/evidenciaSidebar';

const EvidenciaPage: React.FC = () => {
    document.title = 'Evidencia | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [contracts, setContracts] = useState<any[]>([]);
    const [filings, setFilings] = useState<any[]>([]);

    const fetchEvidence = useCallback(async () => {
        setLoading(true);
        try {
            const [contractsRes, filingsRes] = await Promise.all([
                api.get('/contratos/contracts'),
                api.get('/cumplimiento/filings'),
            ]);

            setContracts(contractsRes.data?.data || []);
            setFilings(filingsRes.data?.data || []);
        } catch (error) {
            console.error('[Evidencia] Error cargando repositorio:', error);
            setContracts([]);
            setFilings([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEvidence();
    }, [fetchEvidence]);

    const repository = useMemo(() => {
        const contractDocs = contracts.map((item) => ({
            id: `contract-${item.id}`,
            type: 'CONTRATO',
            name: item.title,
            owner: item.party_name || '-',
            status: item.document_url ? 'DISPONIBLE' : 'FALTANTE',
            source: item.document_url || '',
            date: item.updated_at || item.created_at,
        }));

        const filingDocs = filings.map((item) => ({
            id: `filing-${item.id}`,
            type: 'CUMPLIMIENTO',
            name: item.obligation_name || `Presentacion ${item.period || item.id}`,
            owner: item.obligation_type || '-',
            status: item.evidence_url ? 'DISPONIBLE' : 'FALTANTE',
            source: item.evidence_url || '',
            date: item.filed_date || item.due_date || item.created_at,
        }));

        return [...contractDocs, ...filingDocs].sort((a, b) => {
            const aTime = a.date ? new Date(a.date).getTime() : 0;
            const bTime = b.date ? new Date(b.date).getTime() : 0;
            return bTime - aTime;
        });
    }, [contracts, filings]);

    const availableDocs = repository.filter((item) => item.status === 'DISPONIBLE');
    const missingDocs = repository.filter((item) => item.status === 'FALTANTE');

    const renderDocuments = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Repositorio documental</h6></CardHeader>
            <CardBody>
                {loading ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
                    <Table responsive hover size="sm" className="mb-0">
                        <thead className="table-light"><tr><th>Tipo</th><th>Nombre</th><th>Responsable</th><th>Fecha</th><th>Estado</th><th>Referencia</th></tr></thead>
                        <tbody>
                            {repository.length === 0 ? <tr><td colSpan={6} className="text-center text-muted py-3">Sin registros documentales</td></tr> : repository.map((item) => (
                                <tr key={item.id}>
                                    <td><Badge color={item.type === 'CONTRATO' ? 'primary' : 'info'}>{item.type}</Badge></td>
                                    <td>{item.name}</td>
                                    <td>{item.owner}</td>
                                    <td>{item.date ? new Date(item.date).toLocaleDateString('es-CO') : '-'}</td>
                                    <td><Badge color={item.status === 'DISPONIBLE' ? 'success' : 'danger'}>{item.status}</Badge></td>
                                    <td>{item.source || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </CardBody>
        </Card>
    );

    const renderMissing = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Evidencia pendiente de adjuntar</h6></CardHeader>
            <CardBody>
                {loading ? <div className="text-center py-4"><Spinner size="sm" /></div> : (
                    <Table responsive hover size="sm" className="mb-0">
                        <thead className="table-light"><tr><th>Tipo</th><th>Nombre</th><th>Responsable</th><th>Fecha referencia</th></tr></thead>
                        <tbody>
                            {missingDocs.length === 0 ? <tr><td colSpan={4} className="text-center text-muted py-3">No hay faltantes</td></tr> : missingDocs.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.type}</td>
                                    <td>{item.name}</td>
                                    <td>{item.owner}</td>
                                    <td>{item.date ? new Date(item.date).toLocaleDateString('es-CO') : '-'}</td>
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
                <Col md={4}><Card><CardBody className="text-center"><h4 className="mb-1">{repository.length}</h4><p className="text-muted mb-0">Registros auditables</p></CardBody></Card></Col>
                <Col md={4}><Card><CardBody className="text-center"><h4 className="mb-1 text-success">{availableDocs.length}</h4><p className="text-muted mb-0">Con evidencia</p></CardBody></Card></Col>
                <Col md={4}><Card><CardBody className="text-center"><h4 className="mb-1 text-danger">{missingDocs.length}</h4><p className="text-muted mb-0">Faltantes</p></CardBody></Card></Col>
            </Row>
            {renderDocuments()}
        </>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return renderDashboard();
            case 'documentos': return renderDocuments();
            case 'faltantes': return renderMissing();
            default: return renderDashboard();
        }
    };

    return (
        <div className="page-content">
            <Container fluid>
                <Row className="mb-3"><Col><h4 className="mb-0">Evidencia</h4></Col></Row>
                <ModuleLayout sections={buildEvidenciaSidebarSections()} activeItem={activeTab} onItemClick={setActiveTab}>
                    {renderContent()}
                </ModuleLayout>
            </Container>
        </div>
    );
};

export default EvidenciaPage;
