import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Row, Col, Card, CardBody, Button, Form, FormGroup,
  Input, Label, Progress, Alert, Spinner,
} from 'reactstrap';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { api } from '../../services/api';
import Swal from 'sweetalert2';

interface FormState {
  businessName: string;
  taxId: string;
  taxIdType: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  taxResponsibility: string;
  needsElectronicInvoice: boolean | null;
}

const initialState: FormState = {
  businessName: '',
  taxId: '',
  taxIdType: 'NIT',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  taxResponsibility: 'Responsable de IVA',
  needsElectronicInvoice: null,
};

const NuevaEmpresa: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      if (!form.businessName.trim() || !form.taxId.trim()) {
        setError('Razón social y NIT son obligatorios.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (form.needsElectronicInvoice === null) {
        setError('Selecciona un tipo de facturación.');
        return;
      }
      setStep(3);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      const res: any = await api.post('/tenants/child', payload);
      const data = res?.data ?? res;
      const nextSteps: string[] = data?.nextSteps || [];

      await Swal.fire({
        icon: 'success',
        title: 'Empresa creada',
        html:
          `<p><strong>${form.businessName}</strong> fue registrada correctamente.</p>` +
          (nextSteps.length
            ? `<ul style="text-align:left">${nextSteps.map((s) => `<li>${s}</li>`).join('')}</ul>`
            : ''),
        confirmButtonText: form.needsElectronicInvoice
          ? 'Configurar Facturación Electrónica'
          : 'Ir a Empresas',
      });

      const tenantId = data?.tenant?.id;
      if (form.needsElectronicInvoice && tenantId) {
        navigate(`/settings?tenantId=${tenantId}&section=electronic-invoice`);
      } else {
        navigate('/empresas');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Error creando la empresa');
    } finally {
      setSaving(false);
    }
  };

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Nueva Empresa" pageTitle="Empresas" />

        <Row>
          <Col lg={10} xl={8} className="mx-auto">
            <Card>
              <CardBody>
                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="fw-semibold">Paso {step} de 3</span>
                    <span className="text-muted">
                      {step === 1 && 'Datos fiscales'}
                      {step === 2 && 'Tipo de facturación'}
                      {step === 3 && 'Confirmación'}
                    </span>
                  </div>
                  <Progress value={progress} />
                </div>

                {error && <Alert color="danger">{error}</Alert>}

                {step === 1 && (
                  <Form>
                    <Row>
                      <Col md={8}>
                        <FormGroup>
                          <Label>Razón Social *</Label>
                          <Input
                            value={form.businessName}
                            onChange={(e) => setField('businessName', e.target.value)}
                            placeholder="Nombre legal de la empresa"
                          />
                        </FormGroup>
                      </Col>
                      <Col md={4}>
                        <FormGroup>
                          <Label>Tipo Documento</Label>
                          <Input
                            type="select"
                            value={form.taxIdType}
                            onChange={(e) => setField('taxIdType', e.target.value)}
                          >
                            <option value="NIT">NIT</option>
                            <option value="CC">Cédula de Ciudadanía</option>
                            <option value="CE">Cédula de Extranjería</option>
                          </Input>
                        </FormGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <FormGroup>
                          <Label>NIT / Documento *</Label>
                          <Input
                            value={form.taxId}
                            onChange={(e) => setField('taxId', e.target.value)}
                            placeholder="900123456"
                          />
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup>
                          <Label>Responsabilidad Tributaria</Label>
                          <Input
                            type="select"
                            value={form.taxResponsibility}
                            onChange={(e) => setField('taxResponsibility', e.target.value)}
                          >
                            <option>Responsable de IVA</option>
                            <option>No responsable de IVA</option>
                            <option>Gran Contribuyente</option>
                          </Input>
                        </FormGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <FormGroup>
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={form.email}
                            onChange={(e) => setField('email', e.target.value)}
                          />
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup>
                          <Label>Teléfono</Label>
                          <Input
                            value={form.phone}
                            onChange={(e) => setField('phone', e.target.value)}
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={12}>
                        <FormGroup>
                          <Label>Dirección</Label>
                          <Input
                            value={form.address}
                            onChange={(e) => setField('address', e.target.value)}
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Col md={6}>
                        <FormGroup>
                          <Label>Ciudad</Label>
                          <Input
                            value={form.city}
                            onChange={(e) => setField('city', e.target.value)}
                          />
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup>
                          <Label>Departamento</Label>
                          <Input
                            value={form.state}
                            onChange={(e) => setField('state', e.target.value)}
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                  </Form>
                )}

                {step === 2 && (
                  <Row className="g-3">
                    <Col md={6}>
                      <Card
                        className={`h-100 ${form.needsElectronicInvoice === false ? 'border-primary' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setField('needsElectronicInvoice', false)}
                      >
                        <CardBody className="text-center">
                          <i className="ri-file-list-3-line" style={{ fontSize: 48 }} />
                          <h5 className="mt-2">Facturación Normal</h5>
                          <p className="text-muted mb-0">
                            Emisión de cuentas de cobro / facturas internas, sin integración con la DIAN.
                          </p>
                        </CardBody>
                      </Card>
                    </Col>
                    <Col md={6}>
                      <Card
                        className={`h-100 ${form.needsElectronicInvoice === true ? 'border-primary' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setField('needsElectronicInvoice', true)}
                      >
                        <CardBody className="text-center">
                          <i className="ri-government-line" style={{ fontSize: 48 }} />
                          <h5 className="mt-2">Facturación Electrónica DIAN</h5>
                          <p className="text-muted mb-0">
                            Habilita la emisión electrónica ante la DIAN.
                          </p>
                        </CardBody>
                      </Card>
                    </Col>
                  </Row>
                )}

                {step === 3 && (
                  <div>
                    <h5 className="mb-3">Resumen</h5>
                    <Row>
                      <Col md={6}><strong>Razón Social:</strong> {form.businessName}</Col>
                      <Col md={6}><strong>{form.taxIdType}:</strong> {form.taxId}</Col>
                      <Col md={6}><strong>Responsabilidad:</strong> {form.taxResponsibility}</Col>
                      <Col md={6}><strong>Email:</strong> {form.email || '—'}</Col>
                      <Col md={6}><strong>Teléfono:</strong> {form.phone || '—'}</Col>
                      <Col md={6}><strong>Ciudad:</strong> {form.city || '—'}</Col>
                      <Col md={6}><strong>Departamento:</strong> {form.state || '—'}</Col>
                      <Col md={12} className="mt-2"><strong>Dirección:</strong> {form.address || '—'}</Col>
                      <Col md={12} className="mt-2">
                        <strong>Facturación:</strong>{' '}
                        {form.needsElectronicInvoice
                          ? 'Electrónica DIAN'
                          : 'Normal (sin DIAN)'}
                      </Col>
                    </Row>
                  </div>
                )}

                <div className="d-flex justify-content-between mt-4">
                  <Button color="light" onClick={goBack} disabled={step === 1 || saving}>
                    Atrás
                  </Button>
                  {step < 3 ? (
                    <Button color="primary" onClick={goNext}>
                      Siguiente
                    </Button>
                  ) : (
                    <Button color="success" onClick={submit} disabled={saving}>
                      {saving ? <Spinner size="sm" /> : 'Crear empresa'}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default NuevaEmpresa;
