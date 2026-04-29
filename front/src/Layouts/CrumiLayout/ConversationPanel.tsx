import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Search, Trash2, X } from 'lucide-react';
import { setActiveConversation, deleteConversation, clearAllConversations } from '../../slices/crumiChat/chatSlice';
import { clearConversations as clearStorage } from '../../services/chatStorage';
import type { Conversation } from '../../slices/crumiChat/chatSlice';

interface ConversationPanelProps {
  isOpen: boolean;
  darkMode: boolean;
  onClose: () => void;
}

const ConversationPanel: React.FC<ConversationPanelProps> = ({ isOpen, darkMode, onClose }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');

  const conversations: Conversation[] = useSelector((state: any) => state.crumiChat?.conversations || []);
  const activeConversationId = useSelector((state: any) => state.crumiChat?.activeConversationId);

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = today - 86400000;
    const weekAgo = today - 7 * 86400000;

    const filtered = searchQuery
      ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : conversations;

    const groups: { label: string; items: Conversation[] }[] = [
      { label: 'Hoy', items: [] },
      { label: 'Ayer', items: [] },
      { label: 'Esta Semana', items: [] },
      { label: 'Anteriores', items: [] },
    ];

    filtered.forEach(conv => {
      if (conv.updatedAt >= today) groups[0].items.push(conv);
      else if (conv.updatedAt >= yesterday) groups[1].items.push(conv);
      else if (conv.updatedAt >= weekAgo) groups[2].items.push(conv);
      else groups[3].items.push(conv);
    });

    return groups.filter(g => g.items.length > 0);
  }, [conversations, searchQuery]);

  const handleSelectConversation = (convId: string) => {
    dispatch(setActiveConversation(convId));
    navigate('/dashboard');
  };

  const handleDeleteConversation = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    dispatch(deleteConversation(convId));
  };

  const handleClearAll = () => {
    dispatch(clearAllConversations());
    clearStorage();
  };

  return (
    <div
      style={{ width: isOpen ? 280 : 0 }}
      className={`
        fixed lg:relative z-40 h-full shrink-0
        transition-all duration-300 ease-in-out overflow-hidden
        ${isOpen ? 'opacity-100' : 'opacity-0'}
        ${darkMode
          ? 'bg-crumi-surface-dark border-r border-crumi-border-dark'
          : 'bg-white border-r border-crumi-border-light'
        }
      `}
    >
      <div className="flex flex-col h-full overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between h-header px-4 shrink-0">
          <h2 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-crumi-text-primary'}`}>
            Conversaciones
          </h2>
          <div className="flex items-center gap-1">
            {conversations.length > 0 && (
              <button
                onClick={handleClearAll}
                className={`p-1.5 rounded-xl transition-colors
                  ${darkMode ? 'hover:bg-red-500/20 text-crumi-text-dark-muted hover:text-red-400' : 'hover:bg-red-50 text-crumi-text-muted hover:text-red-500'}
                `}
                title="Borrar todas las conversaciones"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-xl transition-colors
                ${darkMode ? 'hover:bg-crumi-surface-dark-hover text-crumi-text-dark-muted' : 'hover:bg-crumi-bg-light text-crumi-text-muted'}
              `}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 mb-3 shrink-0">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-colors
            ${darkMode
              ? 'bg-crumi-bg-dark border-crumi-border-dark'
              : 'bg-crumi-bg-light border-crumi-border-light'
            }`}
          >
            <Search size={16} className={darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted'} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar chats..."
              className={`flex-1 bg-transparent border-none outline-none text-sm
                ${darkMode ? 'text-crumi-text-dark-primary placeholder:text-crumi-text-dark-muted' : 'text-crumi-text-primary placeholder:text-crumi-text-muted'}
              `}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto crumi-scrollbar px-3">
          {groupedConversations.length === 0 ? (
            <div className="text-center py-8">
              <p className={`text-sm ${darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted'}`}>
                {searchQuery ? 'Sin resultados' : 'No hay conversaciones'}
              </p>
            </div>
          ) : (
            groupedConversations.map(group => (
              <div key={group.label} className="mb-3">
                <p className={`text-[11px] font-semibold uppercase tracking-wider px-2 mb-1.5
                  ${darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted'}
                `}>
                  {group.label}
                </p>
                {group.items.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`
                      group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left truncate transition-all duration-200 mb-0.5
                      ${conv.id === activeConversationId
                        ? darkMode ? 'bg-crumi-accent text-white' : 'bg-crumi-primary text-white'
                        : darkMode ? 'text-crumi-text-dark-primary hover:bg-crumi-surface-dark-hover' : 'text-crumi-text-primary hover:bg-crumi-bg-light'
                      }
                    `}
                  >
                    <span className="truncate flex-1 font-medium">{conv.title}</span>
                    <Trash2
                      size={14}
                      className={`opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0 transition-opacity
                        ${conv.id === activeConversationId
                          ? 'text-white'
                          : darkMode ? 'text-crumi-text-dark-muted' : ''
                        }
                      `}
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                    />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationPanel;
