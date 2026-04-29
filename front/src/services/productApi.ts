// En: src/services/productApi.ts
import api from "./api"; // Asumo que esta es tu instancia central de Axios

export interface ItemPrice {
  price_list_id: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  dian_uom_code?: string;
  tax_rate?: number;
  retention_rate?: number;
  tax_charge_id?: number | null;
  is_inventoriable?: boolean;
  visible_in_invoices?: boolean;
  include_iva_in_price?: boolean;
  cost_price?: number;
  sale_price: number;
  price?: number;
  cost?: number;
  stock: number;
  category_id?: string;
  category_name?: string;
  image_url?: string;
  is_active?: boolean;
  prices?: ItemPrice[];
  // Campos legados (modelo de salón); aún devueltos por backend, opcionales:
  staff_price?: number;
  audience_type?: 'cliente' | 'estilista' | 'ambos';
  product_commission_percent?: number;
}

export interface ProductCategory { 
  id: string; 
  name: string; 
}

// ======================================================
// ========= API para PRODUCTOS (Sin cambios) =========
// ======================================================

export const getProducts = () => api.get<Product[]>('/products');
export const createProduct = (productData: Omit<Product, 'id'>) => api.post<Product>('/products', productData);
export const updateProduct = (id: string, productData: Partial<Product>) => api.put<Product>(`/products/${id}`, productData);
export const deleteProduct = (id: string) => api.delete(`/products/${id}`);
export const uploadProductImage = (id: string, imageFile: File) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return api.post<Product>(`/products/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

// =================================================================
// ========= API para CATEGORÍAS DE PRODUCTOS (Sin cambios) =========
// =================================================================

// LEER todas las categorías
export const getProductCategories = () => api.get<ProductCategory[]>('/product-categories');

// CREAR una nueva categoría
export const createCategory = (categoryData: { name: string }) => 
  api.post<ProductCategory>('/product-categories', categoryData);

// ACTUALIZAR una categoría existente
export const updateCategory = (id: string, categoryData: { name:string }) => 
  api.put<ProductCategory>(`/product-categories/${id}`, categoryData);

// ELIMINAR una categoría existente
export const deleteCategory = (id: string) => 
  api.delete(`/product-categories/${id}`);