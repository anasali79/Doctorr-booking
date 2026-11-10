import { AiToolAction } from './ai-tool.interface';

export interface PendingConfirmation {
  id: string;
  userId: string;
  conversationId: string;
  actionType: 'BOOK_APPOINTMENT' | 'RESCHEDULE_APPOINTMENT' | 'CANCEL_APPOINTMENT';
  actionPayload: Record<string, any>;
  summary: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  spokenSummary?: string;
  timestamp: Date;
  requiresConfirmation?: boolean;
  requiresPayment?: boolean;
  data?: Record<string, any>;
  confirmationId?: string;
  expiresAt?: string;
  actions?: AiToolAction[];
}

export interface ConversationSession {
  id: string;
  userId: string;
  userRole: string;
  messages: ConversationMessage[];
  pendingConfirmation?: PendingConfirmation | null;
  createdAt: Date;
  updatedAt: Date;
}

