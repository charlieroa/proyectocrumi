// Ubicación: src/pages/Ecommerce/EcommerceProducts/index.tsx

import React, { useEffect, useMemo, useState, ChangeEvent } from "react";
import { Container, UncontrolledDropdown, DropdownToggle, DropdownItem, DropdownMenu, Nav, NavItem, NavLink, Row, Card, CardHeader, Col, Modal, ModalHeader, ModalBody, ModalFooter, Button, Form, Label, Input, Spinner, InputGroup } from "reactstrap";
import classnames from "classnames";
import Nouislider from "nouislider-react";
import "nouislider/distribute/nouislider.css";
import Swal from 'sweetalert2';
import CreatableSelect from 'react-select/creatable';
import CurrencyInput from 'react-currency-input-field';
import { jwtDecode } from "jwt-decode";

// Redux
import { useSelector, useDispatch } from "react-redux";
import {
    createNewProduct, createNewCategory, deleteExistingProduct, fetchProductCategories,
    fetchProducts, updateExistingProduct, uploadProductImage, updateExistingCategory, deleteExistingCategory
} from "../../../slices/products/thunk";
import { Product } from "../../../services/productApi";
import { AppDispatch, RootState } from "../../../index";

// API y Auth
import { api } from "../../../services/api";
import { getToken } from "../../../services/auth";

import BreadCrumb from "../../../Components/Common/BreadCrumb";
import TableContainer from "../../../Components/Common/TableContainer";
import CategoryManagerModal from "../../../Components/Common/CategoryManagerModal";
import { env } from '../../../env';

// --- LÍNEA CORREGIDA ---
// Eliminamos el respaldo a 'localhost'. Ahora la URL DEBE venir del archivo .env.
const BACKEND_URL = env.API_URL;

type TabKey = "all" | "cliente" | "estilista";

// Helper para obtener el tenantId del token
const decodeTenantId = (): string | null => {
    try {
      const t = getToken();
      if (!t) return null;
      const decoded: any = jwtDecode(t);
      return decoded?.user?.tenant_id || decoded?.tenant_id || null;
    } catch { return null; }
};

const ProductsPage = () => {
    const dispatch: AppDispatch = useDispatch();
    const { products: allProducts, categories, status, error } = useSelector((state: RootState) => state.products);

    // Estado para la configuración del módulo
    const [canSellToStaff, setCanSellToStaff] = useState(true);

    const [activeTab, setActiveTab] = useState<TabKey>("all");
    const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");
    const [priceRange, setPriceRange] = useState([0, 500000]);
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState<Partial<Product>>({});
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);

    useEffect(() => {
        dispatch(fetchProducts());
        dispatch(fetchProductCategories());
    }, [dispatch]);
    
    useEffect(() => {
        const fetchTenantSettings = async () => {
            try {
                const tenantId = decodeTenantId();
                if (tenantId) {
                    const response = await api.get(`/tenants/${tenantId}`);
                    setCanSellToStaff(response.data.products_for_staff_enabled ?? true);
                }
            } catch (err) {
                console.error("Error al cargar la configuración del tenant:", err);
                setCanSellToStaff(true);
            }
        };
        fetchTenantSettings();
    }, []);

    const categoryOptions = useMemo(() => 
        categories.map(cat => ({ value: cat.id, label: cat.name })), 
    [categories]);

    const filteredProducts = useMemo(() => {
        let filtered = [...allProducts];
        if (activeTab === 'cliente') {
            filtered = filtered.filter(p => p.audience_type === 'cliente' || p.audience_type === 'ambos');
        }
        if (activeTab === 'estilista') {
            filtered = filtered.filter(p => p.audience_type === 'estilista' || p.audience_type === 'ambos');
        }
        if (activeCategoryFilter !== "all") {
            filtered = filtered.filter(p => p.category_id === activeCategoryFilter);
        }
        filtered = filtered.filter(p => p.sale_price >= priceRange[0] && p.sale_price <= priceRange[1]);
        return filtered;
    }, [allProducts, activeTab, activeCategoryFilter, priceRange]);

    const handleAddClick = () => {
        setIsEditMode(false);
        setFormData({ audience_type: 'cliente', cost_price: 0, sale_price: 0, staff_price: 0, stock: 0, product_commission_percent: 0 });
        setImagePreview(null);
        setSelectedImageFile(null);
        setModalOpen(true);
    };

    const handleEditClick = (product: Product) => {
        setIsEditMode(true);
        setFormData(product);
        setImagePreview(product.image_url ? `${BACKEND_URL}${product.image_url}` : null);
        setSelectedImageFile(null);
        setModalOpen(true);
    };
    
    const handleDeleteClick = (product: Product) => {
        Swal.fire({
            title: '¿Estás seguro?', text: `No podrás revertir la eliminación de "${product.name}"!`, icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#438eff', cancelButtonColor: '#f06548',
            confirmButtonText: 'Sí, ¡eliminar!', cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                dispatch(deleteExistingProduct(product.id));
            }
        })
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditMode && formData.id) {
            const productDataToUpdate: Partial<Product> = { ...formData };
            delete productDataToUpdate.id;
            const imageUploadPromise = selectedImageFile ? dispatch(uploadProductImage({ id: formData.id, imageFile: selectedImageFile })) : Promise.resolve();
            await imageUploadPromise;
            dispatch(updateExistingProduct({ id: formData.id, productData: productDataToUpdate }));
        } else {
            const productData: Omit<Product, 'id' | 'image_url'> = {
                name: formData.name!, 
                description: formData.description, 
                cost_price: Number(formData.cost_price || 0),
                sale_price: Number(formData.sale_price || 0), 
                staff_price: Number(formData.staff_price || 0),
                stock: Number(formData.stock || 0), 
                category_id: formData.category_id, 
                audience_type: canSellToStaff ? formData.audience_type! : 'cliente',
                // Añadimos el nuevo campo de comisión
                product_commission_percent: Number(formData.product_commission_percent || 0),
            };
            dispatch(createNewProduct({ productData, imageFile: selectedImageFile || undefined }));
        }
        setModalOpen(false);
        resetFormAndImage();
    };

    const handleCategoryChange = (selectedOption: any) => {
        setFormData(prev => ({...prev, category_id: selectedOption ? selectedOption.value : undefined }));
    };

    const handleCreateCategory = (inputValue: string) => { dispatch(createNewCategory(inputValue)); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setSelectedImageFile(file);
        setImagePreview(file ? URL.createObjectURL(file) : null);
    };

    const resetFormAndImage = () => {
        setFormData({ audience_type: 'cliente' });
        setSelectedImageFile(null);
        if (imagePreview) { URL.revokeObjectURL(imagePreview); }
        setImagePreview(null);
    };
    
    const handleUpdateCategory = async (id: string, name: string) => { await dispatch(updateExistingCategory({ id, name })); };
    const handleDeleteCategory = async (id: string) => {
      await dispatch(deleteExistingCategory(id));
      if (formData.category_id === id) { setFormData(prev => ({ ...prev, category_id: undefined })); }
    };

    const columns = useMemo(() => [
        {
            header: "Producto", accessorKey: "name", enableColumnFilter: false,
            cell: (cell: any) => (
                <div className="d-flex align-items-center">
                    <div className="flex-shrink-0 me-3">
                        <div className="avatar-sm bg-light rounded p-1">
                            <img 
                                src={cell.row.original.image_url ? `${BACKEND_URL}${cell.row.original.image_url}` : "https://www.shutterstock.com/image-vector/default-ui-image-placeholder-wireframes-600nw-1037719192.jpg"} 
                                alt={cell.getValue()} className="img-fluid d-block" style={{height: "100%", objectFit: "cover"}} 
                                onError={(e) => { e.currentTarget.src = "https://www.shutterstock.com/image-vector/default-ui-image-placeholder-wireframes-600nw-1037719192.jpg"; }}
                            />
                        </div>
                    </div>
                    <div className="flex-grow-1">
                        <h5 className="fs-14 mb-1">{cell.getValue()}</h5>
                        <p className="text-muted mb-0">Categoría: <span className="fw-medium">{cell.row.original.category_name || 'N/A'}</span></p>
                    </div>
                </div>
            ),
        },
        { header: "Stock", accessorKey: "stock", enableColumnFilter: false },
        { header: "Precio Venta", accessorKey: "sale_price", enableColumnFilter: false, cell: ({ cell }: any) => <span>${new Intl.NumberFormat('es-CO').format(cell.getValue())}</span> },
        { header: "Audiencia", accessorKey: "audience_type", enableColumnFilter: false },
        {
            header: "Acción", enableColumnFilter: false,
            cell: ({ row }: any) => (
                <UncontrolledDropdown>
                    <DropdownToggle href="#" className="btn btn-soft-secondary btn-sm" tag="button"><i className="ri-more-fill" /></DropdownToggle>
                    <DropdownMenu className="dropdown-menu-end">
                        <DropdownItem onClick={() => handleEditClick(row.original)}><i className="ri-pencil-fill align-bottom me-2 text-muted" /> Editar</DropdownItem>
                        <DropdownItem onClick={() => handleDeleteClick(row.original)}><i className="ri-delete-bin-fill align-bottom me-2 text-muted" /> Eliminar</DropdownItem>
                    </DropdownMenu>
                </UncontrolledDropdown>
            ),
        },
    ], [categories, handleDeleteClick]);

    document.title = "Inventario de Productos | StyleApp";

    return (
        <div className="page-content">
            <Container fluid>
                <BreadCrumb title="Productos" pageTitle="Inventario" />
                <Row>
                    <Col xl={3} lg={4}>
                        <Card>
                             <CardHeader><h5 className="fs-16">Filtros</h5></CardHeader>
                             <div className="card-body border-bottom">
                                <p className="text-muted text-uppercase fs-12 fw-medium mb-2">Categorías</p>
                                <ul className="list-unstyled mb-0 filter-list">
                                    <li><a href="#!" className={activeCategoryFilter === 'all' ? 'active' : ''} onClick={() => setActiveCategoryFilter("all")}>Todos</a></li>
                                    {categories.map((cat) => (
                                        <li key={cat.id}><a href="#!" className={activeCategoryFilter === cat.id ? 'active' : ''} onClick={() => setActiveCategoryFilter(cat.id)}>{cat.name}</a></li>
                                    ))}
                                </ul>
                             </div>
                             <div className="card-body border-bottom">
                                <p className="text-muted text-uppercase fs-12 fw-medium mb-4">Precio</p>
                                <Nouislider range={{ min: 0, max: 500000 }} start={priceRange} connect step={1000} onSlide={(values) => setPriceRange(values.map(Number))} id="product-price-range" />
                                <div className="formCost d-flex gap-2 align-items-center mt-3"><span className="fw-semibold text-muted">${new Intl.NumberFormat('es-CO').format(priceRange[0])} a ${new Intl.NumberFormat('es-CO').format(priceRange[1])}</span></div>
                             </div>
                        </Card>
                    </Col>
                    <Col xl={9} lg={8}>
                        <Card>
                            <div className="card-header border-0">
                                <Row className="align-items-center g-2">
                                    <Col>
                                        <Nav className="nav-tabs-custom card-header-tabs border-bottom-0" role="tablist">
                                            <NavItem><NavLink className={classnames({ active: activeTab === 'all' })} onClick={() => setActiveTab('all')} href="#">Todos</NavLink></NavItem>
                                            {canSellToStaff && (
                                                <>
                                                    <NavItem><NavLink className={classnames({ active: activeTab === 'cliente' })} onClick={() => setActiveTab('cliente')} href="#">Venta a Clientes</NavLink></NavItem>
                                                    <NavItem><NavLink className={classnames({ active: activeTab === 'estilista' })} onClick={() => setActiveTab('estilista')} href="#">Uso Personal</NavLink></NavItem>
                                                </>
                                            )}
                                        </Nav>
                                    </Col>
                                    <Col className="text-end"><Button color="primary" onClick={handleAddClick}><i className="ri-add-line align-middle me-1" /> Agregar Producto</Button></Col>
                                </Row>
                            </div>
                            <div className="card-body pt-0">
                                {status === 'loading' && <div className="text-center p-5"><Spinner color="primary">Cargando...</Spinner></div>}
                                {status === 'failed' && <div className="text-center text-danger">Error: {error}</div>}
                                {status === 'succeeded' && (
                                    <TableContainer
                                        columns={columns} data={filteredProducts} isGlobalFilter={true} customPageSize={10}
                                        divClass="table-responsive mb-1" tableClass="mb-0 align-middle table-borderless"
                                        theadClass="table-light text-muted" SearchPlaceholder="Buscar productos..."
                                    />
                                )}
                            </div>
                        </Card>
                    </Col>
                </Row>
                
                <Modal isOpen={modalOpen} toggle={() => { setModalOpen(false); resetFormAndImage(); }} centered size="lg">
                    <ModalHeader toggle={() => { setModalOpen(false); resetFormAndImage(); }}>{isEditMode ? 'Editar Producto' : 'Agregar Nuevo Producto'}</ModalHeader>
                    <Form onSubmit={handleFormSubmit}>
                        <ModalBody>
                            <Row>
                                <Col md={6} className="mb-3"><Label>Nombre</Label><Input value={formData.name || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, name: e.target.value }))} required/></Col>
                                <Col md={6} className="mb-3">
                                    <Label>Categoría</Label>
                                    <InputGroup>
                                        <CreatableSelect
                                            className="flex-grow-1" isClearable isSearchable
                                            options={categoryOptions}
                                            value={categoryOptions.find(opt => opt.value === formData.category_id)}
                                            onChange={handleCategoryChange}
                                            onCreateOption={handleCreateCategory}
                                            placeholder="Busca o crea una categoría..."
                                            formatCreateLabel={inputValue => `Crear nueva categoría: "${inputValue}"`}
                                        />
                                        <Button color="secondary" outline type="button" onClick={() => setCategoryManagerOpen(true)} title="Gestionar categorías"><i className="ri-settings-3-line"></i></Button>
                                    </InputGroup>
                                </Col>
                                
                                <Col md={canSellToStaff ? 3 : 6} className="mb-3">
                                    <Label>Precio de Venta</Label>
                                    <CurrencyInput className="form-control" value={formData.sale_price} onValueChange={(value) => setFormData(p => ({ ...p, sale_price: Number(value) }))} prefix="$ " groupSeparator="." decimalSeparator="," placeholder="$ 50.000" required />
                                </Col>
                                {canSellToStaff && (
                                    <>
                                        <Col md={3} className="mb-3">
                                            <Label>Precio para Personal</Label>
                                            <CurrencyInput className="form-control" value={formData.staff_price} onValueChange={(value) => setFormData(p => ({ ...p, staff_price: Number(value) }))} prefix="$ " groupSeparator="." decimalSeparator="," placeholder="$ 40.000" />
                                        </Col>
                                        {/* --- NUEVO CAMPO DE COMISIÓN --- */}
                                        <Col md={3} className="mb-3">
                                            <Label>Comisión Personal (%)</Label>
                                            <Input 
                                                type="number" 
                                                value={formData.product_commission_percent || ''} 
                                                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, product_commission_percent: Number(e.target.value) }))}
                                                min={0}
                                                max={100}
                                                placeholder="Ej: 10"
                                            />
                                        </Col>
                                    </>
                                )}
                                <Col md={canSellToStaff ? 3 : 6} className="mb-3">
                                    <Label>Costo</Label>
                                    <CurrencyInput className="form-control" value={formData.cost_price} onValueChange={(value) => setFormData(p => ({ ...p, cost_price: Number(value) }))} prefix="$ " groupSeparator="." decimalSeparator="," placeholder="$ 30.000" />
                                </Col>

                                <Col md={canSellToStaff ? 6 : 12} className="mb-3">
                                    <Label>Stock</Label>
                                    <Input type="number" value={formData.stock || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, stock: Number(e.target.value) }))} required />
                                </Col>
                                {canSellToStaff && (
                                    <Col md={6} className="mb-3">
                                        <Label>Audiencia</Label>
                                        <Input type="select" value={formData.audience_type || 'cliente'} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, audience_type: e.target.value as any }))} required>
                                            <option value="cliente">Venta a Cliente</option>
                                            <option value="estilista">Uso Personal</option>
                                            <option value="ambos">Ambos</option>
                                        </Input>
                                    </Col>
                                )}

                                <Col md={12} className="mb-3"><Label>Descripción</Label><Input type="textarea" value={formData.description || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, description: e.target.value }))} /></Col>
                                <Col md={12} className="mb-3"><Label>Foto</Label><Input type="file" accept="image/*" onChange={handleFileChange} />
                                    {(imagePreview || (isEditMode && formData.image_url)) && (
                                        <div className="mt-3"><img src={imagePreview || (formData.image_url ? `${BACKEND_URL}${formData.image_url}` : '')} alt="preview" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} /></div>
                                    )}
                                </Col>
                            </Row>
                        </ModalBody>
                        <ModalFooter>
                            <Button type="button" color="light" onClick={() => { setModalOpen(false); resetFormAndImage(); }}>Cancelar</Button>
                            <Button type="submit" color="primary">Guardar</Button>
                        </ModalFooter>
                    </Form>
                </Modal>
                
                <CategoryManagerModal
                  isOpen={isCategoryManagerOpen}
                  toggle={() => setCategoryManagerOpen(false)}
                  title="Gestionar Categorías de Productos"
                  categories={categories}
                  onSave={handleUpdateCategory}
                  onDelete={handleDeleteCategory}
                />
            </Container>
        </div>
    );
};

export default ProductsPage;