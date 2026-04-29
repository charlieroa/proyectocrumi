import React, { useEffect, useState, useCallback } from 'react';
import {
    Container, Row, Col, Card, CardBody, CardHeader,
    Nav, NavItem, NavLink, TabContent, TabPane,
    Table, Badge, Button, Modal, ModalHeader, ModalBody, ModalFooter,
    Form, FormGroup, Label, Input, Spinner, Alert
} from 'reactstrap';
import classnames from 'classnames';
import { api } from '../../services/api';

// =============================================
// Tipos
// =============================================
interface PerfilData {
    id: number;
    first_name: string;
    last_name: string;
    document_type: string;
    document_number: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    department: string;
    position: string;
    department_name: string;
    hire_date: string;
    contract_type: string;
    salary: number;
    bank_name: string;
    bank_account_type: string;
    bank_account_number: string;
    eps: string;
    pension_fund: string;
    arl: string;
    ccf: string;
}

interface Colilla {
    id: number;
    period_year: number;
    period_month: number;
    period_number: number;
    period_type: string;
    start_date: string;
    end_date: string;
    total_devengado: number;
    total_deductions: number;
    net_pay: number;
    details?: ColillaDetail[];
}

interface ColillaDetail {
    concept: string;
    type: string;
    amount: number;
}

interface Solicitud {
    id: number;
    request_type: string;
    start_date: string;
    end_date: string;
    description: string;
    status: string;
    created_at: string;
    reviewed_by_name?: string;
    review_notes?: string;
}

// =============================================
// Componente Principal
// =============================================
const MiPortalPage: React.FC = () => {
    document.title = 'Mi Portal | Bolti';

    const [activeTab, setActiveTab] = useState('perfil');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Perfil
    const [perfil, setPerfil] = useState<PerfilData | null>(null);
    const [editModal, setEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ phone: '', email: '', address: '' });
    const [editLoading, setEditLoading] = useState(false);

    // Colillas de pago
    const [colillas, setColillas] = useState<Colilla[]>([]);
    const [colillasLoading, setColillasLoading] = useState(false);
    const [expandedColilla, setExpandedColilla] = useState<number | null>(null);

    // Solicitudes
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [solicitudesLoading, setSolicitudesLoading] = useState(false);
    const [solicitudForm, setSolicitudForm] = useState({
        request_type: 'vacaciones',
        start_date: '',
        end_date: '',
        description: ''
    });
    const [solicitudLoading, setSolicitudLoading] = useState(false);

    // Certificados
    const [certLoading, setCertLoading] = useState<string | null>(null);

    // =============================================
    // Formato moneda COP
    // =============================================
    const fmtCOP = (n: number) =>
        Number(n || 0).toLocaleString('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

    const fmtDate = (d: string) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('es-CO');
    };

    // =============================================
    // Fetch perfil
    // =============================================
    const fetchPerfil = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('/nomina/mi-portal/perfil');
            if (res.data.success && res.data.perfil) {
                setPerfil(res.data.perfil);
            }
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Error cargando perfil');
        }
        setLoading(false);
    }, []);

    // =============================================
    // Fetch colillas
    // =============================================
    const fetchColillas = useCallback(async () => {
        setColillasLoading(true);
        try {
            const res = await api.get('/nomina/mi-portal/colillas');
            if (res.data.success) {
                setColillas(res.data.colillas || []);
            }
        } catch (e: any) {
            console.error('Error cargando colillas:', e);
        }
        setColillasLoading(false);
    }, []);

    // =============================================
    // Fetch solicitudes
    // =============================================
    const fetchSolicitudes = useCallback(async () => {
        setSolicitudesLoading(true);
        try {
            const res = await api.get('/nomina/mi-portal/solicitudes');
            if (res.data.success) {
                setSolicitudes(res.data.solicitudes || []);
            }
        } catch (e: any) {
            console.error('Error cargando solicitudes:', e);
        }
        setSolicitudesLoading(false);
    }, []);

    // =============================================
    // Cargar datos iniciales
    // =============================================
    useEffect(() => {
        fetchPerfil();
    }, [fetchPerfil]);

    useEffect(() => {
        if (activeTab === 'colillas') fetchColillas();
        if (activeTab === 'solicitudes') fetchSolicitudes();
    }, [activeTab, fetchColillas, fetchSolicitudes]);

    // =============================================
    // Actualizar datos personales
    // =============================================
    const openEditModal = () => {
        if (perfil) {
            setEditForm({
                phone: perfil.phone || '',
                email: perfil.email || '',
                address: perfil.address || ''
            });
        }
        setEditModal(true);
    };

    const handleUpdateProfile = async () => {
        setEditLoading(true);
        setError('');
        setSuccess('');
        try {
            const res = await api.put('/nomina/mi-portal/perfil', editForm);
            if (res.data.success) {
                setSuccess('Datos actualizados correctamente');
                setEditModal(false);
                fetchPerfil();
            }
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Error actualizando datos');
        }
        setEditLoading(false);
    };

    // =============================================
    // Crear solicitud
    // =============================================
    const handleCreateSolicitud = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!solicitudForm.start_date || !solicitudForm.end_date) {
            setError('Debe indicar fecha de inicio y fin');
            return;
        }
        setSolicitudLoading(true);
        setError('');
        setSuccess('');
        try {
            const res = await api.post('/nomina/mi-portal/solicitudes', solicitudForm);
            if (res.data.success) {
                setSuccess('Solicitud creada correctamente');
                setSolicitudForm({ request_type: 'vacaciones', start_date: '', end_date: '', description: '' });
                fetchSolicitudes();
            }
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Error creando solicitud');
        }
        setSolicitudLoading(false);
    };

    // =============================================
    // Generar certificado
    // =============================================
    const handleGenerateCertificate = async (type: 'laboral' | 'ingresos') => {
        setCertLoading(type);
        setError('');
        try {
            const endpoint = type === 'laboral'
                ? '/nomina/mi-portal/certificado-laboral'
                : '/nomina/mi-portal/certificado-ingresos';
            const res = await api.get(endpoint, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `certificado-${type}-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (e: any) {
            setError(e?.response?.data?.error || `Error generando certificado ${type}`);
        }
        setCertLoading(null);
    };

    // =============================================
    // Helpers de estado de solicitud
    // =============================================
    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            pendiente: 'warning',
            aprobada: 'success',
            rechazada: 'danger',
            cancelada: 'secondary'
        };
        return <Badge color={colors[status?.toLowerCase()] || 'info'}>{status}</Badge>;
    };

    const getRequestTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            vacaciones: 'primary',
            permiso: 'info',
            licencia: 'warning'
        };
        return <Badge color={colors[type?.toLowerCase()] || 'secondary'}>{type}</Badge>;
    };

    // =============================================
    // Tabs
    // =============================================
    const tabs = [
        { id: 'perfil', label: 'Mi Perfil', icon: 'ri-user-3-line' },
        { id: 'colillas', label: 'Colillas de Pago', icon: 'ri-money-dollar-circle-line' },
        { id: 'solicitudes', label: 'Mis Solicitudes', icon: 'ri-file-list-3-line' },
        { id: 'certificados', label: 'Certificados', icon: 'ri-file-shield-2-line' },
    ];

    // =============================================
    // Render
    // =============================================
    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    {/* Header */}
                    <Row className="mb-3">
                        <Col>
                            <div className="d-flex align-items-center">
                                <div>
                                    <h4 className="mb-1">
                                        <i className="ri-user-smile-line me-2 text-primary"></i>
                                        Bienvenido{perfil ? `, ${perfil.first_name} ${perfil.last_name}` : ''}
                                    </h4>
                                    <p className="text-muted mb-0">
                                        Portal de autoservicio para empleados
                                    </p>
                                </div>
                            </div>
                        </Col>
                    </Row>

                    {/* Alerts */}
                    {error && (
                        <Alert color="danger" isOpen={!!error} toggle={() => setError('')}>
                            {error}
                        </Alert>
                    )}
                    {success && (
                        <Alert color="success" isOpen={!!success} toggle={() => setSuccess('')}>
                            {success}
                        </Alert>
                    )}

                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner color="primary" />
                            <p className="text-muted mt-2">Cargando portal...</p>
                        </div>
                    ) : (
                        <>
                            {/* Tab Navigation */}
                            <Card>
                                <CardBody className="pb-0">
                                    <Nav tabs className="nav-tabs-custom nav-primary">
                                        {tabs.map(tab => (
                                            <NavItem key={tab.id}>
                                                <NavLink
                                                    className={classnames({ active: activeTab === tab.id })}
                                                    onClick={() => setActiveTab(tab.id)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <i className={`${tab.icon} me-1`}></i>
                                                    {tab.label}
                                                </NavLink>
                                            </NavItem>
                                        ))}
                                    </Nav>
                                </CardBody>
                            </Card>

                            <TabContent activeTab={activeTab}>
                                {/* ============ MI PERFIL ============ */}
                                <TabPane tabId="perfil">
                                    {perfil ? (
                                        <Row>
                                            {/* Datos Personales */}
                                            <Col lg={6}>
                                                <Card>
                                                    <CardHeader className="d-flex justify-content-between align-items-center">
                                                        <h6 className="card-title mb-0">
                                                            <i className="ri-user-3-line me-1 text-primary"></i>
                                                            Datos Personales
                                                        </h6>
                                                        <Button color="soft-primary" size="sm" onClick={openEditModal}>
                                                            <i className="ri-edit-line me-1"></i>
                                                            Actualizar Datos
                                                        </Button>
                                                    </CardHeader>
                                                    <CardBody>
                                                        <Table borderless className="mb-0">
                                                            <tbody>
                                                                <tr>
                                                                    <td className="text-muted fw-medium" style={{ width: '40%' }}>Nombre completo</td>
                                                                    <td className="fw-semibold">{perfil.first_name} {perfil.last_name}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Documento</td>
                                                                    <td>{perfil.document_type} {perfil.document_number}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Correo</td>
                                                                    <td>{perfil.email}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Teléfono</td>
                                                                    <td>{perfil.phone || '-'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Dirección</td>
                                                                    <td>{perfil.address || '-'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Ciudad</td>
                                                                    <td>{perfil.city || '-'}, {perfil.department || '-'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Cargo</td>
                                                                    <td><Badge color="primary">{perfil.position || '-'}</Badge></td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Departamento</td>
                                                                    <td>{perfil.department_name || '-'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Fecha ingreso</td>
                                                                    <td>{fmtDate(perfil.hire_date)}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Tipo contrato</td>
                                                                    <td><Badge color="info">{perfil.contract_type || '-'}</Badge></td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Salario</td>
                                                                    <td className="fw-bold text-success">{fmtCOP(perfil.salary)}</td>
                                                                </tr>
                                                            </tbody>
                                                        </Table>
                                                    </CardBody>
                                                </Card>
                                            </Col>

                                            {/* Datos Bancarios y Afiliacion */}
                                            <Col lg={6}>
                                                {/* Banco */}
                                                <Card>
                                                    <CardHeader>
                                                        <h6 className="card-title mb-0">
                                                            <i className="ri-bank-line me-1 text-success"></i>
                                                            Información Bancaria
                                                        </h6>
                                                    </CardHeader>
                                                    <CardBody>
                                                        <Table borderless className="mb-0">
                                                            <tbody>
                                                                <tr>
                                                                    <td className="text-muted fw-medium" style={{ width: '40%' }}>Banco</td>
                                                                    <td>{perfil.bank_name || '-'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Tipo cuenta</td>
                                                                    <td>{perfil.bank_account_type || '-'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Número cuenta</td>
                                                                    <td className="font-monospace">{perfil.bank_account_number || '-'}</td>
                                                                </tr>
                                                            </tbody>
                                                        </Table>
                                                    </CardBody>
                                                </Card>

                                                {/* Afiliaciones */}
                                                <Card>
                                                    <CardHeader>
                                                        <h6 className="card-title mb-0">
                                                            <i className="ri-shield-check-line me-1 text-warning"></i>
                                                            Afiliaciones
                                                        </h6>
                                                    </CardHeader>
                                                    <CardBody>
                                                        <Table borderless className="mb-0">
                                                            <tbody>
                                                                <tr>
                                                                    <td className="text-muted fw-medium" style={{ width: '40%' }}>EPS</td>
                                                                    <td>{perfil.eps || '-'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Fondo de Pension</td>
                                                                    <td>{perfil.pension_fund || '-'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">ARL</td>
                                                                    <td>{perfil.arl || '-'}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td className="text-muted fw-medium">Caja de Compensacion</td>
                                                                    <td>{perfil.ccf || '-'}</td>
                                                                </tr>
                                                            </tbody>
                                                        </Table>
                                                    </CardBody>
                                                </Card>
                                            </Col>
                                        </Row>
                                    ) : (
                                        <Card>
                                            <CardBody className="text-center py-5 text-muted">
                                                <i className="ri-user-unfollow-line fs-36 d-block mb-2"></i>
                                                <p>No se encontró información del perfil</p>
                                            </CardBody>
                                        </Card>
                                    )}
                                </TabPane>

                                {/* ============ COLILLAS DE PAGO ============ */}
                                <TabPane tabId="colillas">
                                    <Card>
                                        <CardHeader>
                                            <h6 className="card-title mb-0">
                                                <i className="ri-money-dollar-circle-line me-1 text-success"></i>
                                                Colillas de Pago
                                            </h6>
                                        </CardHeader>
                                        <CardBody>
                                            {colillasLoading ? (
                                                <div className="text-center py-4"><Spinner color="primary" /></div>
                                            ) : colillas.length === 0 ? (
                                                <div className="text-center py-4 text-muted">
                                                    <i className="ri-file-paper-line fs-36 d-block mb-2"></i>
                                                    <p>No hay colillas de pago disponibles</p>
                                                </div>
                                            ) : (
                                                <div className="table-responsive">
                                                    <Table className="table-hover table-nowrap align-middle mb-0">
                                                        <thead>
                                                            <tr>
                                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Periodo</th>
                                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Tipo</th>
                                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Desde</th>
                                                                <th className="text-uppercase text-muted fs-12 fw-semibold">Hasta</th>
                                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Devengado</th>
                                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Deducciones</th>
                                                                <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Neto</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {colillas.map((c) => (
                                                                <React.Fragment key={c.id}>
                                                                    <tr
                                                                        style={{ cursor: 'pointer' }}
                                                                        onClick={() => setExpandedColilla(expandedColilla === c.id ? null : c.id)}
                                                                    >
                                                                        <td>
                                                                            <Badge color="primary-subtle" className="text-primary">
                                                                                {c.period_year}/{String(c.period_month).padStart(2, '0')} - P{c.period_number}
                                                                            </Badge>
                                                                        </td>
                                                                        <td><Badge color="info-subtle" className="text-info">{c.period_type}</Badge></td>
                                                                        <td className="text-muted fs-12">{fmtDate(c.start_date)}</td>
                                                                        <td className="text-muted fs-12">{fmtDate(c.end_date)}</td>
                                                                        <td className="text-end font-monospace text-success fw-semibold">{fmtCOP(c.total_devengado)}</td>
                                                                        <td className="text-end font-monospace text-danger">{fmtCOP(c.total_deductions)}</td>
                                                                        <td className="text-end font-monospace fw-bold">{fmtCOP(c.net_pay)}</td>
                                                                    </tr>
                                                                    {expandedColilla === c.id && c.details && (
                                                                        <tr>
                                                                            <td colSpan={7} className="p-0">
                                                                                <Card className="mb-0 border-0 bg-light">
                                                                                    <CardBody className="py-2 px-3">
                                                                                        <Row>
                                                                                            <Col md={6}>
                                                                                                <h6 className="text-success fs-12 mb-2">DEVENGADOS</h6>
                                                                                                <Table size="sm" className="mb-0">
                                                                                                    <tbody>
                                                                                                        {(c.details || [])
                                                                                                            .filter(d => d.type === 'devengado')
                                                                                                            .map((d, idx) => (
                                                                                                                <tr key={idx}>
                                                                                                                    <td className="text-muted fs-12">{d.concept}</td>
                                                                                                                    <td className="text-end font-monospace fs-12">{fmtCOP(d.amount)}</td>
                                                                                                                </tr>
                                                                                                            ))}
                                                                                                    </tbody>
                                                                                                </Table>
                                                                                            </Col>
                                                                                            <Col md={6}>
                                                                                                <h6 className="text-danger fs-12 mb-2">DEDUCCIONES</h6>
                                                                                                <Table size="sm" className="mb-0">
                                                                                                    <tbody>
                                                                                                        {(c.details || [])
                                                                                                            .filter(d => d.type === 'deduccion')
                                                                                                            .map((d, idx) => (
                                                                                                                <tr key={idx}>
                                                                                                                    <td className="text-muted fs-12">{d.concept}</td>
                                                                                                                    <td className="text-end font-monospace fs-12">{fmtCOP(d.amount)}</td>
                                                                                                                </tr>
                                                                                                            ))}
                                                                                                    </tbody>
                                                                                                </Table>
                                                                                            </Col>
                                                                                        </Row>
                                                                                        <hr className="my-2" />
                                                                                        <div className="d-flex justify-content-end">
                                                                                            <strong className="me-3">Neto a pagar:</strong>
                                                                                            <strong className="text-primary">{fmtCOP(c.net_pay)}</strong>
                                                                                        </div>
                                                                                    </CardBody>
                                                                                </Card>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                </div>
                                            )}
                                        </CardBody>
                                    </Card>
                                </TabPane>

                                {/* ============ MIS SOLICITUDES ============ */}
                                <TabPane tabId="solicitudes">
                                    <Row>
                                        {/* Formulario nueva solicitud */}
                                        <Col lg={4}>
                                            <Card>
                                                <CardHeader>
                                                    <h6 className="card-title mb-0">
                                                        <i className="ri-add-circle-line me-1 text-primary"></i>
                                                        Nueva Solicitud
                                                    </h6>
                                                </CardHeader>
                                                <CardBody>
                                                    <Form onSubmit={handleCreateSolicitud}>
                                                        <FormGroup>
                                                            <Label className="fw-medium">Tipo de solicitud</Label>
                                                            <Input
                                                                type="select"
                                                                value={solicitudForm.request_type}
                                                                onChange={e => setSolicitudForm({ ...solicitudForm, request_type: e.target.value })}
                                                            >
                                                                <option value="vacaciones">Vacaciones</option>
                                                                <option value="permiso">Permiso</option>
                                                                <option value="licencia">Licencia</option>
                                                            </Input>
                                                        </FormGroup>
                                                        <FormGroup>
                                                            <Label className="fw-medium">Fecha inicio</Label>
                                                            <Input
                                                                type="date"
                                                                value={solicitudForm.start_date}
                                                                onChange={e => setSolicitudForm({ ...solicitudForm, start_date: e.target.value })}
                                                                required
                                                            />
                                                        </FormGroup>
                                                        <FormGroup>
                                                            <Label className="fw-medium">Fecha fin</Label>
                                                            <Input
                                                                type="date"
                                                                value={solicitudForm.end_date}
                                                                onChange={e => setSolicitudForm({ ...solicitudForm, end_date: e.target.value })}
                                                                required
                                                            />
                                                        </FormGroup>
                                                        <FormGroup>
                                                            <Label className="fw-medium">Descripción / Motivo</Label>
                                                            <Input
                                                                type="textarea"
                                                                rows={3}
                                                                placeholder="Describa el motivo de su solicitud..."
                                                                value={solicitudForm.description}
                                                                onChange={e => setSolicitudForm({ ...solicitudForm, description: e.target.value })}
                                                            />
                                                        </FormGroup>
                                                        <Button
                                                            color="primary"
                                                            type="submit"
                                                            className="w-100"
                                                            disabled={solicitudLoading}
                                                        >
                                                            {solicitudLoading ? (
                                                                <Spinner size="sm" className="me-1" />
                                                            ) : (
                                                                <i className="ri-send-plane-line me-1"></i>
                                                            )}
                                                            Enviar Solicitud
                                                        </Button>
                                                    </Form>
                                                </CardBody>
                                            </Card>
                                        </Col>

                                        {/* Lista de solicitudes */}
                                        <Col lg={8}>
                                            <Card>
                                                <CardHeader>
                                                    <h6 className="card-title mb-0">
                                                        <i className="ri-file-list-3-line me-1 text-info"></i>
                                                        Mis Solicitudes
                                                    </h6>
                                                </CardHeader>
                                                <CardBody>
                                                    {solicitudesLoading ? (
                                                        <div className="text-center py-4"><Spinner color="primary" /></div>
                                                    ) : solicitudes.length === 0 ? (
                                                        <div className="text-center py-4 text-muted">
                                                            <i className="ri-file-list-3-line fs-36 d-block mb-2"></i>
                                                            <p>No tiene solicitudes registradas</p>
                                                        </div>
                                                    ) : (
                                                        <div className="table-responsive">
                                                            <Table className="table-hover table-nowrap align-middle mb-0">
                                                                <thead>
                                                                    <tr>
                                                                        <th className="text-uppercase text-muted fs-12 fw-semibold">Tipo</th>
                                                                        <th className="text-uppercase text-muted fs-12 fw-semibold">Desde</th>
                                                                        <th className="text-uppercase text-muted fs-12 fw-semibold">Hasta</th>
                                                                        <th className="text-uppercase text-muted fs-12 fw-semibold">Motivo</th>
                                                                        <th className="text-uppercase text-muted fs-12 fw-semibold">Estado</th>
                                                                        <th className="text-uppercase text-muted fs-12 fw-semibold">Fecha solicitud</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {solicitudes.map((s) => (
                                                                        <tr key={s.id}>
                                                                            <td>{getRequestTypeBadge(s.request_type)}</td>
                                                                            <td className="text-muted fs-12">{fmtDate(s.start_date)}</td>
                                                                            <td className="text-muted fs-12">{fmtDate(s.end_date)}</td>
                                                                            <td className="text-muted fs-12">{s.description?.substring(0, 40)}{(s.description?.length || 0) > 40 ? '...' : ''}</td>
                                                                            <td>{getStatusBadge(s.status)}</td>
                                                                            <td className="text-muted fs-12">{fmtDate(s.created_at)}</td>
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
                                </TabPane>

                                {/* ============ CERTIFICADOS ============ */}
                                <TabPane tabId="certificados">
                                    <Row>
                                        {/* Certificado Laboral */}
                                        <Col lg={6}>
                                            <Card className="border-primary border-opacity-25">
                                                <CardBody className="text-center py-4">
                                                    <div className="avatar-sm mx-auto mb-3">
                                                        <div className="avatar-title bg-primary-subtle text-primary rounded-circle fs-20">
                                                            <i className="ri-file-text-line"></i>
                                                        </div>
                                                    </div>
                                                    <h5 className="mb-2">Certificado Laboral</h5>
                                                    <p className="text-muted mb-3">
                                                        Documento que certifica su vinculacion laboral actual con la empresa,
                                                        incluyendo cargo, fecha de ingreso y salario.
                                                    </p>
                                                    <Button
                                                        color="primary"
                                                        onClick={() => handleGenerateCertificate('laboral')}
                                                        disabled={certLoading === 'laboral'}
                                                    >
                                                        {certLoading === 'laboral' ? (
                                                            <Spinner size="sm" className="me-1" />
                                                        ) : (
                                                            <i className="ri-download-2-line me-1"></i>
                                                        )}
                                                        Generar Certificado
                                                    </Button>
                                                </CardBody>
                                            </Card>
                                        </Col>

                                        {/* Certificado de Ingresos y Retenciones */}
                                        <Col lg={6}>
                                            <Card className="border-success border-opacity-25">
                                                <CardBody className="text-center py-4">
                                                    <div className="avatar-sm mx-auto mb-3">
                                                        <div className="avatar-title bg-success-subtle text-success rounded-circle fs-20">
                                                            <i className="ri-money-dollar-box-line"></i>
                                                        </div>
                                                    </div>
                                                    <h5 className="mb-2">Certificado de Ingresos y Retenciones</h5>
                                                    <p className="text-muted mb-3">
                                                        Documento con el resumen de ingresos, deducciones y retenciones
                                                        del periodo fiscal. Necesario para declaracion de renta.
                                                    </p>
                                                    <Button
                                                        color="success"
                                                        onClick={() => handleGenerateCertificate('ingresos')}
                                                        disabled={certLoading === 'ingresos'}
                                                    >
                                                        {certLoading === 'ingresos' ? (
                                                            <Spinner size="sm" className="me-1" />
                                                        ) : (
                                                            <i className="ri-download-2-line me-1"></i>
                                                        )}
                                                        Generar Certificado
                                                    </Button>
                                                </CardBody>
                                            </Card>
                                        </Col>
                                    </Row>
                                </TabPane>
                            </TabContent>
                        </>
                    )}

                    {/* ============ MODAL EDITAR DATOS ============ */}
                    <Modal isOpen={editModal} toggle={() => setEditModal(false)} centered>
                        <ModalHeader toggle={() => setEditModal(false)}>
                            Actualizar Datos Personales
                        </ModalHeader>
                        <ModalBody>
                            <FormGroup>
                                <Label className="fw-medium">Teléfono</Label>
                                <Input
                                    type="text"
                                    value={editForm.phone}
                                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                    placeholder="Numero de telefono"
                                />
                            </FormGroup>
                            <FormGroup>
                                <Label className="fw-medium">Correo electrónico</Label>
                                <Input
                                    type="email"
                                    value={editForm.email}
                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                    placeholder="correo@ejemplo.com"
                                />
                            </FormGroup>
                            <FormGroup>
                                <Label className="fw-medium">Dirección</Label>
                                <Input
                                    type="text"
                                    value={editForm.address}
                                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                    placeholder="Dirección de residencia"
                                />
                            </FormGroup>
                        </ModalBody>
                        <ModalFooter>
                            <Button color="light" onClick={() => setEditModal(false)}>
                                Cancelar
                            </Button>
                            <Button color="primary" onClick={handleUpdateProfile} disabled={editLoading}>
                                {editLoading ? <Spinner size="sm" className="me-1" /> : null}
                                Guardar Cambios
                            </Button>
                        </ModalFooter>
                    </Modal>
                </Container>
            </div>
        </React.Fragment>
    );
};

export default MiPortalPage;
