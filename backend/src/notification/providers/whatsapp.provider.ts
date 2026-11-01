import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INotificationProvider, ProviderSendOptions } from '../interfaces/notification-provider.interface';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { ChannelSendResult } from '../interfaces/notification-payload.interface';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { toVonageRecipient } from '../utils/phone.utils';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class WhatsAppProvider implements INotificationProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);
  readonly channel = NotificationChannel.WHATSAPP;

  // Application-level JWT authentication
  private applicationId: string | null = null;
  private privateKey: string | null = null;

  // Fallback API Key/Secret
  private apiKey: string | null = null;
  private apiSecret: string | null = null;

  // Vonage WhatsApp settings
  private fromNumber = '14157386170'; // Default Vonage Messages WhatsApp Sandbox number
  private useSandbox = true;
  private testPhone: string | null = null;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    this.applicationId =
      this.configService.get<string>('VONAGE_APPLICATION_ID') ||
      this.configService.get<string>('NEXMO_APPLICATION_ID') ||
      null;

    const rawKey =
      this.configService.get<string>('VONAGE_API_KEY') ||
      this.configService.get<string>('NEXMO_API_KEY');
    const rawSecret =
      this.configService.get<string>('VONAGE_API_SECRET') ||
      this.configService.get<string>('NEXMO_API_SECRET');
    const rawFrom =
      this.configService.get<string>('VONAGE_WHATSAPP_FROM') ||
      this.configService.get<string>('NEXMO_WHATSAPP_FROM');
    const rawSandbox =
      this.configService.get<string>('VONAGE_USE_SANDBOX');
    const rawTestPhone =
      this.configService.get<string>('VONAGE_TEST_PHONE');

    if (rawKey && !rawKey.includes('placeholder')) this.apiKey = rawKey.trim();
    if (rawSecret && !rawSecret.includes('placeholder')) this.apiSecret = rawSecret.trim();

    if (rawFrom && rawFrom.trim()) {
      this.fromNumber = rawFrom.trim().replace(/\D/g, '');
    }

    if (rawSandbox !== undefined && rawSandbox !== null) {
      this.useSandbox = String(rawSandbox).toLowerCase() === 'true' || String(rawSandbox) === '1';
    }

    if (rawTestPhone && rawTestPhone.trim()) {
      this.testPhone = toVonageRecipient(rawTestPhone.trim());
      if (this.testPhone) {
        this.logger.log(`Vonage WhatsApp Test Mode Enabled: outbound messages will route to test phone: ${this.testPhone}`);
      }
    }

    // Load private key for Application JWT Auth
    this.privateKey = this.loadPrivateKey();

    if (this.applicationId && this.privateKey) {
      this.isConfigured = true;
      const maskedAppId = this.applicationId.substring(0, 8) + '...';
      this.logger.log(
        `Vonage WhatsApp Provider initialized with Application JWT Auth (App ID: ${maskedAppId}, Sandbox: ${this.useSandbox}, Sender: ${this.fromNumber})`,
      );
    } else if (this.apiKey && this.apiSecret) {
      this.isConfigured = true;
      const maskedApiKey = this.apiKey.substring(0, 4) + '...';
      this.logger.log(
        `Vonage WhatsApp Provider initialized with Basic Auth (API Key: ${maskedApiKey}, Sandbox: ${this.useSandbox}, Sender: ${this.fromNumber})`,
      );
    } else {
      this.logger.warn(
        'Vonage WhatsApp Provider is unconfigured: VONAGE_APPLICATION_ID + private.key or VONAGE_API_KEY + VONAGE_API_SECRET missing.',
      );
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && ((!!this.applicationId && !!this.privateKey) || (!!this.apiKey && !!this.apiSecret));
  }

  async send(options: ProviderSendOptions): Promise<ChannelSendResult> {
    const { destination, template, metadata } = options;

    if (!this.isAvailable()) {
      this.logger.warn(`Vonage WhatsApp send rejected: Provider not configured. Recipient: ${destination}`);
      return {
        channel: this.channel,
        destination: destination || '',
        status: DeliveryStatus.FAILED,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
        errorMessage: 'Vonage WhatsApp credentials (VONAGE_APPLICATION_ID + private key or API Key/Secret) are not configured.',
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
        errorMessage: `Destination phone number '${rawTarget}' cannot be normalized to valid digits for Vonage WhatsApp.`,
        isTransient: false,
      };
    }

    try {
      const baseUrl = this.useSandbox
        ? 'https://messages-sandbox.nexmo.com/v1/messages'
        : 'https://api.nexmo.com/v1/messages';

      this.logger.log(
        `Dispatching Vonage WhatsApp message to ${targetDigits} from ${this.fromNumber} (endpoint: ${baseUrl}, testMode: ${!!this.testPhone})`,
      );

      const payload = {
        to: targetDigits,
        from: this.fromNumber,
        channel: 'whatsapp',
        message_type: 'text',
        text: template.whatsAppText,
      };

      // Resolve Authorization header (JWT Bearer or Basic Auth fallback)
      let authHeader: string;
      const jwt = this.generateJwt();
      if (jwt) {
        authHeader = `Bearer ${jwt}`;
      } else {
        const basic = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
        authHeader = `Basic ${basic}`;
      }

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000), // 12s timeout
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data || data.type || data.title) {
        const errorTitle = data?.title || data?.detail || `Vonage WhatsApp HTTP error ${response.status}`;
        const errorDetail = data?.detail || '';
        const fullMsg = errorDetail ? `${errorTitle}: ${errorDetail}` : errorTitle;

        this.logger.error(`Vonage WhatsApp delivery error for ${targetDigits}: [${response.status}] ${fullMsg}`);
        const { isTransient, errorCode } = this.classifyVonageError(response.status, fullMsg);

        return {
          channel: this.channel,
          destination: targetDigits,
          status: DeliveryStatus.FAILED,
          errorCode,
          errorMessage: fullMsg,
          isTransient,
        };
      }

      const messageUuid = data?.message_uuid || 'vonage_wa_sent';
      this.logger.log(`Vonage WhatsApp accepted message ${messageUuid} for ${targetDigits}`);

      return {
        channel: this.channel,
        destination: targetDigits,
        status: DeliveryStatus.ACCEPTED,
        providerMessageId: messageUuid,
      };
    } catch (err: any) {
      this.logger.error(`Vonage WhatsApp network/exception error for ${targetDigits}: ${err.message}`);
      const isTimeout = err.name === 'TimeoutError' || err.message?.toLowerCase().includes('timeout');

      return {
        channel: this.channel,
        destination: targetDigits,
        status: DeliveryStatus.FAILED,
        errorCode: isTimeout ? 'VONAGE_TIMEOUT' : 'VONAGE_NETWORK_ERROR',
        errorMessage: err.message || 'Vonage WhatsApp network connection failure',
        isTransient: true,
      };
    }
  }

  /**
   * Generates RS256 JWT for Vonage Application authentication
   */
  private generateJwt(): string | null {
    if (!this.applicationId || !this.privateKey) {
      return null;
    }

    try {
      const header = { typ: 'JWT', alg: 'RS256' };
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        application_id: this.applicationId,
        iat: now,
        nbf: now,
        exp: now + 15 * 60, // 15 minutes validity
        jti: crypto.randomUUID(),
      };

      const base64UrlEncode = (buf: Buffer | string): string => {
        const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
        return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      };

      const encodedHeader = base64UrlEncode(JSON.stringify(header));
      const encodedPayload = base64UrlEncode(JSON.stringify(payload));
      const dataToSign = `${encodedHeader}.${encodedPayload}`;

      const signer = crypto.createSign('RSA-SHA256');
      signer.update(dataToSign);
      signer.end();
      const signature = signer.sign(this.privateKey);
      const encodedSignature = base64UrlEncode(signature);

      return `${dataToSign}.${encodedSignature}`;
    } catch (err: any) {
      this.logger.error(`Failed to sign Vonage JWT: ${err.message}`);
      return null;
    }
  }

  /**
   * Resolves private key from file paths (including Render /etc/secrets/private.key) or environment variable
   */
  private loadPrivateKey(): string | null {
    // 1. Explicit path from VONAGE_PRIVATE_KEY_PATH
    const explicitPath = this.configService.get<string>('VONAGE_PRIVATE_KEY_PATH');
    if (explicitPath) {
      const resolved = path.resolve(explicitPath);
      if (fs.existsSync(resolved)) {
        try {
          const content = fs.readFileSync(resolved, 'utf8').trim();
          if (content.includes('-----BEGIN')) {
            this.logger.log(`Loaded Vonage private key from VONAGE_PRIVATE_KEY_PATH: ${resolved}`);
            return content;
          }
        } catch (e: any) {
          this.logger.warn(`Could not read private key from ${resolved}: ${e.message}`);
        }
      }
    }

    // 2. Standard Render Secret Files location
    const renderSecretPath = '/etc/secrets/private.key';
    if (fs.existsSync(renderSecretPath)) {
      try {
        const content = fs.readFileSync(renderSecretPath, 'utf8').trim();
        if (content.includes('-----BEGIN')) {
          this.logger.log(`Loaded Vonage private key from Render Secret File: ${renderSecretPath}`);
          return content;
        }
      } catch (e: any) {
        this.logger.warn(`Could not read Render secret file at ${renderSecretPath}: ${e.message}`);
      }
    }

    // 3. Project root private.key
    const localKeyPath = path.resolve(process.cwd(), 'private.key');
    if (fs.existsSync(localKeyPath)) {
      try {
        const content = fs.readFileSync(localKeyPath, 'utf8').trim();
        if (content.includes('-----BEGIN')) {
          this.logger.log(`Loaded Vonage private key from local file: ${localKeyPath}`);
          return content;
        }
      } catch (e: any) {
        this.logger.warn(`Could not read local private key: ${e.message}`);
      }
    }

    // 4. Inline VONAGE_PRIVATE_KEY environment variable (supports escaped \n or base64)
    const rawKey = this.configService.get<string>('VONAGE_PRIVATE_KEY');
    if (rawKey && rawKey.trim()) {
      let key = rawKey.trim();
      if (key.includes('\\n')) {
        key = key.replace(/\\n/g, '\n');
      }
      if (!key.includes('-----BEGIN') && key.length > 80) {
        try {
          const decoded = Buffer.from(key, 'base64').toString('utf8');
          if (decoded.includes('-----BEGIN')) {
            key = decoded;
          }
        } catch {
          // ignore
        }
      }
      if (key.includes('-----BEGIN')) {
        this.logger.log('Loaded Vonage private key from VONAGE_PRIVATE_KEY environment variable');
        return key;
      }
    }

    return null;
  }

  private classifyVonageError(
    status: number,
    errorMsg: string,
  ): { isTransient: boolean; errorCode: string } {
    const msgLower = (errorMsg || '').toLowerCase();

    if (status === 401 || msgLower.includes('credentials') || msgLower.includes('unauthorized') || msgLower.includes('token')) {
      return { isTransient: false, errorCode: 'VONAGE_INVALID_CREDENTIALS' };
    }
    if (status === 403 || msgLower.includes('whitelist') || msgLower.includes('sandbox')) {
      return { isTransient: false, errorCode: 'VONAGE_SANDBOX_NOT_WHITELISTED' };
    }
    if (status === 400 || status === 422 || msgLower.includes('invalid') || msgLower.includes('format')) {
      return { isTransient: false, errorCode: 'VONAGE_INVALID_PARAMETERS' };
    }
    if (status === 429 || msgLower.includes('rate limit')) {
      return { isTransient: true, errorCode: 'VONAGE_RATE_LIMIT' };
    }
    if (status >= 500) {
      return { isTransient: true, errorCode: 'VONAGE_SERVER_ERROR' };
    }

    return { isTransient: false, errorCode: `VONAGE_ERR_${status}` };
  }
}
