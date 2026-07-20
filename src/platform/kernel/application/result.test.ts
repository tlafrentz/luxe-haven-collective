import { describe, expect, it, vi } from "vitest";

import { Result } from "./result";

describe("Result", () => {
  it("creates immutable success results", () => {
    const result = Result.ok(42);

    expect(result).toEqual({
      isSuccess: true,
      isFailure: false,
      value: 42,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("creates immutable failure results", () => {
    const error = new Error("boom");
    const result = Result.fail(error);

    expect(result).toEqual({
      isSuccess: false,
      isFailure: true,
      error,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("maps successful values", () => {
    const result = Result.map(Result.ok(2), (value) => value * 3);

    expect(result).toEqual(Result.ok(6));
  });

  it("does not execute value mapping for failures", () => {
    const transform = vi.fn((value: number) => value * 3);
    const error = new Error("boom");

    const result = Result.map(Result.fail(error), transform);

    expect(result).toEqual(Result.fail(error));
    expect(transform).not.toHaveBeenCalled();
  });

  it("maps failures", () => {
    const result = Result.mapError(
      Result.fail("invalid"),
      (error) => new Error(error),
    );

    expect(result.isFailure).toBe(true);

    if (result.isFailure) {
      expect(result.error.message).toBe("invalid");
    }
  });

  it("flat maps successful values", () => {
    const result = Result.flatMap(
      Result.ok(2),
      (value) => Result.ok(value * 4),
    );

    expect(result).toEqual(Result.ok(8));
  });

  it("preserves the original failure during flatMap", () => {
    const error = new Error("boom");
    const transform = vi.fn(() => Result.ok(8));

    const result = Result.flatMap(Result.fail(error), transform);

    expect(result).toEqual(Result.fail(error));
    expect(transform).not.toHaveBeenCalled();
  });

  it("matches a success", () => {
    const output = Result.match(Result.ok(7), {
      ok: (value) => `value:${value}`,
      fail: () => "failed",
    });

    expect(output).toBe("value:7");
  });

  it("matches a failure", () => {
    const output = Result.match(Result.fail("invalid"), {
      ok: () => "success",
      fail: (error) => `error:${error}`,
    });

    expect(output).toBe("error:invalid");
  });

  it("returns the success value from getOrElse", () => {
    expect(Result.getOrElse(Result.ok(12), 0)).toBe(12);
  });

  it("uses a static fallback for failures", () => {
    expect(Result.getOrElse(Result.fail("invalid"), 0)).toBe(0);
  });

  it("uses a computed fallback for failures", () => {
    expect(
      Result.getOrElse(
        Result.fail("invalid"),
        (error) => error.length,
      ),
    ).toBe(7);
  });
});
