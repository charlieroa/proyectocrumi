import { createAsyncThunk } from "@reduxjs/toolkit";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// =================== Dependencias ===================

// Se mantiene el Fake Backend para Companies, Leads y Deals
import {
  getCompanies as getCompaniesApi,
  getDeals as getDealsApi,
  getLeads as getLeadsApi,
  addNewCompanies as addNewCompaniesApi,
  updateCompanies as updateCompaniesApi,
  deleteCompanies as deleteCompaniesApi,
  addNewLead as addNewLeadApi,
  updateLead as updateLeadApi,
  deleteLead as deleteLeadApi
} from "../../helpers/fakebackend_helper";

// Se añaden las dependencias del Backend Real para Contacts (Clientes)
import api from '../../services/api';
import { getTenantIdFromToken } from '../../services/auth';


// ============================================================================
// --- CLIENTS / CONTACTS (Conexión a Backend Real) ---
// ============================================================================

const API_ENDPOINT_USERS = '/users';

// Renombramos fetchTenantClients a getContacts para que coincida con el nombre que usa el componente
export const getContacts = createAsyncThunk("crm/getContacts", async (_, { rejectWithValue }) => {
  const tenantId = getTenantIdFromToken();
  if (!tenantId) {
    return rejectWithValue({ error: 'No se pudo identificar el tenant.' });
  }
  try {
    const response = await api.get(`${API_ENDPOINT_USERS}/tenant/${tenantId}/clients`);
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data || { error: 'Error desconocido al buscar contactos' });
  }
});

// Renombramos createClient a addNewContact
export const addNewContact = createAsyncThunk("crm/addNewContact", async (contact: any, { rejectWithValue }) => {
  const tenantId = getTenantIdFromToken();
  if (!tenantId) {
    return rejectWithValue({ error: 'No se pudo identificar el tenant.' });
  }
  try {
    const dataToCreate = { ...contact, role_id: 4, tenant_id: tenantId };
    const response = await api.post(API_ENDPOINT_USERS, dataToCreate);
    toast.success("Contacto añadido con éxito", { autoClose: 3000 });
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || 'Error desconocido al crear contacto';
    toast.error(errorMessage, { autoClose: 3000 });
    return rejectWithValue({ error: errorMessage });
  }
});

// Renombramos updateClient a updateContact
export const updateContact = createAsyncThunk("crm/updateContact", async (contact: any, { rejectWithValue }) => {
  try {
    // El ID ya viene en el objeto contact que manda el componente
    const { id, ...clientData } = contact; 
    const response = await api.put(`${API_ENDPOINT_USERS}/${id}`, clientData);
    toast.success("Contacto actualizado con éxito", { autoClose: 3000 });
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || 'Error desconocido al actualizar contacto';
    toast.error(errorMessage, { autoClose: 3000 });
    return rejectWithValue({ error: errorMessage });
  }
});

// Renombramos deleteClient a deleteContact
export const deleteContact = createAsyncThunk("crm/deleteContact", async (contactId: any, { rejectWithValue }) => {
  try {
    await api.delete(`${API_ENDPOINT_USERS}/${contactId}`);
    toast.success("Contacto eliminado con éxito", { autoClose: 3000 });
    return contactId; // Devolvemos el ID para el reducer
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || 'Error desconocido al eliminar contacto';
    toast.error(errorMessage, { autoClose: 3000 });
    return rejectWithValue({ error: errorMessage });
  }
});


// ============================================================================
// --- COMPANIES, LEADS, DEALS (Aún con Fake Backend para no dañar la app) ---
// ============================================================================

export const getCompanies = createAsyncThunk("crm/getCompanies", async (_, { rejectWithValue }) => {
  try {
    const response = getCompaniesApi();
    return response;
  } catch (error) {
    return rejectWithValue(error);
  }
});

export const addNewCompanies = createAsyncThunk("crm/addNewCompanies", async (company: any, { rejectWithValue }) => {
  try {
    const response = await addNewCompaniesApi(company);
    toast.success("Compañía añadida con éxito", { autoClose: 3000 });
    return response;
  } catch (error) {
    toast.error("Error al añadir compañía", { autoClose: 3000 });
    return rejectWithValue(error);
  }
});

export const updateCompanies = createAsyncThunk("crm/updateCompanies", async (company: any, { rejectWithValue }) => {
  try {
    const response = await updateCompaniesApi(company);
    toast.success("Compañía actualizada con éxito", { autoClose: 3000 });
    return response;
  } catch (error) {
    toast.error("Error al actualizar compañía", { autoClose: 3000 });
    return rejectWithValue(error);
  }
});

export const deleteCompanies = createAsyncThunk("crm/deleteCompanies", async (companyId: any, { rejectWithValue }) => {
  try {
    const response = await deleteCompaniesApi(companyId);
    toast.success("Compañía eliminada con éxito", { autoClose: 3000 });
    return companyId;
  } catch (error) {
    toast.error("Error al eliminar compañía", { autoClose: 3000 });
    return rejectWithValue(error);
  }
});


export const getLeads = createAsyncThunk("crm/getLeads", async (_, { rejectWithValue }) => {
  try {
    return getLeadsApi();
  } catch (error) {
    return rejectWithValue(error);
  }
});

export const addNewLead = createAsyncThunk("crm/addNewLead", async (lead: any, { rejectWithValue }) => {
  try {
    const response = await addNewLeadApi(lead);
    toast.success("Lead añadido con éxito", { autoClose: 3000 });
    return response;
  } catch (error) {
    toast.error("Error al añadir Lead", { autoClose: 3000 });
    return rejectWithValue(error);
  }
});

export const updateLead = createAsyncThunk("crm/updateLead", async (lead: any, { rejectWithValue }) => {
  try {
    const response = await updateLeadApi(lead);
    toast.success("Lead actualizado con éxito", { autoClose: 3000 });
    return response;
  } catch (error) {
    toast.error("Error al actualizar Lead", { autoClose: 3000 });
    return rejectWithValue(error);
  }
});

export const deleteLead = createAsyncThunk("crm/deleteLead", async (leadId: any, { rejectWithValue }) => {
  try {
    await deleteLeadApi(leadId);
    toast.success("Lead eliminado con éxito", { autoClose: 3000 });
    return leadId;
  } catch (error) {
    toast.error("Error al eliminar Lead", { autoClose: 3000 });
    return rejectWithValue(error);
  }
});

export const getDeals = createAsyncThunk("crm/getDeals", async (_, { rejectWithValue }) => {
  try {
    const response = getDealsApi();
    return response;
  } catch (error) {
    return rejectWithValue(error);
  }
});