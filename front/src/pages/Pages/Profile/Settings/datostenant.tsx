// Ubicación: pages/Pages/Profile/Settings/datostenant.tsx

import React, { ChangeEvent, useState, useEffect, useRef, useCallback } from "react";
import { Form, Row, Col, Label, Input, Button, Spinner, InputGroup } from "reactstrap";
import { api } from "../../../../services/api";

/* ===== Tipos locales ===== */
export type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type DayState = { active: boolean; start: string; end: string };
export type WorkingHoursPerDay = Record<DayKey, DayState>;

const DAYS: { key: DayKey; label: string }[] = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

/* ===== Props ===== */
export type DatosTenantProps = {
  section: "datos" | "horario";
  name: string; phone: string; address: string; email: string; website: string; ivaRate: string; adminFee: string;
  setName: (v: string) => void; setPhone: (v: string) => void; setAddress: (v: string) => void; setEmail: (v: string) => void;
  setWebsite: (v: string) => void; setIvaRate: (v: string) => void; setAdminFee: (v: string) => void;

  // Props para Módulos Activos
  productsForStaff: boolean; setProductsForStaff: (v: boolean) => void;
  adminFeeEnabled: boolean; setAdminFeeEnabled: (v: boolean) => void;
  loansToStaff: boolean; setLoansToStaff: (v: boolean) => void;

  // Props para Campos de Contabilidad
  taxIdType: string; setTaxIdType: (v: string) => void;
  taxId: string; setTaxId: (v: string) => void;
  businessName: string; setBusinessName: (v: string) => void;
  taxResponsibility: string; setTaxResponsibility: (v: string) => void;
  city: string; setCity: (v: string) => void;
  state: string; setState: (v: string) => void;
  postalCode: string; setPostalCode: (v: string) => void;
  sector: string; setSector: (v: string) => void;
  currency: string; setCurrency: (v: string) => void;
  decimalPrecision: string; setDecimalPrecision: (v: string) => void;
  decimalSeparator: string; setDecimalSeparator: (v: string) => void;
  
  // Props para datos de Alegra/DIAN
  dianDepartments?: any[];
  dianMunicipalities?: any[];
  dianTaxRegimes?: any[];

  // Props para Horarios
  perDay: WorkingHoursPerDay;
  toggleDay: (day: DayKey) => void;
  changeHour: (day: DayKey, field: "start" | "end", value: string) => void;
  applyMondayToAll: () => void;

  saving?: boolean;
  onSubmit?: (e?: React.FormEvent) => void;
  onCancel?: () => void;
};

const DatosTenant: React.FC<DatosTenantProps> = ({
  section,
  name, phone, address, email, website, ivaRate, adminFee,
  setName, setPhone, setAddress, setEmail, setWebsite, setIvaRate, setAdminFee,
  productsForStaff, setProductsForStaff,
  adminFeeEnabled, setAdminFeeEnabled,
  loansToStaff, setLoansToStaff,
  taxIdType, setTaxIdType, taxId, setTaxId, businessName, setBusinessName,
  taxResponsibility, setTaxResponsibility, city, setCity, state, setState,
  postalCode, setPostalCode, sector, setSector, currency, setCurrency,
  decimalPrecision, setDecimalPrecision, decimalSeparator, setDecimalSeparator,
  perDay, toggleDay, changeHour, applyMondayToAll,
  saving = false,
  onSubmit, onCancel,
  dianDepartments = [],
  dianMunicipalities = [],
  dianTaxRegimes = [],
}) => {
  // Estado para el DV calculado
  const [calculatedDV, setCalculatedDV] = useState<string>("");

  // Estado para consulta DIAN
  const [dianStatus, setDianStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [dianMessage, setDianMessage] = useState<string>('');
  const [missingAutofillFields, setMissingAutofillFields] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs para evitar dependencias inestables en el callback
  const businessNameRef = useRef(businessName);
  const emailRef = useRef(email);
  const nameRef = useRef(name);
  const phoneRef = useRef(phone);
  const addressRef = useRef(address);
  const stateRef = useRef(state);
  const cityRef = useRef(city);
  const taxResponsibilityRef = useRef(taxResponsibility);
  const postalCodeRef = useRef(postalCode);
  const taxIdTypeRef = useRef(taxIdType);
  businessNameRef.current = businessName;
  emailRef.current = email;
  nameRef.current = name;
  phoneRef.current = phone;
  addressRef.current = address;
  stateRef.current = state;
  cityRef.current = city;
  taxResponsibilityRef.current = taxResponsibility;
  postalCodeRef.current = postalCode;
  taxIdTypeRef.current = taxIdType;

  // Consulta DIAN/Alegra debounced — solo para tipo NIT
  useEffect(() => {
    // Solo consultar DIAN si el tipo es NIT
    if (taxIdType !== 'NIT' || !taxId) {
      setDianStatus('idle');
      setDianMessage('');
      setMissingAutofillFields([]);
      return;
    }

    const cleanId = taxId.split('-')[0].replace(/\D/g, '');
    if (cleanId.length < 6) {
      setDianStatus('idle');
      setDianMessage('');
      setMissingAutofillFields([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setDianStatus('loading');
      setDianMessage('');
      setMissingAutofillFields([]);

      try {
        if (cleanId.length < 9) {
          setDianStatus('not_found');
          setDianMessage('El NIT debe tener al menos 9 dígitos');
          return;
        }

        const response = await api.get('/alegra/dian/acquirer-info', {
          params: {
            identificationType: 'NIT',
            identification: cleanId,
          }
        });

        const companyData = response.data?.companyData;
        const receiverName = response.data?.receiverName || '';
        const receiverEmail = response.data?.receiverEmail || '';

        if (companyData) {
          if (companyData.tradeName || companyData.name) setName(companyData.tradeName || companyData.name);
          if (companyData.name || companyData.tradeName) setBusinessName(companyData.name || companyData.tradeName);
          if (companyData.email) setEmail(companyData.email);
          if (companyData.phone) setPhone(companyData.phone);
          if (companyData.address) setAddress(companyData.address);
          if (companyData.department) setState(companyData.department);
          if (companyData.city) setCity(companyData.city);
          if (companyData.regimeCode) setTaxResponsibility(companyData.regimeCode);
          if (companyData.postalCode) setPostalCode(companyData.postalCode);
        } else {
          // Cuando la DIAN confirma el NIT pero no hay empresa creada en Alegra,
          // al menos rellenamos nombre y correo si vienen en la respuesta base.
          if (receiverName) {
            setName(receiverName);
            setBusinessName(receiverName);
          }
          if (receiverEmail) setEmail(receiverEmail);
        }

        const pendingFields: string[] = [];
        if (!companyData?.address) pendingFields.push('Direccion');
        if (!companyData?.department) pendingFields.push('Departamento');
        if (!companyData?.city) pendingFields.push('Municipio');
        setMissingAutofillFields(pendingFields);

        if (response.data?.isRegistered) {
          setDianStatus('found');
          setDianMessage('Empresa encontrada en la DIAN');
        } else {
          setDianStatus('not_found');
          setDianMessage('NIT válido, pero no se encontró información en la DIAN');
        }
      } catch {
        setDianStatus('error');
        setDianMessage('Error al consultar la DIAN');
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxId, taxIdType]);

  // Función para calcular el dígito de verificación del NIT
  const calcularDV = (nit: string): string => {
    if (!nit || nit.trim() === "") return "";
    
    // Limpiar el NIT (solo números)
    const nitLimpio = nit.replace(/\D/g, "");
    if (nitLimpio.length === 0) return "";

    const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    const nitStr = nitLimpio.padStart(15, '0');
    let suma = 0;

    for (let i = 0; i < 15; i++) {
      suma += parseInt(nitStr[14 - i]) * primos[i];
    }

    const residuo = suma % 11;
    const dv = residuo > 1 ? 11 - residuo : residuo;
    return dv.toString();
  };

  // Calcular DV cuando cambia el NIT (solo si es tipo NIT)
  useEffect(() => {
    if (taxIdType === "NIT" && taxId) {
      // Si ya tiene formato con guión, extraer solo el NIT
      const nitSinDV = taxId.split('-')[0].replace(/\D/g, '');
      if (nitSinDV.length > 0) {
        const dv = calcularDV(nitSinDV);
        setCalculatedDV(dv);
      } else {
        setCalculatedDV("");
      }
    } else {
      setCalculatedDV("");
    }
  }, [taxId, taxIdType]);

  // Handler para el cambio del NIT que incluye el DV automáticamente
  const handleTaxIdChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTaxId(value);
    
    // Si es NIT y tiene valor, calcular DV
    if (taxIdType === "NIT" && value) {
      const nitSinDV = value.split('-')[0].replace(/\D/g, '');
      if (nitSinDV.length > 0) {
        const dv = calcularDV(nitSinDV);
        setCalculatedDV(dv);
      }
    }
  };

  const handleInputChange = (setter: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
  };

  /* ------- UI: Datos del Negocio (Reorganizado para Contabilidad) ------- */
  const DatosForm = (
    <Form onSubmit={(e) => { e.preventDefault(); onSubmit?.(e); }}>
      <h5 className="mb-3">Datos de Identificación</h5>
      <Row className="g-3">
        <Col lg={6}>
          <Label htmlFor="tenant-tax-id-type" className="form-label">
            Tipo de Identificación <span className="text-danger">*</span>
            <small className="text-muted ms-2">(Requerido DIAN)</small>
          </Label>
          <Input id="tenant-tax-id-type" type="select" value={taxIdType} onChange={handleInputChange(setTaxIdType)} required>
            <option value="">Seleccione...</option>
            <option value="NIT">NIT - Número de Identificación Tributaria</option>
            <option value="CC">CC - Cédula de Ciudadanía</option>
            <option value="CE">CE - Cédula de Extranjería</option>
            <option value="TI">TI - Tarjeta de Identidad</option>
            <option value="PP">PP - Pasaporte</option>
            <option value="DIE">DIE - Documento de Identificación Extranjero</option>
          </Input>
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-tax-id" className="form-label">
            Número de Identificación <span className="text-danger">*</span>
            <small className="text-muted ms-2">(Requerido DIAN)</small>
          </Label>
          <InputGroup>
            <Input 
              id="tenant-tax-id" 
              value={taxId} 
              onChange={handleTaxIdChange} 
              placeholder="Ej: 900123456" 
              required
              style={taxIdType === "NIT" && calculatedDV ? { borderRight: 'none' } : {}}
            />
            {taxIdType === "NIT" && calculatedDV && (
              <span 
                className="input-group-text"
                style={{ 
                  backgroundColor: '#e7f5ff',
                  borderLeft: 'none',
                  color: '#0066cc',
                  fontWeight: '600',
                  minWidth: '50px',
                  justifyContent: 'center'
                }}
              >
                -{calculatedDV}
              </span>
            )}
          </InputGroup>
          {taxIdType === "NIT" && calculatedDV && (
            <small className="text-muted d-block mt-1">
              <i className="ri-checkbox-circle-line text-success me-1"></i>
              Dígito de verificación calculado automáticamente: <strong>{calculatedDV}</strong>
            </small>
          )}
          {dianStatus !== 'idle' && (
            <small className="d-block mt-1">
              {dianStatus === 'loading' && (
                <span className="text-info">
                  <Spinner size="sm" className="me-1" /> Consultando en la DIAN...
                </span>
              )}
              {dianStatus === 'found' && (
                <span className="text-success">
                  <i className="ri-checkbox-circle-fill me-1"></i>{dianMessage}
                </span>
              )}
              {dianStatus === 'not_found' && (
                <span className="text-warning">
                  <i className="ri-error-warning-fill me-1"></i>{dianMessage}
                </span>
              )}
              {dianStatus === 'error' && (
                <span className="text-danger">
                  <i className="ri-close-circle-fill me-1"></i>{dianMessage}
                </span>
              )}
            </small>
          )}
          {dianStatus === 'found' && missingAutofillFields.length > 0 && (
            <small className="text-warning d-block mt-1">
              <i className="ri-information-line me-1"></i>
              Completa manualmente: {missingAutofillFields.join(', ')}
            </small>
          )}
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-business-name" className="form-label">
            Razón Social <span className="text-danger">*</span>
            <small className="text-muted ms-2">(Requerido DIAN)</small>
          </Label>
          <Input id="tenant-business-name" value={businessName} onChange={handleInputChange(setBusinessName)} placeholder="Ej: Mi Empresa S.A.S." required />
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-name" className="form-label">Nombre Comercial *</Label>
          <Input id="tenant-name" value={name} onChange={handleInputChange(setName)} placeholder="Ej: Mi Empresa" required />
        </Col>
        <Col lg={12}>
          <Label htmlFor="tenant-tax-responsibility" className="form-label">Responsabilidad Tributaria</Label>
          {dianTaxRegimes.length > 0 ? (
            <Input id="tenant-tax-responsibility" type="select" value={taxResponsibility} onChange={handleInputChange(setTaxResponsibility)}>
              <option value="">Seleccione un régimen...</option>
              {dianTaxRegimes.map((regime: any) => (
                <option key={regime.code || regime.id} value={regime.code}>
                  {regime.name || regime.label || regime.code} ({regime.code})
                </option>
              ))}
            </Input>
          ) : (
            <Input id="tenant-tax-responsibility" value={taxResponsibility} onChange={handleInputChange(setTaxResponsibility)} placeholder="Ej: Responsable de IVA, Gran Contribuyente" />
          )}
        </Col>
      </Row>

      <hr className="my-4" />
      <h5 className="mb-3">Datos de Contacto y Ubicación</h5>
      <Row className="g-3">
        <Col lg={6}>
          <Label htmlFor="tenant-address" className="form-label">Dirección *</Label>
          <Input id="tenant-address" value={address} onChange={handleInputChange(setAddress)} placeholder="Ej: Calle 123 #45-67" required />
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-state" className="form-label">
            Departamento <span className="text-danger">*</span>
            <small className="text-muted ms-2">(Código DIAN)</small>
          </Label>
          {dianDepartments.length > 0 ? (
            <Input id="tenant-state" type="select" value={state} onChange={handleInputChange(setState)}>
              <option value="">Seleccione un departamento...</option>
              {dianDepartments.map((dept: any) => (
                <option key={dept.code || dept.id} value={dept.code}>
                  {dept.name || dept.label} ({dept.code})
                </option>
              ))}
            </Input>
          ) : (
            <Input id="tenant-state" value={state} onChange={handleInputChange(setState)} placeholder="Ej: 05 (Antioquia)" />
          )}
          <small className="text-muted">Selecciona primero el departamento</small>
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-city" className="form-label">
            Ciudad/Municipio <span className="text-danger">*</span>
            <small className="text-muted ms-2">(Código DIAN)</small>
          </Label>
          {dianMunicipalities.length > 0 ? (
            <Input id="tenant-city" type="select" value={city} onChange={handleInputChange(setCity)}>
              <option value="">Seleccione un municipio...</option>
              {dianMunicipalities
                .filter((muni: any) => {
                  if (!state) return true;
                  // Filtrar por código de departamento
                  const muniDeptCode = muni.departmentCode || muni.department || (muni.code ? muni.code.substring(0, 2) : '');
                  return muniDeptCode === state || muniDeptCode === state.padStart(2, '0');
                })
                .map((muni: any) => (
                  <option key={muni.code || muni.id} value={muni.code}>
                    {muni.name || muni.label} ({muni.code})
                  </option>
                ))}
            </Input>
          ) : (
            <Input id="tenant-city" value={city} onChange={handleInputChange(setCity)} placeholder="Ej: 05001 (Medellín)" />
          )}
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-postal-code" className="form-label">Código Postal</Label>
          <Input id="tenant-postal-code" value={postalCode} onChange={handleInputChange(setPostalCode)} placeholder="Ej: 050001" />
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-phone" className="form-label">Teléfono *</Label>
          <Input id="tenant-phone" value={phone} onChange={handleInputChange(setPhone)} placeholder="Ej: 3001234567" required />
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-email" className="form-label">Email</Label>
          <Input id="tenant-email" type="email" value={email} onChange={handleInputChange(setEmail)} placeholder="contacto@miempresa.com" />
        </Col>
        <Col lg={12}>
          <Label htmlFor="tenant-website" className="form-label">Página Web</Label>
          <Input id="tenant-website" type="url" value={website} onChange={handleInputChange(setWebsite)} placeholder="https://miempresa.com" />
        </Col>
      </Row>

      <hr className="my-4" />
      <h5 className="mb-3">Datos Adicionales</h5>
      <Row className="g-3">
        <Col lg={6}>
          <Label htmlFor="tenant-sector" className="form-label">Sector Económico</Label>
          <Input id="tenant-sector" value={sector} onChange={handleInputChange(setSector)} placeholder="Ej: Servicios, Comercio, Manufactura" />
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-currency" className="form-label">Moneda</Label>
          <Input id="tenant-currency" type="select" value={currency} onChange={handleInputChange(setCurrency)}>
            <option value="COP">COP - Peso Colombiano</option>
            <option value="USD">USD - Dólar Estadounidense</option>
            <option value="EUR">EUR - Euro</option>
            <option value="MXN">MXN - Peso Mexicano</option>
          </Input>
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-decimal-precision" className="form-label">Precisión Decimal</Label>
          <Input id="tenant-decimal-precision" type="number" min={0} max={4} value={decimalPrecision} onChange={handleInputChange(setDecimalPrecision)} placeholder="2" />
          <small className="text-muted">Número de decimales para valores monetarios</small>
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-decimal-separator" className="form-label">Separador Decimal</Label>
          <Input id="tenant-decimal-separator" type="select" value={decimalSeparator} onChange={handleInputChange(setDecimalSeparator)}>
            <option value=",">Coma (,)</option>
            <option value=".">Punto (.)</option>
          </Input>
        </Col>
        <Col lg={6}>
          <Label htmlFor="tenant-iva" className="form-label">IVA (%)</Label>
          <Input id="tenant-iva" type="number" min={0} max={100} step="0.01" value={ivaRate} onChange={handleInputChange(setIvaRate)} placeholder="19" />
        </Col>
      </Row>

      <Row>
        <Col lg={12} className="pt-4">
          <div className="hstack gap-2 justify-content-end">
            <Button type="button" color="soft-success" onClick={() => onCancel?.()}>Cancelar</Button>
            <Button 
              type="submit" 
              color="primary" 
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                // Asegurar que el NIT tenga el DV antes de guardar
                if (taxIdType === "NIT" && taxId && calculatedDV) {
                  const nitSinDV = taxId.split('-')[0].replace(/\D/g, '');
                  if (nitSinDV && !taxId.includes('-')) {
                    setTaxId(`${nitSinDV}-${calculatedDV}`);
                    // Esperar un momento para que se actualice el estado antes de enviar
                    setTimeout(() => {
                      onSubmit?.(e);
                    }, 100);
                    return;
                  }
                }
                onSubmit?.(e);
              }}
            >
              {saving && <Spinner size="sm" className="me-2" />} Guardar cambios
            </Button>
          </div>
        </Col>
      </Row>
    </Form>
  );

  /* ------- UI: Horario (Completo) ------- */
  const HorarioForm = (
    <Form onSubmit={(e) => { e.preventDefault(); onSubmit?.(e); }}>
      <Row>
        {DAYS.map(({ key, label }) => {
          const day = perDay[key];
          const isMonday = key === "monday";
          return (
            <Col lg={12} key={key}>
              <div className="border rounded p-3 mb-3">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                  <div className="form-check form-switch"><Input className="form-check-input" type="checkbox" id={`active-${key}`} checked={day.active} onChange={() => toggleDay(key)} /><Label className="form-check-label fw-semibold ms-2" htmlFor={`active-${key}`}>{label} {day.active ? "(Abierto)" : "(Cerrado)"}</Label></div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="d-flex align-items-center gap-2"><Label className="mb-0" htmlFor={`start-${key}`}>Inicio</Label><Input id={`start-${key}`} type="time" value={day.start} disabled={!day.active} onChange={(e) => changeHour(key, "start", e.target.value)} /></div>
                    <div className="d-flex align-items-center gap-2"><Label className="mb-0" htmlFor={`end-${key}`}>Fin</Label><Input id={`end-${key}`} type="time" value={day.end} disabled={!day.active} onChange={(e) => changeHour(key, "end", e.target.value)} /></div>
                    {isMonday && (<Button type="button" size="sm" color="secondary" className="ms-2" onClick={applyMondayToAll}>Aplicar a todos</Button>)}
                  </div>
                </div>
              </div>
            </Col>
          );
        })}
        <Col lg={12}><div className="hstack gap-2 justify-content-end"><Button type="button" color="soft-success" onClick={() => onCancel?.()}>Cancelar</Button><Button type="submit" color="primary" disabled={saving}>{saving && <Spinner size="sm" className="me-2" />} Guardar horarios</Button></div></Col>
      </Row>
    </Form>
  );

  if (section === "datos") return DatosForm;
  if (section === "horario") return HorarioForm;
  return null;
};

export default DatosTenant;
