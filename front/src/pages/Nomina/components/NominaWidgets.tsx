import React from 'react';
import { Card, CardBody, Col, Row } from 'reactstrap';
import CountUp from 'react-countup';

interface SummaryData {
    empleadosActivos: number;
    totalNominaMes: number;
    costoEmpresa: number;
    novedadesPendientes: number;
}

interface Props {
    summary: SummaryData;
    loading?: boolean;
}

const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1_000_000) {
        return { end: value / 1_000_000, suffix: 'M', decimals: 1 };
    }
    if (Math.abs(value) >= 1_000) {
        return { end: value / 1_000, suffix: 'K', decimals: 0 };
    }
    return { end: value, suffix: '', decimals: 0 };
};

const NominaWidgets: React.FC<Props> = ({ summary, loading }) => {
    const totalNominaF = formatCurrency(summary.totalNominaMes);
    const costoEmpresaF = formatCurrency(summary.costoEmpresa);

    const widgets = [
        {
            label: 'Empleados Activos',
            icon: 'ri-team-line',
            color: 'primary',
            bgColor: 'bg-primary-subtle',
            prefix: '',
            end: summary.empleadosActivos,
            suffix: '',
            decimals: 0,
        },
        {
            label: 'Total Nómina Mes',
            icon: 'ri-money-dollar-circle-line',
            color: 'success',
            bgColor: 'bg-success-subtle',
            prefix: '$',
            ...totalNominaF,
        },
        {
            label: 'Costo Empresa',
            icon: 'ri-building-2-line',
            color: 'info',
            bgColor: 'bg-info-subtle',
            prefix: '$',
            ...costoEmpresaF,
        },
        {
            label: 'Novedades Pendientes',
            icon: 'ri-file-warning-line',
            color: summary.novedadesPendientes > 0 ? 'warning' : 'secondary',
            bgColor: summary.novedadesPendientes > 0 ? 'bg-warning-subtle' : 'bg-secondary-subtle',
            prefix: '',
            end: summary.novedadesPendientes,
            suffix: '',
            decimals: 0,
        },
    ];

    return (
        <Row>
            {widgets.map((w, idx) => (
                <Col key={idx} md={6} xl={3}>
                    <Card className="card-animate">
                        <CardBody>
                            <div className="d-flex justify-content-between">
                                <div className="flex-grow-1">
                                    <p className="text-uppercase text-muted fw-medium fs-12 mb-2">
                                        {w.label}
                                    </p>
                                    <h4 className="fs-22 fw-semibold ff-secondary mb-0">
                                        {loading ? (
                                            <span className="placeholder-glow">
                                                <span className="placeholder col-6"></span>
                                            </span>
                                        ) : (
                                            <>
                                                <span className="counter-value">
                                                    {w.prefix}
                                                    <CountUp
                                                        start={0}
                                                        end={w.end}
                                                        decimals={w.decimals}
                                                        duration={2}
                                                        separator=","
                                                    />
                                                </span>
                                                {w.suffix}
                                            </>
                                        )}
                                    </h4>
                                </div>
                                <div className="flex-shrink-0">
                                    <div className={`avatar-sm rounded-circle ${w.bgColor} d-flex align-items-center justify-content-center`}>
                                        <i className={`${w.icon} text-${w.color} fs-20`}></i>
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </Col>
            ))}
        </Row>
    );
};

export default NominaWidgets;
