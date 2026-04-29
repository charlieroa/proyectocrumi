import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Container, Row, Col,
    Card, CardBody, Table, Badge, Input, Button,
    Spinner, Label,
    Offcanvas, OffcanvasBody, OffcanvasHeader,
} from 'reactstrap';
import { ArrowLeft, Plus, Eye, Trash2, Repeat, Send, Check, X } from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { env } from '../../env';
import { getToken } from '../../services/auth';
import CotizacionTab from '../income/SalesInvoice/tabs/CotizacionTab';
import type { DocumentConfig } from '../income/SalesInvoice/Create';

const API_BASE = env.API_URL;

const CotizacionesPage: React.FC = () => {
    document.title = 'Cotizaciones | Bolti';
    const navigate = useNavigate();

    const [quotes, setQuotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dashboard, setDashboard] = useState<any[]>([]);

    const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
    const [detailQuote, setDetailQuote] = useState<any>(null);
    const [searchParams, setSearchParams] = useSearchParams();

    const token = getToken();
    const headers: any = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const fetchQuotes = useCallback(async (search = '', status = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (status) params.append('status', status);
            const res = await fetch(`${API_BASE}/quotes-ext?${params}`, { headers });
            const data = await res.json();
            if (data.success) {
                setQuotes(data.quotes || []);
                setDashboard(data.dashboard || []);
            }
        } catch (err) {
            console.error('Error fetching quotes:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const openDetail = async (id: string) => {
        try {
            const res = await fetch(`${API_BASE}/quotes-ext/${id}`, { headers });
            const data = await res.json();
            if (data.success) setDetailQuote(data.quote);
        } catch (err) {
            console.error('Error fetching quote detail:', err);
        }
    };

    const handleDelete = async (id: string) => {
        const confirmRes = await Swal.fire({
            icon: 'question',
            title: '¿Eliminar cotización?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1A1D1F',
        });
        if (!confirmRes.isConfirmed) return;
        try {
            await fetch(`${API_BASE}/quotes-ext/${id}`, { method: 'DELETE', headers });
            fetchQuotes(searchTerm, statusFilter);
        } catch (err) {
            console.error('Error deleting quote:', err);
        }
    };

    const handleStatusChange = async (id: string, status: 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA') => {
        const labels: Record<string, string> = { ENVIADA: 'enviada', ACEPTADA: 'aceptada', RECHAZADA: 'rechazada' };
        const confirmRes = await Swal.fire({
            icon: 'question',
            title: `¿Marcar como ${labels[status]}?`,
            showCancelButton: true,
            confirmButtonText: `Sí, marcar como ${labels[status]}`,
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1A1D1F',
        });
        if (!confirmRes.isConfirmed) return;
        try {
            const res = await fetch(`${API_BASE}/quotes-ext/${id}/status`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.success !== false) {
                fetchQuotes(searchTerm, statusFilter);
            } else {
                Swal.fire({ icon: 'error', title: data?.error || 'No se pudo cambiar el estado', confirmButtonColor: '#1A1D1F' });
            }
        } catch (err) {
            console.error('Error updating status:', err);
            Swal.fire({ icon: 'error', title: 'Error de red', confirmButtonColor: '#1A1D1F' });
        }
    };

    const handleConvert = async (id: string) => {
        const confirmRes = await Swal.fire({
            icon: 'question',
            title: '¿Convertir a factura?',
            text: 'Se creará una factura de venta a partir de esta cotización. Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, convertir',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1A1D1F',
        });
        if (!confirmRes.isConfirmed) return;
        try {
            const res = await fetch(`${API_BASE}/quotes-ext/${id}/convert-to-invoice`, { method: 'POST', headers });
            const data = await res.json();
            if (data.success) {
                await Swal.fire({ icon: 'success', title: 'Factura creada', confirmButtonColor: '#1A1D1F', timer: 1600 });
                setDetailQuote(null);
                fetchQuotes(searchTerm, statusFilter);
            } else {
                Swal.fire({ icon: 'error', title: data?.error || 'No se pudo convertir', confirmButtonColor: '#1A1D1F' });
            }
        } catch (err) {
            console.error('Error converting:', err);
            Swal.fire({ icon: 'error', title: 'Error de red', confirmButtonColor: '#1A1D1F' });
        }
    };

    useEffect(() => {
        fetchQuotes();
    }, [fetchQuotes]);

    // Auto-abrir drawer si la URL trae ?nuevo=1 (atajo rápido)
    useEffect(() => {
        if (searchParams.get('nuevo') === '1') {
            setCreateDrawerOpen(true);
            const next = new URLSearchParams(searchParams);
            next.delete('nuevo');
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const fmt = (n: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0);

    const statusBadge = (status: string) => {
        switch (status) {
            case 'BORRADOR': return <Badge color="secondary">Borrador</Badge>;
            case 'PENDIENTE': return <Badge color="warning">Pendiente</Badge>;
            case 'ENVIADA': return <Badge color="info">Enviada</Badge>;
            case 'ACEPTADA': return <Badge color="success">Aceptada</Badge>;
            case 'RECHAZADA': return <Badge color="danger">Rechazada</Badge>;
            case 'CONVERTIDA': return <Badge color="primary">Convertida</Badge>;
            default: return <Badge color="secondary">{status || '—'}</Badge>;
        }
    };

    const getDashboardValue = (status: string) => {
        const item = dashboard.find((d: any) => d.status === status);
        return { count: item?.count || 0, total: Number(item?.total_value || 0) };
    };

    const STATUSES: Array<{ key: string; label: string; color: string }> = [
        { key: 'BORRADOR', label: 'Borrador', color: 'secondary' },
        { key: 'PENDIENTE', label: 'Pendiente', color: 'warning' },
        { key: 'ENVIADA', label: 'Enviada', color: 'info' },
        { key: 'ACEPTADA', label: 'Aceptada', color: 'success' },
        { key: 'RECHAZADA', label: 'Rechazada', color: 'danger' },
        { key: 'CONVERTIDA', label: 'Convertida', color: 'primary' },
    ];

    return (
        <Container fluid className="py-3">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2">
                    <Button color="light" onClick={() => navigate('/contabilidad')} className="d-inline-flex align-items-center gap-1">
                        <ArrowLeft size={16} /> Volver
                    </Button>
                    <div className="d-flex align-items-center gap-2 ms-2">
                        <div className="avatar-sm rounded-circle bg-info-subtle d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                            <i className="ri-file-paper-line fs-20 text-info" />
                        </div>
                        <div>
                            <h5 className="mb-0">Cotizaciones</h5>
                            <div className="text-muted fs-13">Propuestas comerciales antes de facturar</div>
                        </div>
                    </div>
                </div>
                <Button color="primary" onClick={() => setCreateDrawerOpen(true)} className="d-inline-flex align-items-center gap-1">
                    <Plus size={16} /> Nueva cotización
                </Button>
            </div>

            {/* KPIs por estado */}
            <Row className="g-2 mb-3">
                {STATUSES.map(s => {
                    const v = getDashboardValue(s.key);
                    return (
                        <Col xs={6} md={4} lg={2} key={s.key}>
                            <Card className="shadow-sm h-100 mb-0">
                                <CardBody className="py-2 px-3">
                                    <Badge color={s.color} className={`badge-soft-${s.color} mb-1`}>{s.label}</Badge>
                                    <div className="fs-18 fw-semibold">{v.count}</div>
                                    <div className="text-muted small" style={{ fontFamily: 'monospace' }}>{fmt(v.total)}</div>
                                </CardBody>
                            </Card>
                        </Col>
                    );
                })}
            </Row>

            {/* Filtros + tabla */}
            <Card className="shadow-sm">
                <CardBody>
                    <div className="d-flex align-items-center justify-content-end gap-2 mb-3" style={{ flexWrap: 'nowrap' }}>
                        <Input
                            type="select"
                            bsSize="sm"
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); fetchQuotes(searchTerm, e.target.value); }}
                            style={{ flex: '0 0 150px' }}
                        >
                            <option value="">Todos</option>
                            <option value="BORRADOR">Borrador</option>
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="ENVIADA">Enviada</option>
                            <option value="ACEPTADA">Aceptada</option>
                            <option value="RECHAZADA">Rechazada</option>
                            <option value="CONVERTIDA">Convertida</option>
                        </Input>
                        <Input
                            type="text"
                            bsSize="sm"
                            placeholder="Buscar cliente o número..."
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); fetchQuotes(e.target.value, statusFilter); }}
                            style={{ flex: '0 1 260px', minWidth: 180 }}
                        />
                    </div>

                    {loading ? (
                        <div className="text-center py-5"><Spinner color="primary" /></div>
                    ) : quotes.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <i className="ri-file-paper-line" style={{ fontSize: 48, opacity: 0.4 }} />
                            <div className="mt-2">Aún no hay cotizaciones. Crea la primera con el botón de arriba.</div>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="align-middle mb-0" size="sm">
                                <thead className="table-light">
                                    <tr>
                                        <th>Número</th>
                                        <th>Cliente</th>
                                        <th>Fecha</th>
                                        <th>Válido hasta</th>
                                        <th className="text-end">Total</th>
                                        <th>Estado</th>
                                        <th style={{ width: 160 }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quotes.map((q: any) => (
                                        <tr key={q.id}>
                                            <td className="fw-medium">{q.quote_number}</td>
                                            <td>{q.client_name}</td>
                                            <td>{q.date ? new Date(q.date).toLocaleDateString('es-CO') : '—'}</td>
                                            <td>{q.valid_until ? new Date(q.valid_until).toLocaleDateString('es-CO') : '—'}</td>
                                            <td className="text-end" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmt(q.total)}</td>
                                            <td>{statusBadge(q.status)}</td>
                                            <td>
                                                <div className="d-flex gap-1 flex-wrap">
                                                    <Button color="light" size="sm" onClick={() => openDetail(q.id)} title="Ver detalle">
                                                        <Eye size={14} />
                                                    </Button>
                                                    {(q.status === 'BORRADOR' || q.status === 'PENDIENTE') && (
                                                        <Button color="info" outline size="sm" onClick={() => handleStatusChange(q.id, 'ENVIADA')} title="Marcar enviada">
                                                            <Send size={14} />
                                                        </Button>
                                                    )}
                                                    {(q.status === 'PENDIENTE' || q.status === 'ENVIADA') && (
                                                        <Button color="success" outline size="sm" onClick={() => handleStatusChange(q.id, 'ACEPTADA')} title="Marcar aceptada">
                                                            <Check size={14} />
                                                        </Button>
                                                    )}
                                                    {(q.status === 'PENDIENTE' || q.status === 'ENVIADA') && (
                                                        <Button color="danger" outline size="sm" onClick={() => handleStatusChange(q.id, 'RECHAZADA')} title="Marcar rechazada">
                                                            <X size={14} />
                                                        </Button>
                                                    )}
                                                    {q.status !== 'CONVERTIDA' && q.status !== 'RECHAZADA' && (
                                                        <Button color="success" size="sm" onClick={() => handleConvert(q.id)} title="Convertir en factura" className="d-inline-flex align-items-center gap-1">
                                                            <Repeat size={14} /> <span className="d-none d-md-inline">Convertir</span>
                                                        </Button>
                                                    )}
                                                    <Button color="light" size="sm" className="text-danger" onClick={() => handleDelete(q.id)} title="Eliminar">
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* Drawer de creación de cotización — mismo patrón que Compras / Factura de venta */}
            <Offcanvas
                direction="end"
                isOpen={createDrawerOpen}
                toggle={() => setCreateDrawerOpen(!createDrawerOpen)}
                style={{ width: '95vw', maxWidth: 1180 }}
            >
                <OffcanvasHeader toggle={() => setCreateDrawerOpen(false)}>
                    <div>
                        <h5 className="mb-0">Nueva cotización</h5>
                        <small className="text-muted">Cotización válida hasta vencimiento</small>
                    </div>
                </OffcanvasHeader>
                <OffcanvasBody className="px-4 py-3">
                    {createDrawerOpen && (
                        <CotizacionTab
                            config={{
                                title: 'Cotización',
                                subtitle: 'Propuesta comercial antes de facturar',
                                icon: 'ri-file-paper-line',
                                color: '#0AB39C',
                                numberLabel: 'Cotización No.',
                            } as DocumentConfig}
                        />
                    )}
                </OffcanvasBody>
            </Offcanvas>

            {/* Detalle (derecha) con botón Convertir */}
            <Offcanvas
                isOpen={!!detailQuote}
                toggle={() => setDetailQuote(null)}
                direction="end"
                style={{ width: 'min(560px, 95vw)' }}
            >
                <OffcanvasHeader toggle={() => setDetailQuote(null)}>
                    <div className="d-flex align-items-center gap-2">
                        <i className="ri-file-paper-line text-info" style={{ fontSize: 22 }} />
                        <span>Cotización {detailQuote?.quote_number || ''}</span>
                        {detailQuote && statusBadge(detailQuote.status)}
                    </div>
                </OffcanvasHeader>
                <OffcanvasBody>
                    {detailQuote && (
                        <>
                            <div className="d-flex gap-2 mb-3 flex-wrap">
                                <Button color="light" onClick={() => setDetailQuote(null)} className="d-inline-flex align-items-center gap-1">
                                    <ArrowLeft size={16} /> Volver
                                </Button>
                                {detailQuote.status !== 'CONVERTIDA' && (
                                    <Button color="success" onClick={() => handleConvert(detailQuote.id)} className="d-inline-flex align-items-center gap-1">
                                        <Repeat size={16} /> Convertir en factura
                                    </Button>
                                )}
                            </div>

                            <Row className="g-3 mb-3">
                                <Col md={6}>
                                    <Label className="text-muted small mb-0">Cliente</Label>
                                    <p className="fw-medium mb-0">{detailQuote.client_name || '—'}</p>
                                </Col>
                                <Col md={6}>
                                    <Label className="text-muted small mb-0">Total</Label>
                                    <p className="fw-bold fs-5 text-primary mb-0" style={{ fontFamily: 'monospace' }}>{fmt(detailQuote.total)}</p>
                                </Col>
                                <Col md={6}>
                                    <Label className="text-muted small mb-0">Fecha</Label>
                                    <p className="mb-0">{detailQuote.date ? new Date(detailQuote.date).toLocaleDateString('es-CO') : '—'}</p>
                                </Col>
                                <Col md={6}>
                                    <Label className="text-muted small mb-0">Válido hasta</Label>
                                    <p className="mb-0">{detailQuote.valid_until ? new Date(detailQuote.valid_until).toLocaleDateString('es-CO') : '—'}</p>
                                </Col>
                            </Row>

                            {detailQuote.items && detailQuote.items[0]?.id && (
                                <div className="table-responsive">
                                    <Table size="sm" className="align-middle mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Producto</th>
                                                <th className="text-end">Cant.</th>
                                                <th className="text-end">V. unit.</th>
                                                <th className="text-end">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailQuote.items.map((item: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td>{item.product_name || item.description}</td>
                                                    <td className="text-end">{item.quantity}</td>
                                                    <td className="text-end" style={{ fontFamily: 'monospace' }}>{fmt(item.unit_price)}</td>
                                                    <td className="text-end" style={{ fontFamily: 'monospace' }}>{fmt(item.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            )}
                        </>
                    )}
                </OffcanvasBody>
            </Offcanvas>
        </Container>
    );
};

export default CotizacionesPage;
