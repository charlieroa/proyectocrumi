import React, { useEffect, useState } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { api } from '../../services/api';
import { getRoleFromToken, getTenantIdFromToken, isContadorFullMode, isRealContador } from '../../services/auth';
import { setToken } from '../../services/auth';

type Tenant = { id: string; name: string };

const TenantSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const role = getRoleFromToken();
  const currentTenantId = getTenantIdFromToken();
  // Topbar switcher: Super Admin siempre; Contador (4) o Tenant (1) en modo Espacio Contador
  const canSwitch = role === 99 || isContadorFullMode();

  useEffect(() => {
    if (!canSwitch) return;
    setLoading(true);
    api.get('/tenants/mine')
      .then((res: any) => {
        const data = res?.data ?? res;
        setTenants(Array.isArray(data) ? data : []);
      })
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, [canSwitch]);

  const currentName = tenants.find((t) => t.id === currentTenantId)?.name || 'Sin empresa';

  const onSelect = async (tenantId: string) => {
    if (tenantId === currentTenantId) return;
    setSwitching(true);
    try {
      const res: any = await api.post('/auth/switch-tenant', { tenantId });
      const data = res?.data ?? res;
      const token = data?.token;
      const user = data?.user;
      if (!token) {
        console.error('No token received from switch-tenant');
        setSwitching(false);
        return;
      }
      setToken(token);
      const raw = sessionStorage.getItem('authUser');
      let authUser: any = raw ? JSON.parse(raw) : {};
      authUser = { ...authUser, token, user: user || authUser?.user };
      sessionStorage.setItem('authUser', JSON.stringify(authUser));
      setTimeout(() => window.location.reload(), 100);
    } catch (e: any) {
      console.error('Error switching tenant:', e);
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        window.location.href = '/login';
      }
      setSwitching(false);
    }
  };

  if (!canSwitch) return null;

  return (
    <Dropdown isOpen={open} toggle={() => setOpen(!open)} className="header-item topbar-head-dropdown">
      <DropdownToggle tag="button" type="button" className="btn btn-icon btn-topbar btn-ghost-secondary rounded-circle">
        <i className="ri-building-2-line fs-22" title="Cambiar empresa" />
      </DropdownToggle>
      <DropdownMenu className="dropdown-menu-end">
        <div className="px-3 py-2 border-bottom">
          <small className="text-muted">Empresa actual</small>
          <div className="fw-medium">{loading ? '…' : currentName}</div>
        </div>
        {tenants.length === 0 && !loading && (
          <DropdownItem disabled>No hay empresas</DropdownItem>
        )}
        {tenants.map((t) => (
          <DropdownItem
            key={t.id}
            active={t.id === currentTenantId}
            onClick={() => onSelect(t.id)}
            disabled={switching}
          >
            {t.name}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

export default TenantSwitcher;
