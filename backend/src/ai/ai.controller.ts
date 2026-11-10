import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { AiResponseDto } from './dto/ai-response.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Main AI Chat & Voice Assistant endpoint.
   * POST /api/ai/chat
   */
  @Post('chat')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT, Role.DOCTOR)
  @HttpCode(HttpStatus.OK)
  async chat(
    @CurrentUser() user: { id: string; email: string; role: Role },
    @Body() dto: AiChatDto,
  ): Promise<AiResponseDto> {
    return this.aiService.chat(user, dto);
  }

  /**
   * List user's active conversations.
   * GET /api/ai/conversations
   */
  @Get('conversations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT, Role.DOCTOR)
  async getConversations(
    @CurrentUser() user: { id: string },
  ) {
    return this.aiService.getUserConversations(user.id);
  }

  /**
   * Get messages of a specific conversation.
   * GET /api/ai/conversations/:id
   */
  @Get('conversations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT, Role.DOCTOR)
  async getConversation(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
  ) {
    return this.aiService.getConversation(user.id, conversationId);
  }

  /**
   * Delete a specific conversation.
   * DELETE /api/ai/conversations/:id
   */
  @Delete('conversations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PATIENT, Role.DOCTOR)
  async deleteConversation(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
  ) {
    return {
      success: this.aiService.deleteConversation(user.id, conversationId),
    };
  }

  /**
   * Health and quota status of the AI module.
   * GET /api/ai/status
   */
  @Get('status')
  async getStatus(@CurrentUser() user?: { id: string }) {
    return this.aiService.getStatus(user?.id);
  }
}

