import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
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
  private readonly storageFilePath: string;
  private persistTimer: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {
    this.maxHistoryMessages = Number(
      this.configService.get<string>('AI_MAX_HISTORY_MESSAGES') || 10,
    );
    this.dailyMessageCap = Number(
      this.configService.get<string>('AI_DAILY_MESSAGE_CAP_PER_USER') || 30,
    );

    this.storageFilePath = path.join(process.cwd(), 'data', 'ai-sessions.json');
    this.loadSessionsFromDisk();
  }

  /**
   * Load existing sessions from disk on server startup.
   */
  private loadSessionsFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id && item.userId) {
              const session: ConversationSession = {
                id: item.id,
                userId: item.userId,
                userRole: item.userRole || 'USER',
                title: item.title || 'Conversation',
                messages: Array.isArray(item.messages)
                  ? item.messages.map((m: any) => ({
                      ...m,
                      timestamp: new Date(m.timestamp || Date.now()),
                    }))
                  : [],
                pendingConfirmation: item.pendingConfirmation
                  ? {
                      ...item.pendingConfirmation,
                      createdAt: new Date(item.pendingConfirmation.createdAt),
                      expiresAt: new Date(item.pendingConfirmation.expiresAt),
                    }
                  : null,
                createdAt: new Date(item.createdAt || Date.now()),
                updatedAt: new Date(item.updatedAt || Date.now()),
              };
              this.sessions.set(session.id, session);
              if (
                session.pendingConfirmation &&
                new Date() < session.pendingConfirmation.expiresAt
              ) {
                this.pendingConfirmations.set(
                  session.pendingConfirmation.id,
                  session.pendingConfirmation,
                );
              }
            }
          }
          this.logger.log(
            `Loaded ${this.sessions.size} persistent AI conversation sessions from disk.`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Could not load AI sessions from disk: ${err.message}. Starting with fresh in-memory state.`,
      );
    }
  }

  /**
   * Schedule debounced flush to disk so I/O does not block chat latency.
   */
  private persistSessions(): void {
    if (this.persistTimer) return;

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      try {
        const dir = path.dirname(this.storageFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const data = Array.from(this.sessions.values());
        fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf8');
      } catch (err: any) {
        this.logger.error(`Failed to persist AI sessions to disk: ${err.message}`);
      }
    }, 250);
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
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(newId, newSession);
    this.persistSessions();
    return newSession;
  }

  /**
   * Append a message to the conversation, trimming old messages to save tokens.
   */
  addMessage(conversationId: string, message: ConversationMessage): void {
    const session = this.sessions.get(conversationId);
    if (!session) return;

    // Generate intelligent title from first user message if still default
    if (
      message.role === 'user' &&
      (!session.title || session.title === 'New Conversation')
    ) {
      const cleaned = message.content.replace(/\s+/g, ' ').trim();
      session.title = cleaned.length > 40 ? cleaned.slice(0, 40) + '...' : cleaned;
    }

    session.messages.push(message);
    session.updatedAt = new Date();

    // Keep only last N messages
    if (session.messages.length > this.maxHistoryMessages * 2) {
      session.messages = session.messages.slice(-this.maxHistoryMessages * 2);
    }

    this.persistSessions();
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
      this.persistSessions();
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
      this.persistSessions();
    }
  }

  /**
   * List all conversations owned by a user.
   */
  getUserConversations(userId: string): any[] {
    const list: any[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        list.push({
          id: session.id,
          title: session.title || 'Conversation',
          messageCount: session.messages.length,
          lastMessage:
            session.messages.length > 0
              ? session.messages[session.messages.length - 1].content
              : '',
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        });
      }
    }
    return list.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
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
    this.persistSessions();
    return true;
  }
}

