import React, { useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Send, Paperclip } from 'lucide-react';
import { sendMessage } from '../../slices/crumiChat/thunks';
import { agents } from '../../data/agents';

interface ChatInputProps {
  conversationId: string | null;
}

const ChatInput: React.FC<ChatInputProps> = ({ conversationId }) => {
  const [text, setText] = useState('');
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dispatch = useDispatch<any>();
  const isTyping = useSelector((state: any) => state.crumiChat?.isTyping || false);
  const conversations = useSelector((state: any) => state.crumiChat?.conversations || []);
  const activeConv = conversations.find((c: any) => c.id === conversationId);
  const hasMessages = activeConv?.messages?.length > 0;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    dispatch(sendMessage(trimmed, conversationId, activeAgent || undefined));
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, isTyping, conversationId, dispatch, activeAgent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const selectedAgent = agents.find(a => a.id === activeAgent);

  return (
    <div className="shrink-0 px-4 py-4">
      <div className="max-w-4xl mx-auto">
        {/* Agent mini avatars - always visible */}
        <div className="flex items-center justify-center gap-3 mb-2">
          {agents.slice(1).map((agent) => {
            const isSelected = activeAgent === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => {
                  setActiveAgent(prev => prev === agent.id ? null : agent.id);
                  textareaRef.current?.focus();
                }}
                className="group flex flex-col items-center gap-1"
                title={agent.name}
              >
                <div className={`
                  w-9 h-9 rounded-full overflow-hidden transition-all duration-200
                  ${isSelected
                    ? `ring-2 ${agent.ring} ring-offset-1 dark:ring-offset-gray-900 ring-offset-white scale-110`
                    : 'opacity-50 grayscale-[30%] group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-105'
                  }
                `}>
                  <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                </div>
                <span className={`text-[9px] font-semibold transition-colors
                  ${isSelected
                    ? 'dark:text-white text-crumi-text-primary'
                    : 'text-crumi-text-muted dark:text-crumi-text-dark-muted'
                  }
                `}>
                  {agent.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Chat box */}
        <div className="flex items-end gap-2 bg-crumi-surface-light dark:bg-[#1E2124] rounded-3xl shadow-crumi-card dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-600/60 dark:ring-1 dark:ring-white/[0.06] px-4 py-2.5 focus-within:shadow-crumi-lg dark:focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.4)] focus-within:border-crumi-primary/30 dark:focus-within:border-crumi-accent/40 transition-all">
          {/* Attach button */}
          <button
            type="button"
            className="p-2 rounded-xl text-crumi-text-muted dark:text-crumi-text-dark-muted
              hover:text-crumi-primary dark:hover:text-crumi-accent
              hover:bg-gray-50 dark:hover:bg-gray-800/50
              transition-colors duration-200 shrink-0"
            title="Adjuntar archivo (pronto)"
          >
            <Paperclip size={18} />
          </button>

          {/* Selected expert pill inside input */}
          {selectedAgent && (
            <span className={`shrink-0 inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full text-xs font-semibold
              ${selectedAgent.pillBg} text-white`}>
              <img src={selectedAgent.avatar} alt="" className="w-5 h-5 rounded-full" />
              {selectedAgent.name}
            </span>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={selectedAgent ? `Pregúntale al ${selectedAgent.name}...` : 'Escribe un mensaje...'}
            rows={1}
            disabled={isTyping}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm
              text-crumi-text-primary dark:text-crumi-text-dark-primary
              placeholder:text-crumi-text-muted dark:placeholder:text-crumi-text-dark-muted
              disabled:opacity-50 max-h-[200px] py-1.5"
          />

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isTyping}
            className="p-2.5 rounded-full bg-crumi-primary dark:bg-crumi-accent text-white
              disabled:opacity-30 disabled:cursor-not-allowed
              hover:shadow-crumi-lg active:scale-95
              transition-all duration-200 shrink-0"
          >
            <Send size={16} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mt-2">
          <p className="text-[11px] text-crumi-text-muted dark:text-crumi-text-dark-muted">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-mono">Shift + Enter</kbd> nueva linea
          </p>
          <span className="text-crumi-text-muted dark:text-crumi-text-dark-muted text-[10px]">|</span>
          <p className="text-[11px] text-crumi-text-muted dark:text-crumi-text-dark-muted">
            Bolti puede cometer errores. Verifica la info importante.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
