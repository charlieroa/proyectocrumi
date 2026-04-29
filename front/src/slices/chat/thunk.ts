import { createAsyncThunk } from "@reduxjs/toolkit";

// =================== Dependencias del Chat (Fake Backend) ===================
// Se mantienen tus importaciones originales para la funcionalidad del chat
import {
  getDirectContact as getDirectContactApi,
  getMessages as getMessagesApi,
  addMessage as addMessageApi,
  deleteMessage as deleteMessageApi,
} from "../../helpers/fakebackend_helper";


// =================== Dependencias del CRM (Backend Real) ===================
// Añadimos las importaciones para conectar con nuestro backend real
import api from '../../services/api';
import { getTenantIdFromToken } from '../../services/auth';


// ============================================================================
// --- THUNKS PARA EL CHAT (Sin cambios) ---
// ============================================================================

export const getDirectContact = createAsyncThunk("chat/getDirectContact", async () => {
  try {
    const response = getDirectContactApi();
    return response;
  } catch (error) {
    return error;
  }
});

export const getMessages = createAsyncThunk("chat/getMessages", async (roomId: any) => {
  try {
    const response = getMessagesApi(roomId);
    const data = await response;
    return data;
  } catch (error) {
    return error;
  }
});

export const addMessage = createAsyncThunk("chat/addMessage", async (message: any) => {
  try {
    const response = addMessageApi(message);
    const data = await response;
    return data;
  } catch (error) {
    return error;
  }
});

export const deleteMessage = createAsyncThunk("chat/deleteMessage", async (message: any) => {
  try {
    const response = deleteMessageApi(message);
    const data = await response;
    return data;
  } catch (error) {
    return error;
  }
});


// ============================================================================
// --- NUEVOS THUNKS PARA EL CRM DE CLIENTES ---
// ============================================================================

const API_ENDPOINT_USERS = '/users'; // Endpoint base para usuarios/clientes

// 1. LEER (Listar Clientes del CRM)
export const fetchTenantClients = createAsyncThunk(
  'crm/fetchTenantClients',
  async (_, { rejectWithValue }) => {
    const tenantId = getTenantIdFromToken();
    if (!tenantId) {
      return rejectWithValue({ error: 'No se pudo identificar el tenant.' });
    }
    
    try {
      const response = await api.get(`${API_ENDPOINT_USERS}/tenant/${tenantId}/clients`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || { error: 'Error desconocido al buscar clientes' });
    }
  }
);

// 2. CREAR un nuevo Cliente
export const createClient = createAsyncThunk(
  'crm/createClient',
  async (clientData: any, { rejectWithValue }) => {
    const tenantId = getTenantIdFromToken();
    if (!tenantId) {
      return rejectWithValue({ error: 'No se pudo identificar el tenant.' });
    }
    
    try {
      const dataToCreate = { ...clientData, role_id: 4, tenant_id: tenantId };
      const response = await api.post(API_ENDPOINT_USERS, dataToCreate);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || { error: 'Error desconocido al crear cliente' });
    }
  }
);

// 3. ACTUALIZAR un Cliente existente
export const updateClient = createAsyncThunk(
  'crm/updateClient',
  async ({ id, clientData }: { id: any, clientData: any }, { rejectWithValue }) => {
    try {
      const response = await api.put(`${API_ENDPOINT_USERS}/${id}`, clientData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || { error: 'Error desconocido al actualizar cliente' });
    }
  }
);

// 4. ELIMINAR un Cliente
export const deleteClient = createAsyncThunk(
  'crm/deleteClient',
  async (id: any, { rejectWithValue }) => {
    try {
      await api.delete(`${API_ENDPOINT_USERS}/${id}`);
      return id; // Devolvemos el ID para facilitar la eliminación en el reducer
    } catch (error: any) {
      return rejectWithValue(error.response?.data || { error: 'Error desconocido al eliminar cliente' });
    }
  }
);