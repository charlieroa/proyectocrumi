import React, { useEffect, useState } from 'react';
import { Button, Card, CardBody, Col, Input, Row, Spinner } from 'reactstrap';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { API_BASE, ThirdParty, useAuthHeaders } from '../shared';

type Role = 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE' | 'OTHER';
type RoleOpt = { value: Role; label: string; icon: string; color: string };

const ROLE_OPTS: RoleOpt[] = [
  { value: 'CUSTOMER', label: 'Cliente', icon: 'ri-user-star-line', color: 'info' },
  { value: 'SUPPLIER', label: 'Proveedor', icon: 'ri-truck-line', color: 'warning' },
  { value: 'EMPLOYEE', label: 'Empleado', icon: 'ri-user-settings-line', color: 'success' },
  { value: 'OTHER', label: 'Otro', icon: 'ri-user-line', color: 'secondary' },
];

type Props = {
  initialData?: ThirdParty;
};

const NuevoTercero: React.FC<Props> = ({ initialData }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const headers = useAuthHeaders();
  const isEdit = !!initialData;

  // Permitir preseleccionar rol(es) al venir desde el atajo:
  // - location.state.kinds: array (multi-select del modal)
  // - location.state.kind o ?kind=...: rol único (compatibilidad)
  const initialRolesFromNav = ((): Role[] => {
    const isRole = (v: string): v is Role => ['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'OTHER'].includes(v);
    const stateRaw = (location.state as any) || {};
    if (Array.isArray(stateRaw.kinds) && stateRaw.kinds.length > 0) {
      const arr = stateRaw.kinds.map((x: any) => String(x).toUpperCase()).filter(isRole) as Role[];
      if (arr.length > 0) return arr;
    }
    const fromState = stateRaw.kind ? String(stateRaw.kind).toUpperCase() : '';
    const fromQuery = (searchParams.get('kind') || '').toUpperCase();
    const candidate = fromState || fromQuery || 'CUSTOMER';
    return [isRole(candidate) ? candidate : 'CUSTOMER'];
  })();

  const [roles, setRoles] = useState<Role[]>(initialRolesFromNav);
  const [form, setForm] = useState({
    documentType: 'NIT',
    documentNumber: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    department: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Pre-poblar en modo edit
  useEffect(() => {
    if (!initialData) return;
    const initialRoles = (initialData.roles || [initialData.kind || 'OTHER']).filter(
      (r): r is Role => ['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'OTHER'].includes(r as string),
    );
    setRoles(initialRoles.length > 0 ? initialRoles : ['OTHER']);
    setForm({
      documentType: initialData.document_type || 'NIT',
      documentNumber: initialData.document_number || '',
      name: initialData.name || '',
      email: initialData.email || '',
      phone: initialData.phone || '',
      address: initialData.address || '',
      city: initialData.city || '',
      department: (initialData as any).department || '',
    });
  }, [initialData]);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  const toggleRole = (r: Role) => {
    setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.documentNumber.trim()) { setError('El número de documento es obligatorio'); return; }
    if (roles.length === 0) { setError('Selecciona al menos un tipo (cliente, proveedor, etc.)'); return; }
    setSaving(true);
    try {
      const url = isEdit
        ? `${API_BASE}/accounting/third-parties/${initialData!.id}`
        : `${API_BASE}/accounting/third-parties`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ ...form, kind: roles[0], roles }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (isEdit) {
          navigate(`/terceros-hub/${initialData!.id}`, { state: { thirdParty: data.thirdParty } });
        } else {
          navigate('/terceros-hub');
        }
      } else {
        setError(data.message || data.error || `No se pudo ${isEdit ? 'guardar los cambios' : 'crear el tercero'}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Error de red');
    }
    setSaving(false);
  };

  return (
    <Card className="shadow-sm">
      <CardBody>
        <h6 className="mb-1">Tipo de tercero</h6>
        <p className="text-muted fs-12 mb-3">Puedes marcar más de uno. Un mismo NIT puede ser cliente y proveedor a la vez.</p>
        <Row className="g-2 mb-4">
          {ROLE_OPTS.map(k => {
            const active = roles.includes(k.value);
            return (
              <Col md={3} key={k.value}>
                <Card
                  role="button"
                  className={`border ${active ? `border-${k.color} shadow-sm` : ''}`}
                  onClick={() => toggleRole(k.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <CardBody className="d-flex align-items-center gap-2 py-3">
                    <Input type="checkbox" checked={active} readOnly className="me-1" />
                    <div className={`avatar-sm rounded-circle bg-${k.color}-subtle d-flex align-items-center justify-content-center`} style={{ width: 40, height: 40 }}>
                      <i className={`${k.icon} fs-20 text-${k.color}`} />
                    </div>
                    <div className="fw-semibold">{k.label}</div>
                  </CardBody>
                </Card>
              </Col>
            );
          })}
        </Row>

        <h6 className="mb-3">Datos básicos</h6>
        <Row className="g-3">
          <Col md={3}>
            <label className="form-label fs-12 text-muted">Tipo de documento</label>
            <Input type="select" value={form.documentType} onChange={e => set('documentType', e.target.value)}>
              <option value="NIT">NIT</option>
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="PP">PP</option>
            </Input>
          </Col>
          <Col md={3}>
            <label className="form-label fs-12 text-muted">Número de documento *</label>
            <Input value={form.documentNumber} onChange={e => set('documentNumber', e.target.value)} />
          </Col>
          <Col md={6}>
            <label className="form-label fs-12 text-muted">Nombre / Razón social *</label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} />
          </Col>
          <Col md={6}>
            <label className="form-label fs-12 text-muted">Email</label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </Col>
          <Col md={6}>
            <label className="form-label fs-12 text-muted">Teléfono</label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
          </Col>
          <Col md={12}>
            <label className="form-label fs-12 text-muted">Dirección</label>
            <Input value={form.address} onChange={e => set('address', e.target.value)} />
          </Col>
          <Col md={6}>
            <label className="form-label fs-12 text-muted">Ciudad</label>
            <Input value={form.city} onChange={e => set('city', e.target.value)} />
          </Col>
          <Col md={6}>
            <label className="form-label fs-12 text-muted">Departamento</label>
            <Input value={form.department} onChange={e => set('department', e.target.value)} />
          </Col>
        </Row>

        {error && (
          <div className="alert alert-danger mt-3 mb-0 py-2">
            <i className="ri-error-warning-line me-1" /> {error}
          </div>
        )}

        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button color="light" onClick={() => navigate(-1)} disabled={saving}>Cancelar</Button>
          <Button color="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <i className="ri-save-line me-1" />}
            {' '}{isEdit ? 'Guardar cambios' : 'Guardar'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};

export default NuevoTercero;
