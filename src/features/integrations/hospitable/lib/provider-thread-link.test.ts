import { describe, expect, it, vi } from "vitest";
import {
  linkProviderThread,
  mapProviderThreadLinkError,
  ProviderThreadLinkError,
} from "./provider-thread-link";

const input = {
  workspaceId: "workspace-a",
  conversationId: "conversation-c",
  provider: " Hospitable ",
  threadId: " thread-t ",
  reservationReference: "reservation-r",
  observedAt: "2026-07-28T12:00:00Z",
};

describe("COM-002D provider thread linking", () => {
  it.each(["created", "reused"] as const)("returns the canonical %s link", async outcome => {
    const rpc = vi.fn(async () => ({
      data: {
        id: "provider-thread-uuid",
        conversation_id: "conversation-c",
        workspace_id: "workspace-a",
        provider: "hospitable",
        thread_id: "thread-t",
        outcome,
      },
      error: null,
    }));
    await expect(linkProviderThread(input, { rpc })).resolves.toMatchObject({ outcome, threadId: "thread-t" });
    expect(rpc).toHaveBeenCalledWith("link_guest_conversation_provider_thread", expect.objectContaining({
      p_provider: "hospitable",
      p_thread_id: "thread-t",
      p_record_id: null,
    }));
  });

  it("passes an explicit stable record identity for equivalent primary-key replay checks", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "PROVIDER_THREAD_LINK_FAILED" } }));
    await expect(linkProviderThread({ ...input, recordId: "provider-thread-stable" }, { rpc })).rejects.toThrow();
    expect(rpc).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ p_record_id: "provider-thread-stable" }));
  });

  it("rejects invalid identity before persistence", async () => {
    const rpc = vi.fn();
    await expect(linkProviderThread({ ...input, threadId: " " }, { rpc })).rejects.toMatchObject({
      code: "PROVIDER_THREAD_IDENTITY_INVALID",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    "PROVIDER_THREAD_CONVERSATION_CONFLICT",
    "PROVIDER_THREAD_WORKSPACE_MISMATCH",
    "PROVIDER_THREAD_IDENTITY_INVALID",
  ] as const)("maps %s without exposing PostgreSQL details", code => {
    const error = mapProviderThreadLinkError({ message: `${code}: guest_conversation_provider_threads_pkey` });
    expect(error).toBeInstanceOf(ProviderThreadLinkError);
    expect(error.code).toBe(code);
    expect(error.message).not.toContain("pkey");
  });

  it("maps unknown persistence errors to a safe failure", () => {
    expect(mapProviderThreadLinkError({ message: "duplicate key", code: "23505" })).toMatchObject({
      code: "PROVIDER_THREAD_LINK_FAILED",
      message: "Provider context could not be linked to the guest conversation.",
    });
  });
});
