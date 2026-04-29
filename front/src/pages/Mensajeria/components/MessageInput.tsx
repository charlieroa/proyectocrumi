import React, { useState, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Send } from 'lucide-react';
import type { RootState } from '../../../store';
import { setSendingMessage, addMessage } from '../../../slices/whatsapp/whatsappSlice';
import * as waApi from '../../../services/whatsappApi';

interface MessageInputProps {
  darkMode: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ darkMode }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dispatch = useDispatch();
  const { activeConversationId, sendingMessage } = useSelector((state: RootState) => state.whatsapp);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !activeConversationId || sendingMessage) return;

    dispatch(setSendingMessage(true));
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await waApi.sendMessage({ conversationId: activeConversationId, text: trimmed });
      dispatch(addMessage({
        message: res.data.message,
        conversation: {
          id: activeConversationId,
          last_message_at: new Date().toISOString(),
          last_message_preview: trimmed.substring(0, 100),
        } as any,
      }));
    } catch (err) {
      console.error('[MessageInput] Error sending:', err);
      setText(trimmed); // Restore text on error
    } finally {
      dispatch(setSendingMessage(false));
    }
  }, [text, activeConversationId, sendingMessage, dispatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (!activeConversationId) return null;

  return (
    <div className={`shrink-0 p-3 border-t ${darkMode ? 'border-[#2A2D30] bg-[#111315]' : 'border-gray-100 bg-white'}`}>
      <div className={`flex items-end gap-2 rounded-2xl px-3 py-2 ${darkMode ? 'bg-[#1A1D1F]' : 'bg-gray-50'}`}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); adjustHeight(); }}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          disabled={sendingMessage}
          className={`flex-1 bg-transparent border-none outline-none resize-none text-sm max-h-[160px] py-1.5
            ${darkMode ? 'text-white placeholder:text-gray-500' : 'text-gray-900 placeholder:text-gray-400'}
            disabled:opacity-50
          `}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendingMessage}
          className="p-2 rounded-full bg-crumi-primary text-white disabled:opacity-30 hover:shadow-lg active:scale-95 transition-all shrink-0 dark:bg-crumi-accent"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
