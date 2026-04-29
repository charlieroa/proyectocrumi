import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Offcanvas,
  OffcanvasBody,
  OffcanvasHeader,
  Spinner,
  Table,
} from 'reactstrap';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { API_BASE, money, useAuthHeaders } from '../shared';

type TemplateLine = {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description: string;
  third_party_document: string;
  third_party_name: string;
};

type TemplateSummary = {
  id: number;
  name: string;
  description: string | null;
  voucher_type: string;
  times_used: number;
  last_used_at: string | null;
  lines_count: number;
};

type TemplateDetail = TemplateSummary & { lines: TemplateLine[] };

type AccountOption = { id?: number; code: string; name: string };
type ThirdOption = { id?: number; document_number: string; name: string };

const VOUCHER_TYPES = [
  { value: 'AJUSTE_CONTABLE', label: 'Ajuste contable' },
  { value: 'COMPROBANTE_INGRESO', label: 'Comprobante de ingreso' },
  { value: 'COMPROBANTE_EGRESO', label: 'Comprobante de egreso' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyLine = (): TemplateLine => ({
  account_code: '',
  account_name: '',
  debit: 0,
  credit: 0,
  description: '',
  third_party_document: '',
  third_party_name: '',
});

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return iso;
  }
};

const PlantillasAsiento: React.FC = () => {
  const getHeaders = useAuthHeaders();

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [thirds, setThirds] = useState<ThirdOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateDetail | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [voucherType, setVoucherType] = useState('AJUSTE_CONTABLE');
  const [lines, setLines] = useState<TemplateLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [applyTpl, setApplyTpl] = useState<TemplateDetail | null>(null);
  const [applyDate, setApplyDate] = useState(todayISO());
  const [applyMultiplier, setApplyMultiplier] = useState<number>(1);
  const [applyDescription, setApplyDescription] = useState('');
  const [applying, setApplying] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/journal-templates`, { headers: getHeaders });
      const data = await res.json();
      if (data.success) setTemplates(data.templates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/chart-of-accounts`, { headers: getHeaders });
      const data = await res.json();
      if (data.success) setAccounts(data.accounts || data.chartOfAccounts || []);
    } catch (e) {
      console.error(e);
    }
  }, [getHeaders]);

  const loadThirds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/third-parties`, { headers: getHeaders });
      const data = await res.json();
      if (data.success) setThirds(data.thirdParties || []);
    } catch (e) {
      console.error(e);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const ensureCatalogs = useCallback(async () => {
    if (!accounts.length) await loadAccounts();
    if (!thirds.length) await loadThirds();
  }, [accounts.length, thirds.length, loadAccounts, loadThirds]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return {
      debit,
      credit,
      diff: debit - credit,
      balanced: Math.abs(debit - credit) < 0.01 && debit > 0,
    };
  }, [lines]);

  const previewLines = useMemo(() => {
    if (!applyTpl) return [] as TemplateLine[];
    const m = Number(applyMultiplier) || 0;
    return applyTpl.lines.map((l) => ({
      ...l,
      debit: Math.round((Number(l.debit) || 0) * m * 100) / 100,
      credit: Math.round((Number(l.credit) || 0) * m * 100) / 100,
    }));
  }, [applyTpl, applyMultiplier]);

  const previewTotals = useMemo(() => {
    const debit = previewLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = previewLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 && debit > 0 };
  }, [previewLines]);

  const openCreate = async () => {
    setEditing(null);
    setName('');
    setDescription('');
    setVoucherType('AJUSTE_CONTABLE');
    setLines([emptyLine(), emptyLine()]);
    setErrorMsg(null);
    setEditorOpen(true);
    await ensureCatalogs();
  };

  const openEdit = async (id: number) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/journal-templates/${id}`, { headers: getHeaders });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error cargando plantilla');
      const tpl: TemplateDetail = data.template;
      setEditing(tpl);
      setName(tpl.name);
      setDescription(tpl.description || '');
      setVoucherType(tpl.voucher_type || 'AJUSTE_CONTABLE');
      setLines(
        Array.isArray(tpl.lines) && tpl.lines.length
          ? tpl.lines.map((l) => ({ ...emptyLine(), ...l }))
          : [emptyLine(), emptyLine()],
      );
      setEditorOpen(true);
      await ensureCatalogs();
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const openApply = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/journal-templates/${id}`, { headers: getHeaders });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error cargando plantilla');
      const tpl: TemplateDetail = data.template;
      tpl.lines = Array.isArray(tpl.lines) ? tpl.lines : [];
      setApplyTpl(tpl);
      setApplyDate(todayISO());
      setApplyMultiplier(1);
      setApplyDescription(tpl.description || tpl.name);
      setApplyOpen(true);
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const handleAccountChange = (idx: number, value: string) => {
    const match = accounts.find(
      (a) => a.code === value || a.name === value || `${a.code} - ${a.name}` === value,
    );
    if (match) {
      updateLine(idx, { account_code: match.code, account_name: match.name });
    } else {
      updateLine(idx, { account_code: value });
    }
  };

  const handleThirdChange = (idx: number, value: string) => {
    const match = thirds.find(
      (t) => t.document_number === value || t.name === value || `${t.document_number} - ${t.name}` === value,
    );
    if (match) {
      updateLine(idx, { third_party_document: match.document_number, third_party_name: match.name });
    } else {
      updateLine(idx, { third_party_document: value });
    }
  };

  const updateLine = (idx: number, patch: Partial<TemplateLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setErrorMsg(null);
    if (!name.trim()) {
      setErrorMsg('Ingresa un nombre para la plantilla');
      return;
    }
    if (!totals.balanced) {
      setErrorMsg('La plantilla debe cuadrar (débitos = créditos) y tener montos > 0');
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `${API_BASE}/journal-templates/${editing.id}`
        : `${API_BASE}/journal-templates`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders,
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          voucher_type: voucherType,
          lines,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'No se pudo guardar');
      setEditorOpen(false);
      await loadTemplates();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmRes = await Swal.fire({
      icon: 'question',
      title: '¿Confirmar?',
      text: '¿Eliminar esta plantilla?',
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A1D1F',
    });
    if (!confirmRes.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/journal-templates/${id}`, {
        method: 'DELETE',
        headers: getHeaders,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'No se pudo eliminar');
      await loadTemplates();
    } catch (e: any) {
      Swal.fire({ icon: 'error', title: e.message, confirmButtonColor: '#1A1D1F' });
    }
  };

  const handleApply = async () => {
    if (!applyTpl) return;
    if (!previewTotals.balanced) {
      setErrorMsg('La plantilla escalada no cuadra. Revisa el multiplicador.');
      return;
    }
    setApplying(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/journal-templates/${applyTpl.id}/apply`, {
        method: 'POST',
        headers: getHeaders,
        body: JSON.stringify({
          date: applyDate,
          descriptionOverride: applyDescription,
          multiplier: Number(applyMultiplier) || 1,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'No se pudo aplicar');
      Swal.fire({ icon: 'success', title: `Asiento generado: ${data.journalEntry?.entryNumber || data.journalEntry?.id}`, confirmButtonColor: '#1A1D1F' });
      setApplyOpen(false);
      setApplyTpl(null);
      await loadTemplates();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-1">Plantillas de asientos</h4>
          <div className="text-muted">
            Guarda asientos recurrentes (depreciación, diferidos, nómina) y aplícalos con un clic cada mes.
          </div>
        </div>
        <Button color="primary" onClick={openCreate}>
          <i className="ri-add-line me-1" /> Nueva plantilla
        </Button>
      </div>

      {errorMsg && !editorOpen && !applyOpen && (
        <Alert color="danger" className="d-flex align-items-start gap-3 mb-3">
          <i className="ri-error-warning-line fs-20 mt-1" />
          <div className="flex-grow-1">
            <strong>No pudimos conectar con el servidor</strong>
            <div className="fs-13 mt-1">
              {String(errorMsg).toLowerCase().includes('fetch') || String(errorMsg).toLowerCase().includes('network')
                ? 'El backend no responde. Revisa que esté corriendo (npm start en crumi/back) o ajusta VITE_API_URL en front/.env.'
                : String(errorMsg)}
            </div>
            <Button size="sm" color="danger" outline className="mt-2" onClick={() => { setErrorMsg(null); loadTemplates(); }}>
              Reintentar
            </Button>
          </div>
        </Alert>
      )}

      <Card>
        <CardBody>
          {loading ? (
            <div className="text-center py-5">
              <Spinner /> <span className="ms-2">Cargando plantillas…</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="ri-file-list-3-line" style={{ fontSize: 48 }} />
              <div className="mt-2">No tienes plantillas guardadas. Crea la primera con el botón de arriba.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <Table className="align-middle mb-0" hover>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th className="text-end"># líneas</th>
                    <th className="text-end">Veces usada</th>
                    <th>Último uso</th>
                    <th style={{ width: 280 }} className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id}>
                      <td className="fw-semibold">{t.name}</td>
                      <td className="text-muted" style={{ maxWidth: 280 }}>
                        <div className="text-truncate">{t.description || '—'}</div>
                      </td>
                      <td>
                        <Badge color="light" className="text-dark">
                          {VOUCHER_TYPES.find((v) => v.value === t.voucher_type)?.label || t.voucher_type}
                        </Badge>
                      </td>
                      <td className="text-end">{t.lines_count}</td>
                      <td className="text-end">{t.times_used}</td>
                      <td>{formatDate(t.last_used_at)}</td>
                      <td className="text-end">
                        <Button size="sm" color="success" className="me-1" onClick={() => openApply(t.id)}>
                          <i className="ri-play-line" /> Aplicar
                        </Button>
                        <Button size="sm" color="light" className="me-1" onClick={() => openEdit(t.id)}>
                          <i className="ri-pencil-line" /> Editar
                        </Button>
                        <Button size="sm" color="danger" outline onClick={() => handleDelete(t.id)}>
                          <i className="ri-delete-bin-line" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <datalist id="puc-plantillas">
        {accounts.map((a) => (
          <option key={a.code} value={`${a.code} - ${a.name}`} />
        ))}
      </datalist>
      <datalist id="thirds-plantillas">
        {thirds.map((t) => (
          <option key={t.document_number} value={`${t.document_number} - ${t.name}`} />
        ))}
      </datalist>

      <Offcanvas isOpen={editorOpen} toggle={() => setEditorOpen(false)} direction="end" style={{ width: 620 }}>
        <OffcanvasHeader toggle={() => setEditorOpen(false)}>
          {editing ? 'Editar plantilla' : 'Nueva plantilla'}
        </OffcanvasHeader>
        <OffcanvasBody>
          {errorMsg && <div className="alert alert-danger py-2">{errorMsg}</div>}

          <div className="mb-3">
            <Label className="form-label">Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Depreciación mensual equipos" />
          </div>

          <div className="mb-3">
            <Label className="form-label">Descripción</Label>
            <Input
              type="textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Texto que aparecerá como descripción del asiento generado"
            />
          </div>

          <div className="mb-3">
            <Label className="form-label">Tipo de comprobante</Label>
            <Input type="select" value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>
              {VOUCHER_TYPES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Input>
          </div>

          <div className="mb-2 d-flex justify-content-between align-items-center">
            <strong>Líneas</strong>
            <Button size="sm" color="light" onClick={addLine}>
              <i className="ri-add-line" /> agregar línea
            </Button>
          </div>

          <div className="table-responsive mb-3">
            <Table size="sm" bordered className="mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ minWidth: 180 }}>Cuenta</th>
                  <th style={{ minWidth: 140 }}>Tercero</th>
                  <th style={{ minWidth: 110 }} className="text-end">Débito</th>
                  <th style={{ minWidth: 110 }} className="text-end">Crédito</th>
                  <th style={{ minWidth: 140 }}>Descripción</th>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={idx}>
                    <td>
                      <Input
                        list="puc-plantillas"
                        value={l.account_code ? `${l.account_code}${l.account_name ? ' - ' + l.account_name : ''}` : ''}
                        onChange={(e) => handleAccountChange(idx, e.target.value)}
                        placeholder="Cuenta PUC"
                      />
                    </td>
                    <td>
                      <Input
                        list="thirds-plantillas"
                        value={
                          l.third_party_document
                            ? `${l.third_party_document}${l.third_party_name ? ' - ' + l.third_party_name : ''}`
                            : ''
                        }
                        onChange={(e) => handleThirdChange(idx, e.target.value)}
                        placeholder="Opcional"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="text-end"
                        value={l.debit || ''}
                        onChange={(e) => updateLine(idx, { debit: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="text-end"
                        value={l.credit || ''}
                        onChange={(e) => updateLine(idx, { credit: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <Input
                        value={l.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                      />
                    </td>
                    <td className="text-center">
                      <Button
                        size="sm"
                        color="link"
                        className="text-danger p-0"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 2}
                      >
                        <i className="ri-close-line" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="d-flex justify-content-between align-items-center p-2 rounded mb-3"
               style={{ background: totals.balanced ? '#e7f5ec' : '#fdecec' }}>
            <div>
              <div className="small text-muted">Total débito / crédito</div>
              <div>
                <strong>{money(totals.debit)}</strong> / <strong>{money(totals.credit)}</strong>
              </div>
            </div>
            <Badge color={totals.balanced ? 'success' : 'danger'}>
              {totals.balanced ? 'Cuadra' : `Diferencia: ${money(totals.diff)}`}
            </Badge>
          </div>

          <div className="d-flex gap-2">
            <Button color="primary" onClick={handleSave} disabled={!totals.balanced || !name.trim() || saving}>
              {saving ? <Spinner size="sm" /> : <i className="ri-save-line me-1" />}
              Guardar plantilla
            </Button>
            <Button color="light" onClick={() => setEditorOpen(false)}>
              Cancelar
            </Button>
          </div>
        </OffcanvasBody>
      </Offcanvas>

      <Offcanvas isOpen={applyOpen} toggle={() => setApplyOpen(false)} direction="end" style={{ width: 620 }}>
        <OffcanvasHeader toggle={() => setApplyOpen(false)}>
          Aplicar plantilla{applyTpl ? `: ${applyTpl.name}` : ''}
        </OffcanvasHeader>
        <OffcanvasBody>
          {errorMsg && <div className="alert alert-danger py-2">{errorMsg}</div>}

          {applyTpl && (
            <>
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <Label className="form-label">Fecha del asiento</Label>
                  <Input type="date" value={applyDate} onChange={(e) => setApplyDate(e.target.value)} />
                </div>
                <div className="col-6">
                  <Label className="form-label">Multiplicador</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={applyMultiplier}
                    onChange={(e) => setApplyMultiplier(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="mb-3">
                <Label className="form-label">Descripción</Label>
                <Input
                  type="textarea"
                  rows={2}
                  value={applyDescription}
                  onChange={(e) => setApplyDescription(e.target.value)}
                />
              </div>

              <div className="table-responsive mb-3">
                <Table size="sm" bordered className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Cuenta</th>
                      <th>Tercero</th>
                      <th className="text-end">Débito</th>
                      <th className="text-end">Crédito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewLines.map((l, i) => (
                      <tr key={i}>
                        <td>
                          <div className="fw-semibold">{l.account_code}</div>
                          <div className="small text-muted">{l.account_name}</div>
                        </td>
                        <td className="small">
                          {l.third_party_document
                            ? `${l.third_party_document}${l.third_party_name ? ' - ' + l.third_party_name : ''}`
                            : '—'}
                        </td>
                        <td className="text-end">{money(l.debit)}</td>
                        <td className="text-end">{money(l.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <div className="d-flex justify-content-between align-items-center p-2 rounded mb-3"
                   style={{ background: previewTotals.balanced ? '#e7f5ec' : '#fdecec' }}>
                <div>
                  <div className="small text-muted">Total débito / crédito</div>
                  <div>
                    <strong>{money(previewTotals.debit)}</strong> / <strong>{money(previewTotals.credit)}</strong>
                  </div>
                </div>
                <Badge color={previewTotals.balanced ? 'success' : 'danger'}>
                  {previewTotals.balanced ? 'Cuadra' : 'No cuadra'}
                </Badge>
              </div>

              <Button
                color="primary"
                size="lg"
                block
                className="w-100"
                disabled={!previewTotals.balanced || applying}
                onClick={handleApply}
              >
                {applying ? <Spinner size="sm" /> : <i className="ri-flashlight-line me-1" />}
                Generar asiento
              </Button>
            </>
          )}
        </OffcanvasBody>
      </Offcanvas>
    </div>
  );
};

export default PlantillasAsiento;
