import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

interface ConversationThreadProps {
  darkMode: boolean;
}

const ConversationThread: React.FC<ConversationThreadProps> = ({ darkMode }) => {
  const { activeConversationId, messages, conversations } = useSelector((state: RootState) => state.whatsapp);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const convMessages = activeConversationId ? messages[activeConversationId] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length]);

  if (!activeConversationId || !activeConv) {
    return (
      <div className={`flex-1 flex items-center justify-center ${darkMode ? 'bg-[#0D0F10]' : 'bg-gray-50/50'}`}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: '#25D366' }}>
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Selecciona una conversacion para ver los mensajes
          </p>
        </div>
      </div>
    );
  }

  const displayName = activeConv.contact_name || activeConv.push_name || activeConv.phone || 'Desconocido';

  // Group messages by date
  const groupedMessages: { date: string; msgs: typeof convMessages }[] = [];
  let currentDate = '';
  for (const msg of convMessages) {
    const d = new Date(msg.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    if (d !== currentDate) {
      currentDate = d;
      groupedMessages.push({ date: d, msgs: [] });
    }
    groupedMessages[groupedMessages.length - 1].msgs.push(msg);
  }

  return (
    <div className={`flex-1 flex flex-col min-h-0 ${darkMode ? 'bg-[#0D0F10]' : 'bg-gray-50/50'}`}>
      {/* Header */}
      <div className={`shrink-0 flex items-center gap-3 px-4 py-3 border-b ${darkMode ? 'border-[#2A2D30] bg-[#111315]' : 'border-gray-100 bg-white'}`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
          activeConv.is_group ? 'bg-emerald-500' : 'bg-crumi-primary'
        }`}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold m-0 truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {displayName}
          </p>
          <p className={`text-xs m-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {activeConv.phone}
            {activeConv.handling_mode === 'ai' && ' - Respondiendo con IA'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto crumi-scrollbar px-4 py-3">
        {convMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              No hay mensajes aun
            </p>
          </div>
        ) : (
          groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex items-center justify-center my-3">
                <span className={`text-[11px] px-3 py-1 rounded-full ${darkMode ? 'bg-[#1A1D1F] text-gray-500' : 'bg-white text-gray-400 shadow-sm'}`}>
                  {group.date}
                </span>
              </div>
              {group.msgs.map(msg => (
                <MessageBubble key={msg.id} message={msg} darkMode={darkMode} />
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput darkMode={darkMode} />
    </div>
  );
};

export default ConversationThread;
