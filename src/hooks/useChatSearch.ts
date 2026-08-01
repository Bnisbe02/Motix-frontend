import { useState } from 'react';
import { ChatMessage, AnthropicMessage } from '../types/chat';
import { MOTIX_SYSTEM_PROMPT } from '../constants/chatPrompts';
import { supabase } from '../lib/supabase';

export interface UseChatSearchReturn {
  messages: ChatMessage[];
  isProcessing: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useChatSearch(): UseChatSearchReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (content: string): Promise<void> => {
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      detections: undefined,
      isError: false,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: 'You must be signed in to use chat. Please sign in and try again.',
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
        setError('Not authenticated');
        return;
      }

      const apiMessages: AnthropicMessage[] = [...messages, userMessage]
        .filter((m) => !m.isError)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error: invokeError } = await supabase.functions.invoke('chat', {
        body: {
          system: MOTIX_SYSTEM_PROMPT,
          messages: apiMessages,
        },
      });

      if (invokeError) {
        let errorContent = 'I was unable to process your request. Please check your connection and try again.';

        if (invokeError?.message?.includes('429') || (invokeError as { status?: number })?.status === 429) {
          errorContent = "You've reached the message limit for this hour (100 messages). Your limit resets in under 60 minutes.";
        }

        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          role: 'assistant',
          content: errorContent,
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
        setError('API request failed');
        return;
      }

      const textContent = data?.content?.find((block: { type: string }) => block.type === 'text');
      const replyText: string = textContent?.text ?? 'No response received.';

      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: replyText,
        isError: false,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: 'I was unable to process your request. Please check your connection and try again.',
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      setError('Network error');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearHistory = (): void => {
    setMessages([]);
    setError(null);
  };

  return {
    messages,
    isProcessing,
    error,
    sendMessage,
    clearHistory,
  };
}
