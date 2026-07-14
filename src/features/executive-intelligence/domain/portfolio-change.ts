import type {
  HpmPillar,
} from "@/features/hpm";

export type PortfolioChangeType =
  | "booking-created"
  | "guest-arriving"
  | "guest-departing"
  | "booking-cancelled"
  | "revenue-increased"
  | "revenue-decreased"
  | "occupancy-increased"
  | "occupancy-decreased"
  | "opportunity-detected"
  | "risk-detected"
  | "payment-issue"
  | "system-update";

export type PortfolioChangeTone =
  | "positive"
  | "warning"
  | "negative"
  | "informational";

export type PortfolioChange = {
  id: string;
  type: PortfolioChangeType;
  tone: PortfolioChangeTone;
  pillar: HpmPillar;
  propertyId: string | null;
  title: string;
  description: string;
  occurredAt: string;
  value?: number;
  unit?: "currency" | "percentage" | "count";
  currency?: string;
};
