import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
    getProducts, addNewProduct, updateProduct, deleteProducts,
    getOrders, addNewOrder, updateOrder, deleteOrder,
    getCustomers, addNewCustomer, updateCustomer, deleteCustomer,
    getSellers
} from './thunk';

// ===================================================================
// 1. INTERFACES: Definimos la forma de nuestros datos
// ===================================================================
interface Product {
    id: string | number;
    [key: string]: any; // Permite otras propiedades que no conocemos
}
interface Order {
    id: string | number;
    [key: string]: any;
}
interface Seller {
    id: string | number;
    [key: string]: any;
}
interface Customer {
    id: string | number;
    [key: string]: any;
}

// Interfaz para la forma completa del estado de este slice
export interface EcommerceState {
    products: Product[];
    orders: Order[];
    sellers: Seller[];
    customers: Customer[];
    error: object | string | null;
    loading: boolean;
}

// ===================================================================
// 2. ESTADO INICIAL: Usamos la interfaz para asegurar que es correcto
// ===================================================================
export const initialState: EcommerceState = {
    products: [],
    orders: [],
    sellers: [],
    customers: [],
    error: null,
    loading: false,
};

// ===================================================================
// 3. SLICE: Creamos el reducer con la lógica correcta y tipada
// ===================================================================
const EcommerceSlice = createSlice({
    name: 'EcommerceSlice',
    initialState,
    reducers: {},
    extraReducers: (builder) => {

        // --- Casos de Productos ---
        builder.addCase(getProducts.fulfilled, (state, action: PayloadAction<Product[]>) => {
            state.products = action.payload;
        });
        builder.addCase(addNewProduct.fulfilled, (state, action: PayloadAction<Product>) => {
            state.products.unshift(action.payload); // Añade al principio
        });
        builder.addCase(updateProduct.fulfilled, (state, action: PayloadAction<Product>) => {
            state.products = state.products.map((product) =>
                product.id === action.payload.id ? action.payload : product
            );
        });
        builder.addCase(deleteProducts.fulfilled, (state, action: PayloadAction<{ product: Product }>) => {
            state.products = state.products.filter(
                (product) => product.id !== action.payload.product.id
            );
        });

        // --- Casos de Órdenes ---
        builder.addCase(getOrders.fulfilled, (state, action: PayloadAction<Order[]>) => {
            state.orders = action.payload;
        });
        builder.addCase(addNewOrder.fulfilled, (state, action: PayloadAction<Order>) => {
            state.orders.unshift(action.payload);
        });
        builder.addCase(updateOrder.fulfilled, (state, action: PayloadAction<Order>) => {
            state.orders = state.orders.map((order) =>
                order.id === action.payload.id ? action.payload : order
            );
        });
        builder.addCase(deleteOrder.fulfilled, (state, action: PayloadAction<{ order: Order }>) => {
            state.orders = state.orders.filter(
                (order) => order.id !== action.payload.order.id
            );
        });

        // --- Casos de Clientes ---
        builder.addCase(getCustomers.fulfilled, (state, action: PayloadAction<Customer[]>) => {
            state.customers = action.payload;
        });
        builder.addCase(addNewCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
            state.customers.unshift(action.payload);
        });
        builder.addCase(updateCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
            state.customers = state.customers.map((customer) =>
                customer.id === action.payload.id ? action.payload : customer
            );
        });
        builder.addCase(deleteCustomer.fulfilled, (state, action: PayloadAction<{ customer: Customer }>) => {
            state.customers = state.customers.filter(
                (customer) => customer.id !== action.payload.customer.id
            );
        });

        // --- Caso de Vendedores ---
        builder.addCase(getSellers.fulfilled, (state, action: PayloadAction<Seller[]>) => {
            state.sellers = action.payload;
        });

        // --- MANEJO CENTRALIZADO DE ESTADOS DE CARGA Y ERRORES ---
        builder
            .addMatcher(
                (action) => action.type.endsWith('/pending'),
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )
            .addMatcher(
                (action) => action.type.endsWith('/fulfilled'),
                (state) => {
                    state.loading = false;
                }
            )
            .addMatcher(
                (action) => action.type.endsWith('/rejected'),
                (state, action: PayloadAction<any>) => {
                    state.loading = false;
                    state.error = action.payload || 'Ocurrió un error desconocido';
                }
            );
    }
});

export default EcommerceSlice.reducer;