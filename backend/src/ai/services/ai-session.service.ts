import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  ConversationSession,
  ConversationMessage,
  PendingConfirmation,
} from '../interfaces/ai-context.interface';

const CONFIRMATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AiSessionService {
  private readonly logger = new Logger(AiSessionService.name);
  private readonly sessions = new Map<string, ConversationSession>();
  private readonly pendingConfirmations = new Map<string, PendingConfirmation>();
  private readonly dailyUsage = new Map<string, { count: number; dateStr: string }>();

  private readonly maxHistoryMessages: number;
  private readonly dailyMessageCap: number;

  constructor(private readonly configService: ConfigService) {
    this.maxHistoryMessages = Number(
      this.configService.get<string>('AI_MAX_HISTORY_MESSAGES') || 10,
    );
    this.dailyMessageCap = Number(
      this.configService.get<string>('AI_DAILY_MESSAGE_CAP_PER_USER') || 30,
    );
  }

  /**
   * Check and increment daily usage count per user to protect free-tier quota (Section 3D).
   */
  checkAndIncrementDailyUsage(userId: string): { allowed: boolean; remaining: number } {
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(new Date());

    let record = this.dailyUsage.get(userId);
    if (!record || record.dateStr !== todayStr) {
      record = { count: 0, dateStr: todayStr };
      this.dailyUsage.set(userId, record);
    }

    if (record.count >= this.dailyMessageCap) {
      this.logger.warn(
        `User ${userId} reached daily AI message cap (${this.dailyMessageCap})`,
      );
      return { allowed: false, remaining: 0 };
    }

    record.count++;
    return {
      allowed: true,
      remaining: Math.max(0, this.dailyMessageCap - record.count),
    };
  }

  /**
   * Retrieves or initializes a conversation session for a user.
   */
  getOrCreateSession(
    userId: string,
    userRole: string,
    conversationId?: string,
  ): ConversationSession {
    if (conversationId && this.sessions.has(conversationId)) {
      const session = this.sessions.get(conversationId)!;
      if (session.userId !== userId) {
        throw new ForbiddenException(
          'You are not authorized to access this conversation.',
        );
      }
      return session;
    }

    const newId = conversationId || randomUUID();
    const newSession: ConversationSession = {
      id: newId,
      userId,
      userRole,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(newId, newSession);
    return newSession;
  }

  /**
   * Append a message to the conversation, trimming old messages to save tokens.
   */
  addMessage(conversationId: string, message: ConversationMessage): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    session.messages.push(message);
    session.updatedAt = new Date();

    // Keep only last N messages
    if (session.messages.length > this.maxHistoryMessages * 2) {
      session.messages = session.messages.slice(-this.maxHistoryMessages * 2);
    }
  }

  /**
   * Create a pending confirmation with a 5-minute expiry.
   */
  createPendingConfirmation(
    userId: string,
    conversationId: string,
    actionType: PendingConfirmation['actionType'],
    actionPayload: Record<string, any>,
    summary: string,
  ): PendingConfirmation {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_MS);

    const pending: PendingConfirmation = {
      id,
      userId,
      conversationId,
      actionType,
      actionPayload,
      summary,
      createdAt: now,
      expiresAt,
    };

    this.pendingConfirmations.set(id, pending);

    // Also link to session
    const session = this.sessions.get(conversationId);
    if (session) {
      session.pendingConfirmation = pending;
    }

    return pending;
  }

  /**
   * Validates and retrieves a pending confirmation.
   * If expired or foreign user, returns null.
   */
  getPendingConfirmation(id: string, userId: string): PendingConfirmation | null {
    const pending = this.pendingConfirmations.get(id);
    if (!pending) return null;

    if (pending.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to access confirmation ${id} owned by ${pending.userId}`,
      );
      return null;
    }

    if (new Date() > pending.expiresAt) {
      this.logger.log(`Confirmation ${id} has expired`);
      this.pendingConfirmations.delete(id);
      return null;
    }

    return pending;
  }

  /**
   * Clear confirmation after execution or cancellation.
   */
  clearPendingConfirmation(id: string): void {
    const pending = this.pendingConfirmations.get(id);
    if (pending) {
      const session = this.sessions.get(pending.conversationId);
      if (session && session.pendingConfirmation?.id === id) {
        session.pendingConfirmation = null;
      }
      this.pendingConfirmations.delete(id);
    }
  }

  /**
   * List all conversations owned by a user.
   */
  getUserConversations(userId: string): ConversationSession[] {
    const list: ConversationSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        list.push(session);
      }
    }
    return list.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  /**
   * Delete a specific conversation owned by the user.
   */
  deleteConversation(conversationId: string, userId: string): boolean {
    const session = this.sessions.get(conversationId);
    if (!session) return false;

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You cannot delete a conversation you do not own.',
      );
    }

    if (session.pendingConfirmation) {
      this.pendingConfirmations.delete(session.pendingConfirmation.id);
    }

    this.sessions.delete(conversationId);
    return true;
  }
}

