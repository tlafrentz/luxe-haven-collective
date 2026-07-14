import type {
  HpmPillar,
} from "@/features/hpm";

export type RevenueRiskItem = {
  id: string;
  pillar: HpmPillar;
  propertyId: string | null;
  title: string;
  summary: string;
  estimatedAmount: number;
  currency: string;
  confidence: "high" | "medium" | "low";
  detectedAt: string;
};

export type RevenueRiskSummary = {
  totalEstimatedAmount: number;
  currency: string;
  itemCount: number;
  items: RevenueRiskItem[];
};
