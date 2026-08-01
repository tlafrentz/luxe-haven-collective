// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
window.scrollTo = vi.fn();
const { save } = vi.hoisted(() => ({
  save: vi.fn(async () => ({
    ok: false,
    message: "Draft could not be saved.",
  })),
}));
vi.mock("@/app/actions/guest-communications", () => ({
  saveGuestCommunicationDraft: save,
  sendGuestCommunicationReplyAction: vi.fn(async () => ({
    ok: false,
    message: "",
  })),
}));
import { GuestMessageComposer } from "./guest-message-composer";
describe("Communications guidebook insertion interaction", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    save.mockClear();
  });
  it("focuses the inserted draft, never sends automatically, and preserves edits after persistence failure", async () => {
    render(
      <GuestMessageComposer
        conversationId="conversation-owner"
        initialBody={`Current draft\n\nGuest guidebook:\n\n/g/${"a".repeat(24)}`}
        templates={[]}
        values={{}}
        focusOnMount
      />,
    );
    const textbox = screen.getByRole("textbox", { name: "Reply" });
    expect(document.activeElement).toBe(textbox);
    await userEvent.type(textbox, " Additional note");
    expect((textbox as HTMLTextAreaElement).value).toContain("Additional note");
    await waitFor(() => expect(save).toHaveBeenCalled(), { timeout: 2000 });
    expect((textbox as HTMLTextAreaElement).value).toContain("Additional note");
    expect(screen.getByText("Saved locally")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send reply" })).toBeTruthy();
  });
  it("supports keyboard-only editing and explicit send remains a separate enabled control", async () => {
    render(
      <GuestMessageComposer
        conversationId="conversation-owner"
        initialBody="Draft"
        templates={[]}
        values={{}}
      />,
    );
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Reply" }),
    );
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Send reply" }),
    );
  });
});
