import React, { useEffect, useState, useCallback } from 'react';
import {
    Card, CardBody, CardHeader, Col, Row, Table, Badge, Button,
    Input, FormGroup, Label,
    Spinner, Alert, Pagination, PaginationItem, PaginationLink,
    InputGroup, InputGroupText, Nav, NavItem, NavLink, TabContent, TabPane
} from 'reactstrap';
import classnames from 'classnames';
import CrumiModal from '../../../Components/Common/CrumiModal';
import { api } from '../../../services/api';

// ---- Interfaces ----

interface Empleado {
    id: number;
    document_type: string;
    document_number: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    birth_date: string;
    gender: string;
    address: string;
    city: string;
    hire_date: string;
    contract_type: string;
    position: string;
    department: string;
    base_salary: number;
    salary_type: string;
    payment_frequency: string;
    arl_risk_class: string;
    bank_name: string;
    bank_account_type: string;
    bank_account_number: string;
    eps_id: number | null;
    afp_id: number | null;
    arl_id: number | null;
    ccf_id: number | null;
    eps_name?: string;
    afp_name?: string;
    status: string;
}

interface EntidadSS {
    id: number;
    name: string;
    code: string;
    entity_type: string;
}

interface EmpleadoForm {
    document_type: string;
    document_number: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    birth_date: string;
    gender: string;
    address: string;
    city: string;
    hire_date: string;
    contract_type: string;
    position: string;
    department: string;
    base_salary: number | string;
    salary_type: string;
    payment_frequency: string;
    arl_risk_class: string;
    bank_name: string;
    bank_account_type: string;
    bank_account_number: string;
    eps_id: number | string;
    afp_id: number | string;
    arl_id: number | string;
    ccf_id: number | string;
}

const emptyForm: EmpleadoForm = {
    document_type: 'CC',
    document_number: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    gender: 'M',
    address: '',
    city: '',
    hire_date: '',
    contract_type: 'indefinido',
    position: '',
    department: '',
    base_salary: '',
    salary_type: 'mensual',
    payment_frequency: 'mensual',
    arl_risk_class: 'I',
    bank_name: '',
    bank_account_type: 'ahorros',
    bank_account_number: '',
    eps_id: '',
    afp_id: '',
    arl_id: '',
    ccf_id: '',
};

const fmtCOP = (n: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n);

interface Props {
    year: number;
    month: number;
}

const EmpleadosTab: React.FC<Props> = ({ year, month }) => {
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('activo');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Modal
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState<Empleado | null>(null);
    const [form, setForm] = useState<EmpleadoForm>(emptyForm);
    const [formTab, setFormTab] = useState('personal');
    const [saving, setSaving] = useState(false);

    // Entities
    const [epsList, setEpsList] = useState<EntidadSS[]>([]);
    const [afpList, setAfpList] = useState<EntidadSS[]>([]);
    const [arlList, setArlList] = useState<EntidadSS[]>([]);
    const [ccfList, setCcfList] = useState<EntidadSS[]>([]);

    const limit = 15;
    const totalPages = Math.ceil(total / limit);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
    const showError = (msg: string) => { setError(msg); setTimeout(() => setError(''), 4000); };

    const fetchEmpleados = useCallback(async (pg = page) => {
        setLoading(true);
        try {
            const params: any = { page: pg, limit, status: statusFilter };
            if (search) params.search = search;
            const res = await api.get('/nomina/empleados', { params });
            const data = res.data;
            if (data.success) {
                setEmpleados(data.empleados || []);
                setTotal(data.total || 0);
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al cargar empleados');
        }
        setLoading(false);
    }, [page, search, statusFilter]);

    const fetchEntidades = useCallback(async () => {
        try {
            const [epsRes, afpRes, arlRes, ccfRes] = await Promise.all([
                api.get('/nomina/entidades-ss', { params: { entity_type: 'EPS' } }),
                api.get('/nomina/entidades-ss', { params: { entity_type: 'AFP' } }),
                api.get('/nomina/entidades-ss', { params: { entity_type: 'ARL' } }),
                api.get('/nomina/entidades-ss', { params: { entity_type: 'CCF' } }),
            ]);
            if (epsRes.data.success) setEpsList(epsRes.data.entidades || []);
            if (afpRes.data.success) setAfpList(afpRes.data.entidades || []);
            if (arlRes.data.success) setArlList(arlRes.data.entidades || []);
            if (ccfRes.data.success) setCcfList(ccfRes.data.entidades || []);
        } catch (e) { console.error('Error fetching entidades:', e); }
    }, []);

    useEffect(() => {
        fetchEmpleados(1);
    }, [statusFilter]);

    useEffect(() => {
        fetchEntidades();
    }, [fetchEntidades]);

    const handleSearch = () => {
        setPage(1);
        fetchEmpleados(1);
    };

    const handlePageChange = (pg: number) => {
        setPage(pg);
        fetchEmpleados(pg);
    };

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setFormTab('personal');
        setModal(true);
    };

    const openEdit = (emp: Empleado) => {
        setEditing(emp);
        setForm({
            document_type: emp.document_type || 'CC',
            document_number: emp.document_number || '',
            first_name: emp.first_name || '',
            last_name: emp.last_name || '',
            email: emp.email || '',
            phone: emp.phone || '',
            birth_date: emp.birth_date ? emp.birth_date.substring(0, 10) : '',
            gender: emp.gender || 'M',
            address: emp.address || '',
            city: emp.city || '',
            hire_date: emp.hire_date ? emp.hire_date.substring(0, 10) : '',
            contract_type: emp.contract_type || 'indefinido',
            position: emp.position || '',
            department: emp.department || '',
            base_salary: emp.base_salary || '',
            salary_type: emp.salary_type || 'mensual',
            payment_frequency: emp.payment_frequency || 'mensual',
            arl_risk_class: emp.arl_risk_class || 'I',
            bank_name: emp.bank_name || '',
            bank_account_type: emp.bank_account_type || 'ahorros',
            bank_account_number: emp.bank_account_number || '',
            eps_id: emp.eps_id || '',
            afp_id: emp.afp_id || '',
            arl_id: emp.arl_id || '',
            ccf_id: emp.ccf_id || '',
        });
        setFormTab('personal');
        setModal(true);
    };

    const handleSave = async () => {
        if (!form.document_number || !form.first_name || !form.last_name) {
            showError('Documento, nombre y apellido son obligatorios');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                base_salary: Number(form.base_salary) || 0,
                eps_id: form.eps_id ? Number(form.eps_id) : null,
                afp_id: form.afp_id ? Number(form.afp_id) : null,
                arl_id: form.arl_id ? Number(form.arl_id) : null,
                ccf_id: form.ccf_id ? Number(form.ccf_id) : null,
            };
            if (editing) {
                const res = await api.put(`/nomina/empleados/${editing.id}`, payload);
                if (res.data.success) {
                    showSuccess('Empleado actualizado correctamente');
                    setModal(false);
                    fetchEmpleados(page);
                } else {
                    showError(res.data.error || 'Error al actualizar');
                }
            } else {
                const res = await api.post('/nomina/empleados', payload);
                if (res.data.success) {
                    showSuccess('Empleado creado correctamente');
                    setModal(false);
                    fetchEmpleados(1);
                } else {
                    showError(res.data.error || 'Error al crear');
                }
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al guardar empleado');
        }
        setSaving(false);
    };

    const handleToggleStatus = async (emp: Empleado) => {
        const newStatus = emp.status === 'activo' ? 'inactivo' : 'activo';
        try {
            const res = await api.put(`/nomina/empleados/${emp.id}`, { status: newStatus });
            if (res.data.success) {
                showSuccess(`Empleado ${newStatus === 'activo' ? 'activado' : 'desactivado'}`);
                fetchEmpleados(page);
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al cambiar estado');
        }
    };

    const updateForm = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const contractTypeLabels: Record<string, string> = {
        indefinido: 'Indefinido',
        fijo: 'Fijo',
        obra_labor: 'Obra/Labor',
        prestacion_servicios: 'Prest. Servicios',
    };

    const formTabs = [
        { id: 'personal', label: 'Personal', icon: 'ri-user-line' },
        { id: 'laboral', label: 'Laboral', icon: 'ri-briefcase-line' },
        { id: 'bancario', label: 'Bancario', icon: 'ri-bank-line' },
        { id: 'afiliaciones', label: 'Afiliaciones', icon: 'ri-shield-check-line' },
    ];

    return (
        <div>
            {success && <Alert color="success" className="mb-3">{success}</Alert>}
            {error && <Alert color="danger" className="mb-3">{error}</Alert>}

            <Card>
                <CardHeader className="d-flex justify-content-between align-items-center">
                    <h6 className="card-title mb-0">
                        <i className="ri-team-line me-1"></i>Empleados
                    </h6>
                    <div className="d-flex gap-2 align-items-center">
                        <Input type="select" bsSize="sm" value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)} style={{ width: 130 }}>
                            <option value="activo">Activos</option>
                            <option value="inactivo">Inactivos</option>
                            <option value="">Todos</option>
                        </Input>
                        <InputGroup style={{ width: 260 }}>
                            <Input bsSize="sm" placeholder="Buscar empleado..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                            <Button color="primary" size="sm" onClick={handleSearch}>
                                <i className="ri-search-line"></i>
                            </Button>
                        </InputGroup>
                        <Button color="success" size="sm" onClick={openCreate}>
                            <i className="ri-add-line me-1"></i>Nuevo Empleado
                        </Button>
                    </div>
                </CardHeader>
                <CardBody>
                    {loading ? (
                        <div className="text-center py-4"><Spinner color="primary" /></div>
                    ) : empleados.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                            <i className="ri-team-line fs-36 d-block mb-2"></i>
                            <p>No hay empleados registrados</p>
                        </div>
                    ) : (
                        <>
                            <div className="table-responsive">
                                <Table className="table-hover table-nowrap align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold">Documento</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold">Nombre</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold">Cargo</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Salario Base</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold">Tipo Contrato</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold">EPS</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold">AFP</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold">Estado</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {empleados.map((emp) => (
                                            <tr key={emp.id}>
                                                <td>
                                                    <Badge color="primary-subtle" className="text-primary font-monospace">
                                                        {emp.document_type} {emp.document_number}
                                                    </Badge>
                                                </td>
                                                <td className="fw-medium">{emp.first_name} {emp.last_name}</td>
                                                <td className="text-muted">{emp.position || '-'}</td>
                                                <td className="text-end font-monospace">{fmtCOP(emp.base_salary)}</td>
                                                <td>
                                                    <Badge color="info-subtle" className="text-info">
                                                        {contractTypeLabels[emp.contract_type] || emp.contract_type}
                                                    </Badge>
                                                </td>
                                                <td className="text-muted fs-12">{emp.eps_name || '-'}</td>
                                                <td className="text-muted fs-12">{emp.afp_name || '-'}</td>
                                                <td>
                                                    <Badge color={emp.status === 'activo' ? 'success' : 'secondary'}>
                                                        {emp.status === 'activo' ? 'Activo' : 'Inactivo'}
                                                    </Badge>
                                                </td>
                                                <td className="text-end">
                                                    <Button color="primary" size="sm" className="me-1" outline onClick={() => openEdit(emp)}>
                                                        <i className="ri-edit-line"></i>
                                                    </Button>
                                                    <Button
                                                        color={emp.status === 'activo' ? 'warning' : 'success'}
                                                        size="sm" outline
                                                        onClick={() => handleToggleStatus(emp)}
                                                    >
                                                        <i className={emp.status === 'activo' ? 'ri-user-unfollow-line' : 'ri-user-follow-line'}></i>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                            {totalPages > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3">
                                    <span className="text-muted fs-12">{total} empleados</span>
                                    <Pagination size="sm" className="mb-0">
                                        <PaginationItem disabled={page <= 1}>
                                            <PaginationLink previous onClick={() => handlePageChange(page - 1)} />
                                        </PaginationItem>
                                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                            const pg = i + 1;
                                            return (
                                                <PaginationItem key={pg} active={pg === page}>
                                                    <PaginationLink onClick={() => handlePageChange(pg)}>{pg}</PaginationLink>
                                                </PaginationItem>
                                            );
                                        })}
                                        <PaginationItem disabled={page >= totalPages}>
                                            <PaginationLink next onClick={() => handlePageChange(page + 1)} />
                                        </PaginationItem>
                                    </Pagination>
                                </div>
                            )}
                        </>
                    )}
                </CardBody>
            </Card>

            {/* Modal Crear/Editar Empleado */}
            <CrumiModal
                isOpen={modal}
                toggle={() => setModal(false)}
                title={editing ? 'Editar Empleado' : 'Nuevo Empleado'}
                subtitle={editing ? 'Actualiza la información del empleado' : 'Completa los datos para registrar un empleado'}
                size="lg"
                onSubmit={handleSave}
                submitText={editing ? 'Actualizar Empleado' : 'Crear Empleado'}
                isSubmitting={saving}
            >
                <Nav tabs className="nav-tabs-custom nav-primary mb-3">
                    {formTabs.map(tab => (
                        <NavItem key={tab.id}>
                            <NavLink
                                className={classnames({ active: formTab === tab.id })}
                                onClick={() => setFormTab(tab.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <i className={`${tab.icon} me-1`}></i>
                                {tab.label}
                            </NavLink>
                        </NavItem>
                    ))}
                </Nav>

                <TabContent activeTab={formTab}>
                    {/* Personal */}
                    <TabPane tabId="personal">
                        <Row>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Tipo Documento</Label>
                                    <Input type="select" bsSize="sm" value={form.document_type}
                                        onChange={e => updateForm('document_type', e.target.value)}>
                                        <option value="CC">CC - Cedula Ciudadania</option>
                                        <option value="CE">CE - Cedula Extranjeria</option>
                                        <option value="TI">TI - Tarjeta Identidad</option>
                                        <option value="PA">PA - Pasaporte</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">No. Documento *</Label>
                                    <Input bsSize="sm" value={form.document_number}
                                        onChange={e => updateForm('document_number', e.target.value)}
                                        placeholder="1234567890" />
                                </FormGroup>
                            </Col>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Genero</Label>
                                    <Input type="select" bsSize="sm" value={form.gender}
                                        onChange={e => updateForm('gender', e.target.value)}>
                                        <option value="M">Masculino</option>
                                        <option value="F">Femenino</option>
                                        <option value="O">Otro</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Nombres *</Label>
                                    <Input bsSize="sm" value={form.first_name}
                                        onChange={e => updateForm('first_name', e.target.value)}
                                        placeholder="Nombres" />
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Apellidos *</Label>
                                    <Input bsSize="sm" value={form.last_name}
                                        onChange={e => updateForm('last_name', e.target.value)}
                                        placeholder="Apellidos" />
                                </FormGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Email</Label>
                                    <Input bsSize="sm" type="email" value={form.email}
                                        onChange={e => updateForm('email', e.target.value)}
                                        placeholder="correo@ejemplo.com" />
                                </FormGroup>
                            </Col>
                            <Col md={3}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Teléfono</Label>
                                    <Input bsSize="sm" value={form.phone}
                                        onChange={e => updateForm('phone', e.target.value)}
                                        placeholder="3001234567" />
                                </FormGroup>
                            </Col>
                            <Col md={3}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Fecha Nacimiento</Label>
                                    <Input bsSize="sm" type="date" value={form.birth_date}
                                        onChange={e => updateForm('birth_date', e.target.value)} />
                                </FormGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={8}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Dirección</Label>
                                    <Input bsSize="sm" value={form.address}
                                        onChange={e => updateForm('address', e.target.value)}
                                        placeholder="Calle 123 # 45-67" />
                                </FormGroup>
                            </Col>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Ciudad</Label>
                                    <Input bsSize="sm" value={form.city}
                                        onChange={e => updateForm('city', e.target.value)}
                                        placeholder="Bogota" />
                                </FormGroup>
                            </Col>
                        </Row>
                    </TabPane>

                    {/* Laboral */}
                    <TabPane tabId="laboral">
                        <Row>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Fecha Ingreso</Label>
                                    <Input bsSize="sm" type="date" value={form.hire_date}
                                        onChange={e => updateForm('hire_date', e.target.value)} />
                                </FormGroup>
                            </Col>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Tipo Contrato</Label>
                                    <Input type="select" bsSize="sm" value={form.contract_type}
                                        onChange={e => updateForm('contract_type', e.target.value)}>
                                        <option value="indefinido">Termino Indefinido</option>
                                        <option value="fijo">Termino Fijo</option>
                                        <option value="obra_labor">Obra o Labor</option>
                                        <option value="prestacion_servicios">Prestacion de Servicios</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Clase Riesgo ARL</Label>
                                    <Input type="select" bsSize="sm" value={form.arl_risk_class}
                                        onChange={e => updateForm('arl_risk_class', e.target.value)}>
                                        <option value="I">Clase I - 0.522%</option>
                                        <option value="II">Clase II - 1.044%</option>
                                        <option value="III">Clase III - 2.436%</option>
                                        <option value="IV">Clase IV - 4.350%</option>
                                        <option value="V">Clase V - 6.960%</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Cargo</Label>
                                    <Input bsSize="sm" value={form.position}
                                        onChange={e => updateForm('position', e.target.value)}
                                        placeholder="Cargo del empleado" />
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Departamento</Label>
                                    <Input bsSize="sm" value={form.department}
                                        onChange={e => updateForm('department', e.target.value)}
                                        placeholder="Area o departamento" />
                                </FormGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Salario Base</Label>
                                    <InputGroup size="sm">
                                        <InputGroupText>$</InputGroupText>
                                        <Input type="number" value={form.base_salary}
                                            onChange={e => updateForm('base_salary', e.target.value)}
                                            placeholder="0" />
                                    </InputGroup>
                                </FormGroup>
                            </Col>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Tipo Salario</Label>
                                    <Input type="select" bsSize="sm" value={form.salary_type}
                                        onChange={e => updateForm('salary_type', e.target.value)}>
                                        <option value="mensual">Mensual</option>
                                        <option value="integral">Integral</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Frecuencia Pago</Label>
                                    <Input type="select" bsSize="sm" value={form.payment_frequency}
                                        onChange={e => updateForm('payment_frequency', e.target.value)}>
                                        <option value="mensual">Mensual</option>
                                        <option value="quincenal">Quincenal</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                        </Row>
                    </TabPane>

                    {/* Bancario */}
                    <TabPane tabId="bancario">
                        <Row>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Banco</Label>
                                    <Input bsSize="sm" value={form.bank_name}
                                        onChange={e => updateForm('bank_name', e.target.value)}
                                        placeholder="Nombre del banco" />
                                </FormGroup>
                            </Col>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Tipo Cuenta</Label>
                                    <Input type="select" bsSize="sm" value={form.bank_account_type}
                                        onChange={e => updateForm('bank_account_type', e.target.value)}>
                                        <option value="ahorros">Ahorros</option>
                                        <option value="corriente">Corriente</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={4}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">No. Cuenta</Label>
                                    <Input bsSize="sm" value={form.bank_account_number}
                                        onChange={e => updateForm('bank_account_number', e.target.value)}
                                        placeholder="Número de cuenta" />
                                </FormGroup>
                            </Col>
                        </Row>
                    </TabPane>

                    {/* Afiliaciones */}
                    <TabPane tabId="afiliaciones">
                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">EPS</Label>
                                    <Input type="select" bsSize="sm" value={form.eps_id}
                                        onChange={e => updateForm('eps_id', e.target.value)}>
                                        <option value="">-- Seleccione EPS --</option>
                                        {epsList.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">AFP (Pension)</Label>
                                    <Input type="select" bsSize="sm" value={form.afp_id}
                                        onChange={e => updateForm('afp_id', e.target.value)}>
                                        <option value="">-- Seleccione AFP --</option>
                                        {afpList.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </Input>
                                </FormGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">ARL</Label>
                                    <Input type="select" bsSize="sm" value={form.arl_id}
                                        onChange={e => updateForm('arl_id', e.target.value)}>
                                        <option value="">-- Seleccione ARL --</option>
                                        {arlList.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label className="fw-semibold fs-12">Caja de Compensacion (CCF)</Label>
                                    <Input type="select" bsSize="sm" value={form.ccf_id}
                                        onChange={e => updateForm('ccf_id', e.target.value)}>
                                        <option value="">-- Seleccione CCF --</option>
                                        {ccfList.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </Input>
                                </FormGroup>
                            </Col>
                        </Row>
                    </TabPane>
                </TabContent>
            </CrumiModal>
        </div>
    );
};

export default EmpleadosTab;
