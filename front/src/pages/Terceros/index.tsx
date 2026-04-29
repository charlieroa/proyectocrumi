import React, { useEffect, useState, useCallback } from 'react';
import {
    Container, Row, Col,
    Card, CardBody, CardHeader, Table, Badge, Input, Button,
    Spinner, Label, Modal, ModalHeader, ModalBody, ModalFooter
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { env } from '../../env';
import { getToken } from '../../services/auth';
import { buildTercerosSidebarSections } from './config/tercerosSidebar';
import BulkUploadThirdPartiesModal from '../../Components/Common/BulkUploadThirdPartiesModal';

const API_BASE = env.API_URL;

const TercerosPage: React.FC = () => {
    document.title = 'Terceros | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');
    const [thirdParties, setThirdParties] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [kindFilter, setKindFilter] = useState('ALL');
    const [summary, setSummary] = useState<any>({ total: 0, byKind: {} });
    const [showModal, setShowModal] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [formRoles, setFormRoles] = useState<string[]>(['CUSTOMER']);
    const [thirdPartyForm, setThirdPartyForm] = useState({
        kind: 'CUSTOMER',
        name: '',
        documentType: 'NIT',
        documentNumber: '',
        email: '',
        phone: '',
        address: '',
        city: ''
    });

    const toggleRole = (r: string) => {
        setFormRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
    };

    const token = getToken();

    const headers: any = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const fetchThirdParties = useCallback(async (search = '', kind = 'ALL') => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (kind && kind !== 'ALL') params.append('kind', kind);
            const res = await fetch(`${API_BASE}/accounting/third-parties?${params}`, { headers });
            const data = await res.json();
            if (data.success !== false) {
                setThirdParties(data.thirdParties || data.data || []);
                setSummary(data.summary || { total: (data.thirdParties || data.data || []).length, byKind: {} });
            }
        } catch (err) {
            console.error('Error fetching third parties:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleCreate = async () => {
        try {
            if (formRoles.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: 'Selecciona al menos un tipo (cliente, proveedor, etc.)',
                    confirmButtonColor: '#1A1D1F',
                });
                return;
            }
            const payload = { ...thirdPartyForm, kind: formRoles[0], roles: formRoles };
            const res = await fetch(`${API_BASE}/accounting/third-parties`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success !== false) {
                setShowModal(false);
                setFormRoles(['CUSTOMER']);
                setThirdPartyForm({ kind: 'CUSTOMER', name: '', documentType: 'NIT', documentNumber: '', email: '', phone: '', address: '', city: '' });
                fetchThirdParties(searchTerm, kindFilter);
            }
        } catch (err) {
            console.error('Error creating third party:', err);
        }
    };

    const handleSync = async () => {
        try {
            await fetch(`${API_BASE}/accounting/third-parties/sync`, { method: 'POST', headers });
            fetchThirdParties(searchTerm, kindFilter);
        } catch (err) {
            console.error('Error syncing:', err);
        }
    };

    useEffect(() => {
        fetchThirdParties();
    }, [fetchThirdParties]);

    const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

    const kindBadge = (kind: string) => {
        switch (kind) {
            case 'CUSTOMER': return <Badge color="success">Cliente</Badge>;
            case 'SUPPLIER': return <Badge color="warning">Proveedor</Badge>;
            case 'EMPLOYEE': return <Badge color="info">Empleado</Badge>;
            default: return <Badge color="secondary">Otro</Badge>;
        }
    };

    const renderThirdPartiesTable = (filterKind?: string) => {
        const filtered = filterKind
            ? thirdParties.filter(tp => tp.kind === filterKind)
            : thirdParties;

        return (
            <Card>
                <CardHeader className="d-flex align-items-center justify-content-between">
                    <h5 className="mb-0">
                        {filterKind ? `Terceros - ${filterKind === 'CUSTOMER' ? 'Clientes' : filterKind === 'SUPPLIER' ? 'Proveedores' : 'Empleados'}` : 'Listado de Terceros'}
                    </h5>
                    <div className="d-flex gap-2">
                        {!filterKind && (
                            <Input type="select" bsSize="sm" style={{ width: 160 }} value={kindFilter} onChange={e => { setKindFilter(e.target.value); fetchThirdParties(searchTerm, e.target.value); }}>
                                <option value="ALL">Todos</option>
                                <option value="CUSTOMER">Clientes</option>
                                <option value="SUPPLIER">Proveedores</option>
                                <option value="EMPLOYEE">Empleados</option>
                            </Input>
                        )}
                        <Input type="text" bsSize="sm" placeholder="Buscar..." style={{ width: 200 }} value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); fetchThirdParties(e.target.value, filterKind || kindFilter); }} />
                        <Button color="success" size="sm" onClick={() => setBulkOpen(true)}>
                            <i className="ri-upload-2-line me-1" /> Carga masiva
                        </Button>
                        <Button color="info" size="sm" onClick={handleSync}>Sincronizar</Button>
                    </div>
                </CardHeader>
                <CardBody>
                    {loading ? (
                        <div className="text-center py-4"><Spinner color="primary" /></div>
                    ) : (
                        <div className="table-responsive">
                            <Table className="table-hover mb-0" size="sm">
                                <thead className="table-light">
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Documento</th>
                                        <th>Tipo</th>
                                        <th>Email</th>
                                        <th>Telefono</th>
                                        <th>Ciudad</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center text-muted py-3">Sin terceros registrados</td></tr>
                                    ) : filtered.map((tp: any) => (
                                        <tr key={tp.id}>
                                            <td className="fw-medium">{tp.name}</td>
                                            <td>{tp.document_type} {tp.document_number}</td>
                                            <td>{kindBadge(tp.kind)}</td>
                                            <td>{tp.email || '-'}</td>
                                            <td>{tp.phone || '-'}</td>
                                            <td>{tp.city || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </CardBody>
            </Card>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <Row className="g-3">
                        <Col md={3}>
                            <Card className="card-animate">
                                <CardBody className="text-center">
                                    <i className="ri-group-line fs-1 text-primary"></i>
                                    <h4 className="mt-2">{summary.total || thirdParties.length}</h4>
                                    <p className="text-muted mb-0">Total Terceros</p>
                                </CardBody>
                            </Card>
                        </Col>
                        <Col md={3}>
                            <Card className="card-animate">
                                <CardBody className="text-center">
                                    <i className="ri-user-star-line fs-1 text-success"></i>
                                    <h4 className="mt-2">{summary.byKind?.CUSTOMER || thirdParties.filter(t => t.kind === 'CUSTOMER').length}</h4>
                                    <p className="text-muted mb-0">Clientes</p>
                                </CardBody>
                            </Card>
                        </Col>
                        <Col md={3}>
                            <Card className="card-animate">
                                <CardBody className="text-center">
                                    <i className="ri-truck-line fs-1 text-warning"></i>
                                    <h4 className="mt-2">{summary.byKind?.SUPPLIER || thirdParties.filter(t => t.kind === 'SUPPLIER').length}</h4>
                                    <p className="text-muted mb-0">Proveedores</p>
                                </CardBody>
                            </Card>
                        </Col>
                        <Col md={3}>
                            <Card className="card-animate">
                                <CardBody className="text-center">
                                    <i className="ri-team-line fs-1 text-info"></i>
                                    <h4 className="mt-2">{summary.byKind?.EMPLOYEE || thirdParties.filter(t => t.kind === 'EMPLOYEE').length}</h4>
                                    <p className="text-muted mb-0">Empleados</p>
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                );

            case 'listado':
                return renderThirdPartiesTable();

            case 'nuevo':
                return (
                    <Card>
                        <CardHeader><h5 className="mb-0">Nuevo Tercero</h5></CardHeader>
                        <CardBody>
                            <Row className="g-3">
                                <Col md={12}>
                                    <Label className="d-block">Tipo de Tercero <small className="text-muted">(puedes marcar más de uno)</small></Label>
                                    <div className="d-flex flex-wrap gap-3">
                                        {[
                                            { v: 'CUSTOMER', label: 'Cliente' },
                                            { v: 'SUPPLIER', label: 'Proveedor' },
                                            { v: 'EMPLOYEE', label: 'Empleado' },
                                            { v: 'OTHER', label: 'Otro' },
                                        ].map(opt => (
                                            <div key={opt.v} className="form-check">
                                                <Input
                                                    type="checkbox"
                                                    id={`role-${opt.v}`}
                                                    checked={formRoles.includes(opt.v)}
                                                    onChange={() => toggleRole(opt.v)}
                                                />
                                                <Label for={`role-${opt.v}`} className="form-check-label ms-1">{opt.label}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </Col>
                                <Col md={4}>
                                    <Label>Nombre</Label>
                                    <Input type="text" value={thirdPartyForm.name} onChange={e => setThirdPartyForm({ ...thirdPartyForm, name: e.target.value })} placeholder="Nombre completo o razon social" />
                                </Col>
                                <Col md={4}>
                                    <Label>Tipo Documento</Label>
                                    <Input type="select" value={thirdPartyForm.documentType} onChange={e => setThirdPartyForm({ ...thirdPartyForm, documentType: e.target.value })}>
                                        <option value="NIT">NIT</option>
                                        <option value="CC">CC</option>
                                        <option value="CE">CE</option>
                                        <option value="TI">TI</option>
                                        <option value="PP">PP</option>
                                    </Input>
                                </Col>
                                <Col md={4}>
                                    <Label>Numero Documento</Label>
                                    <Input type="text" value={thirdPartyForm.documentNumber} onChange={e => setThirdPartyForm({ ...thirdPartyForm, documentNumber: e.target.value })} placeholder="Numero de documento" />
                                </Col>
                                <Col md={4}>
                                    <Label>Email</Label>
                                    <Input type="email" value={thirdPartyForm.email} onChange={e => setThirdPartyForm({ ...thirdPartyForm, email: e.target.value })} placeholder="correo@ejemplo.com" />
                                </Col>
                                <Col md={4}>
                                    <Label>Telefono</Label>
                                    <Input type="text" value={thirdPartyForm.phone} onChange={e => setThirdPartyForm({ ...thirdPartyForm, phone: e.target.value })} placeholder="Telefono" />
                                </Col>
                                <Col md={6}>
                                    <Label>Direccion</Label>
                                    <Input type="text" value={thirdPartyForm.address} onChange={e => setThirdPartyForm({ ...thirdPartyForm, address: e.target.value })} placeholder="Direccion" />
                                </Col>
                                <Col md={6}>
                                    <Label>Ciudad</Label>
                                    <Input type="text" value={thirdPartyForm.city} onChange={e => setThirdPartyForm({ ...thirdPartyForm, city: e.target.value })} placeholder="Ciudad" />
                                </Col>
                                <Col xs={12}>
                                    <Button color="primary" onClick={handleCreate}>Crear Tercero</Button>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                );

            case 'clientes':
                return renderThirdPartiesTable('CUSTOMER');

            case 'proveedores':
                return renderThirdPartiesTable('SUPPLIER');

            case 'empleados':
                return renderThirdPartiesTable('EMPLOYEE');

            default:
                return null;
        }
    };

    const sidebarSections = buildTercerosSidebarSections();

    return (
        <ModuleLayout
            title="Terceros"
            sections={sidebarSections}
            activeItem={activeTab}
            onItemClick={setActiveTab}
        >
            <Container fluid className="p-0">
                {renderContent()}
            </Container>
            <BulkUploadThirdPartiesModal
                isOpen={bulkOpen}
                toggle={() => setBulkOpen(false)}
                onComplete={() => fetchThirdParties(searchTerm, kindFilter)}
            />
        </ModuleLayout>
    );
};

export default TercerosPage;
