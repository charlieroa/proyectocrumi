import type { Conversation } from '../slices/crumiChat/chatSlice';

const STORAGE_KEY = 'crumi_chat_conversations';

export const saveConversations = (conversations: Conversation[]): void => {
  try {
    // Keep only last 50 conversations to avoid storage bloat
    const toSave = conversations.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (error) {
    console.warn('Error saving chat conversations to localStorage:', error);
  }
};

export const loadConversations = (): Conversation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

export const clearConversations = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
