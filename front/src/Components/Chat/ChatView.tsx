import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import WelcomeScreen from './WelcomeScreen';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import type { Conversation, ChatMessage } from '../../slices/crumiChat/chatSlice';
import { agents } from '../../data/agents';

const ChatView: React.FC = () => {
  const activeConversationId = useSelector((state: any) => state.crumiChat?.activeConversationId);
  const conversations: Conversation[] = useSelector((state: any) => state.crumiChat?.conversations || []);
  const isTyping = useSelector((state: any) => state.crumiChat?.isTyping || false);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];
  const hasMessages = messages.length > 0;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, isTyping]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-crumi-bg-light dark:bg-crumi-bg-dark">
      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto crumi-scrollbar">
        {!hasMessages ? (
          <WelcomeScreen />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
            {messages.map((msg: ChatMessage) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Typing indicator */}
            {isTyping && messages[messages.length - 1]?.role !== 'assistant' && (() => {
              const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
              const typingAgent = agents.find(a => a.id === lastAssistant?.agentId);
              return (
              <div className="flex items-start gap-3 animate-slide-in">
                {typingAgent ? (
                  <img src={typingAgent.avatar} alt={typingAgent.name} className="w-8 h-8 rounded-2xl object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-2xl bg-crumi-primary dark:bg-crumi-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    C
                  </div>
                )}
                <div className="px-5 py-4 rounded-3xl rounded-bl-lg bg-crumi-surface-light dark:bg-[#1E2124] shadow-crumi-card dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)] dark:ring-1 dark:ring-white/[0.06]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-crumi-primary/60 dark:bg-crumi-accent/60 animate-typing" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-crumi-primary/60 dark:bg-crumi-accent/60 animate-typing" style={{ animationDelay: '200ms' }} />
                    <span className="w-2 h-2 rounded-full bg-crumi-primary/60 dark:bg-crumi-accent/60 animate-typing" style={{ animationDelay: '400ms' }} />
                  </div>
                </div>
              </div>
              );
            })()}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput conversationId={activeConversationId} />
    </div>
  );
};

export default ChatView;
