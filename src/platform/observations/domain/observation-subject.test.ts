import { describe, expect, it } from "vitest";

import { ObservationSubject } from "./observation-subject";

describe("ObservationSubject", () => {
  it("creates a direct subject", () => {
    const subject = ObservationSubject.create({
      type: "property",
      id: "mesa-downtown-retreat",
    });

    expect(subject.type).toBe("property");
    expect(subject.id).toBe(
      "mesa-downtown-retreat",
    );
    expect(subject.hasParent).toBe(false);
  });

  it("creates a nested subject", () => {
    const subject = ObservationSubject.create({
      type: "investment-scenario",
      id: "purchase-base-case",
      parentType: "property",
      parentId: "mesa-downtown-retreat",
    });

    expect(subject.hasParent).toBe(true);
    expect(subject.parentType).toBe("property");
    expect(subject.parentId).toBe(
      "mesa-downtown-retreat",
    );
  });

  it("requires both parent fields together", () => {
    expect(() =>
      ObservationSubject.create({
        type: "investment-scenario",
        id: "purchase-base-case",
        parentType: "property",
      }),
    ).toThrow(
      "Observation subject parent type and parent id must be provided together.",
    );
  });

  it("compares structurally equal subjects", () => {
    const first = ObservationSubject.create({
      type: "property",
      id: "property-001",
    });

    const second = ObservationSubject.create({
      type: "property",
      id: "property-001",
    });

    expect(first.equals(second)).toBe(true);
  });
});
