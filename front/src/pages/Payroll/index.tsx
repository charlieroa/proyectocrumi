import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/themes/material_blue.css";
import { api } from '../../services/api';
import { Spinner } from 'reactstrap';

// --- INTERFACES Y TIPOS ---
interface ApiPaymentRecord {
    stylist_id: string;
    start_date: string;
    end_date: string;
    payment_date: string;
    total_paid: number;
    deductions?: number;
    net_paid?: number;
    commission_rate_snapshot: number;
    first_name: string;
    last_name?: string;
}

interface PayrollPeriod {
    id: string;
    startDate: string;
    endDate: string;
    paymentDate: string;
    totalPaid: number;
    stylistCount: number;
    details: PayrollDetail[];
}

interface PayrollDetail {
    stylistId: string;
    stylistName: string;
    avatar: string;
    grossTotal: number;
    deductions: number;
    netPaid: number;
    commissionRateSnapshot: number;
}

// --- FORMATEADOR Y COMPONENTES ---
const formatterCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0, minimumFractionDigits: 0 });

const BreadCrumb = ({ title, pageTitle }: { title: string, pageTitle: string }) => (
    <div className="mb-4">
        <h4>{title}</h4>
        <p className="text-muted mb-0">Nómina / {pageTitle}</p>
    </div>
);

// --- VISTA DE LISTA ---
const PayrollList = () => {
    const navigate = useNavigate();
    const [dateRange, setDateRange] = useState<Date[]>([]);
    const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [dateWarning, setDateWarning] = useState<string>('');

    useEffect(() => {
        const fetchPayrollHistory = async () => {
            try {
                setLoading(true);
                const response = await api.get<ApiPaymentRecord[]>('/payrolls');
                const individualPayments = response.data;

                const groupedByPeriod = individualPayments.reduce((acc: Record<string, PayrollPeriod>, payment: ApiPaymentRecord) => {
                    const periodKey = `${payment.start_date}-${payment.end_date}`;
                    if (!acc[periodKey]) {
                        acc[periodKey] = {
                            id: periodKey,
                            startDate: payment.start_date,
                            endDate: payment.end_date,
                            paymentDate: payment.payment_date,
                            totalPaid: 0,
                            stylistCount: 0,
                            details: [],
                        };
                    }

                    acc[periodKey].totalPaid += Number(payment.total_paid);
                    acc[periodKey].details.push({
                        stylistId: payment.stylist_id,
                        stylistName: `${payment.first_name} ${payment.last_name || ''}`.trim(),
                        avatar: `https://placehold.co/100x100/EFEFEF/333333?text=${payment.first_name[0]}${payment.last_name ? payment.last_name[0] : ''}`,
                        grossTotal: Number(payment.total_paid),
                        deductions: Number(payment.deductions) || 0,
                        netPaid: Number(payment.net_paid) || Number(payment.total_paid),
                        commissionRateSnapshot: Number(payment.commission_rate_snapshot),
                    });
                    
                    return acc;
                }, {} as Record<string, PayrollPeriod>);
                
                Object.values(groupedByPeriod).forEach((period: PayrollPeriod) => {
                    period.stylistCount = new Set(period.details.map((d: PayrollDetail) => d.stylistId)).size;
                });

                const finalPeriods = Object.values(groupedByPeriod).sort((a: PayrollPeriod, b: PayrollPeriod) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
                
                setPeriods(finalPeriods);
                setError(null);
            } catch (err) {
                console.error("Error fetching payroll history:", err);
                setError("No se pudo cargar el historial de nóminas.");
            } finally {
                setLoading(false);
            }
        };

        fetchPayrollHistory();
    }, []);

    useEffect(() => {
        if (dateRange.length < 2) {
            setDateWarning('');
            return;
        }

        const selectedStart = dateRange[0].getTime();
        const selectedEnd = dateRange[1].getTime();

        const hasOverlap = periods.some(period => {
            const existingStart = new Date(period.startDate).getTime();
            const existingEnd = new Date(period.endDate).getTime();
            return selectedStart <= existingEnd && selectedEnd >= existingStart;
        });

        if (hasOverlap) {
            setDateWarning('El rango de fechas seleccionado se superpone con un período de nómina ya generado.');
        } else {
            setDateWarning('');
        }

    }, [dateRange, periods]);

    const handleGenerateClick = () => {
        if (dateWarning) {
            alert(dateWarning);
            return;
        }
        if (dateRange.length < 2) {
            alert("Por favor, selecciona un rango de fechas completo.");
            return;
        }
        const start = dateRange[0];
        const end = dateRange[1];
        if (start > end) {
            alert("La fecha de inicio no puede ser posterior a la fecha de fin.");
            return;
        }
        const startDateStr = start.toISOString().split('T')[0];
        const endDateStr = end.toISOString().split('T')[0];
        navigate(`/payroll/preview?startDate=${startDateStr}&endDate=${endDateStr}`);
    };
    
    const handleViewDetails = (period: PayrollPeriod) => {
        const startDateStr = period.startDate.split('T')[0];
        const endDateStr = period.endDate.split('T')[0];
        navigate(`/payroll/preview?startDate=${startDateStr}&endDate=${endDateStr}`);
    };

    const itemsPerPage = 4;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPeriods = periods.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(periods.length / itemsPerPage);

    const paginate = (pageNumber: number) => {
        if (pageNumber > 0 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    return (
        <>
            <BreadCrumb title="Nómina" pageTitle="Nómina" />
            <div className="card mb-4">
                <div className="card-header"><h4 className="card-title mb-0">Crear Nueva Nómina</h4></div>
                <div className="card-body">
                    <div className="row g-3 align-items-end">
                        <div className="col-md-9">
                            <label className="form-label">Selecciona el Período de Pago</label>
                            <Flatpickr 
                                className="form-control"
                                options={{ mode: "range", dateFormat: "Y-m-d" }}
                                value={dateRange}
                                onChange={(dates: Date[]) => { setDateRange(dates); }}
                                placeholder="Selecciona un rango de fechas..."
                            />
                            {dateWarning && (
                                <div className="text-danger mt-2">
                                    <i className="ri-error-warning-line me-1"></i>
                                    {dateWarning}
                                </div>
                            )}
                        </div>
                        <div className="col-md-3">
                            <button 
                                className="btn btn-primary w-100" 
                                onClick={handleGenerateClick} 
                                disabled={!dateRange[1] || !!dateWarning}
                                style={{ backgroundColor: '#438eff', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}
                            >
                                Generar Vista Previa
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="card">
                <div className="card-header d-flex align-items-center"><h4 className="card-title mb-0 flex-grow-1">Historial de Períodos de Nómina</h4></div>
                <div className="card-body">
                    {loading && <div className="text-center"><Spinner color="primary" /> <p>Cargando historial...</p></div>}
                    {error && <div className="alert alert-danger">{error}</div>}
                    {!loading && !error && periods.length === 0 && <div className="text-center"><p className="text-muted">No se encontraron períodos de nómina guardados.</p></div>}
                    
                    {!loading && !error && periods.length > 0 && (
                        <>
                            <ul className="list-group list-group-flush border-dashed" style={{ listStyle: 'none', padding: 0 }}>
                                {currentPeriods.map(period => (
                                     <li className="list-group-item ps-0" key={period.id} style={{ paddingLeft: 0, borderTop: '1px dashed #e9ecef', paddingTop: '1rem', paddingBottom: '1rem' }}>
                                         <div className="row align-items-center g-3">
                                             <div className="col-auto"><div style={{ width: '60px', height: '60px', backgroundColor: '#f8f9fa', borderRadius: '0.25rem', boxShadow: '0 2px 4px rgba(0,0,0,.075)', textAlign: 'center', padding: '5px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><h5 className="mb-0">{new Date(period.startDate).toLocaleDateString('es-CO', { day: '2-digit' })}</h5><div className="text-muted">{new Date(period.startDate).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}</div></div></div>
                                             <div className="col"><h5 className="text-muted mt-0 mb-1 fs-13" style={{ fontSize: '13px', color: '#6c757d' }}>Período del {new Date(period.startDate).toLocaleDateString('es-CO')} al {new Date(period.endDate).toLocaleDateString('es-CO')}</h5><a href="#!" onClick={(e) => { e.preventDefault(); handleViewDetails(period); }} className="text-reset fs-14 mb-0" style={{ textDecoration: 'none', color: 'inherit', fontSize: '14px' }}>Nómina pagada por un total de <span style={{ fontWeight: 'bold' }}>{formatterCOP.format(period.totalPaid)}</span></a></div>
                                             <div className="col-sm-auto"><div className="d-flex align-items-center"><div className="avatar-group me-3" style={{ display: 'flex' }}>
                                                 {period.details.map((stylist, index) => (<div className="avatar-group-item" key={index} style={{ marginLeft: '-10px' }}><a href="#!" className="d-inline-block" title={stylist.stylistName}><img src={stylist.avatar} alt={stylist.stylistName} className="rounded-circle" style={{ width: '24px', height: '24px', border: '2px solid white' }} /></a></div>))}
                                             </div>
                                             <button 
                                                 className="btn btn-light btn-sm" 
                                                 onClick={() => handleViewDetails(period)} 
                                                 style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}
                                             >
                                                 Detalles
                                             </button>
                                             </div></div>
                                         </div>
                                     </li>
                                ))}
                            </ul>
                            {totalPages > 1 && (
                                <div className="d-flex justify-content-end mt-4">
                                    <nav>
                                        <ul className="pagination">
                                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}><a className="page-link" href="#!" onClick={(e) => { e.preventDefault(); paginate(currentPage - 1); }}>Anterior</a></li>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (<li key={number} className={`page-item ${currentPage === number ? 'active' : ''}`}><a onClick={(e) => { e.preventDefault(); paginate(number); }} href="#!" className="page-link">{number}</a></li>))}
                                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}><a className="page-link" href="#!" onClick={(e) => { e.preventDefault(); paginate(currentPage + 1); }}>Siguiente</a></li>
                                        </ul>
                                    </nav>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

const PayrollPage = () => (
    <div className="page-content" style={{ fontFamily: 'sans-serif', padding: '20px', backgroundColor: '#f5f7fa' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <PayrollList />
        </div>
    </div>
);

export default PayrollPage;