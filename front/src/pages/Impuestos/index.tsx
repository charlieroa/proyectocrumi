import React, { useEffect, useState, useCallback } from 'react';
import {
    Container, Row, Col,
    Card, CardBody, CardHeader, Table, Badge, Input, Button,
    Spinner, Form, FormGroup, Label
} from 'reactstrap';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { env } from '../../env';
import { buildImpuestosSidebarSections } from './config/impuestosSidebar';

const API_BASE = env.API_URL;

const ImpuestosPage: React.FC = () => {
    document.title = 'Impuestos y Cierres | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);

    // Date range
    const now = new Date();
    const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

    // Tax summary
    const [taxSummary, setTaxSummary] = useState<any>({
        vatGenerated: 0, vatDeductible: 0, vatPayable: 0,
        withholdingSource: 0, withholdingIca: 0, withholdingVat: 0, totalWithholdings: 0
    });
    const [summaryLoading, setSummaryLoading] = useState(false);

    // Tax configurations
    const [taxConfigs, setTaxConfigs] = useState<any[]>([]);
    const [configsLoading, setConfigsLoading] = useState(false);
    const [newConfig, setNewConfig] = useState<any>({
        taxType: 'IVA', name: '', rate: '', threshold: '',
        accountCodeDebit: '', accountCodeCredit: '', description: ''
    });

    // Tax calendar
    const [taxCalendar, setTaxCalendar] = useState<any[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarYear, setCalendarYear] = useState(String(now.getFullYear()));
    const [newEvent, setNewEvent] = useState<any>({
        taxType: 'IVA', periodLabel: '', dueDate: '', description: '', notes: ''
    });

    // Fiscal closings
    const [fiscalClosings, setFiscalClosings] = useState<any[]>([]);
    const [closingsLoading, setClosingsLoading] = useState(false);
    const [closingYear, setClosingYear] = useState(String(now.getFullYear()));

    const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

    // --- Fetch functions ---
    const fetchTaxSummary = useCallback(async () => {
        setSummaryLoading(true);
        try {
            const res = await fetch(`${API_BASE}/taxes/summary?startDate=${startDate}&endDate=${endDate}`, { headers });
            const data = await res.json();
            if (data.success) setTaxSummary(data.summary);
        } catch (e) { console.error('Tax summary error:', e); }
        finally { setSummaryLoading(false); }
    }, [startDate, endDate]);

    const fetchTaxConfigurations = useCallback(async () => {
        setConfigsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/taxes/configurations`, { headers });
            const data = await res.json();
            if (data.success) setTaxConfigs(data.configurations);
        } catch (e) { console.error('Tax configs error:', e); }
        finally { setConfigsLoading(false); }
    }, []);

    const createTaxConfiguration = async () => {
        try {
            const res = await fetch(`${API_BASE}/taxes/configurations`, {
                method: 'POST', headers, body: JSON.stringify(newConfig)
            });
            const data = await res.json();
            if (data.success) {
                setNewConfig({ taxType: 'IVA', name: '', rate: '', threshold: '', accountCodeDebit: '', accountCodeCredit: '', description: '' });
                fetchTaxConfigurations();
            }
        } catch (e) { console.error('Create config error:', e); }
    };

    const deleteTaxConfig = async (id: number) => {
        if (!window.confirm('Eliminar esta configuracion?')) return;
        try {
            await fetch(`${API_BASE}/taxes/configurations/${id}`, { method: 'DELETE', headers });
            fetchTaxConfigurations();
        } catch (e) { console.error('Delete config error:', e); }
    };

    const fetchTaxCalendar = useCallback(async () => {
        setCalendarLoading(true);
        try {
            const res = await fetch(`${API_BASE}/taxes/calendar?year=${calendarYear}`, { headers });
            const data = await res.json();
            if (data.success) setTaxCalendar(data.events);
        } catch (e) { console.error('Tax calendar error:', e); }
        finally { setCalendarLoading(false); }
    }, [calendarYear]);

    const createCalendarEvent = async () => {
        try {
            const res = await fetch(`${API_BASE}/taxes/calendar`, {
                method: 'POST', headers, body: JSON.stringify(newEvent)
            });
            const data = await res.json();
            if (data.success) {
                setNewEvent({ taxType: 'IVA', periodLabel: '', dueDate: '', description: '', notes: '' });
                fetchTaxCalendar();
            }
        } catch (e) { console.error('Create event error:', e); }
    };

    const seedDianCalendar = async () => {
        if (!window.confirm('Se cargaran las obligaciones tributarias DIAN 2026 segun el ultimo digito del NIT del tenant. Obligaciones ya existentes se omitiran. Continuar?')) return;
        try {
            const res = await fetch(`${API_BASE}/taxes/calendar/seed-dian?year=2026`, { method: 'POST', headers });
            const data = await res.json();
            if (data.success) {
                alert(`Calendario DIAN 2026 cargado.\nNIT: ${data.nit} (digito ${data.lastDigit})\nInsertadas: ${data.inserted}\nOmitidas (ya existian): ${data.skipped}`);
                setCalendarYear('2026');
                fetchTaxCalendar();
            } else {
                alert('Error: ' + (data.error || 'Error desconocido'));
            }
        } catch (e) {
            console.error('Seed DIAN error:', e);
            alert('Error al cargar el calendario DIAN');
        }
    };

    const markEventFiled = async (id: number) => {
        try {
            const res = await fetch(`${API_BASE}/taxes/calendar/${id}/filed`, { method: 'POST', headers });
            const data = await res.json();
            if (data.success) fetchTaxCalendar();
        } catch (e) { console.error('Mark filed error:', e); }
    };

    const fetchFiscalClosings = useCallback(async () => {
        setClosingsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/taxes/fiscal-year-closings`, { headers });
            const data = await res.json();
            if (data.success) setFiscalClosings(data.closings);
        } catch (e) { console.error('Fiscal closings error:', e); }
        finally { setClosingsLoading(false); }
    }, []);

    const handleCloseFiscalYear = async () => {
        const confirmed = window.confirm(
            `ATENCION: Esta a punto de cerrar el ano fiscal ${closingYear}.\n\n` +
            `Esto creara un asiento de cierre transfiriendo la utilidad/perdida del ejercicio a Utilidades Acumuladas (3605).\n\n` +
            `Esta accion NO se puede deshacer. Desea continuar?`
        );
        if (!confirmed) return;
        try {
            const res = await fetch(`${API_BASE}/taxes/fiscal-year-close`, {
                method: 'POST', headers, body: JSON.stringify({ year: Number(closingYear) })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Ano fiscal ${closingYear} cerrado exitosamente.\nResultado neto: ${fmt(data.netResult)}\nAsiento contable #${data.journalEntryId}`);
                fetchFiscalClosings();
            } else {
                alert('Error: ' + (data.error || 'Error desconocido'));
            }
        } catch (e) { console.error('Close fiscal year error:', e); }
    };

    // --- Effects ---
    useEffect(() => {
        setLoading(true);
        Promise.all([fetchTaxSummary(), fetchTaxCalendar()]).finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchTaxSummary(); }, [startDate, endDate]);

    useEffect(() => {
        if (activeTab === 'configuracion') fetchTaxConfigurations();
        if (activeTab === 'calendario') fetchTaxCalendar();
        if (activeTab === 'cierre-fiscal') fetchFiscalClosings();
    }, [activeTab]);

    const sidebarSections = buildImpuestosSidebarSections();

    // Upcoming calendar events (next 5)
    const upcomingEvents = taxCalendar
        .filter(e => e.status === 'PENDIENTE' && new Date(e.due_date) >= new Date())
        .slice(0, 5);

    // --- Render content ---
    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <>
                        {summaryLoading ? <div className="text-center py-4"><Spinner /></div> : (
                            <>
                                <Row className="mb-3">
                                    <Col md={3}>
                                        <Card className="card-animate">
                                            <CardBody>
                                                <div className="text-uppercase text-muted fs-12 fw-medium mb-2">IVA a Pagar</div>
                                                <div className="fs-22 fw-bold">{fmt(taxSummary.vatPayable)}</div>
                                                <div className="text-muted fs-12">Generado: {fmt(taxSummary.vatGenerated)} - Descontable: {fmt(taxSummary.vatDeductible)}</div>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                    <Col md={3}>
                                        <Card className="card-animate">
                                            <CardBody>
                                                <div className="text-uppercase text-muted fs-12 fw-medium mb-2">ReteFuente</div>
                                                <div className="fs-22 fw-bold">{fmt(taxSummary.withholdingSource)}</div>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                    <Col md={3}>
                                        <Card className="card-animate">
                                            <CardBody>
                                                <div className="text-uppercase text-muted fs-12 fw-medium mb-2">ReteICA</div>
                                                <div className="fs-22 fw-bold">{fmt(taxSummary.withholdingIca)}</div>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                    <Col md={3}>
                                        <Card className="card-animate">
                                            <CardBody>
                                                <div className="text-uppercase text-muted fs-12 fw-medium mb-2">ReteIVA</div>
                                                <div className="fs-22 fw-bold">{fmt(taxSummary.withholdingVat)}</div>
                                            </CardBody>
                                        </Card>
                                    </Col>
                                </Row>

                                {upcomingEvents.length > 0 && (
                                    <Card>
                                        <CardHeader><h6 className="mb-0 fw-bold">Proximos Vencimientos</h6></CardHeader>
                                        <CardBody>
                                            <Table hover responsive size="sm">
                                                <thead>
                                                    <tr>
                                                        <th>Fecha</th>
                                                        <th>Tipo</th>
                                                        <th>Periodo</th>
                                                        <th>Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {upcomingEvents.map((ev: any) => (
                                                        <tr key={ev.id}>
                                                            <td>{new Date(ev.due_date).toLocaleDateString('es-CO')}</td>
                                                            <td><Badge color="info">{ev.tax_type}</Badge></td>
                                                            <td>{ev.period_label}</td>
                                                            <td><Badge color="warning">{ev.status}</Badge></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </CardBody>
                                    </Card>
                                )}
                            </>
                        )}
                    </>
                );

            case 'iva':
                return (
                    <Card>
                        <CardHeader><h6 className="mb-0 fw-bold">Resumen IVA</h6></CardHeader>
                        <CardBody>
                            {summaryLoading ? <div className="text-center py-4"><Spinner /></div> : (
                                <Row>
                                    <Col md={4}>
                                        <div className="border rounded p-3 text-center mb-3">
                                            <div className="text-muted fs-12 text-uppercase mb-1">IVA Generado (Ventas)</div>
                                            <div className="fs-4 fw-bold text-success">{fmt(taxSummary.vatGenerated)}</div>
                                        </div>
                                    </Col>
                                    <Col md={4}>
                                        <div className="border rounded p-3 text-center mb-3">
                                            <div className="text-muted fs-12 text-uppercase mb-1">IVA Descontable (Compras)</div>
                                            <div className="fs-4 fw-bold text-info">{fmt(taxSummary.vatDeductible)}</div>
                                        </div>
                                    </Col>
                                    <Col md={4}>
                                        <div className="border rounded p-3 text-center mb-3">
                                            <div className="text-muted fs-12 text-uppercase mb-1">IVA a Pagar</div>
                                            <div className={`fs-4 fw-bold ${taxSummary.vatPayable >= 0 ? 'text-danger' : 'text-success'}`}>
                                                {fmt(taxSummary.vatPayable)}
                                            </div>
                                            {taxSummary.vatPayable < 0 && <small className="text-muted">Saldo a favor</small>}
                                        </div>
                                    </Col>
                                </Row>
                            )}
                        </CardBody>
                    </Card>
                );

            case 'retenciones':
                return (
                    <Card>
                        <CardHeader><h6 className="mb-0 fw-bold">Retenciones</h6></CardHeader>
                        <CardBody>
                            {summaryLoading ? <div className="text-center py-4"><Spinner /></div> : (
                                <>
                                    <Row className="mb-3">
                                        <Col md={4}>
                                            <div className="border rounded p-3 text-center mb-3">
                                                <div className="text-muted fs-12 text-uppercase mb-1">Retencion en la Fuente</div>
                                                <div className="fs-4 fw-bold">{fmt(taxSummary.withholdingSource)}</div>
                                            </div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="border rounded p-3 text-center mb-3">
                                                <div className="text-muted fs-12 text-uppercase mb-1">Retencion ICA</div>
                                                <div className="fs-4 fw-bold">{fmt(taxSummary.withholdingIca)}</div>
                                            </div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="border rounded p-3 text-center mb-3">
                                                <div className="text-muted fs-12 text-uppercase mb-1">Retencion IVA</div>
                                                <div className="fs-4 fw-bold">{fmt(taxSummary.withholdingVat)}</div>
                                            </div>
                                        </Col>
                                    </Row>
                                    <div className="border rounded p-3 text-center bg-light">
                                        <div className="text-muted fs-12 text-uppercase mb-1">Total Retenciones</div>
                                        <div className="fs-3 fw-bold">{fmt(taxSummary.totalWithholdings)}</div>
                                    </div>
                                </>
                            )}
                        </CardBody>
                    </Card>
                );

            case 'configuracion':
                return (
                    <>
                        <Card className="mb-3">
                            <CardHeader><h6 className="mb-0 fw-bold">Nueva Configuracion de Impuesto</h6></CardHeader>
                            <CardBody>
                                <Row>
                                    <Col md={2}>
                                        <FormGroup>
                                            <Label className="fw-medium">Tipo</Label>
                                            <Input type="select" bsSize="sm" value={newConfig.taxType}
                                                onChange={e => setNewConfig({ ...newConfig, taxType: e.target.value })}>
                                                <option value="IVA">IVA</option>
                                                <option value="RETEFUENTE">RETEFUENTE</option>
                                                <option value="RETEICA">RETEICA</option>
                                                <option value="RETEIVA">RETEIVA</option>
                                                <option value="ICA">ICA</option>
                                            </Input>
                                        </FormGroup>
                                    </Col>
                                    <Col md={3}>
                                        <FormGroup>
                                            <Label className="fw-medium">Nombre</Label>
                                            <Input bsSize="sm" value={newConfig.name} placeholder="Ej: IVA General 19%"
                                                onChange={e => setNewConfig({ ...newConfig, name: e.target.value })} />
                                        </FormGroup>
                                    </Col>
                                    <Col md={1}>
                                        <FormGroup>
                                            <Label className="fw-medium">Tarifa %</Label>
                                            <Input bsSize="sm" type="number" step="0.01" value={newConfig.rate}
                                                onChange={e => setNewConfig({ ...newConfig, rate: e.target.value })} />
                                        </FormGroup>
                                    </Col>
                                    <Col md={2}>
                                        <FormGroup>
                                            <Label className="fw-medium">Base minima</Label>
                                            <Input bsSize="sm" type="number" value={newConfig.threshold}
                                                onChange={e => setNewConfig({ ...newConfig, threshold: e.target.value })} />
                                        </FormGroup>
                                    </Col>
                                    <Col md={2}>
                                        <FormGroup>
                                            <Label className="fw-medium">Cta Debito</Label>
                                            <Input bsSize="sm" value={newConfig.accountCodeDebit}
                                                onChange={e => setNewConfig({ ...newConfig, accountCodeDebit: e.target.value })} />
                                        </FormGroup>
                                    </Col>
                                    <Col md={2}>
                                        <FormGroup>
                                            <Label className="fw-medium">Cta Credito</Label>
                                            <Input bsSize="sm" value={newConfig.accountCodeCredit}
                                                onChange={e => setNewConfig({ ...newConfig, accountCodeCredit: e.target.value })} />
                                        </FormGroup>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={10}>
                                        <FormGroup>
                                            <Label className="fw-medium">Descripcion</Label>
                                            <Input bsSize="sm" value={newConfig.description}
                                                onChange={e => setNewConfig({ ...newConfig, description: e.target.value })} />
                                        </FormGroup>
                                    </Col>
                                    <Col md={2} className="d-flex align-items-end">
                                        <Button color="primary" size="sm" className="w-100 mb-3" onClick={createTaxConfiguration}
                                            disabled={!newConfig.name}>
                                            Agregar
                                        </Button>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader><h6 className="mb-0 fw-bold">Configuraciones de Impuestos</h6></CardHeader>
                            <CardBody>
                                {configsLoading ? <div className="text-center py-4"><Spinner /></div> : (
                                    <Table hover responsive size="sm">
                                        <thead>
                                            <tr>
                                                <th>Tipo</th>
                                                <th>Nombre</th>
                                                <th>Tarifa</th>
                                                <th>Base Minima</th>
                                                <th>Cta Debito</th>
                                                <th>Cta Credito</th>
                                                <th>Estado</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {taxConfigs.length === 0 ? (
                                                <tr><td colSpan={8} className="text-center text-muted">No hay configuraciones</td></tr>
                                            ) : taxConfigs.map((c: any) => (
                                                <tr key={c.id}>
                                                    <td><Badge color="info">{c.tax_type}</Badge></td>
                                                    <td>{c.name}</td>
                                                    <td>{Number(c.rate).toFixed(2)}%</td>
                                                    <td>{fmt(Number(c.threshold))}</td>
                                                    <td>{c.account_code_debit || '-'}</td>
                                                    <td>{c.account_code_credit || '-'}</td>
                                                    <td><Badge color={c.is_active ? 'success' : 'secondary'}>{c.is_active ? 'Activo' : 'Inactivo'}</Badge></td>
                                                    <td>
                                                        <Button color="danger" size="sm" outline onClick={() => deleteTaxConfig(c.id)}>
                                                            <i className="ri-delete-bin-line"></i>
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                )}
                            </CardBody>
                        </Card>
                    </>
                );

            case 'calendario':
                return (
                    <>
                        <Card className="mb-3">
                            <CardHeader>
                                <div className="d-flex justify-content-between align-items-center">
                                    <h6 className="mb-0 fw-bold">Nuevo Evento Fiscal</h6>
                                </div>
                            </CardHeader>
                            <CardBody>
                                <Row>
                                    <Col md={2}>
                                        <FormGroup>
                                            <Label className="fw-medium">Tipo</Label>
                                            <Input type="select" bsSize="sm" value={newEvent.taxType}
                                                onChange={e => setNewEvent({ ...newEvent, taxType: e.target.value })}>
                                                <option value="IVA">IVA</option>
                                                <option value="RETEFUENTE">RETEFUENTE</option>
                                                <option value="RETEICA">RETEICA</option>
                                                <option value="RETEIVA">RETEIVA</option>
                                                <option value="ICA">ICA</option>
                                                <option value="RENTA">RENTA</option>
                                                <option value="OTRO">OTRO</option>
                                            </Input>
                                        </FormGroup>
                                    </Col>
                                    <Col md={3}>
                                        <FormGroup>
                                            <Label className="fw-medium">Periodo</Label>
                                            <Input bsSize="sm" value={newEvent.periodLabel} placeholder="Ej: Bimestre 1 - 2026"
                                                onChange={e => setNewEvent({ ...newEvent, periodLabel: e.target.value })} />
                                        </FormGroup>
                                    </Col>
                                    <Col md={2}>
                                        <FormGroup>
                                            <Label className="fw-medium">Fecha Limite</Label>
                                            <Input bsSize="sm" type="date" value={newEvent.dueDate}
                                                onChange={e => setNewEvent({ ...newEvent, dueDate: e.target.value })} />
                                        </FormGroup>
                                    </Col>
                                    <Col md={3}>
                                        <FormGroup>
                                            <Label className="fw-medium">Descripcion</Label>
                                            <Input bsSize="sm" value={newEvent.description}
                                                onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} />
                                        </FormGroup>
                                    </Col>
                                    <Col md={2} className="d-flex align-items-end">
                                        <Button color="primary" size="sm" className="w-100 mb-3" onClick={createCalendarEvent}
                                            disabled={!newEvent.periodLabel || !newEvent.dueDate}>
                                            Agregar
                                        </Button>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="d-flex justify-content-between align-items-center">
                                    <h6 className="mb-0 fw-bold">Calendario Fiscal</h6>
                                    <div className="d-flex gap-2 align-items-center">
                                        <Label className="mb-0 me-1 fw-medium">Ano:</Label>
                                        <Input type="select" bsSize="sm" value={calendarYear} style={{ width: 100 }}
                                            onChange={e => setCalendarYear(e.target.value)}>
                                            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </Input>
                                        <Button color="primary" size="sm" onClick={fetchTaxCalendar}>Filtrar</Button>
                                        <Button color="success" size="sm" onClick={seedDianCalendar}>
                                            <i className="ri-calendar-check-line me-1"></i> Cargar calendario DIAN 2026
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardBody>
                                {calendarLoading ? <div className="text-center py-4"><Spinner /></div> : (
                                    <Table hover responsive size="sm">
                                        <thead>
                                            <tr>
                                                <th>Fecha Limite</th>
                                                <th>Tipo</th>
                                                <th>Periodo</th>
                                                <th>Descripcion</th>
                                                <th>Estado</th>
                                                <th>Presentado</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {taxCalendar.length === 0 ? (
                                                <tr><td colSpan={7} className="text-center text-muted">No hay eventos para este ano</td></tr>
                                            ) : taxCalendar.map((ev: any) => {
                                                const isPast = new Date(ev.due_date) < new Date() && ev.status === 'PENDIENTE';
                                                return (
                                                    <tr key={ev.id} className={isPast ? 'table-danger' : ''}>
                                                        <td>{new Date(ev.due_date).toLocaleDateString('es-CO')}</td>
                                                        <td><Badge color="info">{ev.tax_type}</Badge></td>
                                                        <td>{ev.period_label}</td>
                                                        <td>{ev.description || '-'}</td>
                                                        <td>
                                                            <Badge color={ev.status === 'PRESENTADO' ? 'success' : isPast ? 'danger' : 'warning'}>
                                                                {ev.status}{isPast && ' (VENCIDO)'}
                                                            </Badge>
                                                        </td>
                                                        <td>{ev.filed_at ? new Date(ev.filed_at).toLocaleDateString('es-CO') : '-'}</td>
                                                        <td>
                                                            {ev.status === 'PENDIENTE' && (
                                                                <Button color="success" size="sm" outline onClick={() => markEventFiled(ev.id)}>
                                                                    Marcar Presentado
                                                                </Button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </Table>
                                )}
                            </CardBody>
                        </Card>
                    </>
                );

            case 'cierre-fiscal':
                return (
                    <>
                        <Card className="mb-3">
                            <CardHeader><h6 className="mb-0 fw-bold">Cierre de Ano Fiscal</h6></CardHeader>
                            <CardBody>
                                <div className="alert alert-warning">
                                    <strong>Importante:</strong> El cierre fiscal calcula la utilidad o perdida del ejercicio y genera un asiento contable
                                    transfiriendo el resultado a la cuenta 3605 (Utilidades Acumuladas). Esta operacion no se puede revertir automaticamente.
                                </div>
                                <Row className="align-items-end">
                                    <Col md={3}>
                                        <FormGroup>
                                            <Label className="fw-medium">Ano a Cerrar</Label>
                                            <Input type="select" value={closingYear}
                                                onChange={e => setClosingYear(e.target.value)}>
                                                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </Input>
                                        </FormGroup>
                                    </Col>
                                    <Col md={3}>
                                        <Button color="danger" className="mb-3" onClick={handleCloseFiscalYear}>
                                            <i className="ri-lock-line me-1"></i> Ejecutar Cierre Fiscal
                                        </Button>
                                    </Col>
                                </Row>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader><h6 className="mb-0 fw-bold">Historial de Cierres</h6></CardHeader>
                            <CardBody>
                                {closingsLoading ? <div className="text-center py-4"><Spinner /></div> : (
                                    <Table hover responsive size="sm">
                                        <thead>
                                            <tr>
                                                <th>Ano</th>
                                                <th>Estado</th>
                                                <th>Fecha de Cierre</th>
                                                <th>Asiento Contable</th>
                                                <th>Notas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fiscalClosings.length === 0 ? (
                                                <tr><td colSpan={5} className="text-center text-muted">No hay cierres registrados</td></tr>
                                            ) : fiscalClosings.map((c: any) => (
                                                <tr key={c.id}>
                                                    <td className="fw-bold">{c.year}</td>
                                                    <td><Badge color={c.status === 'CERRADO' ? 'success' : 'warning'}>{c.status}</Badge></td>
                                                    <td>{c.closed_at ? new Date(c.closed_at).toLocaleDateString('es-CO') : '-'}</td>
                                                    <td>{c.retained_earnings_entry_id ? `#${c.retained_earnings_entry_id}` : '-'}</td>
                                                    <td>{c.notes || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                )}
                            </CardBody>
                        </Card>
                    </>
                );

            default:
                return <div className="text-center text-muted py-5">Seleccione una opcion del menu</div>;
        }
    };

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    {/* Header with date filters */}
                    <Row className="mb-3">
                        <Col>
                            <div className="d-flex align-items-center justify-content-between">
                                <h4 className="mb-0">Impuestos y Cierres</h4>
                                <div className="d-flex gap-2 align-items-center">
                                    <Input type="date" bsSize="sm" value={startDate}
                                        onChange={e => setStartDate(e.target.value)} style={{ width: 150 }} />
                                    <span className="text-muted">a</span>
                                    <Input type="date" bsSize="sm" value={endDate}
                                        onChange={e => setEndDate(e.target.value)} style={{ width: 150 }} />
                                </div>
                            </div>
                        </Col>
                    </Row>

                    {/* Module layout: sidebar + content */}
                    <ModuleLayout
                        sections={sidebarSections}
                        activeItem={activeTab}
                        onItemClick={setActiveTab}
                    >
                        {loading ? (
                            <div className="text-center py-5"><Spinner /></div>
                        ) : renderContent()}
                    </ModuleLayout>
                </Container>
            </div>
        </React.Fragment>
    );
};

export default ImpuestosPage;
