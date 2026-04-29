// front/src/services/openaiService.ts
// Servicio para interactuar con OpenAI API
import { env } from "../env";

const getOpenAIApiKey = (): string => {
  const key = env.OPENAI_API_KEY || (window as any).__OPENAI_API_KEY__ || '';

  if (env.DEV) {
    if (!key) {
      console.warn('VITE_OPENAI_API_KEY no encontrada. Verifica tu archivo .env');
    }
  }

  return key;
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

export const callOpenAI = async (
  messages: Message[],
  model: string = 'gpt-4o-mini',
  temperature: number = 0.7
): Promise<string> => {
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OpenAI API key no configurada. Por favor, configura REACT_APP_OPENAI_API_KEY en tu archivo .env y reinicia el servidor');
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `Error de OpenAI: ${response.statusText}`;
      console.error('Error de OpenAI API:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(errorMsg);
    }

    const data: OpenAIResponse = await response.json();
    return data.choices[0]?.message?.content || 'No se recibió respuesta de OpenAI';
  } catch (error: any) {
    console.error('Error llamando a OpenAI:', error);
    throw error;
  }
};

/**
 * Stream OpenAI response using SSE (Server-Sent Events).
 * Calls onChunk with each text delta as it arrives.
 */
export const streamOpenAI = async (
  messages: Message[],
  onChunk: (chunk: string) => void,
  model: string = 'gpt-4o-mini',
  temperature: number = 0.7
): Promise<void> => {
  const apiKey = getOpenAIApiKey();

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OpenAI API key no configurada. Configura VITE_OPENAI_API_KEY en .env');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 2000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Error de OpenAI: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No se pudo obtener el stream de respuesta');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          onChunk(delta);
        }
      } catch {
        // skip malformed JSON chunks
      }
    }
  }
};

export default callOpenAI;
