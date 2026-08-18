export { HPM_PILLARS, HPM_PILLAR_LABELS } from "@/features/hpm/domain/hpm-pillar";
export type { HpmPillar } from "@/features/hpm/domain/hpm-pillar";

export const FOUNDING_PARTNER_DATA_SOURCES = ["pms", "booking_channels", "market_data", "financial_data"] as const;
export type FoundingPartnerDataSource = (typeof FOUNDING_PARTNER_DATA_SOURCES)[number];
export const FOUNDING_PARTNER_DATA_SOURCE_LABELS: Record<FoundingPartnerDataSource, string> = {
  pms: "PMS", booking_channels: "Booking / channel data", market_data: "Market intelligence", financial_data: "Financial data",
};

export const CONNECTION_STATUSES = ["connected", "partial", "missing", "not_required"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const BASELINE_STATUSES = ["measured", "partial", "insufficient_data"] as const;
export type FoundingPartnerBaselineStatus = (typeof BASELINE_STATUSES)[number];
