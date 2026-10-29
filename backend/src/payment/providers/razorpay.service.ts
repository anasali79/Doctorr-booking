import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';
import {
  IPaymentProvider,
  CreateOrderParams,
  ProviderOrder,
  VerifySignatureParams,
  CreateRefundParams,
  ProviderRefund,
  ProviderPayment,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class RazorpayService implements IPaymentProvider {
  readonly providerName = 'RAZORPAY';
  private readonly logger = new Logger(RazorpayService.name);

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly razorpayInstance: Razorpay | null = null;
  private readonly isMockMode: boolean = false;

  constructor(private readonly configService: ConfigService) {
    this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || '';
    this.keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || '';

    const isTest = this.configService.get<string>('NODE_ENV') === 'test';
    if (
      !this.keyId ||
      !this.keySecret ||
      this.keyId.startsWith('mock_') ||
      this.keyId.startsWith('rzp_test_mock') ||
      this.keyId === 'mock_key_id' ||
      this.keyId === 'your_razorpay_key_id' ||
      (isTest && !this.configService.get<string>('LIVE_RAZORPAY_TEST'))
    ) {
      this.logger.warn('RAZORPAY_KEY_ID/SECRET not configured or in test mode. Operating in sandbox/mock mode.');
      this.isMockMode = true;
    } else {
      try {
        this.razorpayInstance = new Razorpay({
          key_id: this.keyId,
          key_secret: this.keySecret,
        });
        this.logger.log('Razorpay SDK initialized successfully.');
      } catch (err: any) {
        this.logger.error('Failed to initialize Razorpay SDK:', err.message);
        this.isMockMode = true;
      }
    }
  }

  getPublicKey(): string {
    return this.keyId || 'rzp_test_placeholder';
  }

  isInMockMode(): boolean {
    return this.isMockMode;
  }

  async createOrder(params: CreateOrderParams): Promise<ProviderOrder> {
    if (this.isMockMode || !this.razorpayInstance) {
      const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.logger.log(`[Mock Razorpay] Created order ${mockOrderId} for amount ${params.amount} ${params.currency}`);
      return {
        id: mockOrderId,
        amount: params.amount,
        currency: params.currency,
        status: 'created',
        receipt: params.receipt,
      };
    }

    try {
      const order = await this.razorpayInstance.orders.create({
        amount: params.amount,
        currency: params.currency || 'INR',
        receipt: params.receipt,
        notes: params.notes,
      });

      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
        receipt: order.receipt ?? undefined,
      };
    } catch (error: any) {
      this.logger.error('Razorpay order creation failed:', error?.error?.description || error.message);
      throw new BadRequestException(
        error?.error?.description || 'Failed to create payment order with provider',
      );
    }
  }

  verifyPaymentSignature(params: VerifySignatureParams): boolean {
    if (!this.keySecret) {
      // In sandbox/mock mode without secrets, verify mock tokens or test pattern
      if (this.isMockMode && params.signature.startsWith('mock_sig_')) {
        return true;
      }
    }

    try {
      const secret = this.keySecret || 'mock_secret_for_testing';
      const text = `${params.orderId}|${params.paymentId}`;
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(text)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(params.signature),
      );
    } catch (error) {
      return false;
    }
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret?: string): boolean {
    const webhookSecret = secret || this.webhookSecret;
    if (!webhookSecret) {
      if (this.isMockMode && signature.startsWith('mock_webhook_sig_')) {
        return true;
      }
      this.logger.warn('RAZORPAY_WEBHOOK_SECRET is not configured. Webhook signature cannot be verified.');
      return false;
    }

    try {
      const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyBuffer)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature),
      );
    } catch (error) {
      return false;
    }
  }

  async getPayment(paymentId: string): Promise<ProviderPayment> {
    if (this.isMockMode || !this.razorpayInstance) {
      return {
        id: paymentId,
        orderId: `order_mock_${paymentId}`,
        amount: 50000,
        currency: 'INR',
        status: 'captured',
        captured: true,
      };
    }

    try {
      const payment = await this.razorpayInstance.payments.fetch(paymentId);
      return {
        id: payment.id,
        orderId: payment.order_id,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        amountRefunded: Number(payment.amount_refunded || 0),
        captured: Boolean(payment.captured),
      };
    } catch (error: any) {
      this.logger.error(`Razorpay fetch payment error [${paymentId}]:`, error?.error?.description || error.message);
      throw new BadRequestException(error?.error?.description || 'Could not fetch payment from provider');
    }
  }

  async getOrder(orderId: string): Promise<ProviderOrder> {
    if (this.isMockMode || !this.razorpayInstance) {
      return {
        id: orderId,
        amount: 50000,
        currency: 'INR',
        status: 'paid',
      };
    }

    try {
      const order = await this.razorpayInstance.orders.fetch(orderId);
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
        receipt: order.receipt ?? undefined,
      };
    } catch (error: any) {
      this.logger.error(`Razorpay fetch order error [${orderId}]:`, error?.error?.description || error.message);
      throw new BadRequestException(error?.error?.description || 'Could not fetch order from provider');
    }
  }

  async createRefund(params: CreateRefundParams): Promise<ProviderRefund> {
    if (this.isMockMode || !this.razorpayInstance) {
      const mockRefundId = `rfnd_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.logger.log(`[Mock Razorpay] Refund created ${mockRefundId} for payment ${params.paymentId}`);
      return {
        id: mockRefundId,
        paymentId: params.paymentId,
        amount: params.amount || 50000,
        currency: 'INR',
        status: 'processed',
      };
    }

    try {
      const refundOptions: any = {
        notes: params.notes,
        receipt: params.receipt,
      };
      if (params.amount) {
        refundOptions.amount = params.amount;
      }

      const refund = await this.razorpayInstance.payments.refund(params.paymentId, refundOptions);
      return {
        id: refund.id,
        paymentId: refund.payment_id,
        amount: Number(refund.amount),
        currency: refund.currency,
        status: refund.status,
      };
    } catch (error: any) {
      this.logger.error(`Razorpay refund creation failed [${params.paymentId}]:`, error?.error?.description || error.message);
      throw new BadRequestException(error?.error?.description || 'Failed to process refund with payment gateway');
    }
  }

  async getRefund(refundId: string, paymentId?: string): Promise<ProviderRefund> {
    if (this.isMockMode || !this.razorpayInstance) {
      return {
        id: refundId,
        paymentId: paymentId || 'pay_mock',
        amount: 50000,
        currency: 'INR',
        status: 'processed',
      };
    }

    try {
      let refund: any;
      if (paymentId) {
        refund = await (this.razorpayInstance.payments as any).fetchRefund(paymentId, refundId);
      } else {
        refund = await (this.razorpayInstance.refunds as any).fetch(refundId);
      }

      return {
        id: refund.id,
        paymentId: refund.payment_id,
        amount: Number(refund.amount),
        currency: refund.currency,
        status: refund.status,
      };
    } catch (error: any) {
      this.logger.error(`Razorpay fetch refund failed [${refundId}]:`, error?.error?.description || error.message);
      throw new BadRequestException(error?.error?.description || 'Could not fetch refund status from provider');
    }
  }
}
