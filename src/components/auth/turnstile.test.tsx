// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TurnstileChallenge } from "@/components/auth/turnstile";

vi.mock("next/script", () => ({ default: ({ onReady }: { onReady?: () => void }) => { queueMicrotask(() => onReady?.()); return null; } }));

describe("LOGIN-TURNSTILE-001 challenge lifecycle", () => {
  const originalKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const renderWidget = vi.fn();
  const removeWidget = vi.fn();

  beforeEach(() => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "production-test-site-key";
    renderWidget.mockReset().mockReturnValue("widget-1");
    removeWidget.mockReset();
    window.turnstile = { render: renderWidget, remove: removeWidget, reset: vi.fn() };
  });

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalKey;
    delete window.turnstile;
  });

  it("mounts exactly once after the API and container are ready", async () => {
    render(<TurnstileChallenge />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Complete the security check to continue.")).toBeTruthy();
  });

  it("shows accessible diagnostics and retries a failed challenge", async () => {
    render(<TurnstileChallenge />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
    const options = renderWidget.mock.calls[0]?.[1] as Record<string, () => void>;
    options["error-callback"]();
    fireEvent.click(await screen.findByRole("button", { name: "Troubleshoot security check" }));
    expect(screen.getByRole("status").textContent).toContain("JavaScript and cookies");
    fireEvent.click(screen.getByRole("button", { name: "Reload the security check" }));
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2));
    expect(removeWidget).toHaveBeenCalledWith("widget-1");
  });

  it("expires fail closed and requires a new challenge", async () => {
    render(<TurnstileChallenge />);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));
    const options = renderWidget.mock.calls[0]?.[1] as Record<string, () => void>;
    options["expired-callback"]();
    expect(await screen.findByText(/security check expired/i)).toBeTruthy();
    expect((document.querySelector('input[name="captchaToken"]') as HTMLInputElement).value).toBe("");
  });
});
