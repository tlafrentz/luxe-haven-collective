import { describe, expect, it, vi } from "vitest";
import type { AcquisitionLifecycleStageSummary } from "../acquisition-workspace";
import { buildLifecycleProgress } from "./acquisition-lifecycle-experience";

vi.mock("@/app/actions/acquisition-workspace-commands", () => ({
  activateAcquisitionPipelineAction: vi.fn(),
  beginClosingPreparationAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const stage = (
  id: AcquisitionLifecycleStageSummary["stage"],
  state: AcquisitionLifecycleStageSummary["state"],
): AcquisitionLifecycleStageSummary => ({ stage: id, label: id, state });

describe("acquisition lifecycle experience progress", () => {
  it("derives progress only from canonical visible stage state", () => {
    const result = buildLifecycleProgress([
      { id: "discovery", label: "Discovery", state: "completed" },
      { id: "analysis", label: "Analysis", state: "completed" },
      { id: "pursuit", label: "Pursuit", state: "current" },
      { id: "offer", label: "Offer", state: "upcoming" },
    ], false);
    expect(result).toEqual({ completed: 2, total: 4, remaining: 2, percent: 50 });
  });

  it("does not count unreachable stages in the progress denominator", () => {
    const result = buildLifecycleProgress([
      { id: "discovery", label: "Discovery", state: "completed" },
      { id: "analysis", label: "Analysis", state: "unreachable" },
      { id: "pursuit", label: "Pursuit", state: "current" },
    ], false);
    expect(result).toEqual({ completed: 1, total: 2, remaining: 1, percent: 50 });
  });

  it("counts the current terminal stage as complete", () => {
    const result = buildLifecycleProgress([
      { id: "discovery", label: "Discovery", state: "completed" },
      { id: "acquired", label: "Acquired", state: "current" },
    ], true);
    expect(result).toEqual({ completed: 2, total: 2, remaining: 0, percent: 100 });
  });

  it("retains the source lifecycle contract used by the display mapper", () => {
    expect(stage("pursuit", "current")).toEqual({ stage: "pursuit", label: "pursuit", state: "current" });
  });
});
