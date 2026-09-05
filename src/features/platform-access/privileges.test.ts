import { describe, expect, it } from "vitest";
import { PRIVILEGE_IDS, ROLE_NAMES, SCOPE_TYPES } from "./privileges";

describe("PRIVILEGE_IDS", () => {
  const values = Object.values(PRIVILEGE_IDS);

  it("every id matches module.resource.action shape", () => {
    for (const id of values) expect(id).toMatch(/^[a-z]+\.[a-z_]+\.[a-z_]+$/);
  });

  it("has no duplicate identifiers", () => {
    expect(new Set(values).size).toBe(values.length);
  });

  it("seeds exactly the 76 privileges from the spec's module list, plus the PA-006 portfolio privilege addition", () => {
    expect(values.length).toBe(77);
  });
});

describe("ROLE_NAMES", () => {
  it("is exactly the five canonical roles, in spec order", () => {
    expect(ROLE_NAMES).toEqual(["workspace_owner", "administrator", "manager", "contributor", "viewer"]);
  });
});

describe("SCOPE_TYPES", () => {
  it("is exactly the six-tier hierarchy, broadest first", () => {
    expect(SCOPE_TYPES).toEqual(["platform", "workspace", "portfolio", "property", "project", "resource"]);
  });
});
