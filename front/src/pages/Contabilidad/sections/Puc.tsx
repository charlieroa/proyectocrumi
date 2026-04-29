import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, Input, Spinner, Table } from 'reactstrap';
import Swal from 'sweetalert2';
import { api } from '../../../services/api';
import BulkUploadAccountsModal from '../../../Components/Common/BulkUploadAccountsModal';

type Account = {
  id: number;
  account_code: string;
  account_name: string;
  account_type?: string | null;
  parent_code?: string | null;
  level?: number | null;
  is_active?: boolean;
};

const TYPE_OPTS = [
  { value: '', label: '— Sin tipo —' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'PASIVO', label: 'Pasivo' },
  { value: 'PATRIMONIO', label: 'Patrimonio' },
  { value: 'INGRESO', label: 'Ingreso' },
  { value: 'GASTO', label: 'Gasto' },
  { value: 'COSTO', label: 'Costo' },
  { value: 'CUENTAS_ORDEN', label: 'Cuentas de orden' },
];

const levelFromCode = (code: string): number => {
  const len = (code || '').trim().length;
  if (len <= 1) return 1;
  if (len <= 2) return 2;
  if (len <= 4) return 3;
  if (len <= 6) return 4;
  return 5;
};

const parentFromCode = (code: string): string | null => {
  const c = (code || '').trim();
  if (c.length <= 1) return null;
  if (c.length <= 2) return c.slice(0, 1);
  if (c.length <= 4) return c.slice(0, 2);
  if (c.length <= 6) return c.slice(0, 4);
  return c.slice(0, 6);
};

const emptyForm: Partial<Account> = {
  account_code: '',
  account_name: '',
  account_type: '',
  parent_code: null,
  level: 1,
  is_active: true,
};

const Puc: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Partial<Account> | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/chart-of-accounts');
      if (res.data?.success) setAccounts(res.data.accounts || []);
    } catch {
      setAccounts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts
      .filter(a => showInactive || a.is_active !== false)
      .filter(a => !q || a.account_code.toLowerCase().includes(q) || a.account_name.toLowerCase().includes(q));
  }, [accounts, search, showInactive]);

  const seedColombia = async () => {
    const r = await Swal.fire({
      title: 'Cargar PUC Colombia base',
      text: 'Se agregarán las cuentas estándar del PUC colombiano (clases 1-7). No borra cuentas existentes.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cargar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0ab39c',
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    setLoading(true);
    try {
      const res = await api.post('/accounting/chart-of-accounts/seed-colombia');
      if (res.data?.success) {
        Swal.fire('Listo', `Se cargaron ${res.data.summary.inserted} cuentas nuevas.`, 'success');
        await load();
      }
    } catch (e: any) {
      Swal.fire('Error', e?.response?.data?.error || 'No se pudo cargar', 'error');
    }
    setLoading(false);
  };

  const startNew = () => setEditing({ ...emptyForm });
  const startEdit = (a: Account) => setEditing({ ...a });
  const cancelEdit = () => setEditing(null);

  const handleSave = async () => {
    if (!editing) return;
    const code = (editing.account_code || '').trim();
    const name = (editing.account_name || '').trim();
    if (!code || !name) {
      Swal.fire('Faltan datos', 'Código y nombre son obligatorios.', 'warning');
      return;
    }
    if (!/^[0-9]{1,10}$/.test(code)) {
      Swal.fire('Código inválido', 'Solo números, hasta 10 dígitos. Auxiliar = 8 dígitos.', 'warning');
      return;
    }
    const level = editing.level || levelFromCode(code);
    const parent_code = editing.parent_code ?? parentFromCode(code);
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/accounting/chart-of-accounts/${editing.id}`, {
          accountCode: code,
          accountName: name,
          accountType: editing.account_type || null,
          parentCode: parent_code,
          level,
          isActive: editing.is_active !== false,
        });
      } else {
        await api.post('/accounting/chart-of-accounts', {
          accountCode: code,
          accountName: name,
          accountType: editing.account_type || null,
          parentCode: parent_code,
          level,
        });
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      Swal.fire('Error', e?.response?.data?.error || 'No se pudo guardar', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async (a: Account) => {
    const r = await Swal.fire({
      title: `¿Eliminar cuenta ${a.account_code}?`,
      text: 'Si la cuenta tiene movimientos se inactivará en lugar de eliminarse.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f06548',
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    try {
      const res = await api.delete(`/accounting/chart-of-accounts/${a.id}`);
      if (res.data?.inactivated) {
        Swal.fire('Inactivada', 'La cuenta tiene movimientos y fue marcada como inactiva.', 'info');
      }
      await load();
    } catch (e: any) {
      Swal.fire('Error', e?.response?.data?.error || 'No se pudo eliminar', 'error');
    }
  };

  return (
    <Card>
      <CardBody>
        <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
          <Input
            style={{ maxWidth: 300 }}
            placeholder="Buscar por código o nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="form-check form-switch ms-2">
            <Input
              type="checkbox"
              className="form-check-input"
              id="puc-show-inactive"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            <label className="form-check-label fs-13" htmlFor="puc-show-inactive">Ver inactivas</label>
          </div>
          <div className="ms-auto d-flex gap-2">
            <Button color="success" outline onClick={() => setBulkOpen(true)}>
              <i className="ri-upload-2-line me-1" /> Carga masiva
            </Button>
            <Button color="secondary" outline onClick={seedColombia}>
              <i className="ri-download-cloud-2-line me-1" /> Cargar PUC Colombia base
            </Button>
            <Button color="primary" onClick={startNew}>
              <i className="ri-add-line me-1" /> Nueva cuenta
            </Button>
          </div>
        </div>

        {!loading && accounts.length === 0 && (
          <div className="alert alert-info d-flex align-items-center justify-content-between">
            <span>
              <i className="ri-information-line me-2" />
              Tu plan de cuentas está vacío. Puedes cargar el PUC Colombia base y después editar o agregar auxiliares a 8 dígitos.
            </span>
            <Button color="info" size="sm" onClick={seedColombia}>
              <i className="ri-download-cloud-2-line me-1" /> Cargar ahora
            </Button>
          </div>
        )}

        {editing && (
          <div className="border rounded p-3 mb-3 bg-light">
            <h6 className="mb-3">{editing.id ? 'Editar cuenta' : 'Nueva cuenta'}</h6>
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label fs-12">Código *</label>
                <Input
                  value={editing.account_code || ''}
                  onChange={e => setEditing(prev => ({ ...prev!, account_code: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="Ej: 11050501 (auxiliar 8 dig)"
                  maxLength={10}
                />
                <div className="form-text fs-11">
                  Clase (1) → Grupo (2) → Cuenta (4) → Subcuenta (6) → Auxiliar (8)
                </div>
              </div>
              <div className="col-md-5">
                <label className="form-label fs-12">Nombre *</label>
                <Input
                  value={editing.account_name || ''}
                  onChange={e => setEditing(prev => ({ ...prev!, account_name: e.target.value }))}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label fs-12">Tipo</label>
                <Input
                  type="select"
                  value={editing.account_type || ''}
                  onChange={e => setEditing(prev => ({ ...prev!, account_type: e.target.value }))}
                >
                  {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Input>
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <div className="form-check form-switch">
                  <Input
                    type="checkbox"
                    className="form-check-input"
                    id="puc-active"
                    checked={editing.is_active !== false}
                    onChange={e => setEditing(prev => ({ ...prev!, is_active: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="puc-active">Activa</label>
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button color="light" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
              <Button color="primary" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size="sm" /> : <i className="ri-save-line me-1" />} Guardar
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-4"><Spinner /></div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: 600 }}>
            <Table hover size="sm" className="mb-0">
              <thead className="sticky-top bg-white">
                <tr>
                  <th style={{ width: 110 }}>Código</th>
                  <th>Nombre</th>
                  <th style={{ width: 120 }}>Tipo</th>
                  <th style={{ width: 80 }}>Nivel</th>
                  <th style={{ width: 80 }}>Estado</th>
                  <th style={{ width: 130 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No hay cuentas que coincidan.</td></tr>
                ) : filtered.map(a => (
                  <tr key={a.id}>
                    <td><code>{a.account_code}</code></td>
                    <td style={{ paddingLeft: `${((a.level || 1) - 1) * 14 + 8}px` }}>{a.account_name}</td>
                    <td>{a.account_type ? <Badge color="secondary" className="fs-10">{a.account_type}</Badge> : <span className="text-muted">—</span>}</td>
                    <td>{a.level ?? levelFromCode(a.account_code)}</td>
                    <td>{a.is_active === false ? <Badge color="danger">Inactiva</Badge> : <Badge color="success">Activa</Badge>}</td>
                    <td>
                      <Button size="sm" color="light" className="me-1" onClick={() => startEdit(a)} title="Editar">
                        <i className="ri-pencil-line" />
                      </Button>
                      <Button size="sm" color="light" onClick={() => handleDelete(a)} title="Eliminar">
                        <i className="ri-delete-bin-line text-danger" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        <div className="text-muted fs-12 mt-2">
          {filtered.length} cuenta(s){search && ` encontrada(s) para "${search}"`} · Total: {accounts.length}
        </div>
      </CardBody>
      <BulkUploadAccountsModal
        isOpen={bulkOpen}
        toggle={() => setBulkOpen(false)}
        onComplete={load}
      />
    </Card>
  );
};

export default Puc;
