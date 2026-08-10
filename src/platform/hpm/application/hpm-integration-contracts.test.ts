import { describe, expect, it } from "vitest";
import {
  HPM_CAPABILITY_STAGE,
  HPM_LIFECYCLE_STAGES,
  HPM_PRESENTATION_POLICY_VERSION,
  HPM_SOURCE_CAPABILITIES,
  createHpmSourcePortRegistry,
  mapHpmPresentationState,
  validateHpmSourcePorts,
  type HpmSourcePort,
} from ".";

function port(capability: HpmSourcePort["capability"], contractVersion = "v1"): HpmSourcePort {
  const value: HpmSourcePort = {
    capability,
    contractVersion,
    async project() {
      return { state: { capability, freshness: "current" as const, policyVersion: "source-v1" }, records: [] };
    },
  };
  return Object.freeze(value);
}

const supported: Readonly<Record<HpmSourcePort["capability"], readonly string[]>> = Object.freeze({
  observations: ["v1"],
  intelligence: ["v1"],
  decisions: ["v1"],
  execute: ["v1"],
  outcomes: ["v1"],
  learning: ["v1"],
  recommendations: ["v1"],
});

describe("HPM-001A integration contracts", () => {
  it("maps every canonical source to exactly one lifecycle stage", () => {
    expect(Object.keys(HPM_CAPABILITY_STAGE)).toEqual(HPM_SOURCE_CAPABILITIES);
    expect(new Set(Object.values(HPM_CAPABILITY_STAGE))).toEqual(new Set(HPM_LIFECYCLE_STAGES));
  });

  it("preserves canonical status while applying versioned shared presentation", () => {
    expect(mapHpmPresentationState({ capability: "execute", canonicalStatus: "Awaiting Review", presentationState: "awaiting-review", explanation: "Execution evidence requires an authorized reviewer." })).toEqual({
      capability: "execute",
      canonicalStatus: "Awaiting Review",
      presentationState: "awaiting-review",
      label: "Awaiting review",
      explanation: "Execution evidence requires an authorized reviewer.",
      policyVersion: HPM_PRESENTATION_POLICY_VERSION,
    });
  });

  it("rejects incomplete presentation mappings", () => {
    expect(() => mapHpmPresentationState({ capability: "decisions", canonicalStatus: " ", presentationState: "blocked", explanation: "Blocked by policy." })).toThrow("HPM_CANONICAL_STATUS_REQUIRED");
    expect(() => mapHpmPresentationState({ capability: "decisions", canonicalStatus: "Open", presentationState: "blocked", explanation: " " })).toThrow("HPM_STATUS_EXPLANATION_REQUIRED");
  });

  it("constructs an immutable complete read-only source registry", () => {
    const registry = createHpmSourcePortRegistry(HPM_SOURCE_CAPABILITIES.map((capability) => port(capability)));
    expect(Object.keys(registry)).toEqual(HPM_SOURCE_CAPABILITIES);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(() => createHpmSourcePortRegistry([...HPM_SOURCE_CAPABILITIES.map((capability) => port(capability)), port("execute")])).toThrow("HPM_SOURCE_DUPLICATE:execute");
    expect(() => createHpmSourcePortRegistry(HPM_SOURCE_CAPABILITIES.slice(1).map((capability) => port(capability)))).toThrow("HPM_SOURCE_MISSING:observations");
  });

  it("reports missing, mismatched, and unsupported source contracts deterministically", () => {
    const ports = Object.fromEntries(HPM_SOURCE_CAPABILITIES.map((capability) => [capability, port(capability)])) as Record<HpmSourcePort["capability"], HpmSourcePort>;
    delete (ports as Partial<typeof ports>).observations;
    ports.execute = port("decisions");
    ports.learning = port("learning", "v2");
    expect(validateHpmSourcePorts(ports, supported).map(({ capability, code }) => `${capability}:${code}`)).toEqual([
      "observations:HPM_SOURCE_MISSING",
      "execute:HPM_SOURCE_CAPABILITY_MISMATCH",
      "learning:HPM_SOURCE_CONTRACT_UNSUPPORTED",
    ]);
  });
});
