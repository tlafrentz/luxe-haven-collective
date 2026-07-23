import { describe, expect, it } from "vitest";
import { AcquisitionPipeline, AcquisitionPipelineVersion, createAcquisitionActorReference, createAcquisitionCommandId, createCounterpartyResponseId, createPipelineActivation } from "../acquisition-pipeline";
import { createInvestmentOpportunityId, createOpportunityAnalysisId } from "../domain";

const actor = createAcquisitionActorReference({ type: "user", id: "offer-owner" });
const at = new Date("2026-07-22T12:00:00.000Z");
let n = 0;
function context(version: number, offset = ++n) { return { commandId: createAcquisitionCommandId(`acquisition-command-offer-${n}-${offset}`), actor, occurredAt: new Date(at.getTime() + offset * 1000), expectedPipelineVersion: AcquisitionPipelineVersion.from(version) }; }
function pipeline() { const result = AcquisitionPipeline.activate({ opportunityId: createInvestmentOpportunityId("investment-opportunity-offers"), route: "purchase", activation: createPipelineActivation({ activatedAt: at, activatedBy: actor, sourceAnalysis: { analysisId: createOpportunityAnalysisId("opportunity-analysis-offers"), analysisVersion: 1, analyzedAt: at, route: "purchase" } }), context: { commandId: createAcquisitionCommandId("acquisition-command-activation-offers"), actor, occurredAt: at } }); result.transition({ ...context(1), to: "offer-preparation" }); return result; }
const source = { analysisId: createOpportunityAnalysisId("opportunity-analysis-offers"), analysisVersion: 1, analyzedAt: at, route: "purchase" as const };
const terms = { route: "purchase" as const, offerPrice: { amount: 400000, currency: "USD" as const }, financing: { type: "cash" as const }, conditions: [{ type: "inspection" as const }] };

describe("AcquisitionPipeline offer and contract foundation", () => {
  it("creates, updates, and rebases one editable draft with monotonic sequence", () => {
    const value = pipeline();
    const offer = value.createOfferDraft({ sourceAnalysis: source, terms, context: context(2) });
    expect(offer.sequence.value).toBe(1);
    expect(value.currentOffer()?.status).toBe("draft");
    value.updateOfferDraft({ offerId: offer.id, terms: { ...terms, offerPrice: { amount: 410000, currency: "USD" } }, context: context(3) });
    value.rebaseOfferDraft({ offerId: offer.id, sourceAnalysis: { ...source, analysisVersion: 2 }, context: context(4) });
    expect(value.offers()[0]?.sourceAnalysis.analysisVersion).toBe(2);
    expect(value.version().value).toBe(5);
  });

  it("submits atomically with offer-submitted stage and immutable commercial terms", () => {
    const value = pipeline();
    const offer = value.createOfferDraft({ sourceAnalysis: source, terms: { ...terms, expiration: new Date("2026-07-30T00:00:00.000Z") }, context: context(2) });
    value.submitOffer({ offerId: offer.id, context: context(3) });
    expect(value.currentStage()).toBe("offer-submitted");
    expect(value.currentOffer()?.status).toBe("submitted");
    expect(value.currentOffer()?.submittedAt).toBeTruthy();
    expect(() => value.updateOfferDraft({ offerId: offer.id, terms, context: context(4) })).toThrowError("ACQUISITION_OFFER_NOT_EDITABLE");
  });

  it("preserves counterparty terms and moves a countered offer into negotiating", () => {
    const value = pipeline();
    const offer = value.createOfferDraft({ sourceAnalysis: source, terms, context: context(2) }); value.submitOffer({ offerId: offer.id, context: context(3) });
    const responseId = createCounterpartyResponseId("counterparty-response-one");
    value.recordCounteroffer({ offerId: offer.id, response: { id: responseId, type: "counter", counterparty: { type: "seller" }, respondedAt: new Date(at.getTime() + 4000), terms: { ...terms, offerPrice: { amount: 420000, currency: "USD" } } }, context: context(4) });
    expect(value.currentStage()).toBe("negotiating"); expect(value.responses()[0]?.terms).toMatchObject({ offerPrice: { amount: 420000 } }); expect(value.offers()[0]?.terms).toMatchObject({ offerPrice: { amount: 400000 } });
  });

  it("accepts an offer as agreement basis without creating a contract", () => {
    const value = pipeline(); const offer = value.createOfferDraft({ sourceAnalysis: source, terms, context: context(2) }); value.submitOffer({ offerId: offer.id, context: context(3) });
    value.recordOfferAcceptance({ offerId: offer.id, response: { id: createCounterpartyResponseId("counterparty-response-accept"), type: "acceptance", counterparty: { type: "seller" }, respondedAt: at }, context: context(4) });
    expect(value.currentStage()).toBe("under-contract"); expect(value.acceptedAgreement()?.source).toBe("offer"); expect(value.contract()).toBeUndefined();
  });

  it("records an external contract and does not synthesize an offer", () => {
    const value = pipeline(); const offer = value.createOfferDraft({ sourceAnalysis: source, terms, context: context(2) }); value.submitOffer({ offerId: offer.id, context: context(3) });
    const contract = value.recordContract({ source: { type: "external-agreement", explanation: "Signed outside Luxe Haven." }, terms: { route: "purchase", contractPrice: { amount: 405000, currency: "USD" }, financing: { type: "cash" }, effectiveDate: at, scheduledClosingDate: new Date("2026-08-01T00:00:00.000Z"), agreedConditions: [] }, context: context(4) });
    expect(contract.source.type).toBe("external-agreement"); expect(value.currentStage()).toBe("under-contract"); expect(value.offers()).toHaveLength(1);
  });

  it("records rejection, clears current offer, and does not exit the pipeline", () => {
    const value = pipeline(); const offer = value.createOfferDraft({ sourceAnalysis: source, terms, context: context(2) }); value.submitOffer({ offerId: offer.id, context: context(3) });
    value.recordOfferRejection({ offerId: offer.id, response: { id: createCounterpartyResponseId("counterparty-response-reject"), type: "rejection", counterparty: { type: "seller" }, respondedAt: at }, context: context(4) });
    expect(value.currentOffer()).toBeNull(); expect(value.currentStage()).toBe("offer-submitted"); expect(value.offers()[0]?.status).toBe("rejected");
  });
});
