import React, { useEffect, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  Button,
  Spinner,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  Table,
  Badge,
  Alert,
} from 'reactstrap';
import { API_BASE, money, useAuthHeaders } from '../shared';
import { downloadExcelReport, CellValue } from '../../../Components/Common/excelExport';
import { downloadPdfReport, downloadPdfSectionedReport, PdfSection } from '../../../Components/Common/pdfExport';

interface IvaDetail {
  account_code?: string;
  account_name?: string;
  base?: number;
  tax?: number;
  rate?: number;
}

interface RetDetail {
  concept?: string;
  base?: number;
  rate?: number;
  amount?: number;
}

interface TaxSummary {
  iva?: {
    generado?: number;
    descontable?: number;
    saldo?: number;
    details?: IvaDetail[];
  };
  retefuente?: { total?: number; details?: RetDetail[] };
  reteiva?: { total?: number; details?: RetDetail[] };
  reteica?: { total?: number; details?: RetDetail[] };
  ica?: { total?: number; details?: RetDetail[] };
}

const CONCEPTOS_DIAN: { code: string; name: string }[] = [
  { code: '1001', name: 'Salarios y pagos laborales' },
  { code: '1002', name: 'Honorarios' },
  { code: '1003', name: 'Comisiones' },
  { code: '1004', name: 'Servicios' },
  { code: '1005', name: 'Arrendamientos' },
  { code: '1006', name: 'Rendimientos financieros' },
  { code: '1007', name: 'Compras' },
  { code: '1008', name: 'Dividendos y participaciones' },
  { code: '1009', name: 'Otros pagos (no laborales)' },
  { code: '1010', name: 'Pagos al exterior' },
  { code: '1011', name: 'Ingresos tributarios' },
  { code: '1012', name: 'IVA descontable / generado' },
];

const firstOfMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Impuestos: React.FC = () => {
  const authHeaders = useAuthHeaders();
  const [startDate, setStartDate] = useState<string>(firstOfMonth());
  const [endDate, setEndDate] = useState<string>(today());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [summary, setSummary] = useState<TaxSummary>({});
  const [activeTab, setActiveTab] = useState<string>('iva');

  const fetchSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const url = `${API_BASE}/accounting/tax-summary?startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const s = data?.summary ?? data?.taxSummary ?? {};
      const mapped: TaxSummary = {
        iva: {
          generado: Number(s.vatGenerated ?? s.iva?.generado ?? 0),
          descontable: Number(s.vatDeductible ?? s.iva?.descontable ?? 0),
          saldo: Number(s.vatPayable ?? s.iva?.saldo ?? 0),
          details: s.iva?.details || [],
        },
        retefuente: { total: Number(s.withholdingSource ?? 0), details: s.retefuente?.details || [] },
        reteiva:    { total: Number(s.withholdingVat    ?? 0), details: s.reteiva?.details    || [] },
        reteica:    { total: Number(s.withholdingIca    ?? 0), details: s.reteica?.details    || [] },
        ica:        { total: Number(s.ica?.total        ?? 0), details: s.ica?.details        || [] },
      };
      setSummary(mapped);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar impuestos');
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ivaGenerado = summary?.iva?.generado ?? 0;
  const ivaDescontable = summary?.iva?.descontable ?? 0;
  const ivaSaldo = summary?.iva?.saldo ?? ivaGenerado - ivaDescontable;
  const ivaDetails = summary?.iva?.details || [];

  const retefuente = summary?.retefuente || {};
  const reteiva = summary?.reteiva || {};
  const reteica = summary?.reteica || {};
  const ica = summary?.ica || {};

  const retefuenteTotal = retefuente.total ?? 0;
  const reteivaTotal = reteiva.total ?? 0;
  const reteicaTotal = reteica.total ?? 0;
  const icaTotal = ica.total ?? 0;
  const totalRetenciones = retefuenteTotal + reteivaTotal + reteicaTotal;

  const saldoColor = useMemo(() => {
    if (ivaSaldo > 0) return { bg: '#fff8e1', fg: '#b8860b' };
    return { bg: '#e8f5e9', fg: '#2e7d32' };
  }, [ivaSaldo]);

  const dateRange = `${startDate} a ${endDate}`;

  const TAB_LABELS: Record<string, { label: string; amountLabel: string; total: number; details: RetDetail[] | undefined }> = {
    retefuente: { label: 'Retención en la fuente', amountLabel: 'Retención', total: retefuenteTotal, details: retefuente.details },
    reteiva: { label: 'ReteIVA', amountLabel: 'ReteIVA', total: reteivaTotal, details: reteiva.details },
    reteica: { label: 'ReteICA', amountLabel: 'ReteICA', total: reteicaTotal, details: reteica.details },
    ica: { label: 'ICA', amountLabel: 'ICA', total: icaTotal, details: ica.details },
  };

  const buildIvaRows = (): CellValue[][] => ivaDetails.map((d) => [
    d.account_code || '',
    d.account_name || '',
    Number(d.base) || 0,
    Number(((d.rate ?? 0) * 100).toFixed(2)),
    Number(d.tax) || 0,
  ]);

  const buildRetRows = (details: RetDetail[] | undefined): CellValue[][] => (details || []).map((r) => [
    r.concept || '',
    Number(r.base) || 0,
    Number(((r.rate ?? 0) * 100).toFixed(2)),
    Number(r.amount) || 0,
  ]);

  const activeTabRowCount = (): number => {
    if (activeTab === 'iva') return ivaDetails.length;
    return TAB_LABELS[activeTab]?.details?.length || 0;
  };

  const downloadActiveTabExcel = () => {
    if (activeTab === 'iva') {
      const rows = buildIvaRows();
      const totalIva = ivaDetails.reduce((a, b) => a + (b.tax ?? 0), 0);
      rows.push(['', '', '', 'TOTAL', totalIva]);
      downloadExcelReport(
        'IVA',
        ['Cuenta', 'Nombre', 'Base', 'Tarifa %', 'IVA'],
        rows,
        `impuestos_iva_${startDate}_${endDate}.xlsx`,
        { title: 'IVA por cuenta', dateRange },
      );
      return;
    }
    const cfg = TAB_LABELS[activeTab];
    if (!cfg) return;
    const rows = buildRetRows(cfg.details);
    rows.push(['', '', 'TOTAL', cfg.total]);
    downloadExcelReport(
      cfg.label,
      ['Concepto', 'Base', 'Tarifa %', cfg.amountLabel],
      rows,
      `impuestos_${activeTab}_${startDate}_${endDate}.xlsx`,
      { title: cfg.label, dateRange },
    );
  };

  const downloadActiveTabPdf = () => {
    if (activeTab === 'iva') {
      const rows = buildIvaRows();
      const totalIva = ivaDetails.reduce((a, b) => a + (b.tax ?? 0), 0);
      rows.push(['', '', '', 'TOTAL', totalIva]);
      downloadPdfReport(
        ['Cuenta', 'Nombre', 'Base', 'Tarifa %', 'IVA'],
        rows,
        `impuestos_iva_${startDate}_${endDate}.pdf`,
        {
          title: 'IVA por cuenta',
          dateRange,
          extra: [
            `IVA generado: $${money(ivaGenerado)}`,
            `IVA descontable: $${money(ivaDescontable)}`,
            `${ivaSaldo > 0 ? 'Saldo a pagar' : 'Saldo a favor'}: $${money(Math.abs(ivaSaldo))}`,
          ],
        },
      );
      return;
    }
    const cfg = TAB_LABELS[activeTab];
    if (!cfg) return;
    const rows = buildRetRows(cfg.details);
    rows.push(['', '', 'TOTAL', cfg.total]);
    downloadPdfReport(
      ['Concepto', 'Base', 'Tarifa %', cfg.amountLabel],
      rows,
      `impuestos_${activeTab}_${startDate}_${endDate}.pdf`,
      { title: cfg.label, dateRange, extra: [`Total: $${money(cfg.total)}`] },
    );
  };

  const downloadConsolidatedPdf = () => {
    const sections: PdfSection[] = [];
    if (ivaDetails.length > 0) {
      sections.push({
        label: 'IVA por cuenta',
        items: ivaDetails.map((d) => [
          `${d.account_code || ''} ${d.account_name || ''}`.trim(),
          Number(d.base) || 0,
          Number(d.tax) || 0,
        ]),
        total: { label: 'Total IVA', value: ivaDetails.reduce((a, b) => a + (b.tax ?? 0), 0) },
        color: 'danger',
      });
    }
    (['retefuente', 'reteiva', 'reteica', 'ica'] as const).forEach((k) => {
      const cfg = TAB_LABELS[k];
      if (!cfg.details || cfg.details.length === 0) return;
      sections.push({
        label: cfg.label,
        items: cfg.details.map((r) => [r.concept || '', Number(r.base) || 0, Number(r.amount) || 0]),
        total: { label: `Total ${cfg.amountLabel}`, value: cfg.total },
        color: k === 'ica' ? 'info' : 'primary',
      });
    });
    if (sections.length === 0) return;
    const grandTotals = [
      { label: 'IVA generado', value: ivaGenerado },
      { label: 'IVA descontable', value: ivaDescontable },
      { label: ivaSaldo > 0 ? 'Saldo a pagar IVA' : 'Saldo a favor IVA', value: Math.abs(ivaSaldo) },
      { label: 'Total retenciones', value: totalRetenciones },
      { label: 'Total ICA', value: icaTotal },
    ];
    downloadPdfSectionedReport(
      ['Concepto', 'Base', 'Valor'],
      sections,
      grandTotals,
      `impuestos_consolidado_${startDate}_${endDate}.pdf`,
      { title: 'Resumen de impuestos', dateRange },
    );
  };

  const hasAnyData = ivaDetails.length > 0
    || (retefuente.details?.length || 0) > 0
    || (reteiva.details?.length || 0) > 0
    || (reteica.details?.length || 0) > 0
    || (ica.details?.length || 0) > 0;

  const renderRetTable = (
    details: RetDetail[] | undefined,
    total: number,
    label: string,
  ) => {
    const rows = details || [];
    if (rows.length === 0) {
      return (
        <Alert color="light" className="text-center mb-0">
          Sin movimientos en el período seleccionado
        </Alert>
      );
    }
    return (
      <Table size="sm" className="align-middle mb-0" responsive>
        <thead className="table-light">
          <tr>
            <th>Concepto</th>
            <th className="text-end">Base</th>
            <th className="text-center">Tarifa</th>
            <th className="text-end">{label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.concept || '-'}</td>
              <td className="text-end font-monospace">{money(r.base ?? 0)}</td>
              <td className="text-center">
                <Badge color="light" className="text-dark">
                  {((r.rate ?? 0) * 100).toFixed(2)}%
                </Badge>
              </td>
              <td className="text-end font-monospace">{money(r.amount ?? 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="table-light fw-bold">
            <td colSpan={3} className="text-end">Total</td>
            <td className="text-end font-monospace">{money(total)}</td>
          </tr>
        </tfoot>
      </Table>
    );
  };

  const renderIvaTable = () => {
    if (!ivaDetails || ivaDetails.length === 0) {
      return (
        <Alert color="light" className="text-center mb-0">
          Sin movimientos en el período seleccionado
        </Alert>
      );
    }
    return (
      <Table size="sm" className="align-middle mb-0" responsive>
        <thead className="table-light">
          <tr>
            <th>Cuenta</th>
            <th>Nombre</th>
            <th className="text-end">Base</th>
            <th className="text-center">Tarifa</th>
            <th className="text-end">IVA</th>
          </tr>
        </thead>
        <tbody>
          {ivaDetails.map((d, i) => (
            <tr key={i}>
              <td className="font-monospace">{d.account_code || '-'}</td>
              <td>{d.account_name || '-'}</td>
              <td className="text-end font-monospace">{money(d.base ?? 0)}</td>
              <td className="text-center">
                <Badge color="light" className="text-dark">
                  {((d.rate ?? 0) * 100).toFixed(2)}%
                </Badge>
              </td>
              <td className="text-end font-monospace">{money(d.tax ?? 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="table-light fw-bold">
            <td colSpan={4} className="text-end">Total IVA</td>
            <td className="text-end font-monospace">
              {money(ivaDetails.reduce((a, b) => a + (b.tax ?? 0), 0))}
            </td>
          </tr>
        </tfoot>
      </Table>
    );
  };

  return (
    <div>
      <Card className="mb-3">
        <CardBody>
          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Label className="form-label mb-1">Desde</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Col>
            <Col md={4}>
              <Label className="form-label mb-1">Hasta</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Col>
            <Col md={4}>
              <div className="d-flex gap-2">
                <Button color="primary" onClick={fetchSummary} disabled={loading} className="flex-grow-1">
                  <i className="ri-filter-3-line align-middle me-1"></i>
                  Aplicar
                </Button>
                <Button
                  color="danger"
                  outline
                  onClick={downloadConsolidatedPdf}
                  disabled={loading || !hasAnyData}
                  title="Descargar consolidado PDF con todas las secciones"
                >
                  <i className="ri-file-pdf-2-line align-middle me-1" /> Consolidado
                </Button>
              </div>
            </Col>
          </Row>
        </CardBody>
      </Card>

      {error && (
        <Alert color="danger" className="d-flex align-items-start gap-3 mb-3">
          <i className="ri-error-warning-line fs-20 mt-1" />
          <div className="flex-grow-1">
            <strong>No pudimos conectar con el servidor</strong>
            <div className="fs-13 mt-1">
              {String(error).toLowerCase().includes('fetch') || String(error).toLowerCase().includes('network')
                ? 'El backend no responde. Revisa que esté corriendo (npm start en crumi/back) o ajusta VITE_API_URL en front/.env.'
                : String(error)}
            </div>
            <Button size="sm" color="danger" outline className="mt-2" onClick={() => { setError(''); fetchSummary(); }}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner color="primary" />
        </div>
      ) : (
        <>
          <Row className="g-3 mb-3">
            <Col lg={3} md={6}>
              <Card className="h-100" style={{ backgroundColor: '#fdecea' }}>
                <CardBody>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <p className="text-muted mb-1 small">IVA Generado</p>
                      <h4 className="font-monospace fs-20 mb-0" style={{ color: '#c62828' }}>
                        {money(ivaGenerado)}
                      </h4>
                    </div>
                    <i className="ri-arrow-up-circle-line fs-32" style={{ color: '#c62828' }}></i>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col lg={3} md={6}>
              <Card className="h-100" style={{ backgroundColor: '#e8f5e9' }}>
                <CardBody>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <p className="text-muted mb-1 small">IVA Descontable</p>
                      <h4 className="font-monospace fs-20 mb-0" style={{ color: '#2e7d32' }}>
                        {money(ivaDescontable)}
                      </h4>
                    </div>
                    <i className="ri-arrow-down-circle-line fs-32" style={{ color: '#2e7d32' }}></i>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col lg={3} md={6}>
              <Card className="h-100" style={{ backgroundColor: saldoColor.bg }}>
                <CardBody>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <p className="text-muted mb-1 small">
                        {ivaSaldo > 0 ? 'Saldo a pagar' : 'Saldo a favor'}
                      </p>
                      <h4 className="font-monospace fs-20 mb-0" style={{ color: saldoColor.fg }}>
                        {money(Math.abs(ivaSaldo))}
                      </h4>
                    </div>
                    <i className="ri-scales-3-line fs-32" style={{ color: saldoColor.fg }}></i>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col lg={3} md={6}>
              <Card className="h-100 bg-info-subtle">
                <CardBody>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <p className="text-muted mb-1 small">Total retenciones</p>
                      <h4 className="font-monospace fs-20 mb-0 text-info">
                        {money(totalRetenciones)}
                      </h4>
                    </div>
                    <i className="ri-percent-line fs-32 text-info"></i>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <Card className="mb-3">
            <CardHeader className="border-0 pb-0 d-flex flex-wrap justify-content-between align-items-center gap-2">
              <Nav pills className="nav-pills-custom">
                <NavItem>
                  <NavLink
                    href="#"
                    active={activeTab === 'iva'}
                    onClick={(e) => { e.preventDefault(); setActiveTab('iva'); }}
                  >
                    IVA
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    href="#"
                    active={activeTab === 'retefuente'}
                    onClick={(e) => { e.preventDefault(); setActiveTab('retefuente'); }}
                  >
                    Retención en la fuente
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    href="#"
                    active={activeTab === 'reteiva'}
                    onClick={(e) => { e.preventDefault(); setActiveTab('reteiva'); }}
                  >
                    ReteIVA
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    href="#"
                    active={activeTab === 'reteica'}
                    onClick={(e) => { e.preventDefault(); setActiveTab('reteica'); }}
                  >
                    ReteICA
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink
                    href="#"
                    active={activeTab === 'ica'}
                    onClick={(e) => { e.preventDefault(); setActiveTab('ica'); }}
                  >
                    ICA
                  </NavLink>
                </NavItem>
              </Nav>
              <div className="d-flex gap-2">
                <Button
                  color="success"
                  size="sm"
                  onClick={downloadActiveTabExcel}
                  disabled={activeTabRowCount() === 0}
                >
                  <i className="ri-file-excel-2-line align-middle me-1" /> Excel
                </Button>
                <Button
                  color="danger"
                  outline
                  size="sm"
                  onClick={downloadActiveTabPdf}
                  disabled={activeTabRowCount() === 0}
                >
                  <i className="ri-file-pdf-2-line align-middle me-1" /> PDF
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              <TabContent activeTab={activeTab}>
                <TabPane tabId="iva">{renderIvaTable()}</TabPane>
                <TabPane tabId="retefuente">
                  {renderRetTable(retefuente.details, retefuenteTotal, 'Retención')}
                </TabPane>
                <TabPane tabId="reteiva">
                  {renderRetTable(reteiva.details, reteivaTotal, 'ReteIVA')}
                </TabPane>
                <TabPane tabId="reteica">
                  {renderRetTable(reteica.details, reteicaTotal, 'ReteICA')}
                </TabPane>
                <TabPane tabId="ica">
                  {renderRetTable(ica.details, icaTotal, 'ICA')}
                </TabPane>
              </TabContent>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h5 className="mb-0">
                <i className="ri-book-2-line align-middle me-2"></i>
                Conceptos DIAN
              </h5>
            </CardHeader>
            <CardBody>
              <Row className="g-2">
                {CONCEPTOS_DIAN.map((c) => (
                  <Col md={4} sm={6} key={c.code}>
                    <div className="d-flex align-items-center p-2 border rounded">
                      <Badge color="primary" className="me-2 font-monospace">{c.code}</Badge>
                      <span className="small">{c.name}</span>
                    </div>
                  </Col>
                ))}
              </Row>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
};

export default Impuestos;
