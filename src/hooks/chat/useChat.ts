/**
 * useChat - Manages chat messages and subscriptions
 * Requirements: Message fetching, creation, deletion, and realtime updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchMessages,
  createMessage,
  deleteMessage,
  subscribeToMessages,
  type Message,
} from '@/lib/supabase/queries/messages';
import { useErrorMessages } from '@/lib/i18n';

export interface UseChatOptions {
  conversationId: string;
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  replaceMessage: (oldId: string, newMessage: Message) => void;
  createUserMessage: (content: string, metadata?: Record<string, unknown>) => Promise<Message>;
  createAssistantMessage: (content: string, metadata?: Record<string, unknown>) => Promise<Message>;
  deleteMessageById: (id: string) => Promise<void>;
  clearPendingMessages: () => void;
}

export function useChat({ conversationId }: UseChatOptions): UseChatReturn {
  const { getApiError } = useErrorMessages();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<(() => void) | null>(null);

  // Load messages on mount
  useEffect(() => {
    async function loadMessages() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchMessages(conversationId);
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : getApiError('LOAD_MESSAGES_FAILED'));
      } finally {
        setIsLoading(false);
      }
    }
    loadMessages();
  }, [conversationId, getApiError]);

  // Subscribe to realtime updates
  useEffect(() => {
    subscriptionRef.current = subscribeToMessages(conversationId, (newMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    });

    return () => {
      subscriptionRef.current?.();
    };
  }, [conversationId]);

  // Message manipulation functions
  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const replaceMessage = useCallback((oldId: string, newMessage: Message) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === oldId ? newMessage : m))
    );
  }, []);

  const createUserMessage = useCallback(async (
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<Message> => {
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
      metadata,
    };
    
    // Add optimistic message
    setMessages((prev) => [...prev, optimisticMessage]);

    // Create actual message
    const message = await createMessage({
      conversation_id: conversationId,
      role: 'user',
      content,
      metadata,
    });

    // Replace temp with real message
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? message : m))
    );

    return message;
  }, [conversationId]);

  const createAssistantMessage = useCallback(async (
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<Message> => {
    const message = await createMessage({
      conversation_id: conversationId,
      role: 'assistant',
      content,
      metadata,
    });

    return message;
  }, [conversationId]);

  const deleteMessageById = useCallback(async (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      await deleteMessage(id);
    } catch (e) {
      console.error('[useChat] Failed to delete message:', e);
    }
  }, []);

  const clearPendingMessages = useCallback(() => {
    setMessages((prev) =>
      prev.filter((m) => !(m.metadata as Record<string, unknown> | undefined)?.isPending)
    );
  }, []);

  return {
    messages,
    isLoading,
    error,
    addMessage,
    updateMessage,
    removeMessage,
    replaceMessage,
    createUserMessage,
    createAssistantMessage,
    deleteMessageById,
    clearPendingMessages,
  };
}
