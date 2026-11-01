import { NotificationEventType } from '../enums/notification-event-type.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { DeliveryStatus } from '../enums/delivery-status.enum';

export interface RecipientInfo {
  id: string; // userId or patientId or doctorId
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
}

export interface NotificationEventPayload {
  eventType: NotificationEventType;
  recipients: RecipientInfo[];
  appointmentId?: string;
  paymentId?: string;
  refundId?: string;
  data: {
    patientName?: string;
    doctorName?: string;
    specialization?: string;
    appointmentDate?: string;
    startTime?: string;
    endTime?: string;
    tokenNumber?: number | null;
    previousDate?: string;
    previousStartTime?: string;
    rescheduleReason?: string;
    cancelReason?: string;
    amountInPaise?: number;
    amountFormatted?: string;
    orderId?: string;
    transactionId?: string;
    refundId?: string;
    leadTimeLabel?: string;
    kioskCode?: string;
    additionalNote?: string;
    [key: string]: any;
  };
  channels?: NotificationChannel[]; // Optional override, defaults to user preferences
  isMandatoryTransactional?: boolean; // If true, transactional alerts override opt-outs where legally permitted
}

export interface ChannelSendResult {
  channel: NotificationChannel;
  destination: string;
  status: DeliveryStatus;
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  isTransient?: boolean;
}

export interface NotificationDispatchResult {
  eventId: string;
  results: Record<string, ChannelSendResult[]>; // recipientId -> results
}

