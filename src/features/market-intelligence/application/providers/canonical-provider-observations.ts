import { ObservationBuilder, ObservationCollection, type AnyObservation } from "@/platform/observations";
import type { ComparableProperty } from "../../domain/entities/comparable-property";
import type { PropertyRecord } from "../../domain/entities/property-record";
import type { ProviderResult } from "./provider-result";

export type ObservedProviderResult<T> = Readonly<{ result: ProviderResult<T>; observations: ObservationCollection }>;

export function observePropertyProviderResult(result: ProviderResult<PropertyRecord>, recordedAt = new Date()): ObservedProviderResult<PropertyRecord> {
  return { result, observations: ObservationCollection.create(result.ok ? [propertyObservation(result.data, recordedAt)] : []) };
}

export function observeComparableProviderResult(result: ProviderResult<readonly ComparableProperty[]>, recordedAt = new Date()): ObservedProviderResult<readonly ComparableProperty[]> {
  return { result, observations: ObservationCollection.create(result.ok ? result.data.map((value) => comparableObservation(value, recordedAt)) : []) };
}

function propertyObservation(value: PropertyRecord, recordedAt: Date): AnyObservation {
  return ObservationBuilder.create().withType("market.provider.property").concerning({ type: "property", id: value.id })
    .withLabel("Provider property record").withValue(value.address.formatted).fromSource({ type: "provider", name: value.provenance.provider, referenceId: value.id })
    .observedAt(value.provenance.retrievedAt).recordedAt(recordedAt).withProvenance({ retrievedAt: value.provenance.retrievedAt, effectiveAt: value.provenance.retrievedAt, notes: value.provenance.notes })
    .withMetadata({ provider: value.provenance.provider, confidence: value.provenance.confidence.value, ...(value.provenance.sampleSize !== undefined ? { sampleSize: value.provenance.sampleSize } : {}) }).build();
}

function comparableObservation(value: ComparableProperty, recordedAt: Date): AnyObservation {
  return ObservationBuilder.create().withType("market.provider.comparable").concerning({ type: "comparable-property", id: value.id })
    .withLabel("Provider comparable record").withValue(value.estimatedValue ?? value.address).fromSource({ type: "provider", name: value.provenance.provider, referenceId: value.providerPropertyId ?? value.id })
    .observedAt(value.provenance.retrievedAt).recordedAt(recordedAt).withProvenance({ retrievedAt: value.provenance.retrievedAt, effectiveAt: value.provenance.retrievedAt, notes: value.provenance.notes })
    .withMetadata({ provider: value.provenance.provider, confidence: value.provenance.confidence.value, address: value.address }).build();
}
