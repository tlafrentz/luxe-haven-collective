import { createAdminClient } from "@/lib/supabase/admin";

export const PROVIDER_THREAD_LINK_CODES = [
  "PROVIDER_THREAD_CONVERSATION_CONFLICT",
  "PROVIDER_THREAD_WORKSPACE_MISMATCH",
  "PROVIDER_THREAD_IDENTITY_INVALID",
  "PROVIDER_THREAD_LINK_FAILED",
] as const;

export type ProviderThreadLinkCode = typeof PROVIDER_THREAD_LINK_CODES[number];
export type ProviderThreadLinkOutcome = "created" | "reused";

export type ProviderThreadLink = Readonly<{
  id: string;
  conversationId: string;
  workspaceId: string;
  provider: string;
  threadId: string;
  outcome: ProviderThreadLinkOutcome;
}>;

export class ProviderThreadLinkError extends Error {
  public constructor(
    public readonly code: ProviderThreadLinkCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProviderThreadLinkError";
  }
}

type RpcClient = Readonly<{
  rpc(
    functionName: string,
    parameters: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
}>;

type LinkRow = Readonly<{
  id: string;
  conversation_id: string;
  workspace_id: string;
  provider: string;
  thread_id: string;
  outcome: ProviderThreadLinkOutcome;
}>;

export async function linkProviderThread(
  input: Readonly<{
    workspaceId: string;
    conversationId: string;
    provider: string;
    threadId: string;
    reservationReference?: string | null;
    observedAt: string;
    recordId?: string;
  }>,
  client: RpcClient = createAdminClient() as unknown as RpcClient,
): Promise<ProviderThreadLink> {
  const provider = input.provider.trim().toLowerCase();
  const threadId = input.threadId.trim();
  if (!input.workspaceId.trim() || !input.conversationId.trim() || !provider || !threadId) {
    throw new ProviderThreadLinkError(
      "PROVIDER_THREAD_IDENTITY_INVALID",
      "Provider thread identity requires a workspace, conversation, provider, and thread ID.",
    );
  }

  const { data, error } = await client.rpc("link_guest_conversation_provider_thread", {
    p_workspace_id: input.workspaceId,
    p_conversation_id: input.conversationId,
    p_provider: provider,
    p_thread_id: threadId,
    p_reservation_reference: input.reservationReference ?? null,
    p_last_observed_at: input.observedAt,
    p_record_id: input.recordId ?? null,
  });
  if (error) throw mapProviderThreadLinkError(error);

  const row = data as LinkRow | null;
  if (!row || !["created", "reused"].includes(row.outcome)) {
    throw new ProviderThreadLinkError(
      "PROVIDER_THREAD_LINK_FAILED",
      "Provider context could not be linked to the guest conversation.",
    );
  }
  return Object.freeze({
    id: row.id,
    conversationId: row.conversation_id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    threadId: row.thread_id,
    outcome: row.outcome,
  });
}

export function mapProviderThreadLinkError(
  error: Readonly<{ message?: string; code?: string }>,
): ProviderThreadLinkError {
  const code = PROVIDER_THREAD_LINK_CODES.find(value => error.message?.includes(value));
  if (code) {
    const message = code === "PROVIDER_THREAD_CONVERSATION_CONFLICT"
      ? "Provider context could not be linked because this Hospitable thread is already attached to another conversation."
      : code === "PROVIDER_THREAD_WORKSPACE_MISMATCH"
        ? "Provider context belongs to a different messaging workspace."
        : code === "PROVIDER_THREAD_IDENTITY_INVALID"
          ? "Provider context is missing a valid provider thread identity."
          : "Provider context could not be linked to the guest conversation.";
    return new ProviderThreadLinkError(code, message, { cause: error });
  }
  return new ProviderThreadLinkError(
    "PROVIDER_THREAD_LINK_FAILED",
    "Provider context could not be linked to the guest conversation.",
    { cause: error },
  );
}
