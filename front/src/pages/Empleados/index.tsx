import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Container, Row, Col,
    Card, CardBody, CardHeader, Table, Badge, Input, Button,
    Spinner, Label, Modal, ModalHeader, ModalBody, ModalFooter
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { env } from '../../env';
import { buildEmpleadosSidebarSections } from './config/empleadosSidebar';

const API_BASE = env.API_URL;

const EmpleadosPage: React.FC = () => {
    document.title = 'Empleados | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');

    // Employees state
    const [employees, setEmployees] = useState<any[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Afiliaciones & Contratos
    const [afiliaciones, setAfiliaciones] = useState<any[]>([]);
    const [afiliacionesLoading, setAfiliacionesLoading] = useState(false);
    const [contratos, setContratos] = useState<any[]>([]);
    const [contratosLoading, setContratosLoading] = useState(false);

    // Employee form
    const [employeeForm, setEmployeeForm] = useState<any>({
        first_name: '',
        last_name: '',
        document_type: 'CC',
        document_number: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        department: '',
        birth_date: '',
        hire_date: '',
        position: '',
        base_salary: '',
        contract_type: 'INDEFINIDO',
        department_area: '',
        is_active: true,
    });

    // Auth
    const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const fmt = (v: number) => Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

    // ---- Fetch functions ----

    const fetchEmployees = useCallback(async () => {
        setEmployeesLoading(true);
        try {
            const res = await fetch(`${API_BASE}/nomina/empleados`, { headers });
            const data = await res.json();
            setEmployees(Array.isArray(data) ? data : data.data || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        } finally {
            setEmployeesLoading(false);
        }
    }, []);

    const fetchEmployeeDetail = useCallback(async (id: number) => {
        try {
            const res = await fetch(`${API_BASE}/nomina/empleados/${id}`, { headers });
            const data = await res.json();
            setSelectedEmployee(data);
        } catch (err) {
            console.error('Error fetching employee detail:', err);
        }
    }, []);

    const fetchAfiliaciones = useCallback(async (id: number) => {
        setAfiliacionesLoading(true);
        try {
            const res = await fetch(`${API_BASE}/nomina/empleados/${id}/afiliaciones`, { headers });
            const data = await res.json();
            setAfiliaciones(Array.isArray(data) ? data : data.data || []);
        } catch (err) {
            console.error('Error fetching afiliaciones:', err);
        } finally {
            setAfiliacionesLoading(false);
        }
    }, []);

    const fetchContratos = useCallback(async (id: number) => {
        setContratosLoading(true);
        try {
            const res = await fetch(`${API_BASE}/nomina/empleados/${id}/contratos`, { headers });
            const data = await res.json();
            setContratos(Array.isArray(data) ? data : data.data || []);
        } catch (err) {
            console.error('Error fetching contratos:', err);
        } finally {
            setContratosLoading(false);
        }
    }, []);

    const handleCreateEmployee = async () => {
        try {
            const res = await fetch(`${API_BASE}/nomina/empleados`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    ...employeeForm,
                    base_salary: Number(employeeForm.base_salary) || 0,
                }),
            });
            if (res.ok) {
                setEmployeeForm({
                    first_name: '', last_name: '', document_type: 'CC', document_number: '',
                    email: '', phone: '', address: '', city: '', department: '', birth_date: '',
                    hire_date: '', position: '', base_salary: '', contract_type: 'INDEFINIDO',
                    department_area: '', is_active: true,
                });
                fetchEmployees();
                setActiveTab('directorio');
            } else {
                const err = await res.json();
                Swal.fire({ icon: 'error', title: err.message || 'Error al crear empleado', confirmButtonColor: '#1A1D1F' });
            }
        } catch (err) {
            console.error('Error creating employee:', err);
        }
    };

    const handleUpdateEmployee = async (id: number, payload: any) => {
        try {
            const res = await fetch(`${API_BASE}/nomina/empleados/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                fetchEmployees();
                fetchEmployeeDetail(id);
            }
        } catch (err) {
            console.error('Error updating employee:', err);
        }
    };

    // Initial load
    useEffect(() => {
        fetchEmployees();
    }, []);

    // Load detail data when selectedEmployee changes
    useEffect(() => {
        if (selectedEmployee?.id) {
            if (activeTab === 'afiliaciones') fetchAfiliaciones(selectedEmployee.id);
            if (activeTab === 'contratos') fetchContratos(selectedEmployee.id);
        }
    }, [selectedEmployee?.id, activeTab]);

    // Sidebar
    const sidebarSections = useMemo(() => buildEmpleadosSidebarSections(), []);

    // Computed
    const activeEmployees = employees.filter(e => e.is_active);
    const inactiveEmployees = employees.filter(e => !e.is_active);
    const avgSalary = activeEmployees.length > 0
        ? activeEmployees.reduce((sum, e) => sum + Number(e.base_salary || 0), 0) / activeEmployees.length
        : 0;

    const filteredEmployees = employees.filter(e => {
        const term = searchTerm.toLowerCase();
        return (
            (e.first_name || '').toLowerCase().includes(term) ||
            (e.last_name || '').toLowerCase().includes(term) ||
            (e.document_number || '').toLowerCase().includes(term) ||
            (e.position || '').toLowerCase().includes(term) ||
            (e.department_area || '').toLowerCase().includes(term)
        );
    });

    // ---- Render ----

    const renderDashboard = () => (
        <>
            <Row className="mb-3">
                <Col md={3}>
                    <Card className="border shadow-sm">
                        <CardBody className="text-center">
                            <h6 className="text-muted mb-1">Total Empleados</h6>
                            <h3 className="mb-0">{employees.length}</h3>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="border shadow-sm">
                        <CardBody className="text-center">
                            <h6 className="text-muted mb-1">Activos</h6>
                            <h3 className="mb-0 text-success">{activeEmployees.length}</h3>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="border shadow-sm">
                        <CardBody className="text-center">
                            <h6 className="text-muted mb-1">Inactivos</h6>
                            <h3 className="mb-0 text-danger">{inactiveEmployees.length}</h3>
                        </CardBody>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="border shadow-sm">
                        <CardBody className="text-center">
                            <h6 className="text-muted mb-1">Salario Promedio</h6>
                            <h3 className="mb-0">${fmt(avgSalary)}</h3>
                        </CardBody>
                    </Card>
                </Col>
            </Row>

            <Card>
                <CardHeader><h6 className="mb-0">Contrataciones Recientes</h6></CardHeader>
                <CardBody>
                    {employeesLoading ? (
                        <div className="text-center py-4"><Spinner size="sm" /></div>
                    ) : (
                        <Table responsive hover size="sm">
                            <thead className="table-light">
                                <tr>
                                    <th>Nombre</th>
                                    <th>Cargo</th>
                                    <th>Fecha Ingreso</th>
                                    <th>Salario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...activeEmployees]
                                    .sort((a, b) => new Date(b.hire_date).getTime() - new Date(a.hire_date).getTime())
                                    .slice(0, 10)
                                    .map((e, i) => (
                                        <tr key={i}>
                                            <td>{e.first_name} {e.last_name}</td>
                                            <td>{e.position}</td>
                                            <td>{e.hire_date ? new Date(e.hire_date).toLocaleDateString('es-CO') : '-'}</td>
                                            <td>${fmt(e.base_salary)}</td>
                                        </tr>
                                    ))}
                                {activeEmployees.length === 0 && (
                                    <tr><td colSpan={4} className="text-center text-muted">Sin empleados registrados</td></tr>
                                )}
                            </tbody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </>
    );

    const renderDirectorio = () => (
        <Card>
            <CardHeader>
                <div className="d-flex align-items-center justify-content-between">
                    <h6 className="mb-0">Directorio de Empleados</h6>
                    <Input
                        type="text"
                        bsSize="sm"
                        placeholder="Buscar por nombre, documento, cargo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ maxWidth: 300 }}
                    />
                </div>
            </CardHeader>
            <CardBody>
                {employeesLoading ? (
                    <div className="text-center py-4"><Spinner size="sm" /></div>
                ) : (
                    <Table responsive hover size="sm">
                        <thead className="table-light">
                            <tr>
                                <th>Nombre</th>
                                <th>Documento</th>
                                <th>Cargo</th>
                                <th>Departamento</th>
                                <th>Fecha Ingreso</th>
                                <th>Salario</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map((e, i) => (
                                <tr key={i}>
                                    <td>{e.first_name} {e.last_name}</td>
                                    <td>{e.document_type} {e.document_number}</td>
                                    <td>{e.position}</td>
                                    <td>{e.department_area}</td>
                                    <td>{e.hire_date ? new Date(e.hire_date).toLocaleDateString('es-CO') : '-'}</td>
                                    <td>${fmt(e.base_salary)}</td>
                                    <td>
                                        <Badge color={e.is_active ? 'success' : 'danger'} pill>
                                            {e.is_active ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </td>
                                    <td>
                                        <Button color="info" size="sm" outline onClick={() => {
                                            fetchEmployeeDetail(e.id);
                                            setSelectedEmployee(e);
                                            setShowModal(true);
                                        }}>
                                            Ver detalle
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <tr><td colSpan={8} className="text-center text-muted">No se encontraron empleados</td></tr>
                            )}
                        </tbody>
                    </Table>
                )}
            </CardBody>

            {/* Detail Modal */}
            <Modal isOpen={showModal} toggle={() => setShowModal(false)} size="lg">
                <ModalHeader toggle={() => setShowModal(false)}>
                    Detalle del Empleado
                </ModalHeader>
                <ModalBody>
                    {selectedEmployee ? (
                        <Row>
                            <Col md={6}>
                                <p><strong>Nombre:</strong> {selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                                <p><strong>Documento:</strong> {selectedEmployee.document_type} {selectedEmployee.document_number}</p>
                                <p><strong>Email:</strong> {selectedEmployee.email || '-'}</p>
                                <p><strong>Telefono:</strong> {selectedEmployee.phone || '-'}</p>
                                <p><strong>Direccion:</strong> {selectedEmployee.address || '-'}</p>
                                <p><strong>Ciudad:</strong> {selectedEmployee.city || '-'}</p>
                            </Col>
                            <Col md={6}>
                                <p><strong>Departamento:</strong> {selectedEmployee.department || '-'}</p>
                                <p><strong>Area:</strong> {selectedEmployee.department_area || '-'}</p>
                                <p><strong>Cargo:</strong> {selectedEmployee.position || '-'}</p>
                                <p><strong>Fecha Nacimiento:</strong> {selectedEmployee.birth_date ? new Date(selectedEmployee.birth_date).toLocaleDateString('es-CO') : '-'}</p>
                                <p><strong>Fecha Ingreso:</strong> {selectedEmployee.hire_date ? new Date(selectedEmployee.hire_date).toLocaleDateString('es-CO') : '-'}</p>
                                <p><strong>Salario Base:</strong> ${fmt(selectedEmployee.base_salary)}</p>
                                <p><strong>Tipo Contrato:</strong> {selectedEmployee.contract_type}</p>
                                <p><strong>Estado:</strong>{' '}
                                    <Badge color={selectedEmployee.is_active ? 'success' : 'danger'} pill>
                                        {selectedEmployee.is_active ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                </p>
                            </Col>
                        </Row>
                    ) : (
                        <div className="text-center py-4"><Spinner size="sm" /></div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" size="sm" onClick={() => setShowModal(false)}>Cerrar</Button>
                </ModalFooter>
            </Modal>
        </Card>
    );

    const renderNuevo = () => (
        <Card>
            <CardHeader><h6 className="mb-0">Nuevo Empleado</h6></CardHeader>
            <CardBody>
                <Row>
                    <Col md={4}>
                        <Label size="sm">Nombre</Label>
                        <Input bsSize="sm" value={employeeForm.first_name}
                            onChange={e => setEmployeeForm({ ...employeeForm, first_name: e.target.value })} />
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Apellido</Label>
                        <Input bsSize="sm" value={employeeForm.last_name}
                            onChange={e => setEmployeeForm({ ...employeeForm, last_name: e.target.value })} />
                    </Col>
                    <Col md={2}>
                        <Label size="sm">Tipo Doc.</Label>
                        <Input type="select" bsSize="sm" value={employeeForm.document_type}
                            onChange={e => setEmployeeForm({ ...employeeForm, document_type: e.target.value })}>
                            <option value="CC">CC</option>
                            <option value="CE">CE</option>
                            <option value="TI">TI</option>
                            <option value="PP">PP</option>
                            <option value="NIT">NIT</option>
                        </Input>
                    </Col>
                    <Col md={2}>
                        <Label size="sm">No. Documento</Label>
                        <Input bsSize="sm" value={employeeForm.document_number}
                            onChange={e => setEmployeeForm({ ...employeeForm, document_number: e.target.value })} />
                    </Col>
                </Row>
                <Row className="mt-2">
                    <Col md={4}>
                        <Label size="sm">Email</Label>
                        <Input type="email" bsSize="sm" value={employeeForm.email}
                            onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })} />
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Telefono</Label>
                        <Input bsSize="sm" value={employeeForm.phone}
                            onChange={e => setEmployeeForm({ ...employeeForm, phone: e.target.value })} />
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Direccion</Label>
                        <Input bsSize="sm" value={employeeForm.address}
                            onChange={e => setEmployeeForm({ ...employeeForm, address: e.target.value })} />
                    </Col>
                </Row>
                <Row className="mt-2">
                    <Col md={4}>
                        <Label size="sm">Ciudad</Label>
                        <Input bsSize="sm" value={employeeForm.city}
                            onChange={e => setEmployeeForm({ ...employeeForm, city: e.target.value })} />
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Departamento (region)</Label>
                        <Input bsSize="sm" value={employeeForm.department}
                            onChange={e => setEmployeeForm({ ...employeeForm, department: e.target.value })} />
                    </Col>
                    <Col md={4}>
                        <Label size="sm">Fecha Nacimiento</Label>
                        <Input type="date" bsSize="sm" value={employeeForm.birth_date}
                            onChange={e => setEmployeeForm({ ...employeeForm, birth_date: e.target.value })} />
                    </Col>
                </Row>
                <Row className="mt-2">
                    <Col md={3}>
                        <Label size="sm">Fecha Ingreso</Label>
                        <Input type="date" bsSize="sm" value={employeeForm.hire_date}
                            onChange={e => setEmployeeForm({ ...employeeForm, hire_date: e.target.value })} />
                    </Col>
                    <Col md={3}>
                        <Label size="sm">Cargo</Label>
                        <Input bsSize="sm" value={employeeForm.position}
                            onChange={e => setEmployeeForm({ ...employeeForm, position: e.target.value })} />
                    </Col>
                    <Col md={3}>
                        <Label size="sm">Salario Base</Label>
                        <Input type="number" bsSize="sm" value={employeeForm.base_salary}
                            onChange={e => setEmployeeForm({ ...employeeForm, base_salary: e.target.value })} />
                    </Col>
                    <Col md={3}>
                        <Label size="sm">Tipo Contrato</Label>
                        <Input type="select" bsSize="sm" value={employeeForm.contract_type}
                            onChange={e => setEmployeeForm({ ...employeeForm, contract_type: e.target.value })}>
                            <option value="INDEFINIDO">Indefinido</option>
                            <option value="FIJO">Fijo</option>
                            <option value="OBRA_LABOR">Obra / Labor</option>
                            <option value="PRESTACION_SERVICIOS">Prestacion de Servicios</option>
                        </Input>
                    </Col>
                </Row>
                <Row className="mt-2">
                    <Col md={4}>
                        <Label size="sm">Area / Departamento</Label>
                        <Input bsSize="sm" value={employeeForm.department_area}
                            onChange={e => setEmployeeForm({ ...employeeForm, department_area: e.target.value })} />
                    </Col>
                    <Col md={4} className="d-flex align-items-end">
                        <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" checked={employeeForm.is_active}
                                onChange={e => setEmployeeForm({ ...employeeForm, is_active: e.target.checked })} />
                            <label className="form-check-label">Activo</label>
                        </div>
                    </Col>
                </Row>
                <Row className="mt-3">
                    <Col>
                        <Button color="primary" onClick={handleCreateEmployee}>
                            <i className="ri-save-line me-1"></i>Guardar Empleado
                        </Button>
                    </Col>
                </Row>
            </CardBody>
        </Card>
    );

    const renderAfiliaciones = () => {
        if (!selectedEmployee) {
            return (
                <Card>
                    <CardBody className="text-center text-muted py-5">
                        <i className="ri-user-search-line" style={{ fontSize: 48 }}></i>
                        <p className="mt-2">Selecciona un empleado del directorio</p>
                        <Button color="primary" size="sm" outline onClick={() => setActiveTab('directorio')}>
                            Ir al Directorio
                        </Button>
                    </CardBody>
                </Card>
            );
        }

        return (
            <Card>
                <CardHeader>
                    <h6 className="mb-0">Afiliaciones - {selectedEmployee.first_name} {selectedEmployee.last_name}</h6>
                </CardHeader>
                <CardBody>
                    {afiliacionesLoading ? (
                        <div className="text-center py-4"><Spinner size="sm" /></div>
                    ) : (
                        <Table responsive hover size="sm">
                            <thead className="table-light">
                                <tr>
                                    <th>Tipo</th>
                                    <th>Entidad</th>
                                    <th>Numero</th>
                                    <th>Fecha Inicio</th>
                                    <th>Fecha Fin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {afiliaciones.map((a, i) => (
                                    <tr key={i}>
                                        <td><Badge color="info">{a.type || a.tipo}</Badge></td>
                                        <td>{a.entity_name || a.entidad}</td>
                                        <td>{a.number || a.numero}</td>
                                        <td>{a.start_date ? new Date(a.start_date).toLocaleDateString('es-CO') : '-'}</td>
                                        <td>{a.end_date ? new Date(a.end_date).toLocaleDateString('es-CO') : '-'}</td>
                                    </tr>
                                ))}
                                {afiliaciones.length === 0 && (
                                    <tr><td colSpan={5} className="text-center text-muted">Sin afiliaciones registradas</td></tr>
                                )}
                            </tbody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        );
    };

    const renderContratos = () => {
        if (!selectedEmployee) {
            return (
                <Card>
                    <CardBody className="text-center text-muted py-5">
                        <i className="ri-user-search-line" style={{ fontSize: 48 }}></i>
                        <p className="mt-2">Selecciona un empleado del directorio</p>
                        <Button color="primary" size="sm" outline onClick={() => setActiveTab('directorio')}>
                            Ir al Directorio
                        </Button>
                    </CardBody>
                </Card>
            );
        }

        return (
            <Card>
                <CardHeader>
                    <h6 className="mb-0">Contratos - {selectedEmployee.first_name} {selectedEmployee.last_name}</h6>
                </CardHeader>
                <CardBody>
                    {contratosLoading ? (
                        <div className="text-center py-4"><Spinner size="sm" /></div>
                    ) : (
                        <Table responsive hover size="sm">
                            <thead className="table-light">
                                <tr>
                                    <th>Tipo</th>
                                    <th>Fecha Inicio</th>
                                    <th>Fecha Fin</th>
                                    <th>Salario</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contratos.map((c, i) => (
                                    <tr key={i}>
                                        <td>{c.contract_type || c.tipo}</td>
                                        <td>{c.start_date ? new Date(c.start_date).toLocaleDateString('es-CO') : '-'}</td>
                                        <td>{c.end_date ? new Date(c.end_date).toLocaleDateString('es-CO') : '-'}</td>
                                        <td>${fmt(c.salary || c.salario)}</td>
                                        <td>
                                            <Badge color={c.status === 'ACTIVO' || c.is_active ? 'success' : 'secondary'} pill>
                                                {c.status || (c.is_active ? 'Activo' : 'Finalizado')}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                                {contratos.length === 0 && (
                                    <tr><td colSpan={5} className="text-center text-muted">Sin contratos registrados</td></tr>
                                )}
                            </tbody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return renderDashboard();
            case 'directorio': return renderDirectorio();
            case 'nuevo': return renderNuevo();
            case 'afiliaciones': return renderAfiliaciones();
            case 'contratos': return renderContratos();
            default: return renderDashboard();
        }
    };

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <Row className="mb-3"><Col>
                        <div className="d-flex align-items-center justify-content-between">
                            <h4 className="mb-0">Empleados</h4>
                            <Button color="primary" size="sm" onClick={() => setActiveTab('nuevo')}>
                                <i className="ri-user-add-line me-1"></i>Nuevo Empleado
                            </Button>
                        </div>
                    </Col></Row>
                    <ModuleLayout
                        sections={sidebarSections}
                        activeItem={activeTab}
                        onItemClick={setActiveTab}
                    >
                        {renderContent()}
                    </ModuleLayout>
                </Container>
            </div>
        </React.Fragment>
    );
};

export default EmpleadosPage;
