import React, { useEffect, useState, useCallback } from 'react';
import {
    Container, Row, Col, Card, CardBody, CardHeader, Table,
    Spinner, Alert, Button, Modal, ModalHeader, ModalBody,
    ModalFooter, Input, Label, FormGroup,
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { api } from "../../services/api";

interface Employee {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    status: string;
    role_id: number;
}

const emptyForm = { first_name: '', last_name: '', email: '', phone: '', password: '' };

const InternalEmployeesPage = () => {
    document.title = "Empleados Internos | Bolti";

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const loadEmployees = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/users/tenant/1?role_ids=2,3');
            setEmployees(Array.isArray(data) ? data : []);
            setError(null);
        } catch (e: any) {
            console.error('Error loading employees:', e);
            setError(e?.response?.data?.error || 'Error al cargar empleados internos.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadEmployees(); }, [loadEmployees]);

    const openCreate = () => {
        setForm(emptyForm);
        setEditId(null);
        setModalMode('create');
        setFormError(null);
        setModalOpen(true);
    };

    const openEdit = (emp: Employee) => {
        setForm({
            first_name: emp.first_name || '',
            last_name: emp.last_name || '',
            email: emp.email || '',
            phone: emp.phone || '',
            password: '',
        });
        setEditId(emp.id);
        setModalMode('edit');
        setFormError(null);
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.first_name || !form.email) {
            setFormError('Nombre y email son obligatorios.');
            return;
        }
        if (modalMode === 'create' && !form.password) {
            setFormError('La contraseña es obligatoria para crear un empleado.');
            return;
        }

        setSaving(true);
        setFormError(null);

        try {
            if (modalMode === 'create') {
                await api.post('/users', {
                    tenant_id: 1,
                    role_id: 3,
                    first_name: form.first_name,
                    last_name: form.last_name,
                    email: form.email,
                    phone: form.phone || null,
                    password: form.password,
                });
            } else {
                const payload: any = {
                    first_name: form.first_name,
                    last_name: form.last_name,
                    email: form.email,
                    phone: form.phone || null,
                };
                if (form.password) payload.password = form.password;
                await api.put(`/users/${editId}`, payload);
            }
            setModalOpen(false);
            loadEmployees();
        } catch (e: any) {
            setFormError(e?.response?.data?.error || 'Error al guardar.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        const confirmRes = await Swal.fire({
            icon: 'question',
            title: '¿Confirmar?',
            text: '¿Estás seguro de eliminar este empleado?',
            showCancelButton: true,
            confirmButtonText: 'Sí',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1A1D1F',
        });
        if (!confirmRes.isConfirmed) return;
        try {
            await api.delete(`/users/${id}`);
            loadEmployees();
        } catch (e: any) {
            Swal.fire({ icon: 'error', title: e?.response?.data?.error || 'Error al eliminar empleado.', confirmButtonColor: '#1A1D1F' });
        }
    };

    const roleLabel = (role_id: number) => {
        if (role_id === 2) return 'Coordinador';
        if (role_id === 3) return 'Empleado';
        return String(role_id);
    };

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <Row>
                        <Col lg={12}>
                            <Card>
                                <CardHeader className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <h4 className="card-title mb-0">Empleados Internos</h4>
                                        <p className="text-muted mb-0 mt-1 small">Equipo interno de Bolti (tenant 1).</p>
                                    </div>
                                    <Button color="primary" size="sm" onClick={openCreate}>
                                        <i className="ri-add-line me-1"></i>Nuevo Empleado
                                    </Button>
                                </CardHeader>
                                <CardBody>
                                    {loading ? (
                                        <div className="text-center py-5">
                                            <Spinner color="primary" />
                                            <p className="mt-2">Cargando empleados...</p>
                                        </div>
                                    ) : error ? (
                                        <Alert color="danger">{error}</Alert>
                                    ) : employees.length === 0 ? (
                                        <Alert color="info">No hay empleados internos registrados.</Alert>
                                    ) : (
                                        <div className="table-responsive">
                                            <Table hover className="align-middle mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Nombre</th>
                                                        <th>Email</th>
                                                        <th>Teléfono</th>
                                                        <th>Rol</th>
                                                        <th>Estado</th>
                                                        <th>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {employees.map((emp) => (
                                                        <tr key={emp.id}>
                                                            <td className="fw-medium">
                                                                {[emp.first_name, emp.last_name].filter(Boolean).join(' ') || '-'}
                                                            </td>
                                                            <td>{emp.email || '-'}</td>
                                                            <td>{emp.phone || '-'}</td>
                                                            <td>{roleLabel(emp.role_id)}</td>
                                                            <td>
                                                                <span className={`badge bg-${(emp.status || 'active') === 'active' ? 'success' : 'secondary'}`}>
                                                                    {emp.status || 'activo'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <Button color="soft-primary" size="sm" className="me-1" onClick={() => openEdit(emp)}>
                                                                    <i className="ri-pencil-line"></i>
                                                                </Button>
                                                                <Button color="soft-danger" size="sm" onClick={() => handleDelete(emp.id)}>
                                                                    <i className="ri-delete-bin-line"></i>
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
                        </Col>
                    </Row>
                </Container>
            </div>

            {/* Modal Crear / Editar */}
            <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} centered>
                <ModalHeader toggle={() => setModalOpen(false)}>
                    {modalMode === 'create' ? 'Nuevo Empleado Interno' : 'Editar Empleado'}
                </ModalHeader>
                <ModalBody>
                    {formError && <Alert color="danger">{formError}</Alert>}
                    <FormGroup>
                        <Label>Nombre *</Label>
                        <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                    </FormGroup>
                    <FormGroup>
                        <Label>Apellido</Label>
                        <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                    </FormGroup>
                    <FormGroup>
                        <Label>Email *</Label>
                        <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </FormGroup>
                    <FormGroup>
                        <Label>Teléfono</Label>
                        <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </FormGroup>
                    <FormGroup>
                        <Label>{modalMode === 'create' ? 'Contraseña *' : 'Nueva Contraseña (dejar vacío para no cambiar)'}</Label>
                        <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                    </FormGroup>
                </ModalBody>
                <ModalFooter>
                    <Button color="light" onClick={() => setModalOpen(false)}>Cancelar</Button>
                    <Button color="primary" onClick={handleSave} disabled={saving}>
                        {saving ? <Spinner size="sm" /> : modalMode === 'create' ? 'Crear' : 'Guardar'}
                    </Button>
                </ModalFooter>
            </Modal>
        </React.Fragment>
    );
};

export default InternalEmployeesPage;
