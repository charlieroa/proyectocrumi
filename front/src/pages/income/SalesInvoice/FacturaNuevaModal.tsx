// src/pages/income/SalesInvoice/FacturaNuevaModal.tsx
//
// Modal de creación de factura de venta (estilo Siigo). No usa rutas — se
// abre desde FacturaVentaLista.tsx con <FacturaNuevaModal isOpen toggle/>.
//
// NOTA: el endpoint existente /alegra/invoices sigue recibiendo el mismo
// shape que la versión vieja. Aquí agregamos "paymentMethods",
// "paymentMethodsTotal", "attachmentName" y "status" como campos extras —
// Alegra los ignora; cualquier backend propio los puede usar si quiere.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Col,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Offcanvas,
  OffcanvasBody,
  OffcanvasHeader,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  Paperclip,
  Plus,
  Receipt,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { env } from '../../../env';
import { api } from '../../../services/api';
import { getDecodedToken } from '../../../services/auth';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import PucPicker from '../../../Components/Contabilidad/PucPicker';

// ─────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────

export interface FacturaNuevaModalProps {
  isOpen: boolean;
  toggle: () => void;
  onSaved?: (invoice: any) => void;
}

type TipoDocumento = 'Factura venta' | 'Factura POS' | 'Factura exportación';

interface Cliente {
  id: string | number;
  name: string;
  identification?: string;
  nit?: string;
  email?: string;
  phone?: string;
}

interface Producto {
  id: string | number;
  nombre: string;
  descripcion?: string;
  precio: number;
  ivaPct: number;
}

interface LineaFactura {
  id: string;
  productoNombre: string;
  descripcion: string;
  cantidad: number;
  valorUnit: number;
  descPct: number;
  ivaPct: number;
  rfPct: number;
}

interface FormaPago {
  id: string;
  metodo: string;
  monto: number;
}

// ─────────────────────────────────────────────────────────────────────
// Constantes / helpers
// ─────────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'bolti_factura_draft';
const CLIENTES_DRAFT_KEY = 'bolti_clientes_draft';
const PRODUCTOS_LS_KEY = 'bolti_productos_servicios_v1';

const IVA_OPCIONES = [0, 5, 19];
const RF_OPCIONES = [0, 2.5, 4, 11];
const METODOS_PAGO = [
  'Efectivo',
  'Transferencia',
  'PSE',
  'Tarjeta',
  'Cheque',
  'Otro',
];

const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const money = (n: number): string =>
  `$${(Number(n) || 0).toLocaleString('es-CO', {
    maximumFractionDigits: 0,
  })}`;

const hoyISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

const totalLinea = (l: LineaFactura): number => {
  const bruto = (Number(l.cantidad) || 0) * (Number(l.valorUnit) || 0);
  const conDesc = bruto * (1 - (Number(l.descPct) || 0) / 100);
  return conDesc * (1 + (Number(l.ivaPct) || 0) / 100 - (Number(l.rfPct) || 0) / 100);
};

const emptyLinea = (): LineaFactura => ({
  id: uid(),
  productoNombre: '',
  descripcion: '',
  cantidad: 1,
  valorUnit: 0,
  descPct: 0,
  ivaPct: 19,
  rfPct: 0,
});

const emptyFormaPago = (): FormaPago => ({
  id: uid(),
  metodo: 'Efectivo',
  monto: 0,
});

// Seed productos (si LS vacío)
const PRODUCTOS_SEED: Producto[] = [
  {
    id: 'seed-1',
    nombre: 'Producto genérico',
    descripcion: 'Artículo de catálogo',
    precio: 50000,
    ivaPct: 19,
  },
  {
    id: 'seed-2',
    nombre: 'Asesoría profesional (hora)',
    descripcion: 'Servicio por hora',
    precio: 120000,
    ivaPct: 19,
  },
  {
    id: 'seed-3',
    nombre: 'Registro manual',
    descripcion: '',
    precio: 0,
    ivaPct: 0,
  },
];

// Lee productos del mismo LS que /contabilidad > Productos y servicios
function loadProductosLocal(): Producto[] {
  try {
    const raw = localStorage.getItem(PRODUCTOS_LS_KEY);
    if (!raw) return PRODUCTOS_SEED;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return PRODUCTOS_SEED;
    return parsed.map((p: any) => ({
      id: p.id ?? uid(),
      nombre: p.nombre ?? p.name ?? '',
      descripcion: p.descripcion ?? p.description ?? '',
      precio: Number(p.precio ?? p.price ?? 0),
      ivaPct: Number(p.ivaPct ?? p.iva ?? 0),
    }));
  } catch {
    return PRODUCTOS_SEED;
  }
}

function persistProductosLocal(prods: Producto[]) {
  try {
    localStorage.setItem(PRODUCTOS_LS_KEY, JSON.stringify(prods));
  } catch {
    /* ignore */
  }
}

// Clientes mock (fallback si API falla)
const CLIENTES_MOCK: Cliente[] = [
  {
    id: 'm-1',
    name: 'Cliente Genérico',
    identification: '222222222222',
    email: 'cliente@example.com',
  },
  {
    id: 'm-2',
    name: 'Juan Pérez',
    identification: '1020304050',
    email: 'juan@example.com',
    phone: '3001234567',
  },
  {
    id: 'm-3',
    name: 'Empresa S.A.S.',
    identification: '900123456',
    email: 'contacto@empresa.co',
  },
];

// ─────────────────────────────────────────────────────────────────────
// Autocomplete genérico (input + dropdown flotante)
// ─────────────────────────────────────────────────────────────────────

interface AutocompleteProps<T> {
  value: string;
  onChange: (v: string) => void;
  items: T[];
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | undefined;
  onSelect: (item: T) => void;
  onCreateNew?: (texto: string) => void;
  placeholder?: string;
  createLabel?: string;
  inputSize?: 'sm' | 'lg';
  innerInputClassName?: string;
}

function Autocomplete<T>({
  value,
  onChange,
  items,
  getLabel,
  getSubLabel,
  onSelect,
  onCreateNew,
  placeholder,
  createLabel = 'Crear',
  inputSize,
  innerInputClassName,
}: AutocompleteProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current && wrapRef.current.contains(t)) return;
      if (dropdownRef.current && dropdownRef.current.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 2, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const q = value.trim().toLowerCase();
  const filtered = q
    ? items.filter(it => {
        const label = getLabel(it).toLowerCase();
        const sub = getSubLabel ? (getSubLabel(it) || '').toLowerCase() : '';
        return label.includes(q) || sub.includes(q);
      })
    : items.slice(0, 30);

  return (
    <div ref={wrapRef} className="position-relative">
      <Input
        type="text"
        bsSize={inputSize}
        value={value}
        placeholder={placeholder}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={innerInputClassName}
      />
      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          className="bg-white border rounded shadow-sm"
          style={{
            position: 'fixed',
            zIndex: 99999,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 && !onCreateNew && (
            <div className="px-2 py-2 text-muted small">Sin resultados</div>
          )}
          {filtered.map((it, idx) => (
            <button
              key={idx}
              type="button"
              className="d-block w-100 text-start border-0 bg-transparent px-2 py-2 small"
              style={{ cursor: 'pointer' }}
              onMouseDown={e => {
                e.preventDefault();
                onSelect(it);
                setOpen(false);
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.background = '#f4f5f7')
              }
              onMouseLeave={e =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <div className="fw-medium">{getLabel(it)}</div>
              {getSubLabel && (
                <div className="text-muted" style={{ fontSize: 11 }}>
                  {getSubLabel(it)}
                </div>
              )}
            </button>
          ))}
          {onCreateNew && value.trim().length > 0 && (
            <button
              type="button"
              className="d-block w-100 text-start border-0 bg-transparent px-2 py-2 small text-primary border-top"
              style={{ cursor: 'pointer' }}
              onMouseDown={e => {
                e.preventDefault();
                onCreateNew(value.trim());
                setOpen(false);
              }}
            >
              <Plus size={12} className="me-1" /> {createLabel} "{value.trim()}"
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-modal: crear cliente
// ─────────────────────────────────────────────────────────────────────

interface CrearClienteModalProps {
  isOpen: boolean;
  toggle: () => void;
  initialName: string;
  onCreated: (c: Cliente) => void;
}

const CrearClienteModal: React.FC<CrearClienteModalProps> = ({
  isOpen,
  toggle,
  initialName,
  onCreated,
}) => {
  const [name, setName] = useState(initialName);
  const [nit, setNit] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setNit('');
      setEmail('');
      setPhone('');
      setErr(null);
    }
  }, [isOpen, initialName]);

  const save = async () => {
    if (!name.trim()) {
      setErr('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    setErr(null);
    const payload = {
      name: name.trim(),
      identification: nit.trim(),
      email: email.trim(),
      phone: phone.trim(),
      kind: 'CUSTOMER',
    };
    let nuevo: Cliente = { id: uid(), ...payload };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${env.API_URL}/accounting/third-parties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('POST no OK');
      const data = await res.json();
      nuevo = {
        id: data?.id ?? data?.thirdParty?.id ?? nuevo.id,
        name: data?.name ?? nuevo.name,
        identification:
          data?.identification ?? data?.nit ?? payload.identification,
        email: data?.email ?? payload.email,
        phone: data?.phone ?? payload.phone,
      };
    } catch {
      // Fallback localStorage — TODO: backend
      try {
        const raw = localStorage.getItem(CLIENTES_DRAFT_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        arr.push(nuevo);
        localStorage.setItem(CLIENTES_DRAFT_KEY, JSON.stringify(arr));
      } catch {
        /* ignore */
      }
    }
    setSaving(false);
    onCreated(nuevo);
    toggle();
  };

  return (
    <Modal
      isOpen={isOpen}
      toggle={toggle}
      centered
      zIndex={2050}
      backdropClassName="factura-submodal-backdrop"
    >
      <ModalHeader toggle={toggle}>Nuevo cliente</ModalHeader>
      <ModalBody>
        {err && <Alert color="danger">{err}</Alert>}
        <div className="small text-muted mb-3">
          Completa los datos mínimos. El cliente queda guardado en <strong>Terceros</strong> para próximas facturas.
          {' '}
          <a
            href="/contabilidad/config/terceros"
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none"
          >
            Ver listado completo <i className="ri-external-link-line" />
          </a>
        </div>
        <FormGroup>
          <Label className="small fw-medium">Nombre / Razón social *</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Acme SAS  /  Juan Pérez"
            autoFocus
          />
        </FormGroup>
        <FormGroup>
          <Label className="small fw-medium">NIT / Identificación</Label>
          <Input
            value={nit}
            onChange={e => setNit(e.target.value)}
            placeholder="Ej: 900123456-7  /  1020304050"
          />
        </FormGroup>
        <FormGroup>
          <Label className="small fw-medium">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="facturacion@empresa.co"
          />
        </FormGroup>
        <FormGroup>
          <Label className="small fw-medium">Teléfono</Label>
          <Input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Ej: 3001234567"
          />
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button color="light" onClick={toggle} disabled={saving}>
          Cancelar
        </Button>
        <Button color="primary" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cliente'}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Sub-modal: crear producto
// ─────────────────────────────────────────────────────────────────────

interface CrearProductoModalProps {
  isOpen: boolean;
  toggle: () => void;
  initialName: string;
  onCreated: (p: Producto) => void;
  accounts?: Array<{ code: string; name: string; account_type?: string }>;
}

const CrearProductoModal: React.FC<CrearProductoModalProps> = ({
  isOpen,
  toggle,
  initialName,
  onCreated,
  accounts = [],
}) => {
  const [nombre, setNombre] = useState(initialName);
  const [precio, setPrecio] = useState<string>('');
  const [ivaPct, setIvaPct] = useState<number>(19);
  const [cuentaPuc, setCuentaPuc] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNombre(initialName);
      setPrecio('');
      setIvaPct(19);
      setCuentaPuc('');
      setErr(null);
    }
  }, [isOpen, initialName]);

  const save = () => {
    if (!nombre.trim()) {
      setErr('El nombre es obligatorio');
      return;
    }
    const nuevo: Producto = {
      id: uid(),
      nombre: nombre.trim(),
      descripcion: cuentaPuc ? `PUC ${cuentaPuc}` : '',
      precio: Number(precio) || 0,
      ivaPct: Number(ivaPct) || 0,
    };
    // Guardamos también la cuenta PUC como campo extra aunque la interface Producto aún no la tipa.
    (nuevo as any).cuentaPuc = cuentaPuc.trim() || undefined;
    const actuales = loadProductosLocal();
    persistProductosLocal([...actuales, nuevo]);
    onCreated(nuevo);
    toggle();
  };

  return (
    <Modal
      isOpen={isOpen}
      toggle={toggle}
      centered
      zIndex={2050}
      backdropClassName="factura-submodal-backdrop"
    >
      <ModalHeader toggle={toggle}>Nuevo producto o servicio</ModalHeader>
      <ModalBody>
        {err && <Alert color="danger">{err}</Alert>}
        <div className="small text-muted mb-3">
          Queda guardado en tu catálogo de <strong>Productos y servicios</strong> (Inventario).
          {' '}
          <a
            href="/contabilidad/productos-servicios"
            target="_blank"
            rel="noopener noreferrer"
            className="text-decoration-none"
          >
            Ver catálogo completo <i className="ri-external-link-line" />
          </a>
        </div>
        <FormGroup>
          <Label className="small fw-medium">Nombre *</Label>
          <Input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Camiseta talla M  /  Asesoría contable (hora)"
            autoFocus
          />
        </FormGroup>
        <Row>
          <Col md={6}>
            <FormGroup>
              <Label className="small fw-medium">Precio</Label>
              <Input
                type="number"
                min={0}
                value={precio}
                onChange={e => setPrecio(e.target.value)}
                placeholder="Ej: 50000"
              />
            </FormGroup>
          </Col>
          <Col md={6}>
            <FormGroup>
              <Label className="small fw-medium">% IVA</Label>
              <Input
                type="select"
                value={ivaPct}
                onChange={e => setIvaPct(Number(e.target.value))}
              >
                {IVA_OPCIONES.map(v => (
                  <option key={v} value={v}>
                    {v === 0 ? 'Exento (0%)' : `${v}%`}
                  </option>
                ))}
              </Input>
            </FormGroup>
          </Col>
        </Row>
        <FormGroup>
          <Label className="small fw-medium">Cuenta PUC</Label>
          <PucPicker
            value={cuentaPuc}
            onChange={(code) => setCuentaPuc(code)}
            accounts={accounts}
            placeholder="Código PUC (ej. 14, 4135, 41350505)"
          />
          <div className="small text-muted mt-1">
            Escribí el código y elegí. Para ingresos se usa clase 4, pero podés elegir cualquier cuenta. Si no lo sabés, dejalo vacío y el contador lo asigna después.
          </div>
        </FormGroup>
      </ModalBody>
      <ModalFooter>
        <Button color="light" onClick={toggle}>
          Cancelar
        </Button>
        <Button color="primary" onClick={save}>
          Guardar producto o servicio
        </Button>
      </ModalFooter>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────

const FacturaNuevaModal: React.FC<FacturaNuevaModalProps> = ({
  isOpen,
  toggle,
  onSaved,
}) => {
  const navigate = useNavigate();

  // Rango de facturación y estado empresa — viene del backend al abrir el modal.
  // `null` = aún cargando; una vez resuelto, decide si mostrar aviso DIAN.
  const [facturasUsadas, setFacturasUsadas] = useState<number>(0);
  const [facturasLimite, setFacturasLimite] = useState<number>(0);
  const [datosEmpresaCompletos, setDatosEmpresaCompletos] = useState<boolean | null>(null);
  // Si tiene resolución DIAN en Alegra, el número se autogenera al emitir.
  // Si no, queda manual y mostramos aviso en el campo Número.
  const [tieneResolucionDian, setTieneResolucionDian] = useState<boolean>(false);
  const [resolucionPrefix, setResolucionPrefix] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const dec: any = getDecodedToken();
    const tenantId = dec?.user?.tenant_id || dec?.tenant_id;
    if (!tenantId) {
      setDatosEmpresaCompletos(true); // no hay tenant, no molestar con el aviso
      return;
    }
    (async () => {
      try {
        // Timeout 5s — si backend no responde, no bloqueamos al usuario con el aviso
        const { data } = await api.get(`/tenants/${tenantId}`, { timeout: 5000 });
        const t = data?.tenant || data || {};
        // Sólo marcamos incompleto si el backend lo dice explícitamente
        // (bandera `setup_complete` / `profile_complete`). Si la bandera no
        // viene o es truthy, asumimos completo — evitamos falsos positivos
        // por diferencias de nombres de campo entre tenants.
        const flag = t?.setup_complete ?? t?.profile_complete ?? t?.company_profile_complete;
        const complete = flag === false ? false : true;
        setDatosEmpresaCompletos(complete);
        // Rango/consumo de facturación si el backend lo trae
        const used = Number(t?.invoices_used ?? t?.facturas_usadas ?? 0);
        const limit = Number(t?.invoices_limit ?? t?.facturas_limite ?? 0);
        if (Number.isFinite(used)) setFacturasUsadas(used);
        if (Number.isFinite(limit)) setFacturasLimite(limit);

      } catch {
        // Si el endpoint falla (ej. backend caído), no bloqueamos al usuario con el aviso.
        setDatosEmpresaCompletos(true);
      }

      // ── Estado DIAN: misma fuente que /contabilidad/dian y ConfigFacturacion
      //    Endpoint confiable: GET /alegra/invoicing-status
      //    Campos estables: companyRegistered, testSetStatus, resolutionConfigured
      try {
        const { data } = await api.get('/alegra/invoicing-status', { timeout: 5000 });
        const s: any = data || {};

        // feReady igual que lo evalúa DianStatus.tsx
        const feReady = Boolean(
          s?.companyRegistered &&
          (s?.testSetStatus === 'APROBADO' || s?.testSetStatus === 'APPROVED') &&
          s?.resolutionConfigured,
        );

        // Aceptar también flags sueltos para tenants viejos/distintos
        const readyFallback = Boolean(
          s?.ready ||
          s?.readyToInvoice ||
          s?.dianApproved ||
          s?.status === 'ready' ||
          s?.status === 'approved',
        );

        const configurada = feReady || readyFallback;

        // Intentar extraer prefijo si viene en la respuesta
        const prefijo = String(
          s?.activeResolution?.prefix ||
          s?.resolution?.prefix ||
          s?.prefix ||
          '',
        );

        setTieneResolucionDian(configurada);
        setResolucionPrefix(prefijo);

        // Si no vino el prefix en el status, intenta /alegra/resolutions como best-effort
        // (endpoint a veces devuelve 400 para algunos tenants — lo ignoramos silenciosamente).
        if (configurada && !prefijo) {
          try {
            const { data: listData } = await api.get('/alegra/resolutions', { timeout: 5000 });
            const list: any[] = listData?.resolutions || listData?.data || (Array.isArray(listData) ? listData : []);
            const first = list.find((r: any) => r?.prefix);
            if (first?.prefix) setResolucionPrefix(String(first.prefix));
          } catch {
            /* 400/404 — ignorar */
          }
        }
      } catch {
        setTieneResolucionDian(false);
        setResolucionPrefix('');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── State: header del documento
  const [tipo, setTipo] = useState<TipoDocumento>('Factura venta');
  const [numero, setNumero] = useState<string>('');
  const [fecha, setFecha] = useState<string>(hoyISO());
  // Clase de factura: ELECTRONICA (va a DIAN) o INTERNA (solo consecutivo interno)
  const [invoiceClass, setInvoiceClass] = useState<'ELECTRONICA' | 'INTERNA'>('ELECTRONICA');
  const [internalNextPreview, setInternalNextPreview] = useState<string>('');
  // Prefijo manual (cuando NO hay resolución DIAN; si la hay, viene de resolucionPrefix)
  const [prefijoManual, setPrefijoManual] = useState<string>('');
  // Nº orden interna (compra/pedido) y tipo de operación DIAN
  const [ordenInterna, setOrdenInterna] = useState<string>('');
  const [tipoOperacionDian, setTipoOperacionDian] = useState<string>('10');

  // ── Consecutivo siguiente según clase (sólo cuando el modal está abierto)
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const { data } = await api.get(`/invoices/next-number?class=${invoiceClass}`, { timeout: 5000 });
        if (data?.success) {
          if (invoiceClass === 'INTERNA') {
            const preview = data.preview || `${data.prefix || ''}-${data.nextNumber || ''}`.replace(/^-/, '');
            setInternalNextPreview(preview);
            // Pre-rellena número solo si está vacío (no pisa lo que el usuario escribe)
            setNumero(prev => (prev ? prev : preview));
          } else {
            setInternalNextPreview('');
          }
        }
      } catch {
        setInternalNextPreview('');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceClass, isOpen]);

  // Cliente
  const [clienteText, setClienteText] = useState<string>('');
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [contacto, setContacto] = useState<string>('');
  const [clientesRemoto, setClientesRemoto] = useState<Cliente[]>([]);

  // Sub-modales
  const [crearClienteOpen, setCrearClienteOpen] = useState(false);
  const [crearClienteSeed, setCrearClienteSeed] = useState('');
  const [crearProductoOpen, setCrearProductoOpen] = useState(false);
  const [crearProductoSeed, setCrearProductoSeed] = useState('');
  const [crearProductoLineaId, setCrearProductoLineaId] = useState<string | null>(
    null,
  );

  // Líneas
  const [lineas, setLineas] = useState<LineaFactura[]>([emptyLinea()]);

  // Forma de pago: Contado vs Crédito
  const [paymentForm, setPaymentForm] = useState<'Contado' | 'Credito'>('Contado');
  const [creditTermDays, setCreditTermDays] = useState<number>(30);

  // Formas de pago
  const [formasPago, setFormasPago] = useState<FormaPago[]>([emptyFormaPago()]);

  // Observaciones y adjunto
  const [observaciones, setObservaciones] = useState('');
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Logo de la factura (se muestra en preview / PDF)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('');
  const logoRef = useRef<HTMLInputElement | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(false);

  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen (PNG, JPG, SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El logo no puede pesar más de 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCompanyLogoUrl(String(reader.result || ''));
      toast.success('Logo cargado.');
    };
    reader.onerror = () => toast.error('No se pudo leer el archivo.');
    reader.readAsDataURL(file);
  };

  const useSettingsLogo = async () => {
    setLoadingLogo(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Sin sesión activa.');
        return;
      }
      const decoded = getDecodedToken();
      const tenantId = decoded?.user?.tenant_id;
      if (!tenantId) {
        toast.error('Tenant no identificado.');
        return;
      }
      const res = await fetch(`${env.API_URL}/tenants/${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const url = data?.logo_url || data?.tenant?.logo_url || '';
      if (url) {
        const fullUrl = url.startsWith('http') ? url : `${env.API_URL.replace(/\/api.*/, '')}${url}`;
        setCompanyLogoUrl(fullUrl);
        toast.success('Logo de la empresa cargado.');
      } else {
        toast.info('No hay logo configurado en Datos de la Empresa.');
      }
    } catch (e: any) {
      toast.error('No se pudo traer el logo: ' + (e?.message || ''));
    } finally {
      setLoadingLogo(false);
    }
  };

  // UI / envío
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Productos locales
  const [productosLocal, setProductosLocal] = useState<Producto[]>(() =>
    loadProductosLocal(),
  );

  // PUC (cuentas contables) — para asociar al crear producto
  const [accountsPuc, setAccountsPuc] = useState<Array<{ code: string; name: string; account_type?: string }>>([]);
  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${env.API_URL}/accounting/chart-of-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        const list = data?.accounts || data?.chartOfAccounts || data?.data || [];
        if (Array.isArray(list)) {
          setAccountsPuc(
            list.map((a: any) => ({
              code: String(a.code || a.account_code || ''),
              name: String(a.name || a.account_name || ''),
              account_type: a.account_type,
            })).filter((a: any) => a.code),
          );
        }
      })
      .catch(() => setAccountsPuc([]));
  }, [isOpen]);

  // ── Carga de clientes (remoto)
  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setClientesRemoto(CLIENTES_MOCK);
      return;
    }
    fetch(`${env.API_URL}/accounting/third-parties?kind=CUSTOMER`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => {
        const arr = (data?.thirdParties || data?.items || data || []) as any[];
        if (Array.isArray(arr) && arr.length > 0) {
          setClientesRemoto(
            arr.map(c => ({
              id: c.id,
              name: c.name || '',
              identification: c.identification || c.nit,
              nit: c.nit,
              email: c.email,
              phone: c.phone,
            })),
          );
        } else {
          setClientesRemoto(CLIENTES_MOCK);
        }
      })
      .catch(() => setClientesRemoto(CLIENTES_MOCK));
  }, [isOpen]);

  // ── Recuperar/limpiar draft
  useEffect(() => {
    if (!isOpen) return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && typeof draft === 'object') {
        setTipo(draft.tipo || 'Factura venta');
        setNumero(draft.numero || '');
        setFecha(draft.fecha || hoyISO());
        setPrefijoManual(draft.prefijoManual || '');
        setOrdenInterna(draft.ordenInterna || '');
        setTipoOperacionDian(draft.tipoOperacionDian || '10');
        setClienteText(draft.clienteText || '');
        setClienteSel(draft.clienteSel || null);
        setContacto(draft.contacto || '');
        setLineas(
          Array.isArray(draft.lineas) && draft.lineas.length > 0
            ? draft.lineas
            : [emptyLinea()],
        );
        setFormasPago(
          Array.isArray(draft.formasPago) && draft.formasPago.length > 0
            ? draft.formasPago
            : [emptyFormaPago()],
        );
        setObservaciones(draft.observaciones || '');
        try {
          toast.info('Borrador recuperado');
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, [isOpen]);

  // ── Persistir draft con debounce
  const draftTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    if (!dirty) return;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            tipo,
            numero,
            fecha,
            prefijoManual,
            ordenInterna,
            tipoOperacionDian,
            clienteText,
            clienteSel,
            contacto,
            lineas,
            formasPago,
            observaciones,
          }),
        );
      } catch {
        /* ignore */
      }
    }, 300);
    return () => {
      if (draftTimer.current) window.clearTimeout(draftTimer.current);
    };
  }, [
    isOpen,
    dirty,
    tipo,
    numero,
    fecha,
    prefijoManual,
    ordenInterna,
    tipoOperacionDian,
    clienteText,
    clienteSel,
    contacto,
    lineas,
    formasPago,
    observaciones,
  ]);

  const markDirty = () => {
    if (!dirty) setDirty(true);
  };

  // ── Totales
  const totales = useMemo(() => {
    let bruto = 0;
    let descTotal = 0;
    let ivaTotal = 0;
    let rfTotal = 0;
    lineas.forEach(l => {
      const lb = (Number(l.cantidad) || 0) * (Number(l.valorUnit) || 0);
      const ld = lb * ((Number(l.descPct) || 0) / 100);
      const base = lb - ld;
      bruto += lb;
      descTotal += ld;
      ivaTotal += base * ((Number(l.ivaPct) || 0) / 100);
      rfTotal += base * ((Number(l.rfPct) || 0) / 100);
    });
    const subtotal = bruto - descTotal;
    const neto = subtotal + ivaTotal - rfTotal;
    const formasTotal = formasPago.reduce(
      (acc, f) => acc + (Number(f.monto) || 0),
      0,
    );
    return {
      bruto,
      descTotal,
      subtotal,
      ivaTotal,
      rfTotal,
      neto,
      formasTotal,
    };
  }, [lineas, formasPago]);

  // ── Handlers líneas
  const updateLinea = (id: string, patch: Partial<LineaFactura>) => {
    markDirty();
    setLineas(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };
  const addLinea = () => {
    markDirty();
    setLineas(prev => [...prev, emptyLinea()]);
  };
  const removeLinea = (id: string) => {
    markDirty();
    setLineas(prev => (prev.length <= 1 ? prev : prev.filter(l => l.id !== id)));
  };

  // ── Handlers formas de pago
  const updateFormaPago = (id: string, patch: Partial<FormaPago>) => {
    markDirty();
    setFormasPago(prev =>
      prev.map(f => (f.id === id ? { ...f, ...patch } : f)),
    );
  };
  const addFormaPago = () => {
    markDirty();
    setFormasPago(prev => [...prev, emptyFormaPago()]);
  };
  const removeFormaPago = (id: string) => {
    markDirty();
    setFormasPago(prev => prev.filter(f => f.id !== id));
  };

  // ── Selección cliente
  const onSelectCliente = (c: Cliente) => {
    markDirty();
    setClienteSel(c);
    setClienteText(c.name);
    setContacto(c.email || c.phone || '');
  };
  const onCreateCliente = (texto: string) => {
    setCrearClienteSeed(texto);
    setCrearClienteOpen(true);
  };
  const onClienteCreated = (c: Cliente) => {
    onSelectCliente(c);
  };

  // ── Selección producto (por línea)
  const onSelectProducto = (lineaId: string, p: Producto) => {
    updateLinea(lineaId, {
      productoNombre: p.nombre,
      descripcion: p.descripcion || '',
      valorUnit: p.precio,
      ivaPct: p.ivaPct,
    });
  };
  const onCreateProducto = (lineaId: string, texto: string) => {
    setCrearProductoLineaId(lineaId);
    setCrearProductoSeed(texto);
    setCrearProductoOpen(true);
  };
  const onProductoCreated = (p: Producto) => {
    setProductosLocal(prev => [...prev, p]);
    if (crearProductoLineaId) {
      onSelectProducto(crearProductoLineaId, p);
    }
    setCrearProductoLineaId(null);
  };

  // ── Cancelar (con confirm SweetAlert si hay cambios sin guardar)
  const handleCancel = async () => {
    if (dirty) {
      const result = await Swal.fire({
        icon: 'question',
        title: '¿Descartar cambios?',
        text: 'Hay cambios sin guardar en la factura.',
        showCancelButton: true,
        confirmButtonText: 'Sí, descartar',
        cancelButtonText: 'Seguir editando',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#1A1D1F',
      });
      if (!result.isConfirmed) return;
    }
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setDirty(false);
    toggle();
  };

  // ── Submit
  const buildPayload = (status: 'BORRADOR' | 'EMITIDA') => {
    // Datos del cliente (estructurados, compatibles con el shape que espera alegraController.createInvoice)
    const clienteId = clienteSel?.identification || clienteSel?.nit || '';
    const clienteNombre = clienteSel?.name || clienteText || '';
    const clienteEmail = clienteSel?.email || (contacto.includes('@') ? contacto : '') || '';
    const clienteTel = clienteSel?.phone || (!contacto.includes('@') ? contacto : '') || '';

    // Heurística: si el documento tiene >= 9 dígitos o contiene '-', probablemente es NIT.
    // Default 'CC' para match con FacturaTab que funciona en producción.
    const rawId = String(clienteId || '');
    const onlyDigits = rawId.replace(/\D/g, '');
    const looksLikeNit = rawId.includes('-') || onlyDigits.length >= 9;
    const docType: string = looksLikeNit ? 'NIT' : 'CC';

    return {
      // Modo prueba (backend lo espera como boolean)
      isTestMode: false,

      // Número — ambos nombres para compat
      number: numero || '',
      invoice_number: numero || '',

      // Customer — shape Alegra con address estructurado.
      // Ciudad y departamento deben ser CÓDIGOS DIAN numéricos (5 y 2 dígitos),
      // no nombres. La DIAN rechaza con "not one of enum values" si mandamos "Bogotá".
      // 11001 = Bogotá D.C. | 11 = Departamento Bogotá D.C.
      customer: {
        identification: clienteId || '000000',
        dv: '',
        name: clienteNombre || 'Cliente genérico',
        email: clienteEmail || 'sin-email@example.com',
        phone: clienteTel || '0000000',
        identificationType: docType,
        address: {
          address: 'No especificada',
          city: '11001',        // Bogotá D.C. — código DIAN
          department: '11',     // Bogotá D.C. — código departamento DIAN
          country: 'CO',
        },
      },

      // Flat fields para la DB local — NUNCA null, nunca empty string.
      clientName: clienteNombre || 'Cliente genérico',
      clientDocType: docType,
      clientNit: clienteId || '000000',
      email: clienteEmail || 'sin-email@example.com',
      clientAddress: 'No especificada',
      clientCity: '11001',
      clientDepartment: '11',
      clientPhone: clienteTel || '0000000',

      // Items — TODOS los campos numéricos garantizados no-NaN (backend clasifica y usa `|| fallback`).
      // Se envían los nombres que espera `classifyDocumentItems`: lineBase, discountVal, taxVal, lineTotal.
      items: lineas.map(l => {
        const qty = Number.isFinite(Number(l.cantidad)) ? Number(l.cantidad) : 1;
        const unitPrice = Number.isFinite(Number(l.valorUnit)) ? Number(l.valorUnit) : 0;
        const descPct = Number.isFinite(Number(l.descPct)) ? Number(l.descPct) : 0;
        const taxPct = Number.isFinite(Number(l.ivaPct)) ? Number(l.ivaPct) : 0;
        const rfPct = Number.isFinite(Number(l.rfPct)) ? Number(l.rfPct) : 0;
        const lineSubtotal = qty * unitPrice;
        const discountAmount = lineSubtotal * (descPct / 100);
        const taxableAmount = lineSubtotal - discountAmount;
        const taxAmount = taxableAmount * (taxPct / 100);
        const rfAmount = taxableAmount * (rfPct / 100);
        const totalLine = taxableAmount + taxAmount - rfAmount;

        const name = (l.productoNombre || '').trim() || 'Ítem sin nombre';
        const desc = (l.descripcion || '').trim() || name;

        return {
          // Nombres "comerciales" del item
          item: name,
          name: name,
          description: desc,
          reference: '',
          // Cantidades y precios
          quantity: qty,
          unitPrice: unitPrice,
          price: unitPrice,
          // Porcentajes
          discount: descPct,
          tax: taxPct,
          taxRate: taxPct,
          // Montos calculados — nombres `*Val` que espera classifyDocumentItems + alias tradicionales
          lineBase: taxableAmount,
          discountVal: discountAmount,
          taxVal: taxAmount,
          taxAmount: taxAmount,
          subtotal: lineSubtotal,
          total: totalLine,
          totalLine: totalLine,
          lineTotal: totalLine,
          retentionRate: rfPct,
          retentionAmount: rfAmount,
        };
      }),

      // Totales (ambos nombres para compat)
      subtotal: Number(totales.subtotal) || 0,
      taxAmount: Number(totales.ivaTotal) || 0,
      tax_amount: Number(totales.ivaTotal) || 0,
      discount: Number(totales.descTotal) || 0,
      total: Number(totales.neto) || 0,

      // Totales extendidos (FacturaTab los enviaba — nunca null)
      grossValue: Number(totales.bruto) || 0,
      impoConsumo: 0,
      reteFuente: Number(totales.rfTotal) || 0,
      reteIvaRate: 0,
      reteIva: 0,
      icaRate: 0,
      reteIca: 0,
      advances: [] as any[],
      advancesTotal: 0,

      // Formas de pago (vacío cuando crédito para que no se genere recibo)
      paymentMethods: paymentForm === 'Contado'
        ? formasPago.map(f => ({ method: f.metodo, amount: Number(f.monto) || 0 }))
        : [],
      paymentMethodsTotal: paymentForm === 'Contado' ? (Number(totales.formasTotal) || 0) : 0,

      // Adjunto
      attachmentName: adjunto?.name || '',

      // Fechas — el backend espera `date` y `dueDate`
      date: fecha,
      dueDate: (() => {
        if (paymentForm === 'Contado') return fecha;
        const d = new Date(fecha);
        if (isNaN(d.getTime())) return fecha;
        d.setDate(d.getDate() + (Number(creditTermDays) || 30));
        return d.toISOString().slice(0, 10);
      })(),

      // Header extendido (Siigo) — default string vacío
      branchId: '',
      orderPrefix:
        invoiceClass === 'ELECTRONICA' && tieneResolucionDian
          ? (resolucionPrefix || '')
          : (prefijoManual || ''),
      orderNumber: ordenInterna || '',
      orderDate: '',
      operationType: tipoOperacionDian || '10',
      negotiationPlace: '',
      taxFreeDay: false,
      inventoryExit: false,
      registerPayment: false,

      // Forma de pago singular (el backend a veces la espera)
      // Si es Crédito, pasamos "Credito" para que el auto-recibo NO se dispare.
      paymentMethod: paymentForm === 'Credito' ? 'Credito' : (formasPago[0]?.metodo || 'Efectivo'),
      payment_method: paymentForm === 'Credito' ? 'Credito' : (formasPago[0]?.metodo || 'Efectivo'),
      paymentMeanCode: 10,
      paymentMeans: 10,
      paymentForm,                                            // Contado | Credito
      creditTermDays: paymentForm === 'Credito' ? Number(creditTermDays) || 30 : 0,

      // Notes / terms
      notes: observaciones || '',
      terms: '',

      // Extras propios
      documentType: tipo,
      externalNumber: numero || '',
      // Clase de factura: ELECTRONICA | INTERNA (decide envío a DIAN y secuencia)
      invoiceClass,
      status,
    };
  };

  const doSubmit = async (status: 'BORRADOR' | 'EMITIDA') => {
    if (!clienteSel && !clienteText.trim()) {
      setSubmitError('Selecciona o ingresa un cliente.');
      return;
    }
    if (lineas.length === 0 || lineas.every(l => !l.productoNombre.trim())) {
      setSubmitError('Agrega al menos una línea con producto.');
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      // Usar api.post (axios con interceptors) — mismo patrón que FacturaTab
      const { data } = await api.post('/alegra/invoices', buildPayload(status));
      if (data && data.success === false) {
        throw new Error(data.error || 'Error al guardar la factura');
      }
      const num =
        data?.invoice?.invoiceNumber ||
        data?.invoice_number ||
        numero ||
        'sin número';
      try {
        toast.success(`Factura ${num} guardada`);
      } catch {
        // eslint-disable-next-line no-alert
        alert(`Factura ${num} guardada`);
      }
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setDirty(false);
      onSaved?.(data);
      toggle();
    } catch (e: any) {
      // Capturar el mensaje real del backend, no solo "500"
      const respData = e?.response?.data;
      const respStatus = e?.response?.status;
      const serverMsg =
        respData?.error ||
        respData?.message ||
        (Array.isArray(respData?.errors) ? respData.errors[0]?.message : null) ||
        (typeof respData === 'string' ? respData : null);
      const detail = serverMsg ||
        (respStatus ? `Error ${respStatus} del servidor` : null) ||
        e?.message ||
        'No se pudo conectar con el servidor. Reintenta.';
      setSubmitError(detail);
      // Log completo a consola para debugging en DevTools
      console.error('[FacturaNuevaModal] Error al guardar:', {
        status: respStatus,
        data: respData,
        message: e?.message,
        full: e,
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Reset al cerrar (siguiente apertura limpia si no hay draft)
  const resetAll = useCallback(() => {
    setTipo('Factura venta');
    setNumero('');
    setFecha(hoyISO());
    setInvoiceClass('ELECTRONICA');
    setInternalNextPreview('');
    setPrefijoManual('');
    setOrdenInterna('');
    setTipoOperacionDian('10');
    setClienteText('');
    setClienteSel(null);
    setContacto('');
    setLineas([emptyLinea()]);
    setFormasPago([emptyFormaPago()]);
    setObservaciones('');
    setAdjunto(null);
    setSubmitError(null);
    setDirty(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      // Solo resetea si NO hay draft (si hay, al re-abrir lo cargamos)
      try {
        if (!sessionStorage.getItem(DRAFT_KEY)) resetAll();
      } catch {
        resetAll();
      }
    }
  }, [isOpen, resetAll]);

  // Las formas de pago ya no se capturan en la factura (se hacen en Recibo de Caja).
  const formasMenorQueNeto = false;

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .factura-submodal-backdrop { z-index: 2040 !important; }
      `}</style>
      <Offcanvas
        isOpen={isOpen}
        toggle={handleCancel}
        direction="end"
        backdrop="static"
        scrollable
        style={{ width: '90vw', maxWidth: 1100 }}
      >
        <OffcanvasHeader toggle={handleCancel} className="border-bottom">
          <div className="d-flex flex-column">
            <div className="fw-semibold">
              Nueva factura de venta{' '}
              <span className="text-muted fw-normal">/ Ingresos</span>
            </div>
            <div className="small text-muted mt-1">
              Tus facturas usadas:{' '}
              <strong>
                {facturasUsadas} de {facturasLimite}
              </strong>
            </div>
          </div>
        </OffcanvasHeader>

        <OffcanvasBody className="d-flex flex-column p-0">
          {/* ── Scrollable form body ── */}
          <div className="flex-grow-1 overflow-auto p-3">
          {datosEmpresaCompletos === false && (
            <Alert
              color="warning"
              className="d-flex align-items-center gap-2 mb-3"
            >
              <AlertTriangle size={16} />
              <div className="flex-grow-1 small">
                Completa la información faltante en <strong>Datos de la
                Empresa</strong> para cumplir con los requisitos DIAN.
              </div>
              <Button
                size="sm"
                color="warning"
                outline
                onClick={() => {
                  toggle();
                  navigate('/contabilidad/config/empresa');
                }}
              >
                Completar
              </Button>
            </Alert>
          )}

          {submitError && (
            <Alert color="danger" className="d-flex align-items-start gap-2">
              <AlertTriangle size={16} className="mt-1 flex-shrink-0" />
              <div className="flex-grow-1 small">
                <div className="fw-semibold mb-1">No se pudo guardar</div>
                <div>{submitError}</div>
              </div>
              <Button
                size="sm"
                color="danger"
                onClick={() => doSubmit('EMITIDA')}
                disabled={saving}
              >
                Reintentar
              </Button>
            </Alert>
          )}

          <Form>
            {/* ── Header del documento — fila 1: identidad/tipo ── */}
            <Row className="g-3">
              <Col md={3}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium">Logo de la factura</Label>
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleLogoFile(f);
                      // reset so same file can be picked again
                      if (logoRef.current) logoRef.current.value = '';
                    }}
                  />
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    {companyLogoUrl && (
                      <img
                        src={companyLogoUrl}
                        alt="Logo"
                        style={{ height: 36, width: 'auto', maxWidth: 120, objectFit: 'contain', border: '1px solid #e5e5e5', borderRadius: 6, padding: 2 }}
                      />
                    )}
                    <Button
                      size="sm"
                      color="light"
                      type="button"
                      className="d-inline-flex align-items-center gap-1"
                      onClick={() => logoRef.current?.click()}
                      disabled={loadingLogo}
                    >
                      <Upload size={14} /> {companyLogoUrl ? 'Cambiar' : 'Subir'}
                    </Button>
                    {companyLogoUrl && (
                      <Button
                        size="sm"
                        color="link"
                        type="button"
                        className="p-0 small text-danger text-decoration-none"
                        onClick={() => setCompanyLogoUrl('')}
                        title="Quitar el logo"
                      >
                        Quitar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      color="link"
                      type="button"
                      className="p-0 small text-decoration-none"
                      onClick={useSettingsLogo}
                      disabled={loadingLogo}
                      title="Traer el logo configurado en Datos de la Empresa"
                    >
                      {loadingLogo ? 'Cargando…' : 'o usar el de Settings'}
                    </Button>
                  </div>
                  <div className="small text-muted mt-1" style={{ fontSize: 11 }}>
                    PNG, JPG, SVG o WebP · máx. 2 MB.
                  </div>
                </FormGroup>
              </Col>
              <Col md={3}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium">Tipo</Label>
                  <Input
                    type="select"
                    value={tipo}
                    onChange={e => {
                      markDirty();
                      setTipo(e.target.value as TipoDocumento);
                    }}
                  >
                    <option>Factura venta</option>
                    <option>Factura POS</option>
                    <option>Factura exportación</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md={3}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium">¿Factura electrónica?</Label>
                  <div className="d-flex gap-3 pt-1">
                    <label className="d-inline-flex align-items-center gap-1 mb-0" style={{ cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="invoiceClass"
                        checked={invoiceClass === 'ELECTRONICA'}
                        onChange={() => {
                          markDirty();
                          setInvoiceClass('ELECTRONICA');
                          setNumero('');
                        }}
                      />
                      <span className="small">Sí (DIAN)</span>
                    </label>
                    <label className="d-inline-flex align-items-center gap-1 mb-0" style={{ cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="invoiceClass"
                        checked={invoiceClass === 'INTERNA'}
                        onChange={() => {
                          markDirty();
                          setInvoiceClass('INTERNA');
                          setNumero('');
                        }}
                      />
                      <span className="small">No (interna)</span>
                    </label>
                  </div>
                  <div className="small text-muted mt-1" style={{ fontSize: 11 }}>
                    {invoiceClass === 'INTERNA'
                      ? 'No se envía a DIAN. Consecutivo interno.'
                      : 'Se envía a DIAN (si la resolución está activa).'}
                  </div>
                </FormGroup>
              </Col>
              <Col md={3}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium">Tipo de operación (DIAN)</Label>
                  <Input
                    type="select"
                    value={tipoOperacionDian}
                    onChange={e => {
                      markDirty();
                      setTipoOperacionDian(e.target.value);
                    }}
                  >
                    <option value="10">10 — Estándar</option>
                    <option value="09">09 — AIU</option>
                    <option value="11">11 — Mandatos</option>
                    <option value="12">12 — Transporte</option>
                    <option value="13">13 — Cambiario</option>
                  </Input>
                  <div className="small text-muted mt-1" style={{ fontSize: 11 }}>
                    Código DIAN del tipo de operación.
                  </div>
                </FormGroup>
              </Col>
            </Row>

            {/* ── Header del documento — fila 2: numeración y orden ── */}
            <Row className="g-3 mt-1">
              <Col md={2}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium">Prefijo</Label>
                  <Input
                    value={
                      invoiceClass === 'ELECTRONICA' && tieneResolucionDian
                        ? resolucionPrefix
                        : prefijoManual
                    }
                    onChange={e => {
                      markDirty();
                      setPrefijoManual(e.target.value.toUpperCase());
                    }}
                    placeholder="FV"
                    disabled={invoiceClass === 'ELECTRONICA' && tieneResolucionDian}
                    title={
                      invoiceClass === 'ELECTRONICA' && tieneResolucionDian
                        ? 'Prefijo viene de la resolución DIAN'
                        : 'Prefijo del documento (ej. FV, FE, NC)'
                    }
                  />
                </FormGroup>
              </Col>
              <Col md={3}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium d-flex justify-content-between align-items-center">
                    <span>Número</span>
                    {invoiceClass === 'INTERNA' ? (
                      <span className="badge bg-info-subtle text-info" style={{ fontSize: 10 }}>
                        <i className="ri-file-list-line me-1" />
                        Interno
                      </span>
                    ) : tieneResolucionDian ? (
                      <span className="badge bg-success-subtle text-success" style={{ fontSize: 10 }}>
                        <i className="ri-government-line me-1" />
                        Auto DIAN
                      </span>
                    ) : (
                      <span className="badge bg-warning-subtle text-warning" style={{ fontSize: 10 }} title="Sin resolución DIAN — número manual">
                        <i className="ri-edit-line me-1" />
                        Manual
                      </span>
                    )}
                  </Label>
                  <Input
                    placeholder={
                      invoiceClass === 'INTERNA'
                        ? (internalNextPreview || 'Se asigna automáticamente')
                        : tieneResolucionDian
                          ? `${resolucionPrefix ? resolucionPrefix + ' — ' : ''}Alegra asigna al emitir`
                          : 'Escribe el número'
                    }
                    value={numero}
                    onChange={e => {
                      markDirty();
                      setNumero(e.target.value);
                    }}
                    disabled={invoiceClass === 'ELECTRONICA' && tieneResolucionDian}
                    title={
                      invoiceClass === 'INTERNA'
                        ? 'Consecutivo interno — se autogenera si lo dejas vacío'
                        : tieneResolucionDian
                          ? `Tenés resolución DIAN activa${resolucionPrefix ? ` (prefijo ${resolucionPrefix})` : ''}. El consecutivo se asigna al emitir.`
                          : 'Sin resolución DIAN configurada — escribe el número manualmente'
                    }
                  />
                  {invoiceClass === 'INTERNA' ? (
                    <div className="small text-info mt-1" style={{ fontSize: 11 }}>
                      <i className="ri-information-line me-1" />
                      Siguiente: {internalNextPreview || 'se asigna al guardar'}
                    </div>
                  ) : tieneResolucionDian ? (
                    <div className="small text-success mt-1" style={{ fontSize: 11 }}>
                      <i className="ri-check-line me-1" />
                      Resolución DIAN activa{resolucionPrefix ? ` (prefijo ${resolucionPrefix})` : ''}.
                    </div>
                  ) : (
                    <div className="small text-muted mt-1" style={{ fontSize: 11 }}>
                      Sin resolución DIAN — <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline small text-decoration-none"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          toggle();
                          navigate('/contabilidad/config/facturacion-electronica');
                        }}
                      >configurar</button>
                    </div>
                  )}
                </FormGroup>
              </Col>
              <Col md={3}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium">Fecha de elaboración</Label>
                  <Input
                    type="date"
                    lang="es-CO"
                    value={fecha}
                    onChange={e => {
                      markDirty();
                      setFecha(e.target.value);
                    }}
                  />
                  <div className="small text-muted mt-1" style={{ fontSize: 11 }}>
                    Formato: dd/mm/aaaa
                  </div>
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium">Nº orden interna</Label>
                  <Input
                    value={ordenInterna}
                    onChange={e => {
                      markDirty();
                      setOrdenInterna(e.target.value);
                    }}
                    placeholder="Ej: OC-001234"
                  />
                  <div className="small text-muted mt-1" style={{ fontSize: 11 }}>
                    Orden de compra / pedido (opcional).
                  </div>
                </FormGroup>
              </Col>
            </Row>

            {/* ── Header del documento — fila 3: cliente y contacto ── */}
            <Row className="g-3 mt-1">
              <Col md={8}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium">Cliente</Label>
                  <div className="d-flex align-items-stretch gap-2">
                    <div className="flex-grow-1">
                      <Autocomplete<Cliente>
                        value={clienteText}
                        onChange={v => {
                          markDirty();
                          setClienteText(v);
                          if (clienteSel && v !== clienteSel.name) {
                            setClienteSel(null);
                          }
                        }}
                        items={clientesRemoto}
                        getLabel={c => c.name}
                        getSubLabel={c =>
                          [c.identification || c.nit, c.email]
                            .filter(Boolean)
                            .join(' • ')
                        }
                        onSelect={onSelectCliente}
                        onCreateNew={onCreateCliente}
                        createLabel="Crear cliente"
                        placeholder="Buscar cliente por nombre..."
                      />
                    </div>
                    <Button
                      color="light"
                      type="button"
                      className="d-inline-flex align-items-center gap-1 flex-shrink-0"
                      style={{ whiteSpace: 'nowrap' }}
                      title="Crear cliente nuevo (va a Terceros)"
                      onClick={() => onCreateCliente(clienteText || '')}
                    >
                      <Plus size={14} /> Nuevo
                    </Button>
                  </div>
                </FormGroup>
              </Col>
              <Col md={4}>
                <FormGroup className="mb-0">
                  <Label className="small fw-medium">Contacto</Label>
                  <Input
                    placeholder="Email o teléfono"
                    value={contacto}
                    onChange={e => {
                      markDirty();
                      setContacto(e.target.value);
                    }}
                  />
                </FormGroup>
              </Col>
            </Row>

            <hr className="my-4" />

            {/* ── Tabla de líneas ── */}
            <div className="table-responsive">
              <Table className="align-middle mb-2" size="sm">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th style={{ minWidth: 200 }}>Producto o servicio</th>
                    <th style={{ minWidth: 180 }}>Descripción</th>
                    <th style={{ width: 80 }}>Cant</th>
                    <th style={{ width: 120 }}>V. Unitario</th>
                    <th style={{ width: 90 }}>% Desc</th>
                    <th style={{ width: 110 }}>Imp. Cargo</th>
                    <th style={{ width: 110 }}>Imp. Ret</th>
                    <th style={{ width: 120 }} className="text-end">
                      Valor Total
                    </th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, idx) => (
                    <tr key={l.id}>
                      <td className="text-muted small">{idx + 1}</td>
                      <td>
                        <div className="d-flex align-items-start gap-1">
                          <div className="flex-grow-1">
                            <Autocomplete<Producto>
                              value={l.productoNombre}
                              onChange={v =>
                                updateLinea(l.id, { productoNombre: v })
                              }
                              items={productosLocal}
                              getLabel={p => p.nombre}
                              getSubLabel={p =>
                                `${money(p.precio)} — IVA ${p.ivaPct}%${p.descripcion ? ' · ' + p.descripcion : ''}`
                              }
                              onSelect={p => onSelectProducto(l.id, p)}
                              onCreateNew={t => onCreateProducto(l.id, t)}
                              createLabel="Crear producto o servicio"
                              placeholder="Buscar producto o servicio..."
                              inputSize="sm"
                            />
                          </div>
                          <Button
                            color="light"
                            size="sm"
                            className="shrink-0"
                            title="Crear producto nuevo (va a Inventario)"
                            onClick={() => onCreateProducto(l.id, l.productoNombre || '')}
                          >
                            <Plus size={12} />
                          </Button>
                        </div>
                      </td>
                      <td>
                        <Input
                          bsSize="sm"
                          value={l.descripcion}
                          onChange={e =>
                            updateLinea(l.id, { descripcion: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <Input
                          bsSize="sm"
                          type="number"
                          min={0}
                          step="any"
                          value={l.cantidad === 0 ? '' : l.cantidad}
                          placeholder="1"
                          onChange={e =>
                            updateLinea(l.id, {
                              cantidad:
                                e.target.value === '' ? 0 : Number(e.target.value),
                            })
                          }
                          onFocus={e => e.target.select()}
                        />
                      </td>
                      <td>
                        <Input
                          bsSize="sm"
                          type="number"
                          min={0}
                          step="any"
                          value={l.valorUnit === 0 ? '' : l.valorUnit}
                          placeholder="0"
                          onChange={e =>
                            updateLinea(l.id, {
                              valorUnit:
                                e.target.value === '' ? 0 : Number(e.target.value),
                            })
                          }
                          onFocus={e => e.target.select()}
                        />
                      </td>
                      <td>
                        <Input
                          bsSize="sm"
                          type="number"
                          min={0}
                          max={100}
                          step="any"
                          value={l.descPct === 0 ? '' : l.descPct}
                          placeholder="0"
                          onChange={e =>
                            updateLinea(l.id, {
                              descPct:
                                e.target.value === '' ? 0 : Number(e.target.value),
                            })
                          }
                          onFocus={e => e.target.select()}
                        />
                      </td>
                      <td>
                        <Input
                          bsSize="sm"
                          type="select"
                          value={l.ivaPct}
                          onChange={e =>
                            updateLinea(l.id, {
                              ivaPct: Number(e.target.value),
                            })
                          }
                        >
                          {IVA_OPCIONES.map(v => (
                            <option key={v} value={v}>
                              {v === 0 ? 'Exento' : `${v}%`}
                            </option>
                          ))}
                        </Input>
                      </td>
                      <td>
                        <Input
                          bsSize="sm"
                          type="select"
                          value={l.rfPct}
                          onChange={e =>
                            updateLinea(l.id, {
                              rfPct: Number(e.target.value),
                            })
                          }
                        >
                          {RF_OPCIONES.map(v => (
                            <option key={v} value={v}>
                              {v}%
                            </option>
                          ))}
                        </Input>
                      </td>
                      <td className="text-end fw-semibold">
                        {money(totalLinea(l))}
                      </td>
                      <td className="text-end">
                        <Button
                          color="link"
                          size="sm"
                          className="text-danger p-0"
                          disabled={lineas.length <= 1}
                          onClick={() => removeLinea(l.id)}
                          title="Eliminar línea"
                        >
                          <X size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <Button
              color="link"
              size="sm"
              className="d-inline-flex align-items-center gap-1 p-0 mb-3"
              onClick={addLinea}
            >
              <Plus size={14} /> Agregar línea
            </Button>

            <hr className="my-4" />

            {/* ── Condición de pago ── */}
            <div className="mb-3 p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <Row className="g-3 align-items-end">
                <Col xs={12} md={paymentForm === 'Credito' ? 4 : 6}>
                  <Label className="small text-muted mb-1 fw-semibold">Condición de pago</Label>
                  <Input
                    type="select"
                    value={paymentForm}
                    onChange={(e) => setPaymentForm(e.target.value as any)}
                    style={{ width: '100%' }}
                  >
                    <option value="Contado">Contado</option>
                    <option value="Credito">Crédito</option>
                  </Input>
                </Col>
                {paymentForm === 'Credito' && (
                  <Col xs={12} md={4}>
                    <Label className="small text-muted mb-1 fw-semibold">Plazo</Label>
                    <Input
                      type="select"
                      value={creditTermDays}
                      onChange={(e) => setCreditTermDays(Number(e.target.value) || 30)}
                      style={{ width: '100%' }}
                    >
                      <option value={30}>30 días</option>
                      <option value={60}>60 días</option>
                      <option value={90}>90 días</option>
                      <option value={180}>180 días</option>
                    </Input>
                  </Col>
                )}
                <Col xs={12} md={paymentForm === 'Credito' ? 4 : 6}>
                  <Label className="small text-muted mb-1 fw-semibold">Vencimiento</Label>
                  <Input
                    type="date"
                    value={(() => {
                      if (paymentForm === 'Contado') return fecha;
                      const d = new Date(fecha);
                      if (isNaN(d.getTime())) return fecha;
                      d.setDate(d.getDate() + (Number(creditTermDays) || 30));
                      return d.toISOString().slice(0, 10);
                    })()}
                    readOnly
                    style={{ width: '100%', background: '#fff' }}
                  />
                </Col>
              </Row>
              <div className="small text-muted mt-2">
                {paymentForm === 'Contado'
                  ? 'La factura queda pendiente de cobro. El pago se registra luego en Recibo de Caja.'
                  : 'La factura queda en cartera abierta hasta que se aplique el pago.'}
              </div>
            </div>

            {/* Formas de pago: se capturan en el Recibo de Caja al momento del cobro,
                no en la factura. Ver PagoTab.tsx */}

            <hr className="my-4" />

            {/* ── Totales ── */}
            <Row>
              <Col md={{ size: 5, offset: 7 }}>
                <div className="d-flex justify-content-between small py-1">
                  <span className="text-muted">Total Bruto</span>
                  <span>{money(totales.bruto)}</span>
                </div>
                <div className="d-flex justify-content-between small py-1">
                  <span className="text-muted">Descuentos</span>
                  <span>- {money(totales.descTotal)}</span>
                </div>
                <div className="d-flex justify-content-between small py-1 border-top">
                  <span className="text-muted">Subtotal</span>
                  <span>{money(totales.subtotal)}</span>
                </div>
                <div className="d-flex justify-content-between small py-1">
                  <span className="text-muted">IVA</span>
                  <span>{money(totales.ivaTotal)}</span>
                </div>
                <div className="d-flex justify-content-between small py-1">
                  <span className="text-muted">Retención fuente</span>
                  <span>- {money(totales.rfTotal)}</span>
                </div>
                <div className="d-flex justify-content-between py-2 border-top fw-bold fs-5">
                  <span>TOTAL NETO</span>
                  <span>{money(totales.neto)}</span>
                </div>
              </Col>
            </Row>

            <hr className="my-4" />

            {/* ── Observaciones y adjuntos ── */}
            <FormGroup>
              <Label className="small fw-medium">Observaciones</Label>
              <Input
                type="textarea"
                rows={3}
                placeholder="Observaciones, términos de pago, garantías, etc."
                value={observaciones}
                onChange={e => {
                  markDirty();
                  setObservaciones(e.target.value);
                }}
              />
            </FormGroup>
            <div className="d-flex align-items-center gap-2">
              <Button
                color="light"
                size="sm"
                outline
                className="d-inline-flex align-items-center gap-1"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={14} /> Adjuntar archivo
              </Button>
              {adjunto && (
                <span className="small text-muted">
                  {adjunto.name}{' '}
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-danger"
                    onClick={() => setAdjunto(null)}
                  >
                    quitar
                  </button>
                </span>
              )}
              <input
                ref={fileRef}
                type="file"
                className="d-none"
                onChange={e => {
                  markDirty();
                  setAdjunto(e.target.files?.[0] || null);
                }}
              />
            </div>
          </Form>
          </div>
          {/* ── Footer fijo abajo (reemplaza ModalFooter) ── */}
          <div className="border-top p-3 d-flex justify-content-end gap-2 bg-white">
            <Button color="light" onClick={handleCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button
              color="outline-primary"
              onClick={() => doSubmit('BORRADOR')}
              disabled={saving}
            >
              <Save size={16} className="me-1" /> Guardar borrador
            </Button>
            <Button
              color="primary"
              onClick={() => doSubmit('EMITIDA')}
              disabled={saving}
            >
              {saving ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Receipt size={16} className="me-1" /> Emitir factura
                </>
              )}
            </Button>
          </div>
        </OffcanvasBody>
      </Offcanvas>

      <CrearClienteModal
        isOpen={crearClienteOpen}
        toggle={() => setCrearClienteOpen(false)}
        initialName={crearClienteSeed}
        onCreated={onClienteCreated}
      />
      <CrearProductoModal
        isOpen={crearProductoOpen}
        toggle={() => setCrearProductoOpen(false)}
        initialName={crearProductoSeed}
        onCreated={onProductoCreated}
        accounts={accountsPuc}
      />
    </>
  );
};

export default FacturaNuevaModal;
