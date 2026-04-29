import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, Input, Spinner, Table } from 'reactstrap';
import { API_BASE, money, useAuthHeaders } from '../shared';

type Employee = {
  id: number | string;
  firstName?: string; lastName?: string; fullName?: string; name?: string;
  documentNumber?: string; document_number?: string; document?: string;
  position?: string; jobTitle?: string; job_title?: string;
  baseSalary?: number; base_salary?: number; salary?: number;
  status?: string; active?: boolean;
};

const Empleados: React.FC = () => {
  const headers = useAuthHeaders();
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/payroll/employees`, { headers });
      const d = await r.json();
      const list = Array.isArray(d?.employees) ? d.employees : (Array.isArray(d) ? d : (d?.data || []));
      setRows(list);
    } catch (e) { console.error(e); setRows([]); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(e => {
      const name = (e.fullName || e.name || `${e.firstName || ''} ${e.lastName || ''}`).toLowerCase();
      const doc = (e.documentNumber || e.document_number || e.document || '').toLowerCase();
      const pos = (e.position || e.jobTitle || e.job_title || '').toLowerCase();
      return name.includes(s) || doc.includes(s) || pos.includes(s);
    });
  }, [rows, q]);

  return (
    <Card className="shadow-sm">
      <CardBody>
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <Input type="search" placeholder="Buscar por nombre, documento o cargo..." value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 420 }} />
          <div className="d-flex gap-2">
            <Button color="light" onClick={load}><i className="ri-refresh-line me-1" /> Refrescar</Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4"><Spinner /></div>
        ) : (
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th>
                  <th>Documento</th>
                  <th>Cargo</th>
                  <th className="text-end">Salario base</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted py-4">Sin empleados para mostrar.</td></tr>
                ) : filtered.map(e => {
                  const name = e.fullName || e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || '(Sin nombre)';
                  const doc = e.documentNumber || e.document_number || e.document || '-';
                  const pos = e.position || e.jobTitle || e.job_title || '-';
                  const sal = e.baseSalary ?? e.base_salary ?? e.salary ?? 0;
                  const active = e.status ? e.status === 'active' : (e.active !== false);
                  return (
                    <tr key={e.id}>
                      <td>{name}</td>
                      <td className="font-monospace">{doc}</td>
                      <td>{pos}</td>
                      <td className="text-end font-monospace">${money(sal)}</td>
                      <td><Badge color={active ? 'success' : 'secondary'}>{active ? 'Activo' : 'Inactivo'}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default Empleados;
