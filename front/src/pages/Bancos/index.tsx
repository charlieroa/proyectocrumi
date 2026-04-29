import React, { useEffect, useState, useMemo } from 'react';
import {
    Container, Row, Col,
    Card, CardBody, CardHeader, Table, Badge, Input, Button,
    Spinner, Label,
    Offcanvas, OffcanvasHeader, OffcanvasBody
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { env } from '../../env';
import { buildBancosSidebarSections } from './config/bancosSidebar';

const API_BASE = env.API_URL;

const BancosPage: React.FC = () => {
    document.title = 'Bancos y Conciliacion | Bolti';

    const [activeTab, setActiveTab] = useState('dashboard');

    // Period filter
    const now = new Date();
    const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`);
    const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

    // Banks state
    const [banks, setBanks] = useState<any[]>([]);
    const [bankTransactions, setBankTransactions] = useState<any[]>([]);
    const [bankSummary, setBankSummary] = useState<any>({ total: 0, totalMatched: 0, totalPending: 0, byStatus: {} });
    const [bankTransactionsLoading, setBankTransactionsLoading] = useState(false);
    const [bankStatus, setBankStatus] = useState('TODAS');
    const [bankSearch, setBankSearch] = useState('');
    const [selectedBankTransaction, setSelectedBankTransaction] = useState<any>(null);
    const [bankCandidates, setBankCandidates] = useState<any[]>([]);
    const [bankCandidatesLoading, setBankCandidatesLoading] = useState(false);
    const [showBankDetail, setShowBankDetail] = useState(false);
    const [bankTransactionForm, setBankTransactionForm] = useState<any>({
        bankId: '',
        transactionDate: now.toISOString().split('T')[0],
        transactionType: 'ABONO',
        description: '',
        reference: '',
        amount: '',
        runningBalance: '',
        notes: ''
    });

    const token = JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const fmt = (v: number) => Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

    // ── Fetch functions ──────────────────────────────────────────────

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_BASE}/accounting/banks`, { headers });
            const data = await res.json();
            if (data.success) setBanks(data.banks || []);
        } catch (e) { console.error(e); }
    };

    const fetchBankTransactions = async () => {
        setBankTransactionsLoading(true);
        try {
            const params = new URLSearchParams({ startDate, endDate });
            if (bankStatus && bankStatus !== 'TODAS') params.set('status', bankStatus);
            if (bankSearch) params.set('search', bankSearch);
            if (bankTransactionForm.bankId) params.set('bankId', String(bankTransactionForm.bankId));
            const res = await fetch(`${API_BASE}/accounting/bank-transactions?${params}`, { headers });
            const data = await res.json();
            if (data.success) {
                setBankTransactions(data.transactions || []);
                setBankSummary(data.summary || { total: 0, totalMatched: 0, totalPending: 0, byStatus: {} });
                if (selectedBankTransaction) {
                    const updatedSelected = (data.transactions || []).find((row: any) => row.id === selectedBankTransaction.id) || null;
                    setSelectedBankTransaction(updatedSelected);
                }
            }
        } catch (e) { console.error(e); }
        setBankTransactionsLoading(false);
    };

    const fetchBankCandidates = async (transactionId: number) => {
        setBankCandidatesLoading(true);
        try {
            const params = new URLSearchParams({ bankTransactionId: String(transactionId) });
            const res = await fetch(`${API_BASE}/accounting/bank-reconciliations/candidates?${params}`, { headers });
            const data = await res.json();
            if (data.success) {
                setSelectedBankTransaction(data.bankTransaction);
                setBankCandidates(data.candidates || []);
            } else {
                Swal.fire({ icon: 'error', title: data.error || 'No se pudieron obtener candidatos', confirmButtonColor: '#1A1D1F' });
            }
        } catch (e) { console.error(e); }
        setBankCandidatesLoading(false);
    };

    const openBankDetail = (row: any) => {
        setSelectedBankTransaction(row);
        setBankCandidates([]);
        setShowBankDetail(true);
        fetchBankCandidates(row.id);
    };

    const statusColor = (s?: string) => s === 'CONCILIADO' ? 'success' : s === 'PARCIAL' ? 'warning' : 'secondary';

    const handleCreateBankTransaction = async () => {
        try {
            const res = await fetch(`${API_BASE}/accounting/bank-transactions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    ...bankTransactionForm,
                    amount: Number(bankTransactionForm.amount || 0),
                    runningBalance: bankTransactionForm.runningBalance !== '' ? Number(bankTransactionForm.runningBalance) : null
                })
            });
            const data = await res.json();
            if (data.success) {
                setBankTransactionForm({
                    bankId: bankTransactionForm.bankId,
                    transactionDate: now.toISOString().split('T')[0],
                    transactionType: 'ABONO',
                    description: '',
                    reference: '',
                    amount: '',
                    runningBalance: '',
                    notes: ''
                });
                fetchBankTransactions();
            } else {
                Swal.fire({ icon: 'error', title: data.error || 'No se pudo crear el movimiento bancario', confirmButtonColor: '#1A1D1F' });
            }
        } catch (e) { console.error(e); }
    };

    const handleReconcileBankTransaction = async (candidate: any) => {
        if (!selectedBankTransaction) return;
        try {
            const res = await fetch(`${API_BASE}/accounting/bank-reconciliations/match`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    bankTransactionId: selectedBankTransaction.id,
                    sourceType: candidate.source_type,
                    sourceId: candidate.source_id,
                    sourceNumber: candidate.source_number,
                    journalEntryId: candidate.journal_entry_id,
                    movementDate: candidate.movement_date,
                    description: candidate.description,
                    amount: candidate.amount
                })
            });
            const data = await res.json();
            if (data.success) {
                await fetchBankTransactions();
                await fetchBankCandidates(selectedBankTransaction.id);
            } else {
                Swal.fire({ icon: 'error', title: data.error || 'No se pudo conciliar el movimiento', confirmButtonColor: '#1A1D1F' });
            }
        } catch (e) { console.error(e); }
    };

    const handleUnmatchBankLine = async (lineId: number) => {
        try {
            const res = await fetch(`${API_BASE}/accounting/bank-reconciliation-lines/${lineId}/unmatch`, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success && selectedBankTransaction) {
                await fetchBankTransactions();
                await fetchBankCandidates(selectedBankTransaction.id);
            } else if (!data.success) {
                Swal.fire({ icon: 'error', title: data.error || 'No se pudo deshacer la conciliacion', confirmButtonColor: '#1A1D1F' });
            }
        } catch (e) { console.error(e); }
    };

    // ── Effects ──────────────────────────────────────────────────────

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchBanks();
            fetchBankTransactions();
        }
        if (activeTab === 'transacciones') {
            fetchBanks();
            fetchBankTransactions();
        }
        if (activeTab === 'nuevo') {
            fetchBanks();
        }
        if (activeTab === 'conciliar') {
            fetchBanks();
            fetchBankTransactions();
        }
        if (activeTab === 'cuentas-bancarias') {
            fetchBanks();
        }
    }, [activeTab, startDate, endDate]);

    // ── Sidebar ──────────────────────────────────────────────────────

    const sidebarSections = useMemo(() => buildBancosSidebarSections(), []);

    // ── Render content ───────────────────────────────────────────────

    const renderContent = () => {
        switch (activeTab) {

            // ── Dashboard ────────────────────────────────────────────
            case 'dashboard':
                return (
                    <>
                        <Row className="g-3 mb-3">
                            <Col md={4}>
                                <Card>
                                    <CardBody>
                                        <div className="text-muted fs-12">Movimientos</div>
                                        <div className="fw-semibold fs-20 font-monospace">${fmt(bankSummary.total)}</div>
                                    </CardBody>
                                </Card>
                            </Col>
                            <Col md={4}>
                                <Card>
                                    <CardBody>
                                        <div className="text-muted fs-12">Conciliado</div>
                                        <div className="fw-semibold fs-20 font-monospace text-success">${fmt(bankSummary.totalMatched)}</div>
                                    </CardBody>
                                </Card>
                            </Col>
                            <Col md={4}>
                                <Card>
                                    <CardBody>
                                        <div className="text-muted fs-12">Pendiente</div>
                                        <div className="fw-semibold fs-20 font-monospace text-warning">${fmt(bankSummary.totalPending)}</div>
                                    </CardBody>
                                </Card>
                            </Col>
                        </Row>

                        <Card>
                            <CardHeader className="d-flex justify-content-between align-items-center">
                                <h6 className="card-title mb-0">Ultimos movimientos</h6>
                                <Button color="soft-primary" size="sm" onClick={() => setActiveTab('transacciones')}>Ver todos</Button>
                            </CardHeader>
                            <CardBody>
                                {bankTransactionsLoading ? (
                                    <div className="text-center py-4"><Spinner color="primary" /></div>
                                ) : bankTransactions.length === 0 ? (
                                    <div className="text-center py-4 text-muted">
                                        <i className="ri-bank-card-line fs-36 d-block mb-2"></i>
                                        <p>No hay movimientos en este periodo</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <Table className="table-hover align-middle mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Banco</th>
                                                    <th>Descripcion</th>
                                                    <th>Tipo</th>
                                                    <th className="text-end">Monto</th>
                                                    <th>Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bankTransactions.slice(0, 10).map((row: any) => (
                                                    <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => openBankDetail(row)}>
                                                        <td>{row.transaction_date ? new Date(row.transaction_date).toLocaleDateString('es-CO') : '-'}</td>
                                                        <td>{row.bank_name}</td>
                                                        <td>{row.description}</td>
                                                        <td><Badge color={row.transaction_type === 'ABONO' ? 'success-subtle' : 'danger-subtle'} className={row.transaction_type === 'ABONO' ? 'text-success' : 'text-danger'}>{row.transaction_type}</Badge></td>
                                                        <td className="text-end font-monospace">${fmt(row.amount)}</td>
                                                        <td><Badge color={statusColor(row.status)}>{row.status}</Badge></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </>
                );

            // ── Transacciones (Extracto Bancario) ────────────────────
            case 'transacciones':
                return (
                    <Card>
                        <CardHeader className="d-flex justify-content-between align-items-center">
                            <h6 className="card-title mb-0">Extracto y conciliacion</h6>
                            <div className="d-flex gap-2">
                                <Input type="select" bsSize="sm" value={bankStatus} onChange={(e) => setBankStatus(e.target.value)} style={{ width: 160 }}>
                                    <option value="TODAS">Todas</option>
                                    <option value="PENDIENTE">Pendientes</option>
                                    <option value="PARCIAL">Parciales</option>
                                    <option value="CONCILIADO">Conciliadas</option>
                                </Input>
                                <Input bsSize="sm" placeholder="Buscar descripcion o referencia" value={bankSearch} onChange={(e) => setBankSearch(e.target.value)} style={{ width: 240 }} />
                                <Button color="primary" size="sm" onClick={fetchBankTransactions}>Buscar</Button>
                            </div>
                        </CardHeader>
                        <CardBody>
                            {bankTransactionsLoading ? (
                                <div className="text-center py-4"><Spinner color="primary" /></div>
                            ) : (
                                <div className="table-responsive">
                                    <Table className="table-hover align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Banco</th>
                                                <th>Descripcion</th>
                                                <th>Tipo</th>
                                                <th className="text-end">Monto</th>
                                                <th className="text-end">Conciliado</th>
                                                <th>Estado</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bankTransactions.map((row: any) => (
                                                <tr key={row.id} className={selectedBankTransaction?.id === row.id ? 'table-primary' : ''}>
                                                    <td>{row.transaction_date ? new Date(row.transaction_date).toLocaleDateString('es-CO') : '-'}</td>
                                                    <td><div className="fw-medium">{row.bank_name}</div><div className="text-muted fs-12">{row.account_code || ''}</div></td>
                                                    <td><div>{row.description}</div><div className="text-muted fs-12">{row.reference || 'Sin referencia'}</div></td>
                                                    <td><Badge color={row.transaction_type === 'ABONO' ? 'success-subtle' : 'danger-subtle'} className={row.transaction_type === 'ABONO' ? 'text-success' : 'text-danger'}>{row.transaction_type}</Badge></td>
                                                    <td className="text-end font-monospace">${fmt(row.amount)}</td>
                                                    <td className="text-end font-monospace">${fmt(row.matched_amount)}</td>
                                                    <td><Badge color={statusColor(row.status)}>{row.status}</Badge></td>
                                                    <td className="text-end">
                                                        <Button color="soft-primary" size="sm" onClick={() => openBankDetail(row)} title="Ver detalle">
                                                            <i className="ri-eye-line align-middle" /> Ver
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
                );

            // ── Nuevo Movimiento ─────────────────────────────────────
            case 'nuevo':
                return (
                    <Card>
                        <CardHeader>
                            <h6 className="card-title mb-0">Nuevo Movimiento Bancario</h6>
                        </CardHeader>
                        <CardBody>
                            <Row className="g-2">
                                <Col md={6}>
                                    <Label>Banco</Label>
                                    <Input type="select" value={bankTransactionForm.bankId} onChange={(e) => setBankTransactionForm((prev: any) => ({ ...prev, bankId: e.target.value }))}>
                                        <option value="">Selecciona banco</option>
                                        {banks.map((bank: any) => (
                                            <option key={bank.id} value={bank.id}>{bank.name}{bank.account_code ? ` (${bank.account_code})` : ''}</option>
                                        ))}
                                    </Input>
                                </Col>
                                <Col md={6}>
                                    <Label>Fecha</Label>
                                    <Input type="date" value={bankTransactionForm.transactionDate} onChange={(e) => setBankTransactionForm((prev: any) => ({ ...prev, transactionDate: e.target.value }))} />
                                </Col>
                                <Col md={6}>
                                    <Label>Tipo</Label>
                                    <Input type="select" value={bankTransactionForm.transactionType} onChange={(e) => setBankTransactionForm((prev: any) => ({ ...prev, transactionType: e.target.value }))}>
                                        <option value="ABONO">Abono</option>
                                        <option value="CARGO">Cargo</option>
                                    </Input>
                                </Col>
                                <Col md={6}>
                                    <Label>Monto</Label>
                                    <Input type="number" value={bankTransactionForm.amount} onChange={(e) => setBankTransactionForm((prev: any) => ({ ...prev, amount: e.target.value }))} />
                                </Col>
                                <Col md={12}>
                                    <Label>Descripcion</Label>
                                    <Input value={bankTransactionForm.description} onChange={(e) => setBankTransactionForm((prev: any) => ({ ...prev, description: e.target.value }))} />
                                </Col>
                                <Col md={6}>
                                    <Label>Referencia</Label>
                                    <Input value={bankTransactionForm.reference} onChange={(e) => setBankTransactionForm((prev: any) => ({ ...prev, reference: e.target.value }))} />
                                </Col>
                                <Col md={6}>
                                    <Label>Saldo extracto</Label>
                                    <Input type="number" value={bankTransactionForm.runningBalance} onChange={(e) => setBankTransactionForm((prev: any) => ({ ...prev, runningBalance: e.target.value }))} />
                                </Col>
                                <Col md={12}>
                                    <Label>Notas</Label>
                                    <Input type="textarea" rows={2} value={bankTransactionForm.notes} onChange={(e) => setBankTransactionForm((prev: any) => ({ ...prev, notes: e.target.value }))} />
                                </Col>
                                <Col md={12}>
                                    <Button color="primary" onClick={handleCreateBankTransaction}>Guardar movimiento</Button>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>
                );

            // ── Conciliar ────────────────────────────────────────────
            case 'conciliar':
                return (
                    <Row>
                        <Col xl={5}>
                            <Card>
                                <CardHeader>
                                    <h6 className="card-title mb-0">Movimiento seleccionado</h6>
                                </CardHeader>
                                <CardBody>
                                    {!selectedBankTransaction ? (
                                        <div className="text-center py-4 text-muted">
                                            <i className="ri-bank-card-line fs-36 d-block mb-2"></i>
                                            <p>Selecciona un movimiento desde el Extracto Bancario</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="border rounded p-3 mb-3">
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <div className="fw-semibold">{selectedBankTransaction.description}</div>
                                                        <div className="text-muted fs-12">
                                                            {selectedBankTransaction.bank_name} | {selectedBankTransaction.transaction_type} | {selectedBankTransaction.reference || 'Sin referencia'}
                                                        </div>
                                                    </div>
                                                    <div className="text-end">
                                                        <div className="font-monospace fw-semibold">${fmt(selectedBankTransaction.amount)}</div>
                                                        <Badge color={selectedBankTransaction.status === 'CONCILIADO' ? 'success' : selectedBankTransaction.status === 'PARCIAL' ? 'warning' : 'secondary'}>{selectedBankTransaction.status}</Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            {Array.isArray(selectedBankTransaction.reconciliation_lines) && selectedBankTransaction.reconciliation_lines.length > 0 && (
                                                <div className="mb-3">
                                                    <div className="fw-semibold mb-2">Conciliaciones actuales</div>
                                                    <div className="d-flex flex-column gap-2">
                                                        {selectedBankTransaction.reconciliation_lines.map((line: any) => (
                                                            <div key={line.id} className="border rounded p-2 d-flex justify-content-between align-items-center">
                                                                <div>
                                                                    <div className="fw-medium">{line.source_type} {line.source_number || ''}</div>
                                                                    <div className="text-muted fs-12">{line.description || 'Sin descripcion'}</div>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <span className="font-monospace">${fmt(line.amount)}</span>
                                                                    <Button color="soft-danger" size="sm" onClick={() => handleUnmatchBankLine(line.id)}>Quitar</Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardBody>
                            </Card>
                        </Col>

                        <Col xl={7}>
                            <Card>
                                <CardHeader>
                                    <h6 className="card-title mb-0">Candidatos de conciliacion</h6>
                                </CardHeader>
                                <CardBody>
                                    {!selectedBankTransaction ? (
                                        <div className="text-center py-4 text-muted">
                                            <i className="ri-links-line fs-36 d-block mb-2"></i>
                                            <p>Selecciona un movimiento para revisar candidatos</p>
                                        </div>
                                    ) : bankCandidatesLoading ? (
                                        <div className="text-center py-4"><Spinner color="primary" /></div>
                                    ) : bankCandidates.length === 0 ? (
                                        <div className="text-center py-4 text-muted">
                                            <i className="ri-links-line fs-36 d-block mb-2"></i>
                                            <p>No hay candidatos automaticos para este movimiento</p>
                                        </div>
                                    ) : (
                                        <div className="table-responsive">
                                            <Table className="table-hover align-middle mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Fuente</th>
                                                        <th>Documento</th>
                                                        <th>Descripcion</th>
                                                        <th>Fecha</th>
                                                        <th className="text-end">Monto</th>
                                                        <th></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bankCandidates.map((candidate: any, idx: number) => (
                                                        <tr key={`${candidate.source_type}-${candidate.source_id}-${idx}`}>
                                                            <td><Badge color="info-subtle" className="text-info">{candidate.source_type}</Badge></td>
                                                            <td><div className="fw-medium">{candidate.source_number}</div><div className="text-muted fs-12">{candidate.journal_entry_id ? `Asiento ${candidate.journal_entry_id}` : 'Sin asiento vinculado'}</div></td>
                                                            <td>{candidate.description}</td>
                                                            <td>{candidate.movement_date ? new Date(candidate.movement_date).toLocaleDateString('es-CO') : '-'}</td>
                                                            <td className="text-end font-monospace">${fmt(candidate.amount)}</td>
                                                            <td className="text-end"><Button color="success" size="sm" onClick={() => handleReconcileBankTransaction(candidate)}>Conciliar</Button></td>
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
                );

            // ── Cuentas Bancarias ────────────────────────────────────
            case 'cuentas-bancarias':
                return (
                    <Card>
                        <CardHeader>
                            <h6 className="card-title mb-0">Cuentas Bancarias</h6>
                        </CardHeader>
                        <CardBody>
                            {banks.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <i className="ri-bank-line fs-36 d-block mb-2"></i>
                                    <p>No hay cuentas bancarias registradas</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <Table className="table-hover align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Codigo de cuenta</th>
                                                <th>Fecha de creacion</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {banks.map((bank: any) => (
                                                <tr key={bank.id}>
                                                    <td className="fw-medium">{bank.name}</td>
                                                    <td>{bank.account_code || '-'}</td>
                                                    <td>{bank.created_at ? new Date(bank.created_at).toLocaleDateString('es-CO') : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            )}
                        </CardBody>
                    </Card>
                );

            default:
                return (
                    <div className="text-center py-5 text-muted">
                        <i className="ri-bank-line fs-48 d-block mb-3"></i>
                        <p>Selecciona una opcion del menu</p>
                    </div>
                );
        }
    };

    // ── Return ───────────────────────────────────────────────────────

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <Row className="mb-3">
                        <Col>
                            <div className="d-flex align-items-center justify-content-between">
                                <h4 className="mb-0">Bancos y Conciliacion</h4>
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

                    <ModuleLayout
                        sections={sidebarSections}
                        activeItem={activeTab}
                        onItemClick={setActiveTab}
                    >
                        {renderContent()}
                    </ModuleLayout>
                </Container>
            </div>

            <Offcanvas isOpen={showBankDetail} toggle={() => setShowBankDetail(false)} direction="end" style={{ width: 640 }}>
                <OffcanvasHeader toggle={() => setShowBankDetail(false)}>
                    {selectedBankTransaction
                        ? `Movimiento bancario #${selectedBankTransaction.id}`
                        : 'Detalle del movimiento'}
                </OffcanvasHeader>
                <OffcanvasBody>
                    {!selectedBankTransaction ? (
                        <div className="text-center py-5 text-muted">
                            <Spinner />
                        </div>
                    ) : (
                        <div>
                            <div className="mb-3 d-flex align-items-center gap-2">
                                <Badge color={statusColor(selectedBankTransaction.status)} className="fs-13">
                                    {selectedBankTransaction.status}
                                </Badge>
                                <Badge
                                    color={selectedBankTransaction.transaction_type === 'ABONO' ? 'success-subtle' : 'danger-subtle'}
                                    className={selectedBankTransaction.transaction_type === 'ABONO' ? 'text-success' : 'text-danger'}
                                >
                                    <i className={`${selectedBankTransaction.transaction_type === 'ABONO' ? 'ri-arrow-down-circle-line' : 'ri-arrow-up-circle-line'} align-middle me-1`} />
                                    {selectedBankTransaction.transaction_type}
                                </Badge>
                                <span className="text-muted fs-12 ms-auto">
                                    Origen: {selectedBankTransaction.source || 'MANUAL'}
                                </span>
                            </div>

                            <Card className="mb-3">
                                <CardBody>
                                    <h6 className="mb-3">Movimiento</h6>
                                    <Row className="g-2 small">
                                        <Col xs={6}><span className="text-muted">Fecha:</span> <strong>{selectedBankTransaction.transaction_date ? new Date(selectedBankTransaction.transaction_date).toLocaleDateString('es-CO') : '-'}</strong></Col>
                                        <Col xs={6}><span className="text-muted">Referencia:</span> {selectedBankTransaction.reference || '-'}</Col>
                                        <Col xs={12}><span className="text-muted">Banco:</span> <strong>{selectedBankTransaction.bank_name}</strong></Col>
                                        <Col xs={6}><span className="text-muted">Cuenta PUC:</span> <code>{selectedBankTransaction.account_code || '-'}</code></Col>
                                        <Col xs={6}><span className="text-muted">Saldo extracto:</span> {selectedBankTransaction.running_balance != null ? `$${fmt(selectedBankTransaction.running_balance)}` : '-'}</Col>
                                        <Col xs={12}><span className="text-muted">Descripción:</span> <div>{selectedBankTransaction.description}</div></Col>
                                        {selectedBankTransaction.notes && (
                                            <Col xs={12}><span className="text-muted">Notas:</span> <div>{selectedBankTransaction.notes}</div></Col>
                                        )}
                                    </Row>
                                </CardBody>
                            </Card>

                            <Card className="mb-3">
                                <CardBody>
                                    <h6 className="mb-1">Totales</h6>
                                    <small className="text-muted d-block mb-2">
                                        El movimiento solo afecta el libro mayor cuando se concilia con un asiento contable.
                                    </small>
                                    {(() => {
                                        const amount = Number(selectedBankTransaction.amount || 0);
                                        const matched = Number(selectedBankTransaction.matched_amount || 0);
                                        const pending = Math.max(amount - matched, 0);
                                        return (
                                            <Table size="sm" className="mb-0">
                                                <tbody>
                                                    <tr><td>Monto del movimiento</td><td className="text-end font-monospace">${fmt(amount)}</td></tr>
                                                    <tr className="text-success"><td>Conciliado</td><td className="text-end font-monospace">${fmt(matched)}</td></tr>
                                                    <tr className="fw-bold table-light">
                                                        <td>Pendiente por conciliar</td>
                                                        <td className="text-end font-monospace text-warning">${fmt(pending)}</td>
                                                    </tr>
                                                </tbody>
                                            </Table>
                                        );
                                    })()}
                                </CardBody>
                            </Card>

                            {Array.isArray(selectedBankTransaction.reconciliation_lines) && selectedBankTransaction.reconciliation_lines.length > 0 && (
                                <Card className="mb-3">
                                    <CardBody>
                                        <h6 className="mb-3">Conciliaciones aplicadas</h6>
                                        <div className="d-flex flex-column gap-2">
                                            {selectedBankTransaction.reconciliation_lines.map((line: any) => (
                                                <div key={line.id} className="border rounded p-2 d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <div className="fw-medium">
                                                            <Badge color="info-subtle" className="text-info me-1">{line.source_type}</Badge>
                                                            {line.source_number || ''}
                                                        </div>
                                                        <div className="text-muted fs-12">{line.description || 'Sin descripción'}</div>
                                                        {line.journal_entry_id && (
                                                            <div className="text-muted fs-12">Asiento #{line.journal_entry_id}</div>
                                                        )}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="font-monospace">${fmt(line.amount)}</span>
                                                        <Button color="soft-danger" size="sm" onClick={() => handleUnmatchBankLine(line.id)}>
                                                            <i className="ri-close-line align-middle" /> Quitar
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardBody>
                                </Card>
                            )}

                            <Card className="mb-3">
                                <CardBody>
                                    <h6 className="mb-3">Candidatos de conciliación</h6>
                                    {bankCandidatesLoading ? (
                                        <div className="text-center py-3"><Spinner color="primary" size="sm" /></div>
                                    ) : bankCandidates.length === 0 ? (
                                        <div className="text-center py-3 text-muted fs-13">
                                            <i className="ri-links-line fs-24 d-block mb-1" />
                                            No hay candidatos automáticos para este movimiento.
                                        </div>
                                    ) : (
                                        <Table size="sm" className="small mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Fuente</th>
                                                    <th>Documento</th>
                                                    <th>Fecha</th>
                                                    <th className="text-end">Monto</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bankCandidates.map((c: any, i: number) => (
                                                    <tr key={`${c.source_type}-${c.source_id}-${i}`}>
                                                        <td><Badge color="info-subtle" className="text-info">{c.source_type}</Badge></td>
                                                        <td>
                                                            <div className="fw-medium">{c.source_number}</div>
                                                            <div className="text-muted" style={{ fontSize: 11 }}>{c.description}</div>
                                                        </td>
                                                        <td>{c.movement_date ? new Date(c.movement_date).toLocaleDateString('es-CO') : '-'}</td>
                                                        <td className="text-end font-monospace">${fmt(c.amount)}</td>
                                                        <td className="text-end">
                                                            <Button color="success" size="sm" onClick={() => handleReconcileBankTransaction(c)}>
                                                                <i className="ri-check-line align-middle" /> Conciliar
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    )}
                                </CardBody>
                            </Card>

                            <div className="d-flex gap-2">
                                <Button color="light" className="ms-auto" onClick={() => setShowBankDetail(false)}>
                                    Cerrar
                                </Button>
                            </div>
                        </div>
                    )}
                </OffcanvasBody>
            </Offcanvas>
        </React.Fragment>
    );
};

export default BancosPage;
