import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, Col, Row, Spinner, Table } from 'reactstrap';
import { API_ROOT, useAuthHeaders } from '../shared';

type Invoicing = {
  success?: boolean;
  sandboxMode?: boolean;
  resolutionRequired?: boolean;
  needsElectronicInvoice?: boolean;
  hasCompanyData?: boolean;
  companyRegistered?: boolean;
  testSetStatus?: string;
  resolutionConfigured?: boolean;
  resolution?: { number?: string; prefix?: string; rangeStart?: number; rangeEnd?: number };
  companyName?: string;
  nit?: string;
};

type PayrollStatus = {
  success?: boolean;
  data?: {
    provider?: string;
    companyRegistered?: boolean;
    testSetStatus?: string;
    hasToken?: boolean;
    hasPayrollApiPath?: boolean;
    readyToSync?: boolean;
    companyName?: string;
    taxId?: string;
    stats?: { total_documents?: number; prepared_documents?: number; sent_documents?: number; failed_documents?: number };
  };
};

type ProviderStatus = {
  success?: boolean;
  provider?: string;
  connection?: any;
  jobsByStatus?: { status: string; count: number }[];
  recentEvents?: { event_type: string; created_at: string; payload?: any }[];
};

const tryJson = async (url: string, headers: any) => {
  try { const r = await fetch(url, { headers }); if (!r.ok) return null; return await r.json(); }
  catch { return null; }
};

const DianStatus: React.FC = () => {
  const headers = useAuthHeaders();
  const [invoicing, setInvoicing] = useState<Invoicing | null>(null);
  const [payroll, setPayroll] = useState<PayrollStatus | null>(null);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [inv, pay, prov] = await Promise.all([
        tryJson(`${API_ROOT}/alegra/invoicing-status`, headers),
        tryJson(`${API_ROOT}/alegra/payroll-electronic/status`, headers),
        tryJson(`${API_ROOT}/alegra/provider/status`, headers),
      ]);
      setInvoicing(inv);
      setPayroll(pay);
      setProvider(prov);
      setLoading(false);
    })();
  }, [headers]);

  if (loading) return <div className="text-center py-5"><Spinner color="primary" /></div>;

  const feReady = invoicing?.companyRegistered && invoicing?.testSetStatus === 'APROBADO' && invoicing?.resolutionConfigured;
  const neData = payroll?.data || {};
  const neReady = neData.companyRegistered && neData.testSetStatus === 'APROBADO' && neData.hasToken && neData.hasPayrollApiPath && neData.readyToSync;
  const neStats = neData.stats || {};

  return (
    <>
      <Row className="g-3 mb-3">
        <Col md={6}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="avatar-sm rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                    <i className="ri-government-line fs-22 text-primary" />
                  </div>
                  <h6 className="card-title mb-0">Facturación electrónica DIAN</h6>
                </div>
                {feReady
                  ? <Badge color="success" className="fs-12 px-3 py-2"><i className="ri-check-line me-1" />Lista para emitir</Badge>
                  : <Badge color="warning" className="fs-12 px-3 py-2">Pendiente</Badge>}
              </div>

              {!invoicing?.needsElectronicInvoice && (
                <div className="alert alert-light border mb-3 fs-12">
                  Este tenant está configurado para <strong>no emitir</strong> facturación electrónica. El módulo contable funciona igual sin facturación electrónica.
                </div>
              )}

              <Table size="sm" className="mb-3">
                <tbody>
                  <tr>
                    <td className="text-muted fs-12">Empresa</td>
                    <td className="text-end">{invoicing?.companyName || neData.companyName || '—'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fs-12">NIT</td>
                    <td className="text-end font-monospace">{invoicing?.nit || neData.taxId || '—'}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fs-12">Empresa ante la DIAN</td>
                    <td className="text-end">{invoicing?.companyRegistered ? <Badge color="success">Registrada</Badge> : <Badge color="warning">No registrada</Badge>}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fs-12">Test set (habilitación DIAN)</td>
                    <td className="text-end">
                      {invoicing?.testSetStatus === 'APROBADO' ? <Badge color="success">Aprobado</Badge> : <Badge color="warning">{invoicing?.testSetStatus || 'Pendiente'}</Badge>}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted fs-12">Resolución DIAN</td>
                    <td className="text-end">
                      {invoicing?.resolutionConfigured
                        ? <span className="font-monospace">{invoicing?.resolution?.prefix}-{invoicing?.resolution?.number} ({invoicing?.resolution?.rangeStart}–{invoicing?.resolution?.rangeEnd})</span>
                        : <Badge color="warning">Sin configurar</Badge>}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-muted fs-12">Modo</td>
                    <td className="text-end">
                      {invoicing?.sandboxMode ? <Badge color="info">Sandbox</Badge> : <Badge color="success">Producción</Badge>}
                    </td>
                  </tr>
                </tbody>
              </Table>

              <Button size="sm" color="soft-primary" href="/contable/alegra">
                Abrir configuración avanzada <i className="ri-external-link-line ms-1" />
              </Button>
            </CardBody>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="avatar-sm rounded-circle bg-info-subtle d-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                    <i className="ri-file-list-3-line fs-22 text-info" />
                  </div>
                  <h6 className="card-title mb-0">Nómina electrónica DIAN</h6>
                </div>
                {neReady
                  ? <Badge color="success" className="fs-12 px-3 py-2"><i className="ri-check-line me-1" />Lista</Badge>
                  : <Badge color="warning" className="fs-12 px-3 py-2">Pendiente</Badge>}
              </div>

              <Table size="sm" className="mb-3">
                <tbody>
                  <tr>
                    <td className="text-muted fs-12">Empresa ante la DIAN</td>
                    <td className="text-end">{neData.companyRegistered ? <Badge color="success">Registrada</Badge> : <Badge color="warning">No</Badge>}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fs-12">Test set</td>
                    <td className="text-end">{neData.testSetStatus === 'APROBADO' ? <Badge color="success">Aprobado</Badge> : <Badge color="warning">{neData.testSetStatus || '—'}</Badge>}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fs-12">Token del proveedor tecnológico</td>
                    <td className="text-end">{neData.hasToken ? <Badge color="success">Activo</Badge> : <Badge color="danger">No</Badge>}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fs-12">Ruta API nómina</td>
                    <td className="text-end">{neData.hasPayrollApiPath ? <Badge color="success">Configurada</Badge> : <Badge color="warning">Falta configurar</Badge>}</td>
                  </tr>
                  <tr>
                    <td className="text-muted fs-12">Listo para emitir</td>
                    <td className="text-end">{neData.readyToSync ? <Badge color="success">Sí</Badge> : <Badge color="warning">No</Badge>}</td>
                  </tr>
                </tbody>
              </Table>

              <div className="d-flex gap-3 mb-2 text-center">
                <div className="flex-fill border rounded p-2">
                  <div className="fs-18 fw-semibold font-monospace">{neStats.total_documents ?? 0}</div>
                  <div className="fs-11 text-muted">Total docs</div>
                </div>
                <div className="flex-fill border rounded p-2">
                  <div className="fs-18 fw-semibold font-monospace text-success">{neStats.sent_documents ?? 0}</div>
                  <div className="fs-11 text-muted">Emitidos</div>
                </div>
                <div className="flex-fill border rounded p-2">
                  <div className="fs-18 fw-semibold font-monospace text-warning">{neStats.prepared_documents ?? 0}</div>
                  <div className="fs-11 text-muted">Preparados</div>
                </div>
                <div className="flex-fill border rounded p-2">
                  <div className="fs-18 fw-semibold font-monospace text-danger">{neStats.failed_documents ?? 0}</div>
                  <div className="fs-11 text-muted">Fallidos</div>
                </div>
              </div>

              <Button size="sm" color="soft-info" href="/nomina-hub/nomina-electronica">
                Abrir nómina electrónica <i className="ri-external-link-line ms-1" />
              </Button>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {provider?.recentEvents && provider.recentEvents.length > 0 && (
        <Card className="shadow-sm">
          <CardBody>
            <h6 className="card-title mb-3"><i className="ri-history-line me-1" /> Eventos recientes del proveedor</h6>
            <Table size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                </tr>
              </thead>
              <tbody>
                {provider.recentEvents.slice(0, 10).map((e, i) => (
                  <tr key={i}>
                    <td className="fs-12">{new Date(e.created_at).toLocaleString('es-CO')}</td>
                    <td className="fs-12"><Badge color="light" className="text-dark">{e.event_type}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Card className="shadow-sm bg-light border-0 mt-3">
        <CardBody className="py-2 d-flex align-items-center gap-2">
          <i className="ri-shield-check-line text-success fs-20" />
          <div className="fs-12 text-muted">
            Endpoints de facturación electrónica, nómina electrónica y notas crédito/débito permanecen sin cambios. Este panel es solo monitoreo.
          </div>
        </CardBody>
      </Card>
    </>
  );
};

export default DianStatus;
