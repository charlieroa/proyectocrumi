import React from 'react';
import { Card, CardBody, CardHeader, Col, Row, Table, Badge } from 'reactstrap';
import ReactApexChart from 'react-apexcharts';

interface MonthlyPayrollData {
    month: string;
    month_name: string;
    nomina_neta: number;
    costo_empresa: number;
}

interface ChartData {
    monthly: MonthlyPayrollData[];
}

interface Props {
    chartData: ChartData;
    loading?: boolean;
}

const NominaCharts: React.FC<Props> = ({ chartData, loading }) => {
    const months = chartData.monthly.map(m => m.month_name || m.month);
    const nominaNetaSeries = chartData.monthly.map(m => Number(m.nomina_neta) || 0);
    const costoEmpresaSeries = chartData.monthly.map(m => Number(m.costo_empresa) || 0);

    const barOptions: ApexCharts.ApexOptions = {
        chart: {
            type: 'bar',
            height: 350,
            toolbar: { show: false },
        },
        colors: ['#0ab39c', '#405189'],
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                borderRadius: 4,
            },
        },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: {
            categories: months,
            labels: { style: { fontSize: '11px', colors: '#adb5bd' } },
        },
        yaxis: {
            labels: {
                style: { fontSize: '11px', colors: '#adb5bd' },
                formatter: (val: number) => {
                    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
                    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
                    return `$${val}`;
                },
            },
        },
        fill: { opacity: 1 },
        tooltip: {
            y: {
                formatter: (val: number) => `$${val.toLocaleString('es-CO')}`,
            },
        },
        legend: { position: 'top' },
        grid: { borderColor: '#f1f1f1' },
    };

    const barSeries = [
        { name: 'Nómina Neta', data: nominaNetaSeries },
        { name: 'Costo Total Empresa', data: costoEmpresaSeries },
    ];

    const fmt = (n: number) => new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(n);

    const emptyState = (
        <div className="d-flex align-items-center justify-content-center" style={{ height: 350 }}>
            <div className="text-center text-muted">
                <i className="ri-bar-chart-box-line fs-36 mb-2 d-block"></i>
                <p>Sin datos para mostrar</p>
            </div>
        </div>
    );

    return (
        <Row>
            <Col lg={7}>
                <Card>
                    <CardHeader className="border-0 pb-0">
                        <h6 className="card-title mb-0">
                            <i className="ri-bar-chart-2-line me-1 text-primary"></i>
                            Nómina Neta vs Costo Empresa (Últimos 6 meses)
                        </h6>
                    </CardHeader>
                    <CardBody>
                        {loading ? (
                            <div className="placeholder-glow" style={{ height: 350 }}>
                                <span className="placeholder w-100" style={{ height: 350 }}></span>
                            </div>
                        ) : chartData.monthly.length > 0 ? (
                            <ReactApexChart
                                options={barOptions}
                                series={barSeries}
                                type="bar"
                                height={350}
                            />
                        ) : emptyState}
                    </CardBody>
                </Card>
            </Col>
            <Col lg={5}>
                <Card>
                    <CardHeader className="border-0 pb-0">
                        <h6 className="card-title mb-0">
                            <i className="ri-file-list-3-line me-1 text-success"></i>
                            Detalle Mensual
                        </h6>
                    </CardHeader>
                    <CardBody>
                        {loading ? (
                            <div className="placeholder-glow" style={{ height: 350 }}>
                                <span className="placeholder w-100" style={{ height: 350 }}></span>
                            </div>
                        ) : chartData.monthly.length > 0 ? (
                            <div className="table-responsive">
                                <Table className="table-hover table-nowrap align-middle mb-0" size="sm">
                                    <thead>
                                        <tr>
                                            <th className="text-uppercase text-muted fs-11 fw-semibold">Mes</th>
                                            <th className="text-uppercase text-muted fs-11 fw-semibold text-end">Nómina Neta</th>
                                            <th className="text-uppercase text-muted fs-11 fw-semibold text-end">Costo Empresa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chartData.monthly.map((m, idx) => (
                                            <tr key={idx}>
                                                <td className="fw-medium">
                                                    <Badge color="primary-subtle" className="text-primary">
                                                        {m.month_name || m.month}
                                                    </Badge>
                                                </td>
                                                <td className="text-end font-monospace text-success">
                                                    {fmt(m.nomina_neta)}
                                                </td>
                                                <td className="text-end font-monospace text-primary">
                                                    {fmt(m.costo_empresa)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="table-light fw-semibold">
                                            <td>Total</td>
                                            <td className="text-end font-monospace">
                                                {fmt(chartData.monthly.reduce((s, m) => s + (Number(m.nomina_neta) || 0), 0))}
                                            </td>
                                            <td className="text-end font-monospace">
                                                {fmt(chartData.monthly.reduce((s, m) => s + (Number(m.costo_empresa) || 0), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </Table>
                            </div>
                        ) : emptyState}
                    </CardBody>
                </Card>
            </Col>
        </Row>
    );
};

export default NominaCharts;
