import { createSlice } from "@reduxjs/toolkit";
// Se importan todos los thunks, tanto los reales como los de prueba
import { getContacts, getCompanies, getDeals, getLeads, addNewContact, updateContact, deleteContact, addNewCompanies, updateCompanies, deleteCompanies, addNewLead, updateLead, deleteLead } from './thunk';

export const initialState: any = {
  // Estado para nuestros contactos/clientes reales
  crmcontacts: [],
  loading: false, // Un único estado de carga para todas las operaciones de CRM
  error: null,    // Un único lugar para todos los errores

  // Mantenemos los otros estados para que el resto de la app no se rompa
  companies: [],
  deals: [],
  leads: [],
};

const crmSlice = createSlice({
  name: "Crm", // Nombre del Slice
  initialState,
  reducers: {}, // No se necesitan reducers síncronos por ahora
  extraReducers: (builder) => {

    // ============================================================================
    // --- LÓGICA REAL PARA CONTACTS/CLIENTS ---
    // ============================================================================

    // --- LEER CONTACTOS ---
    builder.addCase(getContacts.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getContacts.fulfilled, (state, action) => {
      state.loading = false;
      state.crmcontacts = action.payload;
    });
    builder.addCase(getContacts.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || { error: "Error desconocido" };
    });

    // --- CREAR CONTACTO ---
    builder.addCase(addNewContact.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(addNewContact.fulfilled, (state, action) => {
      state.loading = false;
      state.crmcontacts.unshift(action.payload); // Añade al principio
    });
    builder.addCase(addNewContact.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || { error: "Error desconocido" };
    });

    // --- ACTUALIZAR CONTACTO ---
    builder.addCase(updateContact.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(updateContact.fulfilled, (state: any, action: any) => {
      state.loading = false;
      state.crmcontacts = state.crmcontacts.map((contact: any) =>
        contact.id === action.payload.id ? action.payload : contact
      );
    });
    builder.addCase(updateContact.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || { error: "Error desconocido" };
    });

    // --- ELIMINAR CONTACTO ---
    builder.addCase(deleteContact.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(deleteContact.fulfilled, (state: any, action: any) => {
      state.loading = false;
      // El thunk devuelve el ID del contacto eliminado
      state.crmcontacts = state.crmcontacts.filter((contact: any) => contact.id !== action.payload);
    });
    builder.addCase(deleteContact.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload || { error: "Error desconocido" };
    });


    // ============================================================================
    // --- LÓGICA ANTIGUA PARA COMPANIES, LEADS, DEALS (SIN CAMBIOS) ---
    // ============================================================================

    builder.addCase(getCompanies.fulfilled, (state: any, action: any) => {
      state.companies = action.payload;
    });
    builder.addCase(getCompanies.rejected, (state: any, action: any) => {
      state.error = action.payload.error || null;
    });
    builder.addCase(addNewCompanies.fulfilled, (state: any, action: any) => {
      state.companies.push(action.payload);
    });
    builder.addCase(addNewCompanies.rejected, (state: any, action: any) => {
      state.error = action.payload.error || null;
    });
    builder.addCase(updateCompanies.fulfilled, (state: any, action: any) => {
      state.companies = state.companies.map((company: any) =>
        company.id === action.payload.id ? { ...company, ...action.payload } : company);
    });
    builder.addCase(updateCompanies.rejected, (state: any, action: any) => {
      state.error = action.payload.error || null;
    });
    builder.addCase(deleteCompanies.fulfilled, (state: any, action: any) => {
      state.companies = state.companies.filter(
        (company: any) => company.id.toString() !== action.payload.toString());
    });
    builder.addCase(deleteCompanies.rejected, (state: any, action: any) => {
      state.error = action.payload.error || null;
    });

    builder.addCase(getDeals.fulfilled, (state: any, action: any) => {
      state.deals = action.payload;
    });
    builder.addCase(getDeals.rejected, (state: any, action: any) => {
      state.error = action.payload.error || null;
    });

    builder.addCase(getLeads.fulfilled, (state: any, action: any) => {
      state.leads = action.payload;
    });
    builder.addCase(getLeads.rejected, (state: any, action: any) => {
      state.error = action.payload.error || null;
    });
    builder.addCase(addNewLead.fulfilled, (state: any, action: any) => {
      state.leads.push(action.payload);
    });
    builder.addCase(addNewLead.rejected, (state: any, action: any) => {
      state.error = action.payload.error || null;
    });
    builder.addCase(updateLead.fulfilled, (state: any, action: any) => {
      state.leads = state.leads.map((lead: any) =>
        lead.id === action.payload.id
          ? { ...lead, ...action.payload }
          : lead);
    });
    builder.addCase(updateLead.rejected, (state: any, action: any) => {
      state.error = action.payload.error || null;
    });
    builder.addCase(deleteLead.fulfilled, (state: any, action: any) => {
      state.leads = state.leads.filter(
        (lead: any) => lead.id.toString() !== action.payload.toString()
      );
    });
    builder.addCase(deleteLead.rejected, (state: any, action: any) => {
      state.error = action.payload.error || null;
    });
  },
});

export default crmSlice.reducer;