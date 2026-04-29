import React from 'react';
import type { WaMessage } from '../../../slices/whatsapp/whatsappSlice';

interface MessageBubbleProps {
  message: WaMessage;
  darkMode: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, darkMode }) => {
  const isOutbound = message.direction === 'outbound';
  const isAI = message.handled_by === 'ai';

  const time = new Date(message.created_at).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div
        className={`
          max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed
          ${isOutbound
            ? isAI
              ? 'bg-violet-500/90 text-white rounded-br-md'
              : darkMode
                ? 'bg-crumi-primary text-white rounded-br-md'
                : 'bg-crumi-primary text-white rounded-br-md'
            : darkMode
              ? 'bg-[#1E2124] text-gray-100 rounded-bl-md'
              : 'bg-white text-gray-900 shadow-sm rounded-bl-md'
          }
        `}
      >
        {/* Sender name for group or AI */}
        {(isAI || (!isOutbound && message.sender_name)) && (
          <p className={`text-[11px] font-semibold mb-0.5 ${
            isOutbound ? 'text-white/80' : darkMode ? 'text-violet-400' : 'text-violet-600'
          }`}>
            {isAI ? 'Alejandro (IA)' : message.sender_name}
          </p>
        )}

        {/* Content */}
        {message.content_type === 'text' ? (
          <p className="whitespace-pre-wrap break-words m-0">{message.content_text}</p>
        ) : message.content_type === 'image' ? (
          <div>
            {message.content_text && <p className="mb-1">{message.content_text}</p>}
            <div className={`text-xs ${isOutbound ? 'text-white/60' : 'text-gray-400'}`}>
              [Imagen]
            </div>
          </div>
        ) : message.content_type === 'audio' ? (
          <div className={`text-xs ${isOutbound ? 'text-white/60' : 'text-gray-400'}`}>
            [Audio]
          </div>
        ) : message.content_type === 'video' ? (
          <div className={`text-xs ${isOutbound ? 'text-white/60' : 'text-gray-400'}`}>
            [Video]
          </div>
        ) : message.content_type === 'document' ? (
          <div className={`text-xs ${isOutbound ? 'text-white/60' : 'text-gray-400'}`}>
            [Documento: {message.content_text}]
          </div>
        ) : message.content_type === 'location' ? (
          <div className={`text-xs ${isOutbound ? 'text-white/60' : 'text-gray-400'}`}>
            [Ubicacion: {message.content_text}]
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words m-0">{message.content_text || '[Mensaje]'}</p>
        )}

        {/* Time + status */}
        <div className={`flex items-center gap-1 mt-0.5 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          <span className={`text-[10px] ${isOutbound ? 'text-white/50' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {time}
          </span>
          {isAI && (
            <span className={`text-[9px] px-1 py-px rounded ${isOutbound ? 'bg-white/20 text-white/70' : 'bg-violet-100 text-violet-600'}`}>
              IA
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
