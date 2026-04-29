// En: src/slices/products/thunk.ts
import { createAsyncThunk } from "@reduxjs/toolkit";
import Swal from 'sweetalert2';
import * as productApi from "../../services/productApi";
import { Product } from "../../services/productApi";

// --- Thunks de Productos ---

export const fetchProducts = createAsyncThunk(
    "products/fetchProducts",
    async (_, { rejectWithValue }) => {
        try {
            const response = await productApi.getProducts();
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || "Error de servidor");
        }
    }
);

export const createNewProduct = createAsyncThunk(
    "products/createNewProduct",
    async (data: { productData: Omit<Product, 'id'>, imageFile?: File }, { rejectWithValue }) => {
        try {
            const response = await productApi.createProduct(data.productData);
            const newProduct = response.data;
            if (data.imageFile && newProduct.id) {
                const imageResponse = await productApi.uploadProductImage(newProduct.id, data.imageFile);
                Swal.fire({ title: "¡Creado!", text: "El producto y su imagen se han creado con éxito.", icon: "success", timer: 2000 });
                return imageResponse.data;
            }
            Swal.fire({ title: "¡Creado!", text: "El producto se ha creado con éxito.", icon: "success", timer: 2000 });
            return newProduct;
        } catch (error: any) {
            Swal.fire({ title: "Error", text: error.response?.data?.error || "No se pudo crear el producto.", icon: "error" });
            return rejectWithValue(error.response?.data);
        }
    }
);

export const updateExistingProduct = createAsyncThunk(
    "products/updateProduct",
    async (data: { id: string, productData: Partial<Product> }, { rejectWithValue }) => {
        try {
            const response = await productApi.updateProduct(data.id, data.productData);
            Swal.fire({ title: "¡Actualizado!", text: "El producto se ha actualizado con éxito.", icon: "success", timer: 2000 });
            return response.data;
        } catch (error: any) {
            Swal.fire({ title: "Error", text: error.response?.data?.error || "No se pudo actualizar el producto.", icon: "error" });
            return rejectWithValue(error.response?.data);
        }
    }
);

export const deleteExistingProduct = createAsyncThunk(
    "products/deleteProduct",
    async (id: string, { rejectWithValue }) => {
        try {
            await productApi.deleteProduct(id);
            // La confirmación visual ya la da SweetAlert en el componente antes de llamar a este thunk
            return id;
        } catch (error: any) {
            Swal.fire({ title: "Error", text: error.response?.data?.error || "No se pudo eliminar el producto.", icon: "error" });
            return rejectWithValue(error.response?.data);
        }
    }
);

export const uploadProductImage = createAsyncThunk(
    "products/uploadImage",
    async (data: { id: string, imageFile: File }, { rejectWithValue }) => {
        try {
            const response = await productApi.uploadProductImage(data.id, data.imageFile);
            Swal.fire({ title: "¡Éxito!", text: "Imagen subida correctamente.", icon: "success", timer: 2000 });
            return response.data;
        } catch (error: any) {
            Swal.fire({ title: "Error", text: error.response?.data?.error || "No se pudo subir la imagen.", icon: "error" });
            return rejectWithValue(error.response?.data);
        }
    }
);

// --- Thunks de Categorías ---

export const fetchProductCategories = createAsyncThunk(
    "products/fetchProductCategories",
    async (_, { rejectWithValue }) => {
        try {
            const response = await productApi.getProductCategories();
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.error || "Error al cargar categorías");
        }
    }
);

export const createNewCategory = createAsyncThunk(
    "products/createCategory",
    async (categoryName: string, { rejectWithValue }) => {
        try {
            const response = await productApi.createCategory({ name: categoryName });
            Swal.fire({ title: "¡Éxito!", text: `Categoría "${categoryName}" creada.`, icon: "success", timer: 2000 });
            return response.data;
        } catch (error: any) {
            Swal.fire({ title: "Error", text: error.response?.data?.error || "No se pudo crear la categoría.", icon: "error" });
            return rejectWithValue(error.response?.data);
        }
    }
);

export const updateExistingCategory = createAsyncThunk(
    "products/updateCategory",
    async (data: { id: string, name: string }, { rejectWithValue }) => {
        try {
            const response = await productApi.updateCategory(data.id, { name: data.name });
            Swal.fire({ title: "¡Actualizada!", text: "Categoría actualizada con éxito.", icon: "success", timer: 2000 });
            return response.data;
        } catch (error: any) {
            Swal.fire({ title: "Error", text: error.response?.data?.error || "No se pudo actualizar la categoría.", icon: "error" });
            return rejectWithValue(error.response?.data);
        }
    }
);

export const deleteExistingCategory = createAsyncThunk(
    "products/deleteCategory",
    async (id: string, { rejectWithValue }) => {
        try {
            await productApi.deleteCategory(id);
            // La confirmación ya se hizo en el componente
            return id;
        } catch (error: any) {
            Swal.fire({ title: "Error", text: error.response?.data?.error || "No se pudo eliminar la categoría.", icon: "error" });
            return rejectWithValue(error.response?.data);
        }
    }
);