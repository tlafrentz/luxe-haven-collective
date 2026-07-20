import { Observation, ObservationCollection, createObservationId, type ObservationValue } from "@/platform/observations";

import type { NormalizedInboundRecord } from "../domain";

export type InboundObservationValue = Readonly<{
  type: string;
  label: string;
  value: ObservationValue;
  subject: Readonly<{ type: string; id: string }>;
  unit?: Readonly<{ type: string; symbol?: string }>;
}>;

/** Optional direct Platform boundary for external facts entering reasoning. */
export function inboundRecordsToObservations(
  records: readonly NormalizedInboundRecord<InboundObservationValue>[],
): ObservationCollection {
  return ObservationCollection.create(records.map(({ value, provenance }) => Observation.create({
    id: createObservationId(`observation-${slug(provenance.provider)}-${slug(provenance.externalRecordId)}-${slug(value.type)}`),
    type: value.type,
    subject: value.subject,
    label: value.label,
    value: value.value,
    source: { type: "external-provider", name: provenance.provider, referenceId: provenance.externalRecordId, version: provenance.normalizationVersion },
    observedAt: provenance.effectiveAt,
    recordedAt: provenance.retrievedAt,
    ...(value.unit ? { unit: value.unit } : {}),
    provenance: { retrievedAt: provenance.retrievedAt, effectiveAt: provenance.effectiveAt, notes: `Normalized from ${provenance.operation}; sync run ${provenance.syncRunId ?? "not recorded"}.` },
    metadata: {
      provider: provenance.provider,
      externalRecordId: provenance.externalRecordId,
      operation: provenance.operation,
      normalizationVersion: provenance.normalizationVersion,
      ...(provenance.syncRunId ? { syncRunId: provenance.syncRunId } : {}),
      ...(provenance.accountId ? { accountId: provenance.accountId } : {}),
      ...(provenance.propertyId ? { propertyId: provenance.propertyId } : {}),
      ...(provenance.rawPayloadReference ? { rawPayloadReference: provenance.rawPayloadReference } : {}),
    },
  })));
}

function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
