// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { refresh, action } = vi.hoisted(() => ({
  refresh: vi.fn(),
  action: vi.fn(async (_state, formData: FormData) => ({
    status: "version_conflict" as const,
    code: "VERSION_CONFLICT" as const,
    message: "This setting changed while you were working. We refreshed the current state. Review it before trying again.",
    currentMode: "broad_beta" as const,
    currentVersion: 3,
    preservedReason: String(formData.get("reason") ?? ""),
  })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions/auth-email-operations", () => ({
  initialPublicAuthModeActionState: { status: "idle" },
  setPublicAuthModeAction: action,
}));

import { PublicAuthControls } from "./public-auth-controls";

describe("Public Auth controls conflict UI", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("announces the conflict, focuses it, preserves reason, refreshes once, and never retries", async () => {
    render(<PublicAuthControls mode="invite_only" version={2}/>);
    const forms = document.querySelectorAll("form");
    const broad = forms[2];
    const confirmation = within(broad).getByLabelText("Confirmation");
    const reason = within(broad).getByLabelText("Reason");
    await userEvent.type(confirmation, "CONFIRM");
    await userEvent.type(reason, "Controlled stale version reason");
    await userEvent.click(screen.getByRole("button", { name: "broad beta" }));
    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain("This setting changed while you were working");
    expect(notice.textContent).toContain("Current mode: broad beta; version 3");
    expect(document.activeElement).toBe(notice);
    expect((reason as HTMLInputElement).value).toBe("Controlled stale version reason");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(action).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "broad beta" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
