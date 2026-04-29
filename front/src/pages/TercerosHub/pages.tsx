import React, { useEffect, useState } from 'react';
import { Button, Spinner } from 'reactstrap';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import TercerosHubLayout from './TercerosHubLayout';
import ListaTerceros from './sections/ListaTerceros';
import NuevoTercero from './sections/NuevoTercero';
import DetalleTercero from './sections/DetalleTercero';
import { API_BASE, ThirdParty, useAuthHeaders } from './shared';
import NuevoTerceroModal from '../../Components/Common/NuevoTerceroModal';

const ListaActions: React.FC = () => {
  const navigate = useNavigate();
  const [tpOpen, setTpOpen] = useState(false);
  return (
    <div className="d-flex gap-2">
      <Button color="light" size="sm" onClick={() => navigate(-1)} title="Volver">
        <i className="ri-arrow-left-line me-1" /> Volver
      </Button>
      <Button color="light" size="sm" onClick={() => navigate('/settings')} title="Ir a Configuración">
        <i className="ri-settings-3-line me-1" /> Configuración
      </Button>
      <Button color="primary" size="sm" onClick={() => setTpOpen(true)}>
        <i className="ri-user-add-line me-1" /> Nuevo tercero
      </Button>
      <NuevoTerceroModal isOpen={tpOpen} onClose={() => setTpOpen(false)} />
    </div>
  );
};

export const ListaPage = () => (
  <TercerosHubLayout
    title="Terceros"
    subtitle="Clientes, proveedores, empleados y otros"
    icon="ri-group-line"
    iconColor="primary"
    hideBack
    actions={<ListaActions />}
  >
    <ListaTerceros />
  </TercerosHubLayout>
);

export const NuevoPage = () => (
  <TercerosHubLayout title="Nuevo tercero" icon="ri-user-add-line" iconColor="success">
    <NuevoTercero />
  </TercerosHubLayout>
);

export const DetallePage = () => (
  <TercerosHubLayout title="Detalle de tercero" icon="ri-user-line" iconColor="info">
    <DetalleTercero />
  </TercerosHubLayout>
);

const EditarTerceroLoader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const headers = useAuthHeaders();
  const stateTp = (location.state as any)?.thirdParty as ThirdParty | undefined;
  const [tercero, setTercero] = useState<ThirdParty | null>(stateTp || null);
  const [loading, setLoading] = useState(!stateTp);

  useEffect(() => {
    if (stateTp) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/accounting/third-parties`, { headers });
        const data = await res.json();
        if (!cancelled && data.success) {
          const found = (data.thirdParties || []).find((t: ThirdParty) => String(t.id) === String(id));
          setTercero(found || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [headers, id, stateTp]);

  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (!tercero) return <div className="text-center py-5 text-muted">No se encontró el tercero.</div>;
  return <NuevoTercero initialData={tercero} />;
};

export const EditarPage = () => (
  <TercerosHubLayout title="Editar tercero" icon="ri-pencil-line" iconColor="warning">
    <EditarTerceroLoader />
  </TercerosHubLayout>
);
