/**
 * Selector de espacio de trabajo (estilo Alegra)
 * Espacio Contador = full (Kanban, empresas, personal, topbar switcher)
 * Crumi Contabilidad = limitado (solo documentos, clientes - sin Kanban, crear empresas, personal)
 */
import React, { useEffect, useState } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu } from 'reactstrap';
import { api } from '../../services/api';
import { getRoleFromToken, getTenantIdFromToken, setToken, getWorkspaceMode, setWorkspaceMode } from '../../services/auth';

type Workspace = { id: string; name: string };

const WorkspaceSelector = () => {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [tenantName, setTenantName] = useState<string>('Mi empresa');

  const role = getRoleFromToken();
  const currentTenantId = getTenantIdFromToken();
  const workspaceMode = getWorkspaceMode();
  const isContador = role === 4;
  const isSuperAdmin = role === 99;
  const canSwitch = isContador || isSuperAdmin;

  useEffect(() => {
    if (!canSwitch) return;
    setLoading(true);
    api.get('/tenants/mine')
      .then((res: any) => {
        const data = res?.data ?? res;
        setWorkspaces(Array.isArray(data) ? data : []);
      })
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, [canSwitch]);

  useEffect(() => {
    if (currentTenantId && !canSwitch) {
      api.get(`/tenants/${currentTenantId}`)
        .then((res: any) => setTenantName(res?.data?.name || 'Mi empresa'))
        .catch(() => {});
    }
  }, [currentTenantId, canSwitch]);

  if (!role) return null;

  const currentWs = workspaces.find((t) => t.id === currentTenantId);
  const currentName = currentWs?.name || 'Sin empresa';

  const onSelectEspacioContador = async () => {
    if (workspaceMode === 'contador' && workspaces.length > 0 && workspaces[0].id === currentTenantId) return;
    setSwitching(true);
    setWorkspaceMode('contador');
    const targetId = workspaces.length > 0 ? workspaces[0].id : currentTenantId;
    if (targetId && targetId !== currentTenantId) {
      try {
        const res: any = await api.post('/auth/switch-tenant', { tenantId: targetId });
        const data = res?.data ?? res;
        const token = data?.token;
        const user = data?.user;
        if (token) {
          setToken(token);
          const raw = sessionStorage.getItem('authUser');
          let authUser: any = raw ? JSON.parse(raw) : {};
          authUser = { ...authUser, token, user: user || authUser?.user };
          sessionStorage.setItem('authUser', JSON.stringify(authUser));
        }
      } catch (e) { console.error(e); }
    }
    window.location.reload();
  };

  const onSelectTenant = async (tenantId: string) => {
    if (tenantId === currentTenantId && workspaceMode === 'tenant') return;
    setSwitching(true);
    setWorkspaceMode('tenant');
    try {
      const res: any = await api.post('/auth/switch-tenant', { tenantId });
      const data = res?.data ?? res;
      const token = data?.token;
      const user = data?.user;
      if (!token) throw new Error('No token');
      setToken(token);
      const raw = sessionStorage.getItem('authUser');
      let authUser: any = raw ? JSON.parse(raw) : {};
      authUser = { ...authUser, token, user: user || authUser?.user };
      sessionStorage.setItem('authUser', JSON.stringify(authUser));
      window.location.reload();
    } catch (e) {
      console.error('Error switching workspace:', e);
    } finally {
      setSwitching(false);
    }
  };

  // Contador: solo "Espacio Contador" en sidebar (empresas van al topbar)
  if (isContador) {
    return (
      <div className="px-3 py-2 workspace-selector-sidebar">
        <div
          className="d-flex align-items-center py-2 px-2 rounded"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <i className="ri-calculator-line fs-18 text-white-50 me-2" />
          <div className="text-truncate">
            <div className="text-white small fw-medium">Espacio Contador</div>
            <small className="text-white-50" style={{ fontSize: '11px' }}>Gestión de múltiples clientes</small>
          </div>
        </div>
      </div>
    );
  }

  // Super Admin: solo lista de empresas (sin modo)
  if (isSuperAdmin) {
    const currentNameSa = workspaces.find((t) => t.id === currentTenantId)?.name || 'Sin empresa';
    const onSelect = async (tenantId: string) => {
      if (tenantId === currentTenantId) return;
      setSwitching(true);
      try {
        const res: any = await api.post('/auth/switch-tenant', { tenantId });
        const data = res?.data ?? res;
        const token = data?.token;
        const user = data?.user;
        if (!token) throw new Error('No token');
        setToken(token);
        const raw = sessionStorage.getItem('authUser');
        let authUser: any = raw ? JSON.parse(raw) : {};
        authUser = { ...authUser, token, user: user || authUser?.user };
        sessionStorage.setItem('authUser', JSON.stringify(authUser));
        window.location.reload();
      } catch (e) { console.error(e); } finally { setSwitching(false); }
    };
    return (
      <div className="px-3 py-2 workspace-selector-sidebar">
        <Dropdown isOpen={open} toggle={() => setOpen(!open)} className="w-100">
          <DropdownToggle tag="div" className="d-flex align-items-center justify-content-between py-2 px-2 rounded" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="d-flex align-items-center gap-2 text-truncate">
              <i className="ri-building-2-line fs-18 text-white-50" />
              <div className="text-truncate">
                <div className="text-white small fw-medium">{loading ? '…' : currentNameSa}</div>
                <small className="text-white-50" style={{ fontSize: '11px' }}>Super Admin</small>
              </div>
            </div>
            <i className="ri-arrow-down-s-line text-white-50 fs-18" />
          </DropdownToggle>
          <DropdownMenu className="workspace-dropdown-menu" style={{ minWidth: 260, marginTop: 4 }}>
            <div className="px-3 py-2 border-bottom"><h6 className="mb-0 text-dark">Tus espacios de trabajo</h6></div>
            {workspaces.map((w) => (
              <div key={w.id} role="button" className="d-flex align-items-center px-3 py-2" style={{ cursor: 'pointer' }} onClick={() => onSelect(w.id)}>
                <i className="ri-building-2-line me-2 text-primary" />
                <div className="flex-grow-1 fw-medium text-dark">{w.name}</div>
                {w.id === currentTenantId && <i className="ri-check-line text-success" />}
              </div>
            ))}
          </DropdownMenu>
        </Dropdown>
      </div>
    );
  }

  // Tenant normal (rol 1): muestra su empresa con opción de cambiar a Espacio Contador
  const displayName = tenantName.length > 20 ? tenantName.substring(0, 20) + '...' : tenantName;
  const isInContadorMode = workspaceMode === 'contador';

  return (
    <div className="px-3 py-2 workspace-selector-sidebar">
      <Dropdown isOpen={open} toggle={() => setOpen(!open)} className="w-100">
        <DropdownToggle tag="div" className="d-flex align-items-center justify-content-between py-2 px-2 rounded" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="d-flex align-items-center gap-2 text-truncate">
            <i className={`${isInContadorMode ? 'ri-calculator-line' : 'ri-building-2-line'} fs-18 text-white-50`} />
            <div className="text-truncate">
              <div className="text-white small fw-medium">{isInContadorMode ? 'Espacio Contador' : displayName}</div>
              <small className="text-white-50" style={{ fontSize: '11px' }}>{isInContadorMode ? 'Gestión de clientes' : 'Facturación, reportes, ingresos'}</small>
            </div>
          </div>
          <i className="ri-arrow-down-s-line text-white-50 fs-18" />
        </DropdownToggle>
        <DropdownMenu className="workspace-dropdown-menu" style={{ minWidth: 260, marginTop: 4 }}>
          <div className="px-3 py-2 border-bottom"><h6 className="mb-0 text-dark">Espacios de trabajo</h6></div>
          <div role="button" className="d-flex align-items-center px-3 py-2" style={{ cursor: 'pointer' }}
            onClick={async () => {
              if (workspaceMode !== 'tenant') {
                setWorkspaceMode('tenant');
                try { await api.post('/tenants/me/accountant-mode', { enabled: false }); } catch (e) { console.error(e); }
                window.location.reload();
              }
              setOpen(false);
            }}>
            <i className="ri-building-2-line me-2 text-primary" />
            <div className="flex-grow-1 fw-medium text-dark">{tenantName}</div>
            {workspaceMode === 'tenant' && <i className="ri-check-line text-success" />}
          </div>
          <div role="button" className="d-flex align-items-center px-3 py-2" style={{ cursor: 'pointer' }}
            onClick={async () => {
              if (workspaceMode !== 'contador') {
                setWorkspaceMode('contador');
                try { await api.post('/tenants/me/accountant-mode', { enabled: true }); } catch (e) { console.error(e); }
                window.location.reload();
              }
              setOpen(false);
            }}>
            <i className="ri-calculator-line me-2 text-warning" />
            <div className="flex-grow-1 fw-medium text-dark">Espacio Contador</div>
            {workspaceMode === 'contador' && <i className="ri-check-line text-success" />}
          </div>
        </DropdownMenu>
      </Dropdown>
      {isInContadorMode && workspaces.filter(w => w.id !== currentTenantId).length === 0 && (
        <div className="mt-2 px-2 py-2 rounded" style={{ background: 'rgba(255,193,7,0.12)', border: '1px solid rgba(255,193,7,0.3)' }}>
          <small className="text-white d-block mb-1">Aún no tienes empresas administradas.</small>
          <a href="/empresas/nueva" className="btn btn-sm btn-warning w-100">
            <i className="ri-add-line me-1" /> Crea tu primera empresa
          </a>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelector;
