import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { designSystemTokens } from "./tokens";

describe("Luxe Haven Application Design System v1", () => {
  it("keeps light and dark semantic color contracts aligned", () => {
    expect(Object.keys(designSystemTokens.color.light)).toEqual(
      Object.keys(designSystemTokens.color.dark),
    );
  });

  it("provides evidence-ready anatomy for every semantic status", () => {
    const statuses = Object.entries(designSystemTokens.color.light)
      .filter(([name]) => name.startsWith("status"))
      .map(([, value]) => value);

    expect(statuses).toHaveLength(5);
    for (const status of statuses) {
      expect(typeof status).toBe("object");
      expect(Object.keys(status)).toEqual([
        "foreground",
        "background",
        "border",
        "icon",
      ]);
    }
  });

  it("defines explicit and system appearance selectors", () => {
    const css = readFileSync(
      new URL("../app/globals.css", import.meta.url),
      "utf8",
    );

    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-theme="system"]');
    expect(css).toContain("--surface-canvas");
    expect(css).toContain("--status-information-icon");
  });
});
