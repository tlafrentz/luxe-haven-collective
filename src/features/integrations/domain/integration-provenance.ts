export type IntegrationProvenance = Readonly<{
  provider: string;
  externalRecordId: string;
  retrievedAt: Date;
  effectiveAt: Date;
  operation: string;
  normalizationVersion: string;
  syncRunId?: string;
  accountId?: string;
  propertyId?: string;
  rawPayloadReference?: string;
}>;

export type NormalizedInboundRecord<TValue> = Readonly<{
  value: TValue;
  provenance: IntegrationProvenance;
}>;
