import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { NotificationService } from './notification.service';
import { NotificationScheduler } from './notification.scheduler';
import { UpdateNotificationPreferenceDto } from './dto/update-preference.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationScheduler: NotificationScheduler,
  ) {}

  // ─── Unread Count & Mark Read ────────────────────────────────────────────────
  @Get('unread-count')
  @Roles(Role.PATIENT, Role.DOCTOR)
  getUnreadCount(@CurrentUser() user: { id: string; role: string }) {
    return this.notificationService.getUnreadCount(user.id, user.role);
  }

  @Patch('read-all')
  @Roles(Role.PATIENT, Role.DOCTOR)
  markAllAsRead(@CurrentUser() user: { id: string; role: string }) {
    return this.notificationService.markAllAsRead(user.id, user.role);
  }

  @Patch(':id/read')
  @Roles(Role.PATIENT, Role.DOCTOR)
  markAsRead(
    @CurrentUser() user: { id: string; role: string },
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid notification ID format'),
      }),
    )
    id: string,
  ) {
    return this.notificationService.markAsRead(user.id, user.role, id);
  }

  // ─── User Preferences ────────────────────────────────────────────────────────
  @Get('preferences')
  @Roles(Role.PATIENT, Role.DOCTOR)
  getPreferences(@CurrentUser() user: { id: string }) {
    return this.notificationService.getUserPreferences(user.id);
  }

  @Patch('preferences')
  @Roles(Role.PATIENT, Role.DOCTOR)
  updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.notificationService.updateUserPreferences(user.id, dto);
  }

  // ─── Admin Delivery Monitoring & Manual Retry ────────────────────────────────
  @Get('admin/logs')
  @Roles(Role.ADMIN) // Restricted strictly to ADMIN
  getAdminLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('channel') channel?: string,
    @Query('status') status?: string,
  ) {
    return this.notificationService.getAdminDeliveryLogs(
      Math.max(1, parseInt(page) || 1),
      Math.min(100, parseInt(limit) || 20),
      channel,
      status,
    );
  }

  @Get('admin/stats')
  @Roles(Role.ADMIN) // Restricted strictly to ADMIN
  getAdminStats() {
    return this.notificationService.getAdminDeliveryStats();
  }

  @Post('admin/:id/retry')
  @Roles(Role.ADMIN) // Restricted strictly to ADMIN
  async retryDelivery(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException('Invalid delivery ID format'),
      }),
    )
    id: string,
  ) {
    const success = await this.notificationScheduler.retrySingleDelivery(id);
    return {
      success,
      message: success
        ? 'Manual retry executed successfully'
        : 'Manual retry failed or delivery is already processing',
    };
  }

  // ─── In-App Notifications List ───────────────────────────────────────────────
  @Get()
  @Roles(Role.PATIENT, Role.DOCTOR)
  getNotifications(
    @CurrentUser() user: { id: string; role: string },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.notificationService.getNotifications(
      user.id,
      user.role,
      Math.max(1, parseInt(page) || 1),
      Math.min(100, parseInt(limit) || 20),
    );
  }
}
