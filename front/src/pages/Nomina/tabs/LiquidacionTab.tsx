import React, { useEffect, useState, useCallback } from 'react';
import {
    Card, CardBody, CardHeader, Col, Row, Table, Badge, Button,
    Input, FormGroup, Label,
    Spinner, Alert, Collapse
} from 'reactstrap';
import CrumiModal from '../../../Components/Common/CrumiModal';
import { api } from '../../../services/api';

// ---- Interfaces ----

interface Periodo {
    id: number;
    year: number;
    month: number;
    period_type: string;
    period_number: number;
    start_date: string;
    end_date: string;
    status: string;
    employee_count: number;
    total_devengado: number;
    total_deducciones: number;
    total_neto: number;
    total_costo_empresa: number;
    created_at: string;
}

interface LiquidacionDetalle {
    id: number;
    employee_id: number;
    employee_name: string;
    document_number: string;
    base_salary: number;
    total_devengado: number;
    total_deducciones: number;
    neto_pagar: number;
    costo_empresa: number;
    conceptos?: ConceptoDetalle[];
}

interface ConceptoDetalle {
    id: number;
    concept_code: string;
    concept_name: string;
    concept_type: string;
    quantity: number;
    base_amount: number;
    rate: number;
    amount: number;
}

const fmtCOP = (n: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n);

const statusColors: Record<string, string> = {
    borrador: 'secondary',
    preliquidado: 'warning',
    aprobado: 'success',
    pagado: 'primary',
    transmitido: 'info',
};

const statusLabels: Record<string, string> = {
    borrador: 'Borrador',
    preliquidado: 'Pre-liquidado',
    aprobado: 'Aprobado',
    pagado: 'Pagado',
    transmitido: 'Transmitido',
};

interface Props {
    year: number;
    month: number;
}

const LiquidacionTab: React.FC<Props> = ({ year, month }) => {
    const [periodos, setPeriodos] = useState<Periodo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Create period modal
    const [createModal, setCreateModal] = useState(false);
    const [newPeriodType, setNewPeriodType] = useState('mensual');
    const [newPeriodNumber, setNewPeriodNumber] = useState(1);
    const [creating, setCreating] = useState(false);

    // Liquidation detail
    const [selectedPeriodo, setSelectedPeriodo] = useState<Periodo | null>(null);
    const [liquidaciones, setLiquidaciones] = useState<LiquidacionDetalle[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    // Actions loading
    const [actionLoading, setActionLoading] = useState(false);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
    const showError = (msg: string) => { setError(msg); setTimeout(() => setError(''), 4000); };

    const fetchPeriodos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/nomina/periodos', { params: { year, month } });
            if (res.data.success) {
                setPeriodos(res.data.periodos || []);
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al cargar periodos');
        }
        setLoading(false);
    }, [year, month]);

    useEffect(() => {
        fetchPeriodos();
    }, [fetchPeriodos]);

    const handleCreatePeriodo = async () => {
        setCreating(true);
        try {
            const res = await api.post('/nomina/periodos', {
                year,
                month,
                period_type: newPeriodType,
                period_number: newPeriodNumber,
            });
            if (res.data.success) {
                showSuccess('Periodo creado correctamente');
                setCreateModal(false);
                fetchPeriodos();
            } else {
                showError(res.data.error || 'Error al crear periodo');
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al crear periodo');
        }
        setCreating(false);
    };

    const fetchLiquidaciones = async (periodo: Periodo) => {
        setSelectedPeriodo(periodo);
        setDetailLoading(true);
        setExpandedRow(null);
        try {
            const res = await api.get(`/nomina/periodos/${periodo.id}/liquidaciones`);
            if (res.data.success) {
                setLiquidaciones(res.data.liquidaciones || []);
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al cargar liquidaciones');
        }
        setDetailLoading(false);
    };

    const handlePreLiquidar = async () => {
        if (!selectedPeriodo) return;
        setActionLoading(true);
        try {
            const res = await api.post(`/nomina/periodos/${selectedPeriodo.id}/liquidar`);
            if (res.data.success) {
                showSuccess('Pre-liquidación ejecutada correctamente');
                fetchPeriodos();
                fetchLiquidaciones(selectedPeriodo);
            } else {
                showError(res.data.error || 'Error en pre-liquidación');
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error en pre-liquidación');
        }
        setActionLoading(false);
    };

    const handleAprobar = async () => {
        if (!selectedPeriodo) return;
        if (!window.confirm('¿Está seguro de aprobar este período de nómina? Esta acción no se puede deshacer.')) return;
        setActionLoading(true);
        try {
            const res = await api.put(`/nomina/periodos/${selectedPeriodo.id}/aprobar`);
            if (res.data.success) {
                showSuccess('Periodo aprobado correctamente');
                fetchPeriodos();
                setSelectedPeriodo({ ...selectedPeriodo, status: 'aprobado' });
            } else {
                showError(res.data.error || 'Error al aprobar');
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al aprobar');
        }
        setActionLoading(false);
    };

    const goBackToList = () => {
        setSelectedPeriodo(null);
        setLiquidaciones([]);
    };

    // Detail view
    if (selectedPeriodo) {
        return (
            <div>
                {success && <Alert color="success" className="mb-3">{success}</Alert>}
                {error && <Alert color="danger" className="mb-3">{error}</Alert>}

                <Card>
                    <CardHeader className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2">
                            <Button color="light" size="sm" onClick={goBackToList}>
                                <i className="ri-arrow-left-line me-1"></i>Volver
                            </Button>
                            <h6 className="card-title mb-0">
                                Liquidación - {selectedPeriodo.period_type === 'quincenal' ? 'Quincena' : 'Mensual'}{' '}
                                {selectedPeriodo.month}/{selectedPeriodo.year}
                                {selectedPeriodo.period_type === 'quincenal' && ` (#${selectedPeriodo.period_number})`}
                            </h6>
                            <Badge color={statusColors[selectedPeriodo.status] || 'secondary'}>
                                {statusLabels[selectedPeriodo.status] || selectedPeriodo.status}
                            </Badge>
                        </div>
                        <div className="d-flex gap-2">
                            {(selectedPeriodo.status === 'borrador' || selectedPeriodo.status === 'preliquidado') && (
                                <Button color="warning" size="sm" onClick={handlePreLiquidar} disabled={actionLoading}>
                                    {actionLoading ? <Spinner size="sm" className="me-1" /> : <i className="ri-calculator-line me-1"></i>}
                                    Pre-liquidar
                                </Button>
                            )}
                            {selectedPeriodo.status === 'preliquidado' && (
                                <Button color="success" size="sm" onClick={handleAprobar} disabled={actionLoading}>
                                    {actionLoading ? <Spinner size="sm" className="me-1" /> : <i className="ri-check-double-line me-1"></i>}
                                    Aprobar
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardBody>
                        {/* Summary cards */}
                        <Row className="mb-3">
                            <Col md={3}>
                                <Card className="border bg-success-subtle">
                                    <CardBody className="py-2 text-center">
                                        <p className="text-muted fs-12 mb-1">Total Devengado</p>
                                        <h6 className="text-success mb-0">
                                            {fmtCOP(liquidaciones.reduce((s, l) => s + (l.total_devengado || 0), 0))}
                                        </h6>
                                    </CardBody>
                                </Card>
                            </Col>
                            <Col md={3}>
                                <Card className="border bg-danger-subtle">
                                    <CardBody className="py-2 text-center">
                                        <p className="text-muted fs-12 mb-1">Total Deducciones</p>
                                        <h6 className="text-danger mb-0">
                                            {fmtCOP(liquidaciones.reduce((s, l) => s + (l.total_deducciones || 0), 0))}
                                        </h6>
                                    </CardBody>
                                </Card>
                            </Col>
                            <Col md={3}>
                                <Card className="border bg-primary-subtle">
                                    <CardBody className="py-2 text-center">
                                        <p className="text-muted fs-12 mb-1">Neto a Pagar</p>
                                        <h6 className="text-primary mb-0">
                                            {fmtCOP(liquidaciones.reduce((s, l) => s + (l.neto_pagar || 0), 0))}
                                        </h6>
                                    </CardBody>
                                </Card>
                            </Col>
                            <Col md={3}>
                                <Card className="border bg-info-subtle">
                                    <CardBody className="py-2 text-center">
                                        <p className="text-muted fs-12 mb-1">Costo Empresa</p>
                                        <h6 className="text-info mb-0">
                                            {fmtCOP(liquidaciones.reduce((s, l) => s + (l.costo_empresa || 0), 0))}
                                        </h6>
                                    </CardBody>
                                </Card>
                            </Col>
                        </Row>

                        {detailLoading ? (
                            <div className="text-center py-4"><Spinner color="primary" /></div>
                        ) : liquidaciones.length === 0 ? (
                            <div className="text-center py-4 text-muted">
                                <i className="ri-calculator-line fs-36 d-block mb-2"></i>
                                <p>No hay liquidaciones. Ejecute la pre-liquidación para calcular.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <Table className="table-hover table-nowrap align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold" style={{ width: 30 }}></th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold">Empleado</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold">Documento</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Devengado</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Deducciones</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Neto</th>
                                            <th className="text-uppercase text-muted fs-12 fw-semibold text-end">Costo Empresa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {liquidaciones.map((liq) => (
                                            <React.Fragment key={liq.id}>
                                                <tr
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => setExpandedRow(expandedRow === liq.id ? null : liq.id)}
                                                >
                                                    <td>
                                                        <i className={`ri-arrow-${expandedRow === liq.id ? 'down' : 'right'}-s-line text-muted`}></i>
                                                    </td>
                                                    <td className="fw-medium">{liq.employee_name}</td>
                                                    <td>
                                                        <Badge color="primary-subtle" className="text-primary font-monospace">
                                                            {liq.document_number}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-end font-monospace text-success">{fmtCOP(liq.total_devengado)}</td>
                                                    <td className="text-end font-monospace text-danger">{fmtCOP(liq.total_deducciones)}</td>
                                                    <td className="text-end font-monospace fw-semibold">{fmtCOP(liq.neto_pagar)}</td>
                                                    <td className="text-end font-monospace text-info">{fmtCOP(liq.costo_empresa)}</td>
                                                </tr>
                                                {expandedRow === liq.id && liq.conceptos && (
                                                    <tr>
                                                        <td colSpan={7} className="p-0">
                                                            <Card className="mb-0 border-0 bg-light">
                                                                <CardBody className="py-2 px-3">
                                                                    <Row>
                                                                        <Col md={6}>
                                                                            <h6 className="fs-12 text-success mb-2">
                                                                                <i className="ri-add-circle-line me-1"></i>Devengados
                                                                            </h6>
                                                                            <Table size="sm" className="mb-2">
                                                                                <tbody>
                                                                                    {liq.conceptos
                                                                                        .filter(c => c.concept_type === 'devengado')
                                                                                        .map((c, idx) => (
                                                                                            <tr key={idx}>
                                                                                                <td className="fs-12">{c.concept_name}</td>
                                                                                                <td className="text-end font-monospace fs-12">{fmtCOP(c.amount)}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                </tbody>
                                                                            </Table>
                                                                        </Col>
                                                                        <Col md={6}>
                                                                            <h6 className="fs-12 text-danger mb-2">
                                                                                <i className="ri-indeterminate-circle-line me-1"></i>Deducciones
                                                                            </h6>
                                                                            <Table size="sm" className="mb-2">
                                                                                <tbody>
                                                                                    {liq.conceptos
                                                                                        .filter(c => c.concept_type === 'deduccion')
                                                                                        .map((c, idx) => (
                                                                                            <tr key={idx}>
                                                                                                <td className="fs-12">{c.concept_name}</td>
                                                                                                <td className="text-end font-monospace fs-12">{fmtCOP(c.amount)}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                </tbody>
                                                                            </Table>
                                                                        </Col>
                                                                    </Row>
                                                                </CardBody>
                                                            </Card>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="table-light fw-semibold">
                                            <td colSpan={3} className="text-end">TOTALES</td>
                                            <td className="text-end font-monospace text-success">
                                                {fmtCOP(liquidaciones.reduce((s, l) => s + (l.total_devengado || 0), 0))}
                                            </td>
                                            <td className="text-end font-monospace text-danger">
                                                {fmtCOP(liquidaciones.reduce((s, l) => s + (l.total_deducciones || 0), 0))}
                                            </td>
                                            <td className="text-end font-monospace fw-bold">
                                                {fmtCOP(liquidaciones.reduce((s, l) => s + (l.neto_pagar || 0), 0))}
                                            </td>
                                            <td className="text-end font-monospace text-info">
                                                {fmtCOP(liquidaciones.reduce((s, l) => s + (l.costo_empresa || 0), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </Table>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        );
    }

    // List view
    return (
        <div>
            {success && <Alert color="success" className="mb-3">{success}</Alert>}
            {error && <Alert color="danger" className="mb-3">{error}</Alert>}

            <Card>
                <CardHeader className="d-flex justify-content-between align-items-center">
                    <h6 className="card-title mb-0">
                        <i className="ri-calculator-line me-1"></i>
                        Periodos de Liquidación - {month}/{year}
                    </h6>
                    <Button color="primary" size="sm" onClick={() => setCreateModal(true)}>
                        <i className="ri-add-line me-1"></i>Crear Periodo
                    </Button>
                </CardHeader>
                <CardBody>
                    {loading ? (
                        <div className="text-center py-4"><Spinner color="primary" /></div>
                    ) : periodos.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                            <i className="ri-calendar-line fs-36 d-block mb-2"></i>
                            <p>No hay períodos de nómina para este mes</p>
                            <Button color="primary" size="sm" onClick={() => setCreateModal(true)}>
                                Crear primer periodo
                            </Button>
                        </div>
                    ) : (
                        <Row>
                            {periodos.map(periodo => (
                                <Col md={6} xl={4} key={periodo.id}>
                                    <Card
                                        className="border card-animate"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => fetchLiquidaciones(periodo)}
                                    >
                                        <CardBody>
                                            <div className="d-flex justify-content-between align-items-start mb-3">
                                                <div>
                                                    <h6 className="mb-1">
                                                        {periodo.period_type === 'quincenal' ? 'Quincena' : 'Mensual'}{' '}
                                                        {periodo.period_type === 'quincenal' && `#${periodo.period_number}`}
                                                    </h6>
                                                    <p className="text-muted fs-12 mb-0">
                                                        {periodo.start_date ? new Date(periodo.start_date).toLocaleDateString('es-CO') : ''} -{' '}
                                                        {periodo.end_date ? new Date(periodo.end_date).toLocaleDateString('es-CO') : ''}
                                                    </p>
                                                </div>
                                                <Badge color={statusColors[periodo.status] || 'secondary'}>
                                                    {statusLabels[periodo.status] || periodo.status}
                                                </Badge>
                                            </div>
                                            <Row className="text-center">
                                                <Col>
                                                    <p className="text-muted fs-11 mb-0">Empleados</p>
                                                    <h6 className="mb-0">{periodo.employee_count || 0}</h6>
                                                </Col>
                                                <Col>
                                                    <p className="text-muted fs-11 mb-0">Neto</p>
                                                    <h6 className="mb-0 text-primary fs-12">{fmtCOP(periodo.total_neto || 0)}</h6>
                                                </Col>
                                                <Col>
                                                    <p className="text-muted fs-11 mb-0">Costo Emp.</p>
                                                    <h6 className="mb-0 text-info fs-12">{fmtCOP(periodo.total_costo_empresa || 0)}</h6>
                                                </Col>
                                            </Row>
                                        </CardBody>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}
                </CardBody>
            </Card>

            {/* Modal Crear Periodo */}
            <CrumiModal
                isOpen={createModal}
                toggle={() => setCreateModal(false)}
                title="Crear Período de Nómina"
                subtitle="Configura el tipo y rango del periodo"
                onSubmit={handleCreatePeriodo}
                submitText="Crear Periodo"
                isSubmitting={creating}
            >
                <Row>
                    <Col md={6}>
                        <FormGroup>
                            <Label className="fw-semibold fs-12">Anio</Label>
                            <Input bsSize="sm" value={year} disabled />
                        </FormGroup>
                    </Col>
                    <Col md={6}>
                        <FormGroup>
                            <Label className="fw-semibold fs-12">Mes</Label>
                            <Input bsSize="sm" value={month} disabled />
                        </FormGroup>
                    </Col>
                </Row>
                <Row>
                    <Col md={6}>
                        <FormGroup>
                            <Label className="fw-semibold fs-12">Tipo de Periodo</Label>
                            <Input type="select" bsSize="sm" value={newPeriodType}
                                onChange={e => setNewPeriodType(e.target.value)}>
                                <option value="mensual">Mensual</option>
                                <option value="quincenal">Quincenal</option>
                            </Input>
                        </FormGroup>
                    </Col>
                    {newPeriodType === 'quincenal' && (
                        <Col md={6}>
                            <FormGroup>
                                <Label className="fw-semibold fs-12">Número de Quincena</Label>
                                <Input type="select" bsSize="sm" value={newPeriodNumber}
                                    onChange={e => setNewPeriodNumber(Number(e.target.value))}>
                                    <option value={1}>Primera Quincena (1-15)</option>
                                    <option value={2}>Segunda Quincena (16-30)</option>
                                </Input>
                            </FormGroup>
                        </Col>
                    )}
                </Row>
            </CrumiModal>
        </div>
    );
};

export default LiquidacionTab;
