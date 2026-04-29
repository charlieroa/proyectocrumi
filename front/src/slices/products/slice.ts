// En: src/slices/products/slice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
    fetchProducts,
    fetchProductCategories,
    createNewProduct,
    updateExistingProduct,
    deleteExistingProduct,
    uploadProductImage,
    // --- NUEVOS THUNKS IMPORTADOS ---
    createNewCategory,
    updateExistingCategory,
    deleteExistingCategory
} from './thunk';
import { Product, ProductCategory } from "../../services/productApi";

// La estructura del estado no cambia, ya estaba preparada para esto.
export interface ProductsState {
    products: Product[];
    categories: ProductCategory[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

export const initialState: ProductsState = {
    products: [],
    categories: [],
    status: 'idle',
    error: null,
};

const productSlice = createSlice({
    name: 'products',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        // --- Casos para Productos (Sin cambios) ---
        builder.addCase(fetchProducts.pending, (state) => {
            state.status = 'loading';
            state.error = null;
        });
        builder.addCase(fetchProducts.fulfilled, (state, action: PayloadAction<Product[]>) => {
            state.status = 'succeeded';
            state.products = action.payload;
        });
        builder.addCase(fetchProducts.rejected, (state, action) => {
            state.status = 'failed';
            state.error = action.payload as string;
        });
        
        builder.addCase(createNewProduct.fulfilled, (state, action: PayloadAction<Product>) => {
            state.products.unshift(action.payload);
        });
        
        const handleProductUpdate = (state: ProductsState, action: PayloadAction<Product>) => {
             state.products = state.products.map((product) =>
                product.id === action.payload.id ? action.payload : product
            );
        };
        builder.addCase(updateExistingProduct.fulfilled, handleProductUpdate);
        builder.addCase(uploadProductImage.fulfilled, handleProductUpdate);
        
        builder.addCase(deleteExistingProduct.fulfilled, (state, action: PayloadAction<string>) => {
            state.products = state.products.filter(
                (product) => product.id !== action.payload
            );
        });

        // --- Casos para Categorías ---
        builder.addCase(fetchProductCategories.fulfilled, (state, action: PayloadAction<ProductCategory[]>) => {
            state.categories = action.payload;
        });

        // --- NUEVOS CASOS PARA GESTIONAR CATEGORÍAS ---

        // Cuando una categoría se crea con éxito, la añadimos al estado
        builder.addCase(createNewCategory.fulfilled, (state, action: PayloadAction<ProductCategory>) => {
            state.categories.push(action.payload);
        });

        // Cuando una categoría se actualiza, la reemplazamos en el estado
        builder.addCase(updateExistingCategory.fulfilled, (state, action: PayloadAction<ProductCategory>) => {
            state.categories = state.categories.map(cat => 
                cat.id === action.payload.id ? action.payload : cat
            );
        });

        // Cuando una categoría se elimina, la quitamos del estado
        builder.addCase(deleteExistingCategory.fulfilled, (state, action: PayloadAction<string>) => {
            state.categories = state.categories.filter(cat => cat.id !== action.payload);
        });
    }
});

export default productSlice.reducer;