import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Bot, User, X } from 'lucide-react';
import type { RootState } from '../../../store';
import * as waApi from '../../../services/whatsappApi';

interface ConversationInfoProps {
  darkMode: boolean;
  onClose: () => void;
}

const ConversationInfo: React.FC<ConversationInfoProps> = ({ darkMode, onClose }) => {
  const dispatch = useDispatch();
  const { activeConversationId, conversations } = useSelector((state: RootState) => state.whatsapp);
  const conv = conversations.find(c => c.id === activeConversationId);

  if (!conv) return null;

  const displayName = conv.contact_name || conv.push_name || conv.phone || 'Desconocido';

  const handleModeChange = async (mode: string) => {
    if (!activeConversationId) return;
    try {
      await waApi.updateConversation(activeConversationId, { handling_mode: mode });
    } catch (err) {
      console.error('[ConversationInfo] Error updating mode:', err);
    }
  };

  return (
    <div className={`w-72 shrink-0 border-l flex flex-col h-full ${darkMode ? 'bg-[#111315] border-[#2A2D30]' : 'bg-white border-gray-100'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-[#2A2D30]' : 'border-gray-100'}`}>
        <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Info del contacto</span>
        <button onClick={onClose} className={`p-1 rounded-lg ${darkMode ? 'hover:bg-[#1A1D1F] text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
          <X size={16} />
        </button>
      </div>

      {/* Contact info */}
      <div className="p-4 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3 ${
          conv.is_group ? 'bg-emerald-500' : 'bg-crumi-primary'
        }`}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <p className={`text-base font-semibold m-0 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          {displayName}
        </p>
        <p className={`text-xs m-0 mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          {conv.phone}
        </p>
      </div>

      {/* Handling mode */}
      <div className={`px-4 py-3 border-t ${darkMode ? 'border-[#2A2D30]' : 'border-gray-100'}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Modo de respuesta
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => handleModeChange('ai')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors
              ${conv.handling_mode === 'ai'
                ? 'bg-violet-500/10 text-violet-500 font-semibold'
                : darkMode ? 'text-gray-400 hover:bg-[#1A1D1F]' : 'text-gray-500 hover:bg-gray-50'
              }
            `}
          >
            <Bot size={16} />
            <span>IA (Alejandro)</span>
          </button>
          <button
            onClick={() => handleModeChange('human')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors
              ${conv.handling_mode === 'human'
                ? 'bg-crumi-primary/10 text-crumi-primary font-semibold'
                : darkMode ? 'text-gray-400 hover:bg-[#1A1D1F]' : 'text-gray-500 hover:bg-gray-50'
              }
            `}
          >
            <User size={16} />
            <span>Manual</span>
          </button>
        </div>
      </div>

      {/* Conversation status */}
      <div className={`px-4 py-3 border-t ${darkMode ? 'border-[#2A2D30]' : 'border-gray-100'}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Estado
        </p>
        <div className="flex gap-1.5">
          {['open', 'closed', 'archived'].map(status => (
            <button
              key={status}
              onClick={() => waApi.updateConversation(conv.id, { status })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${conv.status === status
                  ? status === 'open' ? 'bg-green-500/10 text-green-500' : status === 'closed' ? 'bg-gray-500/10 text-gray-500' : 'bg-orange-500/10 text-orange-500'
                  : darkMode ? 'text-gray-500 hover:bg-[#1A1D1F]' : 'text-gray-400 hover:bg-gray-50'
                }
              `}
            >
              {status === 'open' ? 'Abierta' : status === 'closed' ? 'Cerrada' : 'Archivada'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConversationInfo;
