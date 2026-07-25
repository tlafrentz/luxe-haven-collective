import { describe, expect, it } from "vitest";

import {
  buildQualityAwareEvidence,
  buildSynchronizationHealth,
  buildWorkspaceOperationalDataHealth,
  projectQualityForWorkspace,
  reevaluateAffectedOperationalRecords,
  type OperationalQualityRepository,
} from "./quality-services";
import { evaluateBookingQuality } from "./quality-policies";
import type {
  DataQualityIssue,
  DataQualityIssueCode,
  OperationalDataQuality,
} from "../domain";

function quality(overrides: Partial<Parameters<typeof evaluateBookingQuality>[0]> = {}) {
  return evaluateBookingQuality(
    {
      workspaceId: "owner-1",
      bookingId: "booking-1",
      propertyId: "property-1",
      propertyWorkspaceId: "owner-1",
      arrival: "2026-07-25",
      departure: "2026-07-27",
      status: "confirmed",
      observedAt: "2026-07-24T11:00:00.000Z",
      provider: "hospitable",
      externalReservationId: "reservation-1",
      guestId: "guest-1",
      guestIdentityStatus: "resolved",
      contactAvailable: true,
      partyTotal: { state: "known", value: 2 },
      providerConnected: true,
      mappingVersion: "v1",
      profile: "booking-list",
      ...overrides,
    },
    new Date("2026-07-24T12:00:00.000Z"),
  );
}

class MemoryRepository implements OperationalQualityRepository {
  evaluations: OperationalDataQuality[] = [];
  issues: DataQualityIssue[] = [];
  async saveEvaluation(
    _workspaceId: string,
    _recordType: string,
    _recordId: string,
    _profileId: string,
    evaluation: OperationalDataQuality,
  ) {
    this.evaluations.push(evaluation);
  }
  async synchronizeIssues(
    _workspaceId: string,
    _recordType: string,
    _recordId: string,
    issues: readonly DataQualityIssue[],
  ) {
    this.issues = [...issues];
  }
  async listOpenIssues(
    _workspaceId: string,
    _codes?: readonly DataQualityIssueCode[],
  ) {
    void _workspaceId;
    void _codes;
    return this.issues;
  }
}

describe("quality services", () => {
  it("builds bounded workspace and downstream evidence summaries", () => {
    const trusted = quality();
    const degraded = quality({
      bookingId: "booking-2",
      observedAt: "2026-07-20T00:00:00.000Z",
    });
    const summary = buildWorkspaceOperationalDataHealth([
      { product: "bookings", quality: trusted },
      { product: "bookings", quality: degraded },
    ]);
    expect(summary.status).toBe("unusable");
    expect(summary.counts.trusted).toBe(1);
    expect(summary.products.bookings.affectedRecords).toBe(1);
    expect(buildQualityAwareEvidence(degraded)).toMatchObject({
      sufficient: false,
      qualityStatus: "unusable",
    });
  });

  it("makes partial success and last-known-good usability explicit", () => {
    expect(
      buildSynchronizationHealth({
        status: "partially-succeeded",
        created: 4,
        updated: 5,
        unchanged: 0,
        failed: 1,
        affectedCapabilities: ["guest-context"],
        lastSuccessfulAt: "2026-07-24T10:00:00.000Z",
        providerConnected: true,
      }),
    ).toMatchObject({
      status: "partially-succeeded",
      usable: true,
      failed: { records: 1, capabilities: ["guest-context"] },
    });
  });

  it("persists repeatable evaluations and synchronizes corrected issues", async () => {
    const repository = new MemoryRepository();
    await reevaluateAffectedOperationalRecords(repository, [
      {
        workspaceId: "owner-1",
        recordType: "booking",
        recordId: "booking-1",
        profileId: "booking-list",
        evaluate: () => quality({ contactAvailable: false }),
      },
    ]);
    expect(repository.issues).toHaveLength(1);
    await reevaluateAffectedOperationalRecords(repository, [
      {
        workspaceId: "owner-1",
        recordType: "booking",
        recordId: "booking-1",
        profileId: "booking-list",
        evaluate: () => quality(),
      },
    ]);
    expect(repository.issues).toEqual([]);
    expect(repository.evaluations).toHaveLength(2);
  });

  it("removes record and provider references from workspace summaries", () => {
    const original = quality({ contactAvailable: false });
    const projected = projectQualityForWorkspace(original);
    expect(projected.issues[0].scope.recordId).toBe("redacted");
    expect(JSON.stringify(projected)).not.toContain("reservation-1");
  });
});
