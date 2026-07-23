import { describe, expect, it } from "vitest";
import { InvestmentOpportunity, OpportunityDomainError, OpportunityName, assessOpportunityStatusTransition, createInvestmentOpportunityId, createOpportunityOwnerId, createOpportunityTags } from "../domain";

const actor = { type: "user" as const, id: "owner-1" }, at = new Date("2026-07-22T12:00:00.000Z");
const property = { marketPropertyId: "property-1", normalizedAddress: { address1: "123 Main St", city: "Mesa", state: "AZ", postalCode: "85201" }, displayAddress: "123 Main St, Mesa, AZ 85201", resolutionStatus: "resolved" as const, capturedAt: at };
const create = () => InvestmentOpportunity.create({ ownerId: createOpportunityOwnerId("owner-1"), name: " Main Street Deal ", route: "purchase", property, actor, occurredAt: at });

describe("Investment Opportunity domain", () => {
  it("creates a stable server identity with evaluating status", () => { const value = create(); expect(value.id.value).toMatch(/^investment-opportunity-/); expect(value.props.status).toBe("evaluating"); expect(value.props.name.value).toBe("Main Street Deal"); expect(value.version).toBe(1); });
  it("keeps archive separate and restores the prior status", () => { const value = create(); value.transitionStatus("shortlisted", { actor, occurredAt: at }); value.archive({ actor, occurredAt: at }); expect(value.props.status).toBe("shortlisted"); expect(() => value.transitionStatus("rejected", { actor, occurredAt: at })).toThrowError(OpportunityDomainError); value.restoreArchive({ actor, occurredAt: at }); expect(value.props.status).toBe("shortlisted"); expect(value.props.archivedAt).toBeUndefined(); });
  it("increments metadata commands once and records each changed fact", () => { const value = create(); value.updateMetadata({ name: "New name", tags: ["Texas", "Value Add"], actor, occurredAt: at }); expect(value.version).toBe(2); expect(value.props.activities.slice(-2).map(item => item.type)).toEqual(["name-changed", "tags-changed"]); });
  it("validates opportunity names", () => { expect(() => OpportunityName.create(" ")).toThrowError(OpportunityDomainError); expect(() => OpportunityName.create("x".repeat(121))).toThrowError(OpportunityDomainError); });
  it("normalizes and orders tags", () => { expect(createOpportunityTags([" Value   Add ", "Arizona"]).map(tag => tag.normalizedValue)).toEqual(["arizona", "value add"]); });
  it("rejects duplicate, empty, long, and excess tags", () => { expect(() => createOpportunityTags(["Texas", " texas "])).toThrow(); expect(() => createOpportunityTags([""])).toThrow(); expect(() => createOpportunityTags(["x".repeat(41)])).toThrow(); expect(() => createOpportunityTags(Array.from({ length: 21 }, (_, i) => `tag-${i}`))).toThrow(); });
  it("keeps ID concepts distinct", () => { expect(createInvestmentOpportunityId().value).toMatch(/^investment-opportunity-/); });
});

describe("status transition policy", () => {
  it.each([
    ["evaluating", "researching"], ["evaluating", "shortlisted"], ["evaluating", "rejected"], ["researching", "evaluating"], ["researching", "shortlisted"], ["researching", "rejected"], ["shortlisted", "researching"], ["shortlisted", "offer-submitted"], ["shortlisted", "rejected"], ["offer-submitted", "shortlisted"], ["offer-submitted", "under-contract"], ["offer-submitted", "rejected"], ["under-contract", "offer-submitted"], ["under-contract", "acquired"], ["under-contract", "rejected"], ["rejected", "evaluating"], ["rejected", "researching"],
  ] as const)("allows %s → %s", (current, next) => expect(assessOpportunityStatusTransition(current, next).allowed).toBe(true));
  it("rejects same status", () => expect(assessOpportunityStatusTransition("evaluating", "evaluating").reason).toBe("SAME_STATUS"));
  it("treats acquired as terminal", () => expect(assessOpportunityStatusTransition("acquired", "rejected").reason).toBe("ACQUIRED_IS_TERMINAL"));
  it("blocks archived transitions", () => expect(assessOpportunityStatusTransition("evaluating", "researching", true).reason).toBe("ARCHIVED_OPPORTUNITY"));
  it("rejects skipped pipeline transitions", () => expect(assessOpportunityStatusTransition("evaluating", "under-contract").reason).toBe("INVALID_TRANSITION"));
});
