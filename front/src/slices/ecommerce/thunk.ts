import { createAsyncThunk } from "@reduxjs/toolkit";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import {
    getProducts as getProductsApi,
    deleteProducts as deleteProductsApi,
    getOrders as getOrdersApi,
    getSellers as getSellersApi,
    getCustomers as getCustomersApi,
    updateOrder as updateOrderApi,
    deleteOrder as deleteOrderApi,
    addNewOrder as addNewOrderApi,
    addNewCustomer as addNewCustomerApi,
    updateCustomer as updateCustomerApi,
    deleteCustomer as deleteCustomerApi,
    addNewProduct as addNewProductApi,
    updateProduct as updateProductApi
} from "../../helpers/fakebackend_helper";

// Interfaces para tipado
interface Product { id: string | number; [key: string]: any; }
interface Order { id: string | number; [key: string]: any; }
interface Customer { id: string | number; [key: string]: any; }
interface Seller { id: string | number; [key: string]: any; }


// --- Thunks para Productos ---

export const getProducts = createAsyncThunk<Product[]>("ecommerce/getProducts", async (_, { rejectWithValue }) => {
    try {
        const response = await getProductsApi();
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        return rejectWithValue(error.response.data || "Error al obtener productos");
    }
});

export const addNewProduct = createAsyncThunk<Product, Product>("ecommerce/addNewProduct", async (product, { rejectWithValue }) => {
    try {
        const response = await addNewProductApi(product);
        toast.success("Producto añadido con éxito", { autoClose: 3000 });
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        toast.error("Falló al añadir el producto", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al añadir producto");
    }
});

export const updateProduct = createAsyncThunk<Product, Product>("ecommerce/updateProduct", async (product, { rejectWithValue }) => {
    try {
        const response = await updateProductApi(product);
        toast.success("Producto actualizado con éxito", { autoClose: 3000 });
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        toast.error("Falló al actualizar el producto", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al actualizar producto");
    }
});

export const deleteProducts = createAsyncThunk<{ product: Product }, Product>("ecommerce/deleteProducts", async (product, { rejectWithValue }) => {
    try {
        await deleteProductsApi(product);
        toast.success("Producto eliminado con éxito", { autoClose: 3000 });
        // Este se queda igual porque el reducer lo espera así
        return { product };
    } catch (error: any) {
        toast.error("Falló al eliminar el producto", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al eliminar producto");
    }
});


// --- Thunks para Órdenes ---

export const getOrders = createAsyncThunk<Order[]>("ecommerce/getOrders", async (_, { rejectWithValue }) => {
    try {
        const response = await getOrdersApi();
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        return rejectWithValue(error.response.data || "Error al obtener órdenes");
    }
});

export const addNewOrder = createAsyncThunk<Order, Order>("ecommerce/addNewOrder", async (order, { rejectWithValue }) => {
    try {
        const response = await addNewOrderApi(order);
        toast.success("Orden añadida con éxito", { autoClose: 3000 });
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        toast.error("Falló al añadir la orden", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al añadir orden");
    }
});

export const updateOrder = createAsyncThunk<Order, Order>("ecommerce/updateOrder", async (order, { rejectWithValue }) => {
    try {
        const response = await updateOrderApi(order);
        toast.success("Orden actualizada con éxito", { autoClose: 3000 });
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        toast.error("Falló al actualizar la orden", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al actualizar orden");
    }
});

export const deleteOrder = createAsyncThunk<{ order: Order }, Order>("ecommerce/deleteOrder", async (order, { rejectWithValue }) => {
    try {
        await deleteOrderApi(order);
        toast.success("Orden eliminada con éxito", { autoClose: 3000 });
        return { order };
    } catch (error: any) {
        toast.error("Falló al eliminar la orden", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al eliminar orden");
    }
});


// --- Thunks para Clientes ---

export const getCustomers = createAsyncThunk<Customer[]>("ecommerce/getCustomers", async (_, { rejectWithValue }) => {
    try {
        const response = await getCustomersApi();
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        return rejectWithValue(error.response.data || "Error al obtener clientes");
    }
});

export const addNewCustomer = createAsyncThunk<Customer, Customer>("ecommerce/addNewCustomer", async (customer, { rejectWithValue }) => {
    try {
        const response = await addNewCustomerApi(customer);
        toast.success("Cliente añadido con éxito", { autoClose: 3000 });
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        toast.error("Falló al añadir el cliente", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al añadir cliente");
    }
});

export const updateCustomer = createAsyncThunk<Customer, Customer>("ecommerce/updateCustomer", async (customer, { rejectWithValue }) => {
    try {
        const response = await updateCustomerApi(customer);
        toast.success("Cliente actualizado con éxito", { autoClose: 3000 });
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        toast.error("Falló al actualizar el cliente", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al actualizar cliente");
    }
});

export const deleteCustomer = createAsyncThunk<{ customer: Customer }, Customer>("ecommerce/deleteCustomer", async (customer, { rejectWithValue }) => {
    try {
        await deleteCustomerApi(customer);
        toast.success("Cliente eliminado con éxito", { autoClose: 3000 });
        return { customer };
    } catch (error: any) {
        toast.error("Falló al eliminar el cliente", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al eliminar cliente");
    }
});


// --- Thunk para Vendedores ---

export const getSellers = createAsyncThunk<Seller[]>("ecommerce/getSellers", async (_, { rejectWithValue }) => {
    try {
        const response = await getSellersApi();
        return response.data; // <-- ¡CORRECCIÓN CLAVE AQUÍ!
    } catch (error: any) {
        toast.error("Error al obtener vendedores", { autoClose: 3000 });
        return rejectWithValue(error.response.data || "Error al obtener vendedores");
    }
});