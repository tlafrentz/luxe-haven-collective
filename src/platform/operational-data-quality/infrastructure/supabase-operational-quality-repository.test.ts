import { describe, expect, it } from "vitest";

import { buildRedactedQualityDiagnostic } from "./supabase-operational-quality-repository";

describe("redacted operational quality diagnostics", () => {
  it("contains stable diagnostic identifiers without guest PII or payloads", () => {
    const diagnostic = buildRedactedQualityDiagnostic({
      workspaceId: "owner-1",
      providerConnectionId: "connection-1",
      syncRunId: "sync-1",
      canonicalRecordId: "booking-1",
      issueCode: "BOOKING_STALE",
      mappingVersion: "hospitable-v1",
      policyVersion: "1.0.0",
      timestamp: "2026-07-24T12:00:00.000Z",
    });
    expect(diagnostic).toEqual({
      workspaceId: "owner-1",
      providerConnectionId: "connection-1",
      syncRunId: "sync-1",
      canonicalRecordId: "booking-1",
      issueCode: "BOOKING_STALE",
      mappingVersion: "hospitable-v1",
      policyVersion: "1.0.0",
      timestamp: "2026-07-24T12:00:00.000Z",
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(/email|phone|payload|name/i);
  });
});
