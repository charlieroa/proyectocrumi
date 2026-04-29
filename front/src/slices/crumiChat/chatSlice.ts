import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agentId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface CrumiChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isTyping: boolean;
  streamingContent: string;
}

const initialState: CrumiChatState = {
  conversations: [],
  activeConversationId: null,
  isTyping: false,
  streamingContent: '',
};

const crumiChatSlice = createSlice({
  name: 'crumiChat',
  initialState,
  reducers: {
    createConversation(state, action: PayloadAction<{ id: string; title?: string }>) {
      const conv: Conversation = {
        id: action.payload.id,
        title: action.payload.title || 'Nueva conversación',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      state.conversations.unshift(conv);
      state.activeConversationId = conv.id;
    },

    setActiveConversation(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
      state.streamingContent = '';
    },

    addMessage(state, action: PayloadAction<{ conversationId: string; message: ChatMessage }>) {
      const conv = state.conversations.find(c => c.id === action.payload.conversationId);
      if (conv) {
        conv.messages.push(action.payload.message);
        conv.updatedAt = Date.now();
        // Auto-title from first user message
        if (conv.messages.length === 1 && action.payload.message.role === 'user') {
          conv.title = action.payload.message.content.slice(0, 50) + (action.payload.message.content.length > 50 ? '...' : '');
        }
      }
    },

    updateLastAssistantMessage(state, action: PayloadAction<{ conversationId: string; content: string }>) {
      const conv = state.conversations.find(c => c.id === action.payload.conversationId);
      if (conv) {
        const lastMsg = [...conv.messages].reverse().find(m => m.role === 'assistant');
        if (lastMsg) {
          lastMsg.content = action.payload.content;
        }
      }
    },

    deleteConversation(state, action: PayloadAction<string>) {
      state.conversations = state.conversations.filter(c => c.id !== action.payload);
      if (state.activeConversationId === action.payload) {
        state.activeConversationId = state.conversations[0]?.id || null;
      }
    },

    setTyping(state, action: PayloadAction<boolean>) {
      state.isTyping = action.payload;
    },

    setStreamingContent(state, action: PayloadAction<string>) {
      state.streamingContent = action.payload;
    },

    loadConversations(state, action: PayloadAction<Conversation[]>) {
      state.conversations = action.payload;
    },

    clearAllConversations(state) {
      state.conversations = [];
      state.activeConversationId = null;
      state.streamingContent = '';
    },
  },
});

export const {
  createConversation,
  setActiveConversation,
  addMessage,
  updateLastAssistantMessage,
  deleteConversation,
  setTyping,
  setStreamingContent,
  loadConversations,
  clearAllConversations,
} = crumiChatSlice.actions;

export default crumiChatSlice.reducer;
