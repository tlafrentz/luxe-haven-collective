import type { CommerceEnvironment } from "./checkout";

export type CommerceSubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past-due"
  | "paused"
  | "cancelled"
  | "expired"
  | "unpaid";

export type CommerceInvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export type CommerceSubscription = Readonly<{
  id: string;
  customerId: string;
  workspaceId: string;
  productId: string;
  offerId?: string;
  priceId: string;
  provider: "stripe";
  environment: CommerceEnvironment;
  providerSubscriptionId: string;
  status: CommerceSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  revision: number;
  lastSynchronizedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CommerceInvoice = Readonly<{
  id: string;
  subscriptionId: string;
  customerId: string;
  workspaceId: string;
  provider: "stripe";
  environment: CommerceEnvironment;
  providerInvoiceId: string;
  number?: string;
  amountMinor: number;
  currency: string;
  status: CommerceInvoiceStatus;
  invoiceUrl?: string;
  receiptUrl?: string;
  periodStart?: Date;
  periodEnd?: Date;
  dueAt?: Date;
  paidAt?: Date;
  createdAt: Date;
}>;

export type BillingWorkspace = Readonly<{
  subscription?: CommerceSubscription;
  invoices: readonly CommerceInvoice[];
  paymentMethod?: Readonly<{ brand: string; lastFour: string; expirationMonth: number; expirationYear: number }>;
  recentActivity: readonly Readonly<{ type: string; summary: string; occurredAt: Date }>[];
  synchronization: Readonly<{ state: "current" | "partial" | "degraded" | "unavailable"; lastSynchronizedAt?: Date }>;
}>;

export interface CommerceBillingProvider {
  createBillingPortalSession(input: Readonly<{
    providerCustomerId: string;
    returnUrl: string;
    configurationId?: string;
    idempotencyKey: string;
  }>): Promise<Readonly<{ id: string; url: string; expiresAt?: Date }>>;
}

export class CommerceBillingError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    Object.freeze(this);
  }
}
