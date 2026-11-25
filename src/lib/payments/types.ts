export type PaymentProviderId = "payos" | "vnpay" | "momo" | "stripe" | "mock";

export interface CreateCheckoutInput {
  orderCode: number;
  amountVnd: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  buyerEmail?: string;
  buyerName?: string;
}

export interface CreateCheckoutOutput {
  provider: PaymentProviderId;
  orderCode: number;
  checkoutUrl: string;
  qrCode: string;
  sandboxMocked: boolean;
}

export interface VerifiedWebhookPayload {
  orderCode: number;
  amountVnd: number;
  eventId: string;
  paid: boolean;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  isConfigured(): boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutOutput>;
  verifyWebhook(body: Record<string, unknown>, signature: string): VerifiedWebhookPayload | null;
}
