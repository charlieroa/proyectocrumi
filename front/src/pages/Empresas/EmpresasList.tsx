import React, { useEffect, useState, useMemo } from 'react';
import {
    Container, Row, Col, Card, CardBody, CardHeader, Table, Button, Badge,
    Modal, ModalHeader, ModalBody, ModalFooter, Input, Label, Spinner, Alert,
    Pagination, PaginationItem, PaginationLink
} from 'reactstrap';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { api } from '../../services/api';
import Swal from 'sweetalert2';
import BulkUploadModal from '../../Components/Common/BulkUploadModal';

interface Tenant {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    tax_id: string | null;
    business_name: string | null;
    status: string;
}

const EmpresasList = () => {
    // Estados
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

    // Formulario
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formTaxId, setFormTaxId] = useState('');
    const [formBusinessName, setFormBusinessName] = useState('');

    // Paginación
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Modal de carga masiva
    const [bulkOpen, setBulkOpen] = useState(false);

    const totalPages = Math.ceil(tenants.length / ITEMS_PER_PAGE);
    const paginatedTenants = useMemo(() => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        return tenants.slice(start, start + ITEMS_PER_PAGE);
    }, [tenants, page]);

    // Cargar tenants
    const loadTenants = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get('/tenants');
            setTenants(data || []);
        } catch (e: any) {
            setError(e?.response?.data?.message || 'Error cargando empresas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        document.title = 'Listado de Empresas | Bolti Super Admin';
        loadTenants();
    }, []);

    // Abrir modal para nueva empresa
    const openNewModal = () => {
        setEditingTenant(null);
        setFormName('');
        setFormEmail('');
        setFormPhone('');
        setFormAddress('');
        setFormTaxId('');
        setFormBusinessName('');
        setModalOpen(true);
    };

    // Abrir modal para editar
    const openEditModal = (tenant: Tenant) => {
        setEditingTenant(tenant);
        setFormName(tenant.name || '');
        setFormEmail(tenant.email || '');
        setFormPhone(tenant.phone || '');
        setFormAddress(tenant.address || '');
        setFormTaxId(tenant.tax_id || '');
        setFormBusinessName(tenant.business_name || '');
        setModalOpen(true);
    };

    // Cerrar modal
    const closeModal = () => {
        setModalOpen(false);
        setEditingTenant(null);
    };

    // Guardar empresa
    const handleSave = async () => {
        if (!formName.trim()) {
            Swal.fire('Error', 'El nombre de la empresa es obligatorio', 'error');
            return;
        }

        setSaving(true);
        try {
            const tenantData = {
                name: formName.trim(),
                email: formEmail.trim() || null,
                phone: formPhone.trim() || null,
                address: formAddress.trim() || null,
                tax_id: formTaxId.trim() || null,
                business_name: formBusinessName.trim() || null,
            };

            if (editingTenant) {
                await api.put(`/tenants/${editingTenant.id}`, tenantData);
                Swal.fire('¡Actualizado!', 'La empresa ha sido actualizada.', 'success');
            } else {
                await api.post('/tenants', tenantData);
                Swal.fire('¡Creada!', 'La empresa ha sido creada exitosamente.', 'success');
            }

            closeModal();
            loadTenants();
        } catch (e: any) {
            Swal.fire('Error', e?.response?.data?.error || 'Error al guardar la empresa', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Eliminar empresa
    const handleDelete = async (tenant: Tenant) => {
        const result = await Swal.fire({
            title: `¿Eliminar "${tenant.name}"?`,
            text: 'Esta acción eliminará la empresa y puede afectar a usuarios y datos asociados.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/tenants/${tenant.id}`);
                Swal.fire('¡Eliminada!', 'La empresa ha sido eliminada.', 'success');
                loadTenants();
            } catch (e: any) {
                Swal.fire('Error', e?.response?.data?.error || 'No se pudo eliminar la empresa', 'error');
            }
        }
    };

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Empresas" pageTitle="Super Admin" />

                    <Row>
                        <Col lg={12}>
                            <Card>
                                <CardHeader className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">Listado de Empresas</h5>
                                    <div className="d-flex gap-2">
                                        <Button color="success" outline onClick={() => setBulkOpen(true)}>
                                            <i className="ri-file-excel-2-line me-1"></i> Importar Excel
                                        </Button>
                                        <Button color="primary" onClick={openNewModal}>
                                            <i className="ri-add-line me-1"></i> Nueva Empresa
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardBody>
                                    {loading ? (
                                        <div className="text-center py-5">
                                            <Spinner /> <span className="ms-2">Cargando empresas...</span>
                                        </div>
                                    ) : error ? (
                                        <Alert color="danger">{error}</Alert>
                                    ) : tenants.length === 0 ? (
                                        <Alert color="info">No hay empresas registradas. Haz clic en "Nueva Empresa" para crear una.</Alert>
                                    ) : (
                                        <>
                                            <div className="table-responsive">
                                                <Table hover className="align-middle mb-0">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Nombre</th>
                                                            <th>Email</th>
                                                            <th>Teléfono</th>
                                                            <th>NIT</th>
                                                            <th>Estado</th>
                                                            <th style={{ width: 120 }}>Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginatedTenants.map((tenant) => (
                                                            <tr key={tenant.id}>
                                                                <td className="fw-medium">
                                                                    <div>{tenant.name}</div>
                                                                    {tenant.business_name && (
                                                                        <small className="text-muted">{tenant.business_name}</small>
                                                                    )}
                                                                </td>
                                                                <td>{tenant.email || <span className="text-muted">-</span>}</td>
                                                                <td>{tenant.phone || <span className="text-muted">-</span>}</td>
                                                                <td>{tenant.tax_id || <span className="text-muted">-</span>}</td>
                                                                <td>
                                                                    <Badge color={tenant.status === 'active' ? 'success' : 'secondary'}>
                                                                        {tenant.status === 'active' ? 'Activa' : 'Inactiva'}
                                                                    </Badge>
                                                                </td>
                                                                <td>
                                                                    <div className="d-flex gap-1">
                                                                        <Button
                                                                            size="sm"
                                                                            color="soft-primary"
                                                                            onClick={() => openEditModal(tenant)}
                                                                            title="Editar"
                                                                        >
                                                                            <i className="ri-edit-line"></i>
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            color="soft-danger"
                                                                            onClick={() => handleDelete(tenant)}
                                                                            title="Eliminar"
                                                                        >
                                                                            <i className="ri-delete-bin-line"></i>
                                                                        </Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>

                                            {/* Paginación */}
                                            {totalPages > 1 && (
                                                <div className="d-flex justify-content-between align-items-center mt-3">
                                                    <small className="text-muted">
                                                        Mostrando {((page - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(page * ITEMS_PER_PAGE, tenants.length)} de {tenants.length}
                                                    </small>
                                                    <Pagination className="pagination-separated mb-0">
                                                        <PaginationItem disabled={page === 1}>
                                                            <PaginationLink previous onClick={() => setPage(p => Math.max(1, p - 1))} />
                                                        </PaginationItem>
                                                        {[...Array(totalPages)].map((_, idx) => (
                                                            <PaginationItem key={idx + 1} active={page === idx + 1}>
                                                                <PaginationLink onClick={() => setPage(idx + 1)}>{idx + 1}</PaginationLink>
                                                            </PaginationItem>
                                                        ))}
                                                        <PaginationItem disabled={page === totalPages}>
                                                            <PaginationLink next onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
                                                        </PaginationItem>
                                                    </Pagination>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </div>

            {/* Modal para crear/editar empresa */}
            <Modal isOpen={modalOpen} toggle={closeModal} centered size="lg">
                <ModalHeader toggle={closeModal} className="bg-primary-subtle">
                    {editingTenant ? 'Editar Empresa' : 'Nueva Empresa'}
                </ModalHeader>
                <ModalBody>
                    <Row className="g-3">
                        <Col md={6}>
                            <Label>Nombre de la Empresa <span className="text-danger">*</span></Label>
                            <Input
                                type="text"
                                placeholder="Nombre comercial"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                            />
                        </Col>
                        <Col md={6}>
                            <Label>Razón Social</Label>
                            <Input
                                type="text"
                                placeholder="Razón social legal"
                                value={formBusinessName}
                                onChange={(e) => setFormBusinessName(e.target.value)}
                            />
                        </Col>
                        <Col md={6}>
                            <Label>Email</Label>
                            <Input
                                type="email"
                                placeholder="correo@empresa.com"
                                value={formEmail}
                                onChange={(e) => setFormEmail(e.target.value)}
                            />
                        </Col>
                        <Col md={6}>
                            <Label>Teléfono</Label>
                            <Input
                                type="text"
                                placeholder="3000000000"
                                value={formPhone}
                                onChange={(e) => setFormPhone(e.target.value)}
                            />
                        </Col>
                        <Col md={6}>
                            <Label>NIT</Label>
                            <Input
                                type="text"
                                placeholder="900123456-1"
                                value={formTaxId}
                                onChange={(e) => setFormTaxId(e.target.value)}
                            />
                        </Col>
                        <Col md={6}>
                            <Label>Dirección</Label>
                            <Input
                                type="text"
                                placeholder="Dirección de la empresa"
                                value={formAddress}
                                onChange={(e) => setFormAddress(e.target.value)}
                            />
                        </Col>
                    </Row>
                </ModalBody>
                <ModalFooter>
                    <Button color="secondary" outline onClick={closeModal}>
                        Cancelar
                    </Button>
                    <Button
                        color="primary"
                        onClick={handleSave}
                        disabled={saving || !formName.trim()}
                    >
                        {saving ? (
                            <>
                                <Spinner size="sm" className="me-2" />
                                {editingTenant ? 'Guardando...' : 'Creando...'}
                            </>
                        ) : (
                            <>
                                <i className={editingTenant ? "ri-save-line me-1" : "ri-building-2-line me-1"}></i>
                                {editingTenant ? 'Guardar Cambios' : 'Crear Empresa'}
                            </>
                        )}
                    </Button>
                </ModalFooter>
            </Modal>

            <BulkUploadModal
                isOpen={bulkOpen}
                toggle={() => setBulkOpen((v) => !v)}
                onComplete={() => loadTenants()}
            />
        </React.Fragment>
    );
};

export default EmpresasList;
