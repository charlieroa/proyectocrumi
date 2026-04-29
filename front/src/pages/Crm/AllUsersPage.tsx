import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Table, Spinner, Alert } from 'reactstrap';
import { api } from "../../services/api";

const roleLabel = (role_id: number): string => {
    switch (role_id) {
        case 1:  return 'Admin';
        case 2:  return 'Coordinador';
        case 3:  return 'Empleado';
        case 4:  return 'Contador';
        case 99: return 'Super Admin';
        default: return `Rol ${role_id}`;
    }
};

const AllUsersPage = () => {
    document.title = "Usuarios Registrados | Bolti";

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await api.get('/users/all');
                setUsers(Array.isArray(data) ? data : []);
            } catch (e: any) {
                console.error('Error loading users:', e);
                setError(e?.response?.data?.error || 'Error al cargar usuarios.');
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
                                    <h4 className="card-title mb-0">Usuarios Registrados</h4>
                                    <p className="text-muted mb-0 mt-1 small">Todos los usuarios de la plataforma.</p>
                                </CardHeader>
                                <CardBody>
                                    {loading ? (
                                        <div className="text-center py-5">
                                            <Spinner color="primary" />
                                            <p className="mt-2">Cargando usuarios...</p>
                                        </div>
                                    ) : error ? (
                                        <Alert color="danger">{error}</Alert>
                                    ) : users.length === 0 ? (
                                        <Alert color="info">No hay usuarios registrados.</Alert>
                                    ) : (
                                        <div className="table-responsive">
                                            <Table hover className="align-middle mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Nombre</th>
                                                        <th>Email</th>
                                                        <th>Empresa</th>
                                                        <th>Rol</th>
                                                        <th>Teléfono</th>
                                                        <th>Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {users.map((u: any) => (
                                                        <tr key={u.id}>
                                                            <td className="fw-medium">
                                                                {[u.first_name, u.last_name].filter(Boolean).join(' ') || '-'}
                                                            </td>
                                                            <td>{u.email || '-'}</td>
                                                            <td>{u.tenant_name || '-'}</td>
                                                            <td>
                                                                <span className="badge bg-soft-info text-info">
                                                                    {roleLabel(u.role_id)}
                                                                </span>
                                                            </td>
                                                            <td>{u.phone || '-'}</td>
                                                            <td>
                                                                <span className={`badge bg-${(u.status || 'active') === 'active' ? 'success' : 'secondary'}`}>
                                                                    {u.status || 'activo'}
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

export default AllUsersPage;
