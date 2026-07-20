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

export type ProviderDescriptor = Readonly<{
  id: string;
  displayName: string;
  capabilities: readonly ProviderCapability[];
  normalizationVersion: string;
}>;
