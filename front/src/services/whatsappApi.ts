/**
 * WhatsApp API service - REST calls to backend
 */

import { api } from './api';

// Session
export const startSession = () => api.post('/whatsapp/session/start');
export const logoutSession = () => api.post('/whatsapp/session/logout');
export const getSessionStatus = () => api.get('/whatsapp/session/status');

// Conversations
export const getConversations = (params?: { page?: number; limit?: number; status?: string }) =>
  api.get('/whatsapp/conversations', { params });

export const getMessages = (conversationId: number, params?: { page?: number; limit?: number }) =>
  api.get(`/whatsapp/conversations/${conversationId}/messages`, { params });

export const updateConversation = (conversationId: number, data: { handling_mode?: string; assigned_to?: number | null; status?: string }) =>
  api.patch(`/whatsapp/conversations/${conversationId}`, data);

// Messaging
export const sendMessage = (data: { conversationId: number; text: string; waId?: string; mediaUrl?: string; mediaType?: string }) =>
  api.post('/whatsapp/send', data);

// Groups
export const getGroups = () => api.get('/whatsapp/groups');
