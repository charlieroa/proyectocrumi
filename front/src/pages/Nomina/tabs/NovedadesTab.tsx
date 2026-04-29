import React, { useEffect, useState, useCallback } from 'react';
import {
    Card, CardBody, CardHeader, Col, Row, Table, Badge, Button,
    Input, FormGroup, Label,
    Spinner, Alert, InputGroup, InputGroupText, Nav, NavItem, NavLink,
    TabContent, TabPane
} from 'reactstrap';
import classnames from 'classnames';
import CrumiModal from '../../../Components/Common/CrumiModal';
import { api } from '../../../services/api';

// ---- Interfaces ----

interface Empleado {
    id: number;
    first_name: string;
    last_name: string;
    document_number: string;
}

interface Novedad {
    id: number;
    employee_id: number;
    employee_name: string;
    novelty_type: string;
    quantity: number;
    amount: number;
    start_date: string;
    end_date: string;
    description: string;
    status: string;
    created_at: string;
}

interface Incapacidad {
    id: number;
    employee_id: number;
    employee_name: string;
    incapacity_type: string;
    start_date: string;
    end_date: string;
    days: number;
    eps_name: string;
    diagnosis: string;
    amount_claimed: number;
    amount_paid: number;
    claim_status: string;
    filed_date: string;
}

interface NovedadForm {
    employee_id: number | string;
    novelty_type: string;
    quantity: number | string;
    amount: number | string;
    start_date: string;
    end_date: string;
    description: string;
}

interface IncapacidadForm {
    employee_id: number | string;
    incapacity_type: string;
    start_date: string;
    end_date: string;
    days: number | string;
    eps_name: string;
    diagnosis: string;
    amount_claimed: number | string;
}

const emptyNovedadForm: NovedadForm = {
    employee_id: '',
    novelty_type: 'horas_extra_diurna',
    quantity: '',
    amount: '',
    start_date: '',
    end_date: '',
    description: '',
};

const emptyIncapacidadForm: IncapacidadForm = {
    employee_id: '',
    incapacity_type: 'incapacidad_general',
    start_date: '',
    end_date: '',
    days: '',
    eps_name: '',
    diagnosis: '',
    amount_claimed: '',
};

const fmtCOP = (n: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n);

const noveltyTypeGroups = [
    {
        label: 'Horas Extras',
        options: [
            { value: 'horas_extra_diurna', label: 'Hora Extra Diurna' },
            { value: 'horas_extra_nocturna', label: 'Hora Extra Nocturna' },
            { value: 'horas_extra_festiva_diurna', label: 'Hora Extra Festiva Diurna' },
            { value: 'horas_extra_festiva_nocturna', label: 'Hora Extra Festiva Nocturna' },
        ],
    },
    {
        label: 'Recargos',
        options: [
            { value: 'recargo_nocturno', label: 'Recargo Nocturno' },
            { value: 'recargo_dominical', label: 'Recargo Dominical' },
            { value: 'recargo_dominical_nocturno', label: 'Recargo Dominical Nocturno' },
        ],
    },
    {
        label: 'Incapacidades',
        options: [
            { value: 'incapacidad_general', label: 'Incapacidad General' },
            { value: 'incapacidad_laboral', label: 'Incapacidad Laboral' },
        ],
    },
    {
        label: 'Licencias',
        options: [
            { value: 'licencia_maternidad', label: 'Licencia de Maternidad' },
            { value: 'licencia_paternidad', label: 'Licencia de Paternidad' },
            { value: 'licencia_no_remunerada', label: 'Licencia No Remunerada' },
        ],
    },
    {
        label: 'Otros',
        options: [
            { value: 'vacaciones', label: 'Vacaciones' },
            { value: 'bonificacion', label: 'Bonificacion' },
            { value: 'comision', label: 'Comisión' },
            { value: 'otro_ingreso', label: 'Otro Ingreso' },
            { value: 'otro_descuento', label: 'Otro Descuento' },
        ],
    },
];

const noveltyTypeLabels: Record<string, string> = {};
noveltyTypeGroups.forEach(g => g.options.forEach(o => { noveltyTypeLabels[o.value] = o.label; }));

const claimStatusColors: Record<string, string> = {
    pendiente: 'warning',
    radicada: 'info',
    pagada: 'success',
    rechazada: 'danger',
};

interface Props {
    year: number;
    month: number;
}

const NovedadesTab: React.FC<Props> = ({ year, month }) => {
    const [subTab, setSubTab] = useState('novedades');

    // Novedades state
    const [novedades, setNovedades] = useState<Novedad[]>([]);
    const [novedadesLoading, setNovedadesLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filters
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterType, setFilterType] = useState('');

    // Modal
    const [novedadModal, setNovedadModal] = useState(false);
    const [editingNovedad, setEditingNovedad] = useState<Novedad | null>(null);
    const [novedadForm, setNovedadForm] = useState<NovedadForm>(emptyNovedadForm);
    const [saving, setSaving] = useState(false);

    // Empleados for selects
    const [empleados, setEmpleados] = useState<Empleado[]>([]);

    // Incapacidades state
    const [incapacidades, setIncapacidades] = useState<Incapacidad[]>([]);
    const [incapacidadesLoading, setIncapacidadesLoading] = useState(false);
    const [incapacidadModal, setIncapacidadModal] = useState(false);
    const [editingIncapacidad, setEditingIncapacidad] = useState<Incapacidad | null>(null);
    const [incapacidadForm, setIncapacidadForm] = useState<IncapacidadForm>(emptyIncapacidadForm);
    const [savingIncapacidad, setSavingIncapacidad] = useState(false);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
    const showError = (msg: string) => { setError(msg); setTimeout(() => setError(''), 4000); };

    const fetchEmpleados = useCallback(async () => {
        try {
            const res = await api.get('/nomina/empleados', { params: { status: 'activo', limit: 500 } });
            if (res.data.success) setEmpleados(res.data.empleados || []);
        } catch (e) { console.error(e); }
    }, []);

    const fetchNovedades = useCallback(async () => {
        setNovedadesLoading(true);
        try {
            const params: any = { year, month };
            if (filterEmployee) params.employee_id = filterEmployee;
            if (filterType) params.novelty_type = filterType;
            const res = await api.get('/nomina/novedades', { params });
            if (res.data.success) setNovedades(res.data.novedades || []);
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al cargar novedades');
        }
        setNovedadesLoading(false);
    }, [year, month, filterEmployee, filterType]);

    const fetchIncapacidades = useCallback(async () => {
        setIncapacidadesLoading(true);
        try {
            const res = await api.get('/nomina/incapacidades', { params: { year, month } });
            if (res.data.success) setIncapacidades(res.data.incapacidades || []);
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al cargar incapacidades');
        }
        setIncapacidadesLoading(false);
    }, [year, month]);

    useEffect(() => {
        fetchEmpleados();
    }, [fetchEmpleados]);

    useEffect(() => {
        if (subTab === 'novedades') fetchNovedades();
        if (subTab === 'incapacidades') fetchIncapacidades();
    }, [subTab, fetchNovedades, fetchIncapacidades]);

    // Novedades CRUD
    const openCreateNovedad = () => {
        setEditingNovedad(null);
        setNovedadForm(emptyNovedadForm);
        setNovedadModal(true);
    };

    const openEditNovedad = (nov: Novedad) => {
        setEditingNovedad(nov);
        setNovedadForm({
            employee_id: nov.employee_id,
            novelty_type: nov.novelty_type,
            quantity: nov.quantity || '',
            amount: nov.amount || '',
            start_date: nov.start_date ? nov.start_date.substring(0, 10) : '',
            end_date: nov.end_date ? nov.end_date.substring(0, 10) : '',
            description: nov.description || '',
        });
        setNovedadModal(true);
    };

    const handleSaveNovedad = async () => {
        if (!novedadForm.employee_id || !novedadForm.novelty_type) {
            showError('Empleado y tipo de novedad son obligatorios');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...novedadForm,
                employee_id: Number(novedadForm.employee_id),
                quantity: Number(novedadForm.quantity) || 0,
                amount: Number(novedadForm.amount) || 0,
                year,
                month,
            };
            if (editingNovedad) {
                const res = await api.put(`/nomina/novedades/${editingNovedad.id}`, payload);
                if (res.data.success) {
                    showSuccess('Novedad actualizada');
                    setNovedadModal(false);
                    fetchNovedades();
                } else {
                    showError(res.data.error || 'Error al actualizar');
                }
            } else {
                const res = await api.post('/nomina/novedades', payload);
                if (res.data.success) {
                    showSuccess('Novedad creada');
                    setNovedadModal(false);
                    fetchNovedades();
                } else {
                    showError(res.data.error || 'Error al crear');
                }
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al guardar novedad');
        }
        setSaving(false);
    };

    const handleDeleteNovedad = async (id: number) => {
        if (!window.confirm('¿Está seguro de eliminar esta novedad?')) return;
        try {
            const res = await api.delete(`/nomina/novedades/${id}`);
            if (res.data.success) {
                showSuccess('Novedad eliminada');
                fetchNovedades();
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al eliminar');
        }
    };

    // Incapacidades CRUD
    const openCreateIncapacidad = () => {
        setEditingIncapacidad(null);
        setIncapacidadForm(emptyIncapacidadForm);
        setIncapacidadModal(true);
    };

    const openEditIncapacidad = (inc: Incapacidad) => {
        setEditingIncapacidad(inc);
        setIncapacidadForm({
            employee_id: inc.employee_id,
            incapacity_type: inc.incapacity_type || 'incapacidad_general',
            start_date: inc.start_date ? inc.start_date.substring(0, 10) : '',
            end_date: inc.end_date ? inc.end_date.substring(0, 10) : '',
            days: inc.days || '',
            eps_name: inc.eps_name || '',
            diagnosis: inc.diagnosis || '',
            amount_claimed: inc.amount_claimed || '',
        });
        setIncapacidadModal(true);
    };

    const handleSaveIncapacidad = async () => {
        if (!incapacidadForm.employee_id) {
            showError('Empleado es obligatorio');
            return;
        }
        setSavingIncapacidad(true);
        try {
            const payload = {
                ...incapacidadForm,
                employee_id: Number(incapacidadForm.employee_id),
                days: Number(incapacidadForm.days) || 0,
                amount_claimed: Number(incapacidadForm.amount_claimed) || 0,
                year,
                month,
            };
            if (editingIncapacidad) {
                const res = await api.put(`/nomina/incapacidades/${editingIncapacidad.id}`, payload);
                if (res.data.success) {
                    showSuccess('Incapacidad actualizada');
                    setIncapacidadModal(false);
                    fetchIncapacidades();
                } else {
                    showError(res.data.error || 'Error al actualizar');
                }
            } else {
                const res = await api.post('/nomina/incapacidades', payload);
                if (res.data.success) {
                    showSuccess('Incapacidad registrada');
                    setIncapacidadModal(false);
                    fetchIncapacidades();
                } else {
                    showError(res.data.error || 'Error al registrar');
                }
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al guardar incapacidad');
        }
        setSavingIncapacidad(false);
    };

    const updateNovedadForm = (field: string, value: any) => {
        setNovedadForm(prev => ({ ...prev, [field]: value }));
    };

    const updateIncapacidadForm = (field: string, value: any) => {
        setIncapacidadForm(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div>
            {success && <Alert color="success" className="mb-3">{success}</Alert>}
            {error && <Alert color="danger" className="mb-3">{error}</Alert>}

            <Nav tabs className="nav-tabs-custom nav-primary mb-3">
                <NavItem>
                    <NavLink className={classnames({ active: subTab === 'novedades' })} onClick={() => setSubTab('novedades')} style={{ cursor: 'pointer' }}>
                        <i className="ri-file-edit-line me-1"></i>Novedades
                    </NavLink>
                </NavItem>
                <NavItem>
                    <NavLink className={classnames({ active: subTab === 'incapacidades' })} onClick={() => setSubTab('incapacidades')} style={{ cursor: 'pointer' }}>
                        <i className="ri-hospital-line me-1"></i>Reclamaciones de Incapacidades
                    </NavLink>
                </NavItem>
            </Nav>

            <TabContent activeTab={subTab}>
                {/* ===== NOVEDADES ===== */}
                <TabPane tabId="novedades">
                    <Card>
                        <CardHeader className="d-flex justify-content-between align-items-center">
                            <h6 className="card-title mb-0">
                                Novedades - {month}/{year}
                            </h6>
                            <div className="d-flex gap-2 align-items-center">
                                <Input type="select" bsSize="sm" value={filterEmployee}
                                    onChange={e => setFilterEmployee(e.target.value)} style={{ width: 200 }}>
                                    <option value="">Todos los empleados</option>
                                    {empleados.map(e => (
                                        <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                    ))}
                                </Input>
                                <Input type="select" bsSize="sm" value={filterType}
                                    onChange={e => setFilterType(e.target.value)} style={{ width: 200 }}>
                                    <option value="">Todos los tipos</option>
                                    {noveltyTypeGroups.map(g => (
                                        <optgroup key={g.label} label={g.label}>
                                            {g.options.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </Input>
                                <Button color="success" size="sm" onClick={openCreateNovedad}>
                                    <i className="ri-add-line me-1"></i>Nueva Novedad
                                </Button>
                            </div>
                        </CardHeader>
                        <CardBody>
                            {novedadesLoading ? (
                                <div className="text-center py-4"><Spinner color="primary" /></div>
                            ) : novedades.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <i className="ri-file-edit-line fs-36 d-block mb-2"></i>
                                    <p>No hay novedades registradas para este periodo</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <Table className="table-hover table-nowrap align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Empleado</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Tipo</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Cantidad</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Monto</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Fecha Inicio</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Fecha Fin</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Estado</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {novedades.map((nov) => (
                                                <tr key={nov.id}>
                                                    <td className="fw-medium">{nov.employee_name}</td>
                                                    <td>
                                                        <Badge color="info-subtle" className="text-info">
                                                            {noveltyTypeLabels[nov.novelty_type] || nov.novelty_type}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-end font-monospace">{nov.quantity || '-'}</td>
                                                    <td className="text-end font-monospace">{nov.amount ? fmtCOP(nov.amount) : '-'}</td>
                                                    <td className="text-muted fs-12">
                                                        {nov.start_date ? new Date(nov.start_date).toLocaleDateString('es-CO') : '-'}
                                                    </td>
                                                    <td className="text-muted fs-12">
                                                        {nov.end_date ? new Date(nov.end_date).toLocaleDateString('es-CO') : '-'}
                                                    </td>
                                                    <td>
                                                        <Badge color={nov.status === 'aprobada' ? 'success' : nov.status === 'rechazada' ? 'danger' : 'warning'}>
                                                            {nov.status || 'Pendiente'}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-end">
                                                        <Button color="primary" size="sm" className="me-1" outline onClick={() => openEditNovedad(nov)}>
                                                            <i className="ri-edit-line"></i>
                                                        </Button>
                                                        <Button color="danger" size="sm" outline onClick={() => handleDeleteNovedad(nov.id)}>
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
                </TabPane>

                {/* ===== INCAPACIDADES ===== */}
                <TabPane tabId="incapacidades">
                    <Card>
                        <CardHeader className="d-flex justify-content-between align-items-center">
                            <h6 className="card-title mb-0">
                                <i className="ri-hospital-line me-1"></i>
                                Reclamaciones de Incapacidades
                            </h6>
                            <Button color="success" size="sm" onClick={openCreateIncapacidad}>
                                <i className="ri-add-line me-1"></i>Nueva Reclamacion
                            </Button>
                        </CardHeader>
                        <CardBody>
                            {incapacidadesLoading ? (
                                <div className="text-center py-4"><Spinner color="primary" /></div>
                            ) : incapacidades.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <i className="ri-hospital-line fs-36 d-block mb-2"></i>
                                    <p>No hay reclamaciones de incapacidades</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <Table className="table-hover table-nowrap align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Empleado</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Tipo</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">EPS</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Diagnostico</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-center">Dias</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Reclamado</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Pagado</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Estado</th>
                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {incapacidades.map((inc) => (
                                                <tr key={inc.id}>
                                                    <td className="fw-medium">{inc.employee_name}</td>
                                                    <td>
                                                        <Badge color="warning-subtle" className="text-warning">
                                                            {inc.incapacity_type === 'incapacidad_general' ? 'General' : 'Laboral'}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-muted">{inc.eps_name || '-'}</td>
                                                    <td className="text-muted fs-12">{inc.diagnosis ? inc.diagnosis.substring(0, 40) : '-'}</td>
                                                    <td className="text-center">{inc.days}</td>
                                                    <td className="text-end font-monospace">{fmtCOP(inc.amount_claimed || 0)}</td>
                                                    <td className="text-end font-monospace">{fmtCOP(inc.amount_paid || 0)}</td>
                                                    <td>
                                                        <Badge color={claimStatusColors[inc.claim_status] || 'secondary'}>
                                                            {inc.claim_status || 'Pendiente'}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-end">
                                                        <Button color="primary" size="sm" outline onClick={() => openEditIncapacidad(inc)}>
                                                            <i className="ri-edit-line"></i>
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
                </TabPane>
            </TabContent>

            {/* Modal Novedad */}
            <CrumiModal
                isOpen={novedadModal}
                toggle={() => setNovedadModal(false)}
                title={editingNovedad ? 'Editar Novedad' : 'Nueva Novedad'}
                subtitle="Registra horas extras, recargos, licencias y otros conceptos"
                size="lg"
                onSubmit={handleSaveNovedad}
                submitText={editingNovedad ? 'Actualizar Novedad' : 'Crear Novedad'}
                isSubmitting={saving}
            >
                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Empleado *</Label>
                                <Input type="select" bsSize="sm" value={novedadForm.employee_id}
                                    onChange={e => updateNovedadForm('employee_id', e.target.value)}>
                                    <option value="">-- Seleccione empleado --</option>
                                    {empleados.map(e => (
                                        <option key={e.id} value={e.id}>{e.first_name} {e.last_name} - {e.document_number}</option>
                                    ))}
                                </Input>
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Tipo de Novedad *</Label>
                                <Input type="select" bsSize="sm" value={novedadForm.novelty_type}
                                    onChange={e => updateNovedadForm('novelty_type', e.target.value)}>
                                    {noveltyTypeGroups.map(g => (
                                        <optgroup key={g.label} label={g.label}>
                                            {g.options.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </Input>
                            </FormGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={3}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Cantidad</Label>
                                <Input bsSize="sm" type="number" value={novedadForm.quantity}
                                    onChange={e => updateNovedadForm('quantity', e.target.value)}
                                    placeholder="0" />
                            </FormGroup>
                        </Col>
                        <Col md={3}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Monto</Label>
                                <InputGroup size="sm">
                                    <InputGroupText>$</InputGroupText>
                                    <Input type="number" value={novedadForm.amount}
                                        onChange={e => updateNovedadForm('amount', e.target.value)}
                                        placeholder="0" />
                                </InputGroup>
                            </FormGroup>
                        </Col>
                        <Col md={3}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Fecha Inicio</Label>
                                <Input bsSize="sm" type="date" value={novedadForm.start_date}
                                    onChange={e => updateNovedadForm('start_date', e.target.value)} />
                            </FormGroup>
                        </Col>
                        <Col md={3}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Fecha Fin</Label>
                                <Input bsSize="sm" type="date" value={novedadForm.end_date}
                                    onChange={e => updateNovedadForm('end_date', e.target.value)} />
                            </FormGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Descripción</Label>
                                <Input bsSize="sm" type="textarea" rows={2} value={novedadForm.description}
                                    onChange={e => updateNovedadForm('description', e.target.value)}
                                    placeholder="Descripción adicional..." />
                            </FormGroup>
                        </Col>
                    </Row>
            </CrumiModal>

            {/* Modal Incapacidad */}
            <CrumiModal
                isOpen={incapacidadModal}
                toggle={() => setIncapacidadModal(false)}
                title={editingIncapacidad ? 'Editar Reclamacion' : 'Nueva Reclamacion de Incapacidad'}
                subtitle="Registra y gestiona reclamaciones de incapacidad"
                size="lg"
                onSubmit={handleSaveIncapacidad}
                submitText={editingIncapacidad ? 'Actualizar Reclamacion' : 'Registrar Reclamacion'}
                isSubmitting={savingIncapacidad}
            >
                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Empleado *</Label>
                                <Input type="select" bsSize="sm" value={incapacidadForm.employee_id}
                                    onChange={e => updateIncapacidadForm('employee_id', e.target.value)}>
                                    <option value="">-- Seleccione empleado --</option>
                                    {empleados.map(e => (
                                        <option key={e.id} value={e.id}>{e.first_name} {e.last_name} - {e.document_number}</option>
                                    ))}
                                </Input>
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Tipo de Incapacidad</Label>
                                <Input type="select" bsSize="sm" value={incapacidadForm.incapacity_type}
                                    onChange={e => updateIncapacidadForm('incapacity_type', e.target.value)}>
                                    <option value="incapacidad_general">Incapacidad General (EPS)</option>
                                    <option value="incapacidad_laboral">Incapacidad Laboral (ARL)</option>
                                </Input>
                            </FormGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={3}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Fecha Inicio</Label>
                                <Input bsSize="sm" type="date" value={incapacidadForm.start_date}
                                    onChange={e => updateIncapacidadForm('start_date', e.target.value)} />
                            </FormGroup>
                        </Col>
                        <Col md={3}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Fecha Fin</Label>
                                <Input bsSize="sm" type="date" value={incapacidadForm.end_date}
                                    onChange={e => updateIncapacidadForm('end_date', e.target.value)} />
                            </FormGroup>
                        </Col>
                        <Col md={3}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Dias</Label>
                                <Input bsSize="sm" type="number" value={incapacidadForm.days}
                                    onChange={e => updateIncapacidadForm('days', e.target.value)}
                                    placeholder="0" />
                            </FormGroup>
                        </Col>
                        <Col md={3}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Monto Reclamado</Label>
                                <InputGroup size="sm">
                                    <InputGroupText>$</InputGroupText>
                                    <Input type="number" value={incapacidadForm.amount_claimed}
                                        onChange={e => updateIncapacidadForm('amount_claimed', e.target.value)}
                                        placeholder="0" />
                                </InputGroup>
                            </FormGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={6}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">EPS / Entidad</Label>
                                <Input bsSize="sm" value={incapacidadForm.eps_name}
                                    onChange={e => updateIncapacidadForm('eps_name', e.target.value)}
                                    placeholder="Nombre de la EPS" />
                            </FormGroup>
                        </Col>
                        <Col md={6}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Diagnostico</Label>
                                <Input bsSize="sm" value={incapacidadForm.diagnosis}
                                    onChange={e => updateIncapacidadForm('diagnosis', e.target.value)}
                                    placeholder="Diagnostico medico" />
                            </FormGroup>
                        </Col>
                    </Row>
            </CrumiModal>
        </div>
    );
};

export default NovedadesTab;
