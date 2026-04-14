/**
 * Message Query Functions
 * Requirements: 11.1 - Fetch and create messages
 */

import { supabase } from '../client';
import type { Op } from '@/lib/canvas/ops.types';

/**
 * Message role types
 */
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageMode = 'classic' | 'agent';

export interface MessageCitation {
  title: string;
  url: string;
  domain: string;
}

export interface MessageGeneratedImage {
  imageUrl: string;
  assetId?: string;
  prompt: string;
}

export interface AgentProcessStep {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  summary?: string;
}

export interface AgentProcessDecision {
  key: 'needs_search' | 'needs_image_search';
  value: boolean;
  reason?: string;
}

export interface AgentToolActivity {
  tool: 'generate_image' | 'web_search' | 'fetch_url' | 'image_search';
  status: 'running' | 'completed';
  inputSummary?: string;
  resultSummary?: string;
  imageUrl?: string;
  assetId?: string;
}

export interface AgentProcessTimeline {
  phase?: string;
  label?: string;
  steps?: AgentProcessStep[];
  decisions?: AgentProcessDecision[];
  tools?: AgentToolActivity[];
  /** Total thinking duration in milliseconds (set when generation completes) */
  thinkingDurationMs?: number;
}

/**
 * Message metadata structure
 */
export interface MessageMetadata {
  /** Stable client-side key used to preserve transient UI state across pending/final replacement */
  clientKey?: string;
  mode?: MessageMode;
  plan?: string;
  ops?: Op[];
  imageUrl?: string;
  /** Optional thought summary returned by model (for UI display) */
  thinking?: string;
  /** Indicates a pending message during generation (client-side only) */
  isPending?: boolean;
  /** AI model name for display (e.g., "Nano Banana Pro") */
  modelName?: string;
  /** Job ID for async image generation */
  jobId?: string;
  /** Single op from image generation */
  op?: Op;
  /** Agent process summary for reload/realtime display */
  processSummary?: string;
  /** Agent search summary for reload/realtime display */
  searchSummary?: string;
  /** Verified citations emitted by Agent mode */
  citations?: MessageCitation[];
  /** Generated or ingested images emitted by Agent mode */
  generatedImages?: MessageGeneratedImage[];
  /** Client-side timeline state for pending Agent turns */
  agentProcess?: AgentProcessTimeline;
  /** Referenced image for image-to-image generation */
  referencedImage?: {
    id: string;
    url: string;
    filename: string;
  };
  /** Indicates this assistant message is a friendly error fallback instead of a successful response */
  isError?: boolean;
}

/**
 * Message record from database
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
  created_at: string;
}

/**
 * Input for creating a new message
 */
export interface CreateMessageInput {
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
}

/**
 * Fetch messages for a conversation
 * Returns messages in chronological order
 */
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return data as Message[];
}

/**
 * Create a new message
 * Returns the created message
 */
export async function createMessage(input: CreateMessageInput): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: input.conversation_id,
      role: input.role,
      content: input.content,
      metadata: input.metadata || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create message: ${error.message}`);
  }

  return data as Message;
}

/**
 * Update message metadata (e.g., after AI generates ops)
 */
export async function updateMessageMetadata(
  messageId: string,
  metadata: MessageMetadata
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .update({ metadata })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update message: ${error.message}`);
  }

  return data as Message;
}

/**
 * Delete a message by ID
 * Used when operation fails (e.g., insufficient points)
 */
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    throw new Error(`Failed to delete message: ${error.message}`);
  }
}

/**
 * Subscribe to new messages in a conversation
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void
) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage(payload.new as Message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
