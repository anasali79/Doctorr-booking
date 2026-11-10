import { apiFetch } from './client';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  spokenSummary?: string;
  timestamp: string | Date;
  requiresConfirmation?: boolean;
  requiresPayment?: boolean;
  confirmationId?: string;
  expiresAt?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    type: string;
    label: string;
    data?: Record<string, unknown>;
  }>;
}

export interface AiChatResponse {
  message: string;
  spokenSummary: string;
  language: 'en' | 'hi';
  actions: Array<{
    type: string;
    label: string;
    data?: Record<string, unknown>;
  }>;
  requiresConfirmation: boolean;
  requiresPayment?: boolean;
  data?: Record<string, unknown>;
  confirmationId?: string | null;
  expiresAt?: string | null;
  conversationId: string;
}

export interface AiChatRequest {
  message: string;
  conversationId?: string;
  confirmationId?: string;
  confirmed?: boolean;
  languagePreference?: 'auto' | 'hi' | 'en';
}

export async function sendAiMessage(
  payload: AiChatRequest,
  token?: string,
): Promise<AiChatResponse> {
  return apiFetch<AiChatResponse>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
}

export async function getAiConversations(token?: string) {
  return apiFetch<unknown[]>('/api/ai/conversations', {
    method: 'GET',
    token,
  });
}

export async function getAiConversation(conversationId: string, token?: string) {
  return apiFetch<unknown>(`/api/ai/conversations/${conversationId}`, {
    method: 'GET',
    token,
  });
}

export async function deleteAiConversation(
  conversationId: string,
  token?: string,
) {
  return apiFetch<{ success: boolean }>(
    `/api/ai/conversations/${conversationId}`,
    {
      method: 'DELETE',
      token,
    },
  );
}

export async function getAiStatus(token?: string) {
  return apiFetch<{
    status: 'online' | 'offline';
    provider: string;
    model: string;
    voiceInputEnabled: boolean;
    voiceOutputEnabled: boolean;
    continuousVoiceEnabled: boolean;
    dailyRemaining: number;
  }>('/api/ai/status', {
    method: 'GET',
    token,
  });
}
