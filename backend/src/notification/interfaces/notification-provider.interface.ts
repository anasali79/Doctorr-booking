import { NotificationChannel } from '../enums/notification-channel.enum';
import { ChannelSendResult } from './notification-payload.interface';
import { RenderedTemplate } from '../templates/notification.templates';

export interface ProviderSendOptions {
  recipientId: string;
  recipientRole: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  destination: string; // email, phone, or userId
  template: RenderedTemplate;
  metadata?: Record<string, any>;
}

export interface INotificationProvider {
  readonly channel: NotificationChannel;
  send(options: ProviderSendOptions): Promise<ChannelSendResult>;
  isAvailable(): boolean;
}

