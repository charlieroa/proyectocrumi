// src/pages/Crm/ClienteDocumentosKanban/index.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Container,
    Row,
    Col,
    Card,
    CardBody,
    CardHeader,
    Button,
    UncontrolledDropdown,
    DropdownToggle,
    DropdownMenu,
    DropdownItem,
    Badge,
    Modal,
    ModalHeader,
    ModalBody,
    Spinner,
} from 'reactstrap';
import BreadCrumb from '../../../Components/Common/BreadCrumb';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from 'reselect';
import { getContacts } from '../../../slices/crm/thunk';

// Tipos para documentos
interface Document {
    id: string;
    type: string;
    number: string;
    date: string;
    total: number;
    status: string;
    description?: string;
}

interface KanbanColumn {
    id: string;
    title: string;
    color: string;
    icon: string;
    documents: Document[];
}

// Datos de ejemplo - TODO: Conectar con backend real
const generateMockDocuments = (clientId: string): KanbanColumn[] => {
    return [
        {
            id: 'cotizaciones',
            title: 'Cotizaciones',
            color: 'info',
            icon: 'ri-file-list-line',
            documents: [
                {
                    id: `cot-${clientId}-1`,
                    type: 'Cotización',
                    number: 'COT-001',
                    date: '2024-12-10',
                    total: 1500000,
                    status: 'pending',
                    description: 'Cotización de servicios mensuales',
                },
                {
                    id: `cot-${clientId}-2`,
                    type: 'Cotización',
                    number: 'COT-002',
                    date: '2024-12-08',
                    total: 850000,
                    status: 'pending',
                    description: 'Cotización adicional',
                },
            ],
        },
        {
            id: 'facturas',
            title: 'Facturas',
            color: 'success',
            icon: 'ri-file-text-line',
            documents: [
                {
                    id: `fac-${clientId}-1`,
                    type: 'Factura',
                    number: 'FAC-001',
                    date: '2024-12-05',
                    total: 2300000,
                    status: 'paid',
                    description: 'Factura de venta - Servicio premium',
                },
                {
                    id: `fac-${clientId}-2`,
                    type: 'Factura',
                    number: 'FAC-002',
                    date: '2024-12-01',
                    total: 1200000,
                    status: 'pending',
                    description: 'Factura pendiente de cobro',
                },
            ],
        },
        {
            id: 'remisiones',
            title: 'Remisiones',
            color: 'warning',
            icon: 'ri-truck-line',
            documents: [
                {
                    id: `rem-${clientId}-1`,
                    type: 'Remisión',
                    number: 'REM-001',
                    date: '2024-12-07',
                    total: 500000,
                    status: 'delivered',
                    description: 'Entrega de productos',
                },
            ],
        },
        {
            id: 'notas-credito',
            title: 'Notas Crédito',
            color: 'secondary',
            icon: 'ri-arrow-go-back-line',
            documents: [
                {
                    id: `nc-${clientId}-1`,
                    type: 'Nota Crédito',
                    number: 'NC-001',
                    date: '2024-12-03',
                    total: -150000,
                    status: 'applied',
                    description: 'Devolución parcial',
                },
            ],
        },
        {
            id: 'notas-debito',
            title: 'Notas Débito',
            color: 'danger',
            icon: 'ri-arrow-go-forward-line',
            documents: [],
        },
        {
            id: 'pagos',
            title: 'Pagos',
            color: 'primary',
            icon: 'ri-money-dollar-circle-line',
            documents: [
                {
                    id: `pago-${clientId}-1`,
                    type: 'Recibo de Pago',
                    number: 'PAG-001',
                    date: '2024-12-06',
                    total: 2300000,
                    status: 'completed',
                    description: 'Pago FAC-001',
                },
            ],
        },
    ];
};

const ClienteDocumentosKanban: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const dispatch: any = useDispatch();

    // Redux selector para obtener info del cliente
    const selectCrmState = createSelector(
        (state: any) => state.Crm,
        (crm) => ({
            clients: crm.crmcontacts || [],
            loading: crm.loading || false,
        })
    );
    const { clients, loading: clientsLoading } = useSelector(selectCrmState);

    // Obtener cliente actual
    const currentClient = useMemo(() => {
        return clients.find((c: any) => String(c.id) === String(clientId));
    }, [clients, clientId]);

    // Estado del Kanban
    const [columns, setColumns] = useState<KanbanColumn[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Cargar clientes si no están cargados
    useEffect(() => {
        if (clients.length === 0) {
            dispatch(getContacts());
        }
    }, [dispatch, clients.length]);

    // Cargar documentos del cliente
    useEffect(() => {
        if (clientId) {
            setLoading(true);
            // TODO: Hacer fetch real de documentos del cliente desde el backend
            // Por ahora usamos datos de ejemplo
            setTimeout(() => {
                setColumns(generateMockDocuments(clientId));
                setLoading(false);
            }, 500);
        }
    }, [clientId]);

    // Ver detalle del documento
    const handleViewDocument = (doc: Document) => {
        setSelectedDocument(doc);
        setModalOpen(true);
    };

    // Crear nuevo documento
    const handleCreateDocument = (type: string) => {
        const typeMap: Record<string, string> = {
            cotizaciones: 'cotizacion',
            facturas: 'factura',
            remisiones: 'remision',
            'notas-credito': 'nota-credito',
            'notas-debito': 'nota-debito',
            pagos: 'pago',
        };
        navigate(`/ingresos/factura-venta/crear?tipo=${typeMap[type] || 'factura'}&cliente=${clientId}`);
    };

    // Formatear moneda
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Obtener color del badge según estado
    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { color: string; label: string }> = {
            pending: { color: 'warning', label: 'Pendiente' },
            paid: { color: 'success', label: 'Pagada' },
            delivered: { color: 'info', label: 'Entregada' },
            applied: { color: 'secondary', label: 'Aplicada' },
            completed: { color: 'success', label: 'Completado' },
        };
        const statusInfo = statusMap[status] || { color: 'light', label: status };
        return <Badge color={statusInfo.color}>{statusInfo.label}</Badge>;
    };

    document.title = `Documentos - ${currentClient?.name || 'Cliente'} | Velzon`;

    if (clientsLoading && !currentClient) {
        return (
            <div className="page-content">
                <Container fluid>
                    <div className="text-center py-5">
                        <Spinner color="primary" />
                        <p className="mt-2">Cargando información del cliente...</p>
                    </div>
                </Container>
            </div>
        );
    }

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title={currentClient?.name || 'Cliente'} pageTitle="Clientes" />

                    {/* Header con info del cliente */}
                    <Card className="mb-3">
                        <CardBody>
                            <Row className="align-items-center">
                                <Col>
                                    <div className="d-flex align-items-center gap-3">
                                        <Link to="/clientes" className="btn btn-soft-secondary btn-sm">
                                            <i className="ri-arrow-left-line me-1"></i> Volver
                                        </Link>
                                        <div>
                                            <h5 className="mb-1">{currentClient?.name || 'Cliente'}</h5>
                                            <p className="text-muted mb-0">
                                                {currentClient?.email} {currentClient?.phone && `• ${currentClient.phone}`}
                                            </p>
                                        </div>
                                    </div>
                                </Col>
                                <Col xs="auto">
                                    <UncontrolledDropdown>
                                        <DropdownToggle color="success" caret>
                                            <i className="ri-add-line me-1"></i> Nuevo Documento
                                        </DropdownToggle>
                                        <DropdownMenu>
                                            <DropdownItem onClick={() => handleCreateDocument('facturas')}>
                                                <i className="ri-file-text-line me-2 text-success"></i> Factura
                                            </DropdownItem>
                                            <DropdownItem onClick={() => handleCreateDocument('cotizaciones')}>
                                                <i className="ri-file-list-line me-2 text-info"></i> Cotización
                                            </DropdownItem>
                                            <DropdownItem onClick={() => handleCreateDocument('remisiones')}>
                                                <i className="ri-truck-line me-2 text-warning"></i> Remisión
                                            </DropdownItem>
                                            <DropdownItem divider />
                                            <DropdownItem onClick={() => handleCreateDocument('notas-credito')}>
                                                <i className="ri-arrow-go-back-line me-2 text-secondary"></i> Nota Crédito
                                            </DropdownItem>
                                            <DropdownItem onClick={() => handleCreateDocument('notas-debito')}>
                                                <i className="ri-arrow-go-forward-line me-2 text-danger"></i> Nota Débito
                                            </DropdownItem>
                                            <DropdownItem divider />
                                            <DropdownItem onClick={() => handleCreateDocument('pagos')}>
                                                <i className="ri-money-dollar-circle-line me-2 text-primary"></i> Recibo de Pago
                                            </DropdownItem>
                                        </DropdownMenu>
                                    </UncontrolledDropdown>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>

                    {/* Kanban Board */}
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner color="primary" />
                            <p className="mt-2">Cargando documentos...</p>
                        </div>
                    ) : (
                        <div className="tasks-board mb-3" id="kanbanboard">
                            <div 
                                className="tasks-list d-flex gap-3" 
                                style={{ 
                                    overflowX: 'auto', 
                                    paddingBottom: '1rem',
                                    scrollbarWidth: 'thin'
                                }}
                            >
                                {columns.map((column) => (
                                    <div
                                        key={column.id}
                                        className="tasks-items"
                                        style={{ minWidth: '280px', maxWidth: '320px', flex: '0 0 auto' }}
                                    >
                                        <Card className="task-box shadow-sm">
                                            <CardHeader className={`bg-${column.color}-subtle border-0`}>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <h6 className={`text-${column.color} mb-0 fw-semibold`}>
                                                        <i className={`${column.icon} me-2`}></i>
                                                        {column.title}
                                                        <Badge color={column.color} className="ms-2" pill>
                                                            {column.documents.length}
                                                        </Badge>
                                                    </h6>
                                                    <Button
                                                        color="link"
                                                        size="sm"
                                                        className={`text-${column.color} p-0`}
                                                        onClick={() => handleCreateDocument(column.id)}
                                                        title={`Agregar ${column.title}`}
                                                    >
                                                        <i className="ri-add-line fs-18"></i>
                                                    </Button>
                                                </div>
                                            </CardHeader>

                                            <div
                                                className="tasks-wrapper px-3 py-2"
                                                style={{
                                                    minHeight: '300px',
                                                    maxHeight: '60vh',
                                                    overflowY: 'auto',
                                                }}
                                            >
                                                {column.documents.length === 0 ? (
                                                    <div className="text-center text-muted py-4">
                                                        <i className="ri-file-list-3-line fs-24 mb-2 d-block opacity-50"></i>
                                                        <span className="fs-12">Sin documentos</span>
                                                        <div className="mt-2">
                                                            <Button
                                                                color={column.color}
                                                                size="sm"
                                                                outline
                                                                onClick={() => handleCreateDocument(column.id)}
                                                            >
                                                                <i className="ri-add-line me-1"></i>
                                                                Crear
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    column.documents.map((doc) => (
                                                        <Card
                                                            key={doc.id}
                                                            className="mb-2 shadow-sm border cursor-pointer"
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => handleViewDocument(doc)}
                                                        >
                                                            <CardBody className="p-3">
                                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                                    <Badge color={column.color} className="fs-10">
                                                                        {doc.number}
                                                                    </Badge>
                                                                    {getStatusBadge(doc.status)}
                                                                </div>
                                                                <h6 className="fs-14 mb-2 text-dark">{doc.type}</h6>
                                                                {doc.description && (
                                                                    <p className="text-muted fs-12 mb-2" style={{ lineHeight: 1.3 }}>
                                                                        {doc.description.length > 60
                                                                            ? `${doc.description.substring(0, 60)}...`
                                                                            : doc.description}
                                                                    </p>
                                                                )}
                                                                <div className="d-flex justify-content-between align-items-center">
                                                                    <span className="text-muted fs-11">
                                                                        <i className="ri-calendar-line me-1"></i>
                                                                        {doc.date}
                                                                    </span>
                                                                    <span
                                                                        className={`fw-semibold ${doc.total < 0 ? 'text-danger' : 'text-success'}`}
                                                                    >
                                                                        {formatCurrency(doc.total)}
                                                                    </span>
                                                                </div>
                                                            </CardBody>
                                                        </Card>
                                                    ))
                                                )}
                                            </div>
                                        </Card>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Container>
            </div>

            {/* Modal Detalle de Documento */}
            <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} centered>
                <ModalHeader toggle={() => setModalOpen(false)}>
                    Detalle del Documento
                </ModalHeader>
                <ModalBody>
                    {selectedDocument && (
                        <div>
                            <Row className="mb-3">
                                <Col xs={6}>
                                    <strong>Tipo:</strong>
                                </Col>
                                <Col xs={6}>{selectedDocument.type}</Col>
                            </Row>
                            <Row className="mb-3">
                                <Col xs={6}>
                                    <strong>Número:</strong>
                                </Col>
                                <Col xs={6}>{selectedDocument.number}</Col>
                            </Row>
                            <Row className="mb-3">
                                <Col xs={6}>
                                    <strong>Fecha:</strong>
                                </Col>
                                <Col xs={6}>{selectedDocument.date}</Col>
                            </Row>
                            <Row className="mb-3">
                                <Col xs={6}>
                                    <strong>Total:</strong>
                                </Col>
                                <Col xs={6} className={selectedDocument.total < 0 ? 'text-danger' : 'text-success'}>
                                    {formatCurrency(selectedDocument.total)}
                                </Col>
                            </Row>
                            <Row className="mb-3">
                                <Col xs={6}>
                                    <strong>Estado:</strong>
                                </Col>
                                <Col xs={6}>{getStatusBadge(selectedDocument.status)}</Col>
                            </Row>
                            {selectedDocument.description && (
                                <Row className="mb-3">
                                    <Col xs={12}>
                                        <strong>Descripción:</strong>
                                        <p className="text-muted mt-1 mb-0">{selectedDocument.description}</p>
                                    </Col>
                                </Row>
                            )}
                            <hr />
                            <div className="d-flex gap-2">
                                <Button color="primary" size="sm">
                                    <i className="ri-edit-line me-1"></i> Editar
                                </Button>
                                <Button color="secondary" size="sm">
                                    <i className="ri-printer-line me-1"></i> Imprimir
                                </Button>
                                <Button color="info" size="sm">
                                    <i className="ri-mail-line me-1"></i> Enviar
                                </Button>
                            </div>
                        </div>
                    )}
                </ModalBody>
            </Modal>
        </React.Fragment>
    );
};

export default ClienteDocumentosKanban;
