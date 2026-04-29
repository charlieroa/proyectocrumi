import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Input,
  Label,
  Row,
  Table,
  Offcanvas,
  OffcanvasHeader,
  OffcanvasBody,
  Spinner,
  Collapse,
} from 'reactstrap';
import { API_BASE, money, useAuthHeaders, Account, ThirdParty, accountTypeColor, normalizeAccount } from '../shared';
import BulkUploadVouchersModal from '../../../Components/Common/BulkUploadVouchersModal';
import PucPicker from '../../../Components/Contabilidad/PucPicker';

type Props = { onSaved?: () => void };

type Line = {
  account_code: string;
  account_name: string;
  third_party_document: string;
  third_party_name: string;
  line_description: string;
  debit: number;
  credit: number;
  base_amount: number;
  tax_type: string;
  tax_rate: number;
  tax_amount: number;
  tax_treatment: string;
  dian_concept_code: string;
  fiscal_open: boolean;
};

type AiSuggestion = {
  lineIdx: number;
  accountCode: string;
  accountName: string;
  confidence: number;
  reasoning: string;
};

const VOUCHER_TYPES = [
  { value: 'AJUSTE_CONTABLE', label: 'Ajuste contable' },
  { value: 'COMPROBANTE_INGRESO', label: 'Comprobante de ingreso' },
  { value: 'COMPROBANTE_EGRESO', label: 'Comprobante de egreso' },
];

const TAX_TYPES = ['', 'IVA', 'INC', 'ICA', 'RETEFUENTE', 'RETEIVA', 'RETEICA'];
const TAX_TREATMENTS = ['', 'GENERADO', 'DESCONTABLE', 'MAYOR_VALOR_GASTO', 'MAYOR_VALOR_ACTIVO', 'RETENIDO'];
const DIAN_CONCEPTS = [
  { code: '', label: 'Sin concepto' },
  { code: '1001', label: '1001 Pagos/abonos' },
  { code: '1005', label: '1005 IVA descontable' },
  { code: '1006', label: '1006 IVA generado' },
  { code: '1007', label: '1007 Retenciones' },
  { code: '1008', label: '1008 ICA' },
  { code: '1009', label: '1009 Renta' },
  { code: '1010', label: '1010 Ingresos' },
  { code: '1011', label: '1011 CxC' },
  { code: '1012', label: '1012 CxP' },
];

const emptyLine = (): Line => ({
  account_code: '',
  account_name: '',
  third_party_document: '',
  third_party_name: '',
  line_description: '',
  debit: 0,
  credit: 0,
  base_amount: 0,
  tax_type: '',
  tax_rate: 0,
  tax_amount: 0,
  tax_treatment: '',
  dian_concept_code: '',
  fiscal_open: false,
});

const todayISO = () => new Date().toISOString().slice(0, 10);

const Captura: React.FC<Props> = ({ onSaved }) => {
  const getHeaders = useAuthHeaders();

  const [voucherType, setVoucherType] = useState('AJUSTE_CONTABLE');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [thirds, setThirds] = useState<ThirdParty[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);

  const [createAcctOpen, setCreateAcctOpen] = useState(false);
  const [createAcctForIdx, setCreateAcctForIdx] = useState<number | null>(null);
  const [createThirdOpen, setCreateThirdOpen] = useState(false);
  const [createThirdForIdx, setCreateThirdForIdx] = useState<number | null>(null);

  const loadRefs = useRef({ acct: false, third: false });

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/chart-of-accounts`, { headers: getHeaders });
      const data = await res.json();
      if (data.success) {
        const raw = data.accounts || data.chartOfAccounts || [];
        setAccounts(raw.map(normalizeAccount));
      }
    } catch (e) {
      console.error(e);
    }
  }, [getHeaders]);

  const loadThirds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting/third-parties`, { headers: getHeaders });
      const data = await res.json();
      if (data.success) {
        setThirds(data.thirdParties || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [getHeaders]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAccounts(), loadThirds()]).finally(() => setLoading(false));
  }, [loadAccounts, loadThirds]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit, credit, diff: debit - credit, balanced: Math.abs(debit - credit) < 0.01 && debit > 0 };
  }, [lines]);

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const handleAccountChange = (idx: number, value: string) => {
    const match = accounts.find((a) => a.code === value || a.name === value || `${a.code} - ${a.name}` === value);
    if (match) {
      updateLine(idx, { account_code: match.code, account_name: match.name });
    } else {
      updateLine(idx, { account_code: value, account_name: '' });
    }
  };

  const handleThirdChange = (idx: number, value: string) => {
    const match = thirds.find(
      (t) => t.document_number === value || t.name === value || `${t.document_number} - ${t.name}` === value
    );
    if (match) {
      updateLine(idx, { third_party_document: match.document_number, third_party_name: match.name });
    } else {
      updateLine(idx, { third_party_document: value, third_party_name: '' });
    }
  };

  const accountExists = (code: string) => !!accounts.find((a) => a.code === code);
  const thirdExists = (doc: string) => !!thirds.find((t) => t.document_number === doc);

  const addLine = () => setLines((p) => [...p, emptyLine()]);
  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines((p) => p.filter((_, i) => i !== idx));
  };

  const setDebit = (idx: number, v: number) => updateLine(idx, { debit: v, credit: v > 0 ? 0 : lines[idx].credit });
  const setCredit = (idx: number, v: number) => updateLine(idx, { credit: v, debit: v > 0 ? 0 : lines[idx].debit });

  const autoBalance = () => {
    const diff = totals.diff;
    if (Math.abs(diff) < 0.01) return;
    setLines((prev) => {
      const copy = [...prev];
      const last = copy.length - 1;
      if (diff > 0) {
        copy[last] = { ...copy[last], credit: (Number(copy[last].credit) || 0) + diff, debit: 0 };
      } else {
        copy[last] = { ...copy[last], debit: (Number(copy[last].debit) || 0) + Math.abs(diff), credit: 0 };
      }
      return copy;
    });
  };

  const resetForm = () => {
    setVoucherType('AJUSTE_CONTABLE');
    setDate(todayISO());
    setDescription('');
    setLines([emptyLine(), emptyLine()]);
    setAiSuggestion(null);
  };

  const save = async () => {
    if (!totals.balanced || saving) return;
    const valid = lines.filter((l) => l.account_code && (l.debit > 0 || l.credit > 0));
    if (valid.length < 2) return;
    setSaving(true);
    try {
      const payload = {
        voucherType,
        description,
        date,
        lines: valid.map((l) => {
          const base: any = {
            account_code: l.account_code,
            account_name: l.account_name,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            line_description: l.line_description || description,
          };
          if (l.third_party_document) base.third_party_document = l.third_party_document;
          if (l.third_party_name) base.third_party_name = l.third_party_name;
          if (l.base_amount) base.base_amount = Number(l.base_amount);
          if (l.tax_type) base.tax_type = l.tax_type;
          if (l.tax_rate) base.tax_rate = Number(l.tax_rate);
          if (l.tax_amount) base.tax_amount = Number(l.tax_amount);
          if (l.tax_treatment) base.tax_treatment = l.tax_treatment;
          if (l.dian_concept_code) base.dian_concept_code = l.dian_concept_code;
          return base;
        }),
      };
      const res = await fetch(`${API_BASE}/accounting/manual-vouchers`, {
        method: 'POST',
        headers: { ...getHeaders },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
        resetForm();
        onSaved?.();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const runAi = async (idx: number) => {
    const desc = lines[idx].line_description || description;
    if (!desc) return;
    setAiLoading(idx);
    try {
      const res = await fetch(`${API_BASE}/ai-accounting/classify`, {
        method: 'POST',
        headers: { ...getHeaders },
        body: JSON.stringify({ description: desc, documentType: voucherType }),
      });
      const data = await res.json();
      if (data.success && data.classification) {
        setAiSuggestion({
          lineIdx: idx,
          accountCode: data.classification.accountCode,
          accountName: data.classification.accountName,
          confidence: data.classification.confidence,
          reasoning: data.classification.reasoning,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(null);
    }
  };

  const applyAi = () => {
    if (!aiSuggestion) return;
    updateLine(aiSuggestion.lineIdx, {
      account_code: aiSuggestion.accountCode,
      account_name: aiSuggestion.accountName,
    });
    setAiSuggestion(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        addLine();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        autoBalance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const focusedAccount = focusIdx !== null ? accounts.find((a) => a.code === lines[focusIdx]?.account_code) : null;

  return (
    <div className="position-relative">
      {savedFlash && (
        <div className="position-absolute top-0 end-0 mt-1 me-1" style={{ zIndex: 5 }}>
          <Badge color="success" className="px-2 py-1">
            <i className="ri-check-line me-1" />
            Guardado
          </Badge>
        </div>
      )}

      <Card className="shadow-sm mb-2">
        <CardBody className="py-2">
          <Row className="g-2 align-items-end">
            <Col md={3}>
              <Label className="fs-12 mb-1">Tipo comprobante</Label>
              <Input type="select" bsSize="sm" value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>
                {VOUCHER_TYPES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={2}>
              <Label className="fs-12 mb-1">Fecha</Label>
              <Input type="date" bsSize="sm" value={date} onChange={(e) => setDate(e.target.value)} />
            </Col>
            <Col md={5}>
              <Label className="fs-12 mb-1">Descripción general</Label>
              <Input
                bsSize="sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Causación factura proveedor ABC"
              />
            </Col>
            <Col md={2}>
              <Button color="success" outline size="sm" className="w-100" onClick={() => setBulkOpen(true)}>
                <i className="ri-upload-2-line me-1" /> Carga masiva
              </Button>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <BulkUploadVouchersModal
        isOpen={bulkOpen}
        toggle={() => setBulkOpen(false)}
        onComplete={() => { onSaved?.(); }}
      />

      {aiSuggestion && (
        <Card className="shadow-sm mb-2 bg-info-subtle border-info">
          <CardBody className="py-2">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <div className="fw-semibold">
                  <i className="ri-sparkling-2-line me-1 text-info" />
                  Sugerencia IA (línea {aiSuggestion.lineIdx + 1}):{' '}
                  <span className="font-monospace">{aiSuggestion.accountCode}</span> — {aiSuggestion.accountName}
                </div>
                <div className="fs-12 text-muted">
                  Confianza: {Math.round(aiSuggestion.confidence * 100)}% · {aiSuggestion.reasoning}
                </div>
              </div>
              <div className="d-flex gap-2">
                <Button size="sm" color="info" onClick={applyAi}>
                  Aplicar
                </Button>
                <Button size="sm" color="light" onClick={() => setAiSuggestion(null)}>
                  Descartar
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <datalist id="dl-accounts">
        {accounts.map((a) => (
          <option key={a.id} value={a.code}>{`${a.code} - ${a.name}`}</option>
        ))}
      </datalist>
      <datalist id="dl-thirds">
        {thirds.map((t) => (
          <option key={t.id} value={t.document_number}>{`${t.document_number} - ${t.name}`}</option>
        ))}
      </datalist>

      <Row>
        <Col lg={focusedAccount ? 9 : 12}>
          <Card className="shadow-sm">
            <CardBody className="p-0">
              {loading ? (
                <div className="text-center p-4">
                  <Spinner size="sm" /> Cargando...
                </div>
              ) : (
                <Table size="sm" className="mb-0 align-middle" responsive>
                  <thead className="table-light">
                    <tr className="fs-12">
                      <th style={{ width: 30 }}>#</th>
                      <th style={{ minWidth: 200 }}>Cuenta</th>
                      <th style={{ minWidth: 180 }}>Tercero</th>
                      <th style={{ minWidth: 160 }}>Detalle</th>
                      <th style={{ minWidth: 110 }} className="text-end">Débito</th>
                      <th style={{ minWidth: 110 }} className="text-end">Crédito</th>
                      <th style={{ width: 130 }} className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => {
                      const acctMissing = l.account_code && !accountExists(l.account_code);
                      const thirdMissing = l.third_party_document && !thirdExists(l.third_party_document);
                      return (
                        <React.Fragment key={idx}>
                          <tr className={focusIdx === idx ? 'bg-light' : ''}>
                            <td className="text-muted fs-12">{idx + 1}</td>
                            <td onFocus={() => setFocusIdx(idx)}>
                              <div className="d-flex gap-1 align-items-start">
                                <div style={{ flex: 1 }}>
                                  <PucPicker
                                    value={l.account_code}
                                    onChange={(code) => handleAccountChange(idx, code)}
                                    accounts={accounts as any}
                                    placeholder="Buscar PUC…"
                                    size="sm"
                                  />
                                </div>
                                {acctMissing && (
                                  <Button
                                    size="sm"
                                    color="success"
                                    onClick={() => {
                                      setCreateAcctForIdx(idx);
                                      setCreateAcctOpen(true);
                                    }}
                                    title="Crear cuenta nueva"
                                  >
                                    <i className="ri-add-line" />
                                  </Button>
                                )}
                              </div>
                              {l.account_name && <div className="fs-11 text-muted">{l.account_name}</div>}
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <Input
                                  bsSize="sm"
                                  list="dl-thirds"
                                  className="font-monospace"
                                  value={l.third_party_document}
                                  placeholder="NIT/CC"
                                  onFocus={() => setFocusIdx(idx)}
                                  onChange={(e) => handleThirdChange(idx, e.target.value)}
                                />
                                {thirdMissing && (
                                  <Button
                                    size="sm"
                                    color="success"
                                    onClick={() => {
                                      setCreateThirdForIdx(idx);
                                      setCreateThirdOpen(true);
                                    }}
                                  >
                                    <i className="ri-add-line" />
                                  </Button>
                                )}
                              </div>
                              {l.third_party_name && <div className="fs-11 text-muted">{l.third_party_name}</div>}
                            </td>
                            <td>
                              <Input
                                bsSize="sm"
                                value={l.line_description}
                                onFocus={() => setFocusIdx(idx)}
                                onChange={(e) => updateLine(idx, { line_description: e.target.value })}
                                placeholder="(hereda general)"
                              />
                            </td>
                            <td>
                              <Input
                                bsSize="sm"
                                type="number"
                                className="font-monospace text-end"
                                value={l.debit || ''}
                                onFocus={() => setFocusIdx(idx)}
                                onChange={(e) => setDebit(idx, Number(e.target.value))}
                              />
                            </td>
                            <td>
                              <Input
                                bsSize="sm"
                                type="number"
                                className="font-monospace text-end"
                                value={l.credit || ''}
                                onFocus={() => setFocusIdx(idx)}
                                onChange={(e) => setCredit(idx, Number(e.target.value))}
                              />
                            </td>
                            <td className="text-end">
                              <Button
                                size="sm"
                                color="light"
                                title="Sugerir cuenta con IA"
                                onClick={() => runAi(idx)}
                                disabled={aiLoading === idx}
                              >
                                {aiLoading === idx ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <i className="ri-sparkling-2-line text-info" />
                                )}
                              </Button>{' '}
                              <Button
                                size="sm"
                                color="light"
                                title="Panel fiscal"
                                onClick={() => updateLine(idx, { fiscal_open: !l.fiscal_open })}
                              >
                                <i className={l.fiscal_open ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} />
                                <span className="fs-11 ms-1">Fiscal</span>
                              </Button>{' '}
                              {lines.length > 2 && (
                                <Button size="sm" color="light" onClick={() => removeLine(idx)} title="Eliminar">
                                  <i className="ri-delete-bin-line text-danger" />
                                </Button>
                              )}
                            </td>
                          </tr>
                          {l.fiscal_open && (
                          <tr>
                            <td colSpan={7} className="p-0 border-0">
                              <div className="bg-light px-3 py-2 border-top">
                                  <Row className="g-2">
                                    <Col md={2}>
                                      <Label className="fs-11 mb-0">Base gravable</Label>
                                      <Input
                                        bsSize="sm"
                                        type="number"
                                        className="font-monospace"
                                        value={l.base_amount || ''}
                                        onChange={(e) => updateLine(idx, { base_amount: Number(e.target.value) })}
                                      />
                                    </Col>
                                    <Col md={2}>
                                      <Label className="fs-11 mb-0">Tipo impuesto</Label>
                                      <Input
                                        bsSize="sm"
                                        type="select"
                                        value={l.tax_type}
                                        onChange={(e) => updateLine(idx, { tax_type: e.target.value })}
                                      >
                                        {TAX_TYPES.map((t) => (
                                          <option key={t} value={t}>
                                            {t || '—'}
                                          </option>
                                        ))}
                                      </Input>
                                    </Col>
                                    <Col md={1}>
                                      <Label className="fs-11 mb-0">Tarifa %</Label>
                                      <Input
                                        bsSize="sm"
                                        type="number"
                                        className="font-monospace"
                                        value={l.tax_rate || ''}
                                        onChange={(e) => updateLine(idx, { tax_rate: Number(e.target.value) })}
                                      />
                                    </Col>
                                    <Col md={2}>
                                      <Label className="fs-11 mb-0">Valor impuesto</Label>
                                      <Input
                                        bsSize="sm"
                                        type="number"
                                        className="font-monospace"
                                        value={l.tax_amount || ''}
                                        onChange={(e) => updateLine(idx, { tax_amount: Number(e.target.value) })}
                                      />
                                    </Col>
                                    <Col md={2}>
                                      <Label className="fs-11 mb-0">Tratamiento</Label>
                                      <Input
                                        bsSize="sm"
                                        type="select"
                                        value={l.tax_treatment}
                                        onChange={(e) => updateLine(idx, { tax_treatment: e.target.value })}
                                      >
                                        {TAX_TREATMENTS.map((t) => (
                                          <option key={t} value={t}>
                                            {t || '—'}
                                          </option>
                                        ))}
                                      </Input>
                                    </Col>
                                    <Col md={3}>
                                      <Label className="fs-11 mb-0">Concepto DIAN</Label>
                                      <Input
                                        bsSize="sm"
                                        type="select"
                                        value={l.dian_concept_code}
                                        onChange={(e) => updateLine(idx, { dian_concept_code: e.target.value })}
                                      >
                                        {DIAN_CONCEPTS.map((c) => (
                                          <option key={c.code} value={c.code}>
                                            {c.label}
                                          </option>
                                        ))}
                                      </Input>
                                    </Col>
                                  </Row>
                              </div>
                            </td>
                          </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan={4} className="text-end fw-semibold">
                        Totales
                      </td>
                      <td className="text-end font-monospace fw-semibold">{money(totals.debit)}</td>
                      <td className="text-end font-monospace fw-semibold">{money(totals.credit)}</td>
                      <td className="text-end">
                        {totals.balanced ? (
                          <Badge color="success">Cuadrado</Badge>
                        ) : (
                          <Badge color="danger">Descuadrado: {money(Math.abs(totals.diff))}</Badge>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </Table>
              )}
            </CardBody>
          </Card>

          <div className="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">
            <div className="d-flex gap-2">
              <Button size="sm" color="light" onClick={addLine}>
                <i className="ri-add-line me-1" />
                Agregar línea <span className="text-muted fs-11 ms-1">Ctrl+Enter</span>
              </Button>
              <Button size="sm" color="light" onClick={autoBalance} disabled={totals.balanced}>
                <i className="ri-scales-3-line me-1" />
                Cuadrar automático <span className="text-muted fs-11 ms-1">Ctrl+B</span>
              </Button>
            </div>
            <div className="d-flex gap-2">
              <Button size="sm" color="light" onClick={resetForm}>
                <i className="ri-eraser-line me-1" />
                Limpiar
              </Button>
              <Button size="sm" color="success" onClick={save} disabled={!totals.balanced || saving}>
                {saving ? <Spinner size="sm" /> : <i className="ri-save-line me-1" />}
                Guardar y nuevo <span className="fs-11 ms-1">Ctrl+S</span>
              </Button>
            </div>
          </div>
        </Col>

        {focusedAccount && (
          <Col lg={3}>
            <Card className="shadow-sm">
              <CardBody>
                <div className="fs-12 text-muted mb-1">Línea {focusIdx !== null ? focusIdx + 1 : ''}</div>
                <div className="fw-semibold font-monospace">{focusedAccount.code}</div>
                <div className="mb-2">{focusedAccount.name}</div>
                {focusedAccount.account_type && (
                  <Badge color={accountTypeColor(focusedAccount.account_type)} className="mb-2">
                    {focusedAccount.account_type}
                  </Badge>
                )}
                <div className="fs-11 text-muted mt-2">Saldo y últimos movimientos — próximo paso</div>
              </CardBody>
            </Card>
          </Col>
        )}
      </Row>

      <AccountQuickCreate
        isOpen={createAcctOpen}
        toggle={() => setCreateAcctOpen(false)}
        initialCode={createAcctForIdx !== null ? lines[createAcctForIdx]?.account_code : ''}
        onCreated={(acct) => {
          setAccounts((p) => [...p, acct]);
          if (createAcctForIdx !== null) {
            updateLine(createAcctForIdx, { account_code: acct.code, account_name: acct.name });
          }
          setCreateAcctOpen(false);
        }}
      />

      <ThirdQuickCreate
        isOpen={createThirdOpen}
        toggle={() => setCreateThirdOpen(false)}
        initialDoc={createThirdForIdx !== null ? lines[createThirdForIdx]?.third_party_document : ''}
        onCreated={(t) => {
          setThirds((p) => [...p, t]);
          if (createThirdForIdx !== null) {
            updateLine(createThirdForIdx, { third_party_document: t.document_number, third_party_name: t.name });
          }
          setCreateThirdOpen(false);
        }}
      />
    </div>
  );
};

const ACCOUNT_TYPES = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO'];

const AccountQuickCreate: React.FC<{
  isOpen: boolean;
  toggle: () => void;
  initialCode?: string;
  onCreated: (a: Account) => void;
}> = ({ isOpen, toggle, initialCode, onCreated }) => {
  const getHeaders = useAuthHeaders();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('ACTIVO');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCode(initialCode || '');
      setName('');
      setAccountType('ACTIVO');
    }
  }, [isOpen, initialCode]);

  const submit = async () => {
    if (!code || !name) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/accounting/chart-of-accounts`, {
        method: 'POST',
        headers: { ...getHeaders },
        body: JSON.stringify({ code, name, accountType }),
      });
      const data = await res.json();
      if (data.success && data.account) {
        onCreated(data.account);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Offcanvas isOpen={isOpen} toggle={toggle} direction="end">
      <OffcanvasHeader toggle={toggle}>Crear cuenta PUC</OffcanvasHeader>
      <OffcanvasBody>
        <Label className="fs-12 mb-1">Código</Label>
        <Input bsSize="sm" className="font-monospace mb-2" value={code} onChange={(e) => setCode(e.target.value)} />
        <Label className="fs-12 mb-1">Nombre</Label>
        <Input bsSize="sm" className="mb-2" value={name} onChange={(e) => setName(e.target.value)} />
        <Label className="fs-12 mb-1">Tipo</Label>
        <Input
          bsSize="sm"
          type="select"
          className="mb-3"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Input>
        <Button color="success" size="sm" onClick={submit} disabled={busy || !code || !name}>
          {busy ? <Spinner size="sm" /> : <i className="ri-save-line me-1" />}
          Crear cuenta
        </Button>
      </OffcanvasBody>
    </Offcanvas>
  );
};

const THIRD_KINDS = ['CLIENTE', 'PROVEEDOR', 'EMPLEADO', 'OTRO'];
const DOC_TYPES = ['NIT', 'CC', 'CE', 'PA', 'TI'];

const ThirdQuickCreate: React.FC<{
  isOpen: boolean;
  toggle: () => void;
  initialDoc?: string;
  onCreated: (t: ThirdParty) => void;
}> = ({ isOpen, toggle, initialDoc, onCreated }) => {
  const getHeaders = useAuthHeaders();
  const [kind, setKind] = useState('PROVEEDOR');
  const [documentType, setDocumentType] = useState('NIT');
  const [documentNumber, setDocumentNumber] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKind('PROVEEDOR');
      setDocumentType('NIT');
      setDocumentNumber(initialDoc || '');
      setName('');
      setEmail('');
    }
  }, [isOpen, initialDoc]);

  const submit = async () => {
    if (!documentNumber || !name) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/accounting/third-parties`, {
        method: 'POST',
        headers: { ...getHeaders },
        body: JSON.stringify({ kind, documentType, documentNumber, name, email }),
      });
      const data = await res.json();
      if (data.success && data.thirdParty) {
        onCreated(data.thirdParty);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Offcanvas isOpen={isOpen} toggle={toggle} direction="end">
      <OffcanvasHeader toggle={toggle}>Crear tercero</OffcanvasHeader>
      <OffcanvasBody>
        <Row className="g-2">
          <Col md={6}>
            <Label className="fs-12 mb-1">Tipo</Label>
            <Input bsSize="sm" type="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              {THIRD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Input>
          </Col>
          <Col md={6}>
            <Label className="fs-12 mb-1">Doc. tipo</Label>
            <Input bsSize="sm" type="select" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {DOC_TYPES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Input>
          </Col>
        </Row>
        <Label className="fs-12 mb-1 mt-2">Número documento</Label>
        <Input
          bsSize="sm"
          className="font-monospace mb-2"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
        />
        <Label className="fs-12 mb-1">Nombre / Razón social</Label>
        <Input bsSize="sm" className="mb-2" value={name} onChange={(e) => setName(e.target.value)} />
        <Label className="fs-12 mb-1">Email</Label>
        <Input bsSize="sm" type="email" className="mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button color="success" size="sm" onClick={submit} disabled={busy || !documentNumber || !name}>
          {busy ? <Spinner size="sm" /> : <i className="ri-save-line me-1" />}
          Crear tercero
        </Button>
      </OffcanvasBody>
    </Offcanvas>
  );
};

export default Captura;
