import { Injectable, Logger, Optional } from '@nestjs/common';
import { INotificationProvider, ProviderSendOptions } from '../interfaces/notification-provider.interface';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { ChannelSendResult } from '../interfaces/notification-payload.interface';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { NotificationService } from '../notification.service';
import { NotificationType } from '../enums/notification-type.enum';
import { AppointmentGateway } from '../../sockets/appointment.gateway';

@Injectable()
export class InAppProvider implements INotificationProvider {
  private readonly logger = new Logger(InAppProvider.name);
  readonly channel = NotificationChannel.IN_APP;

  constructor(
    private readonly notificationService: NotificationService,
    @Optional()
    private readonly appointmentGateway?: AppointmentGateway,
  ) {}

  isAvailable(): boolean {
    return true;
  }

  async send(options: ProviderSendOptions): Promise<ChannelSendResult> {
    const { recipientId, recipientRole, template, metadata } = options;

    if (!recipientId) {
      return {
        channel: this.channel,
        destination: recipientId || '',
        status: DeliveryStatus.FAILED,
        errorCode: 'MISSING_RECIPIENT_ID',
        errorMessage: 'Recipient profile ID missing for in-app notification',
        isTransient: false,
      };
    }

    try {
      let createdNotif: any;

      if (recipientRole === 'DOCTOR') {
        createdNotif = await this.notificationService.createDoctorNotification(
          recipientId,
          template.title,
          template.inAppMessage,
          (metadata?.notificationType as NotificationType) || NotificationType.APPOINTMENT_BOOKED,
          template.note || null,
        );
      } else {
        createdNotif = await this.notificationService.createNotification(
          recipientId,
          template.title,
          template.inAppMessage,
          (metadata?.notificationType as NotificationType) || NotificationType.APPOINTMENT_BOOKED,
          template.note || null,
        );
      }

      // Realtime websocket broadcast if available
      try {
        if (this.appointmentGateway && (this.appointmentGateway as any).server) {
          (this.appointmentGateway as any).server.emit('notification', {
            recipientId,
            recipientRole,
            notification: createdNotif,
          });
        }
      } catch (wsErr: any) {
        this.logger.debug(`Realtime socket emit skipped: ${wsErr.message}`);
      }

      return {
        channel: this.channel,
        destination: recipientId,
        status: DeliveryStatus.DELIVERED,
        providerMessageId: createdNotif?.id,
      };
    } catch (err: any) {
      this.logger.error(`In-App notification failed for recipient ${recipientId}: ${err.message}`);
      return {
        channel: this.channel,
        destination: recipientId,
        status: DeliveryStatus.FAILED,
        errorCode: 'IN_APP_SAVE_ERROR',
        errorMessage: err.message,
        isTransient: true,
      };
    }
  }
}

