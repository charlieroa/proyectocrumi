import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquareText, PanelTopOpen, Sparkles } from 'lucide-react';
import {
  AppRoleId,
  ErpDomainId,
  ERP_ROLE_LABELS,
  getDomainById,
  getDomainsForRole,
} from '../../config/erpModuleMap';
import { getRoleFromToken } from '../../services/auth';

interface DomainWorkspaceProps {
  domainId: ErpDomainId;
}

const DomainWorkspace: React.FC<DomainWorkspaceProps> = ({ domainId }) => {
  const domain = getDomainById(domainId);
  const currentRole = (getRoleFromToken() || 1) as AppRoleId;

  const visibleDomain = useMemo(() => {
    return getDomainsForRole(currentRole).find((item) => item.id === domainId);
  }, [currentRole, domainId]);

  if (!domain || !visibleDomain) {
    return null;
  }

  const activeModules = visibleDomain.items.filter((item) => item.status === 'active');
  const plannedModules = visibleDomain.items.filter((item) => item.status === 'planned');

  return (
    <div className="min-h-full px-4 py-5 px-sm-5">
      <div className="mx-auto" style={{ maxWidth: 1180 }}>
        <div className="rounded-5 overflow-hidden mb-4 shadow-sm border-0" style={{ background: 'linear-gradient(135deg, #101828 0%, #1f3b73 50%, #c26d3b 100%)' }}>
          <div className="p-4 p-md-5 text-white">
            <div className="d-flex flex-column flex-lg-row justify-content-between gap-4">
              <div>
                <div className="text-uppercase small fw-semibold opacity-75 mb-2">Dominio ERP</div>
                <h1 className="display-6 fw-bold mb-3">{domain.label}</h1>
                <p className="mb-3 opacity-75" style={{ maxWidth: 720 }}>{domain.description}</p>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge rounded-pill text-bg-light text-dark px-3 py-2">Rol: {ERP_ROLE_LABELS[currentRole]}</span>
                  <span className="badge rounded-pill border border-light px-3 py-2">Activos: {activeModules.length}</span>
                  <span className="badge rounded-pill border border-light px-3 py-2">Planeados: {plannedModules.length}</span>
                </div>
              </div>
              <div className="rounded-4 p-4 align-self-start" style={{ background: 'rgba(255,255,255,0.12)', minWidth: 280 }}>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <Sparkles size={18} />
                  <span className="fw-semibold">Modo chat primero</span>
                </div>
                <p className="mb-0 small opacity-75">
                  Este dominio ya queda preparado para operar desde chat y para abrir vistas expertas sin duplicar logica de negocio.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-12 col-xl-8">
            <div className="card border-0 shadow-sm h-100 rounded-5">
              <div className="card-body p-4 p-md-5">
                <div className="d-flex align-items-center gap-2 mb-4">
                  <PanelTopOpen size={18} />
                  <h2 className="h5 mb-0">Mapa operativo</h2>
                </div>
                <div className="row g-3">
                  {visibleDomain.items.map((module) => (
                    <div className="col-12 col-md-6" key={module.id}>
                      <Link
                        to={module.path || domain.path}
                        className="text-decoration-none"
                      >
                        <div className="h-100 rounded-4 border p-4" style={{ borderColor: '#e5e7eb', background: module.status === 'planned' ? '#fcfcfd' : '#ffffff' }}>
                          <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                            <div>
                              <div className="text-uppercase small text-muted mb-2">{module.status === 'active' ? 'Activo' : 'Planeado'}</div>
                              <h3 className="h6 mb-0 text-dark">{module.label}</h3>
                            </div>
                            <span className={`badge rounded-pill ${module.status === 'active' ? 'text-bg-dark' : 'text-bg-warning'}`}>
                              {module.status === 'active' ? 'Listo' : 'Plan'}
                            </span>
                          </div>
                          <div className="small text-muted">Ruta: {module.path || 'sin ruta'}</div>
                          <div className="small text-muted mt-2">Chat: {module.chatEnabled ? 'habilitado' : 'pendiente'}</div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm h-100 rounded-5">
              <div className="card-body p-4 p-md-5">
                <div className="d-flex align-items-center gap-2 mb-4">
                  <MessageSquareText size={18} />
                  <h2 className="h5 mb-0">Siguiente enfoque</h2>
                </div>
                <div className="small text-muted mb-3">Orden recomendado para terminar este dominio sin volverlo a enredar.</div>
                <ol className="ps-3 mb-0 d-grid gap-3">
                  <li>Separar servicios de negocio del modulo actual.</li>
                  <li>Exponer acciones reutilizables para chat y UI experta.</li>
                  <li>Agregar trazabilidad y estados por modulo.</li>
                  <li>Conectar vistas expertas con roadmap de implementacion.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DomainWorkspace;
