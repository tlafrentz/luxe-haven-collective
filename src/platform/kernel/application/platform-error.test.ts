import { describe, expect, it } from "vitest";

import { PlatformError } from "./platform-error";

class ValidationError extends PlatformError {
  public constructor(message: string) {
    super("VALIDATION_ERROR", message);
  }
}

describe("PlatformError", () => {
  it("stores a stable code and message", () => {
    const error = new PlatformError(
      "MARKET_DATA_UNAVAILABLE",
      "Market data is unavailable.",
    );

    expect(error.code).toBe("MARKET_DATA_UNAVAILABLE");
    expect(error.message).toBe("Market data is unavailable.");
  });

  it("retains a native error cause", () => {
    const cause = new Error("Provider timed out");
    const error = new PlatformError(
      "PROVIDER_FAILURE",
      "The provider failed.",
      { cause },
    );

    expect(error.cause).toBe(cause);
  });

  it("copies and freezes metadata", () => {
    const metadata = { provider: "rentcast" };
    const error = new PlatformError(
      "PROVIDER_FAILURE",
      "The provider failed.",
      { metadata },
    );

    metadata.provider = "other";

    expect(error.metadata).toEqual({ provider: "rentcast" });
    expect(Object.isFrozen(error.metadata)).toBe(true);
  });

  it("rejects an empty error code", () => {
    expect(
      () => new PlatformError("   ", "Invalid error."),
    ).toThrow("Platform error code cannot be empty.");
  });

  it("supports specialized platform errors", () => {
    const error = new ValidationError("Address is required.");

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toBeInstanceOf(PlatformError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ValidationError");
  });
});
