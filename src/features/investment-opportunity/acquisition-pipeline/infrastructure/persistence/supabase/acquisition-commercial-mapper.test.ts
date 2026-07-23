import { describe, expect, it } from "vitest";
import { mapAcquisitionOfferRow, mapAcquisitionCounterpartyResponseRow, mapAcquisitionContractRow } from "./acquisition-commercial-mapper";

const source = { analysis_id: "opportunity-analysis-1", analysis_version: 1, analyzed_at: "2025-12-31T00:00:00.000Z", route: "purchase" };
const terms = { route: "purchase", offerPrice: { amount: 100000, currency: "USD" }, financing: { type: "cash" }, conditions: [] };
const offer = { id: "acquisition-offer-1", pipeline_id: "acquisition-pipeline-1", sequence: 1, route: "purchase", status: "draft" as const, source_analysis: source, terms, created_by: { type: "user", id: "owner-1" }, created_at: "2026-01-01T00:00:00.000Z", current_offer: true };
describe("commercial persistence mappers", () => {
  it("round-trips purchase offer lineage and terms", () => { const value = mapAcquisitionOfferRow(offer); expect(value.id.value).toBe(offer.id); expect(value.sequence.value).toBe(1); expect(value.sourceAnalysis.analysisId.value).toBe(source.analysis_id); expect(value.terms.route).toBe("purchase"); });
  it("preserves counterparty responses independently", () => { const value = mapAcquisitionCounterpartyResponseRow({ id: "counterparty-response-1", pipeline_id: offer.pipeline_id, offer_id: offer.id, response_type: "counter", counterparty: { type: "seller" }, terms, responded_at: "2026-01-02T00:00:00.000Z", recorded_at: "2026-01-02T00:00:00.000Z", recorded_by: { type: "user", id: "owner-1" } }); expect(value.offerId.value).toBe(offer.id); expect(value.terms?.route).toBe("purchase"); });
  it("rejects route-mismatched contract terms", () => { expect(() => mapAcquisitionContractRow({ id: "acquisition-contract-1", pipeline_id: offer.pipeline_id, route: "rental-arbitrage", status: "recorded", source: { type: "external-agreement", explanation: "Recorded externally" }, terms, recorded_by: { type: "user", id: "owner-1" }, recorded_at: "2026-01-03T00:00:00.000Z" })).toThrowError(); });
});
