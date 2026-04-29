import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Table, Button, Spinner, Alert } from 'reactstrap';
import { api } from "../../services/api";

const CompaniesList = () => {
    document.title = "Listado de Empresas | Bolti";

    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadTenants = async () => {
            try {
                const { data } = await api.get('/tenants');
                setTenants(Array.isArray(data) ? data : []);
            } catch (e: any) {
                console.error('Error loading tenants:', e);
                setError(e?.response?.data?.error || 'Error al cargar empresas');
            } finally {
                setLoading(false);
            }
        };
        loadTenants();
    }, []);

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <Row>
                        <Col lg={12}>
                            <Card>
                                <CardHeader>
                                    <h4 className="card-title mb-0">Listado de Empresas</h4>
                                </CardHeader>
                                <CardBody>
                                    {loading ? (
                                        <div className="text-center py-5">
                                            <Spinner color="primary" />
                                            <p className="mt-2">Cargando empresas...</p>
                                        </div>
                                    ) : error ? (
                                        <Alert color="danger">{error}</Alert>
                                    ) : tenants.length === 0 ? (
                                        <Alert color="info">No hay empresas registradas.</Alert>
                                    ) : (
                                        <div className="table-responsive">
                                            <Table hover className="align-middle mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>ID</th>
                                                        <th>Nombre</th>
                                                        <th>Email</th>
                                                        <th>Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tenants.map((tenant: any) => (
                                                        <tr key={tenant.id}>
                                                            <td>{tenant.id}</td>
                                                            <td>{tenant.name || tenant.company_name || '-'}</td>
                                                            <td>{tenant.email || '-'}</td>
                                                            <td>
                                                                <span className={`badge bg-${tenant.status === 'active' ? 'success' : 'secondary'}`}>
                                                                    {tenant.status || 'activo'}
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

export default CompaniesList;
