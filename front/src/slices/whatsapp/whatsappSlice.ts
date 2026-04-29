import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface WaMessage {
  id: number;
  conversation_id: number;
  wa_message_id: string;
  direction: 'inbound' | 'outbound';
  content_type: string;
  content_text: string;
  content_media_url?: string;
  content_payload?: any;
  status: string;
  handled_by?: string;
  sender_name?: string;
  created_at: string;
}

export interface WaConversation {
  id: number;
  tenant_id: number;
  contact_id: number;
  status: string;
  handling_mode: string;
  assigned_to?: number;
  unread_count: number;
  last_message_at: string;
  last_message_preview: string;
  created_at: string;
  // Joined from wa_contacts
  wa_id: string;
  contact_name: string;
  push_name: string;
  phone: string;
  avatar_url?: string;
  is_group: boolean;
}

export interface WaGroup {
  id: string;
  subject: string;
  participants: number;
  creation: number;
  desc?: string;
}

interface WhatsAppState {
  sessionStatus: 'disconnected' | 'qr_pending' | 'connected' | 'reconnecting';
  qrCode: string | null;
  phoneNumber: string | null;
  conversations: WaConversation[];
  activeConversationId: number | null;
  messages: Record<number, WaMessage[]>;
  groups: WaGroup[];
  loading: boolean;
  sendingMessage: boolean;
}

const initialState: WhatsAppState = {
  sessionStatus: 'disconnected',
  qrCode: null,
  phoneNumber: null,
  conversations: [],
  activeConversationId: null,
  messages: {},
  groups: [],
  loading: false,
  sendingMessage: false,
};

const whatsappSlice = createSlice({
  name: 'whatsapp',
  initialState,
  reducers: {
    setSessionStatus(state, action: PayloadAction<{ status: WhatsAppState['sessionStatus']; phoneNumber?: string }>) {
      state.sessionStatus = action.payload.status;
      if (action.payload.phoneNumber) {
        state.phoneNumber = action.payload.phoneNumber;
      }
      if (action.payload.status === 'connected') {
        state.qrCode = null;
      }
    },

    setQrCode(state, action: PayloadAction<string>) {
      state.qrCode = action.payload;
      state.sessionStatus = 'qr_pending';
    },

    setConversations(state, action: PayloadAction<WaConversation[]>) {
      state.conversations = action.payload;
      state.loading = false;
    },

    setActiveConversation(state, action: PayloadAction<number | null>) {
      state.activeConversationId = action.payload;
      // Reset unread count for this conversation
      if (action.payload) {
        const conv = state.conversations.find(c => c.id === action.payload);
        if (conv) conv.unread_count = 0;
      }
    },

    setMessages(state, action: PayloadAction<{ conversationId: number; messages: WaMessage[] }>) {
      state.messages[action.payload.conversationId] = action.payload.messages;
    },

    addMessage(state, action: PayloadAction<{ message: WaMessage; conversation?: Partial<WaConversation> }>) {
      const { message, conversation } = action.payload;
      const convId = message.conversation_id;

      // Add message to list
      if (!state.messages[convId]) {
        state.messages[convId] = [];
      }
      // Avoid duplicates
      if (!state.messages[convId].find(m => m.id === message.id)) {
        state.messages[convId].push(message);
      }

      // Update conversation preview
      if (conversation) {
        const idx = state.conversations.findIndex(c => c.id === convId);
        if (idx !== -1) {
          state.conversations[idx] = {
            ...state.conversations[idx],
            ...conversation,
          } as WaConversation;
          // If not active, increment unread
          if (message.direction === 'inbound' && state.activeConversationId !== convId) {
            state.conversations[idx].unread_count = (state.conversations[idx].unread_count || 0) + 1;
          }
        }
      }

      // Move conversation to top
      const convIdx = state.conversations.findIndex(c => c.id === convId);
      if (convIdx > 0) {
        const [conv] = state.conversations.splice(convIdx, 1);
        state.conversations.unshift(conv);
      }
    },

    updateMessageStatus(state, action: PayloadAction<{ waMessageId: string; status: string }>) {
      for (const convId of Object.keys(state.messages)) {
        const msgs = state.messages[Number(convId)];
        const msg = msgs?.find(m => m.wa_message_id === action.payload.waMessageId);
        if (msg) {
          msg.status = action.payload.status;
          break;
        }
      }
    },

    setGroups(state, action: PayloadAction<WaGroup[]>) {
      state.groups = action.payload;
    },

    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },

    setSendingMessage(state, action: PayloadAction<boolean>) {
      state.sendingMessage = action.payload;
    },

    addConversation(state, action: PayloadAction<WaConversation>) {
      if (!state.conversations.find(c => c.id === action.payload.id)) {
        state.conversations.unshift(action.payload);
      }
    },

    resetWhatsApp() {
      return initialState;
    },
  },
});

export const {
  setSessionStatus,
  setQrCode,
  setConversations,
  setActiveConversation,
  setMessages,
  addMessage,
  updateMessageStatus,
  setGroups,
  setLoading,
  setSendingMessage,
  addConversation,
  resetWhatsApp,
} = whatsappSlice.actions;

export default whatsappSlice.reducer;
