import React, { useEffect, useMemo, useState, ChangeEvent } from "react";
import {
  Container, Row, Col, Card, CardBody, Label, Input, Button, Badge,
  Spinner, InputGroup, Modal, ModalHeader, ModalBody, ModalFooter, Table, UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem
} from "reactstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import Select from 'react-select';
import Swal from 'sweetalert2';
import CurrencyInput from 'react-currency-input-field';
import Flatpickr from "react-flatpickr";

import BreadCrumb from "../../Components/Common/BreadCrumb";
import { AppDispatch, RootState } from "../../index";
import { api } from "../../services/api";
import { getCalendarData } from "../../slices/thunks";

// --- Tipos de Datos ---
type ClientOption = { value: string; label: string; data: any; };
type ProductOption = { value: string; label: string; data: any; };
type StylistOption = { value: string; label: string; };
type ServiceItem = { id: string; name: string; price: number; stylist: string; status: string; };
type ProductItem = { id: string; name: string; price: number; quantity: number; stock: number; seller_id: string; seller_name: string; };
type Cart = { services: ServiceItem[]; products: ProductItem[]; };
type LocationState = { clientId?: string; appointmentIds?: string[]; };

const formatterCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0, minimumFractionDigits: 0 });

const statusColor = (s: string) =>
  s === "checked_in" ? "info" :
  s === "checked_out" ? "warning" :
  s === "completed" ? "success" :
  s === "cancelled" || s === "rescheduled" ? "danger" : "secondary";
const statusLabel: Record<string, string> = {
  scheduled: "Agendado", rescheduled: "Reagendado",
  checked_in: "Check-in", checked_out: "Finalizado",
  completed: "Pagado", cancelled: "Cancelado",
};

const PointOfSale = () => {
    const navigate = useNavigate();
    const dispatch: AppDispatch = useDispatch();
    const location = useLocation();
    const locationState = location.state as LocationState | undefined;

    const { events: calendarEvents, clients: allClients } = useSelector((state: RootState) => state.Calendar);

    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [stylists, setStylists] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
    const [cart, setCart] = useState<Cart>({ services: [], products: [] });
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [cashText, setCashText] = useState<string>("");
    const [cardText, setCardText] = useState<string>("");
    const [cardVoucher, setCardVoucher] = useState<string>("");
    const [useCard, setUseCard] = useState<boolean>(false);
    const [newClientModalOpen, setNewClientModalOpen] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
    const [paymentSuccess, setPaymentSuccess] = useState<any | null>(null);
    
    const [resModalOpen, setResModalOpen] = useState(false);
    const [resItem, setResItem] = useState<ServiceItem | null>(null);
    const [resDateTime, setResDateTime] = useState<string>("");
    
    const [productToAdd, setProductToAdd] = useState<{ product: ProductOption | null; seller: StylistOption | null }>({ product: null, seller: null });

    const isSaleFromAppointment = !!(locationState?.clientId && locationState?.appointmentIds);

    useEffect(() => {
        const fetchPrerequisites = async () => {
            setLoading(true);
            try {
                const productsPromise = api.get('/products?audience=cliente');
                const stylistsPromise = api.get('/stylists');
                if (!allClients || allClients.length === 0) { dispatch(getCalendarData()); }
                const [productsRes, stylistsRes] = await Promise.all([productsPromise, stylistsPromise]);
                setAvailableProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
                setStylists(Array.isArray(stylistsRes.data) ? stylistsRes.data : []);
            } catch (error) {
                console.error("Error al cargar datos iniciales:", error);
                Swal.fire("Error", "No se pudieron cargar los datos necesarios.", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchPrerequisites();
    }, [dispatch, allClients]);

    const clientOptions = useMemo<ClientOption[]>(() => 
        (allClients || []).map((client: any) => ({ value: client.id, label: `${client.first_name || ''} ${client.last_name || ''} (${client.phone || 'Sin teléfono'})`, data: client })),
    [allClients]);

    useEffect(() => {
        if (isSaleFromAppointment && allClients.length > 0 && calendarEvents.length > 0) {
            const clientToSelect = clientOptions.find(c => c.value === locationState.clientId);
            if (clientToSelect) { setSelectedClient(clientToSelect); }
            
            const servicesToLoad: ServiceItem[] = (locationState.appointmentIds || [])
              .map(id => calendarEvents.find((event: any) => String(event.id) === String(id)))
              .filter(Boolean)
              .map((event: any) => ({
                id: event.id, name: event.extendedProps.service_name || "Servicio",
                price: Number(event.extendedProps.price || 0), stylist: event.extendedProps.stylist_first_name || 'N/A',
                status: event.extendedProps.status || 'scheduled'
              }));
              
            setCart(prev => ({ ...prev, services: servicesToLoad }));
        }
    }, [locationState, allClients, calendarEvents, clientOptions, isSaleFromAppointment]);

    document.title = "Punto de Venta | StyleApp";

    const productOptions = useMemo<ProductOption[]>(() =>
        availableProducts.map(p => ({ value: p.id, label: `${p.name} - ${formatterCOP.format(p.sale_price)}`, data: p })),
    [availableProducts]);

    const stylistOptions = useMemo<StylistOption[]>(() => 
        stylists.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name || ''}` })),
    [stylists]);

    const defaultSeller = useMemo<StylistOption | null>(() => {
        const serviceStylistIds = new Set(cart.services.map(s => calendarEvents.find((e: any) => String(e.id) === s.id)?.extendedProps.stylist_id).filter(Boolean));
        if (serviceStylistIds.size === 1) {
            const singleStylistId = Array.from(serviceStylistIds)[0];
            return stylistOptions.find(opt => opt.value === singleStylistId) || null;
        }
        return null;
    }, [cart.services, calendarEvents, stylistOptions]);
    
    useEffect(() => {
        if(defaultSeller) {
            setProductToAdd(prev => ({...prev, seller: defaultSeller}));
        } else {
            setProductToAdd(prev => ({...prev, seller: null}));
        }
    }, [defaultSeller]);

    const addProductToCart = () => {
        if (!productToAdd.product || !productToAdd.seller) return;
        const product = productToAdd.product.data;
        
        setCart(prev => {
            const existing = prev.products.find(p => p.id === product.id);
            if (existing) {
                const newQuantity = Math.min(existing.stock, existing.quantity + 1);
                return { ...prev, products: prev.products.map(p => p.id === product.id ? { ...p, quantity: newQuantity } : p) };
            }
            return { ...prev, products: [...prev.products, { id: product.id, name: product.name, price: product.sale_price, quantity: 1, stock: product.stock, seller_id: productToAdd.seller!.value, seller_name: productToAdd.seller!.label }] };
        });
        setProductToAdd({ product: null, seller: defaultSeller });
    };
    
    const handleQuantityChange = (productId: string, newQuantity: number) => {
        setCart(prev => ({...prev, products: prev.products.map(p => {
                if (p.id === productId) {
                    const validatedQty = Math.max(1, Math.min(p.stock, newQuantity || 1));
                    return { ...p, quantity: validatedQty };
                }
                return p;
            })
        }));
    };

    const removeCartItem = (type: 'service' | 'product', id: string) => {
        setCart(prev => ({...prev, [type === 'service' ? 'services' : 'products']: prev[type === 'service' ? 'services' : 'products'].filter((item: any) => item.id !== id) }));
    };

    const handleServiceStatusChange = async (serviceId: string, newStatus: string) => {
        setUpdatingStatus(prev => ({ ...prev, [serviceId]: true }));
        try {
            if (newStatus === 'checked_in') await api.patch(`/appointments/${serviceId}/checkin`);
            else if (newStatus === 'checked_out') await api.patch(`/appointments/${serviceId}/checkout`);
            else await api.patch(`/appointments/${serviceId}/status`, { status: newStatus });
            
            setCart(prev => ({...prev, services: prev.services.map(s => s.id === serviceId ? { ...s, status: newStatus } : s) }));
            dispatch(getCalendarData());
        } catch (e) {
            Swal.fire("Error", `No se pudo cambiar el estado del servicio.`, "error");
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [serviceId]: false }));
        }
    };

    const openRescheduleModal = (item: ServiceItem) => {
        setResItem(item);
        const now = new Date();
        now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1);
        const pad = (n: number) => String(n).padStart(2, "0");
        const isoLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        setResDateTime(isoLocal);
        setResModalOpen(true);
    };

    const submitReschedule = async () => {
        if (!resItem || !resDateTime) return;
        setUpdatingStatus(prev => ({ ...prev, [resItem.id]: true }));
        try {
            await api.patch(`/appointments/${resItem.id}/reschedule`, { start_time: new Date(resDateTime).toISOString() });
            setCart(prev => ({...prev, services: prev.services.map(s => s.id === resItem.id ? { ...s, status: 'rescheduled' } : s) }));
            dispatch(getCalendarData());
            setResModalOpen(false);
        } catch(e) {
            Swal.fire("Error", "No se pudo reagendar la cita.", "error");
        } finally {
            setUpdatingStatus(prev => ({ ...prev, [resItem.id]: false }));
        }
    };

    const servicesReadyForPayment = useMemo(() => cart.services.filter(s => s.status === 'checked_out'), [cart.services]);
    const total = useMemo(() => {
        const servicesTotal = servicesReadyForPayment.reduce((sum, item) => sum + item.price, 0);
        const productsTotal = cart.products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return servicesTotal + productsTotal;
    }, [cart.products, servicesReadyForPayment]);

    const cashAmountNum = Number(cashText) || 0;
    const cardAmountNum = Number(cardText) || 0;
    const paidTotal = cashAmountNum + (useCard ? cardAmountNum : 0);
    const change = paidTotal - total;
    const canPay = selectedClient && total > 0 && paidTotal >= total && !isProcessingPayment;

    const handlePayNow = async () => {
        setIsProcessingPayment(true);
        try {
            const payments = [];
            if (cashAmountNum > 0) payments.push({ payment_method: 'cash', amount: cashAmountNum });
            if (useCard && cardAmountNum > 0) payments.push({ payment_method: 'credit_card', amount: cardAmountNum, voucher: cardVoucher });

            const payload = {
                client_id: selectedClient?.value,
                services: servicesReadyForPayment.map(s => s.id),
                products: cart.products.map(p => ({ 
                    product_id: p.id, 
                    quantity: p.quantity, 
                    seller_id: p.seller_id 
                })),
                payments: payments
            };
            
          const response = await api.post('/payments', payload);
            await dispatch(getCalendarData());
            setPaymentSuccess({ invoiceId: response.data.invoiceId, change: change });

        } catch (e: any) {
            Swal.fire('Error en el Pago', e?.response?.data?.error || e.message || 'Ocurrió un error inesperado.', 'error');
        } finally {
            setIsProcessingPayment(false);
        }
    };

    if (loading) {
        return (<div className="page-content"><Container fluid><div className="text-center p-5"><Spinner /> <span className="ms-2 fs-5">Cargando...</span></div></Container></div>);
    }
    
    return (
        <div className="page-content">
            <Container fluid>
                <BreadCrumb title="Punto de Venta" pageTitle="Caja" />

                {paymentSuccess ? (
                    <Row>
                        <Col xl={{ size: 8, offset: 2 }}>
                            <Card>
                                <CardBody className="text-center py-5">
                                    <i className="ri-checkbox-circle-line display-4 text-success mb-4"></i>
                                    <h5>¡Pago Completado!</h5>
                                    <p className="text-muted">La venta se ha registrado correctamente.</p>
                                    <h3 className="fw-semibold">
                                        Factura ID: <span className="text-primary text-decoration-underline">{paymentSuccess.invoiceId}</span>
                                    </h3>
                                    {paymentSuccess.change > 0 && (
                                        <h4 className="fw-semibold mt-3">
                                            Cambio: <span className="text-info">{formatterCOP.format(paymentSuccess.change)}</span>
                                        </h4>
                                    )}
                                    <div className="mt-4">
                                        <Button color="success" onClick={() => navigate("/calendar")}>Volver al Calendario</Button>
                                    </div>
                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                ) : (
                <Row>
                    <Col xl={7}>
                        <Card>
                            <CardBody>
                                <div className="d-flex justify-content-between align-items-center mb-4">
                                    <div className="d-flex align-items-center gap-2"><h4 className="mb-0">Punto de Venta</h4></div>
                                    <Button color="soft-secondary" onClick={() => navigate("/calendar")} title="Volver al Calendario"><i className="ri-calendar-line me-1"></i> Volver al Calendario</Button>
                                </div>
                                <div className="mb-4">
                                    <div className="d-flex align-items-center mb-3"><span className="me-2 text-primary fw-bold">1</span><h5 className="mb-0">Cliente</h5></div>
                                    <InputGroup>
                                        <Select
                                            className="flex-grow-1"
                                            isClearable={!isSaleFromAppointment}
                                            isSearchable={!isSaleFromAppointment}
                                            placeholder={isSaleFromAppointment ? "Cliente de la cita" : "Busca un cliente..."}
                                            options={clientOptions}
                                            onChange={(option: ClientOption | null) => setSelectedClient(option)}
                                            value={selectedClient}
                                            isLoading={loading}
                                            isDisabled={isSaleFromAppointment}
                                        />
                                        {!isSaleFromAppointment && (
                                            <Button color="primary" outline onClick={() => setNewClientModalOpen(true)}><i className="ri-add-line"></i></Button>
                                        )}
                                    </InputGroup>
                                </div>
                                <div className="mb-4">
                                    <div className="d-flex align-items-center mb-3"><span className="me-2 text-primary fw-bold">2</span><h5 className="mb-0">Añadir Productos</h5></div>
                                    {/* --- LAYOUT CORREGIDO --- */}
                                    <Row className="g-2">
                                        <Col sm={5}>
                                            <Label>Producto</Label>
                                            <Select isSearchable placeholder="Busca un producto..." options={productOptions}
                                                value={productToAdd.product}
                                                onChange={(opt: ProductOption | null) => setProductToAdd(prev => ({...prev, product: opt}))}
                                                isDisabled={!selectedClient} 
                                            />
                                        </Col>
                                        <Col sm={5}>
                                            <Label>Vendido por</Label>
                                            <Select isSearchable placeholder="Selecciona estilista..." options={stylistOptions}
                                                value={productToAdd.seller}
                                                onChange={(opt: StylistOption | null) => setProductToAdd(prev => ({...prev, seller: opt}))}
                                                isDisabled={!selectedClient} // <-- CORRECCIÓN: YA NO SE CONGELA
                                            />
                                        </Col>
                                        <Col sm={2} className="d-flex align-items-end">
                                            <Button color="primary" className="w-100" onClick={addProductToCart} disabled={!productToAdd.product || !productToAdd.seller}>Añadir</Button>
                                        </Col>
                                    </Row>
                                </div>
                                <div>
                                    <div className="d-flex align-items-center mb-3"><span className="me-2 text-primary fw-bold">3</span><h5 className="mb-0">Método de Pago</h5></div>
                                    <Card className="p-3 border shadow-none"><Row className="gy-3">
                                        <Col md={6}><h6 className="mb-2">Paga con efectivo</h6><Label className="form-label">Ingresa el monto</Label><CurrencyInput className="form-control" placeholder="$ 0" value={cashText} onValueChange={(value) => setCashText(value || "")} prefix="$ " groupSeparator="." decimalSeparator="," /></Col>
                                        <Col md={6}><div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Paga con tarjeta</h6><div className="form-check form-switch m-0"><Input className="form-check-input" type="checkbox" id="useCard" checked={useCard} onChange={(e) => setUseCard(e.target.checked)} /></div></div><Label className="form-label">Nº de voucher</Label><Input value={cardVoucher} onChange={(e) => setCardVoucher(e.target.value)} placeholder="Ej: 123456" disabled={!useCard} /><Label className="form-label mt-2">Monto tarjeta</Label><CurrencyInput className="form-control" placeholder="$ 0" value={cardText} onValueChange={(value) => setCardText(value || "")} prefix="$ " groupSeparator="." decimalSeparator="," disabled={!useCard} /></Col>
                                    </Row></Card>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>

                    <Col xl={5}>
                        <Card>
                            <CardBody>
                                <div className="d-flex align-items-center mb-3"><h5 className="card-title mb-0 flex-grow-1">Resumen de la Venta</h5><Badge color="dark" pill>{cart.services.length + cart.products.length} Ítems</Badge></div>
                                <div className="table-responsive table-card" style={{minHeight: "150px"}}>
                                    {cart.services.length === 0 && cart.products.length === 0 ? (<p className="text-center text-muted p-4">El carrito está vacío.</p>) : (
                                    <Table borderless className="align-middle mb-0">
                                        <thead className="table-light text-muted"><tr><th>Descripción</th><th style={{width: 140}}>Estado/Cantidad</th><th className="text-end">Total</th><th></th></tr></thead>
                                        <tbody>
                                            {cart.services.map(item => {
                                                const isBusy = !!updatingStatus[item.id];
                                                let buttonText = statusLabel[item.status] || item.status;
                                                let buttonAction = () => {};
                                                let buttonDisabled = true;

                                                if(item.status === 'scheduled') { buttonText = "Hacer Check-in"; buttonAction = () => handleServiceStatusChange(item.id, 'checked_in'); buttonDisabled = false; }
                                                else if (item.status === 'checked_in') { buttonText = "Finalizar"; buttonAction = () => handleServiceStatusChange(item.id, 'checked_out'); buttonDisabled = false; }

                                                return (
                                                    <tr key={`s-${item.id}`}>
                                                        <td><span className="fw-semibold">{item.name}</span><small className="d-block text-muted">(Servicio con {item.stylist})</small></td>
                                                        <td>
                                                            <div className="d-flex align-items-center gap-1">
                                                                <Button size="sm" color={statusColor(item.status)} onClick={buttonAction} disabled={buttonDisabled || isBusy} className="flex-grow-1">{isBusy ? <Spinner size="sm" /> : buttonText}</Button>
                                                                <UncontrolledDropdown>
                                                                    <DropdownToggle tag="button" className="btn btn-sm btn-soft-secondary"><i className="ri-more-2-fill"></i></DropdownToggle>
                                                                    <DropdownMenu>
                                                                        <DropdownItem onClick={() => openRescheduleModal(item)} disabled={isBusy || item.status === 'completed'}>Reagendar</DropdownItem>
                                                                        <DropdownItem onClick={() => handleServiceStatusChange(item.id, 'cancelled')} disabled={isBusy || item.status === 'completed' || item.status === 'cancelled'}>Cancelar Cita</DropdownItem>
                                                                    </DropdownMenu>
                                                                </UncontrolledDropdown>
                                                            </div>
                                                        </td>
                                                        <td className="text-end">{formatterCOP.format(item.price)}</td>
                                                        <td><Button close size="sm" onClick={() => removeCartItem('service', item.id)}/></td>
                                                    </tr>
                                                );
                                            })}
                                            {cart.products.map(item => (
                                                <tr key={`p-${item.id}`}>
                                                    <td><span className="fw-semibold">{item.name}</span><small className="d-block text-muted">Vendido por: {item.seller_name}</small></td>
                                                    <td>
                                                        <InputGroup size="sm" style={{width: "110px"}}>
                                                            <Button outline color="primary" onClick={() => handleQuantityChange(item.id, item.quantity - 1)}>-</Button>
                                                            <Input type="number" className="text-center" value={item.quantity} onChange={(e: ChangeEvent<HTMLInputElement>) => handleQuantityChange(item.id, parseInt(e.target.value, 10))} min={1} max={item.stock} />
                                                            <Button outline color="primary" onClick={() => handleQuantityChange(item.id, item.quantity + 1)}>+</Button>
                                                        </InputGroup>
                                                    </td>
                                                    <td className="text-end">{formatterCOP.format(item.price * item.quantity)}</td>
                                                    <td><Button close size="sm" onClick={() => removeCartItem('product', item.id)}/></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                    )}
                                </div>
                                <hr />
                                <div className="d-flex justify-content-between"><span>Subtotal (Todos los ítems):</span><span className="fw-medium">{formatterCOP.format(cart.services.reduce((s,i)=>s+i.price,0) + cart.products.reduce((s,i)=>s+(i.price*i.quantity),0))}</span></div>
                                <div className="d-flex justify-content-between text-success"><strong>Total a Pagar (solo finalizados):</strong><strong className="text-success">{formatterCOP.format(total)}</strong></div>
                                <hr className="my-2"/>
                                <div className="d-flex justify-content-between fs-5"><strong>Pagado:</strong><strong>{formatterCOP.format(paidTotal)}</strong></div>
                                {change > 0 && <div className="d-flex justify-content-between text-info"><span>Cambio:</span><span>{formatterCOP.format(change)}</span></div>}
                                <div className="d-grid mt-3"><Button color="primary" size="lg" disabled={!canPay} onClick={handlePayNow}>{isProcessingPayment && <Spinner size="sm" className="me-2"/>}Pagar Ahora</Button></div>
                            </CardBody>
                        </Card>
                    </Col>
                </Row>
                )}
            </Container>

            <Modal isOpen={newClientModalOpen} toggle={() => setNewClientModalOpen(false)} centered>
                <ModalHeader toggle={() => setNewClientModalOpen(false)}>Crear Nuevo Cliente</ModalHeader>
                <ModalBody><p>Aquí irá el formulario para crear un nuevo cliente rápidamente.</p></ModalBody>
                <ModalFooter><Button color="light" onClick={() => setNewClientModalOpen(false)}>Cancelar</Button><Button color="primary">Guardar Cliente</Button></ModalFooter>
            </Modal>
            
            <Modal isOpen={resModalOpen} toggle={() => setResModalOpen(false)} centered>
                <ModalHeader toggle={() => setResModalOpen(false)}>Reagendar Cita: {resItem?.name}</ModalHeader>
                <ModalBody>
                    <Label>Nueva fecha y hora</Label>
                    <Flatpickr 
                        className="form-control" 
                        options={{enableTime: true, dateFormat: "Y-m-d H:i", minDate: "today"}}
                        value={resDateTime} 
                        onChange={([date]) => setResDateTime(new Date(date).toISOString())} 
                    />
                </ModalBody>
                <ModalFooter>
                    <Button color="light" onClick={() => setResModalOpen(false)}>Cancelar</Button>
                    <Button color="primary" onClick={submitReschedule}>Guardar</Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default PointOfSale;