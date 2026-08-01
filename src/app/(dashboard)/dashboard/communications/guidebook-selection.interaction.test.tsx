// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { inbox } = vi.hoisted(() => ({ inbox: vi.fn() }));
vi.mock("@/app/actions/guest-communications", () => ({
  getGuestCommunicationInbox: inbox,
  associateProviderReviewMessageAction: vi.fn(),
}));
vi.mock("@/components/communications/communication-context-refresh", () => ({
  CommunicationContextRefresh: () => null,
}));
import CommunicationsPage from "./page";

const conversation = {
  id: "conversation-owner",
  guestName: "Avery Guest",
  propertyName: "Lakeside Retreat",
  reservation_id: "reservation-1",
  stayStatus: "arrival-today",
  waitingOn: "operator",
  priority: "normal",
  lastMessage: "When can we arrive?",
  bookingSource: "Direct",
  channel: "platform",
  unread_count: 1,
  last_activity_at: "2026-07-31T12:00:00Z",
};

describe("Guidebook communications conversation selection", () => {
  afterEach(cleanup);

  it("renders authorized conversations and carries the stable URL only into the selected draft route", async () => {
    inbox.mockResolvedValue({
      ok: true,
      properties: [],
      reviewQueue: [],
      canReviewProviderMessages: false,
      provider: { connected: true },
      conversations: [conversation],
    });
    const element = await CommunicationsPage({
      searchParams: Promise.resolve({
        guidebookLink: `/g/${"a".repeat(24)}`,
      }),
    });
    render(element);
    expect(
      screen.getByText(/will be inserted into its draft and will not be sent/i),
    ).toBeTruthy();
    const selection = screen.getByRole("link", { name: /Avery Guest/i });
    expect(selection.getAttribute("href")).toBe(
      `/dashboard/communications/conversation-owner?guidebookLink=%2Fg%2F${"a".repeat(24)}`,
    );
    selection.focus();
    expect(document.activeElement).toBe(selection);
    await userEvent.keyboard("{Tab}");
  });

  it("renders a bounded empty state without inventing a conversation", async () => {
    inbox.mockResolvedValue({
      ok: true,
      properties: [],
      reviewQueue: [],
      canReviewProviderMessages: false,
      provider: { connected: true },
      conversations: [],
    });
    render(await CommunicationsPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("heading", { name: "No conversations" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Avery Guest/i })).toBeNull();
  });

  it("renders the same unavailable state without leaking conversation data", async () => {
    inbox.mockResolvedValue({ ok: false });
    render(
      await CommunicationsPage({
        searchParams: Promise.resolve({
          guidebookLink: `/g/${"a".repeat(24)}`,
        }),
      }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Guest Communications is unavailable",
    );
    expect(screen.queryByText("Avery Guest")).toBeNull();
  });
});
