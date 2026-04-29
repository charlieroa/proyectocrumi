// --- Importaciones ---
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import React, { useEffect, useMemo, useRef, useState, ChangeEvent } from 'react';
import {
  Card, CardBody, CardHeader, Col, Container, Input, Label,
  Nav, NavItem, NavLink, Row, TabContent, TabPane, Alert, Button, Spinner,
  Modal, ModalHeader, ModalBody, ModalFooter, Table, Badge,
  Pagination, PaginationItem, PaginationLink, InputGroup
} from 'reactstrap';
import classnames from "classnames";
import { jwtDecode } from "jwt-decode";
import CreatableSelect from 'react-select/creatable';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ListaTerceros from '../../../TercerosHub/sections/ListaTerceros';

// --- NUEVO: Imports de Redux ---
import { useDispatch } from 'react-redux';
import { setSetupProgress } from '../../../../slices/Settings/settingsSlice';

import progileBg from '../../../../assets/images/profile-bg.jpg';
import logoWhite from '../../../../assets/images/logo/logowhite.png';
import { api } from "../../../../services/api";
import { getToken, isContadorFullMode, getRoleFromToken, isRealContador } from "../../../../services/auth";

// Vistas hijas y componentes comunes
// import Personal from "./personal"; // ✅ COMENTADO: Tab de Empleados removido
import MiPerfil from "./MiPerfil";
import DatosTenant, { DayKey, DayState, WorkingHoursPerDay } from "./datostenant";
import FacturacionElectronicaSection from './FacturacionElectronicaSection';
import AccountingMasterSection from './AccountingMasterSection';
import CategoryManagerModal from '../../../../Components/Common/CategoryManagerModal';
import BulkUploadModal from '../../../../Components/Common/BulkUploadModal';
// import ClientesList from "./ClientesList"; // ✅ COMENTADO: Movido a página independiente

// --- Tipos y Helpers ---
type Tenant = {
  id: string;
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  iva_rate?: number | null;
  admin_fee_percent?: number | null;
  logo_url?: string | null;
  products_for_staff_enabled?: boolean;
  admin_fee_enabled?: boolean;
  loans_to_staff_enabled?: boolean;
  working_hours?: Record<string, string | null> | null;
  // Nuevos campos de contabilidad
  tax_id_type?: string | null;
  tax_id?: string | null;
  business_name?: string | null;
  tax_responsibility?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  sector?: string | null;
  currency?: string | null;
  decimal_precision?: number | null;
  decimal_separator?: string | null;
  active_modules?: string[] | null;
  created_at?: string;
  updated_at?: string;
};
type Category = { id: string; name: string; created_at?: string; updated_at?: string; };
type Service = {
  id: string;
  tenant_id?: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  duration_minutes: number;
  is_active?: boolean;
};

// --- AJUSTE: Se añaden helpers para formateo de moneda ---
const formatterCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');
const formatCOPString = (digits: string) => {
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return '';
  // Quitamos el espacio que a veces añade Intl.NumberFormat (ej: "$ 50.000")
  return formatterCOP.format(n).replace(/\s/g, '');
};

const DAYS: { key: DayKey; label: string }[] = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];
const DEFAULT_DAY: DayState = { active: false, start: "09:00", end: "17:00" };
const defaultWeek = (): WorkingHoursPerDay => ({
  monday: { ...DEFAULT_DAY },
  tuesday: { ...DEFAULT_DAY },
  wednesday: { ...DEFAULT_DAY },
  thursday: { ...DEFAULT_DAY },
  friday: { ...DEFAULT_DAY },
  saturday: { ...DEFAULT_DAY },
  sunday: { ...DEFAULT_DAY },
});
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toTime = (raw: string): string => {
  const s = (raw || "").trim();
  if (!s) return "09:00";
  const [hStr, mStr] = s.split(":");
  const h = Math.max(0, Math.min(23, Number(hStr || "0")));
  const m = Math.max(0, Math.min(59, Number(mStr ?? "0")));
  return `${pad2(h)}:${pad2(m)}`;
};
const parseRange = (range?: string | null): DayState => {
  if (!range || range.toLowerCase() === "cerrado") return { ...DEFAULT_DAY, active: false };
  const [start, end] = range.split("-").map(s => (s || "").trim());
  if (!start || !end) return { ...DEFAULT_DAY, active: false };
  return { active: true, start: toTime(start), end: toTime(end) };
};
const formatRange = (d: DayState): string => {
  if (!d.active) return "cerrado";
  if (!d.start || !d.end) return "cerrado";
  return `${toTime(d.start)}-${toTime(d.end)}`;
};
// Helper para obtener tenantId (Token o SessionStorage)
const decodeTenantId = (): string | null => {
  try {
    const t = getToken();
    if (t) {
      const decoded: any = jwtDecode(t);
      const tid = decoded?.user?.tenant_id || decoded?.tenant_id;
      if (tid) return tid;
    }
    // Fallback importado dinámicamente para evitar ciclos o redefiniciones si no se importa arriba
    const authUser = sessionStorage.getItem("authUser");
    if (authUser) {
      const parsed = JSON.parse(authUser);
      return parsed?.tenant_id || parsed?.user?.tenant_id || null;
    }
    return null;
  } catch { return null; }
};
const ensureNumber = (v: string) => (v.trim() === "" ? null : Number(v));

/* =============== Modal Servicio =============== */
const ServiceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
  onCategoryCreated: (c: Category) => void;
  tenantId: string;
  edit?: Service | null;
  onManageCategories: () => void;
}> = ({ isOpen, onClose, onSaved, categories, onCategoryCreated, tenantId, edit, onManageCategories }) => {
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const categoryOptions = useMemo(() =>
    categories.map(cat => ({ value: cat.id, label: cat.name })),
    [categories]);

  useEffect(() => {
    if (isOpen) {
      if (edit) {
        setCategoryId(edit.category_id);
        setName(edit.name);
        setPrice(String(edit.price));
        setDuration(String(edit.duration_minutes));
        setDescription(edit.description || "");
      } else {
        setCategoryId(categories[0]?.id || "");
        setName(""); setPrice(""); setDuration(""); setDescription("");
      }
    }
  }, [isOpen, edit, categories]);

  const handleCreateCategory = async (inputValue: string) => {
    if (!inputValue.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post('/categories', { name: inputValue.trim() });
      onCategoryCreated(data);
      setCategoryId(data.id);
      Swal.fire({ icon: 'success', title: '¡Categoría creada!', timer: 1500, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire('Error', e?.response?.data?.error || 'No se pudo crear la categoría', 'error');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!categoryId || !name.trim() || !price || !duration) {
      Swal.fire('Campos incompletos', 'Por favor completa categoría, nombre, precio y duración.', 'warning');
      return;
    }
    const body: any = {
      category_id: categoryId, name: name.trim(), price: Number(price),
      duration_minutes: Number(duration), description: description.trim() || null,
    };
    setSaving(true);
    try {
      if (edit) {
        await api.put(`/services/${edit.id}`, body);
      } else {
        body.tenant_id = tenantId;
        await api.post(`/services`, body);
      }
      Swal.fire({ icon: 'success', title: edit ? '¡Servicio actualizado!' : '¡Servicio Creado!', showConfirmButton: false, timer: 1500 });
      onSaved();
      onClose();
    } catch (e: any) {
      Swal.fire('Error al guardar', e?.response?.data?.message || 'No se pudo guardar el servicio', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} toggle={onClose} size="lg" centered>
      <ModalHeader toggle={onClose}>{edit ? "Editar servicio" : "Nuevo servicio"}</ModalHeader>
      <ModalBody>
        <Row className="g-3">
          <Col md={12}>
            <Label className="form-label">Categoría</Label>
            <InputGroup>
              <CreatableSelect
                className="flex-grow-1"
                isClearable isSearchable
                options={categoryOptions}
                value={categoryOptions.find(opt => opt.value === categoryId)}
                onChange={(selected) => setCategoryId(selected ? selected.value : "")}
                onCreateOption={handleCreateCategory}
                placeholder="Busca o crea una categoría..."
                formatCreateLabel={inputValue => `Crear nueva categoría: "${inputValue}"`}
                isLoading={saving}
                isDisabled={saving}
              />
              <Button color="secondary" outline type="button" onClick={onManageCategories} title="Gestionar categorías">
                <i className="ri-settings-3-line"></i>
              </Button>
            </InputGroup>
          </Col>
          <Col md={6}><Label className="form-label">Nombre del servicio</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Corte para Dama" /></Col>
          <Col md={6}><Label className="form-label">Duración (minutos)</Label><Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ej: 60" /></Col>

          <Col md={12}>
            <Label className="form-label">Precio</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={formatCOPString(price)}
              onChange={(e) => setPrice(onlyDigits(e.target.value))}
              placeholder="$50.000"
            />
          </Col>

        </Row>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>Cancelar</Button>
        <Button color="primary" onClick={save} disabled={saving}>{saving && <Spinner size="sm" className="me-2" />} Guardar</Button>
      </ModalFooter>
    </Modal>
  );
};

/* ================= Página Settings ================= */
type SettingsProps = { singleTab?: string };

const Settings: React.FC<SettingsProps> = ({ singleTab }) => {
  const dispatch = useDispatch();
  // Acepta deep-link ?tab=N desde Contabilidad (Empresa=1, FE=8, Contab. maestra=9, Terceros=10).
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') as any;
  const VALID_TABS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  // Si `singleTab` viene seteado (render como página independiente dentro de Contabilidad),
  // forzamos ese tab e ignoramos state y searchParams.
  // Default: Perfil (tab 11). Si viene ?tab=N se respeta (deep-link desde Contabilidad).
  const [activeTab, setActiveTab] = useState<string>(
    singleTab ?? (VALID_TABS.has(initialTab) ? initialTab : '11')
  );
  // Tab efectivo a mostrar. En modo singleTab nunca cambia.
  const effectiveActiveTab = singleTab ?? activeTab;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [website, setWebsite] = useState<string>("");
  const [ivaRate, setIvaRate] = useState<string>("");
  const [adminFee, setAdminFee] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);

  // Nuevos estados para campos de contabilidad
  const [taxIdType, setTaxIdType] = useState<string>("");
  const [taxId, setTaxId] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [taxResponsibility, setTaxResponsibility] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [postalCode, setPostalCode] = useState<string>("");
  const [sector, setSector] = useState<string>("");
  const [currency, setCurrency] = useState<string>("COP");
  const [decimalPrecision, setDecimalPrecision] = useState<string>("2");
  const [decimalSeparator, setDecimalSeparator] = useState<string>(",");
  const [activeModules, setActiveModules] = useState<string[]>(['comercial']);

  // Comentadas las secciones de horarios, servicios y categorías
  // const [perDay, setPerDay] = useState<WorkingHoursPerDay>(defaultWeek());
  const [productsForStaff, setProductsForStaff] = useState<boolean>(true);
  const [adminFeeEnabled, setAdminFeeEnabled] = useState<boolean>(false);
  const [loansToStaff, setLoansToStaff] = useState<boolean>(false);
  const [catLoading, setCatLoading] = useState(false);
  const [svcLoading, setSvcLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [svModalOpen, setSvModalOpen] = useState(false);
  const [svEdit, setSvEdit] = useState<any | null>(null);
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const SVC_PAGE_SIZE = 6;
  const [svcPage, setSvcPage] = useState<number>(1);
  const totalSvcPages = useMemo(() => Math.max(1, Math.ceil(services.length / SVC_PAGE_SIZE)), [services.length]);
  const paginatedServices = useMemo(() => {
    const start = (svcPage - 1) * SVC_PAGE_SIZE;
    return services.slice(start, start + SVC_PAGE_SIZE);
  }, [services, svcPage]);

  useEffect(() => {
    if (services.length > 0 && svcPage > totalSvcPages) {
      setSvcPage(totalSvcPages);
    }
  }, [services.length, totalSvcPages, svcPage]);

  const [staffCount, setStaffCount] = useState<number>(0);
  const [staffLoading, setStaffLoading] = useState<boolean>(false);

  const tabChange = (tab: string) => {
    if (activeTab !== tab) {
      setActiveTab(tab);
      if (tab === "5" && isSuperAdmin) loadSuperAdminUsers();
      if (tab === "6" && (isSuperAdmin || isContadorFullMode())) loadAllUsers();
      if (tab === "7" && isContadorFullMode()) loadMyTenants();
    }
  };

  const updateStateFromTenant = (tenantData: Tenant | null) => {
    if (!tenantData) return;
    setTenant(tenantData);
    setName(tenantData.name ?? "");
    setPhone(tenantData.phone ?? "");
    setAddress(tenantData.address ?? "");
    setEmail(tenantData.email ?? "");
    setWebsite(tenantData.website ?? "");
    setIvaRate(tenantData.iva_rate == null ? "" : String(tenantData.iva_rate));
    setAdminFee(tenantData.admin_fee_percent == null ? "" : String(tenantData.admin_fee_percent));
    // setPerDay(normalizeWorkingHoursFromAPI(tenantData.working_hours));
    setProductsForStaff(tenantData.products_for_staff_enabled ?? true);
    setAdminFeeEnabled(tenantData.admin_fee_enabled ?? false);
    setLoansToStaff(tenantData.loans_to_staff_enabled ?? false);

    // Nuevos campos de contabilidad
    setTaxIdType(tenantData.tax_id_type ?? "");
    setTaxId(tenantData.tax_id ?? "");
    setBusinessName(tenantData.business_name ?? "");
    setTaxResponsibility(tenantData.tax_responsibility ?? "");
    setCity(tenantData.city ?? "");
    setState(tenantData.state ?? "");
    setPostalCode(tenantData.postal_code ?? "");
    setSector(tenantData.sector ?? "");
    setCurrency(tenantData.currency ?? "COP");
    setDecimalPrecision(tenantData.decimal_precision == null ? "2" : String(tenantData.decimal_precision));
    setDecimalSeparator(tenantData.decimal_separator ?? ",");
    setActiveModules(tenantData.active_modules ?? ['comercial']);
    localStorage.setItem('crumi-active-modules', JSON.stringify(tenantData.active_modules ?? ['comercial']));

    const baseUrl = api.defaults.baseURL || '';
    let finalDisplayUrl = "";
    if (tenantData.logo_url) {
      finalDisplayUrl = tenantData.logo_url.startsWith('http') ? tenantData.logo_url : `${baseUrl}${tenantData.logo_url}`;
    } else {
      // Si no hay logo, usar el logo por defecto
      finalDisplayUrl = logoWhite;
    }
    setLogoUrl(finalDisplayUrl);
  };

  // Estados para datos de Alegra/DIAN
  const [loadingAlegra, setLoadingAlegra] = useState<boolean>(false);
  const [dianDepartments, setDianDepartments] = useState<any[]>([]);
  const [dianMunicipalities, setDianMunicipalities] = useState<any[]>([]);
  const [dianTaxRegimes, setDianTaxRegimes] = useState<any[]>([]);

  // Función para cargar tablas DIAN
  const loadAlegraData = async () => {
    try {
      setLoadingAlegra(true);

      // Cargar tablas DIAN para los dropdowns
      try {
        const [departmentsResponse, municipalitiesResponse, regimeResponse] = await Promise.all([
          api.get('/alegra/dian/departments').catch(() => ({ data: { success: false } })),
          api.get('/alegra/dian/municipalities').catch(() => ({ data: { success: false } })),
          api.get('/alegra/dian/tax-regimes').catch(() => ({ data: { success: false } }))
        ]);

        if (departmentsResponse.data?.success && Array.isArray(departmentsResponse.data.data)) {
          setDianDepartments(departmentsResponse.data.data);
        }
        if (municipalitiesResponse.data?.success && Array.isArray(municipalitiesResponse.data.data)) {
          setDianMunicipalities(municipalitiesResponse.data.data);
        }
        if (regimeResponse.data?.success && Array.isArray(regimeResponse.data.data)) {
          setDianTaxRegimes(regimeResponse.data.data);
        }
      } catch (e) {
        console.log('No se pudieron cargar tablas DIAN:', e);
      }
    } catch (e: any) {
      if (e?.response?.status !== 404) console.log('Error cargando datos de Alegra:', e);
    } finally {
      setLoadingAlegra(false);
    }
  };

  const reloadTenantAndAlegraData = async (tenantId: string) => {
    const { data } = await api.get(`/tenants/${tenantId}`);
    updateStateFromTenant(data);
    await loadAlegraData();

    if (data?.tax_id_type && data?.tax_id) {
      try {
        const lookup = await api.get('/alegra/dian/acquirer-info', {
          params: {
            identificationType: data.tax_id_type,
            identification: data.tax_id,
          }
        });

        const companyData = lookup.data?.companyData;
        const receiverName = lookup.data?.receiverName || '';
        const receiverEmail = lookup.data?.receiverEmail || '';

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
          if (receiverName) {
            setName(receiverName);
            setBusinessName(receiverName);
          }
          if (receiverEmail) setEmail(receiverEmail);
        }
      } catch {
        // No bloquea la recarga principal
      }
    }
  };

  useEffect(() => {
    // Título se actualiza dinámicamente más abajo cuando se detecta el rol
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const tenantId = decodeTenantId();
        if (!tenantId) {
          setError("No se encontró el tenant en tu sesión. Inicia sesión nuevamente.");
          return;
        }
        await reloadTenantAndAlegraData(tenantId);
        setLogoFile(null);

        // Cargar datos de Alegra después de cargar el tenant
        await loadAlegraData();
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || "No se pudo cargar la información.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveAll = async () => {
    setSaving(true); setError(null);
    try {
      const tenantId = tenant?.id || decodeTenantId();
      if (!tenantId) throw new Error("No se encontró el tenant para actualizar.");

      // Comentado: validación de horarios ya que se removió el tab
      // const hoursErr = validateWorkingHours(perDay);
      // if (hoursErr) { 
      //     Swal.fire({ icon: 'error', title: 'Horario Inválido', text: hoursErr });
      //     setSaving(false); 
      //     return;
      // }

      let logoUrlForPayload = tenant?.logo_url || null;

      if (logoUrlForPayload && logoUrlForPayload.startsWith('http')) {
        const baseUrl = api.defaults.baseURL;
        if (baseUrl && logoUrlForPayload.startsWith(baseUrl)) {
          logoUrlForPayload = logoUrlForPayload.replace(baseUrl, '');
        }
      }

      if (logoFile) {
        try {
          setUploadingLogo(true);
          const form = new FormData();
          form.append('logo', logoFile);
          const { data } = await api.post(`/tenants/${tenantId}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (data?.url) {
            logoUrlForPayload = data.url;
            // Actualizar el logoUrl para mostrar el logo guardado
            const baseUrl = api.defaults.baseURL || '';
            const fullLogoUrl = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
            setLogoUrl(fullLogoUrl);
            setLogoFile(null);
          } else {
            throw new Error("La URL del logo no se recibió correctamente.");
          }
        } catch (uploadError: any) {
          Swal.fire({ icon: 'error', title: 'Error de Carga', text: uploadError?.response?.data?.message || uploadError?.message || "No se pudo subir el logo." });
          setUploadingLogo(false); setSaving(false); return;
        } finally {
          setUploadingLogo(false);
        }
      }

      const payload = {
        name: name.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        // working_hours: buildWorkingHoursPayload(perDay),  // Comentado porque se removió horarios
        iva_rate: ensureNumber(ivaRate),
        admin_fee_percent: adminFeeEnabled ? ensureNumber(adminFee) : null,
        logo_url: logoUrlForPayload,
        products_for_staff_enabled: productsForStaff,
        admin_fee_enabled: adminFeeEnabled,
        loans_to_staff_enabled: loansToStaff,
        // Nuevos campos de contabilidad
        tax_id_type: taxIdType.trim() || null,
        tax_id: taxId.trim() || null,
        business_name: businessName.trim() || null,
        tax_responsibility: taxResponsibility.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        postal_code: postalCode.trim() || null,
        sector: sector.trim() || null,
        currency: currency || "COP",
        decimal_precision: parseInt(decimalPrecision) || 2,
        decimal_separator: decimalSeparator || ",",
      };

      await api.put(`/tenants/${tenantId}`, payload);
      const { data: freshTenantData } = await api.get(`/tenants/${tenantId}`);
      updateStateFromTenant(freshTenantData);

      Swal.fire({ icon: 'success', title: '¡Guardado!', text: 'Los cambios se guardaron correctamente.', timer: 2000, showConfirmButton: false });
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "No se pudieron guardar los cambios.";
      Swal.fire({ icon: 'error', title: 'Error al Guardar', text: typeof msg === 'string' ? msg : "No se pudieron guardar los cambios." });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInfo = async (e?: React.FormEvent) => { e?.preventDefault(); await saveAll(); };
  const handleSaveHours = async (e?: React.FormEvent) => { e?.preventDefault(); await saveAll(); };

  const openLogoPicker = () => { logoInputRef.current?.click(); };
  const onLogoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setLogoFile(f);
      setLogoUrl(URL.createObjectURL(f));
    }
  };

  // Funciones de horarios comentadas ya que se removió el tab
  // const toggleDay = (day: DayKey) => setPerDay(prev => ({ ...prev, [day]: { ...prev[day], active: !prev[day].active } }));
  // const changeHour = (day: DayKey, field: "start" | "end", value: string) =>
  //   setPerDay(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  // const applyMondayToAll = () => {
  //   const monday = perDay.monday;
  //   setPerDay(prev => {
  //     const next = { ...prev } as WorkingHoursPerDay;
  //     for (const { key } of DAYS) {
  //       if (key === "monday") continue;
  //       next[key] = { ...next[key], active: monday.active, start: monday.start, end: monday.end };
  //     }
  //     return next;
  //   });
  // };

  const tenantId = useMemo(() => decodeTenantId() || "", []);


  const loadCategories = async () => {
    if (!tenantId) return;
    setCatLoading(true);
    try {
      const { data } = await api.get('/categories');
      setCategories(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'No se pudieron cargar las categorías');
    } finally {
      setCatLoading(false);
    }
  };
  const loadServices = async () => {
    if (!tenantId) return;
    setSvcLoading(true);
    try {
      const { data } = await api.get(`/services/tenant/${tenantId}`);
      setServices(Array.isArray(data) ? data : []);
    }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'No se pudieron cargar los servicios'); }
    finally { setSvcLoading(false); }
  };

  const loadStaffCount = async () => {
    if (!tenantId) return;
    setStaffLoading(true);
    try {
      const { data } = await api.get(`/users/tenant/${tenantId}?role_id=3`);
      setStaffCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setStaffCount(0);
    }
    finally { setStaffLoading(false); }
  };

  useEffect(() => {
    if (tenantId) {
      loadCategories();
      loadServices();
      loadStaffCount();
    }
  }, [tenantId]);

  const refreshAllServices = async () => {
    await loadServices();
  };

  const handleCategoryCreated = (newCategory: any) => {
    setCategories((prev) => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleCategoryDeleted = (deletedId: string) => {
    setCategories(prev => prev.filter(c => c.id !== deletedId));
    loadServices();
  };

  const openNewService = () => { setSvEdit(null); setSvModalOpen(true); };
  const openEditService = (svc: any) => { setSvEdit(svc); setSvModalOpen(true); };

  const deleteService = async (svc: any) => {
    const result = await Swal.fire({
      title: `¿Eliminar "${svc.name}"?`, text: "Esta acción no se puede deshacer.", icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, ¡eliminar!', cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await api.delete(`/services/${svc.id}`);
        await loadServices();
        Swal.fire('¡Eliminado!', 'El servicio ha sido eliminado.', 'success');
      }
      catch (e: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: e?.response?.data?.message || e?.message || 'No se pudo eliminar el servicio' });
      }
    }
  };

  // Cálculo de progreso - solo datos de la empresa (100% cuando esté completo)
  const progress = useMemo(() => {
    // Campos básicos obligatorios
    const datosBasicosOk = !!(name.trim() && address.trim() && phone.trim());
    // Campos fiscales principales (opcionales pero importantes)
    const datosFiscalesOk = !!(taxId.trim() && businessName.trim());
    // Si tiene datos básicos Y fiscales, está completo al 100%
    // Si solo tiene datos básicos, está al 50%
    if (datosBasicosOk && datosFiscalesOk) {
      return 100;
    } else if (datosBasicosOk) {
      return 50;
    }
    return 0;
  }, [name, address, phone, taxId, businessName]);

  // --- SUPER ADMIN LOGIC ---
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [isContador, setIsContador] = useState(false);
  const [myTenants, setMyTenants] = useState<any[]>([]);
  const [loadingMyTenants, setLoadingMyTenants] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantEmail, setNewTenantEmail] = useState("");
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  // Mi información (empleados: rol 2 o 3)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [employeeFirstName, setEmployeeFirstName] = useState("");
  const [employeeLastName, setEmployeeLastName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [employeeNewPassword, setEmployeeNewPassword] = useState("");
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploadingBulk, setUploadingBulk] = useState(false);

  // Estados para listado de usuarios
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [superAdminUsers, setSuperAdminUsers] = useState<any[]>([]);
  const [loadingSuperAdminUsers, setLoadingSuperAdminUsers] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Estados para crear/editar usuario
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserRole, setNewUserRole] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // Estados para listado de empresas (tenants)
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [tenantPage, setTenantPage] = useState(1);
  const TENANTS_PER_PAGE = 10;

  // Estados para editar tenant
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editTenantName, setEditTenantName] = useState("");
  const [editTenantEmail, setEditTenantEmail] = useState("");
  const [editTenantPhone, setEditTenantPhone] = useState("");
  const [editTenantAddress, setEditTenantAddress] = useState("");
  const [savingTenantEdit, setSavingTenantEdit] = useState(false);

  const openEditTenantModal = (tenantData: any) => {
    setEditingTenantId(tenantData.id);
    setEditTenantName(tenantData.name || "");
    setEditTenantEmail(tenantData.email || "");
    setEditTenantPhone(tenantData.phone || "");
    setEditTenantAddress(tenantData.address || "");
    setTenantModalOpen(true);
  };

  const closeTenantModal = () => {
    setTenantModalOpen(false);
    setEditingTenantId(null);
  };

  // Cargar perfil del usuario actual (empleados rol 2 o 3)
  const loadCurrentUserProfile = async (userId: string) => {
    setCurrentUserId(userId);
    try {
      const { data } = await api.get(`/users/${userId}`);
      setEmployeeFirstName(data.first_name || "");
      setEmployeeLastName(data.last_name || "");
      setEmployeeEmail(data.email || "");
      setEmployeePhone(data.phone || "");
    } catch (e) {
      console.error("Error cargando perfil:", e);
      toast.error("No se pudo cargar tu información");
    }
  };

  const handleSaveEmployeeProfile = async () => {
    if (!currentUserId) return;
    if (!employeeFirstName?.trim() || !employeeEmail?.trim()) {
      toast.error("Nombre y correo son obligatorios.");
      return;
    }
    setEmployeeSaving(true);
    try {
      const body: any = {
        first_name: employeeFirstName.trim(),
        last_name: employeeLastName.trim(),
        email: employeeEmail.trim(),
        phone: employeePhone.trim() || null,
      };
      if (employeeNewPassword.trim().length >= 6) {
        body.password = employeeNewPassword.trim();
      }
      await api.put(`/users/${currentUserId}`, body);
      toast.success("Tu información se guardó correctamente");
      setEmployeeNewPassword("");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Error al guardar");
    } finally {
      setEmployeeSaving(false);
    }
  };

  const handleSaveTenantEdit = async () => {
    if (!editingTenantId) return;
    setSavingTenantEdit(true);
    try {
      await api.put(`/tenants/${editingTenantId}`, {
        name: editTenantName,
        email: editTenantEmail,
        phone: editTenantPhone,
        address: editTenantAddress
      });
      // Swal.fire('Éxito', 'Empresa actualizada correctamente', 'success');
      loadAllTenants();
      closeTenantModal();
      toast.success("Empresa actualizada correctamente");
    } catch (e: any) {
      console.error(e);
      // Swal.fire('Error', 'No se pudo actualizar la empresa', 'error');
      toast.error("Error al actualizar empresa");
    } finally {
      setSavingTenantEdit(false);
    }
  };

  // Cargar Empleados y Coordinadores (pestaña Personal)
  const loadAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await api.get('/tasks/users');
      const filtered = Array.isArray(data) ? data.filter((u: any) => u.role_id === 3 || u.role_id === 5) : [];
      setAllUsers(filtered);
    } catch (e: any) {
      console.error('Error cargando usuarios:', e);
      toast.error('No se pudo cargar el listado de personal. Comprueba la conexión.');
      setAllUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Cargar usuarios Super Admin (role 99) para la pestaña Super Admin
  const loadSuperAdminUsers = async () => {
    setLoadingSuperAdminUsers(true);
    try {
      const { data } = await api.get('/tasks/users?role=99');
      setSuperAdminUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Error cargando usuarios Super Admin:', e);
      toast.error('No se pudo cargar el listado de Super Admin.');
      setSuperAdminUsers([]);
    } finally {
      setLoadingSuperAdminUsers(false);
    }
  };

  // Abrir modal para nuevo usuario (presetRole: "99" cuando se abre desde pestaña Super Admin)
  const openNewUserModal = (presetRole?: string) => {
    setEditingUser(null);
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserFirstName("");
    setNewUserRole(presetRole || "");
    if (allTenants.length === 0 && !isContador) loadAllTenants();
    setUserModalOpen(true);
  };

  // Abrir modal para editar usuario
  const openEditUserModal = (user: any) => {
    setEditingUser(user);
    setNewUserEmail(user.email || "");
    setNewUserPassword("");
    setNewUserFirstName(user.first_name || "");
    setNewUserRole(String(user.role_id || ""));
    setUserModalOpen(true);
  };

  // Paginación de usuarios (Personal)
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;

  const totalUserPages = Math.ceil(allUsers.length / USERS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * USERS_PER_PAGE;
    return allUsers.slice(start, start + USERS_PER_PAGE);
  }, [allUsers, userPage]);

  // Paginación de usuarios Super Admin
  const [superAdminPage, setSuperAdminPage] = useState(1);
  const SUPER_ADMIN_PER_PAGE = 10;
  const totalSuperAdminPages = Math.ceil(superAdminUsers.length / SUPER_ADMIN_PER_PAGE);
  const paginatedSuperAdminUsers = useMemo(() => {
    const start = (superAdminPage - 1) * SUPER_ADMIN_PER_PAGE;
    return superAdminUsers.slice(start, start + SUPER_ADMIN_PER_PAGE);
  }, [superAdminUsers, superAdminPage]);

  // Cerrar modal
  const closeUserModal = () => {
    setUserModalOpen(false);
    setEditingUser(null);
  };

  // Eliminar usuario
  const handleDeleteUser = async (userId: string, userName: string) => {
    const result = await Swal.fire({
      title: `¿Eliminar a "${userName}"?`,
      text: "Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await api.delete(`/users/${userId}`);
        Swal.fire('¡Eliminado!', 'El usuario ha sido eliminado.', 'success');
        loadAllUsers();
        loadSuperAdminUsers();
      } catch (e: any) {
        Swal.fire('Error', e?.response?.data?.error || 'No se pudo eliminar el usuario', 'error');
      }
    }
  };

  // Obtener nombre del rol
  const getRoleName = (roleId: number) => {
    switch (roleId) {
      case 99: return 'Super Admin';
      case 1: return 'Administrador';
      case 2: return 'Cajero';
      case 3: return 'Empleado';
      case 4: return 'Espacio Contador';
      case 5: return 'Coordinador';
      default: return `Rol ${roleId}`;
    }
  };

  useEffect(() => {
    try {
      const t = getToken();
      if (t) {
        const dec: any = jwtDecode(t);
        const role = Number(dec?.user?.role_id);
        const inContadorMode = isContadorFullMode();
        if (role === 99) {
          setIsSuperAdmin(true);
          setActiveTab("6");
          document.title = "Bolti Super Admin";
          loadAllUsers();
          loadSuperAdminUsers();
          loadAllTenants();
        } else if (role === 4) {
          setIsContador(true);
          if (inContadorMode) {
            setActiveTab("11");
            document.title = "Mi perfil | Bolti";
            loadMyTenants();
            loadAllUsers(); // También cargar personal
          } else {
            setActiveTab("11");
            document.title = "Mi perfil | Bolti";
          }
        } else if (role === 1 && inContadorMode) {
          // Tenant en modo Contador: mostrar Mis empresas y Personal
          setActiveTab("11");
          document.title = "Mi perfil | Bolti";
          loadMyTenants();
          loadAllUsers();
        } else if (role === 3 || role === 2) {
          setIsEmployee(true);
          setActiveTab("11");
          document.title = "Mi perfil | Bolti";
          const uid = dec?.user?.id;
          if (uid) loadCurrentUserProfile(String(uid));
        } else {
          setActiveTab("11");
          document.title = "Mi perfil | Bolti";
        }
      }
    } catch (e) { }
  }, []);

  // Cargar todas las empresas (Super Admin)
  const loadAllTenants = async () => {
    setLoadingTenants(true);
    try {
      const { data } = await api.get('/tenants');
      setAllTenants(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Error cargando empresas:', e);
      Swal.fire('Error', 'No se pudieron cargar las empresas', 'error');
    } finally {
      setLoadingTenants(false);
    }
  };

  // Mis empresas (Contador): GET /tenants/mine
  const loadMyTenants = async () => {
    setLoadingMyTenants(true);
    try {
      const { data } = await api.get('/tenants/mine');
      setMyTenants(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Error cargando mis empresas:', e);
      toast.error('No se pudieron cargar tus empresas.');
    } finally {
      setLoadingMyTenants(false);
    }
  };

  const handleCreateTenant = async () => {
    const n = (newTenantName || '').trim();
    if (!n) {
      Swal.fire('Error', 'El nombre de la empresa es obligatorio.', 'error');
      return;
    }
    setCreatingTenant(true);
    try {
      await api.post('/tenants', { name: n, email: (newTenantEmail || '').trim() || undefined });
      await Swal.fire({
        icon: 'success',
        title: '¡Empresa creada!',
        text: 'La nueva empresa aparecerá automáticamente en el selector del menú superior.',
        timer: 2000,
        showConfirmButton: false
      });
      // Recargar para que el topbar TenantSwitcher se actualice con la nueva empresa
      window.location.reload();
    } catch (e: any) {
      Swal.fire('Error', e?.response?.data?.error || 'No se pudo crear la empresa.', 'error');
      setCreatingTenant(false);
    }
  };

  // Paginación de empresas
  const totalTenantPages = Math.ceil(allTenants.length / TENANTS_PER_PAGE);
  const paginatedTenants = useMemo(() => {
    const start = (tenantPage - 1) * TENANTS_PER_PAGE;
    return allTenants.slice(start, start + TENANTS_PER_PAGE);
  }, [allTenants, tenantPage]);

  // Empresa por defecto: Bolti (bolti.ai) si existe; si no, la primera del listado. Nunca se pide al usuario.
  const defaultTenantId = useMemo(() => {
    const exact = ['bolti', 'bolti hq', 'bolti master', 'bolti.ai', 'bolti sas', 'bolti s.a.s.', 'bolti headquarters'];
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const t = allTenants.find((x: any) => {
      const n = norm(x.name);
      const slug = norm(x.slug || '');
      return exact.includes(n) || n.startsWith('bolti ') || n === 'bolti' || slug.startsWith('bolti') || slug === 'bolti';
    });
    return t ? String(t.id) : (allTenants[0] ? String(allTenants[0].id) : null);
  }, [allTenants]);

  // Para Contador o Tenant en Espacio Contador: usar tenant activo. Resto: defaultTenantId.
  const effectiveTenantForUser = useMemo(() => {
    const inContadorMode = isContadorFullMode();
    return (isContador || inContadorMode) ? (tenantId || null) : defaultTenantId;
  }, [isContador, tenantId, defaultTenantId]);

  // Eliminar empresa
  const handleDeleteTenant = async (id: string, name: string) => {
    const result = await Swal.fire({
      title: `¿Eliminar empresa "${name}"?`,
      text: "Esta acción eliminará todos los usuarios, datos y configuración de la empresa. ¡No se puede deshacer!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar empresa',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/tenants/${id}`);
        Swal.fire('¡Eliminada!', 'La empresa ha sido eliminada correctamente.', 'success');
        loadAllTenants();
      } catch (e: any) {
        Swal.fire('Error', e?.response?.data?.message || 'No se pudo eliminar la empresa', 'error');
      }
    }
  };

  const handleBulkFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBulkFile(e.target.files[0]);
    }
  };

  const processBulkUpload = async () => {
    if (!bulkFile) return;
    setUploadingBulk(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        // Parse CSV simple (headers: name,email,phone,address,tax_id)
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const tenants: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length < 2) continue;
          const obj: any = {};
          headers.forEach((h, index) => {
            obj[h] = cols[index]?.trim();
          });
          tenants.push(obj);
        }

        if (tenants.length === 0) throw new Error("No se encontraron datos en el CSV");

        const { data } = await api.post('/tenants/bulk', { tenants });

        let htmlMsg = `Creados: ${data.success}<br>Errores: ${data.errors}`;
        if (data.details.some((d: any) => d.status === 'error')) {
          htmlMsg += '<div style="text-align:left;max-height:100px;overflow:auto;margin-top:10px;font-size:0.8em">';
          data.details.forEach((d: any) => {
            if (d.status === 'error') htmlMsg += `<br>❌ ${d.name}: ${d.message}`;
          });
          htmlMsg += '</div>';
        }

        Swal.fire({
          title: 'Carga Masiva Completada',
          html: htmlMsg,
          icon: data.errors > 0 ? 'warning' : 'success'
        });
        setBulkFile(null);

      } catch (err: any) {
        Swal.fire('Error', err.message || 'Error procesando archivo', 'error');
      } finally {
        setUploadingBulk(false);
      }
    };
    reader.readAsText(bulkFile);
  };

  // Función para crear o editar usuario (solo Super Admin)
  const handleSaveUser = async () => {
    // Validación diferente para editar (contraseña opcional)
    if (!editingUser) {
      if (!newUserEmail || !newUserPassword || !newUserFirstName || !newUserRole) {
        Swal.fire('Error', 'Por favor completa todos los campos obligatorios', 'error');
        return;
      }
      if (newUserPassword.length < 6) {
        Swal.fire('Error', 'La contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }
    } else {
      if (!newUserEmail || !newUserFirstName || !newUserRole) {
        Swal.fire('Error', 'Por favor completa todos los campos obligatorios', 'error');
        return;
      }
      if (newUserPassword && newUserPassword.length < 6) {
        Swal.fire('Error', 'La contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }
    }

    const roleId = parseInt(newUserRole, 10);
    if (Number.isNaN(roleId) || roleId < 1 || (roleId !== 3 && roleId !== 5 && roleId !== 99)) {
      Swal.fire('Error', 'Selecciona un rol (Empleado, Coordinador o Super Admin)', 'error');
      return;
    }
    const isCreatingSuperAdmin = roleId === 99;
    // SuperAdmin logueado puede crear empleados con tenant_id=1 aunque effectiveTenantForUser sea null
    const currentUserIsSuperAdmin = isSuperAdmin; // state-level
    const resolvedTenant = effectiveTenantForUser || (currentUserIsSuperAdmin ? '1' : null);
    if (!editingUser && !isCreatingSuperAdmin && !resolvedTenant) {
      Swal.fire('Error', isContador ? 'Selecciona una empresa en el menú superior antes de crear personal.' : 'No hay empresas cargadas. Espera un momento o recarga la página.', 'error');
      return;
    }

    setCreatingUser(true);
    try {
      const roleIdNum = Number(roleId);
      const userData: any = {
        email: newUserEmail.trim(),
        first_name: newUserFirstName.trim(),
        last_name: editingUser ? (editingUser.last_name || null) : null,
        phone: editingUser ? (editingUser.phone || null) : null,
        role_id: roleIdNum,
      };

      if (!editingUser) {
        userData.password = (newUserPassword && newUserPassword.trim()) || '';
      } else if (newUserPassword && newUserPassword.trim()) {
        userData.password = newUserPassword.trim();
      }

      // Super Admin creado: sin empresa. Contador: empresa activa. Resto: resolvedTenant (con fallback a 1 para SuperAdmin).
      userData.tenant_id = isCreatingSuperAdmin ? null : (editingUser ? (editingUser.tenant_id ?? resolvedTenant) : resolvedTenant);

      if (editingUser) {
        // Editar usuario existente
        await api.put(`/users/${editingUser.id}`, userData);
        Swal.fire({
          icon: 'success',
          title: '¡Usuario actualizado!',
          text: `El usuario ${userData.first_name} ha sido actualizado.`,
          confirmButtonColor: '#667eea'
        });
      } else {
        // Crear nuevo usuario
        const { data } = await api.post('/users', userData);
        const emailMsg = data.email_sent
          ? ` Se ha enviado un correo de bienvenida a ${data.email} por Resend.`
          : (data.email_error ? ' No se pudo enviar el correo de bienvenida (Revisa Resend/API key).' : '');
        Swal.fire({
          icon: 'success',
          title: '¡Usuario creado!',
          text: `El usuario ${data.first_name} ${data.last_name || ''} ha sido creado.${emailMsg}`,
          confirmButtonColor: '#667eea'
        });
      }

      closeUserModal();
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserFirstName("");
      setNewUserRole("");
      if (roleId === 99) await loadSuperAdminUsers(); else await loadAllUsers();

    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Error al guardar el usuario';
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMsg,
        confirmButtonColor: '#667eea'
      });
    } finally {
      setCreatingUser(false);
    }
  };


  useEffect(() => {
    if (!loading) {
      dispatch(setSetupProgress(progress));
    }
  }, [progress, loading, dispatch]);


  const renderSvcPageNumbers = () => {
    if (totalSvcPages <= 1) return null;
    const windowSize = 5;
    let start = Math.max(1, svcPage - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalSvcPages) { end = totalSvcPages; start = Math.max(1, end - windowSize + 1); }
    const items: JSX.Element[] = [];
    for (let p = start; p <= end; p++) {
      items.push(
        <PaginationItem key={p} active={p === svcPage}>
          <PaginationLink onClick={() => setSvcPage(p)}>{p}</PaginationLink>
        </PaginationItem>
      );
    }
    return items;
  };

  const handleUpdateServiceCategory = async (id: string, newName: string) => {
    try {
      await api.put(`/categories/${id}`, { name: newName });
      Swal.fire({ icon: 'success', title: '¡Actualizada!', text: 'La categoría ha sido actualizada.', timer: 1500, showConfirmButton: false });
      await loadCategories();
    } catch (e: any) {
      Swal.fire('Error', e?.response?.data?.error || 'No se pudo actualizar la categoría', 'error');
    }
  };

  const handleDeleteServiceCategory = async (id: string) => {
    try {
      await api.delete(`/categories/${id}`);
      handleCategoryDeleted(id);
      Swal.fire({ icon: 'success', title: '¡Eliminada!', text: 'La categoría ha sido eliminada.', timer: 1500, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire('Error', e?.response?.data?.error || 'No se pudo eliminar la categoría', 'error');
    }
  };

  if (loading) {
    // En modo singleTab (embebido en Contabilidad), mostramos un spinner simple
    // sin el wrapper `page-content` que introduce padding de layout.
    if (singleTab) {
      return (
        <Container fluid><Row className="justify-content-center"><Col md={8} lg={6} xl={5}><Card className="mt-4"><CardBody className="p-4 text-center"><Spinner /> <span className="ms-2">Cargando configuración…</span></CardBody></Card></Col></Row></Container>
      );
    }
    return (
      <div className="page-content">
        <Container fluid><Row className="justify-content-center"><Col md={8} lg={6} xl={5}><Card className="mt-4"><CardBody className="p-4 text-center"><Spinner /> <span className="ms-2">Cargando configuración…</span></CardBody></Card></Col></Row></Container>
      </div>
    );
  }

  // Modo "página independiente" dentro de Contabilidad:
  // Solo renderizamos el TabPane correspondiente. Sin nav, sin sidebar, sin background.
  // La lógica de fetch/save/logo sigue corriendo igual porque está en useEffects del componente.
  if (singleTab) {
    return (
      <React.Fragment>
        {error && <Alert color="danger" fade={false}>{error}</Alert>}
        {loadingAlegra && (
          <Alert color="info" fade={false}>
            <Spinner size="sm" className="me-2" />
            Cargando datos DIAN...
          </Alert>
        )}
        <TabContent activeTab={effectiveActiveTab}>
          {!isSuperAdmin && !isEmployee && singleTab === '1' && (
            <TabPane tabId="1">
              <DatosTenant
                section="datos"
                name={name} phone={phone} address={address} email={email} website={website} ivaRate={ivaRate} adminFee={adminFee}
                setName={setName} setPhone={setPhone} setAddress={setAddress} setEmail={setEmail} setWebsite={setWebsite} setIvaRate={setIvaRate} setAdminFee={setAdminFee}
                productsForStaff={productsForStaff} setProductsForStaff={setProductsForStaff}
                adminFeeEnabled={adminFeeEnabled} setAdminFeeEnabled={setAdminFeeEnabled}
                loansToStaff={loansToStaff} setLoansToStaff={setLoansToStaff}
                taxIdType={taxIdType} setTaxIdType={setTaxIdType} taxId={taxId} setTaxId={setTaxId}
                businessName={businessName} setBusinessName={setBusinessName}
                taxResponsibility={taxResponsibility} setTaxResponsibility={setTaxResponsibility}
                city={city} setCity={setCity} state={state} setState={setState}
                postalCode={postalCode} setPostalCode={setPostalCode}
                sector={sector} setSector={setSector} currency={currency} setCurrency={setCurrency}
                decimalPrecision={decimalPrecision} setDecimalPrecision={setDecimalPrecision}
                decimalSeparator={decimalSeparator} setDecimalSeparator={setDecimalSeparator}
                perDay={defaultWeek()} toggleDay={() => { }} changeHour={() => { }} applyMondayToAll={() => { }}
                saving={saving} onSubmit={handleSaveInfo} onCancel={() => updateStateFromTenant(tenant)}
                dianDepartments={dianDepartments}
                dianMunicipalities={dianMunicipalities}
                dianTaxRegimes={dianTaxRegimes}
              />
              <div className="border rounded p-3 mb-4 bg-light">
                <h6 className="mb-3"><i className="ri-apps-line me-2"></i>Modulos activos</h6>
                <p className="text-muted small mb-3">Activa los modulos que necesita tu empresa. El modulo Comercial siempre esta incluido.</p>
                <div className="d-flex flex-wrap gap-3">
                  {[
                    { id: 'contable', label: 'Contable (DIAN, impuestos, PUC)', icon: 'ri-calculator-line', always: false },
                  ].map((mod) => (
                    <div key={mod.id} className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`module-${mod.id}`}
                        checked={activeModules.includes(mod.id)}
                        disabled={mod.always || saving}
                        onChange={async (e) => {
                          const next = e.target.checked
                            ? [...activeModules, mod.id]
                            : activeModules.filter((m) => m !== mod.id);
                          setActiveModules(next);
                          localStorage.setItem('crumi-active-modules', JSON.stringify(next));
                          window.dispatchEvent(new Event('crumi-modules-changed'));
                          try {
                            await api.put(`/tenants/${tenantId}`, { active_modules: next });
                          } catch { /* silent */ }
                        }}
                      />
                      <label className="form-check-label" htmlFor={`module-${mod.id}`}>
                        <i className={`${mod.icon} me-1`}></i>{mod.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </TabPane>
          )}
          {!isSuperAdmin && !isEmployee && singleTab === '8' && (
            <TabPane tabId="8">
              <FacturacionElectronicaSection
                tenantId={tenantId}
                onStatusChange={() => {
                  if (tenantId) {
                    reloadTenantAndAlegraData(tenantId).catch(() => {});
                  }
                }}
              />
            </TabPane>
          )}
          {!isSuperAdmin && !isEmployee && singleTab === '9' && (
            <TabPane tabId="9">
              <AccountingMasterSection tenantId={tenantId || ''} />
            </TabPane>
          )}
          {!isSuperAdmin && !isEmployee && singleTab === '10' && (
            <TabPane tabId="10">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                  <h5 className="mb-0"><i className="ri-contacts-book-line me-2"></i>Terceros</h5>
                  <div className="text-muted fs-13">Clientes, proveedores, empleados y otros</div>
                </div>
                <div className="d-flex gap-2">
                  <Link to="/terceros-hub/nuevo" className="btn btn-primary btn-sm">
                    <i className="ri-user-add-line me-1"></i> Nuevo tercero
                  </Link>
                  <Link to="/terceros-hub" className="btn btn-light btn-sm" title="Abrir vista completa">
                    <i className="ri-external-link-line"></i>
                  </Link>
                </div>
              </div>
              <ListaTerceros />
            </TabPane>
          )}
        </TabContent>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <div className="position-relative mx-n4 mt-n4">
            <div className="profile-wid-bg profile-setting-img"><img src={progileBg} className="profile-wid-img" alt="" /></div>
          </div>
          <Row>
            <Col xxl={3}>
              <Card className="mt-n5">
                <CardBody className="p-4 text-center">
                  <div className="profile-user position-relative d-inline-block mx-auto mb-4" style={{ cursor: 'pointer' }} onClick={openLogoPicker} title="Cambiar logo">
                    <div style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '50%',
                      backgroundColor: '#1C1C36',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      border: '4px solid #fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      <img
                        src={logoUrl || logoWhite}
                        alt="Logo Bolti"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          padding: '10px'
                        }}
                      />
                    </div>
                    <span className="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: 36, height: 36, border: '2px solid white' }}><i className="ri-image-edit-line"></i></span>
                    <input ref={logoInputRef} type="file" accept="image/*" className="d-none" onChange={onLogoInputChange} />
                  </div>
                  <div className="small text-muted mb-2">
                    {uploadingLogo ? "Subiendo logo…" : (logoFile ? "Logo listo para guardar" : "Haz clic en el logo para cambiarlo")}
                  </div>
                  <h5 className="fs-16 mb-1">{name || "Mi peluquería"}</h5>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  {!isSuperAdmin && !isEmployee ? (
                    <>
                      <div className="d-flex align-items-center mb-3">
                        <div className="flex-grow-1"><h5 className="card-title mb-0">Avance de configuración</h5></div>
                        <div className="flex-shrink-0"><span className="badge bg-light text-primary fs-12">{progress === 100 ? "Completo" : "Parcial"}</span></div>
                      </div>
                      <div className="progress animated-progress custom-progress progress-label">
                        <div className={`progress-bar ${progress === 100 ? "bg-success" : "bg-warning"}`} role="progressbar" style={{ width: `${progress}%` }}><div className="label">{progress}%</div></div>
                      </div>
                      <ul className="list-unstyled mt-3 mb-0">
                        <li className="d-flex align-items-center gap-2">
                          <i className={`ri-checkbox-${(name && phone && address && taxId && businessName) ? 'circle-fill text-success' : 'blank-circle-line text-muted'}`}></i>
                          <span>Datos de la empresa</span>
                        </li>
                      </ul>
                    </>
                  ) : isEmployee ? (
                    <div className="text-center">
                      <h5 className="fs-16 mb-1">Mi información</h5>
                      <p className="text-muted mb-0">Edita tus datos personales</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <h5 className="fs-16 mb-1">Super Admin</h5>
                      <p className="text-muted mb-0">Gestión Global</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
            <Col xxl={9}>
              <Card className="mt-xxl-n5">
                <CardHeader>
                  <Nav className="nav-tabs-custom rounded card-header-tabs border-bottom-0" role="tablist">
                    {/* Empresa, Facturación electrónica, Contabilidad maestra y Terceros
                        se movieron al módulo Contabilidad → Configuración.
                        Siguen accesibles vía `?tab=1|8|9|10` si se llega por deep-link,
                        pero ya no aparecen en el nav de Settings.
                        Settings queda solo con accesos personales: Perfil, Personal, Mis empresas. */}
                    <NavItem><NavLink className={classnames({ active: activeTab === "11" })} onClick={() => tabChange("11")} href="#" role="tab"><i className="ri-user-3-line"></i>&nbsp; Personal</NavLink></NavItem>
                    {/* <NavItem><NavLink className={classnames({ active: activeTab === "2" })} onClick={() => tabChange("2")} href="#" role="tab"><i className="ri-time-line"></i>&nbsp; Horario</NavLink></NavItem> */}
                    {/* <NavItem><NavLink className={classnames({ active: activeTab === "3" })} onClick={() => tabChange("3")} href="#" role="tab"><i className="ri-scissors-2-line"></i>&nbsp; Servicios</NavLink></NavItem> */}
                    {/* ✅ COMENTADO: Tab de Empleados removido */}
                    {/* <NavItem><NavLink className={classnames({ active: activeTab === "2" })} onClick={() => tabChange("2")} href="#" role="tab"><i className="ri-team-line"></i>&nbsp; Empleados</NavLink></NavItem> */}
                    {/* ✅ COMENTADO: Tab de Clientes removido - Ahora está en el sidebar como página independiente */}
                    {/* <NavItem><NavLink className={classnames({ active: activeTab === "2" })} onClick={() => tabChange("2")} href="#" role="tab"><i className="ri-building-line"></i>&nbsp; Clientes</NavLink></NavItem> */}
                    {(isSuperAdmin || isContadorFullMode()) && (
                      <NavItem><NavLink className={classnames({ active: activeTab === "6" })} onClick={() => tabChange("6")} href="#" role="tab"><i className="ri-team-line"></i>&nbsp; Personal</NavLink></NavItem>
                    )}
                    {isContadorFullMode() && (
                      <NavItem><NavLink className={classnames({ active: activeTab === "7" })} onClick={() => tabChange("7")} href="#" role="tab"><i className="ri-building-2-line"></i>&nbsp; Mis empresas</NavLink></NavItem>
                    )}
                    {isSuperAdmin && (
                      <NavItem><NavLink className={classnames({ active: activeTab === "5" })} onClick={() => tabChange("5")} href="#" role="tab"><i className="ri-admin-line"></i>&nbsp; Super Admin</NavLink></NavItem>
                    )}
                  </Nav>
                </CardHeader>
                <CardBody className="p-4">
                  {error && <Alert color="danger" fade={false}>{error}</Alert>}
                  {loadingAlegra && (
                    <Alert color="info" fade={false}>
                      <Spinner size="sm" className="me-2" />
                      Cargando datos DIAN...
                    </Alert>
                  )}
                  <TabContent activeTab={activeTab}>
                    {!isSuperAdmin && !isEmployee && (
                      <TabPane tabId="1">
                        <DatosTenant
                          section="datos"
                          name={name} phone={phone} address={address} email={email} website={website} ivaRate={ivaRate} adminFee={adminFee}
                          setName={setName} setPhone={setPhone} setAddress={setAddress} setEmail={setEmail} setWebsite={setWebsite} setIvaRate={setIvaRate} setAdminFee={setAdminFee}
                          productsForStaff={productsForStaff} setProductsForStaff={setProductsForStaff}
                          adminFeeEnabled={adminFeeEnabled} setAdminFeeEnabled={setAdminFeeEnabled}
                          loansToStaff={loansToStaff} setLoansToStaff={setLoansToStaff}
                          taxIdType={taxIdType} setTaxIdType={setTaxIdType} taxId={taxId} setTaxId={setTaxId}
                          businessName={businessName} setBusinessName={setBusinessName}
                          taxResponsibility={taxResponsibility} setTaxResponsibility={setTaxResponsibility}
                          city={city} setCity={setCity} state={state} setState={setState}
                          postalCode={postalCode} setPostalCode={setPostalCode}
                          sector={sector} setSector={setSector} currency={currency} setCurrency={setCurrency}
                          decimalPrecision={decimalPrecision} setDecimalPrecision={setDecimalPrecision}
                          decimalSeparator={decimalSeparator} setDecimalSeparator={setDecimalSeparator}
                          perDay={defaultWeek()} toggleDay={() => { }} changeHour={() => { }} applyMondayToAll={() => { }}
                          saving={saving} onSubmit={handleSaveInfo} onCancel={() => updateStateFromTenant(tenant)}
                          dianDepartments={dianDepartments}
                          dianMunicipalities={dianMunicipalities}
                          dianTaxRegimes={dianTaxRegimes}
                        />
                        {/* Seccion de Modulos */}
                        <div className="border rounded p-3 mb-4 bg-light">
                          <h6 className="mb-3"><i className="ri-apps-line me-2"></i>Modulos activos</h6>
                          <p className="text-muted small mb-3">Activa los modulos que necesita tu empresa. El modulo Comercial siempre esta incluido.</p>
                          <div className="d-flex flex-wrap gap-3">
                            {[
                              { id: 'contable', label: 'Contable (DIAN, impuestos, PUC)', icon: 'ri-calculator-line', always: false },
                            ].map((mod) => (
                              <div key={mod.id} className="form-check form-switch">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`module-${mod.id}`}
                                  checked={activeModules.includes(mod.id)}
                                  disabled={mod.always || saving}
                                  onChange={async (e) => {
                                    const next = e.target.checked
                                      ? [...activeModules, mod.id]
                                      : activeModules.filter((m) => m !== mod.id);
                                    setActiveModules(next);
                                    localStorage.setItem('crumi-active-modules', JSON.stringify(next));
                                    window.dispatchEvent(new Event('crumi-modules-changed'));
                                    try {
                                      await api.put(`/tenants/${tenantId}`, { active_modules: next });
                                    } catch { /* silent */ }
                                  }}
                                />
                                <label className="form-check-label" htmlFor={`module-${mod.id}`}>
                                  <i className={`${mod.icon} me-1`}></i>{mod.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabPane>
                    )}
                    {!isSuperAdmin && !isEmployee && (
                      <TabPane tabId="8">
                        <FacturacionElectronicaSection
                          tenantId={tenantId}
                          onStatusChange={() => {
                            if (tenantId) {
                              reloadTenantAndAlegraData(tenantId).catch(() => {});
                            }
                          }}
                        />
                      </TabPane>
                    )}
                    {!isSuperAdmin && !isEmployee && (
                      <TabPane tabId="9">
                        <AccountingMasterSection tenantId={tenantId || ''} />
                      </TabPane>
                    )}
                    {!isSuperAdmin && !isEmployee && (
                      <TabPane tabId="10">
                        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                          <div>
                            <h5 className="mb-0"><i className="ri-contacts-book-line me-2"></i>Terceros</h5>
                            <div className="text-muted fs-13">Clientes, proveedores, empleados y otros</div>
                          </div>
                          <div className="d-flex gap-2">
                            <Link to="/terceros-hub/nuevo" className="btn btn-primary btn-sm">
                              <i className="ri-user-add-line me-1"></i> Nuevo tercero
                            </Link>
                            <Link to="/terceros-hub" className="btn btn-light btn-sm" title="Abrir vista completa">
                              <i className="ri-external-link-line"></i>
                            </Link>
                          </div>
                        </div>
                        <ListaTerceros />
                      </TabPane>
                    )}
                    {/* Perfil del usuario (Personal) - tab por defecto */}
                    <TabPane tabId="11">
                      <MiPerfil />
                    </TabPane>
                    {/* Mis empresas (Contador rol 4 o Tenant rol 1 en modo contador) */}
                    {isContadorFullMode() && (
                      <TabPane tabId="7">
                        <div className="mb-4">
                          <h5 className="mb-3"><i className="ri-building-2-line me-2"></i>Mis empresas</h5>
                          <p className="text-muted mb-4">Crea empresas (marca blanca) y cambia entre ellas desde el ícono de edificio en la barra superior.</p>
                          <Alert color="info" className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <span>Para crear <strong>empleados y coordinadores</strong> para el Kanban, ve a la pestaña <strong>Personal</strong>.</span>
                            <Button color="primary" size="sm" onClick={() => tabChange("6")}>
                              <i className="ri-team-line me-1"></i> Ir a Personal
                            </Button>
                          </Alert>
                          <Row className="g-3 mb-4 mt-3">
                            <Col md={4}>
                              <Label className="form-label">Nombre de la empresa *</Label>
                              <Input value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="Ej. Mi Contaduría" />
                            </Col>
                            <Col md={4}>
                              <Label className="form-label">Email (opcional)</Label>
                              <Input type="email" value={newTenantEmail} onChange={(e) => setNewTenantEmail(e.target.value)} placeholder="contacto@empresa.com" />
                            </Col>
                            <Col md={4} className="d-flex align-items-end gap-2">
                              <Button color="primary" onClick={handleCreateTenant} disabled={creatingTenant || !(newTenantName || '').trim()}>
                                {creatingTenant ? <><Spinner size="sm" className="me-2" /> Creando...</> : <><i className="ri-add-line me-1" /> Nueva empresa</>}
                              </Button>
                              <Button color="soft-primary" onClick={() => setBulkModalOpen(true)}>
                                <i className="ri-upload-cloud-2-line me-1" /> Carga Masiva
                              </Button>
                            </Col>
                          </Row>
                          {loadingMyTenants ? (
                            <div className="text-center py-4"><Spinner /> <span className="ms-2">Cargando...</span></div>
                          ) : myTenants.length === 0 ? (
                            <Alert color="info">Aún no has creado empresas. Usa el formulario de arriba para crear una.</Alert>
                          ) : (
                            <div className="table-responsive">
                              <Table hover className="align-middle mb-0">
                                <thead className="table-light"><tr><th>Nombre</th><th>Email</th><th>Slug</th></tr></thead>
                                <tbody>
                                  {myTenants.map((t: any) => (
                                    <tr key={t.id}>
                                      <td className="fw-medium">{t.name || '-'}</td>
                                      <td>{t.email || '-'}</td>
                                      <td><code>{t.slug || '-'}</code></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          )}
                          <BulkUploadModal
                            isOpen={bulkModalOpen}
                            toggle={() => setBulkModalOpen(false)}
                            onComplete={loadMyTenants}
                          />
                        </div>
                      </TabPane>
                    )}
                    {/* Mi información editable para Empleados (rol 2 y 3) */}
                    {isEmployee && (
                      <TabPane tabId="1">
                        <div className="mb-4">
                          <h5 className="mb-3"><i className="ri-user-line me-2"></i>Mi información</h5>
                          <p className="text-muted mb-4">Actualiza tu nombre, correo, teléfono o contraseña.</p>
                          <Row className="g-3">
                            <Col md={6}>
                              <Label className="form-label">Nombre</Label>
                              <Input value={employeeFirstName} onChange={(e) => setEmployeeFirstName(e.target.value)} placeholder="Nombre" />
                            </Col>
                            <Col md={6}>
                              <Label className="form-label">Apellido</Label>
                              <Input value={employeeLastName} onChange={(e) => setEmployeeLastName(e.target.value)} placeholder="Apellido" />
                            </Col>
                            <Col md={6}>
                              <Label className="form-label">Correo electrónico</Label>
                              <Input type="email" value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} placeholder="correo@ejemplo.com" />
                            </Col>
                            <Col md={6}>
                              <Label className="form-label">Teléfono</Label>
                              <Input value={employeePhone} onChange={(e) => setEmployeePhone(e.target.value)} placeholder="Teléfono" />
                            </Col>
                            <Col md={12}>
                              <Label className="form-label">Nueva contraseña (opcional)</Label>
                              <Input type="password" value={employeeNewPassword} onChange={(e) => setEmployeeNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres. Dejar en blanco para no cambiar" autoComplete="new-password" />
                            </Col>
                            <Col md={12}>
                              <Button color="primary" onClick={handleSaveEmployeeProfile} disabled={employeeSaving}>
                                {employeeSaving ? <><Spinner size="sm" className="me-2" /> Guardando...</> : "Guardar cambios"}
                              </Button>
                            </Col>
                          </Row>
                        </div>
                      </TabPane>
                    )}
                    {/* TabPane de Horario comentado */}
                    {/* <TabPane tabId="2">
                      <DatosTenant
                        section="horario"
                        name={name} phone={phone} address={address} email={email} website={website} ivaRate={ivaRate} adminFee={adminFee}
                        setName={() => { }} setPhone={() => { }} setAddress={() => { }} setEmail={() => { }} setWebsite={() => { }} setIvaRate={() => { }} setAdminFee={() => { }}
                        productsForStaff={productsForStaff} setProductsForStaff={setProductsForStaff}
                        adminFeeEnabled={adminFeeEnabled} setAdminFeeEnabled={setAdminFeeEnabled}
                        loansToStaff={loansToStaff} setLoansToStaff={setLoansToStaff}
                        perDay={perDay} toggleDay={toggleDay} changeHour={changeHour} applyMondayToAll={applyMondayToAll}
                        saving={saving} onSubmit={handleSaveHours} onCancel={() => updateStateFromTenant(tenant)}
                      />
                    </TabPane> */}
                    {/* TabPane de Servicios comentado */}
                    {/* <TabPane tabId="3">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="mb-0">Servicios</h5>
                        <div className="d-flex align-items-center gap-2">{svcLoading && <Spinner size="sm" />}<Button color="primary" onClick={openNewService}><i className="ri-add-line me-1" /> Nuevo servicio</Button></div>
                      </div>
                      <div className="table-responsive">
                        <Table hover className="align-middle">
                          <thead><tr><th>Servicio</th><th>Categoría</th><th>Duración</th><th>Precio</th><th style={{ width: 100 }}>Acciones</th></tr></thead>
                          <tbody>
                            {paginatedServices.length === 0 && (<tr><td colSpan={5} className="text-center text-muted py-4">No has creado ningún servicio todavía.</td></tr>)}
                            {paginatedServices.map(s => {
                              const catName = categories.find(c => c.id === s.category_id)?.name || "—";
                              return (
                                <tr key={s.id}>
                                  <td className="fw-semibold">{s.name}</td>
                                  <td><Badge pill color="light" className="text-dark">{catName}</Badge></td>
                                  <td>{s.duration_minutes} min</td>
                                  <td>${s.price.toLocaleString('es-CO')}</td>
                                  <td>
                                    <div className="d-flex gap-2">
                                      <Button size="sm" color="soft-primary" onClick={() => openEditService(s)} title="Editar"><i className="ri-edit-line" /></Button>
                                      <Button size="sm" color="soft-danger" onClick={() => deleteService(s)} title="Eliminar"><i className="ri-delete-bin-line" /></Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      </div>
                      {services.length > SVC_PAGE_SIZE && (
                        <div className="d-flex justify-content-end mt-3">
                          <Pagination className="pagination-separated mb-0">
                            <PaginationItem disabled={svcPage === 1}><PaginationLink first onClick={() => setSvcPage(1)} /></PaginationItem>
                            <PaginationItem disabled={svcPage === 1}><PaginationLink previous onClick={() => setSvcPage(p => Math.max(1, p - 1))} /></PaginationItem>
                            {renderSvcPageNumbers()}
                            <PaginationItem disabled={svcPage === totalSvcPages}><PaginationLink next onClick={() => setSvcPage(p => Math.min(totalSvcPages, p + 1))} /></PaginationItem>
                            <PaginationItem disabled={svcPage === totalSvcPages}><PaginationLink last onClick={() => setSvcPage(totalSvcPages)} /></PaginationItem>
                          </Pagination>
                        </div>
                      )}
                      <ServiceModal
                        isOpen={svModalOpen}
                        onClose={() => setSvModalOpen(false)}
                        onSaved={refreshAllServices}
                        categories={categories}
                        onCategoryCreated={handleCategoryCreated}
                        tenantId={tenantId}
                        edit={svEdit}
                        onManageCategories={() => setCategoryManagerOpen(true)}
                      />
                    </TabPane> */}
                    {/* ✅ COMENTADO: Tab de Empleados removido */}
                    {/* <TabPane tabId="2">
                      <Personal
                        services={[] as any}
                        categories={[] as any}
                        onStaffChange={loadStaffCount}
                      />
                    </TabPane> */}

                    {/* ✅ COMENTADO: Tab de Clientes removido - Ahora está en el sidebar como página independiente */}
                    {/* <TabPane tabId="2">
                      <ClientesList />
                    </TabPane> */}
                    {/* Personal (Super Admin o rol 1/4 en Espacio Contador): crear equipo para Kanban */}
                    {(isSuperAdmin || isContadorFullMode()) && (
                        <TabPane tabId="6">
                          <div className="d-flex justify-content-between align-items-center mb-4">
                            <h5 className="mb-0">Personal</h5>
                            <Button color="primary" onClick={() => openNewUserModal()}>
                              <i className="ri-add-line me-1"></i> Nuevo Usuario
                            </Button>
                          </div>
                          <p className="text-muted small mb-3">Crea empleados y coordinadores para asignar tareas en el Kanban. Los usuarios se crean en la empresa actual (selector de empresas en la barra superior).</p>
                          {loadingUsers ? (
                            <div className="text-center py-5">
                              <Spinner /> <span className="ms-2">Cargando personal...</span>
                            </div>
                          ) : allUsers.length === 0 ? (
                            <Alert color="info">No hay empleados o coordinadores registrados. Haz clic en "Nuevo Usuario" para crear uno.</Alert>
                          ) : (
                            <>
                              <div className="table-responsive">
                                <Table hover className="align-middle mb-0">
                                  <thead className="table-light">
                                    <tr>
                                      <th>Nombre</th>
                                      <th>Email</th>
                                      <th>Rol</th>
                                      {isSuperAdmin && <th>Empresa</th>}
                                      <th style={{ width: 120 }}>Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {paginatedUsers.map((user) => (
                                      <tr key={user.id}>
                                        <td className="fw-medium">
                                          {user.first_name} {user.last_name || ''}
                                        </td>
                                        <td>{user.email}</td>
                                        <td>
                                          <Badge color={user.role_id === 5 ? 'info' : 'secondary'}>
                                            {getRoleName(user.role_id)}
                                          </Badge>
                                        </td>
                                        {isSuperAdmin && <td>{user.tenant_name || <span className="text-muted">Sin empresa</span>}</td>}
                                        <td>
                                          <div className="d-flex gap-1">
                                            <Button
                                              size="sm"
                                              color="soft-primary"
                                              onClick={() => openEditUserModal(user)}
                                              title="Editar"
                                            >
                                              <i className="ri-edit-line"></i>
                                            </Button>
                                            <Button
                                              size="sm"
                                              color="soft-danger"
                                              onClick={() => handleDeleteUser(user.id, `${user.first_name} ${user.last_name || ''}`)}
                                              title="Eliminar"
                                            >
                                              <i className="ri-delete-bin-line"></i>
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                              {totalUserPages > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3">
                                  <small className="text-muted">
                                    Mostrando {((userPage - 1) * USERS_PER_PAGE) + 1} - {Math.min(userPage * USERS_PER_PAGE, allUsers.length)} de {allUsers.length}
                                  </small>
                                  <Pagination className="pagination-separated mb-0">
                                    <PaginationItem disabled={userPage === 1}>
                                      <PaginationLink previous onClick={() => setUserPage(p => Math.max(1, p - 1))} />
                                    </PaginationItem>
                                    {[...Array(totalUserPages)].map((_, idx) => (
                                      <PaginationItem key={idx + 1} active={userPage === idx + 1}>
                                        <PaginationLink onClick={() => setUserPage(idx + 1)}>{idx + 1}</PaginationLink>
                                      </PaginationItem>
                                    ))}
                                    <PaginationItem disabled={userPage === totalUserPages}>
                                      <PaginationLink next onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))} />
                                    </PaginationItem>
                                  </Pagination>
                                </div>
                              )}
                            </>
                          )}
                        </TabPane>
                    )}
                    {isSuperAdmin && (
                      <>
                        <TabPane tabId="5">
                          <div className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h5 className="mb-0">Usuarios Super Admin</h5>
                              <Button color="primary" onClick={() => openNewUserModal("99")}>
                                <i className="ri-add-line me-1"></i> Nuevo Usuario
                              </Button>
                            </div>
                            {loadingSuperAdminUsers ? (
                              <div className="text-center py-4">
                                <Spinner /> <span className="ms-2">Cargando usuarios Super Admin...</span>
                              </div>
                            ) : superAdminUsers.length === 0 ? (
                              <Alert color="info">No hay usuarios Super Admin registrados. Haz clic en "Nuevo Usuario" y elige rol Super Admin para crear uno.</Alert>
                            ) : (
                              <>
                                <div className="table-responsive">
                                  <Table hover className="align-middle mb-0">
                                    <thead className="table-light">
                                      <tr>
                                        <th>Nombre</th>
                                        <th>Email</th>
                                        <th>Rol</th>
                                        <th>Empresa</th>
                                        <th style={{ width: 120 }}>Acciones</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {paginatedSuperAdminUsers.map((user) => (
                                        <tr key={user.id}>
                                          <td className="fw-medium">{user.first_name} {user.last_name || ''}</td>
                                          <td>{user.email}</td>
                                          <td><Badge color="dark">{getRoleName(user.role_id)}</Badge></td>
                                          <td>{user.tenant_name || <span className="text-muted">—</span>}</td>
                                          <td>
                                            <div className="d-flex gap-1">
                                              <Button size="sm" color="soft-primary" onClick={() => openEditUserModal(user)} title="Editar"><i className="ri-edit-line"></i></Button>
                                              <Button size="sm" color="soft-danger" onClick={() => handleDeleteUser(user.id, `${user.first_name} ${user.last_name || ''}`)} title="Eliminar"><i className="ri-delete-bin-line"></i></Button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </Table>
                                </div>
                                {totalSuperAdminPages > 1 && (
                                  <div className="d-flex justify-content-between align-items-center mt-3">
                                    <small className="text-muted">
                                      Mostrando {((superAdminPage - 1) * SUPER_ADMIN_PER_PAGE) + 1} - {Math.min(superAdminPage * SUPER_ADMIN_PER_PAGE, superAdminUsers.length)} de {superAdminUsers.length}
                                    </small>
                                    <Pagination className="pagination-separated mb-0">
                                      <PaginationItem disabled={superAdminPage === 1}>
                                        <PaginationLink previous onClick={() => setSuperAdminPage(p => Math.max(1, p - 1))} />
                                      </PaginationItem>
                                      {[...Array(totalSuperAdminPages)].map((_, idx) => (
                                        <PaginationItem key={idx + 1} active={superAdminPage === idx + 1}>
                                          <PaginationLink onClick={() => setSuperAdminPage(idx + 1)}>{idx + 1}</PaginationLink>
                                        </PaginationItem>
                                      ))}
                                      <PaginationItem disabled={superAdminPage === totalSuperAdminPages}>
                                        <PaginationLink next onClick={() => setSuperAdminPage(p => Math.min(totalSuperAdminPages, p + 1))} />
                                      </PaginationItem>
                                    </Pagination>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <hr className="my-4" />
                          <h5 className="mb-4">Carga Masiva de Empresas</h5>
                          <Alert color="info">
                            <strong>Instrucciones:</strong> Sube un archivo CSV con las siguientes cabeceras (primera fila):<br />
                            <code>name, email, phone, address, tax_id, tax_id_type, business_name, city, state</code><br />
                            <small>El campo "name" y "email" son obligatorios. El resto son opcionales.</small>
                          </Alert>
                          <Input type="file" accept=".csv" onChange={handleBulkFileChange} className="mb-3" />
                          <div className="d-flex gap-2">
                            <Button color="success" onClick={processBulkUpload} disabled={!bulkFile || uploadingBulk}>
                              {uploadingBulk ? <Spinner size="sm" /> : 'Subir Empresas'}
                            </Button>
                          </div>
                        </TabPane>
                      </>
                    )}
                  </TabContent>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>


      {/* Modal para crear/editar usuario (Super Admin) */}
      <Modal isOpen={userModalOpen} toggle={closeUserModal} centered size="lg">
        <ModalHeader toggle={closeUserModal} className="bg-primary-subtle">
          {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        </ModalHeader>
        <ModalBody>
          {!editingUser && (
            <p className="text-muted small mb-3">
              {newUserRole === '99'
                ? 'Usuario master de Bolti (Super Admin). No se asigna a ninguna empresa.'
                : isContador && activeTab === '6'
                  ? 'Se crea en la empresa actual (selector debajo del logo). Solo Empleado o Coordinador para el Kanban.'
                  : 'Nombre, contraseña, email y rol. Por defecto se asigna a Bolti (bolti.ai).'}
            </p>
          )}
          <Row className="g-3">
            <Col md={6}>
              <Label>Nombre <span className="text-danger">*</span></Label>
              <Input
                type="text"
                placeholder="Nombre"
                value={newUserFirstName}
                onChange={(e) => setNewUserFirstName(e.target.value)}
              />
            </Col>
            <Col md={6}>
              <Label>Contraseña {!editingUser && <span className="text-danger">*</span>}</Label>
              <Input
                type="password"
                placeholder={editingUser ? "Dejar vacío para mantener actual" : "Mínimo 6 caracteres"}
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
              {editingUser && <small className="text-muted">Dejar vacío para mantener la contraseña actual</small>}
            </Col>
            <Col md={6}>
              <Label>Email <span className="text-danger">*</span></Label>
              <Input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                disabled={!!editingUser}
              />
            </Col>
            <Col md={6}>
              <Label>Rol <span className="text-danger">*</span></Label>
              <Input
                type="select"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value)}
              >
                <option value="">Selecciona un rol</option>
                {!(isContador && activeTab === "6") && (
                  <>
                    <option value="99">Super Admin</option>
                    <option value="4">Espacio Contador</option>
                  </>
                )}
                <option value="3">Empleado</option>
                <option value="5">Coordinador</option>
              </Input>
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={closeUserModal}>
            Cancelar
          </Button>
          <Button
            color="primary"
            onClick={handleSaveUser}
            disabled={creatingUser || !newUserEmail || !newUserFirstName || !newUserRole || (!editingUser && !newUserPassword) || (!editingUser && !(effectiveTenantForUser || isSuperAdmin) && newUserRole !== '99')}
          >
            {creatingUser ? (
              <>
                <Spinner size="sm" className="me-2" />
                {editingUser ? 'Guardando...' : 'Creando...'}
              </>
            ) : (
              <>
                <i className={editingUser ? "ri-save-line me-1" : "ri-user-add-line me-1"}></i>
                {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal para editar empresa */}
      <Modal isOpen={tenantModalOpen} toggle={closeTenantModal} centered>
        <ModalHeader toggle={closeTenantModal} className="bg-primary-subtle">
          Editar Empresa
        </ModalHeader>
        <ModalBody>
          <Row className="g-3">
            <Col md={12}>
              <Label>Nombre de la Empresa <span className="text-danger">*</span></Label>
              <Input type="text" value={editTenantName} onChange={(e) => setEditTenantName(e.target.value)} />
            </Col>
            <Col md={6}>
              <Label>Email <span className="text-danger">*</span></Label>
              <Input type="email" value={editTenantEmail} onChange={(e) => setEditTenantEmail(e.target.value)} />
            </Col>
            <Col md={6}>
              <Label>Teléfono</Label>
              <Input type="text" value={editTenantPhone} onChange={(e) => setEditTenantPhone(e.target.value)} />
            </Col>
            <Col md={12}>
              <Label>Dirección</Label>
              <Input type="textarea" value={editTenantAddress} onChange={(e) => setEditTenantAddress(e.target.value)} />
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" outline onClick={closeTenantModal}>Cancelar</Button>
          <Button color="primary" onClick={handleSaveTenantEdit} disabled={savingTenantEdit || !editTenantName || !editTenantEmail}>
            {savingTenantEdit ? <><Spinner size="sm" className="me-2" />Guardando...</> : 'Guardar Cambios'}
          </Button>
        </ModalFooter>
      </Modal>

      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        toggle={() => setCategoryManagerOpen(false)}
        title="Gestionar Categorías de Servicios"
        categories={categories}
        onSave={handleUpdateServiceCategory}
        onDelete={handleDeleteServiceCategory}
      />
    </React.Fragment>
  );
};

export default Settings;
