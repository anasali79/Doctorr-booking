import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RazorpayService } from '../providers/razorpay.service';

describe('RazorpayService', () => {
  let service: RazorpayService;
  const mockKeySecret = 'test_secret_12345';
  const mockWebhookSecret = 'webhook_secret_67890';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_mockkey';
              if (key === 'RAZORPAY_KEY_SECRET') return mockKeySecret;
              if (key === 'RAZORPAY_WEBHOOK_SECRET') return mockWebhookSecret;
              return null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<RazorpayService>(RazorpayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(service.providerName).toBe('RAZORPAY');
  });

  describe('Order Creation', () => {
    it('should create an order with integer minor units (paise) and return order details', async () => {
      const order = await service.createOrder({
        amount: 50000, // ₹500.00
        currency: 'INR',
        receipt: 'rcpt_test_001',
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.amount).toBe(50000);
      expect(order.currency).toBe('INR');
    });
  });

  describe('Payment Signature Verification', () => {
    it('should successfully verify a valid HMAC-SHA256 signature', () => {
      const orderId = 'order_valid_123';
      const paymentId = 'pay_valid_456';
      const signature = crypto
        .createHmac('sha256', mockKeySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = service.verifyPaymentSignature({
        orderId,
        paymentId,
        signature,
      });

      expect(isValid).toBe(true);
    });

    it('should reject an invalid or tampered signature', () => {
      const orderId = 'order_valid_123';
      const paymentId = 'pay_valid_456';
      const invalidSignature = 'invalid_tampered_signature_hex';

      const isValid = service.verifyPaymentSignature({
        orderId,
        paymentId,
        signature: invalidSignature,
      });

      expect(isValid).toBe(false);
    });

    it('should reject a signature where orderId does not match', () => {
      const orderId = 'order_valid_123';
      const wrongOrderId = 'order_wrong_999';
      const paymentId = 'pay_valid_456';
      const signature = crypto
        .createHmac('sha256', mockKeySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = service.verifyPaymentSignature({
        orderId: wrongOrderId,
        paymentId,
        signature,
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid webhook signature from raw body buffer', () => {
      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_123', amount: 50000 } } },
      });
      const validSignature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(Buffer.from(rawPayload, 'utf8'))
        .digest('hex');

      const isValid = service.verifyWebhookSignature(rawPayload, validSignature);
      expect(isValid).toBe(true);
    });

    it('should reject webhook signature if raw body has been tampered with', () => {
      const originalPayload = JSON.stringify({ event: 'payment.captured', amount: 50000 });
      const tamperedPayload = JSON.stringify({ event: 'payment.captured', amount: 10000 });
      const signature = crypto
        .createHmac('sha256', mockWebhookSecret)
        .update(Buffer.from(originalPayload, 'utf8'))
        .digest('hex');

      const isValid = service.verifyWebhookSignature(tamperedPayload, signature);
      expect(isValid).toBe(false);
    });
  });

  describe('Refunds', () => {
    it('should create a refund with minor units (paise)', async () => {
      const refund = await service.createRefund({
        paymentId: 'pay_test_refund',
        amount: 25000, // ₹250.00
      });

      expect(refund).toBeDefined();
      expect(refund.id).toBeDefined();
      expect(refund.amount).toBe(25000);
      expect(refund.status).toBe('processed');
    });
  });
});
