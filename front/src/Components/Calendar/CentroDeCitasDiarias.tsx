// Archivo: src/Components/Calendar/CentroDeCitasDiarias.tsx

import React, { useEffect, useMemo, useState, ChangeEvent } from 'react';
import { Card, CardBody, Input, Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Modal, ModalHeader, ModalBody, ModalFooter, Button, Nav, NavItem, NavLink, TabContent, TabPane, Label, Spinner, Row, Col, Table, InputGroup } from "reactstrap";
import classnames from "classnames";
import SimpleBar from "simplebar-react";
import Flatpickr from "react-flatpickr";
import Select from 'react-select';
import { useNavigate } from "react-router-dom";
import TarjetaCita from './TarjetaCita';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { jwtDecode } from "jwt-decode";
import { getToken } from "../../services/auth";

// --- Tipos ---
interface CentroDeCitasDiariasProps { events: any[]; onNewAppointmentClick: () => void; }
type CitaEvento = any;
type GrupoCliente = { clientId: string | number; client_first_name: string; client_last_name?: string; earliestStartISO: string; count: number; appointments: { id: string | number; service_name: string; stylist_first_name?: string; start_time: string; }[]; };
type Stylist = { id: string | number; first_name: string; last_name?: string; };
type ProductForStaff = { id: string; name: string; sale_price: number; staff_price: number; stock: number; };
type CartItem = { productId: string; name: string; quantity: number; price: number; stock: number; };
type SelectOption = { value: string; label: string; };
type ActiveTab = 'anticipo' | 'factura' | 'venta_personal' | 'prestamo';

// --- Helpers ---
const formatterCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');
const formatCOPString = (digits: string) => {
    if (!digits) return '';
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) return '';
    return formatterCOP.format(n);
};

// --- Modales ---
const ModalAbrirCaja: React.FC<{ isOpen: boolean; onClose: () => void; onSessionOpened: () => void; }> = ({ isOpen, onClose, onSessionOpened }) => {
    const [amountDigits, setAmountDigits] = useState('');
    const [saving, setSaving] = useState(false);
    const handleOpenSession = async () => {
        const amount = parseInt(amountDigits || '0', 10) || 0;
        try {
            setSaving(true);
            await api.post('/cash/open', { initial_amount: amount });
            await Swal.fire('¡Caja Abierta!', 'La sesión de caja se ha iniciado correctamente.', 'success');
            onSessionOpened();
            onClose();
        } catch (e: any) {
            Swal.fire('Error', e?.response?.data?.error || 'No se pudo abrir la sesión de caja.', 'error');
        } finally {
            setSaving(false);
        }
    };
    useEffect(() => { if (!isOpen) setAmountDigits(''); }, [isOpen]);
    return (
        <Modal isOpen={isOpen} toggle={onClose} centered>
            <ModalHeader toggle={onClose}>Abrir Caja</ModalHeader>
            <ModalBody>
                <Label>Monto inicial en efectivo (base)</Label>
                <Input type="text" inputMode="numeric" placeholder="$0" value={formatCOPString(amountDigits)} onChange={(e) => setAmountDigits(onlyDigits(e.target.value))} autoFocus />
            </ModalBody>
            <ModalFooter>
                <Button color="secondary" onClick={onClose}>Cancelar</Button>
                <Button color="primary" onClick={handleOpenSession} disabled={saving}>{saving && <Spinner size="sm" className="me-2" />}Confirmar Apertura</Button>
            </ModalFooter>
        </Modal>
    );
};

const ModalResumenCierre: React.FC<{ isOpen: boolean; onClose: () => void; onSessionClosed: () => void; sessionData: any | null; }> = ({ isOpen, onClose, onSessionClosed, sessionData }) => {
    const [saving, setSaving] = useState(false);

    const expenseCategoryLabels: Record<string, string> = {
        stylist_advance: 'Anticipos a Personal',
        vendor_invoice: 'Pago a Proveedores',
        loan_to_staff: 'Desembolso de Préstamos',
    };

    const summary = useMemo(() => {
        const details = sessionData?.session_details || {};
        const incomes = sessionData?.summary?.incomes_by_payment_method || [];
        const expenses = sessionData?.summary?.expenses_by_category || [];
        const totalCashIncomes = incomes.find((inc: any) => inc.payment_method === 'cash')?.total || 0;
        const totalExpenses = expenses.reduce((acc: number, exp: any) => acc + Number(exp.total), 0);

        return {
            details, incomes, expenses,
            expectedCash: sessionData?.expected_cash_amount || 0,
            totalCashIncomes, totalExpenses
        };
    }, [sessionData]);

    const handleCloseSession = async () => {
        try {
            setSaving(true);
            await api.post('/cash/close', {});
            await Swal.fire({ title: '¡Caja Cerrada!', text: 'La sesión de caja se ha cerrado y archivado correctamente.', icon: 'success' });
            onSessionClosed();
            onClose();
        } catch (e: any) {
            Swal.fire('Error', e?.response?.data?.error || 'No se pudo cerrar la sesión de caja.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!sessionData) return null;

    return (
        <Modal isOpen={isOpen} toggle={onClose} centered size="lg">
            <ModalHeader toggle={onClose}>Resumen de Cierre de Caja</ModalHeader>
            <ModalBody>
                <p><strong>Responsable:</strong> {summary.details.opener_name}</p>
                <hr />
                <Row className="gy-3">
                    <Col md={6}>
                        <h6><i className="ri-arrow-down-circle-line text-success"></i> Ingresos Totales</h6>
                        <div className="vstack gap-2">
                            {summary.incomes.map((inc: any) => (
                                <div key={inc.payment_method} className="d-flex justify-content-between">
                                    <span>Ingresos por {inc.payment_method} ({inc.count})</span>
                                    <span className="fw-medium">{formatterCOP.format(inc.total)}</span>
                                </div>
                            ))}
                        </div>
                    </Col>
                    <Col md={6}>
                        <h6><i className="ri-arrow-up-circle-line text-danger"></i> Egresos en Efectivo</h6>
                        <div className="vstack gap-2">
                            {summary.expenses.length === 0 && <p className="text-muted m-0">No hubo egresos.</p>}
                            {summary.expenses.map((exp: any) => (
                                <div key={exp.category} className="d-flex justify-content-between">
                                    <span>{expenseCategoryLabels[exp.category] || exp.category} ({exp.count})</span>
                                    <span className="fw-medium text-danger">-{formatterCOP.format(exp.total)}</span>
                                </div>
                            ))}
                        </div>
                    </Col>
                </Row>
                <hr />
                <div className="bg-light p-3 rounded">
                    <div className="d-flex justify-content-between"><span className="text-muted">Base Inicial</span><span>{formatterCOP.format(summary.details.initial_amount)}</span></div>
                    <div className="d-flex justify-content-between mt-2"><span className="text-muted">(+) Ingresos en Efectivo</span><span className="text-success">{formatterCOP.format(summary.totalCashIncomes)}</span></div>
                    <div className="d-flex justify-content-between"><span className="text-muted">(-) Egresos en Efectivo</span><span className="text-danger">-{formatterCOP.format(summary.totalExpenses)}</span></div>
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between align-items-center"><strong className="fs-5">Total Efectivo Esperado</strong><strong className="fs-3 text-primary">{formatterCOP.format(summary.expectedCash)}</strong></div>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button color="secondary" onClick={onClose}>Cancelar</Button>
                <Button color="danger" onClick={handleCloseSession} disabled={saving}>
                    {saving && <Spinner size="sm" className="me-2" />}
                    Confirmar y Cerrar Caja
                </Button>
            </ModalFooter>
        </Modal>
    );
};


const CentroDeCitasDiarias = ({ events, onNewAppointmentClick }: CentroDeCitasDiariasProps) => {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
    const [paymentsModalOpen, setPaymentsModalOpen] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('anticipo');
    const [cashSession, setCashSession] = useState<any | null>(null);
    const [loadingSession, setLoadingSession] = useState<boolean>(true);
    const [stylists, setStylists] = useState<Stylist[]>([]);
    const [loadingStylists, setLoadingStylists] = useState<boolean>(false);
    const [openModalOpen, setOpenModalOpen] = useState<boolean>(false);
    const [closeModalOpen, setCloseModalOpen] = useState<boolean>(false);
    const [canSellToStaff, setCanSellToStaff] = useState(true);
    const [productsForStaff, setProductsForStaff] = useState<ProductForStaff[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [ventaPersonal, setVentaPersonal] = useState<{ stylist_id: string; cart: CartItem[]; total: number; payment_terms_weeks: number; }>({ stylist_id: '', cart: [], total: 0, payment_terms_weeks: 1 });
    const [paymentEndDate, setPaymentEndDate] = useState<Date | null>(null);
    const [savingVenta, setSavingVenta] = useState(false);
    const [anticipo, setAnticipo] = useState({ stylist_id: '', amountDigits: '', description: '' });
    const [factura, setFactura] = useState({ reference: '', amountDigits: '', description: '' });
    const [canGiveLoans, setCanGiveLoans] = useState(true);
    const [prestamo, setPrestamo] = useState({ stylist_id: '', amountDigits: '', weeks: '4', interest_percent: '5' });
    const [savingPrestamo, setSavingPrestamo] = useState(false);

    const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

    // --- AJUSTE: Se agregó una alerta de error si la carga de la sesión falla ---
    const fetchCurrentSession = async () => {
        try {
            setLoadingSession(true);
            const { data } = await api.get('/cash/current');
            setCashSession(data);
        } catch (e: any) {
            console.error("Error cargando la sesión de caja", e);
            // Mostrar una alerta al usuario para que sepa que algo falló
            Swal.fire({
                icon: 'error',
                title: 'Error de Conexión',
                text: e?.response?.data?.error || 'No se pudo cargar la información de la sesión de caja. Revisa la consola del servidor backend.',
            });
            setCashSession(null);
        } finally {
            setLoadingSession(false);
        }
    };

    useEffect(() => { fetchCurrentSession(); }, []);

    const fetchPrerequisites = async () => {
        setLoadingStylists(true); setLoadingProducts(true);
        try {
            const token = getToken(); if (!token) return;
            const decodedToken = jwtDecode<{ user?: { tenant_id?: string } }>(token);
            const tenantId = decodedToken?.user?.tenant_id;
            const stylistsPromise = api.get('/stylists');
            const tenantPromise = tenantId ? api.get(`/tenants/${tenantId}`) : Promise.resolve({ data: { products_for_staff_enabled: true, loans_to_staff_enabled: true } });
            const [stylistsRes, tenantRes] = await Promise.all([stylistsPromise, tenantPromise]);
            setStylists(Array.isArray(stylistsRes.data) ? stylistsRes.data : []);
            const sellToStaffEnabled = tenantRes.data?.products_for_staff_enabled ?? true;
            const giveLoansEnabled = tenantRes.data?.loans_to_staff_enabled ?? true;
            setCanSellToStaff(sellToStaffEnabled);
            setCanGiveLoans(giveLoansEnabled);
            if (sellToStaffEnabled) {
                const productsRes = await api.get('/products?audience=estilista');
                setProductsForStaff(Array.isArray(productsRes.data) ? productsRes.data : []);
            }
        } catch (e) { console.error('Error cargando prerequisitos:', e); }
        finally { setLoadingStylists(false); setLoadingProducts(false); }
    };

    useEffect(() => { if (paymentsModalOpen) fetchPrerequisites(); }, [paymentsModalOpen]);

    const gruposPorCliente = useMemo<GrupoCliente[]>(() => { if (!cashSession) return []; const startOfDay = new Date(selectedDate); startOfDay.setHours(0, 0, 0, 0); const endOfDay = new Date(selectedDate); endOfDay.setHours(23, 59, 59, 999); const filtradas: CitaEvento[] = events.filter((event) => { const fechaCita = new Date(event.start); const enFecha = fechaCita >= startOfDay && fechaCita <= endOfDay; const esOperativa = event.extendedProps.status !== 'cancelled' && event.extendedProps.status !== 'completed'; if (!enFecha || !esOperativa) return false; if (searchTerm) { const q = searchTerm.toLowerCase(); return (event.extendedProps.client_first_name?.toLowerCase().includes(q) || event.extendedProps.client_last_name?.toLowerCase().includes(q) || event.extendedProps.stylist_first_name?.toLowerCase().includes(q)); } return true; }); const map = new Map<string | number, GrupoCliente>(); for (const ev of filtradas) { const ep = ev.extendedProps || {}; const clientId = ep.client_id ?? ep.clientId; if (clientId == null) continue; const item = { id: ev.id, service_name: ep.service_name, stylist_first_name: ep.stylist_first_name, start_time: ep.start_time ?? ev.start, }; if (!map.has(clientId)) { map.set(clientId, { clientId, client_first_name: ep.client_first_name, client_last_name: ep.client_last_name, earliestStartISO: item.start_time, count: 1, appointments: [item], }); } else { const g = map.get(clientId)!; g.appointments.push(item); g.count += 1; if (new Date(item.start_time).getTime() < new Date(g.earliestStartISO).getTime()) { g.earliestStartISO = item.start_time; } } } return Array.from(map.values()).sort((a, b) => new Date(a.earliestStartISO).getTime() - new Date(b.earliestStartISO).getTime()); }, [events, selectedDate, searchTerm, cashSession]);
    const handleOpenPayments = () => { if (cashSession) { setActiveTab('anticipo'); } else if(canSellToStaff) { setActiveTab('venta_personal'); } setPaymentsModalOpen(true); };
    const handleNewSale = () => { navigate('/checkout'); };
    const handleSaveAnticipo = async () => { const amount = parseInt(anticipo.amountDigits || '0', 10) || 0; if (!anticipo.stylist_id || amount <= 0) { Swal.fire('Datos incompletos', 'Selecciona un estilista y un monto válido.', 'warning'); return; } try { await api.post('/cash/movements', { type: 'payroll_advance', category: 'stylist_advance', description: anticipo.description || 'Anticipo', amount, payment_method: 'cash', related_entity_type: 'stylist', related_entity_id: anticipo.stylist_id }); Swal.fire('¡Éxito!', 'Anticipo registrado correctamente.', 'success'); setPaymentsModalOpen(false); setAnticipo({ stylist_id: '', amountDigits: '', description: '' }); fetchCurrentSession(); } catch (e: any) { console.error(e); Swal.fire('Error', e?.response?.data?.error || 'No se pudo registrar el anticipo.', 'error'); } };
    const handleSaveFactura = async () => { const amount = parseInt(factura.amountDigits || '0', 10) || 0; if (!factura.reference || amount <= 0) { Swal.fire('Datos incompletos', 'Ingresa una referencia y un monto válido.', 'warning'); return; } try { await api.post('/cash/movements', { type: 'expense', category: 'vendor_invoice', invoice_ref: factura.reference, description: factura.description || 'Factura de proveedor', amount, payment_method: 'cash' }); Swal.fire('¡Éxito!', 'Factura registrada correctamente.', 'success'); setPaymentsModalOpen(false); setFactura({ reference: '', amountDigits: '', description: '' }); fetchCurrentSession(); } catch (e: any) { console.error(e); Swal.fire('Error', e?.response?.data?.error || 'No se pudo registrar la factura.', 'error'); } };
    const calculateTotal = (cart: CartItem[]) => { return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0); };
    const addToCart = (product: ProductForStaff | null) => { if (!product) return; setVentaPersonal(prev => { const existingItem = prev.cart.find(item => item.productId === product.id); if (existingItem) return prev; const priceToUse = product.staff_price ?? product.sale_price; const newItem: CartItem = { productId: product.id, name: product.name, quantity: 1, price: priceToUse, stock: product.stock }; const updatedCart = [...prev.cart, newItem]; return { ...prev, cart: updatedCart, total: calculateTotal(updatedCart) }; }); };
    const handleQuantityChange = (productId: string, newQuantity: number) => { setVentaPersonal(prev => { const updatedCart = prev.cart.map(item => { if (item.productId === productId) { const validatedQty = Math.max(1, Math.min(item.stock, newQuantity || 1)); return { ...item, quantity: validatedQty }; } return item; }); return { ...prev, cart: updatedCart, total: calculateTotal(updatedCart) }; }); };
    const removeFromCart = (productId: string) => { setVentaPersonal(prev => { const updatedCart = prev.cart.filter(item => item.productId !== productId); return { ...prev, cart: updatedCart, total: calculateTotal(updatedCart) }; }); };
    const paymentPlan = useMemo(() => { if (!paymentEndDate || !ventaPersonal.total || ventaPersonal.total === 0) { return { weeks: 1, weeklyAmount: ventaPersonal.total }; } const today = new Date(); today.setHours(0, 0, 0, 0); const endDate = new Date(paymentEndDate); endDate.setHours(23, 59, 59, 999); const diffTime = Math.abs(endDate.getTime() - today.getTime()); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; const weeks = Math.max(1, Math.ceil(diffDays / 7)); const weeklyAmount = ventaPersonal.total / weeks; return { weeks, weeklyAmount }; }, [paymentEndDate, ventaPersonal.total]);
    const handleSaveVentaPersonal = async () => { if (!ventaPersonal.stylist_id || ventaPersonal.cart.length === 0) { Swal.fire('Datos incompletos', 'Debes seleccionar un estilista y añadir al menos un producto.', 'warning'); return; } setSavingVenta(true); try { const payload = { stylist_id: ventaPersonal.stylist_id, payment_terms_weeks: paymentPlan.weeks, items: ventaPersonal.cart.map(item => ({ product_id: item.productId, quantity: item.quantity, price_at_sale: item.price })) }; await api.post('/staff-purchases', payload); Swal.fire('¡Venta Registrada!', 'La compra se ha registrado como un adelanto de nómina.', 'success'); setPaymentsModalOpen(false); setVentaPersonal({ stylist_id: '', cart: [], total: 0, payment_terms_weeks: 1 }); setPaymentEndDate(null); } catch (e: any) { Swal.fire('Error', e?.response?.data?.error || 'No se pudo registrar la venta.', 'error'); } finally { setSavingVenta(false); } };
    const prestamoSummary = useMemo(() => { const principal = parseInt(prestamo.amountDigits || '0', 10); const weeks = parseInt(prestamo.weeks || '0', 10); const interestRate = parseFloat(prestamo.interest_percent || '0'); if (!principal || !weeks || isNaN(interestRate) || interestRate < 0) { return { totalInterest: 0, totalToRepay: 0, weeklyInstallment: 0, isValid: false }; } const totalInterest = principal * (interestRate / 100); const totalToRepay = principal + totalInterest; const weeklyInstallment = totalToRepay / weeks; return { totalInterest, totalToRepay, weeklyInstallment, isValid: true }; }, [prestamo.amountDigits, prestamo.weeks, prestamo.interest_percent]);
    const handleSavePrestamo = async () => { if (!prestamo.stylist_id || !prestamoSummary.isValid) { Swal.fire('Datos incompletos', 'Completa todos los campos del préstamo correctamente.', 'warning'); return; } setSavingPrestamo(true); try { const payload = { stylist_id: prestamo.stylist_id, principal_amount: parseInt(prestamo.amountDigits, 10), weeks: parseInt(prestamo.weeks, 10), interest_percent: parseFloat(prestamo.interest_percent), disburse_from_cash: true, }; await api.post('/staff-loans', payload); Swal.fire('¡Préstamo Registrado!', 'El préstamo ha sido creado y el egreso se registró en caja.', 'success'); setPaymentsModalOpen(false); setPrestamo({ stylist_id: '', amountDigits: '', weeks: '4', interest_percent: '5' }); fetchCurrentSession(); } catch (e: any) { Swal.fire('Error', e?.response?.data?.error || 'No se pudo registrar el préstamo.', 'error'); } finally { setSavingPrestamo(false); } };
    
    return (
        <Card>
            <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title mb-0">Operaciones del Día</h5>
                    <Dropdown isOpen={dropdownOpen} toggle={toggleDropdown}>
                        <DropdownToggle color="light" caret>Opciones</DropdownToggle>
                        <DropdownMenu end>
                            {cashSession && <DropdownItem onClick={() => setCloseModalOpen(true)} disabled={loadingSession}><i className="mdi mdi-door-closed me-2"></i> Cerrar Caja</DropdownItem>}
                            <DropdownItem onClick={handleNewSale} disabled={loadingSession}><i className="mdi mdi-cart-plus me-2"></i> Venta Rápida (Productos)</DropdownItem>
                            <DropdownItem onClick={handleOpenPayments} disabled={!cashSession && !canSellToStaff && !canGiveLoans} title={!cashSession && !canSellToStaff && !canGiveLoans ? "Abre la caja o activa los módulos de personal" : ""}><i className="mdi mdi-cash me-2"></i> Egresos / Personal</DropdownItem>
                            <DropdownItem onClick={onNewAppointmentClick}><i className="mdi mdi-plus me-2"></i> Crear Nueva Cita</DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </div>
                {loadingSession ? ( <div className='text-center p-5'><Spinner /></div> ) : cashSession ? (
                    <>
                        <div className="mb-3"><Flatpickr className="form-control" value={selectedDate} onChange={([date]) => setSelectedDate(date as Date)} options={{ dateFormat: "Y-m-d", altInput: true, altFormat: "F j, Y" }} /></div>
                        <Input type="text" className="form-control" placeholder="Buscar por cliente o estilista..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </>
                ) : null}
            </CardBody>
            <CardBody className="pt-0">
                {loadingSession ? null : cashSession ? (
                    <SimpleBar style={{ maxHeight: "calc(100vh - 450px)" }}>
                        {gruposPorCliente.length > 0 ? (gruposPorCliente.map((grupo) => (<TarjetaCita key={grupo.clientId} group={grupo} />))) : (<p className="text-muted text-center mt-4">No hay citas pendientes para hoy.</p>)}
                    </SimpleBar>
                ) : (
                    <div className="text-center p-5">
                        <h4>La caja está cerrada</h4>
                        <p className="text-muted">Debes abrir la caja para ver la agenda y registrar operaciones en efectivo.</p>
                        <Button color="success" size="lg" onClick={() => setOpenModalOpen(true)}><i className="ri-door-open-line me-1"></i> Abrir Caja</Button>
                    </div>
                )}
            </CardBody>
            
            <Modal isOpen={paymentsModalOpen} toggle={() => setPaymentsModalOpen(false)} centered size="lg">
                <ModalHeader toggle={() => setPaymentsModalOpen(false)}>Egresos y Operaciones de Personal</ModalHeader>
                <ModalBody>
                    <Nav tabs>
                        {cashSession && (
                            <>
                                <NavItem><NavLink className={classnames({ active: activeTab === 'anticipo' })} onClick={() => setActiveTab('anticipo')} style={{ cursor: 'pointer' }}>Anticipo</NavLink></NavItem>
                                <NavItem><NavLink className={classnames({ active: activeTab === 'factura' })} onClick={() => setActiveTab('factura')} style={{ cursor: 'pointer' }}>Factura</NavLink></NavItem>
                            </>
                        )}
                        {canGiveLoans && cashSession && ( <NavItem><NavLink className={classnames({ active: activeTab === 'prestamo' })} onClick={() => setActiveTab('prestamo')} style={{ cursor: 'pointer' }}>Préstamo</NavLink></NavItem> )}
                        {canSellToStaff && ( <NavItem><NavLink className={classnames({ active: activeTab === 'venta_personal' })} onClick={() => setActiveTab('venta_personal')} style={{ cursor: 'pointer' }}>Venta Personal</NavLink></NavItem> )}
                    </Nav>
                    <TabContent activeTab={activeTab} className="pt-3">
                        <TabPane tabId="anticipo">
                            <div className="mb-3">
                                <Label className="form-label">Estilista</Label>
                                {loadingStylists ? ( <div className="d-flex align-items-center gap-2"><Spinner size="sm" /> <span>Cargando…</span></div> ) : (
                                <Input type="select" value={anticipo.stylist_id} onChange={(e) => setAnticipo(a => ({ ...a, stylist_id: e.target.value }))}>
                                    <option value="">Seleccione estilista</option>
                                    {stylists.map((s) => ( <option key={s.id} value={String(s.id)}>{s.first_name} {s.last_name || ''}</option> ))}
                                </Input>
                                )}
                            </div>
                            <div className="mb-3">
                                <Label className="form-label">Monto</Label>
                                <Input type="text" inputMode="numeric" placeholder="$0" value={formatCOPString(anticipo.amountDigits)} onChange={(e: ChangeEvent<HTMLInputElement>) => { const digits = onlyDigits(e.target.value); setAnticipo(a => ({ ...a, amountDigits: digits })); }} />
                                {anticipo.amountDigits && ( <small className="text-muted">Valor: {formatCOPString(anticipo.amountDigits)}</small> )}
                            </div>
                            <div className="mb-0">
                                <Label className="form-label">Descripción</Label>
                                <Input type="textarea" rows={3} value={anticipo.description} onChange={(e) => setAnticipo(a => ({ ...a, description: e.target.value }))} placeholder="Motivo del anticipo" />
                            </div>
                        </TabPane>
                        <TabPane tabId="factura">
                            <div className="mb-3"><Label className="form-label">Referencia de factura</Label><Input value={factura.reference} onChange={(e) => setFactura(f => ({ ...f, reference: e.target.value }))} placeholder="FAC-0001" /></div>
                            <div className="mb-3">
                                <Label className="form-label">Monto</Label>
                                <Input type="text" inputMode="numeric" placeholder="$0" value={formatCOPString(factura.amountDigits)} onChange={(e: ChangeEvent<HTMLInputElement>) => { const digits = onlyDigits(e.target.value); setFactura(f => ({ ...f, amountDigits: digits })); }} />
                                {factura.amountDigits && ( <small className="text-muted">Valor: {formatCOPString(factura.amountDigits)}</small> )}
                            </div>
                            <div className="mb-0"><Label className="form-label">Descripción</Label><Input type="textarea" rows={3} value={factura.description} onChange={(e) => setFactura(f => ({ ...f, description: e.target.value }))} placeholder="Detalle de la compra" /></div>
                        </TabPane>
                        <TabPane tabId="prestamo">
                            <Row>
                                <Col md={12} className="mb-3">
                                    <Label className="form-label">Estilista</Label>
                                    {loadingStylists ? ( <div className="d-flex align-items-center gap-2"><Spinner size="sm" /> <span>Cargando…</span></div> ) : (
                                        <Input type="select" value={prestamo.stylist_id} onChange={(e) => setPrestamo(p => ({ ...p, stylist_id: e.target.value }))}>
                                            <option value="">Seleccione estilista</option>
                                            {stylists.map((s) => ( <option key={s.id} value={String(s.id)}>{s.first_name} {s.last_name || ''}</option> ))}
                                        </Input>
                                    )}
                                </Col>
                                <Col md={4} className="mb-3">
                                    <Label className="form-label">Monto del Préstamo</Label>
                                    <Input type="text" inputMode="numeric" placeholder="$50.000" value={formatCOPString(prestamo.amountDigits)} onChange={(e) => setPrestamo(p => ({ ...p, amountDigits: onlyDigits(e.target.value) }))} />
                                </Col>
                                <Col md={4} className="mb-3">
                                    <Label className="form-label">Plazo (Semanas)</Label>
                                    <Input type="number" value={prestamo.weeks} onChange={(e) => setPrestamo(p => ({ ...p, weeks: e.target.value }))} min={1} placeholder="Ej: 4"/>
                                </Col>
                                <Col md={4} className="mb-3">
                                    <Label className="form-label">Interés (%)</Label>
                                    <Input type="number" value={prestamo.interest_percent} onChange={(e) => setPrestamo(p => ({ ...p, interest_percent: e.target.value }))} min={0} max={100} placeholder="Ej: 5"/>
                                </Col>
                            </Row>
                            {prestamoSummary.isValid && (
                                <div className="bg-light p-3 rounded mt-2">
                                    <h6 className="mb-3">Resumen del Préstamo</h6>
                                    <div className="d-flex justify-content-between"><span>Monto Solicitado:</span> <strong>{formatterCOP.format(parseInt(prestamo.amountDigits))}</strong></div>
                                    <div className="d-flex justify-content-between mt-1"><span>Intereses Totales ({prestamo.interest_percent}%):</span> <span className="text-danger">{formatterCOP.format(prestamoSummary.totalInterest)}</span></div>
                                    <hr className="my-2"/>
                                    <div className="d-flex justify-content-between"><span>Total a Pagar:</span> <strong>{formatterCOP.format(prestamoSummary.totalToRepay)}</strong></div>
                                    <div className="d-flex justify-content-between mt-2 fs-5">
                                        <strong>Descuento Semanal:</strong>
                                        <strong className="text-primary">{formatterCOP.format(prestamoSummary.weeklyInstallment)}</strong>
                                    </div>
                                    <small className="text-muted">Este descuento se aplicará durante {prestamo.weeks} semanas en la nómina del estilista.</small>
                                </div>
                            )}
                        </TabPane>
                        <TabPane tabId="venta_personal">
                            <Row>
                                <Col md={6} className="mb-3">
                                    <Label className="form-label">Estilista</Label>
                                    {loadingStylists ? <Spinner size="sm" /> : (
                                        <Input type="select" value={ventaPersonal.stylist_id} onChange={(e) => setVentaPersonal(v => ({ ...v, stylist_id: e.target.value, cart: [], total: 0, payment_terms_weeks: 1 }))}>
                                            <option value="">Seleccione estilista</option>
                                            {stylists.map((s) => (<option key={s.id} value={String(s.id)}>{s.first_name} {s.last_name || ''}</option>))}
                                        </Input>
                                    )}
                                </Col>
                                <Col md={6} className="mb-3">
                                    <Label className="form-label">Añadir Producto</Label>
                                    {loadingProducts ? <Spinner size="sm" /> : (
                                        <Select
                                            options={productsForStaff.map(p => ({ label: `${p.name} (Stock: ${p.stock})`, value: p.id }))}
                                            onChange={(opt: SelectOption | null) => addToCart(productsForStaff.find(p => p.id === opt?.value) || null)}
                                            placeholder="Busca un producto..."
                                            value={null}
                                        />
                                    )}
                                </Col>
                            </Row>
                            {ventaPersonal.cart.length > 0 && (
                                <>
                                    <Label>Carrito de Compra</Label>
                                    <div className="table-responsive">
                                        <Table size="sm" className="table-centered">
                                            <thead><tr><th>Producto</th><th style={{width: "120px"}}>Cantidad</th><th>Subtotal</th><th></th></tr></thead>
                                            <tbody>
                                                {ventaPersonal.cart.map(item => (
                                                    <tr key={item.productId}>
                                                        <td>{item.name} <br/><small className="text-muted">{formatterCOP.format(item.price)} c/u</small></td>
                                                        <td>
                                                            <InputGroup size="sm">
                                                                <Button outline color="primary" onClick={() => handleQuantityChange(item.productId, item.quantity - 1)}>-</Button>
                                                                <Input bsSize="sm" type="number" className="text-center" value={item.quantity} onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value, 10))} min={1} max={item.stock}/>
                                                                <Button outline color="primary" onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}>+</Button>
                                                            </InputGroup>
                                                        </td>
                                                        <td className="fw-medium">{formatterCOP.format(item.price * item.quantity)}</td>
                                                        <td><Button close onClick={() => removeFromCart(item.productId)} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                    <hr/>
                                    <Row className="justify-content-between align-items-center gy-3">
                                        <Col md={6}>
                                            <Label>Fecha final de pago</Label>
                                            <Flatpickr
                                                className="form-control"
                                                value={paymentEndDate || undefined}
                                                onChange={([date]) => setPaymentEndDate(date as Date)}
                                                options={{ minDate: "today", dateFormat: "Y-m-d", altInput: true, altFormat: "F j, Y" }}
                                                placeholder="Selecciona una fecha..."
                                            />
                                            {paymentEndDate && (
                                                <div className="mt-2 p-2 bg-light rounded">
                                                    <p className="mb-1"><strong>Plazo:</strong> {paymentPlan.weeks} semana{paymentPlan.weeks > 1 ? 's' : ''}</p>
                                                    <p className="mb-0"><strong>Pago semanal aprox:</strong> {formatterCOP.format(paymentPlan.weeklyAmount)}</p>
                                                </div>
                                            )}
                                        </Col>
                                        <Col md={6} className="text-md-end">
                                            <h4 className="mb-0">Total: {formatterCOP.format(ventaPersonal.total)}</h4>
                                        </Col>
                                    </Row>
                                </>
                            )}
                        </TabPane>
                    </TabContent>
                </ModalBody>
                <ModalFooter>
                    {activeTab === 'anticipo' && <Button color="primary" onClick={handleSaveAnticipo} disabled={!anticipo.stylist_id || !anticipo.amountDigits}>Guardar Anticipo</Button>}
                    {activeTab === 'factura' && <Button color="primary" onClick={handleSaveFactura} disabled={!factura.reference || !factura.amountDigits}>Guardar Factura</Button>}
                    {activeTab === 'prestamo' && <Button color="primary" onClick={handleSavePrestamo} disabled={savingPrestamo || !prestamoSummary.isValid}>{savingPrestamo && <Spinner size="sm" className="me-2"/>} Guardar Préstamo</Button>}
                    {activeTab === 'venta_personal' && <Button color="primary" onClick={handleSaveVentaPersonal} disabled={savingVenta}>{savingVenta && <Spinner size="sm"/>} Guardar Venta</Button>}
                    <Button color="secondary" onClick={() => setPaymentsModalOpen(false)}>Cancelar</Button>
                </ModalFooter>
            </Modal>
            <ModalAbrirCaja isOpen={openModalOpen} onClose={() => setOpenModalOpen(false)} onSessionOpened={fetchCurrentSession} />
            <ModalResumenCierre isOpen={closeModalOpen} onClose={() => setCloseModalOpen(false)} onSessionClosed={fetchCurrentSession} sessionData={cashSession} />
        </Card>
    );
};

export default CentroDeCitasDiarias;