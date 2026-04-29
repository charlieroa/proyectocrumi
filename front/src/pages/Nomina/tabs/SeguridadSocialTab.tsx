import React, { useEffect, useState, useCallback } from 'react';
import {
    Card, CardBody, CardHeader, Col, Row, Table, Badge, Button,
    Input, FormGroup, Label, Spinner, Alert
} from 'reactstrap';
import { api } from '../../../services/api';

// ---- Interfaces ----

interface PeriodoSS {
    id: number;
    year: number;
    month: number;
    period_type: string;
    status: string;
}

interface PilaSummary {
    total_salud: number;
    total_pension: number;
    total_arl: number;
    total_parafiscales: number;
    total_ccf: number;
    total_sena: number;
    total_icbf: number;
}

interface PilaDetalle {
    employee_id: number;
    employee_name: string;
    document_number: string;
    ibc: number;
    salud_empleado: number;
    salud_empresa: number;
    pension_empleado: number;
    pension_empresa: number;
    arl: number;
    ccf: number;
    sena: number;
    icbf: number;
    total_empleado: number;
    total_empresa: number;
    total: number;
}

const fmtCOP = (n: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n);

interface Props {
    year: number;
    month: number;
}

const SeguridadSocialTab: React.FC<Props> = ({ year, month }) => {
    const [periodos, setPeriodos] = useState<PeriodoSS[]>([]);
    const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // PILA data
    const [pilaSummary, setPilaSummary] = useState<PilaSummary | null>(null);
    const [pilaDetalle, setPilaDetalle] = useState<PilaDetalle[]>([]);
    const [pilaLoading, setPilaLoading] = useState(false);
    const [generatingPila, setGeneratingPila] = useState(false);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
    const showError = (msg: string) => { setError(msg); setTimeout(() => setError(''), 4000); };

    const fetchPeriodos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/nomina/periodos', { params: { year, month } });
            if (res.data.success) {
                const list = res.data.periodos || [];
                setPeriodos(list);
                if (list.length > 0 && !selectedPeriodoId) {
                    setSelectedPeriodoId(list[0].id);
                }
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al cargar periodos');
        }
        setLoading(false);
    }, [year, month]);

    useEffect(() => {
        fetchPeriodos();
    }, [fetchPeriodos]);

    useEffect(() => {
        if (selectedPeriodoId) {
            fetchPilaPreview(Number(selectedPeriodoId));
        }
    }, [selectedPeriodoId]);

    const fetchPilaPreview = async (periodoId: number) => {
        setPilaLoading(true);
        try {
            const res = await api.get(`/nomina/periodos/${periodoId}/pila-preview`);
            if (res.data.success) {
                setPilaSummary(res.data.summary || null);
                setPilaDetalle(res.data.detalle || []);
            }
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al calcular PILA');
            setPilaSummary(null);
            setPilaDetalle([]);
        }
        setPilaLoading(false);
    };

    const handleGenerarPila = async () => {
        if (!selectedPeriodoId) return;
        setGeneratingPila(true);
        try {
            const res = await api.post(`/nomina/periodos/${selectedPeriodoId}/generar-pila`, {}, {
                responseType: 'blob'
            });
            // Download the file
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `PILA_${year}_${month}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            showSuccess('Archivo plano PILA generado correctamente');
        } catch (e: any) {
            showError(e?.response?.data?.error || 'Error al generar archivo PILA');
        }
        setGeneratingPila(false);
    };

    return (
        <div>
            {success && <Alert color="success" className="mb-3">{success}</Alert>}
            {error && <Alert color="danger" className="mb-3">{error}</Alert>}

            <Card>
                <CardHeader className="d-flex justify-content-between align-items-center">
                    <h6 className="card-title mb-0">
                        <i className="ri-shield-check-line me-1"></i>
                        Seguridad Social - PILA
                    </h6>
                    <div className="d-flex gap-2 align-items-center">
                        <Input type="select" bsSize="sm" value={selectedPeriodoId}
                            onChange={e => setSelectedPeriodoId(e.target.value)}
                            style={{ width: 250 }}>
                            <option value="">-- Seleccione Periodo --</option>
                            {periodos.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.period_type === 'quincenal' ? 'Quincena' : 'Mensual'} {p.month}/{p.year} - {p.status}
                                </option>
                            ))}
                        </Input>
                        <Button color="warning" size="sm" onClick={() => selectedPeriodoId && fetchPilaPreview(Number(selectedPeriodoId))}
                            disabled={!selectedPeriodoId || pilaLoading}>
                            {pilaLoading ? <Spinner size="sm" /> : <i className="ri-calculator-line me-1"></i>}
                            Calcular PILA
                        </Button>
                        <Button color="primary" size="sm" onClick={handleGenerarPila}
                            disabled={!selectedPeriodoId || generatingPila || !pilaDetalle.length}>
                            {generatingPila ? <Spinner size="sm" /> : <i className="ri-file-download-line me-1"></i>}
                            Generar Archivo Plano
                        </Button>
                    </div>
                </CardHeader>
                <CardBody>
                    {loading ? (
                        <div className="text-center py-4"><Spinner color="primary" /></div>
                    ) : !selectedPeriodoId ? (
                        <div className="text-center py-4 text-muted">
                            <i className="ri-shield-check-line fs-36 d-block mb-2"></i>
                            <p>Seleccione un periodo para calcular la PILA</p>
                        </div>
                    ) : pilaLoading ? (
                        <div className="text-center py-4"><Spinner color="primary" /><p className="mt-2 text-muted">Calculando PILA...</p></div>
                    ) : (
                        <>
                            {/* Summary cards */}
                            {pilaSummary && (
                                <Row className="mb-3">
                                    <Col md={3}>
                                        <Card className="border bg-danger-subtle">
                                            <CardBody className="py-2 text-center">
                                                <p className="text-muted fs-12 mb-1">Total Salud</p>
                                                <h6 className="text-danger mb-0">{fmtCOP(pilaSummary.total_salud)}</h6>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                    <Col md={3}>
                                        <Card className="border bg-primary-subtle">
                                            <CardBody className="py-2 text-center">
                                                <p className="text-muted fs-12 mb-1">Total Pension</p>
                                                <h6 className="text-primary mb-0">{fmtCOP(pilaSummary.total_pension)}</h6>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                    <Col md={3}>
                                        <Card className="border bg-warning-subtle">
                                            <CardBody className="py-2 text-center">
                                                <p className="text-muted fs-12 mb-1">Total ARL</p>
                                                <h6 className="text-warning mb-0">{fmtCOP(pilaSummary.total_arl)}</h6>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                    <Col md={3}>
                                        <Card className="border bg-info-subtle">
                                            <CardBody className="py-2 text-center">
                                                <p className="text-muted fs-12 mb-1">Total Parafiscales</p>
                                                <h6 className="text-info mb-0">{fmtCOP(pilaSummary.total_parafiscales)}</h6>
                                                <small className="text-muted fs-11">
                                                    CCF: {fmtCOP(pilaSummary.total_ccf)} | SENA: {fmtCOP(pilaSummary.total_sena)} | ICBF: {fmtCOP(pilaSummary.total_icbf)}
                                                </small>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                </Row>
                            )}

                            {/* Detailed table */}
                            {pilaDetalle.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <i className="ri-calculator-line fs-36 d-block mb-2"></i>
                                    <p>Sin datos de seguridad social. Ejecute el cálculo de PILA.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <Table className="table-hover table-nowrap align-middle mb-0" size="sm">
                                        <thead>
                                            <tr>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold">Empleado</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">IBC</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">Salud Emp.</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">Salud Empr.</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">Pension Emp.</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">Pension Empr.</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">ARL</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">CCF</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">SENA</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">ICBF</th>
                                                <th className="text-uppercase text-muted fs-11 fw-semibold text-end">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pilaDetalle.map((row) => (
                                                <tr key={row.employee_id}>
                                                    <td className="fw-medium">
                                                        <span className="d-block">{row.employee_name}</span>
                                                        <Badge color="primary-subtle" className="text-primary font-monospace fs-10">
                                                            {row.document_number}
                                                        </Badge>
                                                    </td>
                                                    <td className="text-end font-monospace fs-12">{fmtCOP(row.ibc)}</td>
                                                    <td className="text-end font-monospace fs-12 text-danger">{fmtCOP(row.salud_empleado)}</td>
                                                    <td className="text-end font-monospace fs-12 text-danger">{fmtCOP(row.salud_empresa)}</td>
                                                    <td className="text-end font-monospace fs-12 text-primary">{fmtCOP(row.pension_empleado)}</td>
                                                    <td className="text-end font-monospace fs-12 text-primary">{fmtCOP(row.pension_empresa)}</td>
                                                    <td className="text-end font-monospace fs-12 text-warning">{fmtCOP(row.arl)}</td>
                                                    <td className="text-end font-monospace fs-12">{fmtCOP(row.ccf)}</td>
                                                    <td className="text-end font-monospace fs-12">{fmtCOP(row.sena)}</td>
                                                    <td className="text-end font-monospace fs-12">{fmtCOP(row.icbf)}</td>
                                                    <td className="text-end font-monospace fs-12 fw-semibold">{fmtCOP(row.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="table-light fw-semibold">
                                                <td>TOTALES ({pilaDetalle.length} empleados)</td>
                                                <td className="text-end font-monospace">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.ibc || 0), 0))}
                                                </td>
                                                <td className="text-end font-monospace text-danger">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.salud_empleado || 0), 0))}
                                                </td>
                                                <td className="text-end font-monospace text-danger">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.salud_empresa || 0), 0))}
                                                </td>
                                                <td className="text-end font-monospace text-primary">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.pension_empleado || 0), 0))}
                                                </td>
                                                <td className="text-end font-monospace text-primary">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.pension_empresa || 0), 0))}
                                                </td>
                                                <td className="text-end font-monospace text-warning">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.arl || 0), 0))}
                                                </td>
                                                <td className="text-end font-monospace">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.ccf || 0), 0))}
                                                </td>
                                                <td className="text-end font-monospace">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.sena || 0), 0))}
                                                </td>
                                                <td className="text-end font-monospace">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.icbf || 0), 0))}
                                                </td>
                                                <td className="text-end font-monospace fw-bold">
                                                    {fmtCOP(pilaDetalle.reduce((s, r) => s + (r.total || 0), 0))}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </Table>
                                </div>
                            )}
                        </>
                    )}
                </CardBody>
            </Card>
        </div>
    );
};

export default SeguridadSocialTab;
