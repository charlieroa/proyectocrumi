import React, { useEffect, useState, useCallback } from 'react';
import {
  Container, Row, Col,
  Card, CardBody, CardHeader, Table, Badge, Input, Button,
  Spinner, Modal, ModalHeader, ModalBody, ModalFooter,
  Form, FormGroup, Label,
} from 'reactstrap';
import { ModuleLayout } from '../../Components/Common/ModuleSidebar';
import { buildCrmSidebarSections } from './config/crmSidebar';
import { env } from '../../env';

const API_BASE = env.API_URL;

const STATUS_OPTIONS = ['NUEVO', 'CONTACTADO', 'CALIFICADO', 'PROPUESTA', 'GANADO', 'PERDIDO'] as const;
type LeadStatus = typeof STATUS_OPTIONS[number];

const STATUS_COLORS: Record<LeadStatus, string> = {
  NUEVO: 'info',
  CONTACTADO: 'warning',
  CALIFICADO: 'primary',
  PROPUESTA: 'secondary',
  GANADO: 'success',
  PERDIDO: 'danger',
};

const ACTIVITY_TYPES = ['LLAMADA', 'EMAIL', 'REUNION', 'NOTA'] as const;

const emptyLeadForm = {
  name: '', email: '', phone: '', company: '', source: '',
  estimatedValue: '', expectedCloseDate: '', notes: '', stageId: '',
  status: 'NUEVO',
};

const headers = () => {
  const token = sessionStorage.getItem('authToken') ||
    JSON.parse(sessionStorage.getItem('authUser') || '{}')?.token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const CRMPage: React.FC = () => {
  document.title = 'CRM | Crumi';

  const [activeTab, setActiveTab] = useState('dashboard');

  // Leads
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pipeline
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);

  // Activities
  const [activities, setActivities] = useState<any[]>([]);

  // Dashboard
  const [dashboardMetrics, setDashboardMetrics] = useState<any>({
    totalLeads: 0, totalValue: 0, newThisMonth: 0, wonCount: 0, conversionRate: 0, byStatus: [],
  });

  // Lead modal
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadForm, setLeadForm] = useState({ ...emptyLeadForm });
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);

  // Activity form
  const [activityForm, setActivityForm] = useState({
    leadId: '', activityType: 'LLAMADA', description: '', scheduledAt: '',
  });

  // Stage form
  const [stageForm, setStageForm] = useState({ name: '', stageOrder: '0', color: '#6c757d' });

  const sidebarSections = buildCrmSidebarSections();

  // =============================================
  // FETCH FUNCTIONS
  // =============================================

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/crm/dashboard`, { headers: headers() });
      const data = await res.json();
      if (data.success) setDashboardMetrics(data.metrics);
    } catch (err) {
      console.error('Error fetching CRM dashboard:', err);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API_BASE}/crm/leads?${params}`, { headers: headers() });
      const data = await res.json();
      if (data.success) setLeads(data.leads);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLeadsLoading(false);
    }
  }, [searchTerm, statusFilter]);

  const fetchPipelineStages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/crm/pipeline-stages`, { headers: headers() });
      const data = await res.json();
      if (data.success) setPipelineStages(data.stages);
    } catch (err) {
      console.error('Error fetching pipeline stages:', err);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/crm/activities`, { headers: headers() });
      const data = await res.json();
      if (data.success) setActivities(data.activities);
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchLeads();
    fetchPipelineStages();
    fetchActivities();
  }, [fetchDashboard, fetchLeads, fetchPipelineStages, fetchActivities]);

  useEffect(() => {
    if (activeTab === 'leads' || activeTab === 'pipeline') fetchLeads();
    if (activeTab === 'dashboard') fetchDashboard();
    if (activeTab === 'actividades') fetchActivities();
    if (activeTab === 'etapas' || activeTab === 'pipeline') fetchPipelineStages();
  }, [activeTab, fetchLeads, fetchDashboard, fetchActivities, fetchPipelineStages]);

  // =============================================
  // CRUD HANDLERS
  // =============================================

  const handleSaveLead = async () => {
    try {
      const body = {
        name: leadForm.name,
        email: leadForm.email || null,
        phone: leadForm.phone || null,
        company: leadForm.company || null,
        source: leadForm.source || null,
        status: leadForm.status || 'NUEVO',
        estimatedValue: leadForm.estimatedValue ? parseFloat(leadForm.estimatedValue) : 0,
        expectedCloseDate: leadForm.expectedCloseDate || null,
        notes: leadForm.notes || null,
        stageId: leadForm.stageId ? parseInt(leadForm.stageId, 10) : null,
      };

      const url = editingLeadId
        ? `${API_BASE}/crm/leads/${editingLeadId}`
        : `${API_BASE}/crm/leads`;
      const method = editingLeadId ? 'PUT' : 'POST';

      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setShowLeadModal(false);
        setLeadForm({ ...emptyLeadForm });
        setEditingLeadId(null);
        fetchLeads();
        fetchDashboard();
      }
    } catch (err) {
      console.error('Error saving lead:', err);
    }
  };

  const handleDeleteLead = async (id: number) => {
    if (!window.confirm('Eliminar este lead?')) return;
    try {
      const res = await fetch(`${API_BASE}/crm/leads/${id}`, { method: 'DELETE', headers: headers() });
      const data = await res.json();
      if (data.success) {
        fetchLeads();
        fetchDashboard();
      }
    } catch (err) {
      console.error('Error deleting lead:', err);
    }
  };

  const handleEditLead = (lead: any) => {
    setEditingLeadId(lead.id);
    setLeadForm({
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      source: lead.source || '',
      estimatedValue: lead.estimated_value?.toString() || '',
      expectedCloseDate: lead.expected_close_date ? lead.expected_close_date.split('T')[0] : '',
      notes: lead.notes || '',
      stageId: lead.stage_id?.toString() || '',
      status: lead.status || 'NUEVO',
    });
    setShowLeadModal(true);
  };

  const handleConvertLead = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/crm/leads/${id}/convert`, { method: 'POST', headers: headers() });
      const data = await res.json();
      if (data.success) {
        fetchLeads();
        fetchDashboard();
      }
    } catch (err) {
      console.error('Error converting lead:', err);
    }
  };

  const handleDragStage = async (leadId: number, stageId: number) => {
    try {
      const res = await fetch(`${API_BASE}/crm/leads/${leadId}/stage`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify({ stageId }),
      });
      const data = await res.json();
      if (data.success) fetchLeads();
    } catch (err) {
      console.error('Error updating lead stage:', err);
    }
  };

  const handleCreateActivity = async () => {
    try {
      const body = {
        leadId: activityForm.leadId ? parseInt(activityForm.leadId, 10) : null,
        activityType: activityForm.activityType,
        description: activityForm.description || null,
        scheduledAt: activityForm.scheduledAt || null,
      };
      const res = await fetch(`${API_BASE}/crm/activities`, {
        method: 'POST', headers: headers(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setActivityForm({ leadId: '', activityType: 'LLAMADA', description: '', scheduledAt: '' });
        fetchActivities();
      }
    } catch (err) {
      console.error('Error creating activity:', err);
    }
  };

  const handleCreateStage = async () => {
    try {
      const body = {
        name: stageForm.name,
        stageOrder: parseInt(stageForm.stageOrder, 10) || 0,
        color: stageForm.color,
      };
      const res = await fetch(`${API_BASE}/crm/pipeline-stages`, {
        method: 'POST', headers: headers(), body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setStageForm({ name: '', stageOrder: '0', color: '#6c757d' });
        fetchPipelineStages();
      }
    } catch (err) {
      console.error('Error creating stage:', err);
    }
  };

  const openNewLead = () => {
    setEditingLeadId(null);
    setLeadForm({ ...emptyLeadForm });
    setShowLeadModal(true);
  };

  // =============================================
  // FORMAT HELPERS
  // =============================================

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-CO') : '-';

  // =============================================
  // RENDER TABS
  // =============================================

  const renderDashboard = () => (
    <>
      <Row className="g-3 mb-4">
        {[
          { label: 'Total Leads', value: dashboardMetrics.totalLeads, icon: 'ri-user-follow-line', color: 'primary' },
          { label: 'Valor Estimado', value: fmtCurrency(dashboardMetrics.totalValue), icon: 'ri-money-dollar-circle-line', color: 'success' },
          { label: 'Nuevos este Mes', value: dashboardMetrics.newThisMonth, icon: 'ri-add-circle-line', color: 'info' },
          { label: 'Ganados', value: dashboardMetrics.wonCount, icon: 'ri-trophy-line', color: 'warning' },
        ].map((kpi, i) => (
          <Col sm={6} lg={3} key={i}>
            <Card className="shadow-sm border-0">
              <CardBody className="d-flex align-items-center gap-3">
                <div className={`avatar-sm bg-soft-${kpi.color} rounded-circle d-flex align-items-center justify-content-center`}>
                  <i className={`${kpi.icon} text-${kpi.color} fs-4`}></i>
                </div>
                <div>
                  <p className="text-muted mb-0 small">{kpi.label}</p>
                  <h5 className="mb-0">{kpi.value}</h5>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-3">
        <Col md={6}>
          <Card className="shadow-sm border-0">
            <CardHeader className="bg-transparent">
              <h6 className="mb-0">Leads por Estado</h6>
            </CardHeader>
            <CardBody>
              {dashboardMetrics.byStatus?.length > 0 ? (
                <Table size="sm" borderless>
                  <thead>
                    <tr><th>Estado</th><th className="text-end">Cantidad</th><th className="text-end">Valor</th></tr>
                  </thead>
                  <tbody>
                    {dashboardMetrics.byStatus.map((row: any, i: number) => (
                      <tr key={i}>
                        <td><Badge color={STATUS_COLORS[row.status as LeadStatus] || 'secondary'}>{row.status}</Badge></td>
                        <td className="text-end">{row.count}</td>
                        <td className="text-end">{fmtCurrency(parseFloat(row.total_value))}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-muted text-center py-3">Sin datos</p>
              )}
            </CardBody>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm border-0">
            <CardHeader className="bg-transparent">
              <h6 className="mb-0">Tasa de Conversion</h6>
            </CardHeader>
            <CardBody className="text-center py-4">
              <h2 className="text-success mb-1">{dashboardMetrics.conversionRate}%</h2>
              <p className="text-muted mb-0">de leads convertidos a clientes</p>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  );

  const renderLeads = () => (
    <Card className="shadow-sm border-0">
      <CardHeader className="bg-transparent d-flex align-items-center gap-2 flex-wrap">
        <Input
          type="text" placeholder="Buscar leads..." bsSize="sm"
          style={{ maxWidth: 250 }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Input
          type="select" bsSize="sm" style={{ maxWidth: 180 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </Input>
        <Button color="primary" size="sm" className="ms-auto" onClick={() => { fetchLeads(); }}>
          <i className="ri-refresh-line me-1"></i>Actualizar
        </Button>
      </CardHeader>
      <CardBody className="p-0">
        {leadsLoading ? (
          <div className="text-center py-5"><Spinner size="sm" /> Cargando...</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-5 text-muted">No hay leads</div>
        ) : (
          <div className="table-responsive">
            <Table hover size="sm" className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th><th>Empresa</th><th>Email</th>
                  <th className="text-end">Valor</th><th>Estado</th><th>Fecha</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: any) => (
                  <tr key={lead.id}>
                    <td className="fw-semibold">{lead.name}</td>
                    <td>{lead.company || '-'}</td>
                    <td>{lead.email || '-'}</td>
                    <td className="text-end">{fmtCurrency(parseFloat(lead.estimated_value || 0))}</td>
                    <td><Badge color={STATUS_COLORS[lead.status as LeadStatus] || 'secondary'}>{lead.status}</Badge></td>
                    <td>{fmtDate(lead.created_at)}</td>
                    <td>
                      <Button size="sm" color="soft-primary" className="me-1" onClick={() => handleEditLead(lead)}>
                        <i className="ri-pencil-line"></i>
                      </Button>
                      {lead.status !== 'GANADO' && (
                        <Button size="sm" color="soft-success" className="me-1" onClick={() => handleConvertLead(lead.id)}>
                          <i className="ri-trophy-line"></i>
                        </Button>
                      )}
                      <Button size="sm" color="soft-danger" onClick={() => handleDeleteLead(lead.id)}>
                        <i className="ri-delete-bin-line"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </CardBody>
    </Card>
  );

  const renderPipeline = () => {
    const leadsForStage = (stageId: number) => leads.filter(l => l.stage_id === stageId);
    const unassigned = leads.filter(l => !l.stage_id);

    return (
      <div className="d-flex gap-3 overflow-auto pb-3" style={{ minHeight: 400 }}>
        {/* Unassigned column */}
        <div style={{ minWidth: 260, maxWidth: 300 }} className="flex-shrink-0">
          <Card className="shadow-sm border-0 h-100">
            <CardHeader className="bg-transparent py-2 d-flex justify-content-between align-items-center">
              <span className="fw-semibold small">Sin Etapa</span>
              <Badge color="secondary" pill>{unassigned.length}</Badge>
            </CardHeader>
            <CardBody className="p-2 d-flex flex-column gap-2" style={{ overflowY: 'auto', maxHeight: 500 }}>
              {unassigned.map((lead: any) => (
                <Card key={lead.id} className="shadow-sm border mb-0 cursor-pointer" onClick={() => handleEditLead(lead)}>
                  <CardBody className="p-2">
                    <h6 className="mb-1 small fw-semibold">{lead.name}</h6>
                    <p className="mb-0 text-muted" style={{ fontSize: 11 }}>{lead.company || '-'}</p>
                    <p className="mb-0 text-success small fw-semibold">{fmtCurrency(parseFloat(lead.estimated_value || 0))}</p>
                  </CardBody>
                </Card>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Stage columns */}
        {pipelineStages.map((stage: any) => {
          const stageLeads = leadsForStage(stage.id);
          return (
            <div key={stage.id} style={{ minWidth: 260, maxWidth: 300 }} className="flex-shrink-0">
              <Card className="shadow-sm border-0 h-100">
                <CardHeader
                  className="py-2 d-flex justify-content-between align-items-center"
                  style={{ backgroundColor: stage.color + '22', borderBottom: `3px solid ${stage.color}` }}
                >
                  <span className="fw-semibold small">{stage.name}</span>
                  <Badge color="dark" pill>{stageLeads.length}</Badge>
                </CardHeader>
                <CardBody
                  className="p-2 d-flex flex-column gap-2"
                  style={{ overflowY: 'auto', maxHeight: 500 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const leadId = parseInt(e.dataTransfer.getData('leadId'), 10);
                    if (leadId) handleDragStage(leadId, stage.id);
                  }}
                >
                  {stageLeads.map((lead: any) => (
                    <Card
                      key={lead.id}
                      className="shadow-sm border mb-0 cursor-pointer"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id.toString())}
                      onClick={() => handleEditLead(lead)}
                    >
                      <CardBody className="p-2">
                        <h6 className="mb-1 small fw-semibold">{lead.name}</h6>
                        <p className="mb-0 text-muted" style={{ fontSize: 11 }}>{lead.company || '-'}</p>
                        <p className="mb-0 text-success small fw-semibold">{fmtCurrency(parseFloat(lead.estimated_value || 0))}</p>
                      </CardBody>
                    </Card>
                  ))}
                </CardBody>
              </Card>
            </div>
          );
        })}
      </div>
    );
  };

  const renderActividades = () => (
    <Row className="g-3">
      <Col md={8}>
        <Card className="shadow-sm border-0">
          <CardHeader className="bg-transparent"><h6 className="mb-0">Actividades Recientes</h6></CardHeader>
          <CardBody className="p-0">
            {activities.length === 0 ? (
              <p className="text-center text-muted py-4">Sin actividades</p>
            ) : (
              <div className="table-responsive">
                <Table hover size="sm" className="mb-0">
                  <thead className="table-light">
                    <tr><th>Tipo</th><th>Descripcion</th><th>Lead</th><th>Programada</th><th>Completada</th></tr>
                  </thead>
                  <tbody>
                    {activities.map((a: any) => (
                      <tr key={a.id}>
                        <td><Badge color="info">{a.activity_type}</Badge></td>
                        <td>{a.description || '-'}</td>
                        <td>{a.lead_name || '-'}</td>
                        <td>{fmtDate(a.scheduled_at)}</td>
                        <td>{a.completed_at ? fmtDate(a.completed_at) : <span className="text-warning">Pendiente</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </Col>
      <Col md={4}>
        <Card className="shadow-sm border-0">
          <CardHeader className="bg-transparent"><h6 className="mb-0">Nueva Actividad</h6></CardHeader>
          <CardBody>
            <FormGroup>
              <Label className="small">Tipo</Label>
              <Input type="select" bsSize="sm" value={activityForm.activityType}
                onChange={(e) => setActivityForm({ ...activityForm, activityType: e.target.value })}>
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label className="small">Lead</Label>
              <Input type="select" bsSize="sm" value={activityForm.leadId}
                onChange={(e) => setActivityForm({ ...activityForm, leadId: e.target.value })}>
                <option value="">-- Seleccionar --</option>
                {leads.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label className="small">Descripcion</Label>
              <Input type="textarea" bsSize="sm" rows={2} value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} />
            </FormGroup>
            <FormGroup>
              <Label className="small">Fecha programada</Label>
              <Input type="datetime-local" bsSize="sm" value={activityForm.scheduledAt}
                onChange={(e) => setActivityForm({ ...activityForm, scheduledAt: e.target.value })} />
            </FormGroup>
            <Button color="primary" size="sm" block onClick={handleCreateActivity} disabled={!activityForm.activityType}>
              Crear Actividad
            </Button>
          </CardBody>
        </Card>
      </Col>
    </Row>
  );

  const renderEtapas = () => (
    <Row className="g-3">
      <Col md={8}>
        <Card className="shadow-sm border-0">
          <CardHeader className="bg-transparent"><h6 className="mb-0">Etapas del Pipeline</h6></CardHeader>
          <CardBody className="p-0">
            {pipelineStages.length === 0 ? (
              <p className="text-center text-muted py-4">Sin etapas configuradas</p>
            ) : (
              <Table hover size="sm" className="mb-0">
                <thead className="table-light">
                  <tr><th>Nombre</th><th>Orden</th><th>Color</th></tr>
                </thead>
                <tbody>
                  {pipelineStages.map((s: any) => (
                    <tr key={s.id}>
                      <td className="fw-semibold">{s.name}</td>
                      <td>{s.stage_order}</td>
                      <td>
                        <span
                          className="d-inline-block rounded-circle me-2"
                          style={{ width: 16, height: 16, backgroundColor: s.color, verticalAlign: 'middle' }}
                        ></span>
                        {s.color}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </Col>
      <Col md={4}>
        <Card className="shadow-sm border-0">
          <CardHeader className="bg-transparent"><h6 className="mb-0">Nueva Etapa</h6></CardHeader>
          <CardBody>
            <FormGroup>
              <Label className="small">Nombre</Label>
              <Input type="text" bsSize="sm" value={stageForm.name}
                onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} />
            </FormGroup>
            <FormGroup>
              <Label className="small">Orden</Label>
              <Input type="number" bsSize="sm" value={stageForm.stageOrder}
                onChange={(e) => setStageForm({ ...stageForm, stageOrder: e.target.value })} />
            </FormGroup>
            <FormGroup>
              <Label className="small">Color</Label>
              <Input type="color" bsSize="sm" value={stageForm.color}
                onChange={(e) => setStageForm({ ...stageForm, color: e.target.value })} />
            </FormGroup>
            <Button color="primary" size="sm" block onClick={handleCreateStage} disabled={!stageForm.name}>
              Crear Etapa
            </Button>
          </CardBody>
        </Card>
      </Col>
    </Row>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'leads': return renderLeads();
      case 'pipeline': return renderPipeline();
      case 'actividades': return renderActividades();
      case 'etapas': return renderEtapas();
      default: return renderDashboard();
    }
  };

  // =============================================
  // LEAD MODAL
  // =============================================

  const renderLeadModal = () => (
    <Modal isOpen={showLeadModal} toggle={() => setShowLeadModal(false)} size="lg">
      <ModalHeader toggle={() => setShowLeadModal(false)}>
        {editingLeadId ? 'Editar Lead' : 'Nuevo Lead'}
      </ModalHeader>
      <ModalBody>
        <Row>
          <Col md={6}>
            <FormGroup>
              <Label className="small">Nombre *</Label>
              <Input type="text" bsSize="sm" value={leadForm.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label className="small">Empresa</Label>
              <Input type="text" bsSize="sm" value={leadForm.company}
                onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} />
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label className="small">Email</Label>
              <Input type="email" bsSize="sm" value={leadForm.email}
                onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label className="small">Telefono</Label>
              <Input type="text" bsSize="sm" value={leadForm.phone}
                onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label className="small">Origen</Label>
              <Input type="text" bsSize="sm" value={leadForm.source}
                onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} />
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label className="small">Estado</Label>
              <Input type="select" bsSize="sm" value={leadForm.status}
                onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </Input>
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label className="small">Valor Estimado</Label>
              <Input type="number" bsSize="sm" value={leadForm.estimatedValue}
                onChange={(e) => setLeadForm({ ...leadForm, estimatedValue: e.target.value })} />
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label className="small">Fecha Cierre Esperada</Label>
              <Input type="date" bsSize="sm" value={leadForm.expectedCloseDate}
                onChange={(e) => setLeadForm({ ...leadForm, expectedCloseDate: e.target.value })} />
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label className="small">Etapa Pipeline</Label>
              <Input type="select" bsSize="sm" value={leadForm.stageId}
                onChange={(e) => setLeadForm({ ...leadForm, stageId: e.target.value })}>
                <option value="">-- Sin etapa --</option>
                {pipelineStages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Input>
            </FormGroup>
          </Col>
          <Col md={12}>
            <FormGroup>
              <Label className="small">Notas</Label>
              <Input type="textarea" bsSize="sm" rows={3} value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} />
            </FormGroup>
          </Col>
        </Row>
      </ModalBody>
      <ModalFooter>
        <Button color="light" size="sm" onClick={() => setShowLeadModal(false)}>Cancelar</Button>
        <Button color="primary" size="sm" onClick={handleSaveLead} disabled={!leadForm.name}>
          {editingLeadId ? 'Actualizar' : 'Crear'} Lead
        </Button>
      </ModalFooter>
    </Modal>
  );

  // =============================================
  // MAIN RENDER
  // =============================================

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h4 className="mb-0">CRM</h4>
            <Button color="primary" size="sm" onClick={openNewLead}>
              <i className="ri-add-line me-1"></i>Nuevo Lead
            </Button>
          </div>

          <ModuleLayout
            sections={sidebarSections}
            activeItem={activeTab}
            onItemClick={setActiveTab}
          >
            {renderContent()}
          </ModuleLayout>
        </Container>
      </div>

      {renderLeadModal()}
    </React.Fragment>
  );
};

export default CRMPage;
