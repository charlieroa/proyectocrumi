import React, { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Collapse,
  Form,
  FormGroup,
  Input,
  Label,
  Row,
  Table,
} from 'reactstrap';

type DocType = 'all' | 'factura' | 'nota_credito' | 'nota_debito' | 'recibo_caja' | 'soporte_venta';
type DocStatus = 'all' | 'pagada' | 'pendiente' | 'vencida' | 'anulada';

interface IncomeDocumentRow {
  id: string;
  fecha: string;            // ISO yyyy-mm-dd
  tipo: Exclude<DocType, 'all'>;
  numero: string;
  cliente: string;
  estado: Exclude<DocStatus, 'all'>;
  total: number;
}

const DOC_TYPE_LABEL: Record<Exclude<DocType, 'all'>, string> = {
  factura: 'Factura de venta',
  nota_credito: 'Nota crédito',
  nota_debito: 'Nota débito',
  recibo_caja: 'Recibo de caja',
  soporte_venta: 'Soporte de venta',
};

const STATUS_LABEL: Record<Exclude<DocStatus, 'all'>, string> = {
  pagada: 'Pagada',
  pendiente: 'Pendiente',
  vencida: 'Vencida',
  anulada: 'Anulada',
};

const STATUS_COLOR: Record<Exclude<DocStatus, 'all'>, string> = {
  pagada: 'success',
  pendiente: 'warning',
  vencida: 'danger',
  anulada: 'secondary',
};

const MOCK_CLIENTES = [
  'Acme SAS',
  'Global Corp SAS',
  'XYZ Logistics',
  'Tienda Colombia SAS',
  'Servicios Unidos SAS',
];

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n || 0);

const toISO = (d: Date) => d.toISOString().slice(0, 10);

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
};

const firstDayOfMonth = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return toISO(d);
};

const lastDayOfMonth = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1, 0);
  return toISO(d);
};

const firstDayOfYear = () => {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), 0, 1));
};

const getCurrentUserName = (): string => {
  try {
    const raw = sessionStorage.getItem('authUser');
    const authUser = raw ? JSON.parse(raw) : null;
    const u = authUser?.user;
    if (!u) return '';
    const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    return full || u.name || u.email || '';
  } catch {
    return '';
  }
};

const DocumentoIngreso: React.FC = () => {
  const [panelOpen, setPanelOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<IncomeDocumentRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros
  const [cliente, setCliente] = useState('');
  const [clienteFocus, setClienteFocus] = useState(false);
  const [startDate, setStartDate] = useState(daysAgo(15));
  const [endDate, setEndDate] = useState(daysAgo(0));
  const [usuario, setUsuario] = useState(getCurrentUserName());
  const [tipo, setTipo] = useState<DocType>('all');
  const [estado, setEstado] = useState<DocStatus>('all');

  const clienteSuggestions = useMemo(() => {
    const q = cliente.trim().toLowerCase();
    if (!q) return MOCK_CLIENTES;
    return MOCK_CLIENTES.filter(c => c.toLowerCase().includes(q));
  }, [cliente]);

  const applyShortcut = (which: 'this_month' | 'last_month' | 'last_15' | 'this_year') => {
    switch (which) {
      case 'this_month':
        setStartDate(firstDayOfMonth(0));
        setEndDate(toISO(new Date()));
        break;
      case 'last_month':
        setStartDate(firstDayOfMonth(-1));
        setEndDate(lastDayOfMonth(-1));
        break;
      case 'last_15':
        setStartDate(daysAgo(15));
        setEndDate(toISO(new Date()));
        break;
      case 'this_year':
        setStartDate(firstDayOfYear());
        setEndDate(toISO(new Date()));
        break;
    }
  };

  const clearFilters = () => {
    setCliente('');
    setStartDate(daysAgo(15));
    setEndDate(daysAgo(0));
    setUsuario(getCurrentUserName());
    setTipo('all');
    setEstado('all');
  };

  const fetchResults = async () => {
    setLoading(true);
    setHasSearched(true);
    // TODO: backend
    // const params = new URLSearchParams();
    // if (cliente) params.set('clientId', cliente);
    // if (startDate) params.set('startDate', startDate);
    // if (endDate) params.set('endDate', endDate);
    // if (tipo !== 'all') params.set('type', tipo);
    // if (estado !== 'all') params.set('status', estado);
    // const res = await fetch(`${API_BASE}/accounting/income-documents?${params}`, { headers });
    // const data = await res.json();
    // setRows(data);
    await new Promise(resolve => setTimeout(resolve, 500));
    setRows([]);
    setLoading(false);
  };

  const handleExport = () => {
    // TODO: backend
  };

  const total = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.total) || 0), 0),
    [rows]
  );

  return (
    <Card className="shadow-sm mb-3">
      <CardBody>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div className="fw-semibold fs-15">
            <i className="ri-filter-3-line me-1 text-muted" />
            Criterios de búsqueda
          </div>
          <div className="d-flex gap-2">
            <Button
              color="light"
              size="sm"
              onClick={() => setPanelOpen(o => !o)}
              title={panelOpen ? 'Ocultar criterios' : 'Mostrar criterios'}
            >
              <i className={`${panelOpen ? 'ri-filter-off-line' : 'ri-filter-line'} me-1`} />
              {panelOpen ? 'Ocultar criterios de búsqueda' : 'Mostrar criterios de búsqueda'}
            </Button>
            <Button color="light" size="sm" onClick={handleExport}>
              <i className="ri-download-line me-1" />
              Exportar
            </Button>
          </div>
        </div>

        <Collapse isOpen={panelOpen}>
          <div className="border rounded p-3 mb-3 bg-light-subtle">
            <Form onSubmit={e => { e.preventDefault(); void fetchResults(); }}>
              <Row className="g-3">
                <Col md={6} lg={4}>
                  <FormGroup className="mb-0 position-relative">
                    <Label className="fs-13">Cliente</Label>
                    <Input
                      type="text"
                      placeholder="Buscar cliente…"
                      value={cliente}
                      onChange={e => setCliente(e.target.value)}
                      onFocus={() => setClienteFocus(true)}
                      onBlur={() => setTimeout(() => setClienteFocus(false), 150)}
                      autoComplete="off"
                    />
                    {clienteFocus && clienteSuggestions.length > 0 && (
                      <div
                        className="position-absolute bg-white border rounded shadow-sm w-100 mt-1"
                        style={{ zIndex: 10, maxHeight: 200, overflowY: 'auto' }}
                      >
                        {clienteSuggestions.map(c => (
                          <div
                            key={c}
                            className="px-3 py-2 cursor-pointer"
                            style={{ cursor: 'pointer' }}
                            onMouseDown={() => {
                              setCliente(c);
                              setClienteFocus(false);
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <i className="ri-user-line me-2 text-muted" />
                            {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </FormGroup>
                </Col>

                <Col md={6} lg={4}>
                  <FormGroup className="mb-0">
                    <Label className="fs-13">Fecha desde</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                    />
                  </FormGroup>
                </Col>

                <Col md={6} lg={4}>
                  <FormGroup className="mb-0">
                    <Label className="fs-13">Fecha hasta</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                    />
                  </FormGroup>
                </Col>

                <Col md={12}>
                  <div className="d-flex flex-wrap gap-2">
                    <Button
                      color="light"
                      size="sm"
                      outline
                      onClick={() => applyShortcut('this_month')}
                    >
                      Este mes
                    </Button>
                    <Button
                      color="light"
                      size="sm"
                      outline
                      onClick={() => applyShortcut('last_month')}
                    >
                      Último mes
                    </Button>
                    <Button
                      color="light"
                      size="sm"
                      outline
                      onClick={() => applyShortcut('last_15')}
                    >
                      Últimos 15 días
                    </Button>
                    <Button
                      color="light"
                      size="sm"
                      outline
                      onClick={() => applyShortcut('this_year')}
                    >
                      Este año
                    </Button>
                  </div>
                </Col>

                <Col md={6} lg={4}>
                  <FormGroup className="mb-0">
                    <Label className="fs-13">Usuario</Label>
                    <Input
                      type="text"
                      placeholder="carlos hernando roa pachon"
                      value={usuario}
                      onChange={e => setUsuario(e.target.value)}
                    />
                  </FormGroup>
                </Col>

                <Col md={6} lg={4}>
                  <FormGroup className="mb-0">
                    <Label className="fs-13">Tipo de documento</Label>
                    <Input
                      type="select"
                      value={tipo}
                      onChange={e => setTipo(e.target.value as DocType)}
                    >
                      <option value="all">Todos</option>
                      <option value="factura">Factura de venta</option>
                      <option value="nota_credito">Nota crédito</option>
                      <option value="nota_debito">Nota débito</option>
                      <option value="recibo_caja">Recibo de caja</option>
                      <option value="soporte_venta">Soporte de venta</option>
                    </Input>
                  </FormGroup>
                </Col>

                <Col md={6} lg={4}>
                  <FormGroup className="mb-0">
                    <Label className="fs-13">Estado</Label>
                    <Input
                      type="select"
                      value={estado}
                      onChange={e => setEstado(e.target.value as DocStatus)}
                    >
                      <option value="all">Todos</option>
                      <option value="pagada">Pagada</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="vencida">Vencida</option>
                      <option value="anulada">Anulada</option>
                    </Input>
                  </FormGroup>
                </Col>

                <Col md={12}>
                  <div className="d-flex gap-2 justify-content-end">
                    <Button color="light" onClick={clearFilters} disabled={loading}>
                      <i className="ri-eraser-line me-1" />
                      Limpiar filtros
                    </Button>
                    <Button color="primary" type="submit" disabled={loading}>
                      <i className="ri-search-line me-1" />
                      {loading ? 'Buscando…' : 'Buscar'}
                    </Button>
                  </div>
                </Col>
              </Row>
            </Form>
          </div>
        </Collapse>

        {/* Resultados */}
        {loading ? (
          <Alert color="light" className="text-center mb-0">
            <i className="ri-loader-4-line fs-32 text-muted d-block mb-2" />
            <div className="text-muted fs-13">Buscando documentos…</div>
          </Alert>
        ) : rows.length === 0 ? (
          <Alert color="light" className="text-center mb-0 py-5">
            <i className="ri-search-eye-line fs-48 text-muted d-block mb-3" />
            <div className="fw-semibold fs-15 mb-1">
              {hasSearched
                ? 'No se encontraron resultados para tu búsqueda'
                : 'Realiza una búsqueda para ver los documentos'}
            </div>
            <div className="text-muted fs-13">
              Ajusta los filtros o limpialos para ver todos los documentos
            </div>
          </Alert>
        ) : (
          <>
            <Row className="g-3 mb-3">
              <Col md={4}>
                <div className="text-muted fs-12">Documentos encontrados</div>
                <div className="fs-20 fw-semibold">{rows.length}</div>
              </Col>
              <Col md={4}>
                <div className="text-muted fs-12">Total</div>
                <div className="fs-20 fw-semibold font-monospace">{money(total)}</div>
              </Col>
              <Col md={4}>
                <div className="text-muted fs-12">Rango</div>
                <Badge color="info" className="fs-12">
                  {startDate} → {endDate}
                </Badge>
              </Col>
            </Row>

            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 110 }}>Fecha</th>
                    <th>Documento</th>
                    <th>Cliente</th>
                    <th style={{ width: 120 }}>Estado</th>
                    <th className="text-end" style={{ width: 140 }}>Total</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td className="font-monospace fs-13">{r.fecha}</td>
                      <td>
                        <div className="fw-medium">{DOC_TYPE_LABEL[r.tipo]}</div>
                        <div className="text-muted fs-12">{r.numero}</div>
                      </td>
                      <td>{r.cliente}</td>
                      <td>
                        <Badge color={STATUS_COLOR[r.estado]} className="fs-11">
                          {STATUS_LABEL[r.estado]}
                        </Badge>
                      </td>
                      <td className="text-end font-monospace">{money(r.total)}</td>
                      <td className="text-end">
                        <Button
                          color="link"
                          size="sm"
                          className="p-1"
                          title="Ver"
                          onClick={() => { /* TODO: backend */ }}
                        >
                          <i className="ri-eye-line" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};

export default DocumentoIngreso;
