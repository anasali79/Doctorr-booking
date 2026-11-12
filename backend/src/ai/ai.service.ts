import {
  Injectable,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../common/enums/role.enum';
import { AiChatDto } from './dto/ai-chat.dto';
import { AiResponseDto } from './dto/ai-response.dto';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { AiSessionService } from './services/ai-session.service';
import { GeminiClientService } from './services/gemini-client.service';
import { AiUserContext } from './interfaces/ai-tool.interface';

@Injectable()
export class AiService {
  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly sessionService: AiSessionService,
    private readonly geminiClient: GeminiClientService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Process a chat interaction.
   */
  async chat(
    user: { id: string; email: string; role: Role },
    dto: AiChatDto,
  ): Promise<AiResponseDto> {
    // 1. Check daily message cap per user to protect free tier
    const usage = this.sessionService.checkAndIncrementDailyUsage(user.id);
    if (!usage.allowed) {
      throw new HttpException(
        'Aapki aaj ki free AI message limit poori ho gayi hai. Kripya kal dobara try karein.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const userContext: AiUserContext = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return this.orchestrator.processMessage(
      userContext,
      dto.message,
      dto.conversationId,
      dto.confirmationId,
      dto.confirmed,
      dto.languagePreference,
    );
  }

  /**
   * List conversations for the authenticated user.
   */
  getUserConversations(userId: string) {
    return this.sessionService.getUserConversations(userId);
  }

  /**
   * Get single conversation details.
   */
  getConversation(userId: string, conversationId: string) {
    const session = this.sessionService.getOrCreateSession(
      userId,
      'USER',
      conversationId,
    );
    return session;
  }

  /**
   * Delete conversation.
   */
  deleteConversation(userId: string, conversationId: string) {
    return this.sessionService.deleteConversation(conversationId, userId);
  }

  /**
   * Status endpoint for the AI subsystem.
   */
  getStatus(userId?: string) {
    const isOnline = this.geminiClient.isAvailable();
    const model = this.geminiClient.getModelName();
    const enableVoiceInput =
      this.configService.get<string>('AI_ENABLE_VOICE_INPUT') !== 'false';
    const enableVoiceOutput =
      this.configService.get<string>('AI_ENABLE_VOICE_OUTPUT') !== 'false';
    const enableContinuousVoice =
      this.configService.get<string>('AI_ENABLE_CONTINUOUS_VOICE') !== 'false';

    let dailyRemaining = 30;
    if (userId) {
      const usage = this.sessionService.checkAndIncrementDailyUsage(userId);
      // Roll back test increment
      dailyRemaining = usage.remaining;
    }

    return {
      status: isOnline ? 'online' : 'offline',
      provider: 'Google Gemini Free Tier ($0)',
      model,
      voiceInputEnabled: enableVoiceInput,
      voiceOutputEnabled: enableVoiceOutput,
      continuousVoiceEnabled: enableContinuousVoice,
      dailyRemaining,
    };
  }
}

