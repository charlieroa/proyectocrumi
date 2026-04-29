import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Input,
  Label,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import { API_BASE, money, useAuthHeaders } from '../shared';
import { downloadExcelReport, CellValue } from '../../../Components/Common/excelExport';
import { downloadPdfReport } from '../../../Components/Common/pdfExport';

interface FormatColumn {
  key: string;
  label: string;
  width?: number;
}

interface FormatMeta {
  code: string;
  name: string;
  description: string;
}

interface FormatSummary {
  totalRows: number;
  totalAmount: number;
  uniqueThirds: number;
}

interface FormatResponse {
  success: boolean;
  format: string;
  year: number;
  rows: Record<string, string | number | null | undefined>[];
  columns: FormatColumn[];
  summary: FormatSummary;
  meta: FormatMeta;
}

const FORMAT_OPTIONS: { code: string; label: string; description: string }[] = [
  { code: '1001', label: '1001 - Pagos y abonos a terceros', description: 'Pagos y abonos en cuenta efectuados a proveedores durante el ano.' },
  { code: '1003', label: '1003 - Retenciones en la fuente practicadas', description: 'Retenciones en la fuente, IVA e ICA practicadas a terceros.' },
  { code: '1005', label: '1005 - IVA descontable', description: 'IVA descontable pagado a proveedores durante el ano.' },
  { code: '1006', label: '1006 - IVA generado', description: 'IVA generado en ventas a clientes durante el ano.' },
  { code: '1007', label: '1007 - Ingresos recibidos de clientes', description: 'Ingresos operacionales recibidos de clientes durante el ano.' },
  { code: '1008', label: '1008 - Cuentas por cobrar al cierre', description: 'Saldo de cartera de clientes al 31 de diciembre.' },
  { code: '1009', label: '1009 - Cuentas por pagar al cierre', description: 'Saldo de obligaciones con proveedores al 31 de diciembre.' },
  { code: '1010', label: '1010 - Socios y accionistas', description: 'Socios o accionistas con participacion en el patrimonio al cierre.' },
  { code: '1011', label: '1011 - Declaraciones tributarias', description: 'Consolidado de activos, pasivos, patrimonio, ingresos y gastos.' },
  { code: '2276', label: '2276 - Certificado ingresos laborales', description: 'Ingresos laborales y retenciones practicadas a empleados.' },
];

const Exogena: React.FC = () => {
  const headers = useAuthHeaders();
  const currentYear = new Date().getFullYear();
  const defaultYear = currentYear - 1;

  const [year, setYear] = useState<number>(defaultYear);
  const [formatCode, setFormatCode] = useState<string>('1001');
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<'csv' | 'txt' | 'xlsx' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FormatResponse | null>(null);

  const yearOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 7; y -= 1) arr.push(y);
    return arr;
  }, [currentYear]);

  const selectedFormatMeta = useMemo(
    () => FORMAT_OPTIONS.find((f) => f.code === formatCode),
    [formatCode],
  );

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${API_BASE}/exogenous/format/${formatCode}?year=${year}`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Error HTTP ${resp.status}`);
      }
      const json = (await resp.json()) as FormatResponse;
      if (!json.success) throw new Error('La API reporto un error generando el formato.');
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, formatCode, headers, year]);

  useEffect(() => {
    setData(null);
  }, [formatCode, year]);

  const downloadFile = useCallback(
    async (exportFormat: 'csv' | 'txt') => {
      setDownloading(exportFormat);
      setError(null);
      try {
        const url = `${API_BASE}/exogenous/format/${formatCode}/download?year=${year}&format=${exportFormat}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || `Error HTTP ${resp.status}`);
        }
        const blob = await resp.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `exogena_${formatCode}_${year}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objectUrl);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido';
        setError(`No fue posible descargar: ${msg}`);
      } finally {
        setDownloading(null);
      }
    },
    [API_BASE, formatCode, headers, year],
  );

  const isAmountColumn = (key: string): boolean => {
    return [
      'value_paid',
      'iva_value',
      'retefuente_value',
      'reteiva_value',
      'reteica_value',
      'base_value',
      'retention_value',
      'operational_income',
      'non_operational_income',
      'returns_value',
      'balance_value',
      'ingresos_laborales',
      'percent_share',
    ].includes(key);
  };

  const buildExportRows = useCallback((): CellValue[][] => {
    if (!data) return [];
    return data.rows.map((row) =>
      data.columns.map((col) => {
        const v = row[col.key];
        if (v === null || v === undefined || v === '') return '';
        if (isAmountColumn(col.key)) {
          const n = typeof v === 'number' ? v : Number(v);
          return Number.isFinite(n) ? n : '';
        }
        return typeof v === 'number' ? v : String(v);
      }),
    );
  }, [data]);

  const downloadExcel = useCallback(() => {
    if (!data || data.rows.length === 0) return;
    setDownloading('xlsx');
    try {
      const headers = data.columns.map((c) => c.label);
      const rows = buildExportRows();
      downloadExcelReport(
        `Formato ${data.format}`,
        headers,
        rows,
        `exogena_${data.format}_${data.year}.xlsx`,
        {
          title: data.meta?.name || `Formato ${data.format}`,
          dateRange: `Año gravable ${data.year}`,
          extra: data.meta?.description ? [data.meta.description] : undefined,
        },
      );
    } finally {
      setDownloading(null);
    }
  }, [data, buildExportRows]);

  const downloadPdf = useCallback(() => {
    if (!data || data.rows.length === 0) return;
    setDownloading('pdf');
    try {
      const headers = data.columns.map((c) => c.label);
      const rows = buildExportRows();
      downloadPdfReport(
        headers,
        rows,
        `exogena_${data.format}_${data.year}.pdf`,
        {
          title: data.meta?.name || `Formato ${data.format}`,
          subtitle: data.meta?.description,
          dateRange: `Año gravable ${data.year}`,
          extra: [
            `Registros: ${data.summary.totalRows.toLocaleString('es-CO')}`,
            `Terceros únicos: ${data.summary.uniqueThirds.toLocaleString('es-CO')}`,
          ],
        },
      );
    } finally {
      setDownloading(null);
    }
  }, [data, buildExportRows]);

  const renderCell = (col: FormatColumn, row: Record<string, string | number | null | undefined>) => {
    const value = row[col.key];
    if (isAmountColumn(col.key)) {
      return <span className="font-monospace">{money(value as number)}</span>;
    }
    if (value === null || value === undefined || value === '') return <span className="text-muted">-</span>;
    return String(value);
  };

  return (
    <div className="exogena-container">
      <Row className="mb-3">
        <Col>
          <h4 className="mb-1">
            <i className="ri-file-list-3-line me-2" />
            Informacion exogena DIAN - medios magneticos
          </h4>
          <p className="text-muted mb-0">
            Genera los formatos anuales que reporta tu empresa al fisco.
          </p>
        </Col>
      </Row>

      <Alert color="info" className="d-flex align-items-start">
        <i className="ri-information-line fs-4 me-2" />
        <div>
          Genera aqui los formatos de informacion exogena DIAN. Descargalos y cargalos directamente
          en el portal Muisca. El formato CSV es ideal para revisar en Excel; el formato TXT (TAB)
          corresponde al esquema oficial de Muisca.
        </div>
      </Alert>

      <Card className="mb-3">
        <CardBody>
          <Row className="g-3 align-items-end">
            <Col md={3}>
              <Label className="form-label fw-semibold">Ano gravable</Label>
              <Input
                type="select"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={5}>
              <Label className="form-label fw-semibold">Formato</Label>
              <Input
                type="select"
                value={formatCode}
                onChange={(e) => setFormatCode(e.target.value)}
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.label}
                  </option>
                ))}
              </Input>
              {selectedFormatMeta && (
                <small className="text-muted d-block mt-1">{selectedFormatMeta.description}</small>
              )}
            </Col>
            <Col md={4} className="text-md-end">
              <Button color="primary" size="lg" onClick={fetchReport} disabled={loading}>
                {loading ? (
                  <>
                    <Spinner size="sm" className="me-2" /> Generando...
                  </>
                ) : (
                  <>
                    <i className="ri-play-circle-line me-2" />
                    Generar reporte
                  </>
                )}
              </Button>
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
            <Button size="sm" color="danger" outline className="mt-2" onClick={() => { setError(null); fetchReport(); }}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      {data && (
        <>
          <Row className="g-3 mb-3">
            <Col md={4}>
              <Card className="border-0 bg-light h-100">
                <CardBody>
                  <small className="text-muted text-uppercase">Total registros</small>
                  <h3 className="mb-0 mt-1">{data.summary.totalRows.toLocaleString('es-CO')}</h3>
                  <Badge color="primary" className="mt-2">
                    Formato {data.format}
                  </Badge>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="border-0 bg-light h-100">
                <CardBody>
                  <small className="text-muted text-uppercase">Monto total</small>
                  <h3 className="mb-0 mt-1">$ {money(data.summary.totalAmount)}</h3>
                  <Badge color="success" className="mt-2">
                    Ano {data.year}
                  </Badge>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="border-0 bg-light h-100">
                <CardBody>
                  <small className="text-muted text-uppercase">Terceros unicos</small>
                  <h3 className="mb-0 mt-1">{data.summary.uniqueThirds.toLocaleString('es-CO')}</h3>
                  <Badge color="info" className="mt-2">
                    Documentos
                  </Badge>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <Card className="mb-3">
            <CardBody>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <div className="me-auto">
                  <strong>{data.meta?.name || `Formato ${data.format}`}</strong>
                  <div className="text-muted small">{data.meta?.description}</div>
                </div>
                <Button
                  color="success"
                  onClick={downloadExcel}
                  disabled={downloading !== null || data.rows.length === 0}
                >
                  {downloading === 'xlsx' ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <i className="ri-file-excel-2-line me-1" /> Descargar Excel
                    </>
                  )}
                </Button>
                <Button
                  color="danger"
                  outline
                  onClick={downloadPdf}
                  disabled={downloading !== null || data.rows.length === 0}
                >
                  {downloading === 'pdf' ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <i className="ri-file-pdf-2-line me-1" /> Descargar PDF
                    </>
                  )}
                </Button>
                <Button
                  color="success"
                  outline
                  onClick={() => downloadFile('csv')}
                  disabled={downloading !== null || data.rows.length === 0}
                >
                  {downloading === 'csv' ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <i className="ri-file-excel-2-line me-1" /> Descargar CSV
                    </>
                  )}
                </Button>
                <Button
                  color="dark"
                  outline
                  onClick={() => downloadFile('txt')}
                  disabled={downloading !== null || data.rows.length === 0}
                >
                  {downloading === 'txt' ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <i className="ri-file-download-line me-1" /> Descargar formato Muisca (.txt)
                    </>
                  )}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-0">
              {data.rows.length === 0 ? (
                <div className="text-center p-5">
                  <i className="ri-inbox-line fs-1 text-muted d-block mb-2" />
                  <h5 className="text-muted">Sin movimientos para este ano/formato</h5>
                  <p className="text-muted mb-0">
                    No se encontraron registros para el formato {data.format} en el ano {data.year}.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table className="table-sm align-middle mb-0" hover>
                    <thead className="table-light">
                      <tr>
                        {data.columns.map((col) => (
                          <th
                            key={col.key}
                            style={col.width ? { minWidth: col.width } : undefined}
                            className={isAmountColumn(col.key) ? 'text-end' : ''}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, idx) => (
                        <tr key={idx}>
                          {data.columns.map((col) => (
                            <td
                              key={col.key}
                              className={isAmountColumn(col.key) ? 'text-end' : ''}
                            >
                              {renderCell(col, row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {!data && !loading && !error && (
        <Card>
          <CardBody className="text-center p-5">
            <i className="ri-file-search-line fs-1 text-muted d-block mb-2" />
            <h5 className="text-muted mb-1">Selecciona ano y formato</h5>
            <p className="text-muted mb-0">
              Pulsa "Generar reporte" para construir el formato seleccionado.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default Exogena;
