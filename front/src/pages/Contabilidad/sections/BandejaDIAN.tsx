import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  FormGroup,
  Input,
  Label,
  Offcanvas,
  OffcanvasBody,
  OffcanvasHeader,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { API_BASE, API_ROOT, money, useAuthHeaders, normalizeAccount } from '../shared';
import type { Account } from '../shared';
import PucPicker from '../../../Components/Contabilidad/PucPicker';

// Base de los endpoints de la bandeja. API_ROOT recorta el sufijo /accounting de
// API_URL, dejando la raíz /api; de ahí colgamos /ai-accounting.
const AI_BASE = `${API_ROOT}/ai-accounting`;

type InboxStatus = 'PENDIENTE' | 'CAUSADO' | 'REVISION' | 'ERROR' | 'DESCARTADO';
type InboxDirection = 'PURCHASE' | 'SALE' | 'UNKNOWN';
type InboxKind = 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'UNKNOWN';

type InboxDoc = {
  id: number;
  source: 'UPLOAD' | 'EMAIL';
  direction: InboxDirection;
  document_kind: InboxKind;
  cufe: string | null;
  document_number: string | null;
  issue_date: string | null;
  supplier_name: string | null;
  supplier_nit: string | null;
  total: number;
  currency: string;
  status: InboxStatus;
  min_confidence: number | null;
  journal_entry_id: number | null;
  accounts_payable_id: number | null;
  error_message: string | null;
  created_at: string;
};

type ProposedLine = {
  lineNo: number;
  description: string;
  quantity: number;
  unitPrice: number;
  base: number;
  ivaPct: number;
  puc_code: string;
  puc_name: string;
  confidence: number;
  source: string;
};

type UploadSummary = {
  received: number;
  causados: number;
  revision: number;
  errores: number;
  duplicados: number;
};

type InboxConfig = {
  tenant_id: number;
  enabled: boolean;
  imap_host: string | null;
  imap_port: number;
  imap_secure: boolean;
  imap_user: string | null;
  folder: string;
  has_password: boolean;
  last_poll_at: string | null;
  last_poll_status: 'OK' | 'ERROR' | null;
  last_poll_error: string | null;
  last_poll_summary: UploadSummary | null;
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const STATUS_COLOR: Record<InboxStatus, string> = {
  CAUSADO: 'success',
  REVISION: 'warning',
  PENDIENTE: 'secondary',
  ERROR: 'danger',
  DESCARTADO: 'dark',
};

const STATUS_LABEL: Record<InboxStatus, string> = {
  CAUSADO: 'Causado',
  REVISION: 'Revisión',
  PENDIENTE: 'Pendiente',
  ERROR: 'Error',
  DESCARTADO: 'Descartado',
};

const DIRECTION_LABEL: Record<InboxDirection, string> = {
  PURCHASE: 'Compra',
  SALE: 'Venta',
  UNKNOWN: 'Sin clasificar',
};

const DIRECTION_COLOR: Record<InboxDirection, string> = {
  PURCHASE: 'warning',
  SALE: 'success',
  UNKNOWN: 'secondary',
};

const KIND_LABEL: Record<InboxKind, string> = {
  INVOICE: 'Factura',
  CREDIT_NOTE: 'Nota crédito',
  DEBIT_NOTE: 'Nota débito',
  UNKNOWN: 'Documento',
};

const confidencePct = (c: number | null | undefined) =>
  c == null ? '—' : `${Math.round(Number(c) * (Number(c) <= 1 ? 100 : 1))}%`;

const confidenceColor = (c: number | null | undefined) => {
  if (c == null) return 'secondary';
  const pct = Number(c) <= 1 ? Number(c) * 100 : Number(c);
  if (pct >= 80) return 'success';
  if (pct >= 50) return 'warning';
  return 'danger';
};

const BandejaDIAN: React.FC = () => {
  const headers = useAuthHeaders();
  // Headers para multipart: NO se debe fijar Content-Type (el browser pone el boundary).
  const authOnly = useMemo(() => ({ Authorization: headers.Authorization }), [headers]);

  const [docs, setDocs] = useState<InboxDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<string>('');

  const [accounts, setAccounts] = useState<Account[]>([]);

  // Detalle (Offcanvas)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDoc, setDetailDoc] = useState<InboxDoc | null>(null);
  const [detailLines, setDetailLines] = useState<ProposedLine[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [causing, setCausing] = useState(false);

  // Buzón automático (Offcanvas)
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxConfig, setInboxConfig] = useState<InboxConfig | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxSaving, setInboxSaving] = useState(false);
  const [inboxTesting, setInboxTesting] = useState(false);
  const [inboxPolling, setInboxPolling] = useState(false);

  // Campos del formulario del buzón
  const [cfgEnabled, setCfgEnabled] = useState(false);
  const [cfgHost, setCfgHost] = useState('');
  const [cfgPort, setCfgPort] = useState(993);
  const [cfgSecure, setCfgSecure] = useState(true);
  const [cfgUser, setCfgUser] = useState('');
  const [cfgPassword, setCfgPassword] = useState('');
  const [cfgFolder, setCfgFolder] = useState('INBOX');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.append('status', statusFilter);
      if (directionFilter) qs.append('direction', directionFilter);
      const res = await fetch(`${AI_BASE}/inbox?${qs.toString()}`, { headers });
      const data: { success?: boolean; documents?: InboxDoc[] } = await res.json();
      if (data?.success && Array.isArray(data.documents)) {
        setDocs(data.documents);
      } else {
        setDocs([]);
      }
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [headers, statusFilter, directionFilter]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/chart-of-accounts`, { headers });
      const data = await res.json();
      const list = data?.accounts || data?.chartOfAccounts || data?.data || [];
      if (Array.isArray(list)) setAccounts(list.map(normalizeAccount));
    } catch {
      setAccounts([]);
    }
  }, [headers]);

  const applyConfigToForm = useCallback((cfg: InboxConfig) => {
    setCfgEnabled(!!cfg.enabled);
    setCfgHost(cfg.imap_host || '');
    setCfgPort(cfg.imap_port || 993);
    setCfgSecure(cfg.imap_secure !== false);
    setCfgUser(cfg.imap_user || '');
    setCfgFolder(cfg.folder || 'INBOX');
    setCfgPassword('');
  }, []);

  const loadInboxConfig = useCallback(async () => {
    setInboxLoading(true);
    try {
      const res = await fetch(`${AI_BASE}/inbox/config`, { headers });
      const data: { success?: boolean; config?: InboxConfig } = await res.json();
      if (data?.success && data.config) {
        setInboxConfig(data.config);
        applyConfigToForm(data.config);
      }
    } catch {
      /* noop */
    } finally {
      setInboxLoading(false);
    }
  }, [headers, applyConfigToForm]);

  // Construye el body para PUT/test; password solo se envía si el usuario escribió una nueva.
  const buildConfigBody = useCallback(() => {
    const body: {
      enabled: boolean;
      imap_host: string;
      imap_port: number;
      imap_secure: boolean;
      imap_user: string;
      folder: string;
      password?: string;
    } = {
      enabled: cfgEnabled,
      imap_host: cfgHost.trim(),
      imap_port: Number(cfgPort) || 993,
      imap_secure: cfgSecure,
      imap_user: cfgUser.trim(),
      folder: cfgFolder.trim() || 'INBOX',
    };
    if (cfgPassword) body.password = cfgPassword;
    return body;
  }, [cfgEnabled, cfgHost, cfgPort, cfgSecure, cfgUser, cfgFolder, cfgPassword]);

  const openInbox = useCallback(() => {
    setInboxOpen(true);
    loadInboxConfig();
  }, [loadInboxConfig]);

  const testInbox = useCallback(async () => {
    setInboxTesting(true);
    try {
      const res = await fetch(`${AI_BASE}/inbox/config/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildConfigBody()),
      });
      const data: { success?: boolean; ok?: boolean; maxUid?: number; exists?: number; error?: string } =
        await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false || !data?.ok) {
        throw new Error(data?.error || `Error ${res.status} al probar la conexión.`);
      }
      await Swal.fire({
        icon: 'success',
        title: 'Conexión OK',
        text:
          data.exists != null
            ? `Se conectó al buzón. ${data.exists} mensaje${data.exists === 1 ? '' : 's'} en la carpeta.`
            : 'Se conectó correctamente al buzón.',
        confirmButtonColor: '#1A1D1F',
      });
    } catch (e: unknown) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo conectar',
        text: e instanceof Error ? e.message : 'Error inesperado al probar la conexión.',
        confirmButtonColor: '#1A1D1F',
      });
    } finally {
      setInboxTesting(false);
    }
  }, [headers, buildConfigBody]);

  const saveInbox = useCallback(async () => {
    setInboxSaving(true);
    try {
      const res = await fetch(`${AI_BASE}/inbox/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(buildConfigBody()),
      });
      const data: { success?: boolean; config?: InboxConfig; error?: string; message?: string } =
        await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `Error ${res.status} al guardar.`);
      }
      if (data.config) {
        setInboxConfig(data.config);
        applyConfigToForm(data.config);
      }
      await Swal.fire({
        icon: 'success',
        title: 'Configuración guardada',
        text: data.config?.enabled
          ? 'El buzón automático quedó activo. Se revisará cada 5 minutos.'
          : 'La configuración se guardó.',
        confirmButtonColor: '#1A1D1F',
        timer: 2000,
      });
    } catch (e: unknown) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar',
        text: e instanceof Error ? e.message : 'Error inesperado al guardar.',
        confirmButtonColor: '#1A1D1F',
      });
    } finally {
      setInboxSaving(false);
    }
  }, [headers, buildConfigBody, applyConfigToForm]);

  const pollInbox = useCallback(async () => {
    setInboxPolling(true);
    try {
      const res = await fetch(`${AI_BASE}/inbox/poll`, { method: 'POST', headers });
      const data: {
        success?: boolean;
        ok?: boolean;
        summary?: UploadSummary;
        error?: string;
        skipped?: boolean;
        reason?: string;
      } = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `Error ${res.status} al revisar el buzón.`);
      }
      if (data.skipped) {
        await Swal.fire({
          icon: 'info',
          title: 'Revisión omitida',
          text: data.reason || 'No se realizó la revisión del buzón.',
          confirmButtonColor: '#1A1D1F',
        });
      } else if (!data.ok) {
        throw new Error(data.error || 'La revisión del buzón falló.');
      } else {
        const s = data.summary;
        if (s) {
          const parts = [
            `${s.causados} causada${s.causados === 1 ? '' : 's'}`,
            `${s.revision} en revisión`,
            `${s.errores} error${s.errores === 1 ? '' : 'es'}`,
            `${s.duplicados} duplicada${s.duplicados === 1 ? '' : 's'}`,
          ];
          await Swal.fire({
            icon: s.errores > 0 ? 'warning' : 'success',
            title: `Se recibieron ${s.received} documento${s.received === 1 ? '' : 's'}`,
            text: parts.join(', '),
            confirmButtonColor: '#1A1D1F',
          });
        } else {
          await Swal.fire({
            icon: 'success',
            title: 'Buzón revisado',
            text: 'No llegaron documentos nuevos.',
            confirmButtonColor: '#1A1D1F',
            timer: 1800,
          });
        }
      }
      await loadInboxConfig();
      await load();
    } catch (e: unknown) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo revisar el buzón',
        text: e instanceof Error ? e.message : 'Error inesperado.',
        confirmButtonColor: '#1A1D1F',
      });
    } finally {
      setInboxPolling(false);
    }
  }, [headers, loadInboxConfig, load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadInboxConfig();
  }, [loadInboxConfig]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setUploading(true);
      try {
        const fd = new FormData();
        acceptedFiles.forEach((f) => fd.append('files', f));
        const res = await fetch(`${AI_BASE}/inbox/upload`, {
          method: 'POST',
          headers: authOnly,
          body: fd,
        });
        const data: {
          success?: boolean;
          summary?: UploadSummary;
          documents?: InboxDoc[];
          error?: string;
          message?: string;
        } = await res.json().catch(() => ({}));

        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || data?.message || `Error ${res.status} al subir los archivos.`);
        }

        const s = data.summary;
        if (s) {
          const parts = [
            `${s.causados} causada${s.causados === 1 ? '' : 's'}`,
            `${s.revision} en revisión`,
            `${s.errores} error${s.errores === 1 ? '' : 'es'}`,
            `${s.duplicados} duplicada${s.duplicados === 1 ? '' : 's'}`,
          ];
          await Swal.fire({
            icon: s.errores > 0 ? 'warning' : 'success',
            title: `Se recibieron ${s.received} documento${s.received === 1 ? '' : 's'}`,
            text: parts.join(', '),
            confirmButtonColor: '#1A1D1F',
          });
        } else {
          await Swal.fire({
            icon: 'success',
            title: 'Archivos procesados',
            confirmButtonColor: '#1A1D1F',
            timer: 1800,
          });
        }
        await load();
      } catch (e: unknown) {
        await Swal.fire({
          icon: 'error',
          title: 'No se pudieron procesar los archivos',
          text: e instanceof Error ? e.message : 'Error inesperado al subir.',
          confirmButtonColor: '#1A1D1F',
        });
      } finally {
        setUploading(false);
      }
    },
    [authOnly, load],
  );

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    accept: {
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    disabled: uploading,
  });

  const openDetail = async (doc: InboxDoc) => {
    setDetailDoc(doc);
    setDetailLines([]);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`${AI_BASE}/inbox/${doc.id}`, { headers });
      const data: { success?: boolean; document?: InboxDoc; proposedLines?: ProposedLine[] } =
        await res.json();
      if (data?.success) {
        if (data.document) setDetailDoc(data.document);
        setDetailLines(Array.isArray(data.proposedLines) ? data.proposedLines : []);
      }
    } catch {
      /* noop — se muestra estado vacío */
    } finally {
      setDetailLoading(false);
    }
  };

  const setLinePuc = (lineNo: number, code: string) => {
    setDetailLines((prev) =>
      prev.map((l) => (l.lineNo === lineNo ? { ...l, puc_code: code } : l)),
    );
  };

  const causar = async () => {
    if (!detailDoc) return;
    setCausing(true);
    try {
      const body = {
        lines: detailLines.map((l) => ({ lineNo: l.lineNo, puc_code: l.puc_code })),
      };
      const res = await fetch(`${AI_BASE}/inbox/${detailDoc.id}/causar`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data: { success?: boolean; document?: InboxDoc; error?: string; message?: string } =
        await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `Error ${res.status} al causar.`);
      }
      await Swal.fire({
        icon: 'success',
        title: 'Documento causado',
        text: data.document?.journal_entry_id
          ? `Asiento contable #${data.document.journal_entry_id}`
          : undefined,
        confirmButtonColor: '#1A1D1F',
        timer: 1800,
      });
      setDetailOpen(false);
      await load();
    } catch (e: unknown) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo causar',
        text: e instanceof Error ? e.message : 'Error inesperado.',
        confirmButtonColor: '#1A1D1F',
      });
    } finally {
      setCausing(false);
    }
  };

  const discard = async (doc: InboxDoc) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: '¿Descartar documento?',
      html: `Se descartará <strong>${doc.document_number || 'el documento'}</strong>. No se contabilizará.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, descartar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`${AI_BASE}/inbox/${doc.id}/discard`, {
        method: 'POST',
        headers,
      });
      const data: { success?: boolean; error?: string; message?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `Error ${res.status}.`);
      }
      if (detailDoc?.id === doc.id) setDetailOpen(false);
      await load();
      Swal.fire({ icon: 'success', title: 'Documento descartado', confirmButtonColor: '#1A1D1F', timer: 1500 });
    } catch (e: unknown) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo descartar',
        text: e instanceof Error ? e.message : 'Error inesperado.',
        confirmButtonColor: '#1A1D1F',
      });
    }
  };

  return (
    <div>
      {/* ===================== CABECERA ===================== */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div className="d-flex align-items-center gap-2">
          <Badge
            color={inboxConfig?.enabled ? 'success' : 'secondary'}
            pill
            className="px-3 py-2"
          >
            {inboxConfig?.enabled ? '🟢 Buzón activo' : 'Buzón inactivo'}
          </Badge>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button color="light" type="button" onClick={openInbox}>
            <i className="ri-settings-3-line me-1" /> Buzón automático
          </Button>
          <Button color="primary" type="button" onClick={openFileDialog} disabled={uploading}>
            <i className="ri-upload-cloud-2-line me-1" /> Subir XML/ZIP
          </Button>
        </div>
      </div>

      {/* ===================== DROP ZONE ===================== */}
      <Card className="border-0 shadow-sm mb-3">
        <CardBody>
          <div
            {...getRootProps()}
            className="text-center"
            style={{
              border: `2px dashed ${isDragActive ? '#0d6efd' : '#ced4da'}`,
              borderRadius: 12,
              padding: '2.5rem 1rem',
              background: isDragActive ? 'rgba(13,110,253,0.05)' : '#f8f9fa',
              transition: 'all .15s ease',
            }}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <>
                <Spinner color="primary" />
                <p className="text-muted mt-3 mb-0">Procesando archivos y causando con IA…</p>
              </>
            ) : (
              <>
                <i className="ri-inbox-archive-line" style={{ fontSize: 44, color: '#0d6efd' }} />
                <p className="fw-medium mt-3 mb-1">
                  {isDragActive ? 'Suelta los archivos aquí…' : 'Arrastra tus XML o ZIP de facturas DIAN'}
                </p>
                <p className="text-muted small mb-3">
                  Soporta facturas de compra y venta (.xml) y comprobantes comprimidos (.zip). Puedes subir varios a la vez.
                </p>
                <Button color="primary" type="button" onClick={openFileDialog}>
                  <i className="ri-upload-cloud-2-line me-1" /> Seleccionar archivos
                </Button>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ===================== FILTROS ===================== */}
      <Card className="border-0 shadow-sm mb-3">
        <CardBody>
          <Row className="g-2 align-items-end">
            <Col md={3}>
              <Label className="form-label mb-1 small">Estado</Label>
              <Input type="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="CAUSADO">Causado</option>
                <option value="REVISION">Revisión</option>
                <option value="ERROR">Error</option>
                <option value="DESCARTADO">Descartado</option>
              </Input>
            </Col>
            <Col md={3}>
              <Label className="form-label mb-1 small">Dirección</Label>
              <Input type="select" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}>
                <option value="">Todas</option>
                <option value="PURCHASE">Compra</option>
                <option value="SALE">Venta</option>
                <option value="UNKNOWN">Sin clasificar</option>
              </Input>
            </Col>
            <Col md={6} className="text-md-end">
              <Button color="light" onClick={() => load()} disabled={loading}>
                <i className="ri-refresh-line me-1" /> Actualizar
              </Button>
            </Col>
          </Row>
        </CardBody>
      </Card>

      {/* ===================== TABLA ===================== */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="bg-white">
          <h6 className="mb-0">Documentos recibidos</h6>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-5">
              <i className="ri-inbox-line" style={{ fontSize: 48, color: '#adb5bd' }} />
              <p className="text-muted mt-3 mb-0">
                Tu bandeja está vacía. Sube XML o ZIP de facturas arriba y la IA las causará automáticamente.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Documento</th>
                    <th>Proveedor</th>
                    <th className="text-end">Total</th>
                    <th className="text-center">Confianza</th>
                    <th>Estado</th>
                    <th className="text-end" style={{ width: 130 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(d)}>
                      <td>{(d.issue_date || d.created_at || '').slice(0, 10) || '—'}</td>
                      <td>
                        <Badge color={DIRECTION_COLOR[d.direction]} className="me-1">
                          {DIRECTION_LABEL[d.direction]}
                        </Badge>
                        <div className="text-muted small">{KIND_LABEL[d.document_kind]}</div>
                      </td>
                      <td className="font-monospace">{d.document_number || '—'}</td>
                      <td>
                        <div className="fw-medium">{d.supplier_name || '—'}</div>
                        {d.supplier_nit && <div className="text-muted small">{d.supplier_nit}</div>}
                      </td>
                      <td className="text-end">${money(d.total)}</td>
                      <td className="text-center">
                        <Badge color={confidenceColor(d.min_confidence)} pill>
                          {confidencePct(d.min_confidence)}
                        </Badge>
                      </td>
                      <td>
                        <Badge color={STATUS_COLOR[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                        {d.journal_entry_id != null && (
                          <div className="text-success small mt-1">
                            <i className="ri-checkbox-circle-line me-1" />
                            Asiento #{d.journal_entry_id}
                          </div>
                        )}
                      </td>
                      <td className="text-end" onClick={(e) => e.stopPropagation()}>
                        <Button
                          color="link"
                          size="sm"
                          className="p-1"
                          title="Ver detalle"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(d);
                          }}
                        >
                          <i className="ri-eye-line" />
                        </Button>
                        {d.status !== 'DESCARTADO' && d.status !== 'CAUSADO' && (
                          <Button
                            color="link"
                            size="sm"
                            className="p-1 text-danger"
                            title="Descartar"
                            onClick={(e) => {
                              e.stopPropagation();
                              discard(d);
                            }}
                          >
                            <i className="ri-delete-bin-line" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ===================== DETALLE ===================== */}
      <Offcanvas
        direction="end"
        isOpen={detailOpen}
        toggle={() => setDetailOpen(!detailOpen)}
        style={{ width: '95vw', maxWidth: 980 }}
      >
        <OffcanvasHeader toggle={() => setDetailOpen(false)}>
          <div>
            <h5 className="mb-0">Detalle del documento</h5>
            <small className="text-muted">Revisa las cuentas propuestas por la IA y causa el documento</small>
          </div>
        </OffcanvasHeader>
        <OffcanvasBody className="px-4 py-3">
          {detailLoading && !detailDoc ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : detailDoc ? (
            <>
              {/* Resumen */}
              <Card className="border-0 shadow-sm mb-3" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)' }}>
                <CardBody>
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                    <div>
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>
                        {DIRECTION_LABEL[detailDoc.direction]} · {KIND_LABEL[detailDoc.document_kind]}
                      </div>
                      <div className="fs-5 fw-semibold">{detailDoc.supplier_name || '—'}</div>
                      {detailDoc.supplier_nit && <div className="text-muted small">{detailDoc.supplier_nit}</div>}
                    </div>
                    <div className="text-end">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Documento N°</div>
                      <div className="fs-5 fw-semibold font-monospace">{detailDoc.document_number || '—'}</div>
                      <Badge color={STATUS_COLOR[detailDoc.status]} className="mt-1">
                        {STATUS_LABEL[detailDoc.status]}
                      </Badge>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Row className="g-2 mb-3">
                <Col md={4}>
                  <Card className="border-0 shadow-sm h-100">
                    <CardBody className="py-3">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Fecha emisión</div>
                      <div className="fw-medium">{detailDoc.issue_date?.slice(0, 10) || '—'}</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-0 shadow-sm h-100">
                    <CardBody className="py-3">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>Total</div>
                      <div className="fw-medium">${money(detailDoc.total)} {detailDoc.currency || ''}</div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="border-0 shadow-sm h-100">
                    <CardBody className="py-3">
                      <div className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>CUFE</div>
                      <div className="fw-medium small text-truncate" title={detailDoc.cufe || ''}>
                        {detailDoc.cufe || '—'}
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {detailDoc.journal_entry_id != null && (
                <div className="alert alert-success py-2 small d-flex align-items-center">
                  <i className="ri-checkbox-circle-line me-2 fs-5" />
                  Documento ya contabilizado — asiento contable #{detailDoc.journal_entry_id}
                  {detailDoc.accounts_payable_id != null && ` · CxP #${detailDoc.accounts_payable_id}`}
                </div>
              )}

              {detailDoc.status === 'ERROR' && detailDoc.error_message && (
                <div className="alert alert-danger py-2 small d-flex align-items-start">
                  <i className="ri-error-warning-line me-2 fs-5" />
                  <div>
                    <strong>Error al procesar</strong>
                    <div>{detailDoc.error_message}</div>
                  </div>
                </div>
              )}

              <h6 className="mt-4 mb-2">Líneas y cuentas propuestas</h6>
              {detailLoading ? (
                <div className="text-center py-4">
                  <Spinner color="primary" size="sm" />
                </div>
              ) : detailLines.length === 0 ? (
                <div className="text-muted small mb-3">
                  No hay líneas propuestas para este documento.
                </div>
              ) : (
                <div className="table-responsive mb-3">
                  <Table size="sm" bordered className="align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Descripción</th>
                        <th className="text-end">Cant.</th>
                        <th className="text-end">V. unitario</th>
                        <th className="text-end">Base</th>
                        <th className="text-end">% IVA</th>
                        <th style={{ minWidth: 260 }}>Cuenta (PUC)</th>
                        <th className="text-center">Confianza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLines.map((l) => (
                        <tr key={l.lineNo}>
                          <td>{l.lineNo}</td>
                          <td>{l.description || '—'}</td>
                          <td className="text-end">{l.quantity}</td>
                          <td className="text-end">${money(l.unitPrice)}</td>
                          <td className="text-end">${money(l.base)}</td>
                          <td className="text-end">{l.ivaPct}%</td>
                          <td>
                            <PucPicker
                              value={l.puc_code}
                              onChange={(code) => setLinePuc(l.lineNo, code)}
                              accounts={accounts}
                              onCreated={(a) => setAccounts((p) => [...p, a as Account])}
                              disabled={detailDoc.status === 'CAUSADO' || detailDoc.status === 'DESCARTADO'}
                            />
                            {l.puc_name && <div className="text-muted small mt-1">{l.puc_name}</div>}
                          </td>
                          <td className="text-center">
                            <Badge color={confidenceColor(l.confidence)} pill>
                              {confidencePct(l.confidence)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              <div className="d-flex justify-content-end gap-2 mt-4">
                <Button color="light" onClick={() => setDetailOpen(false)} disabled={causing}>
                  Cerrar
                </Button>
                {detailDoc.status !== 'DESCARTADO' && detailDoc.status !== 'CAUSADO' && (
                  <Button color="danger" outline onClick={() => discard(detailDoc)} disabled={causing}>
                    <i className="ri-delete-bin-line me-1" /> Descartar
                  </Button>
                )}
                {detailDoc.status !== 'CAUSADO' && detailDoc.status !== 'DESCARTADO' && (
                  <Button color="primary" onClick={causar} disabled={causing || detailLines.length === 0}>
                    {causing ? (
                      <>
                        <Spinner size="sm" className="me-2" /> Causando…
                      </>
                    ) : (
                      <>
                        <i className="ri-check-double-line me-1" /> Causar documento
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </OffcanvasBody>
      </Offcanvas>

      {/* ===================== BUZÓN AUTOMÁTICO ===================== */}
      <Offcanvas
        direction="end"
        isOpen={inboxOpen}
        toggle={() => setInboxOpen(!inboxOpen)}
        style={{ width: '95vw', maxWidth: 520 }}
      >
        <OffcanvasHeader toggle={() => setInboxOpen(false)}>
          <div>
            <h5 className="mb-0">Buzón automático</h5>
            <small className="text-muted">Lee el correo donde llegan tus facturas electrónicas</small>
          </div>
        </OffcanvasHeader>
        <OffcanvasBody className="px-4 py-3">
          {inboxLoading && !inboxConfig ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : (
            <>
              <FormGroup switch className="mb-3">
                <Input
                  type="switch"
                  role="switch"
                  id="inbox-enabled"
                  checked={cfgEnabled}
                  onChange={(e) => setCfgEnabled(e.target.checked)}
                />
                <Label for="inbox-enabled" check className="fw-medium">
                  Activar buzón automático
                </Label>
              </FormGroup>

              <FormGroup>
                <Label className="form-label small mb-1">Servidor IMAP</Label>
                <Input
                  type="text"
                  placeholder="imap.gmail.com"
                  value={cfgHost}
                  onChange={(e) => setCfgHost(e.target.value)}
                />
              </FormGroup>

              <Row className="g-2">
                <Col xs={6}>
                  <FormGroup>
                    <Label className="form-label small mb-1">Puerto</Label>
                    <Input
                      type="number"
                      value={cfgPort}
                      onChange={(e) => setCfgPort(Number(e.target.value))}
                    />
                  </FormGroup>
                </Col>
                <Col xs={6} className="d-flex align-items-end">
                  <FormGroup switch className="mb-3">
                    <Input
                      type="switch"
                      role="switch"
                      id="inbox-secure"
                      checked={cfgSecure}
                      onChange={(e) => setCfgSecure(e.target.checked)}
                    />
                    <Label for="inbox-secure" check>
                      SSL/TLS
                    </Label>
                  </FormGroup>
                </Col>
              </Row>

              <FormGroup>
                <Label className="form-label small mb-1">Correo</Label>
                <Input
                  type="email"
                  placeholder="facturas@empresa.com"
                  value={cfgUser}
                  onChange={(e) => setCfgUser(e.target.value)}
                />
              </FormGroup>

              <FormGroup>
                <Label className="form-label small mb-1">
                  Contraseña / contraseña de aplicación
                </Label>
                <Input
                  type="password"
                  placeholder={
                    inboxConfig?.has_password ? '•••••••• (sin cambios)' : 'Contraseña de aplicación'
                  }
                  value={cfgPassword}
                  onChange={(e) => setCfgPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </FormGroup>

              <FormGroup>
                <Label className="form-label small mb-1">Carpeta</Label>
                <Input
                  type="text"
                  placeholder="INBOX"
                  value={cfgFolder}
                  onChange={(e) => setCfgFolder(e.target.value)}
                />
              </FormGroup>

              <p className="text-muted small">
                Para Gmail usa una &quot;contraseña de aplicación&quot; (no tu contraseña normal). El
                sistema revisa el buzón cada 5 minutos y causa automáticamente las facturas que
                lleguen.
              </p>

              {/* Estado de la última revisión */}
              {inboxConfig?.last_poll_at && (
                <Card className="border-0 shadow-sm mb-3" style={{ background: '#f8f9fa' }}>
                  <CardBody className="py-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small text-uppercase" style={{ letterSpacing: 0.5 }}>
                        Última revisión
                      </span>
                      {inboxConfig.last_poll_status && (
                        <Badge color={inboxConfig.last_poll_status === 'OK' ? 'success' : 'danger'}>
                          {inboxConfig.last_poll_status}
                        </Badge>
                      )}
                    </div>
                    <div className="small">{formatDateTime(inboxConfig.last_poll_at)}</div>
                    {inboxConfig.last_poll_summary && (
                      <div className="text-muted small mt-1">
                        {inboxConfig.last_poll_summary.causados} causadas ·{' '}
                        {inboxConfig.last_poll_summary.revision} en revisión ·{' '}
                        {inboxConfig.last_poll_summary.errores} errores ·{' '}
                        {inboxConfig.last_poll_summary.duplicados} duplicadas
                      </div>
                    )}
                    {inboxConfig.last_poll_error && (
                      <div className="text-danger small mt-1">{inboxConfig.last_poll_error}</div>
                    )}
                  </CardBody>
                </Card>
              )}

              <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
                <Button
                  color="light"
                  onClick={testInbox}
                  disabled={inboxTesting || inboxSaving || inboxPolling}
                >
                  {inboxTesting ? (
                    <>
                      <Spinner size="sm" className="me-2" /> Probando…
                    </>
                  ) : (
                    <>
                      <i className="ri-plug-line me-1" /> Probar conexión
                    </>
                  )}
                </Button>
                <Button
                  color="secondary"
                  outline
                  onClick={pollInbox}
                  disabled={inboxPolling || inboxSaving || inboxTesting}
                >
                  {inboxPolling ? (
                    <>
                      <Spinner size="sm" className="me-2" /> Revisando…
                    </>
                  ) : (
                    <>
                      <i className="ri-refresh-line me-1" /> Revisar ahora
                    </>
                  )}
                </Button>
                <Button
                  color="primary"
                  onClick={saveInbox}
                  disabled={inboxSaving || inboxTesting || inboxPolling}
                >
                  {inboxSaving ? (
                    <>
                      <Spinner size="sm" className="me-2" /> Guardando…
                    </>
                  ) : (
                    <>
                      <i className="ri-save-line me-1" /> Guardar
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </OffcanvasBody>
      </Offcanvas>
    </div>
  );
};

export default BandejaDIAN;
