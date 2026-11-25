import { payosProvider } from "./payos";
import type { PaymentProvider, PaymentProviderId } from "./types";

const PROVIDERS: Partial<Record<PaymentProviderId, PaymentProvider>> = {
  payos: payosProvider,
  mock: payosProvider,
};

export function getPaymentProvider(id: PaymentProviderId = "payos"): PaymentProvider {
  return PROVIDERS[id] ?? payosProvider;
}
