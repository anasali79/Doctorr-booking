import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationEventPayload,
  NotificationDispatchResult,
  ChannelSendResult,
  RecipientInfo,
} from './interfaces/notification-payload.interface';
import { NotificationChannel } from './enums/notification-channel.enum';
import { NotificationEventType } from './enums/notification-event-type.enum';
import { DeliveryStatus } from './enums/delivery-status.enum';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { EmailProvider } from './providers/email.provider';
import { InAppProvider } from './providers/in-app.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';
import { SmsProvider } from './providers/sms.provider';
import { renderNotificationTemplate } from './templates/notification.templates';
import { ConfigService } from '@nestjs/config';

// Exponential backoff retry delays (ms): 30s, 2m, 10m
const RETRY_DELAYS_MS = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000];

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private readonly appBaseUrl: string;

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveryRepo: Repository<NotificationDelivery>,

    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,

    private readonly emailProvider: EmailProvider,
    private readonly inAppProvider: InAppProvider,
    private readonly whatsAppProvider: WhatsAppProvider,
    private readonly smsProvider: SmsProvider,
    private readonly configService: ConfigService,

    @Optional()
    @InjectRepository(Patient)
    private readonly patientRepo?: Repository<Patient>,

    @Optional()
    @InjectRepository(Doctor)
    private readonly doctorRepo?: Repository<Doctor>,
  ) {
    this.appBaseUrl =
      this.configService.get<string>('APP_BASE_URL') ||
      'https://doctorbook-five.vercel.app';
  }

  /**
   * Main entry point: Dispatches an event across all channels with full fault-isolation.
   * Can be awaited or called fire-and-forget in background without blocking API response.
   */
  async dispatch(event: NotificationEventPayload): Promise<NotificationDispatchResult> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const results: Record<string, ChannelSendResult[]> = {};

    this.logger.log(`Dispatching event ${event.eventType} (EventID: ${eventId}) for ${event.recipients.length} recipients`);

    for (const recipient of event.recipients) {
      results[recipient.id] = await this.dispatchForRecipient(event, recipient, eventId);
    }

    return { eventId, results };
  }

  /**
   * Dispatches asynchronously in background so callers don't wait for provider roundtrips
   */
  dispatchAsync(event: NotificationEventPayload): void {
    setImmediate(async () => {
      try {
        await this.dispatch(event);
      } catch (err: any) {
        this.logger.error(`Background dispatch error for event ${event.eventType}: ${err.message}`, err.stack);
      }
    });
  }

  private async dispatchForRecipient(
    event: NotificationEventPayload,
    recipient: RecipientInfo,
    eventId: string,
  ): Promise<ChannelSendResult[]> {
    const channelResults: ChannelSendResult[] = [];

    // 1. Resolve userId if missing so preferences can be reliably retrieved
    let userId: string | undefined = recipient.userId;
    if (!userId) {
      if (recipient.role === 'DOCTOR' && this.doctorRepo) {
        const doc = await this.doctorRepo.findOne({ where: { id: recipient.id } });
        userId = doc?.userId;
      } else if (this.patientRepo) {
        const pat = await this.patientRepo.findOne({ where: { id: recipient.id } });
        userId = pat?.userId;
      }
    }

    // 2. Fetch user preferences
    const preferences = userId ? await this.getPreferences(userId) : null;

    // 3. Render templates for this specific recipient role
    const template = renderNotificationTemplate(
      event.eventType,
      event.data,
      recipient.role,
      this.appBaseUrl,
    );

    // 4. Determine enabled channels
    const channelsToProcess = this.resolveActiveChannels(event, preferences);

    // 4. Process each channel in parallel / isolated promises
    const promises = channelsToProcess.map(async (channel) => {
      try {
        const destination = this.resolveDestination(channel, recipient);
        if (!destination) {
          this.logger.warn(`Skipping channel ${channel} for recipient ${recipient.name} (${recipient.id}): No destination available.`);
          return null;
        }

        // Idempotency key per recipient, event, and channel
        const domainId = event.appointmentId || event.paymentId || event.refundId || 'general';
        const idempotencyKey = `${event.eventType}:${domainId}:${recipient.id}:${channel}`;

        // Check if delivery already succeeded or is currently processing
        const existing = await this.deliveryRepo.findOne({ where: { idempotencyKey } });
        if (existing) {
          if (
            existing.status === DeliveryStatus.DELIVERED ||
            existing.status === DeliveryStatus.SENT ||
            existing.status === DeliveryStatus.ACCEPTED
          ) {
            this.logger.debug(`Idempotent skip: ${idempotencyKey} already delivered/sent.`);
            return {
              channel,
              destination,
              status: existing.status,
              providerMessageId: existing.providerMessageId,
            } as ChannelSendResult;
          }
        }

        // Create or update pending delivery record
        let delivery = existing;
        if (!delivery) {
          delivery = this.deliveryRepo.create({
            idempotencyKey,
            eventType: event.eventType,
            recipientId: recipient.id,
            recipientRole: recipient.role,
            channel,
            destination,
            appointmentId: event.appointmentId || null,
            paymentId: event.paymentId || null,
            refundId: event.refundId || null,
            templateId: event.eventType,
            status: DeliveryStatus.PROCESSING,
            retryCount: 0,
            maxRetries: 3,
            payload: event.data,
          });
          delivery = await this.deliveryRepo.save(delivery);
        } else {
          delivery.status = DeliveryStatus.PROCESSING;
          await this.deliveryRepo.save(delivery);
        }

        // Send through isolated provider
        const result = await this.executeProvider(channel, {
          recipientId: recipient.id,
          recipientRole: recipient.role,
          destination,
          template,
          metadata: {
            eventType: event.eventType,
            appointmentId: event.appointmentId,
            deliveryId: delivery.id,
          },
        });

        // Update delivery record state
        delivery.status = result.status;
        delivery.providerMessageId = result.providerMessageId || null;
        delivery.errorCode = result.errorCode || null;
        delivery.errorMessage = result.errorMessage || null;

        if (result.status === DeliveryStatus.SENT || result.status === DeliveryStatus.ACCEPTED) {
          delivery.sentAt = new Date();
        } else if (result.status === DeliveryStatus.DELIVERED) {
          delivery.sentAt = delivery.sentAt || new Date();
          delivery.deliveredAt = new Date();
        } else if (result.status === DeliveryStatus.FAILED) {
          if (result.isTransient && delivery.retryCount < delivery.maxRetries) {
            delivery.status = DeliveryStatus.RETRY_PENDING;
            const delayMs = RETRY_DELAYS_MS[delivery.retryCount] || 10 * 60 * 1000;
            delivery.nextRetryAt = new Date(Date.now() + delayMs);
            this.logger.log(`Delivery ${delivery.id} failed transiently (${result.errorCode}). Scheduled retry #${delivery.retryCount + 1} at ${delivery.nextRetryAt.toISOString()}`);
          } else {
            delivery.failedAt = new Date();
            delivery.nextRetryAt = null;
            this.logger.warn(`Delivery ${delivery.id} marked permanently FAILED (${result.errorCode})`);
          }
        }

        await this.deliveryRepo.save(delivery);
        return result;
      } catch (channelErr: any) {
        // Critical fault isolation: A catastrophic failure in one channel NEVER impacts other channels
        this.logger.error(`Unhandled channel execution failure on ${channel}: ${channelErr.message}`, channelErr.stack);
        return {
          channel,
          destination: 'unknown',
          status: DeliveryStatus.FAILED,
          errorCode: 'UNHANDLED_CHANNEL_EXCEPTION',
          errorMessage: channelErr.message,
          isTransient: false,
        } as ChannelSendResult;
      }
    });

    const settled = await Promise.allSettled(promises);
    for (const res of settled) {
      if (res.status === 'fulfilled' && res.value) {
        channelResults.push(res.value);
      }
    }

    return channelResults;
  }

  private async executeProvider(channel: NotificationChannel, options: any): Promise<ChannelSendResult> {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return this.emailProvider.send(options);
      case NotificationChannel.IN_APP:
        return this.inAppProvider.send(options);
      case NotificationChannel.WHATSAPP:
        return this.whatsAppProvider.send(options);
      case NotificationChannel.SMS:
        return this.smsProvider.send(options);
      default:
        return {
          channel,
          destination: options.destination,
          status: DeliveryStatus.FAILED,
          errorCode: 'UNSUPPORTED_CHANNEL',
          errorMessage: `Channel ${channel} is not recognized`,
          isTransient: false,
        };
    }
  }

  private resolveDestination(channel: NotificationChannel, recipient: RecipientInfo): string | null {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return recipient.email || null;
      case NotificationChannel.IN_APP:
        return recipient.id; // profile ID (patient.id or doctor.id)
      case NotificationChannel.WHATSAPP:
      case NotificationChannel.SMS:
        return recipient.phone || null;
      default:
        return null;
    }
  }

  private isReminderEvent(eventType: NotificationEventType): boolean {
    return [
      NotificationEventType.APPOINTMENT_REMINDER_24H,
      NotificationEventType.APPOINTMENT_REMINDER_2H,
      NotificationEventType.APPOINTMENT_REMINDER_30M,
    ].includes(eventType);
  }

  private isPaymentAlertEvent(eventType: NotificationEventType): boolean {
    return [
      NotificationEventType.PAYMENT_INITIATED,
      NotificationEventType.PAYMENT_PENDING,
      NotificationEventType.PAYMENT_SUCCESSFUL,
      NotificationEventType.PAYMENT_FAILED,
      NotificationEventType.PAYMENT_VERIFICATION_PENDING,
      NotificationEventType.PAYMENT_VERIFICATION_FAILED,
      NotificationEventType.PAYMENT_DUPLICATE_DETECTED,
      NotificationEventType.PAYMENT_RECONCILED,
    ].includes(eventType);
  }

  private isRefundAlertEvent(eventType: NotificationEventType): boolean {
    return [
      NotificationEventType.REFUND_REQUESTED,
      NotificationEventType.REFUND_INITIATED,
      NotificationEventType.REFUND_PENDING,
      NotificationEventType.REFUND_PROCESSING,
      NotificationEventType.REFUND_SUCCESSFUL,
      NotificationEventType.REFUND_FAILED,
      NotificationEventType.REFUND_REJECTED,
      NotificationEventType.REFUND_DELAYED,
    ].includes(eventType);
  }

  private resolveActiveChannels(
    event: NotificationEventPayload,
    preferences: NotificationPreference | null,
  ): NotificationChannel[] {
    // If specific channels were explicitly requested in payload, filter to those
    const targets = event.channels || [
      NotificationChannel.EMAIL,
      NotificationChannel.IN_APP,
      NotificationChannel.WHATSAPP,
      NotificationChannel.SMS,
    ];

    if (!preferences) {
      return targets;
    }

    // Mandatory transactional events override optional channel disablements where applicable
    if (event.isMandatoryTransactional) {
      return targets;
    }

    // 1. Reminders toggle check: If event is a reminder and remindersEnabled is false -> suppress all channels
    if (this.isReminderEvent(event.eventType) && !preferences.remindersEnabled) {
      this.logger.debug(
        `Suppressing reminder event ${event.eventType}: remindersEnabled is false`,
      );
      return [];
    }

    // 2. Payment alert toggle check: If event is a payment alert and paymentAlertsEnabled is false -> suppress all channels
    if (this.isPaymentAlertEvent(event.eventType) && !preferences.paymentAlertsEnabled) {
      this.logger.debug(
        `Suppressing payment event ${event.eventType}: paymentAlertsEnabled is false`,
      );
      return [];
    }

    // 3. Refund alert toggle check: If event is a refund alert and refundAlertsEnabled is false -> suppress all channels
    if (this.isRefundAlertEvent(event.eventType) && !preferences.refundAlertsEnabled) {
      this.logger.debug(
        `Suppressing refund event ${event.eventType}: refundAlertsEnabled is false`,
      );
      return [];
    }

    // 4. Channel-specific toggles:
    return targets.filter((ch) => {
      switch (ch) {
        case NotificationChannel.EMAIL:
          return preferences.emailEnabled;
        case NotificationChannel.IN_APP:
          return preferences.inAppEnabled;
        case NotificationChannel.WHATSAPP:
          return preferences.whatsappEnabled;
        case NotificationChannel.SMS:
          return preferences.smsEnabled;
        default:
          return true;
      }
    });
  }

  private async getPreferences(userId: string): Promise<NotificationPreference | null> {
    try {
      let pref = await this.preferenceRepo.findOne({ where: { userId } });
      if (!pref) {
        // Create default preferences on first access
        pref = this.preferenceRepo.create({
          userId,
          emailEnabled: true,
          inAppEnabled: true,
          whatsappEnabled: true,
          smsEnabled: true,
          remindersEnabled: true,
          paymentAlertsEnabled: true,
          refundAlertsEnabled: true,
        });
        await this.preferenceRepo.save(pref);
      }
      return pref;
    } catch {
      return null;
    }
  }
}

