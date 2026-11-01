import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { DeliveryStatus } from './enums/delivery-status.enum';
import { NotificationChannel } from './enums/notification-channel.enum';
import { EmailProvider } from './providers/email.provider';
import { InAppProvider } from './providers/in-app.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { SmsProvider } from './providers/sms.provider';
import { renderNotificationTemplate } from './templates/notification.templates';
import { ConfigService } from '@nestjs/config';

const RETRY_DELAYS_MS = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000];

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);
  private readonly appBaseUrl: string;

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,

    private readonly emailProvider: EmailProvider,
    private readonly inAppProvider: InAppProvider,
    private readonly whatsAppProvider: WhatsAppProvider,
    private readonly smsProvider: SmsProvider,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.appBaseUrl =
      this.configService.get<string>('APP_BASE_URL') ||
      'https://doctorbook-five.vercel.app';
  }

  /**
   * Cron job running every 30 seconds to process retry-eligible failed deliveries
   */
  @Cron('*/30 * * * * *')
  async processPendingRetries(): Promise<void> {
    const now = new Date();

    const dueRetries = await this.deliveryRepo.find({
      where: {
        status: DeliveryStatus.RETRY_PENDING,
        nextRetryAt: LessThanOrEqual(now),
      },
      take: 50,
      order: { nextRetryAt: 'ASC' },
    });

    if (dueRetries.length === 0) return;

    this.logger.log(`Found ${dueRetries.length} pending notification deliveries due for retry`);

    for (const delivery of dueRetries) {
      await this.retrySingleDelivery(delivery.id);
    }
  }

  /**
   * Retries an individual delivery safely with DB-level lock
   */
  async retrySingleDelivery(deliveryId: string): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let locked: NotificationDelivery | null = null;
    try {
      locked = await queryRunner.manager.findOne(NotificationDelivery, {
        where: { id: deliveryId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!locked || locked.status !== DeliveryStatus.RETRY_PENDING) {
        await queryRunner.rollbackTransaction();
        return false;
      }

      locked.status = DeliveryStatus.PROCESSING;
      locked.retryCount += 1;
      await queryRunner.manager.save(locked);
      await queryRunner.commitTransaction();
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to claim delivery ${deliveryId} for retry: ${err.message}`);
      return false;
    } finally {
      await queryRunner.release();
    }

    // Now execute provider attempt
    try {
      const template = renderNotificationTemplate(
        locked.eventType,
        locked.payload || {},
        locked.recipientRole as any,
        this.appBaseUrl,
      );

      const options = {
        recipientId: locked.recipientId,
        recipientRole: locked.recipientRole as any,
        destination: locked.destination,
        template,
        metadata: {
          deliveryId: locked.id,
          eventType: locked.eventType,
          appointmentId: locked.appointmentId,
          isRetry: true,
        },
      };

      let result;
      switch (locked.channel) {
        case NotificationChannel.EMAIL:
          result = await this.emailProvider.send(options);
          break;
        case NotificationChannel.IN_APP:
          result = await this.inAppProvider.send(options);
          break;
        case NotificationChannel.WHATSAPP:
          result = await this.whatsAppProvider.send(options);
          break;
        case NotificationChannel.SMS:
          result = await this.smsProvider.send(options);
          break;
        default:
          result = {
            channel: locked.channel,
            destination: locked.destination,
            status: DeliveryStatus.FAILED,
            errorCode: 'INVALID_CHANNEL',
            errorMessage: 'Unrecognized channel',
            isTransient: false,
          };
      }

      locked.status = result.status;
      locked.providerMessageId = result.providerMessageId || locked.providerMessageId;
      locked.errorCode = result.errorCode || null;
      locked.errorMessage = result.errorMessage || null;

      if (result.status === DeliveryStatus.SENT || result.status === DeliveryStatus.ACCEPTED) {
        locked.sentAt = new Date();
        locked.nextRetryAt = null;
        this.logger.log(`Retry attempt #${locked.retryCount} for delivery ${locked.id} succeeded (channel: ${locked.channel})`);
      } else if (result.status === DeliveryStatus.DELIVERED) {
        locked.sentAt = locked.sentAt || new Date();
        locked.deliveredAt = new Date();
        locked.nextRetryAt = null;
      } else if (result.status === DeliveryStatus.FAILED) {
        if (result.isTransient && locked.retryCount < locked.maxRetries) {
          locked.status = DeliveryStatus.RETRY_PENDING;
          const delayMs = RETRY_DELAYS_MS[locked.retryCount] || 10 * 60 * 1000;
          locked.nextRetryAt = new Date(Date.now() + delayMs);
          this.logger.warn(`Retry #${locked.retryCount} for delivery ${locked.id} failed transiently. Rescheduled at ${locked.nextRetryAt.toISOString()}`);
        } else {
          locked.failedAt = new Date();
          locked.nextRetryAt = null;
          this.logger.error(`Retry #${locked.retryCount} for delivery ${locked.id} permanently failed (exhausted). Error: ${result.errorMessage}`);
        }
      }

      await this.deliveryRepo.save(locked);
      return locked.status !== DeliveryStatus.FAILED;
    } catch (execErr: any) {
      this.logger.error(`Execution error retrying delivery ${locked.id}: ${execErr.message}`);
      locked.status = DeliveryStatus.FAILED;
      locked.errorMessage = execErr.message;
      locked.failedAt = new Date();
      await this.deliveryRepo.save(locked);
      return false;
    }
  }
}

