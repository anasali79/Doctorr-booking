import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INotificationProvider, ProviderSendOptions } from '../interfaces/notification-provider.interface';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { ChannelSendResult } from '../interfaces/notification-payload.interface';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { toVonageRecipient } from '../utils/phone.utils';

@Injectable()
export class SmsProvider implements INotificationProvider {
  private readonly logger = new Logger(SmsProvider.name);
  readonly channel = NotificationChannel.SMS;

  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private fromSender = 'CareUp';
  private testPhone: string | null = null;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    const rawKey =
      this.configService.get<string>('VONAGE_API_KEY') ||
      this.configService.get<string>('NEXMO_API_KEY');
    const rawSecret =
      this.configService.get<string>('VONAGE_API_SECRET') ||
      this.configService.get<string>('NEXMO_API_SECRET');
    const rawFrom =
      this.configService.get<string>('VONAGE_SMS_FROM') ||
      this.configService.get<string>('NEXMO_FROM_NUMBER');
    const rawTestPhone =
      this.configService.get<string>('VONAGE_TEST_PHONE');

    if (rawFrom && rawFrom.trim()) {
      this.fromSender = rawFrom.trim();
    }

    if (rawTestPhone && rawTestPhone.trim()) {
      this.testPhone = toVonageRecipient(rawTestPhone.trim());
      if (this.testPhone) {
        this.logger.log(`Vonage SMS Test Mode Enabled: outbound SMS will route to verified test phone: ${this.testPhone}`);
      }
    }

    if (
      rawKey &&
      rawSecret &&
      !rawKey.includes('placeholder') &&
      !rawKey.includes('your_') &&
      rawKey.length >= 6
    ) {
      this.apiKey = rawKey.trim();
      this.apiSecret = rawSecret.trim();
      this.isConfigured = true;
      this.logger.log(`Vonage SMS Provider initialized successfully (Sender: ${this.fromSender})`);
    } else {
      this.logger.warn(
        'Vonage SMS Provider is unconfigured: VONAGE_API_KEY / VONAGE_API_SECRET missing or placeholder. Delivery attempts will report NOT_CONFIGURED.',
      );
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && !!this.apiKey && !!this.apiSecret;
  }

  async send(options: ProviderSendOptions): Promise<ChannelSendResult> {
    const { destination, template, metadata } = options;

    if (!this.isConfigured || !this.apiKey || !this.apiSecret) {
      this.logger.warn(`Vonage SMS send rejected: Provider not configured. Recipient: ${destination}`);
      return {
        channel: this.channel,
        destination: destination || '',
        status: DeliveryStatus.FAILED,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        errorMessage: 'Vonage SMS provider credentials (VONAGE_API_KEY / VONAGE_API_SECRET) are not configured in environment variables.',
        isTransient: false,
      };
    }

    // Determine target recipient (honoring test phone override during development)
    const rawTarget = this.testPhone ? this.testPhone : destination;
    const targetDigits = toVonageRecipient(rawTarget);

    if (!targetDigits) {
      return {
        channel: this.channel,
        destination: destination || '',
        status: DeliveryStatus.FAILED,
        errorCode: 'INVALID_PHONE_NUMBER',
        errorMessage: `Destination phone number '${rawTarget}' cannot be normalized to valid digits for Vonage SMS.`,
        isTransient: false,
      };
    }

    try {
      this.logger.log(
        `Dispatching Vonage SMS to ${targetDigits} from ${this.fromSender} (original recipient: ${destination}, testMode: ${!!this.testPhone})`,
      );

      const payload = {
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        to: targetDigits,
        from: this.fromSender,
        text: template.smsText,
      };

      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000), // 12s timeout
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data) {
        this.logger.error(`Vonage SMS HTTP error: Status ${response.status}`);
        return {
          channel: this.channel,
          destination: targetDigits,
          status: DeliveryStatus.FAILED,
          errorCode: `VONAGE_HTTP_${response.status}`,
          errorMessage: `Vonage SMS HTTP response status ${response.status}`,
          isTransient: response.status >= 500 || response.status === 429,
        };
      }

      const messageObj = data?.messages?.[0];
      const messageStatus = String(messageObj?.status ?? '');

      if (messageStatus !== '0') {
        const errorText = messageObj?.['error-text'] || `Vonage error code ${messageStatus}`;
        this.logger.error(`Vonage SMS rejection for ${targetDigits}: [Status: ${messageStatus}] ${errorText}`);

        const { isTransient, errorCode } = this.classifyVonageSmsStatus(messageStatus, errorText);

        return {
          channel: this.channel,
          destination: targetDigits,
          status: DeliveryStatus.FAILED,
          errorCode,
          errorMessage: errorText,
          isTransient,
        };
      }

      const messageId = messageObj?.['message-id'] || 'vonage_sms_sent';
      const remainingBalance = messageObj?.['remaining-balance'];
      this.logger.log(`Vonage accepted SMS ${messageId} for ${targetDigits} (Remaining balance: ${remainingBalance || 'N/A'})`);

      return {
        channel: this.channel,
        destination: targetDigits,
        status: DeliveryStatus.SENT,
        providerMessageId: String(messageId),
      };
    } catch (err: any) {
      this.logger.error(`Vonage SMS network/exception error for ${targetDigits}: ${err.message}`);
      const isTimeout = err.name === 'TimeoutError' || err.message?.toLowerCase().includes('timeout');

      return {
        channel: this.channel,
        destination: targetDigits,
        status: DeliveryStatus.FAILED,
        errorCode: isTimeout ? 'VONAGE_TIMEOUT' : 'VONAGE_NETWORK_ERROR',
        errorMessage: err.message || 'Vonage SMS network connection failure',
        isTransient: true,
      };
    }
  }

  private classifyVonageSmsStatus(
    status: string,
    errorText: string,
  ): { isTransient: boolean; errorCode: string } {
    const statusCode = Number(status);

    // Status 0 is Success
    // Status 1: Throttled (You have exceeded the submission capacity allowed on this account)
    if (statusCode === 1) {
      return { isTransient: true, errorCode: 'VONAGE_THROTTLED' };
    }
    // Status 2: Missing params
    if (statusCode === 2) {
      return { isTransient: false, errorCode: 'VONAGE_MISSING_PARAMS' };
    }
    // Status 3: Invalid credentials
    if (statusCode === 3) {
      return { isTransient: false, errorCode: 'VONAGE_INVALID_CREDENTIALS' };
    }
    // Status 4: Invalid recipient
    if (statusCode === 4) {
      return { isTransient: false, errorCode: 'VONAGE_INVALID_RECIPIENT' };
    }
    // Status 5: Routing error (Non-routable)
    if (statusCode === 5) {
      return { isTransient: false, errorCode: 'VONAGE_ROUTING_ERROR' };
    }
    // Status 9: Insufficient balance
    if (statusCode === 9) {
      return { isTransient: false, errorCode: 'VONAGE_INSUFFICIENT_CREDITS' };
    }
    // Status 15: Invalid Sender ID
    if (statusCode === 15) {
      return { isTransient: false, errorCode: 'VONAGE_INVALID_SENDER_NAME' };
    }
    // Status 29: Non-standard / Spam rejection
    if (statusCode === 29) {
      return { isTransient: false, errorCode: 'VONAGE_SPAM_REJECTION' };
    }

    return { isTransient: false, errorCode: `VONAGE_STATUS_${status}` };
  }
}
