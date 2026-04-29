import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import type { ChatMessage } from '../../slices/crumiChat/chatSlice';
import { getDecodedToken } from '../../services/auth';
import { agents } from '../../data/agents';

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const decoded = getDecodedToken();
  const userInitial = (decoded?.user?.name || decoded?.user?.email || 'U').charAt(0).toUpperCase();

  if (message.role === 'system') return null;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`group flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      {isUser ? (
        <div className="w-8 h-8 rounded-2xl bg-crumi-primary dark:bg-crumi-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
          {userInitial}
        </div>
      ) : (() => {
        const agent = agents.find(a => a.id === message.agentId);
        return agent ? (
          <img
            src={agent.avatar}
            alt={agent.name}
            title={agent.name}
            className="w-8 h-8 rounded-2xl object-cover shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-2xl bg-crumi-primary dark:bg-crumi-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
            C
          </div>
        );
      })()}

      {/* Bubble + metadata */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        <div
          className={`
            relative px-4 py-3 text-sm leading-relaxed
            ${isUser
              ? 'bg-crumi-primary dark:bg-crumi-accent text-white rounded-3xl rounded-br-lg'
              : 'bg-crumi-surface-light dark:bg-[#1E2124] shadow-crumi-card dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] dark:ring-1 dark:ring-white/[0.06] rounded-3xl rounded-bl-lg text-crumi-text-primary dark:text-crumi-text-dark-primary'
            }
          `}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : message.content ? (
            <div className="markdown-body prose prose-sm dark:prose-invert max-w-none break-words
              prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
              prose-headings:mb-2 prose-headings:mt-3
              prose-a:text-crumi-primary dark:prose-a:text-crumi-accent prose-a:no-underline hover:prose-a:underline
              prose-code:before:content-none prose-code:after:content-none
              prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-lg prose-code:text-xs prose-code:font-mono
              prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 dark:prose-pre:ring-1 dark:prose-pre:ring-white/10 prose-pre:rounded-2xl prose-pre:my-2
              prose-table:text-sm prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2
              prose-th:bg-gray-50 dark:prose-th:bg-gray-800 prose-th:font-semibold
              prose-strong:font-semibold
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex gap-1.5 py-1">
              <span className="w-2 h-2 rounded-full bg-crumi-text-muted dark:bg-crumi-text-dark-muted animate-typing" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-crumi-text-muted dark:bg-crumi-text-dark-muted animate-typing" style={{ animationDelay: '200ms' }} />
              <span className="w-2 h-2 rounded-full bg-crumi-text-muted dark:bg-crumi-text-dark-muted animate-typing" style={{ animationDelay: '400ms' }} />
            </div>
          )}

          {/* Copy button - assistant messages only */}
          {!isUser && message.content && (
            <button
              onClick={handleCopy}
              className="absolute -bottom-3 right-2 p-1.5 rounded-xl
                bg-crumi-surface-light dark:bg-[#1E2124]
                shadow-crumi-card dark:ring-1 dark:ring-white/10 dark:shadow-none
                opacity-0 group-hover:opacity-100
                transition-opacity duration-200
                text-crumi-text-muted dark:text-crumi-text-dark-muted
                hover:text-crumi-primary dark:hover:text-crumi-accent"
              title="Copiar mensaje"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          )}
        </div>

        {/* Timestamp */}
        <span className={`text-[10px] mt-1.5 px-1 text-crumi-text-muted dark:text-crumi-text-dark-muted
          opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
          {timestamp}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;
