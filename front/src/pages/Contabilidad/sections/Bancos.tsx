import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Row,
  Col,
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Label,
  FormGroup,
  Form,
  Table,
  Spinner,
  Badge,
  Offcanvas,
  OffcanvasHeader,
  OffcanvasBody,
  InputGroup,
  InputGroupText,
  Alert,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';
import { API_BASE, money, useAuthHeaders } from '../shared';

interface BankTransaction {
  id: number | string;
  date: string;
  description: string;
  amount: number | string;
  direction: 'IN' | 'OUT';
  reference?: string;
  status?: string;
  bank_account_id?: number | string;
  bank_account_name?: string;
  journal_entry_id?: number | string | null;
  reconciliation_line_id?: number | string | null;
}

interface Candidate {
  bank_transaction_id: number | string;
  journal_entry_id: number | string | null;
  source_type: string;
  source_id: number | string;
  source_number?: string;
  match_confidence: number;
  bank_description?: string;
  bank_amount?: number;
  bank_date?: string;
  description?: string;
  amount?: number;
  movement_date?: string;
  entry_number?: string;
  entry_date?: string;
  entry_description?: string;
  entry_amount?: number;
}

interface ParsedBankRow {
  date: string;
  description: string;
  amount: number;
  direction: 'IN' | 'OUT';
  reference?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const Bancos: React.FC = () => {
  const headers = useAuthHeaders();

  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [error, setError] = useState<string>('');

  const [startDate, setStartDate] = useState<string>(firstDayOfMonthISO());
  const [endDate, setEndDate] = useState<string>(todayISO());
  const [accountId, setAccountId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RECONCILED' | 'PENDING'>('ALL');

  const [bankAccounts, setBankAccounts] = useState<{ id: string | number; name: string }[]>([]);

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    bankAccountId: '',
    date: todayISO(),
    description: '',
    amount: '',
    direction: 'IN' as 'IN' | 'OUT',
    reference: '',
    contraAccountCode: '',
    contraAccountName: '',
  });
  const [savingNew, setSavingNew] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState('');
  const [matching, setMatching] = useState<string | number | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [autoSelectHighConfidence, setAutoSelectHighConfidence] = useState(false);
  const [batchApplying, setBatchApplying] = useState(false);

  // Índice liviano de candidatos cargado en background para pintar el badge "Match sugerido"
  // en la tabla de movimientos sin bloquear el render. Se refresca cuando entran/salen
  // transacciones o cambia la cuenta filtrada.
  const [suggestedBankTxIds, setSuggestedBankTxIds] = useState<Set<string>>(new Set());

  // Importación de extracto bancario
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ParsedBankRow[]>([]);
  const [importAccountId, setImportAccountId] = useState<string>('');
  const [importParsing, setImportParsing] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [detail, setDetail] = useState<BankTransaction | null>(null);

  // CRUD de cuentas bancarias (tenant_banks)
  const [showAccounts, setShowAccounts] = useState(false);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [accountForm, setAccountForm] = useState<{ id?: number; name: string; account_type: string; account_number: string; account_code: string; branch: string; is_default: boolean; is_active: boolean }>(
    { name: '', account_type: 'corriente', account_number: '', account_code: '', branch: '', is_default: false, is_active: true }
  );
  const [savingAccount, setSavingAccount] = useState(false);
  const resetAccountForm = () => setAccountForm({ name: '', account_type: 'corriente', account_number: '', account_code: '', branch: '', is_default: false, is_active: true });

  const loadAccountsList = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/accounting/banks`, { headers });
      if (!r.ok) return;
      const j = await r.json();
      setAccountsList(j?.banks || []);
    } catch { /* noop */ }
  }, [headers]);

  useEffect(() => {
    if (showAccounts) loadAccountsList();
  }, [showAccounts, loadAccountsList]);

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.name.trim()) return;
    setSavingAccount(true);
    try {
      const isEdit = !!accountForm.id;
      const r = await fetch(`${API_BASE}/accounting/banks`, {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(accountForm),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      resetAccountForm();
      await loadAccountsList();
      await loadBankAccounts();
    } catch {
      alert('No se pudo guardar la cuenta bancaria.');
    } finally {
      setSavingAccount(false);
    }
  };

  const editAccount = (b: any) => {
    setAccountForm({
      id: b.id,
      name: b.name || '',
      account_type: b.account_type || 'corriente',
      account_number: b.account_number || '',
      account_code: b.account_code || '',
      branch: b.branch || '',
      is_default: !!b.is_default,
      is_active: b.is_active !== false,
    });
  };

  const removeAccount = async (b: any) => {
    if (!window.confirm(`¿Eliminar la cuenta "${b.name}"?`)) return;
    try {
      const r = await fetch(`${API_BASE}/accounting/banks/${b.id}`, { method: 'DELETE', headers });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${r.status}`);
      }
      await loadAccountsList();
      await loadBankAccounts();
    } catch (e: any) {
      alert(e?.message || 'No se pudo eliminar.');
    }
  };

  const normalizeStatus = (s?: string): string => {
    if (!s) return 'PENDING';
    if (s === 'CONCILIADO') return 'RECONCILED';
    if (s === 'PARCIAL') return 'PARTIAL';
    if (s === 'PENDIENTE') return 'PENDING';
    return s;
  };

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (accountId) params.append('bankId', accountId);
      if (search.trim()) params.append('search', search.trim());
      // Mapeo de status FE → BE (CONCILIADO/PARCIAL/PENDIENTE/ANULADO)
      if (statusFilter && statusFilter !== 'ALL') {
        const beStatus = statusFilter === 'RECONCILED' ? 'CONCILIADO'
          : statusFilter === 'PENDING' ? 'PENDIENTE'
          : statusFilter;
        params.append('status', beStatus);
      }
      const r = await fetch(`${API_BASE}/accounting/bank-transactions?${params.toString()}`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const raw: any[] = d.transactions || [];
      const list: BankTransaction[] = raw.map((t: any) => ({
        ...t,
        date: t.date || (t.transaction_date ? String(t.transaction_date).slice(0, 10) : ''),
        direction: t.direction || (t.transaction_type === 'CARGO' ? 'OUT' : 'IN'),
        bank_account_id: t.bank_account_id ?? t.bank_id,
        bank_account_name: t.bank_account_name || t.bank_name,
        status: normalizeStatus(t.status),
        // El BE devuelve `reconciliation_lines[]` agregado; expone también el id
        // plano que usan los handlers de "Deshacer conciliación".
        reconciliation_line_id: t.reconciliation_line_id ?? (Array.isArray(t.reconciliation_lines) && t.reconciliation_lines[0]?.id) ?? null,
      }));
      setTransactions(list);
    } catch (e: any) {
      setError('No se pudieron cargar los movimientos bancarios.');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, accountId, search, statusFilter, headers]);

  // Cargar cuentas bancarias desde el catálogo (tenant_banks), no desde transacciones.
  // Antes el dropdown quedaba vacío si aún no había movimientos.
  const loadBankAccounts = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/accounting/banks`, { headers });
      if (!r.ok) return;
      const j = await r.json();
      const rows = j?.banks || j?.data || [];
      if (Array.isArray(rows)) {
        setBankAccounts(
          rows.map((b: any) => ({
            id: b.id,
            name: b.name + (b.account_number ? ` · ${b.account_number}` : ''),
          })),
        );
      }
    } catch { /* noop */ }
  }, [headers]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    loadBankAccounts();
  }, [loadBankAccounts]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return transactions.filter(t => {
      if (accountId && String(t.bank_account_id) !== String(accountId)) return false;
      if (statusFilter === 'RECONCILED' && t.status !== 'RECONCILED') return false;
      if (statusFilter === 'PENDING' && t.status === 'RECONCILED') return false;
      if (s) {
        const hay = `${t.description || ''} ${t.reference || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [transactions, search, statusFilter, accountId]);

  const withRunningBalance = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let running = 0;
    return sorted.map(t => {
      const amt = Number(t.amount || 0);
      running += t.direction === 'IN' ? amt : -amt;
      return { ...t, running_balance: running };
    });
  }, [filtered]);

  const kpis = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    let pending = 0;
    filtered.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.direction === 'IN') inSum += amt;
      else outSum += amt;
      if (t.status !== 'RECONCILED') pending += 1;
    });
    return { inSum, outSum, net: inSum - outSum, pending };
  }, [filtered]);

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.bankAccountId || !newForm.amount || !newForm.description) return;
    setSavingNew(true);
    try {
      const r = await fetch(`${API_BASE}/accounting/bank-transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bankId: Number(newForm.bankAccountId),
          transactionDate: newForm.date,
          description: newForm.description,
          amount: Number(newForm.amount),
          transactionType: newForm.direction === 'IN' ? 'ABONO' : 'CARGO',
          reference: newForm.reference,
          contraAccountCode: newForm.contraAccountCode || null,
          contraAccountName: newForm.contraAccountName || null,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setShowNew(false);
      setNewForm({
        bankAccountId: '',
        date: todayISO(),
        description: '',
        amount: '',
        direction: 'IN',
        reference: '',
        contraAccountCode: '',
        contraAccountName: '',
      });
      loadTransactions();
    } catch {
      alert('No se pudo crear el movimiento.');
    } finally {
      setSavingNew(false);
    }
  };

  // El backend resuelve candidatos por bank_transaction. Iteramos sobre las
  // transacciones pendientes visibles y agregamos los resultados. Cap de 30
  // peticiones para no martillar al servidor en datasets grandes.
  const fetchCandidates = useCallback(async (): Promise<Candidate[]> => {
    const pendingTxs = transactions
      .filter(t => String(t.status || 'PENDIENTE').toUpperCase() === 'PENDIENTE')
      .slice(0, 30);
    if (pendingTxs.length === 0) return [];
    const all: Candidate[] = [];
    for (const t of pendingTxs) {
      try {
        const r = await fetch(
          `${API_BASE}/accounting/bank-reconciliations/candidates?bankTransactionId=${t.id}`,
          { headers }
        );
        if (!r.ok) continue;
        const d = await r.json();
        const list: any[] = d.candidates || [];
        for (const c of list) {
          all.push({ ...c, bank_transaction_id: t.id });
        }
      } catch { /* ignorar tx individual y seguir */ }
    }
    return all;
  }, [transactions, headers]);

  // Cargar candidates en segundo plano para saber qué movimientos tienen match sugerido.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchCandidates();
        if (cancelled) return;
        setSuggestedBankTxIds(new Set(list.map(c => String(c.bank_transaction_id))));
      } catch {
        if (!cancelled) setSuggestedBankTxIds(new Set());
      }
    })();
    return () => { cancelled = true; };
  }, [fetchCandidates, transactions.length]);

  const openSuggestions = async () => {
    setShowSuggestions(true);
    setLoadingCandidates(true);
    setCandidatesError('');
    try {
      const list = await fetchCandidates();
      setCandidates(list);
      setSuggestedBankTxIds(new Set(list.map(c => String(c.bank_transaction_id))));
      setSelectedCandidates(new Set());
    } catch {
      setCandidatesError('No se pudieron obtener sugerencias.');
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const candidateKey = (c: Candidate) =>
    `${c.bank_transaction_id}-${c.source_type}-${c.source_id}`;

  const toggleCandidate = (c: Candidate) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      const k = candidateKey(c);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  // "Aceptar todas las sugerencias con confianza >= 90%"
  useEffect(() => {
    if (!autoSelectHighConfidence) return;
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      candidates.forEach(c => {
        if ((c.match_confidence || 0) >= 0.9) next.add(candidateKey(c));
      });
      return next;
    });
  }, [autoSelectHighConfidence, candidates]);

  const applySelectedCandidates = async () => {
    const toApply = candidates.filter(c => selectedCandidates.has(candidateKey(c)));
    if (toApply.length === 0) return;
    setBatchApplying(true);
    let okCount = 0;
    let failCount = 0;
    for (const c of toApply) {
      try {
        const r = await fetch(`${API_BASE}/accounting/bank-reconciliations/match`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            bankTransactionId: c.bank_transaction_id,
            sourceType: c.source_type,
            sourceId: c.source_id,
            sourceNumber: c.source_number,
            journalEntryId: c.journal_entry_id,
            amount: c.amount,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setBatchApplying(false);
    // Quitar de la lista los que se aplicaron correctamente (optimista: asumimos que los
    // OK equivalen a los primeros; si falló alguno, recargamos todo).
    if (failCount === 0) {
      const appliedKeys = new Set(toApply.map(candidateKey));
      setCandidates(prev => prev.filter(c => !appliedKeys.has(candidateKey(c))));
    } else {
      try {
        const list = await fetchCandidates();
        setCandidates(list);
        setSuggestedBankTxIds(new Set(list.map(c => String(c.bank_transaction_id))));
      } catch { /* noop */ }
    }
    setSelectedCandidates(new Set());
    setAutoSelectHighConfidence(false);
    loadTransactions();
    if (failCount > 0) {
      alert(`Se aplicaron ${okCount} sugerencias. ${failCount} fallaron, revísalas manualmente.`);
    }
  };

  const matchPair = async (c: Candidate) => {
    setMatching(c.bank_transaction_id);
    try {
      const r = await fetch(`${API_BASE}/accounting/bank-reconciliations/match`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bankTransactionId: c.bank_transaction_id,
          sourceType: c.source_type,
          sourceId: c.source_id,
          sourceNumber: c.source_number,
          journalEntryId: c.journal_entry_id,
          amount: c.amount,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCandidates(prev => prev.filter(x => x.bank_transaction_id !== c.bank_transaction_id));
      loadTransactions();
    } catch {
      alert('No se pudo conciliar.');
    } finally {
      setMatching(null);
    }
  };

  // ---------- Importación de extracto (CSV/OFX/XLSX) ----------
  // Solo parseo CSV simple en cliente. OFX/XLSX quedan como // TODO: backend.
  // Formato esperado: `fecha,descripcion,monto` (monto negativo = salida)
  const parseCsvText = (text: string): ParsedBankRow[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    // Detectar encabezado (si la primera línea no parece fecha)
    const first = lines[0].toLowerCase();
    const startIdx = /fecha|date/.test(first) ? 1 : 0;
    const rows: ParsedBankRow[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim());
      if (parts.length < 3) continue;
      const [date, description, amountRaw, reference] = parts;
      const amt = Number(String(amountRaw).replace(/[^\d.\-]/g, ''));
      if (!date || Number.isNaN(amt)) continue;
      rows.push({
        date,
        description,
        amount: Math.abs(amt),
        direction: amt < 0 ? 'OUT' : 'IN',
        reference,
      });
    }
    return rows;
  };

  const handleImportFile = async (file: File) => {
    setImportError('');
    setImportRows([]);
    setImportFile(file);
    setImportParsing(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        const text = await file.text();
        const rows = parseCsvText(text);
        if (rows.length === 0) {
          setImportError('No se encontraron filas válidas. Formato esperado: fecha,descripcion,monto');
        }
        setImportRows(rows);
      } else if (ext === 'ofx' || ext === 'xlsx') {
        // TODO: backend — el parseo de OFX/XLSX debería delegarse al backend
        // (endpoint POST /accounting/bank-transactions/import). Por ahora
        // avisamos al usuario.
        setImportError(`Formato .${ext} aún no soportado en cliente. Usa CSV por ahora.`);
      } else {
        setImportError('Formato no reconocido. Usa .csv, .ofx o .xlsx');
      }
    } catch {
      setImportError('No se pudo leer el archivo.');
    } finally {
      setImportParsing(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportRows([]);
    setImportAccountId('');
    setImportError('');
    setImportSaving(false);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const submitImport = async () => {
    if (!importAccountId) { setImportError('Selecciona una cuenta bancaria destino.'); return; }
    if (importRows.length === 0) { setImportError('No hay movimientos para importar.'); return; }
    setImportSaving(true);
    setImportError('');
    let okCount = 0;
    let failCount = 0;
    // TODO: backend — idealmente un endpoint batch, evitar N peticiones.
    for (const row of importRows) {
      try {
        const r = await fetch(`${API_BASE}/accounting/bank-transactions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            bankId: Number(importAccountId),
            transactionDate: row.date,
            description: row.description,
            amount: row.amount,
            transactionType: row.direction === 'IN' ? 'ABONO' : 'CARGO',
            reference: row.reference || '',
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setImportSaving(false);
    if (failCount === 0) {
      setShowImport(false);
      resetImport();
      loadTransactions();
    } else {
      setImportError(`Se importaron ${okCount} movimientos. ${failCount} fallaron.`);
      loadTransactions();
    }
  };

  const unmatch = async (t: BankTransaction) => {
    const lineId = t.reconciliation_line_id;
    if (!lineId) {
      alert('Este movimiento no tiene línea de conciliación asociada.');
      return;
    }
    try {
      const r = await fetch(
        `${API_BASE}/accounting/bank-reconciliation-lines/${lineId}/unmatch`,
        { method: 'POST', headers }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDetail(null);
      loadTransactions();
    } catch {
      alert('No se pudo deshacer la conciliación.');
    }
  };

  return (
    <div>
      <Row className="align-items-center mb-3">
        <Col>
          <h4 className="mb-0">
            <i className="ri-bank-line me-2 text-primary" />
            Bancos
          </h4>
          <small className="text-muted">Movimientos bancarios y conciliación</small>
        </Col>
        <Col xs="auto" className="d-flex gap-2">
          <Button color="secondary" outline size="sm" onClick={() => setShowAccounts(true)}>
            <i className="ri-bank-line me-1" />
            Cuentas
          </Button>
          <Button color="primary" outline size="sm" onClick={() => setShowImport(true)}>
            <i className="ri-upload-2-line me-1" />
            Importar extracto
          </Button>
          <Button color="info" outline size="sm" onClick={openSuggestions}>
            <i className="ri-magic-line me-1" />
            Sugerencias de conciliación
          </Button>
          <Button color="primary" size="sm" onClick={() => setShowNew(true)}>
            <i className="ri-add-line me-1" />
            Nuevo movimiento
          </Button>
        </Col>
      </Row>

      <Card className="shadow-sm mb-3">
        <CardBody>
          <Row className="g-2 align-items-end">
            <Col md={3}>
              <Label className="mb-1 small">Cuenta bancaria</Label>
              <Input
                type="select"
                bsSize="sm"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
              >
                <option value="">Todas las cuentas</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={2}>
              <Label className="mb-1 small">Desde</Label>
              <Input
                type="date"
                bsSize="sm"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Label className="mb-1 small">Hasta</Label>
              <Input
                type="date"
                bsSize="sm"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Label className="mb-1 small">Estado</Label>
              <Input
                type="select"
                bsSize="sm"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">Todas</option>
                <option value="RECONCILED">Conciliadas</option>
                <option value="PENDING">Pendientes</option>
              </Input>
            </Col>
            <Col md={3}>
              <Label className="mb-1 small">Buscar</Label>
              <InputGroup size="sm">
                <InputGroupText>
                  <i className="ri-search-line" />
                </InputGroupText>
                <Input
                  placeholder="Descripción o referencia"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </InputGroup>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Row className="g-2 mb-3">
        <Col md={3}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Entradas</div>
              <h4 className="mb-0 text-success font-monospace">${money(kpis.inSum)}</h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Salidas</div>
              <h4 className="mb-0 text-danger font-monospace">${money(kpis.outSum)}</h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Saldo neto</div>
              <h4 className={`mb-0 font-monospace ${kpis.net >= 0 ? 'text-success' : 'text-danger'}`}>
                ${money(kpis.net)}
              </h4>
            </CardBody>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm h-100">
            <CardBody>
              <div className="text-muted small">Pendientes de conciliar</div>
              <h4 className="mb-0 text-warning">{kpis.pending}</h4>
            </CardBody>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <CardHeader className="bg-transparent d-flex justify-content-between align-items-center">
          <strong>Movimientos</strong>
          <small className="text-muted">{withRunningBalance.length} registros</small>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner color="primary" />
            </div>
          ) : error ? (
            <div className="p-3">
              <Alert color="danger" className="d-flex align-items-start gap-3 mb-0">
                <i className="ri-error-warning-line fs-20 mt-1" />
                <div className="flex-grow-1">
                  <strong>No pudimos conectar con el servidor</strong>
                  <div className="fs-13 mt-1">
                    {String(error).toLowerCase().includes('fetch') || String(error).toLowerCase().includes('network')
                      ? 'El backend no responde. Revisa que esté corriendo (npm start en crumi/back) o ajusta VITE_API_URL en front/.env.'
                      : String(error)}
                  </div>
                  <Button size="sm" color="danger" outline className="mt-2" onClick={() => { setError(''); loadTransactions(); }}>
                    Reintentar
                  </Button>
                </div>
              </Alert>
            </div>
          ) : withRunningBalance.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="ri-inbox-line fs-1 d-block mb-2" />
              Sin movimientos para los filtros seleccionados
            </div>
          ) : (
            <div className="table-responsive">
              <Table size="sm" className="align-middle mb-0" hover>
                <thead className="table-light">
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Referencia</th>
                    <th className="text-end">Débito</th>
                    <th className="text-end">Crédito</th>
                    <th className="text-end">Saldo</th>
                    <th className="text-center">Estado</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {withRunningBalance.map(t => {
                    const amt = Number(t.amount || 0);
                    const isIn = t.direction === 'IN';
                    const reconciled = t.status === 'RECONCILED';
                    return (
                      <tr key={t.id}>
                        <td className="text-nowrap">{t.date}</td>
                        <td>
                          <div>{t.description}</div>
                          {t.bank_account_name && (
                            <small className="text-muted">{t.bank_account_name}</small>
                          )}
                        </td>
                        <td>
                          <code className="small">{t.reference || '-'}</code>
                        </td>
                        <td className="text-end font-monospace text-success">
                          {isIn ? money(amt) : ''}
                        </td>
                        <td className="text-end font-monospace text-danger">
                          {!isIn ? money(amt) : ''}
                        </td>
                        <td
                          className={`text-end font-monospace ${t.running_balance >= 0 ? 'text-dark' : 'text-danger'}`}
                        >
                          {money(t.running_balance)}
                        </td>
                        <td className="text-center">
                          {reconciled ? (
                            <Badge color="success" pill>Conciliada</Badge>
                          ) : suggestedBankTxIds.has(String(t.id)) ? (
                            <Badge color="warning" pill title="Hay un asiento sugerido para este movimiento">
                              <i className="ri-magic-line me-1" />
                              Match sugerido
                            </Badge>
                          ) : (
                            <Badge color="secondary" pill>Pendiente</Badge>
                          )}
                        </td>
                        <td className="text-center">
                          <Button
                            size="sm"
                            color="light"
                            onClick={() => setDetail(t)}
                            title="Ver detalle"
                          >
                            <i className="ri-eye-line" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>

      <Offcanvas isOpen={showNew} toggle={() => setShowNew(false)} direction="end">
        <OffcanvasHeader toggle={() => setShowNew(false)}>Nuevo movimiento</OffcanvasHeader>
        <OffcanvasBody>
          <Form onSubmit={submitNew}>
            <FormGroup>
              <Label className="small">Cuenta bancaria</Label>
              <Input
                type="select"
                bsSize="sm"
                value={newForm.bankAccountId}
                onChange={e => setNewForm({ ...newForm, bankAccountId: e.target.value })}
                required
              >
                <option value="">Seleccione...</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label className="small">Fecha</Label>
              <Input
                type="date"
                bsSize="sm"
                value={newForm.date}
                onChange={e => setNewForm({ ...newForm, date: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup>
              <Label className="small">Descripción</Label>
              <Input
                bsSize="sm"
                value={newForm.description}
                onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup>
              <Label className="small">Monto</Label>
              <Input
                type="number"
                step="0.01"
                bsSize="sm"
                value={newForm.amount}
                onChange={e => setNewForm({ ...newForm, amount: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup>
              <Label className="small d-block">Dirección</Label>
              <FormGroup check inline>
                <Input
                  type="radio"
                  name="direction"
                  checked={newForm.direction === 'IN'}
                  onChange={() => setNewForm({ ...newForm, direction: 'IN' })}
                />
                <Label check>Entrada</Label>
              </FormGroup>
              <FormGroup check inline>
                <Input
                  type="radio"
                  name="direction"
                  checked={newForm.direction === 'OUT'}
                  onChange={() => setNewForm({ ...newForm, direction: 'OUT' })}
                />
                <Label check>Salida</Label>
              </FormGroup>
            </FormGroup>
            <FormGroup>
              <Label className="small">Referencia</Label>
              <Input
                bsSize="sm"
                value={newForm.reference}
                onChange={e => setNewForm({ ...newForm, reference: e.target.value })}
              />
            </FormGroup>
            <FormGroup>
              <Label className="small">Cuenta contrapartida (opcional)</Label>
              <div className="d-flex gap-2">
                <Input
                  bsSize="sm"
                  placeholder="Código PUC (ej. 519525)"
                  style={{ width: 160 }}
                  value={newForm.contraAccountCode}
                  onChange={e => setNewForm({ ...newForm, contraAccountCode: e.target.value })}
                />
                <Input
                  bsSize="sm"
                  placeholder="Nombre de la cuenta"
                  value={newForm.contraAccountName}
                  onChange={e => setNewForm({ ...newForm, contraAccountName: e.target.value })}
                />
              </div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                Sin contrapartida, el movimiento queda en pendiente de conciliación y no afecta el libro mayor.
              </div>
            </FormGroup>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button color="light" size="sm" type="button" onClick={() => setShowNew(false)}>
                Cancelar
              </Button>
              <Button color="primary" size="sm" type="submit" disabled={savingNew}>
                {savingNew ? <Spinner size="sm" /> : 'Guardar'}
              </Button>
            </div>
          </Form>
        </OffcanvasBody>
      </Offcanvas>

      <Offcanvas
        isOpen={showSuggestions}
        toggle={() => setShowSuggestions(false)}
        direction="end"
      >
        <OffcanvasHeader toggle={() => setShowSuggestions(false)}>
          Sugerencias de conciliación
        </OffcanvasHeader>
        <OffcanvasBody>
          {loadingCandidates ? (
            <div className="text-center py-4">
              <Spinner color="primary" />
            </div>
          ) : candidatesError ? (
            <div className="text-danger small">{candidatesError}</div>
          ) : candidates.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="ri-check-double-line fs-1 d-block mb-2" />
              No hay sugerencias disponibles
            </div>
          ) : (
            <>
              <Card className="mb-2 border-0 bg-light">
                <CardBody className="py-2">
                  <FormGroup check className="mb-2">
                    <Input
                      type="checkbox"
                      id="auto-select-high"
                      checked={autoSelectHighConfidence}
                      onChange={e => setAutoSelectHighConfidence(e.target.checked)}
                    />
                    <Label for="auto-select-high" check className="fs-13">
                      Aceptar todas las sugerencias con confianza &gt;= 90%
                    </Label>
                  </FormGroup>
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-muted">
                      {selectedCandidates.size} de {candidates.length} seleccionadas
                    </small>
                    <Button
                      size="sm"
                      color="success"
                      disabled={selectedCandidates.size === 0 || batchApplying}
                      onClick={applySelectedCandidates}
                    >
                      {batchApplying ? <Spinner size="sm" /> : (
                        <>
                          <i className="ri-check-double-line me-1" />
                          Aplicar seleccionadas
                        </>
                      )}
                    </Button>
                  </div>
                </CardBody>
              </Card>
              {candidates.map(c => {
                const k = candidateKey(c);
                const checked = selectedCandidates.has(k);
                return (
                  <Card key={k} className="mb-2 shadow-sm">
                    <CardBody className="py-2">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <FormGroup check className="mb-0">
                          <Input
                            type="checkbox"
                            id={`cand-${k}`}
                            checked={checked}
                            onChange={() => toggleCandidate(c)}
                          />
                          <Label for={`cand-${k}`} check>
                            <Badge color="info" className="ms-1">
                              Confianza {Math.round((c.match_confidence || 0) * 100)}%
                            </Badge>
                          </Label>
                        </FormGroup>
                        <Button
                          size="sm"
                          color="success"
                          disabled={matching === c.bank_transaction_id}
                          onClick={() => matchPair(c)}
                        >
                          {matching === c.bank_transaction_id ? <Spinner size="sm" /> : 'Conciliar'}
                        </Button>
                      </div>
                      <Row className="small">
                        <Col xs={6}>
                          <div className="text-muted">Banco</div>
                          <div className="fw-semibold">{c.bank_description || `#${c.bank_transaction_id}`}</div>
                          <div className="text-muted">{c.bank_date}</div>
                          <div className="font-monospace">${money(c.bank_amount || 0)}</div>
                        </Col>
                        <Col xs={6}>
                          <div className="text-muted">Asiento</div>
                          <div className="fw-semibold">
                            {c.entry_number || `#${c.journal_entry_id}`}
                          </div>
                          <div className="text-muted">{c.entry_date}</div>
                          <div className="font-monospace">${money(c.entry_amount || 0)}</div>
                        </Col>
                      </Row>
                    </CardBody>
                  </Card>
                );
              })}
            </>
          )}
        </OffcanvasBody>
      </Offcanvas>

      <Offcanvas isOpen={!!detail} toggle={() => setDetail(null)} direction="end" style={{ width: 640 }}>
        <OffcanvasHeader toggle={() => setDetail(null)}>
          {detail ? `Movimiento bancario #${detail.id}` : 'Detalle de movimiento'}
        </OffcanvasHeader>
        <OffcanvasBody>
          {detail && (() => {
            const d: any = detail;
            const amount = Number(d.amount || 0);
            const matched = Number(d.matched_amount || 0);
            const pending = Math.max(amount - matched, 0);
            const isIn = d.direction === 'IN';
            const statusColor =
              d.status === 'RECONCILED' ? 'success'
              : d.status === 'PARTIAL' ? 'warning'
              : 'secondary';
            const statusLabel =
              d.status === 'RECONCILED' ? 'Conciliada'
              : d.status === 'PARTIAL' ? 'Parcial'
              : 'Pendiente';
            const lines: any[] = Array.isArray(d.reconciliation_lines) ? d.reconciliation_lines : [];
            return (
              <div>
                <div className="mb-3 d-flex align-items-center gap-2">
                  <Badge color={statusColor} className="fs-13">{statusLabel}</Badge>
                  <Badge
                    color={isIn ? 'success-subtle' : 'danger-subtle'}
                    className={isIn ? 'text-success' : 'text-danger'}
                  >
                    <i className={`${isIn ? 'ri-arrow-down-circle-line' : 'ri-arrow-up-circle-line'} align-middle me-1`} />
                    {isIn ? 'Entrada' : 'Salida'}
                  </Badge>
                  {d.source && (
                    <span className="text-muted fs-12 ms-auto">Origen: {d.source}</span>
                  )}
                </div>

                <Card className="mb-3">
                  <CardBody>
                    <h6 className="mb-3">Movimiento</h6>
                    <Row className="g-2 small">
                      <Col xs={6}>
                        <span className="text-muted">Fecha:</span>{' '}
                        <strong>
                          {d.date ? new Date(d.date).toLocaleDateString('es-CO') : '-'}
                        </strong>
                      </Col>
                      <Col xs={6}>
                        <span className="text-muted">Referencia:</span>{' '}
                        <code>{d.reference || '-'}</code>
                      </Col>
                      <Col xs={12}>
                        <span className="text-muted">Cuenta bancaria:</span>{' '}
                        <strong>{d.bank_account_name || `#${d.bank_account_id}`}</strong>
                        {d.account_code && <code className="ms-2">{d.account_code}</code>}
                      </Col>
                      <Col xs={12}>
                        <span className="text-muted">Descripción:</span>
                        <div>{d.description || '-'}</div>
                      </Col>
                      {d.running_balance != null && (
                        <Col xs={6}>
                          <span className="text-muted">Saldo extracto:</span>{' '}
                          <span className="font-monospace">${money(Number(d.running_balance))}</span>
                        </Col>
                      )}
                      {d.notes && (
                        <Col xs={12}>
                          <span className="text-muted">Notas:</span>
                          <div>{d.notes}</div>
                        </Col>
                      )}
                    </Row>
                  </CardBody>
                </Card>

                <Card className="mb-3">
                  <CardBody>
                    <h6 className="mb-1">Totales</h6>
                    <small className="text-muted d-block mb-2">
                      El movimiento solo afecta el libro mayor cuando se concilia con un asiento.
                    </small>
                    <Table size="sm" className="mb-0">
                      <tbody>
                        <tr>
                          <td>Monto del movimiento</td>
                          <td className={`text-end font-monospace ${isIn ? 'text-success' : 'text-danger'}`}>
                            {isIn ? '+' : '-'}${money(amount)}
                          </td>
                        </tr>
                        <tr className="text-success">
                          <td>Conciliado</td>
                          <td className="text-end font-monospace">${money(matched)}</td>
                        </tr>
                        <tr className="fw-bold table-light">
                          <td>Pendiente por conciliar</td>
                          <td className="text-end font-monospace text-warning">${money(pending)}</td>
                        </tr>
                      </tbody>
                    </Table>
                  </CardBody>
                </Card>

                {lines.length > 0 && (
                  <Card className="mb-3">
                    <CardBody>
                      <h6 className="mb-3">Conciliaciones aplicadas</h6>
                      <div className="d-flex flex-column gap-2">
                        {lines.map((line: any) => (
                          <div key={line.id} className="border rounded p-2 d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-medium">
                                <Badge color="info-subtle" className="text-info me-1">{line.source_type}</Badge>
                                {line.source_number || ''}
                              </div>
                              <div className="text-muted fs-12">{line.description || 'Sin descripción'}</div>
                              {line.journal_entry_id && (
                                <div className="text-muted fs-12">Asiento #{line.journal_entry_id}</div>
                              )}
                            </div>
                            <span className="font-monospace">${money(Number(line.amount || 0))}</span>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}

                {d.journal_entry_id && (
                  <Card className="mb-3">
                    <CardBody className="py-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted fs-13">Asiento contable vinculado</span>
                        <a
                          href={`/contabilidad/consultas?entryId=${d.journal_entry_id}`}
                          className="text-primary fs-13"
                        >
                          Ver asiento #{d.journal_entry_id} <i className="ri-arrow-right-line" />
                        </a>
                      </div>
                    </CardBody>
                  </Card>
                )}

                <div className="d-flex gap-2">
                  {d.status === 'RECONCILED' && (
                    <Button color="warning" size="sm" outline onClick={() => unmatch(d)}>
                      <i className="ri-close-circle-line me-1" />
                      Deshacer conciliación
                    </Button>
                  )}
                  <Button color="light" className="ms-auto" onClick={() => setDetail(null)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            );
          })()}
        </OffcanvasBody>
      </Offcanvas>

      <Modal
        isOpen={showImport}
        toggle={() => { if (!importSaving) { setShowImport(false); resetImport(); } }}
        size="lg"
        centered
      >
        <ModalHeader toggle={() => { if (!importSaving) { setShowImport(false); resetImport(); } }}>
          Importar extracto bancario
        </ModalHeader>
        <ModalBody>
          <FormGroup>
            <Label className="small">Cuenta bancaria destino</Label>
            <Input
              type="select"
              bsSize="sm"
              value={importAccountId}
              onChange={e => setImportAccountId(e.target.value)}
            >
              <option value="">Seleccione la cuenta...</option>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Input>
          </FormGroup>

          <FormGroup>
            <Label className="small">Archivo de extracto</Label>
            <Input
              innerRef={importInputRef}
              type="file"
              bsSize="sm"
              accept=".csv,.ofx,.xlsx"
              onChange={e => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) handleImportFile(f);
              }}
            />
            <small className="text-muted d-block mt-1">
              CSV con formato <code>fecha,descripcion,monto[,referencia]</code> (monto negativo = salida).
              OFX y XLSX próximamente.
            </small>
          </FormGroup>

          {importParsing && (
            <div className="text-center py-3">
              <Spinner size="sm" /> Leyendo archivo...
            </div>
          )}

          {importError && (
            <Alert color="warning" className="py-2 fs-13">{importError}</Alert>
          )}

          {importRows.length > 0 && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong className="fs-13">
                  Vista previa ({Math.min(5, importRows.length)} de {importRows.length})
                </strong>
                {importFile && (
                  <small className="text-muted">{importFile.name}</small>
                )}
              </div>
              <div className="table-responsive">
                <Table size="sm" bordered className="mb-0 fs-13">
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th className="text-end">Monto</th>
                      <th className="text-center">Dir.</th>
                      <th>Ref.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="text-nowrap">{r.date}</td>
                        <td>{r.description}</td>
                        <td className="text-end font-monospace">${money(r.amount)}</td>
                        <td className="text-center">
                          <Badge color={r.direction === 'IN' ? 'success' : 'danger'} pill>
                            {r.direction === 'IN' ? 'Entrada' : 'Salida'}
                          </Badge>
                        </td>
                        <td><code className="small">{r.reference || '-'}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="light"
            size="sm"
            onClick={() => { setShowImport(false); resetImport(); }}
            disabled={importSaving}
          >
            Cancelar
          </Button>
          <Button
            color="primary"
            size="sm"
            disabled={importSaving || importRows.length === 0 || !importAccountId}
            onClick={submitImport}
          >
            {importSaving ? <Spinner size="sm" /> : (
              <>
                <i className="ri-upload-cloud-2-line me-1" />
                Importar {importRows.length} movimientos
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* CRUD de cuentas bancarias (tenant_banks) */}
      <Offcanvas direction="end" isOpen={showAccounts} toggle={() => setShowAccounts(!showAccounts)}>
        <OffcanvasHeader toggle={() => { setShowAccounts(false); resetAccountForm(); }}>
          Cuentas bancarias
        </OffcanvasHeader>
        <OffcanvasBody>
          <Form onSubmit={saveAccount} className="mb-3 border rounded p-2 bg-light">
            <div className="fw-semibold small mb-2">{accountForm.id ? 'Editar cuenta' : 'Nueva cuenta'}</div>
            <FormGroup>
              <Label className="small">Nombre *</Label>
              <Input bsSize="sm" required value={accountForm.name}
                onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} />
            </FormGroup>
            <Row className="g-2">
              <Col xs={6}>
                <FormGroup>
                  <Label className="small">Tipo</Label>
                  <Input type="select" bsSize="sm" value={accountForm.account_type}
                    onChange={e => setAccountForm({ ...accountForm, account_type: e.target.value })}>
                    <option value="corriente">Corriente</option>
                    <option value="ahorros">Ahorros</option>
                    <option value="caja">Caja</option>
                    <option value="otro">Otro</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col xs={6}>
                <FormGroup>
                  <Label className="small">Nº de cuenta</Label>
                  <Input bsSize="sm" value={accountForm.account_number}
                    onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })} />
                </FormGroup>
              </Col>
            </Row>
            <Row className="g-2">
              <Col xs={6}>
                <FormGroup>
                  <Label className="small">Cuenta PUC</Label>
                  <Input bsSize="sm" placeholder="111005" value={accountForm.account_code}
                    onChange={e => setAccountForm({ ...accountForm, account_code: e.target.value })} />
                </FormGroup>
              </Col>
              <Col xs={6}>
                <FormGroup>
                  <Label className="small">Sucursal</Label>
                  <Input bsSize="sm" value={accountForm.branch}
                    onChange={e => setAccountForm({ ...accountForm, branch: e.target.value })} />
                </FormGroup>
              </Col>
            </Row>
            <FormGroup check inline>
              <Input type="checkbox" checked={accountForm.is_default}
                onChange={e => setAccountForm({ ...accountForm, is_default: e.target.checked })} />
              <Label check className="small">Por defecto</Label>
            </FormGroup>
            <FormGroup check inline>
              <Input type="checkbox" checked={accountForm.is_active}
                onChange={e => setAccountForm({ ...accountForm, is_active: e.target.checked })} />
              <Label check className="small">Activa</Label>
            </FormGroup>
            <div className="d-flex justify-content-end gap-2 mt-2">
              {accountForm.id && (
                <Button color="light" size="sm" type="button" onClick={resetAccountForm}>
                  Cancelar
                </Button>
              )}
              <Button color="primary" size="sm" type="submit" disabled={savingAccount}>
                {savingAccount ? <Spinner size="sm" /> : (accountForm.id ? 'Actualizar' : 'Crear')}
              </Button>
            </div>
          </Form>

          <div className="small text-muted mb-2">Cuentas registradas</div>
          {accountsList.length === 0 ? (
            <div className="text-muted small">No hay cuentas bancarias registradas.</div>
          ) : (
            <Table size="sm" hover className="align-middle">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th>
                  <th>PUC</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accountsList.map((b: any) => (
                  <tr key={b.id}>
                    <td>
                      <div className="fw-medium">{b.name}{b.is_default ? <Badge color="info" className="ms-1">Default</Badge> : null}</div>
                      <div className="text-muted small">{b.account_type} · {b.account_number || '—'}</div>
                    </td>
                    <td className="font-monospace small">{b.account_code || '—'}</td>
                    <td>{b.is_active ? <Badge color="success">Activa</Badge> : <Badge color="secondary">Inactiva</Badge>}</td>
                    <td className="text-end">
                      <Button color="link" size="sm" onClick={() => editAccount(b)} title="Editar">
                        <i className="ri-pencil-line" />
                      </Button>
                      <Button color="link" size="sm" className="text-danger" onClick={() => removeAccount(b)} title="Eliminar">
                        <i className="ri-delete-bin-line" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </OffcanvasBody>
      </Offcanvas>
    </div>
  );
};

export default Bancos;
