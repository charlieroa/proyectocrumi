import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Table, Spinner, Alert } from 'reactstrap';
import { api } from "../../services/api";

const ContadoresList = () => {
    document.title = "Listado de Contadores | Bolti";

    const [contadores, setContadores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await api.get('/users/contadores');
                setContadores(Array.isArray(data) ? data : []);
            } catch (e: any) {
                console.error('Error loading contadores:', e);
                setError(e?.response?.data?.error || 'Error al cargar contadores.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <Row>
                        <Col lg={12}>
                            <Card>
                                <CardHeader>
                                    <h4 className="card-title mb-0">Listado de Espacios Contador</h4>
                                    <p className="text-muted mb-0 mt-1 small">Usuarios con Espacio Contador (gestión de múltiples clientes).</p>
                                </CardHeader>
                                <CardBody>
                                    {loading ? (
                                        <div className="text-center py-5">
                                            <Spinner color="primary" />
                                            <p className="mt-2">Cargando contadores...</p>
                                        </div>
                                    ) : error ? (
                                        <Alert color="danger">{error}</Alert>
                                    ) : contadores.length === 0 ? (
                                        <Alert color="info">No hay contadores registrados.</Alert>
                                    ) : (
                                        <div className="table-responsive">
                                            <Table hover className="align-middle mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Nombre</th>
                                                        <th>Email</th>
                                                        <th>Empresa</th>
                                                        <th>Teléfono</th>
                                                        <th>Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {contadores.map((c: any) => (
                                                        <tr key={c.id}>
                                                            <td className="fw-medium">
                                                                {[c.first_name, c.last_name].filter(Boolean).join(' ') || '-'}
                                                            </td>
                                                            <td>{c.email || '-'}</td>
                                                            <td>{c.tenant_name || '-'}</td>
                                                            <td>{c.phone || '-'}</td>
                                                            <td>
                                                                <span className={`badge bg-${(c.status || 'active') === 'active' ? 'success' : 'secondary'}`}>
                                                                    {c.status || 'activo'}
                                                                </span>
                                                            </td>
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
                </Container>
            </div>
        </React.Fragment>
    );
};

export default ContadoresList;
