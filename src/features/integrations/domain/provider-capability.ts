export const PROVIDER_CAPABILITIES = [
  "read-properties",
  "read-reservations",
  "read-pricing",
  "write-pricing",
  "write-availability",
  "send-messages",
  "receive-webhooks",
  "provide-comparables",
  "provide-valuations",
  "create-operational-tasks",
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

const PROVIDER_CAPABILITY_LABELS: Readonly<Record<ProviderCapability, string>> = {
  "read-properties": "Property data",
  "read-reservations": "Reservations",
  "read-pricing": "Pricing data",
  "write-pricing": "Pricing updates",
  "write-availability": "Availability updates",
  "send-messages": "Guest messaging",
  "receive-webhooks": "Live updates",
  "provide-comparables": "Comparable listings",
  "provide-valuations": "Valuation estimates",
  "create-operational-tasks": "Task creation",
};

export function describeProviderCapability(capability: string): string {
  return PROVIDER_CAPABILITY_LABELS[capability as ProviderCapability] ?? capability.replaceAll("-", " ");
}

export type ProviderDescriptor = Readonly<{
  id: string;
  displayName: string;
  capabilities: readonly ProviderCapability[];
  normalizationVersion: string;
}>;
