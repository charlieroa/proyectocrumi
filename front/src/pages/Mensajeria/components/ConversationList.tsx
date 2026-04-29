import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Search } from 'lucide-react';
import type { RootState } from '../../../store';
import { setConversations, setActiveConversation, setLoading, setMessages } from '../../../slices/whatsapp/whatsappSlice';
import * as waApi from '../../../services/whatsappApi';

interface ConversationListProps {
  darkMode: boolean;
}

const ConversationList: React.FC<ConversationListProps> = ({ darkMode }) => {
  const dispatch = useDispatch();
  const { conversations, activeConversationId, loading } = useSelector((state: RootState) => state.whatsapp);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    dispatch(setLoading(true));
    try {
      const res = await waApi.getConversations();
      dispatch(setConversations(res.data.conversations));
    } catch (err) {
      console.error('[ConversationList] Error loading:', err);
    }
  };

  const handleSelect = async (convId: number) => {
    dispatch(setActiveConversation(convId));
    try {
      const res = await waApi.getMessages(convId);
      dispatch(setMessages({ conversationId: convId, messages: res.data.messages }));
    } catch (err) {
      console.error('[ConversationList] Error loading messages:', err);
    }
  };

  const filtered = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.contact_name || '').toLowerCase().includes(q) ||
      (c.push_name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.last_message_preview || '').toLowerCase().includes(q)
    );
  });

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className={`flex flex-col h-full ${darkMode ? 'bg-[#111315]' : 'bg-white'}`}>
      {/* Search */}
      <div className="p-3 shrink-0">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${darkMode ? 'bg-[#1A1D1F]' : 'bg-gray-50'}`}>
          <Search size={16} className={darkMode ? 'text-gray-500' : 'text-gray-400'} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversaciones..."
            className={`flex-1 bg-transparent border-none outline-none text-sm
              ${darkMode ? 'text-white placeholder:text-gray-500' : 'text-gray-900 placeholder:text-gray-400'}
            `}
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto crumi-scrollbar">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-crumi-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {searchQuery ? 'Sin resultados' : 'No hay conversaciones aun'}
            </p>
          </div>
        ) : (
          filtered.map(conv => {
            const isActive = conv.id === activeConversationId;
            const displayName = conv.contact_name || conv.push_name || conv.phone || 'Desconocido';
            const initial = displayName.charAt(0).toUpperCase();

            return (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors
                  ${isActive
                    ? darkMode ? 'bg-crumi-primary/10 border-l-2 border-crumi-primary' : 'bg-crumi-primary/5 border-l-2 border-crumi-primary'
                    : darkMode ? 'hover:bg-[#1A1D1F] border-l-2 border-transparent' : 'hover:bg-gray-50 border-l-2 border-transparent'
                  }
                `}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-sm ${
                  conv.is_group ? 'bg-emerald-500' : 'bg-crumi-primary'
                }`}>
                  {initial}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {displayName}
                    </span>
                    <span className={`text-[11px] shrink-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-xs truncate m-0 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {conv.last_message_preview || 'Sin mensajes'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span className="shrink-0 w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                  {/* Mode indicator */}
                  {conv.handling_mode === 'ai' && (
                    <span className="inline-block mt-1 px-1.5 py-px text-[9px] font-semibold bg-violet-100 text-violet-600 rounded dark:bg-violet-500/20 dark:text-violet-400">
                      IA
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;
