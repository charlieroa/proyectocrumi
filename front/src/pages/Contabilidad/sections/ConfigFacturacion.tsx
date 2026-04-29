import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Input,
  Label,
  Progress,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import { API_ROOT, useAuthHeaders } from '../shared';
import { getFeStatus, FeStatus } from '../../../services/feStatusApi';

type InvoicingStatus = {
  success?: boolean;
  sandboxMode?: boolean;
  needsElectronicInvoice?: boolean;
  hasCompanyData?: boolean;
  companyRegistered?: boolean;
  testSetStatus?: string;
  resolutionConfigured?: boolean;
  resolutionRegisteredInAlegra?: boolean;
  resolution?: { number?: string; prefix?: string; rangeStart?: number; rangeEnd?: number };
  companyName?: string;
  nit?: string;
  invoicingReady?: boolean;
  missingSteps?: string[];
};

type AlegraConfig = {
  success?: boolean;
  config?: {
    baseUrl?: string;
    sandboxMode?: boolean;
    hasToken?: boolean;
    companyId?: string;
    testSetStatus?: string;
    governmentId?: string;
  };
};

type CatalogItem = { id?: string | number; code?: string; name?: string };

type Resolution = {
  id?: string | number;
  prefix?: string;
  number?: string | number;
  resolutionNumber?: string;
  rangeStart?: number;
  rangeEnd?: number;
  dateFrom?: string;
  dateTo?: string;
  type?: string;
};

const STEPS = [
  { id: 1, label: 'Introducción', icon: 'ri-information-line' },
  { id: 2, label: 'Empresa', icon: 'ri-building-line' },
  { id: 3, label: 'Resolución', icon: 'ri-file-list-3-line' },
  { id: 4, label: 'Habilitación DIAN', icon: 'ri-shield-check-line' },
  { id: 5, label: 'Listo para emitir', icon: 'ri-rocket-line' },
];

const testSetBadge = (status?: string) => {
  const s = (status || 'DESCONOCIDO').toUpperCase();
  if (s.includes('APROBAD') || s === 'ACCEPTED') return { color: 'success', label: 'APROBADO' };
  if (s.includes('RECHAZ') || s === 'REJECTED') return { color: 'danger', label: 'RECHAZADO' };
  if (s.includes('PROCESO') || s === 'IN_PROGRESS' || s === 'PENDING') return { color: 'warning', label: 'EN PROCESO' };
  if (s === 'DESCONOCIDO' || !status) return { color: 'secondary', label: 'DESCONOCIDO' };
  return { color: 'info', label: s };
};

const ConfigFacturacion: React.FC = () => {
  const headers = useAuthHeaders();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [step, setStep] = useState<number>(1);
  const [userTouchedStep, setUserTouchedStep] = useState(false);

  const [invoicing, setInvoicing] = useState<InvoicingStatus | null>(null);
  const [config, setConfig] = useState<AlegraConfig | null>(null);
  const [feStatus, setFeStatus] = useState<FeStatus | null>(null);
  useEffect(() => {
    getFeStatus().then((r) => setFeStatus(r.data)).catch(() => {});
  }, []);
  const [departments, setDepartments] = useState<CatalogItem[]>([]);
  const [regimes, setRegimes] = useState<CatalogItem[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loadingResolutions, setLoadingResolutions] = useState(false);

  // Company form
  const [companyForm, setCompanyForm] = useState({
    name: '',
    nit: '',
    taxRegime: '',
    department: '',
    city: '',
  });

  // Resolution form
  const [resoForm, setResoForm] = useState({
    prefix: '',
    number: '',
    rangeStart: '',
    rangeEnd: '',
    dateFrom: '',
    dateTo: '',
    type: 'production',
    technicalKey: '',
    resolutionDate: '',
  });

  const safeJson = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const urls = [
        `${API_ROOT}/alegra/invoicing-status`,
        `${API_ROOT}/alegra/config`,
        `${API_ROOT}/alegra/dian/departments`,
        `${API_ROOT}/alegra/dian/tax-regimes`,
      ];
      const results = await Promise.allSettled(urls.map((u) => fetch(u, { headers })));
      const [inv, cfg, dep, reg] = results;

      if (inv.status === 'fulfilled') {
        const j = await safeJson(inv.value);
        if (j) setInvoicing(j);
      } else {
        setFetchError('No fue posible consultar el estado de facturación.');
      }
      if (cfg.status === 'fulfilled') {
        const j = await safeJson(cfg.value);
        if (j) setConfig(j);
      }
      if (dep.status === 'fulfilled') {
        const j = await safeJson(dep.value);
        const list = j?.departments || j?.data || j || [];
        if (Array.isArray(list)) setDepartments(list);
      }
      if (reg.status === 'fulfilled') {
        const j = await safeJson(reg.value);
        const list = j?.taxRegimes || j?.regimes || j?.data || j || [];
        if (Array.isArray(list)) setRegimes(list);
      }
    } catch (e: any) {
      setFetchError(e?.message || 'Error cargando datos.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-detect initial step once data loaded
  useEffect(() => {
    if (loading || userTouchedStep || !invoicing) return;
    const testOk = testSetBadge(invoicing.testSetStatus).label === 'APROBADO';
    if (testOk) setStep(5);
    else if (invoicing.resolutionConfigured) setStep(4);
    else if (invoicing.companyRegistered) setStep(3);
    else if (invoicing.hasCompanyData) setStep(2);
    else setStep(1);
  }, [loading, invoicing, userTouchedStep]);

  // Prefill company form when data available
  useEffect(() => {
    if (invoicing) {
      setCompanyForm((f) => ({
        ...f,
        name: f.name || invoicing.companyName || '',
        nit: f.nit || invoicing.nit || '',
      }));
    }
  }, [invoicing]);

  const completedMap = useMemo(() => {
    const map: Record<number, boolean> = {};
    map[1] = true;
    map[2] = !!invoicing?.companyRegistered;
    map[3] = !!invoicing?.resolutionConfigured;
    map[4] = testSetBadge(invoicing?.testSetStatus).label === 'APROBADO';
    map[5] = map[2] && map[3] && map[4];
    return map;
  }, [invoicing]);

  const progressPct = useMemo(() => {
    const done = [1, 2, 3, 4, 5].filter((s) => completedMap[s]).length;
    return Math.round((done / 5) * 100);
  }, [completedMap]);

  const goNext = () => {
    setUserTouchedStep(true);
    setActionError(null);
    setActionSuccess(null);
    setStep((s) => Math.min(5, s + 1));
  };
  const goBack = () => {
    setUserTouchedStep(true);
    setActionError(null);
    setActionSuccess(null);
    setStep((s) => Math.max(1, s - 1));
  };
  const jumpTo = (s: number) => {
    setUserTouchedStep(true);
    setActionError(null);
    setActionSuccess(null);
    setStep(s);
  };

  const postJSON = async (url: string, body: any) => {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    });
    const j = await safeJson(res);
    if (!res.ok || (j && j.success === false)) {
      throw new Error((j && (j.message || j.error)) || `Error en ${url}`);
    }
    return j;
  };

  const handleRegisterCompany = async () => {
    if (!companyForm.name || !companyForm.nit) {
      setActionError('Ingresa al menos razón social y NIT.');
      return;
    }
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await postJSON(`${API_ROOT}/alegra/company/register`, companyForm);
      setActionSuccess('Empresa registrada en DIAN.');
      await fetchAll();
    } catch (e: any) {
      setActionError(e?.message || 'No se pudo registrar la empresa.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveResolution = async () => {
    const missing: string[] = [];
    if (!resoForm.prefix) missing.push('prefijo');
    if (!resoForm.number) missing.push('número');
    if (!resoForm.rangeStart) missing.push('rango inicial');
    if (!resoForm.rangeEnd) missing.push('rango final');
    if (!resoForm.dateFrom) missing.push('fecha inicio');
    if (!resoForm.dateTo) missing.push('fecha fin');
    if (!resoForm.technicalKey) missing.push('llave técnica');
    if (!resoForm.resolutionDate) missing.push('fecha de resolución');
    if (missing.length) {
      setActionError(`Faltan campos: ${missing.join(', ')}.`);
      return;
    }
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await postJSON(`${API_ROOT}/alegra/resolution/manual`, {
        prefix: resoForm.prefix,
        resolutionNumber: resoForm.number,
        number: resoForm.number,
        rangeStart: Number(resoForm.rangeStart),
        rangeEnd: Number(resoForm.rangeEnd),
        dateFrom: resoForm.dateFrom,
        dateTo: resoForm.dateTo,
        validFrom: resoForm.dateFrom,
        validUntil: resoForm.dateTo,
        type: resoForm.type,
        technicalKey: resoForm.technicalKey,
        resolutionDate: resoForm.resolutionDate,
      });
      setActionSuccess('Resolución guardada.');
      await fetchAll();
    } catch (e: any) {
      setActionError(e?.message || 'No se pudo guardar la resolución.');
    } finally {
      setBusy(false);
    }
  };

  const handleLoadResolutions = async () => {
    setLoadingResolutions(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_ROOT}/alegra/resolutions`, { headers });
      const j = await safeJson(res);
      const list = j?.resolutions || j?.data || j || [];
      if (Array.isArray(list)) setResolutions(list);
    } catch (e: any) {
      setActionError(e?.message || 'No se pudieron cargar resoluciones.');
    } finally {
      setLoadingResolutions(false);
    }
  };

  const handlePickResolution = (r: Resolution) => {
    setResoForm({
      prefix: r.prefix || '',
      number: String(r.number || r.resolutionNumber || ''),
      rangeStart: String(r.rangeStart || ''),
      rangeEnd: String(r.rangeEnd || ''),
      dateFrom: r.dateFrom || '',
      dateTo: r.dateTo || '',
      type: r.type || 'production',
      technicalKey: (r as any).technicalKey || '',
      resolutionDate: (r as any).resolutionDate || r.dateFrom || '',
    });
  };

  const handleGenerateTestSet = async () => {
    if (!window.confirm('Esto creará facturas ficticias en tu cuenta. ¿Continuar?')) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await postJSON(`${API_ROOT}/alegra/test-set/generate`, {});
      setActionSuccess('Documentos de prueba generados.');
      await fetchAll();
    } catch (e: any) {
      setActionError(e?.message || 'Error generando documentos.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendTestSet = async () => {
    if (!window.confirm('Se enviará el set de pruebas a la DIAN. ¿Continuar?')) return;
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await postJSON(`${API_ROOT}/alegra/test-set/send`, {});
      setActionSuccess('Set enviado a la DIAN.');
      await fetchAll();
    } catch (e: any) {
      setActionError(e?.message || 'Error enviando set.');
    } finally {
      setBusy(false);
    }
  };

  const renderHeader = () => (
    <div className="mb-4">
      <h3 className="mb-1">Configurar facturación electrónica</h3>
      <p className="text-muted fs-16 mb-3">
        Te guiamos paso a paso. Si algo ya está listo, lo marcamos en verde y avanzas.
      </p>
      <Progress value={progressPct} color="success" className="mb-3" style={{ height: 10 }} />
      <Row className="g-2">
        {STEPS.map((s) => {
          const done = completedMap[s.id];
          const active = step === s.id;
          return (
            <Col key={s.id} xs="6" md>
              <div
                role="button"
                onClick={() => jumpTo(s.id)}
                className={`p-2 rounded border text-center ${
                  active ? 'border-primary bg-primary-subtle' : 'border-light'
                }`}
                style={{ cursor: 'pointer' }}
              >
                <div className="d-flex align-items-center justify-content-center gap-1">
                  {done ? (
                    <i className="ri-checkbox-circle-fill text-success fs-18" />
                  ) : (
                    <span className={`badge bg-${active ? 'primary' : 'secondary'}`}>{s.id}</span>
                  )}
                  <span className="fw-medium">{s.label}</span>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>
    </div>
  );

  const renderFooter = (showNext = true, nextDisabled = false) => (
    <div className="d-flex justify-content-between mt-4 pt-3 border-top">
      <Button color="light" size="lg" onClick={goBack} disabled={step === 1}>
        <i className="ri-arrow-left-line me-1" /> Atrás
      </Button>
      {showNext && (
        <Button color="primary" size="lg" onClick={goNext} disabled={nextDisabled || step === 5}>
          Siguiente <i className="ri-arrow-right-line ms-1" />
        </Button>
      )}
    </div>
  );

  const renderStep1 = () => (
    <div>
      <div className="text-center mb-4">
        <i className="ri-information-line text-primary" style={{ fontSize: 64 }} />
        <h4 className="mt-2">¿Necesitas facturación electrónica?</h4>
      </div>
      <p className="fs-16">
        La facturación electrónica DIAN es el sistema oficial en Colombia para emitir facturas
        validadas ante la autoridad tributaria. Es obligatoria para la mayoría de empresas y
        responsables de IVA.
      </p>
      <p className="fs-16">
        En crumi te ayudamos a configurarla con el proveedor tecnológico autorizado por la DIAN.
      </p>
      <div className="mt-3">
        {invoicing?.needsElectronicInvoice ? (
          <Alert color="info">
            <i className="ri-checkbox-circle-line me-2" />
            Este sistema está configurado para emitir facturación electrónica.
          </Alert>
        ) : (
          <Alert color="warning">
            <i className="ri-alert-line me-2" />
            Puedes usar crumi sin facturación electrónica. Configúrala cuando la DIAN te lo exija.
          </Alert>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <div className="text-center mb-4">
        <i className="ri-building-line text-primary" style={{ fontSize: 64 }} />
        <h4 className="mt-2">Datos de tu empresa</h4>
      </div>
      {invoicing?.companyRegistered ? (
        <>
          <Alert color="success">
            <i className="ri-checkbox-circle-fill me-2" />
            Empresa registrada correctamente en DIAN.
          </Alert>
          <Table size="sm" borderless className="mb-0">
            <tbody>
              <tr>
                <td className="text-muted" style={{ width: 200 }}>Razón social</td>
                <td className="fw-medium">{invoicing?.companyName || '—'}</td>
              </tr>
              <tr>
                <td className="text-muted">NIT</td>
                <td className="fw-medium">{invoicing?.nit || '—'}</td>
              </tr>
              <tr>
                <td className="text-muted">Empresa registrada en DIAN</td>
                <td><Badge color="success">Sí</Badge></td>
              </tr>
              <tr>
                <td className="text-muted">Modo</td>
                <td>
                  <Badge color={config?.config?.sandboxMode ? 'warning' : 'success'}>
                    {config?.config?.sandboxMode ? 'Pruebas (sandbox)' : 'Producción'}
                  </Badge>
                </td>
              </tr>
            </tbody>
          </Table>
        </>
      ) : (
        <>
          <Alert color="warning">
            La empresa aún no está registrada en DIAN. Completa estos datos para registrarla.
          </Alert>
          <Row className="g-3">
            <Col md={6}>
              <Label>Razón social</Label>
              <Input
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              />
            </Col>
            <Col md={6}>
              <Label>NIT</Label>
              <Input
                value={companyForm.nit}
                onChange={(e) => setCompanyForm({ ...companyForm, nit: e.target.value })}
              />
            </Col>
            <Col md={6}>
              <Label>Régimen tributario</Label>
              <Input
                type="select"
                value={companyForm.taxRegime}
                onChange={(e) => setCompanyForm({ ...companyForm, taxRegime: e.target.value })}
              >
                <option value="">Selecciona...</option>
                {regimes.map((r, i) => (
                  <option key={i} value={String(r.code || r.id || r.name)}>
                    {r.name || r.code}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={6}>
              <Label>Departamento</Label>
              <Input
                type="select"
                value={companyForm.department}
                onChange={(e) => setCompanyForm({ ...companyForm, department: e.target.value })}
              >
                <option value="">Selecciona...</option>
                {departments.map((d, i) => (
                  <option key={i} value={String(d.code || d.id || d.name)}>
                    {d.name || d.code}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={6}>
              <Label>Municipio / Ciudad</Label>
              <Input
                value={companyForm.city}
                onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
              />
            </Col>
          </Row>
          <div className="mt-3">
            <Button color="primary" size="lg" onClick={handleRegisterCompany} disabled={busy}>
              {busy ? <Spinner size="sm" className="me-2" /> : <i className="ri-save-line me-2" />}
              Registrar empresa ante la DIAN
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div>
      <div className="text-center mb-4">
        <i className="ri-file-list-3-line text-primary" style={{ fontSize: 64 }} />
        <h4 className="mt-2">Resolución DIAN</h4>
      </div>
      <p className="fs-16">
        La resolución de facturación es el permiso que la DIAN emite para que tu empresa facture
        electrónicamente. Incluye un prefijo y un rango de numeración autorizado.
      </p>
      {invoicing?.resolutionConfigured && invoicing?.resolutionRegisteredInAlegra ? (
        <Alert color="success">
          <div className="fw-semibold mb-2">
            <i className="ri-checkbox-circle-fill me-2" />
            Resolución configurada y vinculada con DIAN
          </div>
          <Table size="sm" borderless className="mb-0">
            <tbody>
              <tr><td className="text-muted" style={{ width: 160 }}>Prefijo</td><td>{invoicing.resolution?.prefix || '—'}</td></tr>
              <tr><td className="text-muted">Número</td><td>{invoicing.resolution?.number || '—'}</td></tr>
              <tr><td className="text-muted">Rango</td><td>{invoicing.resolution?.rangeStart} — {invoicing.resolution?.rangeEnd}</td></tr>
            </tbody>
          </Table>
        </Alert>
      ) : (
        <>
          {invoicing?.resolutionConfigured && invoicing?.resolutionRegisteredInAlegra === false && (
            <Alert color="warning">
              <div className="fw-semibold mb-2">
                <i className="ri-alert-line me-2" />
                Falta vincular la resolución en MUISCA (DIAN)
              </div>
              <p className="mb-2">
                Tienes los datos cargados, pero la resolución todavía no aparece vinculada a tu
                NIT en la DIAN. Sin este paso, la DIAN rechaza las facturas con códigos
                FAD05e/FAD06.
              </p>
              <ol className="mb-2">
                <li>Ingresa al portal MUISCA con tu firma digital.</li>
                <li>Sistema de Factura Electrónica → <b>Habilitación</b> → fija fecha de inicio de producción.</li>
                <li>Numeración → <b>Solicitar resolución de FE de producción</b>.</li>
                <li>Numeración → <b>Asignación de software</b> → selecciona como proveedor tecnológico el de <b>NIT 900559088</b> y vincula tu prefijo.</li>
                <li>Vuelve aquí y presiona <b>Re-validar</b>.</li>
              </ol>
              <Button color="warning" size="sm" onClick={() => fetchAll()} disabled={busy}>
                {busy ? <Spinner size="sm" className="me-2" /> : <i className="ri-refresh-line me-2" />}
                Re-validar con la DIAN
              </Button>
            </Alert>
          )}
          <Row className="g-3">
            <Col md={3}>
              <Label>Prefijo</Label>
              <Input value={resoForm.prefix} onChange={(e) => setResoForm({ ...resoForm, prefix: e.target.value })} />
            </Col>
            <Col md={5}>
              <Label>Número de resolución</Label>
              <Input value={resoForm.number} onChange={(e) => setResoForm({ ...resoForm, number: e.target.value })} />
            </Col>
            <Col md={4}>
              <Label>Tipo</Label>
              <Input type="select" value={resoForm.type} onChange={(e) => setResoForm({ ...resoForm, type: e.target.value })}>
                <option value="production">Producción</option>
                <option value="test">Pruebas</option>
              </Input>
            </Col>
            <Col md={3}>
              <Label>Rango inicial</Label>
              <Input type="number" value={resoForm.rangeStart} onChange={(e) => setResoForm({ ...resoForm, rangeStart: e.target.value })} />
            </Col>
            <Col md={3}>
              <Label>Rango final</Label>
              <Input type="number" value={resoForm.rangeEnd} onChange={(e) => setResoForm({ ...resoForm, rangeEnd: e.target.value })} />
            </Col>
            <Col md={3}>
              <Label>Fecha inicio</Label>
              <Input type="date" value={resoForm.dateFrom} onChange={(e) => setResoForm({ ...resoForm, dateFrom: e.target.value })} />
            </Col>
            <Col md={3}>
              <Label>Fecha fin</Label>
              <Input type="date" value={resoForm.dateTo} onChange={(e) => setResoForm({ ...resoForm, dateTo: e.target.value })} />
            </Col>
            <Col md={6}>
              <Label>Fecha de la resolución</Label>
              <Input type="date" value={resoForm.resolutionDate} onChange={(e) => setResoForm({ ...resoForm, resolutionDate: e.target.value })} />
            </Col>
            <Col md={6}>
              <Label>Llave técnica (entregada por DIAN)</Label>
              <Input
                type="text"
                placeholder="40 caracteres hexadecimales"
                value={resoForm.technicalKey}
                onChange={(e) => setResoForm({ ...resoForm, technicalKey: e.target.value })}
              />
            </Col>
          </Row>
          <div className="mt-3 d-flex gap-2 flex-wrap">
            <Button color="primary" size="lg" onClick={handleSaveResolution} disabled={busy}>
              {busy ? <Spinner size="sm" className="me-2" /> : <i className="ri-save-line me-2" />}
              Guardar resolución
            </Button>
            <Button color="light" size="lg" onClick={handleLoadResolutions} disabled={loadingResolutions}>
              {loadingResolutions ? <Spinner size="sm" className="me-2" /> : <i className="ri-download-cloud-line me-2" />}
              Cargar resoluciones desde la DIAN
            </Button>
          </div>
          {resolutions.length > 0 && (
            <div className="mt-3">
              <h6>Resoluciones disponibles</h6>
              <Table size="sm" hover responsive>
                <thead>
                  <tr>
                    <th>Prefijo</th>
                    <th>Número</th>
                    <th>Rango</th>
                    <th>Vigencia</th>
                    <th>Tipo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {resolutions.map((r, i) => (
                    <tr key={i}>
                      <td>{r.prefix || '—'}</td>
                      <td>{r.number || r.resolutionNumber || '—'}</td>
                      <td>{r.rangeStart} — {r.rangeEnd}</td>
                      <td>{r.dateFrom || '—'} / {r.dateTo || '—'}</td>
                      <td>{r.type || '—'}</td>
                      <td>
                        <Button size="sm" color="primary" outline onClick={() => handlePickResolution(r)}>
                          Usar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderStep4 = () => {
    const badge = testSetBadge(invoicing?.testSetStatus);
    const approved = badge.label === 'APROBADO';
    return (
      <div>
        <div className="text-center mb-4">
          <i className="ri-shield-check-line text-primary" style={{ fontSize: 64 }} />
          <h4 className="mt-2">Habilitación DIAN (set de pruebas)</h4>
        </div>
        <p className="fs-16">
          La DIAN necesita que emitas un set de pruebas antes de habilitarte para producción.
        </p>
        <div className="mb-3">
          <span className="text-muted me-2">Estado actual:</span>
          <Badge color={badge.color} className="fs-14 px-3 py-2">{badge.label}</Badge>
        </div>
        {approved ? (
          <Alert color="success" className="text-center p-4">
            <i className="ri-checkbox-circle-fill" style={{ fontSize: 48 }} />
            <h5 className="mt-2 mb-1">Felicidades, estás habilitado para emitir en producción</h5>
            <p className="mb-0">Tu empresa completó el proceso de habilitación DIAN.</p>
          </Alert>
        ) : (
          <div className="d-flex gap-2 flex-wrap">
            <Button color="primary" size="lg" onClick={handleGenerateTestSet} disabled={busy}>
              {busy ? <Spinner size="sm" className="me-2" /> : <i className="ri-file-add-line me-2" />}
              Generar documentos de prueba
            </Button>
            <Button color="success" size="lg" onClick={handleSendTestSet} disabled={busy}>
              {busy ? <Spinner size="sm" className="me-2" /> : <i className="ri-send-plane-line me-2" />}
              Enviar set a DIAN
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderStep5 = () => {
    const companyOk = !!invoicing?.companyRegistered;
    const resoOk = !!invoicing?.resolutionConfigured;
    const alegraOk = !!invoicing?.resolutionRegisteredInAlegra;
    const testOk = testSetBadge(invoicing?.testSetStatus).label === 'APROBADO';
    const ready = !!invoicing?.invoicingReady;
    const row = (ok: boolean, label: string) => (
      <li className="mb-2">
        <i className={`me-2 ${ok ? 'ri-checkbox-circle-fill text-success' : 'ri-close-circle-fill text-danger'}`} />
        {label}
      </li>
    );
    return (
      <div>
        <div className="text-center mb-4">
          <i className="ri-rocket-line text-primary" style={{ fontSize: 64 }} />
          <h4 className="mt-2">Listo para emitir</h4>
        </div>
        <ul className="list-unstyled fs-16">
          {row(companyOk, 'Empresa registrada en DIAN')}
          {row(resoOk, 'Resolución DIAN cargada en el sistema')}
          {row(alegraOk, 'Resolución vinculada en MUISCA con tu proveedor tecnológico')}
          {row(testOk, 'Set de pruebas aprobado por la DIAN')}
        </ul>
        {ready ? (
          <Alert color="info">
            Ya puedes emitir facturas electrónicas desde el módulo de Facturación.{' '}
            <a href="/ingresos/factura-venta/crear">Crear nueva factura de venta</a>
          </Alert>
        ) : (
          <Alert color="warning">
            <div className="fw-semibold mb-1">Aún no estás listo para emitir.</div>
            {Array.isArray(invoicing?.missingSteps) && invoicing.missingSteps.length > 0 && (
              <ul className="mb-0">
                {invoicing.missingSteps.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            )}
          </Alert>
        )}
        <div className="d-flex gap-2 flex-wrap mt-3">
          <Button color="primary" size="lg" href="/contabilidad/dian" tag="a">
            <i className="ri-dashboard-line me-2" />
            Volver al panel de estado DIAN
          </Button>
          <Button color="light" size="lg" href="/contable/alegra" tag="a">
            <i className="ri-settings-4-line me-2" />
            Abrir configuración avanzada
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner color="primary" />
        <span className="ms-3 fs-16">Cargando configuración…</span>
      </div>
    );
  }

  return (
    <div className="d-flex justify-content-center">
      <Card className="shadow-sm w-100" style={{ maxWidth: 900 }}>
        <CardBody className="p-4">
          {feStatus && (
            <div className="mb-3">
              <Alert
                color={feStatus.ready ? 'success' : 'warning'}
                className="d-flex flex-wrap align-items-center gap-2 mb-2"
              >
                <i className={feStatus.ready ? 'ri-checkbox-circle-line fs-18' : 'ri-error-warning-line fs-18'} />
                <strong>
                  {feStatus.ready
                    ? 'Facturación electrónica lista para emitir.'
                    : 'Facturación electrónica incompleta — falta:'}
                </strong>
                {!feStatus.ready && feStatus.missing.map((m) => (
                  <Badge key={m} color="danger" className="fs-12">
                    {m === 'company' && 'Datos de empresa'}
                    {m === 'test_set' && 'Set de pruebas'}
                    {m === 'resolution' && 'Resolución DIAN'}
                    {m === 'resolution_muisca' && 'Vincular resolución en MUISCA'}
                    {m === 'fe_enabled' && 'Habilitar FE'}
                  </Badge>
                ))}
              </Alert>
              <div className="d-flex flex-wrap gap-2">
                <Badge color={feStatus.company.configured ? 'success' : 'secondary'} className="fs-12 px-3 py-2">
                  Datos de empresa: {feStatus.company.configured ? '✓' : '—'}
                </Badge>
                <Badge color={feStatus.test_set.ok ? 'success' : feStatus.test_set.configured ? 'warning' : 'secondary'} className="fs-12 px-3 py-2">
                  Set de pruebas: {feStatus.test_set.status || 'sin iniciar'}
                </Badge>
                <Badge color={feStatus.resolution.ok ? 'success' : feStatus.resolution.configured ? 'warning' : 'danger'} className="fs-12 px-3 py-2">
                  Resolución: {feStatus.resolution.ok
                    ? `${feStatus.resolution.prefix || ''} vigente hasta ${(feStatus.resolution.valid_until || '').slice(0, 10)}`
                    : feStatus.resolution.configured
                      ? feStatus.resolution.muisca_linked === false
                        ? 'cargada — falta vincular en MUISCA'
                        : 'configurada (revisar vigencia)'
                      : 'sin cargar'}
                </Badge>
                <Badge color={feStatus.fe_enabled ? 'success' : 'secondary'} className="fs-12 px-3 py-2">
                  FE habilitada: {feStatus.fe_enabled ? '✓' : '✗'}
                </Badge>
              </div>
            </div>
          )}
          {renderHeader()}

          {fetchError && <Alert color="danger">{fetchError}</Alert>}
          {actionError && <Alert color="danger" toggle={() => setActionError(null)}>{actionError}</Alert>}
          {actionSuccess && <Alert color="success" toggle={() => setActionSuccess(null)}>{actionSuccess}</Alert>}

          <div className="py-2">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </div>

          {renderFooter(step !== 5)}
        </CardBody>
      </Card>
    </div>
  );
};

export default ConfigFacturacion;
