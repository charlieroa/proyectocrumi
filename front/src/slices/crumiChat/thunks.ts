import { AppDispatch } from '../../store';
import {
  createConversation,
  addMessage,
  setTyping,
  setStreamingContent,
  updateLastAssistantMessage,
  ChatMessage,
} from './chatSlice';
import { callOpenAI } from '../../services/openaiService';
import { streamOpenAI } from '../../services/openaiService';
import { getCrumiSystemPrompt } from '../../services/crumiSystemPrompt';
import { saveConversations } from '../../services/chatStorage';
import { executeCrumiAction } from '../../services/crumiActionService';
import { isAuthenticated } from '../../services/auth';
import { openAuthModal } from '../authModal/authModalSlice';

const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const sendMessage = (
  text: string,
  conversationId: string | null,
  agentId?: string,
) => async (dispatch: AppDispatch, getState: () => any) => {
  let convId = conversationId;

  // Create new conversation if needed
  if (!convId) {
    convId = `conv_${Date.now()}`;
    dispatch(createConversation({ id: convId }));
  }

  // Add user message
  const userMsg: ChatMessage = {
    id: generateId(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  };
  dispatch(addMessage({ conversationId: convId, message: userMsg }));

  // Prepare messages for OpenAI
  const state = getState();
  const conv = state.crumiChat.conversations.find((c: any) => c.id === convId);

  // If user is not authenticated and already has messages (not first interaction), prompt login
  const userMessages = conv?.messages?.filter((m: ChatMessage) => m.role === 'user') || [];
  if (!isAuthenticated() && userMessages.length > 1) {
    const loginMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '🔐 Para continuar necesitas iniciar sesión. Crea tu cuenta o ingresa para acceder a todas las funcionalidades de Bolti.',
      timestamp: Date.now(),
      agentId: agentId || 'general',
    };
    dispatch(addMessage({ conversationId: convId, message: loginMsg }));
    dispatch(openAuthModal('login'));
    return;
  }
  if (!conv) return;

  const systemPrompt = getCrumiSystemPrompt();
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conv.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
  ];

  // Determine which agent is responding
  const respondingAgentId = agentId || 'general';

  // Add placeholder assistant message
  const assistantMsg: ChatMessage = {
    id: generateId(),
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    agentId: respondingAgentId,
  };
  dispatch(addMessage({ conversationId: convId, message: assistantMsg }));
  dispatch(setTyping(true));
  dispatch(setStreamingContent(''));

  try {
    const actionResult = await executeCrumiAction(text);
    if (actionResult.handled) {
      // If action requires auth and user is not logged in, prompt login
      if (!isAuthenticated()) {
        dispatch(updateLastAssistantMessage({
          conversationId: convId!,
          content: actionResult.content + '\n\n🔐 Para ejecutar esta acción necesitas iniciar sesión.',
        }));
        dispatch(setTyping(false));
        dispatch(openAuthModal('login'));
        return;
      }
      dispatch(updateLastAssistantMessage({ conversationId: convId!, content: actionResult.content }));
      return;
    }

    // Try streaming first
    let fullContent = '';
    await streamOpenAI(messages, (chunk: string) => {
      fullContent += chunk;
      dispatch(setStreamingContent(fullContent));
      dispatch(updateLastAssistantMessage({ conversationId: convId!, content: fullContent }));
    });

    dispatch(setStreamingContent(''));
  } catch (streamError) {
    // Fallback to non-streaming
    try {
      const response = await callOpenAI(messages);
      dispatch(updateLastAssistantMessage({ conversationId: convId!, content: response }));
    } catch (error: any) {
      const errorMsg = error?.message || 'Error al conectar con la IA. Intenta de nuevo.';
      dispatch(updateLastAssistantMessage({ conversationId: convId!, content: errorMsg }));
    }
  } finally {
    dispatch(setTyping(false));
    dispatch(setStreamingContent(''));
    // Persist conversations
    const finalState = getState();
    saveConversations(finalState.crumiChat.conversations);
  }
};
