import { describe, expect, it } from "vitest";

import {
  Decision,
  DecisionBuilder,
  DecisionCollection,
  DecisionExecutor,
  DecisionMode,
  DecisionPolicyRegistry,
  DecisionSession,
} from "../../src/platform/decisions";

describe("platform decisions public API", () => {
  it("exports the complete PF-008 capability", () => {
    expect(Decision).toBeDefined();
    expect(DecisionCollection).toBeDefined();
    expect(DecisionBuilder).toBeDefined();
    expect(DecisionMode).toBeDefined();
    expect(DecisionPolicyRegistry).toBeDefined();
    expect(DecisionExecutor).toBeDefined();
    expect(DecisionSession).toBeDefined();
  });
});
