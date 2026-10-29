export interface CreateOrderParams {
  amount: number; // in integer minor units (paise: e.g. 50000 = ₹500.00)
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface ProviderOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface CreateRefundParams {
  paymentId: string;
  amount?: number; // integer minor units
  notes?: Record<string, string>;
  receipt?: string;
}

export interface ProviderRefund {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string; // 'processed' | 'pending' | 'failed'
}

export interface ProviderPayment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string; // 'captured' | 'authorized' | 'failed' | 'refunded'
  method?: string;
  amountRefunded?: number;
  captured?: boolean;
}

export interface IPaymentProvider {
  readonly providerName: string;
  createOrder(params: CreateOrderParams): Promise<ProviderOrder>;
  verifyPaymentSignature(params: VerifySignatureParams): boolean;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret?: string): boolean;
  getPayment(paymentId: string): Promise<ProviderPayment>;
  getOrder(orderId: string): Promise<ProviderOrder>;
  createRefund(params: CreateRefundParams): Promise<ProviderRefund>;
  getRefund(refundId: string, paymentId?: string): Promise<ProviderRefund>;
}

