import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { MessageCircle, X, Send, Minus } from 'lucide-react';
import { sendMessage } from '../../slices/crumiChat/thunks';
import { agents } from '../../data/agents';
import type { Conversation, ChatMessage } from '../../slices/crumiChat/chatSlice';

interface FloatingChatProps {
  darkMode: boolean;
}

const FloatingChat: React.FC<FloatingChatProps> = ({ darkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dispatch = useDispatch<any>();

  const activeConversationId = useSelector((state: any) => state.crumiChat?.activeConversationId);
  const conversations: Conversation[] = useSelector((state: any) => state.crumiChat?.conversations || []);
  const isTyping = useSelector((state: any) => state.crumiChat?.isTyping || false);

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const messages = activeConv?.messages || [];
  const selectedAgent = agents.find(a => a.id === activeAgent);

  // Escuchar evento global para abrir el chat con un agente y mensaje específico
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsOpen(true);
      if (detail?.agentId) setActiveAgent(detail.agentId);
      if (detail?.message) {
        setTimeout(() => dispatch(sendMessage(detail.message, null, detail.agentId)), 500);
      }
    };
    window.addEventListener('openCrumiChat', handler);
    return () => window.removeEventListener('openCrumiChat', handler);
  }, [dispatch]);

  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isTyping, isOpen]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;
    dispatch(sendMessage(trimmed, activeConversationId, activeAgent || undefined));
    setText('');
  }, [text, isTyping, activeConversationId, dispatch, activeAgent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Chat window */}
      {isOpen && (
        <div className={`mb-3 w-80 h-[30rem] rounded-2xl flex flex-col overflow-hidden border
          ${darkMode
            ? 'bg-crumi-bg-dark border-crumi-border-dark shadow-lg shadow-black/40'
            : 'bg-white border-gray-200 shadow-2xl'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 text-white shrink-0 ${darkMode ? 'bg-crumi-accent' : 'bg-crumi-primary'}`}>
            <span className="text-sm font-bold">Chat Bolti</span>
            <div className="flex gap-1">
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
                <Minus size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Agent selector */}
          <div className={`shrink-0 px-2 py-2 border-b flex items-center gap-1 overflow-x-auto crumi-scrollbar
            ${darkMode ? 'border-crumi-border-dark' : 'border-gray-100'}`}>
            {agents.slice(1).map((agent) => {
              const isSelected = activeAgent === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => {
                    setActiveAgent(prev => prev === agent.id ? null : agent.id);
                    textareaRef.current?.focus();
                  }}
                  className="flex flex-col items-center gap-0.5 shrink-0 px-1"
                  title={`${agent.name} - ${agent.role}`}
                >
                  <div className={`w-8 h-8 rounded-full overflow-hidden transition-all duration-200
                    ${isSelected
                      ? `ring-2 ${agent.ring} ring-offset-1 ${darkMode ? 'ring-offset-gray-900' : 'ring-offset-white'} scale-110`
                      : 'opacity-50 grayscale-[30%] hover:opacity-100 hover:grayscale-0'
                    }`}>
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                  </div>
                  <span className={`text-[8px] font-semibold leading-tight
                    ${isSelected
                      ? darkMode ? 'text-white' : 'text-crumi-text-primary'
                      : darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted'
                    }`}>
                    {agent.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto crumi-scrollbar px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <p className={`text-xs text-center py-6 ${darkMode ? 'text-crumi-text-dark-muted' : 'text-crumi-text-muted'}`}>
                Selecciona un agente y escribe tu mensaje
              </p>
            )}
            {messages.map((msg: ChatMessage) => {
              const isUser = msg.role === 'user';
              if (msg.role === 'system') return null;
              const agent = !isUser ? agents.find(a => a.id === msg.agentId) : null;
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                  {isUser ? (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${darkMode ? 'bg-crumi-accent' : 'bg-crumi-primary'}`}>
                      U
                    </div>
                  ) : agent ? (
                    <img src={agent.avatar} alt={agent.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ${darkMode ? 'bg-crumi-accent' : 'bg-crumi-primary'}`}>
                      C
                    </div>
                  )}
                  <div className={`max-w-[75%] px-3 py-2 text-xs leading-relaxed rounded-2xl
                    ${isUser
                      ? `${darkMode ? 'bg-crumi-accent' : 'bg-crumi-primary'} text-white rounded-br-sm`
                      : darkMode
                        ? 'bg-crumi-surface-dark text-crumi-text-dark-primary rounded-bl-sm'
                        : 'bg-white shadow-sm text-crumi-text-primary rounded-bl-sm'
                    }`}
                  >
                    {msg.content || (
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-typing" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-typing" style={{ animationDelay: '200ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-typing" style={{ animationDelay: '400ms' }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`shrink-0 px-3 py-2 border-t ${darkMode ? 'border-crumi-border-dark' : 'border-gray-200'}`}>
            {/* Selected agent pill */}
            {selectedAgent && (
              <div className="mb-1.5 flex items-center gap-1">
                <span className={`inline-flex items-center gap-1 pl-0.5 pr-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${selectedAgent.pillBg}`}>
                  <img src={selectedAgent.avatar} alt="" className="w-4 h-4 rounded-full" />
                  {selectedAgent.name}
                </span>
                <button
                  onClick={() => setActiveAgent(null)}
                  className={`text-[10px] ${darkMode ? 'text-crumi-text-dark-muted hover:text-white' : 'text-crumi-text-muted hover:text-crumi-text-primary'}`}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedAgent ? `Pregúntale a ${selectedAgent.name}...` : 'Escribe un mensaje...'}
                rows={1}
                disabled={isTyping}
                className={`flex-1 bg-transparent border-none outline-none resize-none text-xs py-1.5
                  ${darkMode ? 'text-crumi-text-dark-primary placeholder:text-crumi-text-dark-muted' : 'text-crumi-text-primary placeholder:text-crumi-text-muted'}
                  disabled:opacity-50 max-h-[80px]`}
              />
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || isTyping}
                className={`p-2 rounded-full text-white
                  disabled:opacity-30 disabled:cursor-not-allowed
                  hover:shadow-lg active:scale-95 transition-all shrink-0
                  ${darkMode ? 'bg-crumi-accent' : 'bg-crumi-primary'}`}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200
          hover:scale-105 active:scale-95
          ${isOpen
            ? darkMode ? 'bg-gray-600 text-white' : 'bg-gray-500 text-white'
            : darkMode ? 'bg-crumi-accent text-white hover:shadow-lg' : 'bg-crumi-primary text-white hover:shadow-crumi-lg'
          }`}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
};

export default FloatingChat;
