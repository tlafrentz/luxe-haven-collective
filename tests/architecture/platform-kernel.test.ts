import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Platform Kernel", () => {
  it("exports a public API", () => {
    expect(
      existsSync(resolve("src/platform/kernel/index.ts"))
    ).toBe(true);
  });
});

/**
 * Recommended future architecture rules:
 *
 * - platform -> platform
 * - features -> platform
 * - platform !-> features
 * - domain !-> presentation
 * - application !-> presentation
 *
 * These should eventually be enforced with dependency-cruiser,
 * ESLint boundaries, or similar tooling.
 */
