import type { OperationalDataQuality } from "../domain";
import { buildQualityAwareEvidence } from "./quality-services";

export function buildRevenueEvidenceQuality(quality: OperationalDataQuality) {
  return buildQualityAwareEvidence(quality);
}

export function buildExecutiveInputQuality(quality: OperationalDataQuality) {
  const evidence = buildQualityAwareEvidence(quality);
  return {
    ...evidence,
    distinguishFromBusinessPerformance: evidence.warning !== null,
  };
}

export function buildReportSourceQuality(quality: OperationalDataQuality) {
  return {
    status: quality.status,
    incomplete: quality.dimensions.completeness.status !== "trusted",
    limitations: quality.issues.map(({ code, impact }) => ({ code, impact })),
    policyVersion: quality.policyVersion,
  };
}

export function evaluateCommunicationChannelSupport(
  quality: OperationalDataQuality,
  contactAvailable: boolean,
) {
  const blocking = quality.issues.some(({ code }) =>
    [
      "BOOKING_MISSING_PROPERTY",
      "BOOKING_INVALID_DATE_RANGE",
      "RESERVATION_GUEST_MISSING",
    ].includes(code),
  );
  return {
    supported: contactAvailable && !blocking,
    reason: !contactAvailable
      ? "No supported guest contact channel is available."
      : blocking
        ? "Reservation context is not reliable enough for guest communication."
        : null,
  };
}
