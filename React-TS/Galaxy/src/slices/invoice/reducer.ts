import { createSlice } from "@reduxjs/toolkit";
import { getInvoices, addNewInvoice, updateInvoice, deleteInvoice } from './thunk';
export const initialState = {
  invoices: [],
  error: {},
};


const InvoiceSlice = createSlice({
  name: 'InvoiceSlice',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInvoices.fulfilled, (state:any, action:any) => {
      state.invoices = action.payload;
      state.isInvoiceCreated = false;
      state.isInvoiceSuccess = true;
    });
    builder.addCase(getInvoices.rejected, (state:any, action:any) => {
      state.error = action.payload.error || null;
      state.isInvoiceCreated = false;
      state.isInvoiceSuccess = false;
    });
    builder.addCase(addNewInvoice.fulfilled, (state:any, action:any) => {
      state.invoices.push(action.payload);
      state.isInvoiceCreated = true;
    });
    builder.addCase(addNewInvoice.rejected, (state:any, action:any) => {
      state.error = action.payload.error || null;
    });
    builder.addCase(updateInvoice.fulfilled, (state:any, action:any) => {
      state.invoices = state.invoices.map((invoice: any) =>
        invoice.id === action.payload.id
          ? { ...invoice, ...action.payload.invoice }
          : invoice
      );
    });
    builder.addCase(updateInvoice.rejected, (state:any, action:any) => {
      state.error = action.payload.error || null;
    });
    builder.addCase(deleteInvoice.fulfilled, (state:any, action:any) => {
      state.invoices = state.invoices.filter(
        (invoice: any) => invoice.id !== action.payload.invoice
      );
    });
    builder.addCase(deleteInvoice.rejected, (state:any, action:any) => {
      state.error = action.payload.error || null;
    });
  }
});

export default InvoiceSlice.reducer;