import { Injectable, Logger } from '@nestjs/common';
import { INotificationProvider, ProviderSendOptions } from '../interfaces/notification-provider.interface';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { ChannelSendResult } from '../interfaces/notification-payload.interface';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { EmailService } from '../../email/email.service';

@Injectable()
export class EmailProvider implements INotificationProvider {
  private readonly logger = new Logger(EmailProvider.name);
  readonly channel = NotificationChannel.EMAIL;

  constructor(private readonly emailService: EmailService) {}

  isAvailable(): boolean {
    return true; // EmailService has built-in production Brevo + safe mock fallback
  }

  async send(options: ProviderSendOptions): Promise<ChannelSendResult> {
    const { destination, template } = options;

    if (!destination || !destination.includes('@')) {
      return {
        channel: this.channel,
        destination: destination || '',
        status: DeliveryStatus.FAILED,
        errorCode: 'INVALID_EMAIL',
        errorMessage: 'Invalid recipient email address',
        isTransient: false,
      };
    }

    try {
      this.logger.log(`Dispatching email to ${destination} with subject "${template.emailSubject}"`);
      const success = await this.emailService.sendEmail(
        destination,
        template.emailSubject,
        template.emailHtml,
      );

      if (success) {
        return {
          channel: this.channel,
          destination,
          status: DeliveryStatus.SENT,
          providerMessageId: `email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        };
      } else {
        return {
          channel: this.channel,
          destination,
          status: DeliveryStatus.FAILED,
          errorCode: 'EMAIL_SEND_FAILED',
          errorMessage: 'Email provider returned failure or reject',
          isTransient: true, // may be transient network/quota
        };
      }
    } catch (err: any) {
      this.logger.error(`Email dispatch error to ${destination}: ${err.message}`);
      const isTransient = !err.message?.includes('invalid');
      return {
        channel: this.channel,
        destination,
        status: DeliveryStatus.FAILED,
        errorCode: err.code || 'EMAIL_EXCEPTION',
        errorMessage: err.message,
        isTransient,
      };
    }
  }
}

