import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CountUp from 'react-countup';
import { api } from '../../services/api';
import { Spinner } from 'reactstrap';
import Swal from 'sweetalert2';

// --- INTERFACES Y TIPOS ---
interface WidgetData { label: string; icon: string; counter: number; prefix?: string; badge: string; separator?: string; duration?: number; }
interface Client { client_name: string; service_name: string; service_price: number; net_commission: number; admin_fee: number; }
interface InventoryItem { product_name: string; commission_value: number; }
interface Expense { description: string; amount: number; }
interface Stylist { id: string; name: string; avatar: string; netToPay: number; clients: Client[]; inventory: InventoryItem[]; expenses: Expense[]; }
interface ApiSummaryWidgets { cash: number; creditCard: number; inventorySold: number; stylistExpenses: number; }
interface ApiStylistDetail { stylist_id: string; stylist_name: string; net_paid: number; details: { services: Client[]; products: InventoryItem[]; expenses: Expense[]; } }

// --- FORMATEADOR Y COMPONENTES ---
const formatterCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0, minimumFractionDigits: 0 });

const BreadCrumb = ({ title, pageTitle, onBack }: { title: string, pageTitle: string, onBack?: () => void }) => (
    <div className="mb-4 d-flex align-items-center">
        {onBack && ( <button onClick={onBack} className="btn btn-light me-3" style={{ border: '1px solid #dee2e6' }}><i className="ri-arrow-left-line"></i> Volver</button> )}
        <div><h4>{title}</h4><p className="text-muted mb-0">Nómina / {pageTitle}</p></div>
    </div>
);

const PayrollWidgets = ({ summary }: { summary: ApiSummaryWidgets }) => {
    const widgetsData: WidgetData[] = [
        { label: "Total Efectivo", icon: "ri-cash-line", counter: summary.cash, prefix: "$", badge: "ri-arrow-up-s-line text-success", separator: "." },
        { label: "Total Tarjetas", icon: "ri-bank-card-line", counter: summary.creditCard, prefix: "$", badge: "ri-arrow-up-s-line text-success", separator: "." },
        { label: "Inventario Vendido", icon: "ri-shopping-bag-line", counter: summary.inventorySold, prefix: "$", badge: "ri-arrow-up-s-line text-success", separator: "." },
        { label: "Egresos Estilistas", icon: "ri-arrow-up-down-line", counter: Math.abs(summary.stylistExpenses), prefix: "$", badge: "ri-arrow-down-s-line text-danger", separator: "." },
    ];
    return (
        <div className="card crm-widget">
            <div className="card-body p-0"><div className="row row-cols-xl-4 row-cols-md-2 row-cols-1 g-0">
                {widgetsData.map((widget, index) => (
                    <div className="col" key={index}><div className="py-4 px-3">
                        <h5 className="text-muted text-uppercase fs-13">{widget.label}<i className={widget.badge + " fs-18 float-end align-middle"}></i></h5>
                        <div className="d-flex align-items-center">
                            <div className="flex-shrink-0"><i className={widget.icon + " fs-2 text-muted"}></i></div>
                            <div className="flex-grow-1 ms-3"><h2 className="mb-0"><span className="counter-value"><CountUp start={0} prefix={widget.prefix} separator={widget.separator} end={widget.counter || 0} duration={2} decimals={0}/></span></h2></div>
                        </div></div></div>
                ))}
            </div></div></div>
    );
};

const TabPagination = ({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (page: number) => void }) => {
    if (totalPages <= 1) {
        return null;
    }
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
    return (
        <nav className="mt-2">
            <ul className="pagination pagination-sm justify-content-end mb-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <a className="page-link" href="#!" onClick={(e) => { e.preventDefault(); onPageChange(currentPage - 1); }}>‹</a>
                </li>
                {pageNumbers.map(number => (
                    <li key={number} className={`page-item ${currentPage === number ? 'active' : ''}`}>
                        <a onClick={(e) => { e.preventDefault(); onPageChange(number); }} href="#!" className="page-link">{number}</a>
                    </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <a className="page-link" href="#!" onClick={(e) => { e.preventDefault(); onPageChange(currentPage + 1); }}>›</a>
                </li>
            </ul>
        </nav>
    );
};

// --- VISTA DE VISTA PREVIA ---
const PayrollPreview = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [allStylistsData, setAllStylistsData] = useState<Stylist[]>([]);
    const [periodSummary, setPeriodSummary] = useState<ApiSummaryWidgets | null>(null);
    const [selectedStylist, setSelectedStylist] = useState<Stylist | null>(null);
    const [activeTab, setActiveTab] = useState('clients');
    const [servicesPage, setServicesPage] = useState(1);
    const [productsPage, setProductsPage] = useState(1);
    const [expensesPage, setExpensesPage] = useState(1);
    
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    useEffect(() => {
        if (!startDateParam || !endDateParam) {
            Swal.fire('Error', 'No se especificó un período de fechas.', 'error').then(() => navigate('/payroll'));
            return;
        }

        const fetchDetailedPreviewData = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await api.get<{ summary_widgets: ApiSummaryWidgets, stylist_breakdowns: ApiStylistDetail[] }>(`/payrolls/detailed-preview?start_date=${startDateParam}&end_date=${endDateParam}`);
                const { summary_widgets, stylist_breakdowns } = response.data;

                const formattedStylists: Stylist[] = stylist_breakdowns.map(s => {
                    const nameParts = s.stylist_name.split(' ');
                    const initials = `${nameParts[0][0]}${nameParts.length > 1 ? nameParts[1][0] : ''}`.toUpperCase();
                    return {
                        id: s.stylist_id,
                        name: s.stylist_name,
                        netToPay: s.net_paid,
                        avatar: `https://placehold.co/100x100/EFEFEF/333333?text=${initials}`,
                        clients: s.details.services,
                        inventory: s.details.products,
                        expenses: s.details.expenses,
                    };
                });
                
                setPeriodSummary(summary_widgets);
                setAllStylistsData(formattedStylists);
                
                if (formattedStylists.length > 0) {
                    setSelectedStylist(formattedStylists[0]);
                }
            } catch (err: any) {
                const errorMsg = err.response?.data?.error || "No se pudo cargar el detalle de la nómina.";
                setError(errorMsg);
            } finally {
                setLoading(false);
            }
        };

        fetchDetailedPreviewData();
    }, [startDateParam, endDateParam, navigate]);

    const handleGenerateAndSave = async () => {
        if (!startDateParam || !endDateParam || allStylistsData.length === 0) return;
        const result = await Swal.fire({
            title: `¿Confirmas la generación de esta nómina?`,
            text: `Se guardarán los pagos para ${allStylistsData.length} estilista(s). Esta acción no se puede deshacer.`,
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, generar y guardar', cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            setIsSaving(true);
            try {
                const savePromises = allStylistsData.map(stylist => api.post('/payrolls', { stylist_id: stylist.id, start_date: startDateParam, end_date: endDateParam }));
                await Promise.all(savePromises);
                await Swal.fire('¡Guardado!', 'El lote de nómina ha sido generado correctamente.', 'success');
                navigate('/payroll');
            } catch (err) {
                console.error("Error saving payroll:", err);
                Swal.fire('Error', 'Ocurrió un error al guardar la nómina.', 'error');
            } finally { setIsSaving(false); }
        }
    };

    const handleBack = () => navigate('/payroll');
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [displayCount, setDisplayCount] = useState(6);
    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (container) {
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 1;
            if (isAtBottom && displayCount < allStylistsData.length) {
                const newCount = Math.min(displayCount + 4, allStylistsData.length);
                setDisplayCount(newCount);
            }
        }
    };
    const visibleStylists = allStylistsData.slice(0, displayCount);

    const ITEMS_PER_PAGE = 5;

    // Paginación para Servicios
    const totalServicePages = selectedStylist ? Math.ceil(selectedStylist.clients.length / ITEMS_PER_PAGE) : 0;
    const currentServices = selectedStylist?.clients.slice((servicesPage - 1) * ITEMS_PER_PAGE, servicesPage * ITEMS_PER_PAGE) || [];
    
    // Paginación para Productos
    const totalProductPages = selectedStylist ? Math.ceil(selectedStylist.inventory.length / ITEMS_PER_PAGE) : 0;
    const currentProducts = selectedStylist?.inventory.slice((productsPage - 1) * ITEMS_PER_PAGE, productsPage * ITEMS_PER_PAGE) || [];

    // Paginación para Egresos
    const totalExpensePages = selectedStylist ? Math.ceil(selectedStylist.expenses.length / ITEMS_PER_PAGE) : 0;
    const currentExpenses = selectedStylist?.expenses.slice((expensesPage - 1) * ITEMS_PER_PAGE, expensesPage * ITEMS_PER_PAGE) || [];

    const totalPayroll = allStylistsData.reduce((sum, stylist) => sum + stylist.netToPay, 0);
    const periodTitle = startDateParam && endDateParam ? `Período del ${startDateParam} al ${endDateParam}` : "Detalle de Período";

    if (loading) { return <div className="page-content text-center"><Spinner style={{ width: '3rem', height: '3rem' }} /><h4>Calculando nómina...</h4></div>; }
    if (error) { return <div className="page-content text-center"><div className="alert alert-danger">{error}</div></div>; }

    return (
        <div className="page-content" style={{ padding: '20px', backgroundColor: '#f5f7fa' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <BreadCrumb title="Vista Previa de Nómina" pageTitle={periodTitle} onBack={handleBack} />
                {periodSummary && <PayrollWidgets summary={periodSummary} />}
                <div className="card mt-4">
                    <div className="card-body"><div className="row">
                        <div className="col-md-4">
                            <h5 className="card-title mb-3">Estilistas</h5>
                            <div ref={scrollContainerRef} onScroll={handleScroll} className="list-group" style={{ maxHeight: '425px', overflowY: 'auto' }}>
                                {visibleStylists.map(stylist => (
                                    <a href="#!" key={stylist.id} 
                                       className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selectedStylist?.id === stylist.id ? 'active' : ''}`} 
                                       onClick={(e) => { 
                                           e.preventDefault(); 
                                           setSelectedStylist(stylist);
                                           setServicesPage(1);
                                           setProductsPage(1);
                                           setExpensesPage(1);
                                           setActiveTab('clients');
                                       }}>
                                        <div className="d-flex align-items-center">
                                            <img src={stylist.avatar} alt={stylist.name} className="rounded-circle me-3" style={{ width: '40px', height: '40px' }}/>
                                            <span>{stylist.name}</span>
                                        </div>
                                        <span className={`badge ${selectedStylist?.id === stylist.id ? 'bg-white text-primary' : 'bg-light text-dark'}`}>{formatterCOP.format(stylist.netToPay)}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                        <div className="col-md-8">
                            {selectedStylist ? (
                                <div>
                                    <h5 className="card-title mb-3">Detalle de: {selectedStylist.name}</h5>
                                    <ul className="nav nav-tabs">
                                        <li className="nav-item"><a className={`nav-link ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveTab('clients')} href="#!">Clientes Atendidos ({selectedStylist.clients.length})</a></li>
                                        <li className="nav-item"><a className={`nav-link ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')} href="#!">Comisión Inventario ({selectedStylist.inventory.length})</a></li>
                                        <li className="nav-item"><a className={`nav-link ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')} href="#!">Egresos ({selectedStylist.expenses.length})</a></li>
                                    </ul>
                                    <div className="tab-content p-3 border border-top-0">
                                        {activeTab === 'clients' && (
                                            <div>
                                                <table className="table" style={{minHeight: "220px"}}>
                                                    <thead>
                                                        <tr>
                                                            <th>Cliente</th>
                                                            <th>Servicio</th>
                                                            <th className='text-end'>Precio Servicio</th>
                                                            <th className='text-end'>Comisión Neta Ganada</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {currentServices.map((c: Client, index: number) => (
                                                            <tr key={`client-${index}`}>
                                                                <td>{c.client_name}</td>
                                                                <td>{c.service_name}</td>
                                                                <td className='text-end'>{formatterCOP.format(c.service_price)}</td>
                                                                <td className='text-end fw-bold text-success'>
                                                                    {formatterCOP.format(c.net_commission)}
                                                                    {c.admin_fee > 0 && 
                                                                        <p className='text-muted fw-normal mb-0' style={{fontSize: '11px'}}>
                                                                            (Desc. Admin: -{formatterCOP.format(c.admin_fee)})
                                                                        </p>
                                                                    }
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {selectedStylist.clients.length === 0 && (
                                                            <tr><td colSpan={4} className="text-center text-muted pt-4">No hay servicios en este período.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                                <TabPagination currentPage={servicesPage} totalPages={totalServicePages} onPageChange={setServicesPage} />
                                            </div>
                                        )}
                                        {activeTab === 'inventory' && (
                                            <div>
                                                <table className="table" style={{minHeight: "220px"}}>
                                                    <thead><tr><th>Producto</th><th className='text-end'>Comisión Ganada</th></tr></thead>
                                                    <tbody>
                                                        {currentProducts.map((p: InventoryItem, index: number) => (
                                                            <tr key={`product-${index}`}>
                                                                <td>{p.product_name}</td>
                                                                <td className='text-end'>{formatterCOP.format(p.commission_value)}</td>
                                                            </tr>
                                                        ))}
                                                        {selectedStylist.inventory.length === 0 && <tr><td colSpan={2} className="text-center text-muted pt-4">No hay productos vendidos en este período.</td></tr>}
                                                    </tbody>
                                                </table>
                                                <TabPagination currentPage={productsPage} totalPages={totalProductPages} onPageChange={setProductsPage} />
                                            </div>
                                        )}
                                        {activeTab === 'expenses' && (
                                            <div>
                                                <table className="table" style={{minHeight: "220px"}}>
                                                    <thead><tr><th>Descripción</th><th className='text-end'>Monto</th></tr></thead>
                                                    <tbody>
                                                        {currentExpenses.map((e: Expense, index: number) => (
                                                            <tr key={`expense-${index}`}>
                                                                <td>{e.description}</td>
                                                                <td className='text-end text-danger'>-{formatterCOP.format(e.amount)}</td>
                                                            </tr>
                                                        ))}
                                                        {selectedStylist.expenses.length === 0 && <tr><td colSpan={2} className="text-center text-muted pt-4">No hay egresos en este período.</td></tr>}
                                                    </tbody>
                                                </table>
                                                <TabPagination currentPage={expensesPage} totalPages={totalExpensePages} onPageChange={setExpensesPage} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center p-5"><p className="text-muted">Selecciona un estilista para ver sus detalles.</p></div>
                            )}
                        </div>
                    </div></div>
                </div>
                <div className="card mt-4">
                    <div className="card-body d-flex justify-content-between align-items-center">
                        <div><h4 className="card-title mb-0">Total a Pagar de Nómina</h4><p className="text-muted mb-0">Costo total para el salón en este período.</p></div>
                        <div className="text-end">
                            <h2 className="text-success me-3 d-inline-block align-middle">{formatterCOP.format(totalPayroll)}</h2>
                            <button className="btn btn-light me-2" onClick={handleBack}>Volver al Listado</button>
                            <button className="btn btn-success" onClick={handleGenerateAndSave} disabled={isSaving || allStylistsData.length === 0}>
                                {isSaving ? <Spinner size="sm" className="me-2"/> : <i className="ri-save-line me-1"></i>}
                                {isSaving ? 'Guardando...' : 'Generar y Guardar Nómina'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayrollPreview;