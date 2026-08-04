import { describe, expect, it } from "vitest";
import {
  resolvePostLoginDestination,
  safeInternalDestination,
  savedLandingDestination,
} from "./post-login-destination";

describe("post-login destination", () => {
  it("honors a safe explicit destination before the saved preference", () => {
    expect(
      resolvePostLoginDestination({
        nextPath: "/dashboard/reports?view=mine",
        savedLanding: "bookings",
        role: "owner",
        roleDefault: "/dashboard",
      }),
    ).toBe("/dashboard/reports?view=mine");
  });

  it("maps an authorized saved preference and rejects malformed external paths", () => {
    expect(savedLandingDestination("bookings", "owner")).toBe("/bookings");
    expect(safeInternalDestination("//evil.example/path")).toBeNull();
    expect(safeInternalDestination("/\\evil.example/path")).toBeNull();
  });

  it("normalizes legacy dashboard destinations to canonical portal routes", () => {
    expect(safeInternalDestination("/dashboard/bookings?view=upcoming")).toBe(
      "/bookings?view=upcoming",
    );
    expect(safeInternalDestination("/dashboard/properties#active")).toBe(
      "/properties#active",
    );
    expect(safeInternalDestination("/dashboard/messages")).toBe("/messages");
  });

  it("falls back deterministically when a preference is invalid for the role", () => {
    expect(
      resolvePostLoginDestination({
        savedLanding: "intelligence",
        role: "guest",
        roleDefault: "/",
        nextPath: "https://evil.example",
      }),
    ).toBe("/");
  });
});
