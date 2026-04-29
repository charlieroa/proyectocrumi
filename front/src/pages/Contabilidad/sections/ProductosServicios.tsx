import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
  Spinner,
  Table,
} from 'reactstrap';

import {
  Product,
  ItemPrice,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  getProductCategories,
  ProductCategory,
} from '../../../services/productApi';
import {
  ServiceItem,
  getServicesByTenant,
  createService,
  updateService,
  deleteService,
  uploadServiceImage,
} from '../../../services/serviceApi';
import { getDianUoms, DianUom } from '../../../services/dianApi';
import { getPriceLists, PriceList } from '../../../services/priceListApi';
import { getTenantIdFromToken } from '../../../services/auth';

// =============================================================================
// Tipos UI
// =============================================================================
type Tipo = 'Producto' | 'Servicio';

interface ItemRow {
  id: string;
  tipo: Tipo;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  dian_uom_code?: string;
  unit?: string;
  tax_rate: number;
  retention_rate?: number;
  is_inventoriable: boolean;
  visible_in_invoices: boolean;
  include_iva_in_price: boolean;
  cost?: number;
  price: number;
  stock?: number;
  image_url?: string;
  is_active: boolean;
  prices: Record<number, number>;
  category_id?: string;
  category_name?: string;
}

interface FormDraft {
  tipo: Tipo;
  name: string;
  sku: string;
  barcode: string;
  description: string;
  dian_uom_code: string;
  tax_rate: number;
  retention_rate: number;
  is_inventoriable: boolean;
  visible_in_invoices: boolean;
  include_iva_in_price: boolean;
  cost: number;
  price: number;
  stock: number;
  prices: Record<number, number>;
  category_id: string;
  is_active: boolean;
  imageFile: File | null;
  imagePreview: string | null;
  image_url: string;
}

const FALLBACK_UOMS: DianUom[] = [
  { code: '94', description: 'Unidad' },
  { code: 'HUR', description: 'Hora' },
  { code: 'KGM', description: 'Kilogramo' },
  { code: 'GRM', description: 'Gramo' },
  { code: 'LTR', description: 'Litro' },
  { code: 'MTR', description: 'Metro' },
  { code: 'MTK', description: 'Metro cuadrado' },
  { code: 'MTQ', description: 'Metro cúbico' },
];

const IVA_OPTIONS = [
  { value: 0, label: '0% — Exento' },
  { value: 5, label: '5%' },
  { value: 19, label: '19%' },
];

const PAGE_SIZE = 10;

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n || 0);

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pricesArrayToMap = (arr?: ItemPrice[] | null): Record<number, number> => {
  const map: Record<number, number> = {};
  (arr ?? []).forEach((p) => {
    map[p.price_list_id] = num(p.price);
  });
  return map;
};

const productToRow = (p: Product): ItemRow => ({
  id: String(p.id),
  tipo: 'Producto',
  name: p.name,
  sku: p.sku || undefined,
  barcode: p.barcode || undefined,
  description: p.description || undefined,
  dian_uom_code: p.dian_uom_code || undefined,
  unit: p.unit || undefined,
  tax_rate: num(p.tax_rate),
  retention_rate: p.retention_rate != null ? num(p.retention_rate) : undefined,
  is_inventoriable: p.is_inventoriable !== false,
  visible_in_invoices: p.visible_in_invoices !== false,
  include_iva_in_price: !!p.include_iva_in_price,
  cost: p.cost != null ? num(p.cost) : p.cost_price != null ? num(p.cost_price) : undefined,
  price: num(p.price ?? p.sale_price),
  stock: p.stock != null ? num(p.stock) : 0,
  image_url: p.image_url || undefined,
  is_active: p.is_active !== false,
  prices: pricesArrayToMap(p.prices),
  category_id: p.category_id || undefined,
  category_name: p.category_name || undefined,
});

const serviceToRow = (s: ServiceItem): ItemRow => ({
  id: String(s.id),
  tipo: 'Servicio',
  name: s.name,
  sku: s.sku || undefined,
  description: s.description || undefined,
  dian_uom_code: s.dian_uom_code || undefined,
  tax_rate: num(s.tax_rate),
  retention_rate: s.retention_rate != null ? num(s.retention_rate) : undefined,
  is_inventoriable: false,
  visible_in_invoices: s.visible_in_invoices !== false,
  include_iva_in_price: !!s.include_iva_in_price,
  price: num(s.price),
  image_url: s.image_url || undefined,
  is_active: s.is_active !== false,
  prices: pricesArrayToMap(s.prices),
  category_id: s.category_id || undefined,
  category_name: s.category_name || undefined,
});

const emptyDraft = (): FormDraft => ({
  tipo: 'Producto',
  name: '',
  sku: '',
  barcode: '',
  description: '',
  dian_uom_code: '94',
  tax_rate: 19,
  retention_rate: 0,
  is_inventoriable: true,
  visible_in_invoices: true,
  include_iva_in_price: false,
  cost: 0,
  price: 0,
  stock: 0,
  prices: {},
  category_id: '',
  is_active: true,
  imageFile: null,
  imagePreview: null,
  image_url: '',
});

const draftFromRow = (r: ItemRow): FormDraft => ({
  tipo: r.tipo,
  name: r.name,
  sku: r.sku ?? '',
  barcode: r.barcode ?? '',
  description: r.description ?? '',
  dian_uom_code: r.dian_uom_code ?? '94',
  tax_rate: r.tax_rate,
  retention_rate: r.retention_rate ?? 0,
  is_inventoriable: r.is_inventoriable,
  visible_in_invoices: r.visible_in_invoices,
  include_iva_in_price: r.include_iva_in_price,
  cost: r.cost ?? 0,
  price: r.price,
  stock: r.stock ?? 0,
  prices: { ...r.prices },
  category_id: r.category_id ?? '',
  is_active: r.is_active,
  imageFile: null,
  imagePreview: null,
  image_url: r.image_url ?? '',
});

// =============================================================================
// Componente principal
// =============================================================================
const ProductosServicios: React.FC = () => {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<'Todos' | Tipo>('Todos');
  const [filterCategoria, setFilterCategoria] = useState<string>('');
  const [filterEstado, setFilterEstado] = useState<'Todos' | 'Activos' | 'Inactivos'>('Activos');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTipo, setEditTipo] = useState<Tipo | null>(null);
  const [draft, setDraft] = useState<FormDraft>(emptyDraft());

  const [bulkOpen, setBulkOpen] = useState(false);

  const [uoms, setUoms] = useState<DianUom[]>(FALLBACK_UOMS);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);

  const tenantId = useMemo(() => getTenantIdFromToken(), []);

  // ---------------------- Carga inicial ------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [prodRes, svcRes] = await Promise.all([
        getProducts().catch(() => ({ data: [] as Product[] })),
        tenantId
          ? getServicesByTenant(tenantId).catch(() => ({ data: [] as ServiceItem[] }))
          : Promise.resolve({ data: [] as ServiceItem[] }),
      ]);
      const productRows = (prodRes.data || []).map(productToRow);
      const serviceRows = (svcRes.data || []).map(serviceToRow);
      setRows([...productRows, ...serviceRows]);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'Error cargando productos y servicios.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadCatalogs = useCallback(async () => {
    try {
      const [u, pl, cat] = await Promise.all([
        getDianUoms().catch(() => ({ data: FALLBACK_UOMS })),
        getPriceLists().catch(() => ({ data: [] as PriceList[] })),
        getProductCategories().catch(() => ({ data: [] as ProductCategory[] })),
      ]);
      setUoms(u.data?.length ? u.data : FALLBACK_UOMS);
      setPriceLists(pl.data || []);
      setCategories(cat.data || []);
    } catch {
      // catálogos opcionales — silencio
    }
  }, []);

  useEffect(() => {
    loadCatalogs();
    loadData();
  }, [loadCatalogs, loadData]);

  // ---------------------- Filtros y paginación ------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterTipo !== 'Todos' && r.tipo !== filterTipo) return false;
      if (filterCategoria && r.category_id !== filterCategoria) return false;
      if (filterEstado === 'Activos' && !r.is_active) return false;
      if (filterEstado === 'Inactivos' && r.is_active) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.sku?.toLowerCase().includes(q) ?? false) ||
        (r.barcode?.toLowerCase().includes(q) ?? false) ||
        (r.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, search, filterTipo, filterCategoria, filterEstado]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const pageItems = filtered.slice(pageStart, pageEnd);

  const goTo = (n: number) => {
    if (n < 1 || n > totalPages) return;
    setPage(n);
  };

  // ---------------------- Form helpers ------------------------
  const openNew = () => {
    setEditId(null);
    setEditTipo(null);
    setDraft(emptyDraft());
    setModalOpen(true);
  };

  const openEdit = (r: ItemRow) => {
    setEditId(r.id);
    setEditTipo(r.tipo);
    setDraft(draftFromRow(r));
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditId(null);
    setEditTipo(null);
  };

  const onImageChange = (file: File | null) => {
    setDraft((d) => ({
      ...d,
      imageFile: file,
      imagePreview: file ? URL.createObjectURL(file) : null,
    }));
  };

  const setPriceForList = (listId: number, value: number) => {
    setDraft((d) => ({ ...d, prices: { ...d.prices, [listId]: value } }));
  };

  // ---------------------- Save / delete ------------------------
  const buildPricesArray = (): ItemPrice[] =>
    Object.entries(draft.prices)
      .filter(([_, v]) => Number.isFinite(v) && v >= 0)
      .map(([id, price]) => ({ price_list_id: Number(id), price: Number(price) }));

  const save = async () => {
    if (!draft.name.trim()) {
      setErrorMsg('El nombre es obligatorio.');
      return;
    }
    if (!Number.isFinite(draft.price) || draft.price < 0) {
      setErrorMsg('El precio de venta debe ser un número ≥ 0.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const isEdit = !!editId;
      const isProducto = draft.tipo === 'Producto';
      const pricesArray = buildPricesArray();

      let savedId: string;

      if (isProducto) {
        const payload: Partial<Product> = {
          name: draft.name.trim(),
          sku: draft.sku.trim() || undefined,
          barcode: draft.barcode.trim() || undefined,
          description: draft.description.trim() || undefined,
          dian_uom_code: draft.dian_uom_code || undefined,
          unit: draft.dian_uom_code || undefined,
          tax_rate: draft.tax_rate,
          retention_rate: draft.retention_rate || undefined,
          is_inventoriable: draft.is_inventoriable,
          visible_in_invoices: draft.visible_in_invoices,
          include_iva_in_price: draft.include_iva_in_price,
          cost: draft.cost,
          cost_price: draft.cost,
          price: draft.price,
          sale_price: draft.price,
          stock: draft.is_inventoriable ? draft.stock : 0,
          category_id: draft.category_id || undefined,
          is_active: draft.is_active,
          prices: pricesArray,
        };

        if (isEdit && editTipo === 'Producto') {
          const r = await updateProduct(editId!, payload);
          savedId = String(r.data.id ?? editId);
        } else {
          if (isEdit && editTipo === 'Servicio') {
            await deleteService(editId!).catch(() => {});
          }
          const r = await createProduct(payload as Omit<Product, 'id'>);
          savedId = String(r.data.id);
        }

        if (draft.imageFile) {
          await uploadProductImage(savedId, draft.imageFile).catch(() => {});
        }
      } else {
        const payload: Partial<ServiceItem> = {
          name: draft.name.trim(),
          sku: draft.sku.trim() || undefined,
          description: draft.description.trim() || undefined,
          dian_uom_code: draft.dian_uom_code || undefined,
          tax_rate: draft.tax_rate,
          retention_rate: draft.retention_rate || undefined,
          visible_in_invoices: draft.visible_in_invoices,
          include_iva_in_price: draft.include_iva_in_price,
          price: draft.price,
          category_id: draft.category_id || undefined,
          is_active: draft.is_active,
          prices: pricesArray,
        };

        if (isEdit && editTipo === 'Servicio') {
          const r = await updateService(editId!, payload);
          savedId = String(r.data.id ?? editId);
        } else {
          if (isEdit && editTipo === 'Producto') {
            await deleteProduct(editId!).catch(() => {});
          }
          const r = await createService(payload as Omit<ServiceItem, 'id'>);
          savedId = String(r.data.id);
        }

        if (draft.imageFile) {
          await uploadServiceImage(savedId, draft.imageFile).catch(() => {});
        }
      }

      await loadData();
      setModalOpen(false);
      setEditId(null);
      setEditTipo(null);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: ItemRow) => {
    if (!window.confirm(`¿Eliminar ${r.tipo.toLowerCase()} "${r.name}"?`)) return;
    try {
      if (r.tipo === 'Producto') {
        await deleteProduct(r.id);
      } else {
        await deleteService(r.id);
      }
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'No se pudo eliminar.');
    }
  };

  const toggleActivo = async (r: ItemRow) => {
    try {
      if (r.tipo === 'Producto') {
        await updateProduct(r.id, { is_active: !r.is_active });
      } else {
        await updateService(r.id, { is_active: !r.is_active });
      }
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'No se pudo actualizar.');
    }
  };

  // ---------------------- Render ------------------------
  const rangeFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const rangeTo = pageEnd;

  return (
    <>
      <Card className="shadow-sm mb-3">
        <CardBody>
          {errorMsg && (
            <Alert color="danger" toggle={() => setErrorMsg(null)} className="mb-3">
              {errorMsg}
            </Alert>
          )}

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 className="mb-0">Productos y servicios</h5>
            <div className="d-flex gap-2">
              <Button color="light" onClick={() => setBulkOpen(true)}>
                <i className="ri-upload-2-line me-1" /> Carga masiva
              </Button>
              <Button color="primary" onClick={openNew}>
                <i className="ri-add-line me-1" /> Agregar producto o servicio
              </Button>
            </div>
          </div>

          <Row className="g-2 mb-3 align-items-end">
            <Col md={4} sm={12}>
              <Label className="fs-13 mb-1">Buscar</Label>
              <Input
                type="text"
                placeholder="Nombre, SKU, código de barras…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                bsSize="sm"
              />
            </Col>
            <Col md={2} sm={4}>
              <Label className="fs-13 mb-1">Tipo</Label>
              <Input
                type="select"
                bsSize="sm"
                value={filterTipo}
                onChange={(e) => {
                  setFilterTipo(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="Todos">Todos</option>
                <option value="Producto">Producto</option>
                <option value="Servicio">Servicio</option>
              </Input>
            </Col>
            <Col md={3} sm={4}>
              <Label className="fs-13 mb-1">Categoría</Label>
              <Input
                type="select"
                bsSize="sm"
                value={filterCategoria}
                onChange={(e) => {
                  setFilterCategoria(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Input>
            </Col>
            <Col md={3} sm={4}>
              <Label className="fs-13 mb-1">Estado</Label>
              <Input
                type="select"
                bsSize="sm"
                value={filterEstado}
                onChange={(e) => {
                  setFilterEstado(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="Activos">Activos</option>
                <option value="Inactivos">Inactivos</option>
                <option value="Todos">Todos</option>
              </Input>
            </Col>
          </Row>

          <div className="text-muted fs-13 mb-2">
            {filtered.length === 0
              ? '0 a 0 de 0. Página 1 de 1'
              : `${rangeFrom} a ${rangeTo} de ${filtered.length}. Página ${currentPage} de ${totalPages}`}
          </div>

          {loading ? (
            <div className="text-center py-5">
              <Spinner color="primary" /> <div className="text-muted mt-2">Cargando…</div>
            </div>
          ) : filtered.length === 0 ? (
            <Alert color="light" className="text-center mb-0">
              <i className="ri-box-3-line fs-32 text-muted d-block mb-2" />
              {rows.length === 0 ? (
                <>
                  <div className="fw-semibold mb-1">Todavía no hay productos ni servicios</div>
                  <div className="text-muted fs-13 mb-3">
                    Registra lo que vendes: productos con stock o servicios con duración.
                  </div>
                  <Button color="primary" size="sm" onClick={openNew}>
                    <i className="ri-add-line me-1" /> Crear el primero
                  </Button>
                </>
              ) : (
                <div className="text-muted fs-13">No hay resultados con los filtros actuales.</div>
              )}
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 60 }}>Img</th>
                    <th style={{ width: 100 }}>Tipo</th>
                    <th>Nombre</th>
                    <th style={{ width: 140 }}>SKU</th>
                    <th style={{ width: 130 }} className="text-end">Precio</th>
                    <th style={{ width: 90 }} className="text-center">Stock</th>
                    <th style={{ width: 90 }}>IVA</th>
                    <th style={{ width: 100 }}>Estado</th>
                    <th className="text-end" style={{ width: 130 }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => (
                    <tr key={`${r.tipo}-${r.id}`}>
                      <td>
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt={r.name}
                            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }}
                          />
                        ) : (
                          <i
                            className={
                              r.tipo === 'Producto'
                                ? 'ri-box-3-line text-muted fs-22'
                                : 'ri-service-line text-muted fs-22'
                            }
                          />
                        )}
                      </td>
                      <td>
                        <Badge color={r.tipo === 'Producto' ? 'info' : 'secondary'} className="fs-11">
                          {r.tipo}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          color="link"
                          className="p-0 text-start fw-medium text-decoration-none"
                          onClick={() => openEdit(r)}
                        >
                          {r.name}
                        </Button>
                        {r.description && (
                          <div className="text-muted fs-12 text-truncate" style={{ maxWidth: 360 }}>
                            {r.description}
                          </div>
                        )}
                      </td>
                      <td className="font-monospace fs-13 text-muted">{r.sku ?? '—'}</td>
                      <td className="text-end font-monospace">{money(r.price)}</td>
                      <td className="text-center">
                        {r.tipo === 'Producto' && r.is_inventoriable ? (
                          <span
                            className={
                              num(r.stock) <= 0 ? 'text-danger fw-medium' : 'text-body'
                            }
                          >
                            {num(r.stock)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <Badge color="light" className="text-dark fs-11">
                          {num(r.tax_rate)}%
                        </Badge>
                      </td>
                      <td>
                        <Badge color={r.is_active ? 'success' : 'light'} className="fs-11">
                          {r.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="text-end">
                        <Button
                          color="link"
                          size="sm"
                          className="text-primary p-1"
                          onClick={() => openEdit(r)}
                          title="Editar"
                        >
                          <i className="ri-edit-line" />
                        </Button>
                        <Button
                          color="link"
                          size="sm"
                          className="text-secondary p-1"
                          onClick={() => toggleActivo(r)}
                          title={r.is_active ? 'Desactivar' : 'Activar'}
                        >
                          <i className="ri-toggle-line" />
                        </Button>
                        <Button
                          color="link"
                          size="sm"
                          className="text-danger p-1"
                          onClick={() => remove(r)}
                          title="Eliminar"
                        >
                          <i className="ri-delete-bin-line" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="d-flex justify-content-center align-items-center gap-1 mt-3">
              <Button
                color="light"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => goTo(currentPage - 1)}
              >
                « Anterior
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Button
                  key={n}
                  color={n === currentPage ? 'primary' : 'light'}
                  size="sm"
                  onClick={() => goTo(n)}
                >
                  {n}
                </Button>
              ))}
              <Button
                color="light"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => goTo(currentPage + 1)}
              >
                Siguiente »
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ============================ MODAL FORM ============================ */}
      <Modal isOpen={modalOpen} toggle={closeModal} centered size="lg" backdrop="static">
        <ModalHeader toggle={closeModal}>
          {editId ? 'Editar producto / servicio' : 'Agregar producto o servicio'}
        </ModalHeader>
        <ModalBody>
          {/* Selector tipo */}
          <div className="d-flex gap-3 mb-3 border-bottom pb-2">
            <FormGroup check inline className="mb-0">
              <Input
                type="radio"
                name="tipo"
                id="tipo-producto"
                checked={draft.tipo === 'Producto'}
                onChange={() => setDraft({ ...draft, tipo: 'Producto' })}
                disabled={!!editId}
              />
              <Label check htmlFor="tipo-producto" className="fs-14 fw-medium">
                Producto
              </Label>
            </FormGroup>
            <FormGroup check inline className="mb-0">
              <Input
                type="radio"
                name="tipo"
                id="tipo-servicio"
                checked={draft.tipo === 'Servicio'}
                onChange={() =>
                  setDraft({ ...draft, tipo: 'Servicio', is_inventoriable: false })
                }
                disabled={!!editId}
              />
              <Label check htmlFor="tipo-servicio" className="fs-14 fw-medium">
                Servicio
              </Label>
            </FormGroup>
          </div>

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {/* ============= Datos generales ============= */}
            <div className="fs-13 fw-semibold text-uppercase text-muted mb-2">Datos generales</div>
            <Row className="g-3 mb-3">
              <Col md={4}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">
                    {draft.tipo === 'Producto' ? 'Código de producto (SKU)' : 'Código de servicio'}{' '}
                    <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={draft.sku}
                    onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                  />
                </FormGroup>
              </Col>
              <Col md={8}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">
                    {draft.tipo === 'Producto' ? 'Nombre del producto' : 'Nombre del servicio'}{' '}
                    <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    autoFocus
                  />
                </FormGroup>
              </Col>

              {draft.tipo === 'Producto' && (
                <Col md={6}>
                  <FormGroup className="mb-0">
                    <Label className="fs-13">Código de barras</Label>
                    <Input
                      type="text"
                      value={draft.barcode}
                      onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                    />
                  </FormGroup>
                </Col>
              )}

              <Col md={draft.tipo === 'Producto' ? 6 : 6}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">
                    Unidad de medida DIAN <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="select"
                    value={draft.dian_uom_code}
                    onChange={(e) => setDraft({ ...draft, dian_uom_code: e.target.value })}
                  >
                    {uoms.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.code} - {u.description}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>

              {draft.tipo === 'Producto' ? (
                <>
                  <Col md={6}>
                    <FormGroup check className="mb-0 mt-2">
                      <Input
                        type="checkbox"
                        id="is_inventoriable"
                        checked={draft.is_inventoriable}
                        onChange={(e) =>
                          setDraft({ ...draft, is_inventoriable: e.target.checked })
                        }
                      />
                      <Label check htmlFor="is_inventoriable" className="fs-13">
                        Producto inventariable
                      </Label>
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup check className="mb-0 mt-2">
                      <Input
                        type="checkbox"
                        id="visible_in_invoices"
                        checked={draft.visible_in_invoices}
                        onChange={(e) =>
                          setDraft({ ...draft, visible_in_invoices: e.target.checked })
                        }
                      />
                      <Label check htmlFor="visible_in_invoices" className="fs-13">
                        Visible en facturas de venta
                      </Label>
                    </FormGroup>
                  </Col>
                </>
              ) : (
                <Col md={12}>
                  <Alert color="info" className="mb-0 fs-13 py-2">
                    Los servicios no son inventariables.
                  </Alert>
                </Col>
              )}
            </Row>

            {/* ============= Datos adicionales ============= */}
            <div className="fs-13 fw-semibold text-uppercase text-muted mb-2">Datos adicionales</div>
            <div className="text-muted fs-12 mb-2">
              Estos impuestos aplican solo para documentos de ventas
            </div>
            <Row className="g-3 mb-3">
              <Col md={6}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Impuesto cargo (% IVA)</Label>
                  <Input
                    type="select"
                    value={draft.tax_rate}
                    onChange={(e) =>
                      setDraft({ ...draft, tax_rate: Number(e.target.value) })
                    }
                  >
                    {IVA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Retención (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={draft.retention_rate}
                    onChange={(e) =>
                      setDraft({ ...draft, retention_rate: Number(e.target.value) || 0 })
                    }
                  />
                </FormGroup>
              </Col>
            </Row>

            {/* ============= Lista de precios ============= */}
            <div className="fs-13 fw-semibold text-uppercase text-muted mb-2">Lista de precios</div>
            <Row className="g-3 mb-3">
              <Col md={12}>
                <FormGroup check className="mb-0">
                  <Input
                    type="checkbox"
                    id="include_iva"
                    checked={draft.include_iva_in_price}
                    onChange={(e) =>
                      setDraft({ ...draft, include_iva_in_price: e.target.checked })
                    }
                  />
                  <Label check htmlFor="include_iva" className="fs-13">
                    Incluir IVA en el precio de venta
                  </Label>
                </FormGroup>
              </Col>

              {/* Precio principal (compatibilidad con backend actual) */}
              <Col md={6}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">
                    Precio de venta principal (COP) <span className="text-danger">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })}
                  />
                </FormGroup>
              </Col>
              {draft.tipo === 'Producto' && (
                <Col md={6}>
                  <FormGroup className="mb-0">
                    <Label className="fs-13">Costo (COP)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.cost}
                      onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) || 0 })}
                    />
                  </FormGroup>
                </Col>
              )}

              {/* Listas adicionales */}
              {priceLists.map((pl) => (
                <Col md={6} key={pl.id}>
                  <FormGroup className="mb-0">
                    <Label className="fs-13">{pl.name}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.prices[pl.id] ?? ''}
                      onChange={(e) =>
                        setPriceForList(pl.id, Number(e.target.value) || 0)
                      }
                    />
                  </FormGroup>
                </Col>
              ))}
            </Row>

            {/* ============= Stock e imagen ============= */}
            <Row className="g-3 mb-3">
              {draft.tipo === 'Producto' && draft.is_inventoriable && (
                <Col md={4}>
                  <FormGroup className="mb-0">
                    <Label className="fs-13">Stock inicial</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.stock}
                      onChange={(e) =>
                        setDraft({ ...draft, stock: Number(e.target.value) || 0 })
                      }
                    />
                  </FormGroup>
                </Col>
              )}
              <Col md={draft.tipo === 'Producto' && draft.is_inventoriable ? 8 : 12}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Imagen</Label>
                  <div className="d-flex align-items-center gap-2">
                    {draft.imagePreview ? (
                      <img
                        src={draft.imagePreview}
                        alt="preview"
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ) : draft.image_url ? (
                      <img
                        src={draft.image_url}
                        alt="actual"
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ) : (
                      <div
                        className="bg-light rounded d-flex align-items-center justify-content-center text-muted"
                        style={{ width: 60, height: 60 }}
                      >
                        <i className="ri-image-line fs-22" />
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onImageChange(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </FormGroup>
              </Col>
            </Row>

            <Row className="g-3 mb-1">
              <Col md={12}>
                <FormGroup className="mb-0">
                  <Label className="fs-13">Descripción</Label>
                  <Input
                    type="textarea"
                    rows={2}
                    placeholder="Texto opcional que aparece en la factura"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </FormGroup>
              </Col>
              <Col md={12}>
                <FormGroup check className="mb-0 mt-2">
                  <Input
                    type="checkbox"
                    id="is_active"
                    checked={draft.is_active}
                    onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  />
                  <Label check htmlFor="is_active" className="fs-13">
                    Activo
                  </Label>
                </FormGroup>
              </Col>
            </Row>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={closeModal} disabled={saving}>
            Cancelar
          </Button>
          <Button color="primary" onClick={save} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <i className="ri-save-line me-1" />}
            {editId ? ' Guardar cambios' : ' Crear'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ============================ CARGA MASIVA (placeholder Fase 3) ============================ */}
      <Modal isOpen={bulkOpen} toggle={() => setBulkOpen(false)} centered>
        <ModalHeader toggle={() => setBulkOpen(false)}>Carga masiva</ModalHeader>
        <ModalBody>
          <Alert color="info" className="mb-3">
            <i className="ri-information-line me-1" />
            La carga masiva por Excel/CSV está en preparación. Mientras tanto, registra los ítems
            uno a uno con el botón <strong>Agregar producto o servicio</strong>.
          </Alert>
          <div className="text-muted fs-13">
            La plantilla incluirá: SKU, nombre, tipo (producto/servicio), código de barras, unidad
            DIAN, IVA, retención, precio, stock inicial.
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setBulkOpen(false)}>
            Cerrar
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default ProductosServicios;
