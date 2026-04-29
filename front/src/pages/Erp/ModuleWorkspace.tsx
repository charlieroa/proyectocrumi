import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, CircleDashed, LayoutPanelTop, ListChecks } from 'lucide-react';
import { getModuleById } from '../../config/erpModuleMap';

interface ModuleWorkspaceProps {
  moduleId: string;
}

const ModuleWorkspace: React.FC<ModuleWorkspaceProps> = ({ moduleId }) => {
  const module = getModuleById(moduleId);

  if (!module) {
    return null;
  }

  const relatedModules = module.domain.items.filter((item) => item.id !== module.id);

  return (
    <div className="min-h-full px-4 py-5 px-sm-5">
      <div className="mx-auto" style={{ maxWidth: 1120 }}>
        <div className="card border-0 shadow-sm rounded-5 overflow-hidden mb-4">
          <div className="card-body p-4 p-md-5" style={{ background: 'linear-gradient(135deg, #f7efe4 0%, #f8fafc 48%, #e7eefc 100%)' }}>
            <div className="d-flex flex-column flex-lg-row justify-content-between gap-4">
              <div>
                <div className="text-uppercase small fw-semibold text-muted mb-2">Modulo {module.status === 'planned' ? 'planeado' : 'activo'}</div>
                <h1 className="display-6 fw-bold mb-3 text-dark">{module.label}</h1>
                <p className="text-muted mb-3" style={{ maxWidth: 720 }}>
                  Este espacio ya existe como parte formal del ERP. La meta es implementarlo sin mezclar logica de negocio, interfaz experta y capacidades de chat.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge rounded-pill text-bg-dark px-3 py-2">Dominio: {module.domain.label}</span>
                  <span className={`badge rounded-pill px-3 py-2 ${module.status === 'planned' ? 'text-bg-warning' : 'text-bg-success'}`}>
                    {module.status === 'planned' ? 'En roadmap' : 'En operacion'}
                  </span>
                  <span className="badge rounded-pill text-bg-light border px-3 py-2 text-dark">Ruta: {module.path}</span>
                </div>
              </div>
              <div className="rounded-4 p-4 bg-white shadow-sm align-self-start" style={{ minWidth: 280 }}>
                <div className="d-flex align-items-center gap-2 mb-3 text-dark">
                  <Bot size={18} />
                  <span className="fw-semibold">Contrato con chat</span>
                </div>
                <div className="small text-muted">
                  {module.chatEnabled
                    ? 'Este modulo se diseña para exponer consultas, acciones guiadas, preview y confirmacion desde chat.'
                    : 'Este modulo todavia no expone operaciones conversacionales.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-12 col-xl-7">
            <div className="card border-0 shadow-sm rounded-5 h-100">
              <div className="card-body p-4 p-md-5">
                <div className="d-flex align-items-center gap-2 mb-4 text-dark">
                  <ListChecks size={18} />
                  <h2 className="h5 mb-0">Plan de implementacion</h2>
                </div>
                <div className="d-grid gap-3">
                  <div className="rounded-4 border p-3">
                    <div className="fw-semibold text-dark mb-1">1. Modelo de datos y reglas</div>
                    <div className="small text-muted">Definir entidades, estados, validaciones, relaciones con tenant, auditoria y permisos.</div>
                  </div>
                  <div className="rounded-4 border p-3">
                    <div className="fw-semibold text-dark mb-1">2. Servicios de negocio</div>
                    <div className="small text-muted">Mover la logica a servicios reutilizables antes de abrir mas pantallas o acciones de chat.</div>
                  </div>
                  <div className="rounded-4 border p-3">
                    <div className="fw-semibold text-dark mb-1">3. UI experta</div>
                    <div className="small text-muted">Construir dashboard, listado, detalle, formularios, acciones y trazabilidad del modulo.</div>
                  </div>
                  <div className="rounded-4 border p-3">
                    <div className="fw-semibold text-dark mb-1">4. Operacion conversacional</div>
                    <div className="small text-muted">Exponer consultas y comandos por chat con preview, confirmacion y registro de auditoria.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-5">
            <div className="card border-0 shadow-sm rounded-5 mb-4">
              <div className="card-body p-4">
                <div className="d-flex align-items-center gap-2 mb-3 text-dark">
                  <CircleDashed size={18} />
                  <h2 className="h6 mb-0">Estado actual</h2>
                </div>
                <p className="small text-muted mb-0">
                  {module.status === 'planned'
                    ? 'Este modulo ya tiene ubicacion oficial en la arquitectura y queda listo para desarrollo incremental.'
                    : 'Este modulo ya existe y debe seguir migrandose a la nueva arquitectura por dominios.'}
                </p>
              </div>
            </div>

            <div className="card border-0 shadow-sm rounded-5">
              <div className="card-body p-4">
                <div className="d-flex align-items-center gap-2 mb-3 text-dark">
                  <LayoutPanelTop size={18} />
                  <h2 className="h6 mb-0">Modulos relacionados</h2>
                </div>
                <div className="d-grid gap-2">
                  {relatedModules.map((item) => (
                    <Link key={item.id} to={item.path || module.domain.path} className="d-flex align-items-center justify-content-between text-decoration-none rounded-4 border px-3 py-3 text-dark">
                      <span>{item.label}</span>
                      <ArrowRight size={16} />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleWorkspace;
