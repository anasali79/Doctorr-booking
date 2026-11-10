import { AiToolAction } from '../interfaces/ai-tool.interface';

export class AiResponseDto {
  message: string;
  spokenSummary: string;
  language: 'en' | 'hi';
  actions: AiToolAction[];
  requiresConfirmation: boolean;
  requiresPayment?: boolean;
  data?: Record<string, any>;
  confirmationId?: string | null;
  expiresAt?: string | null;
  conversationId: string;
}

