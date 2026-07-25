import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type OwnerIdentity = Readonly<{
  profileId: string;
  ownerId: string | null;
  workspaceId: string | null;
  ownerProfileId: string;
  membershipId: string | null;
  accessiblePropertyIds: readonly string[] | null;
}>;

type SupabaseDiagnostic = Readonly<{
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}>;

export class OperationalReadError extends Error {
  readonly state: "permission" | "degraded";
  readonly diagnostic: SupabaseDiagnostic | null;

  constructor(
    message: string,
    state: "permission" | "degraded",
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "OperationalReadError";
    this.state = state;
    this.diagnostic =
      cause && typeof cause === "object"
        ? {
            ...("code" in cause && typeof cause.code === "string"
              ? { code: cause.code }
              : {}),
            ...("message" in cause && typeof cause.message === "string"
              ? { message: cause.message }
              : {}),
            ...("details" in cause && typeof cause.details === "string"
              ? { details: cause.details }
              : {}),
            ...("hint" in cause && typeof cause.hint === "string"
              ? { hint: cause.hint }
              : {}),
          }
        : null;
  }
}

function permissionFailure(error: SupabaseDiagnostic): boolean {
  return error.code === "42501" || /permission|row-level security/i.test(error.message ?? "");
}

export function throwOperationalReadError(
  operation: string,
  error: SupabaseDiagnostic,
): never {
  const state = permissionFailure(error) ? "permission" : "degraded";
  console.error("Operational Supabase read failed.", {
    operation,
    state,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  throw new OperationalReadError(
    `${operation} failed${error.message ? `: ${error.message}` : "."}`,
    state,
    error,
  );
}

export async function resolveOwnerIdentity(
  supabase: ServerSupabaseClient,
  profileId: string,
): Promise<OwnerIdentity> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throwOperationalReadError("Owner authentication", authError);
  if (!user) {
    throw new OperationalReadError(
      "Owner authentication is required.",
      "permission",
    );
  }
  if (user.id !== profileId) {
    throw new OperationalReadError(
      "The requested owner profile is not accessible.",
      "permission",
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_memberships")
    .select(
      "id, workspace_id, role, status, property_access_mode, owner:owners!workspace_memberships_workspace_id_fkey(profile_id), access:workspace_member_property_access(property_id)",
    )
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError && membershipError.code !== "42P01") {
    throwOperationalReadError("Workspace membership resolution", membershipError);
  }
  if (membership && !Array.isArray(membership)) {
    const owner = Array.isArray(membership.owner)
      ? membership.owner[0]
      : membership.owner;
    if (!owner?.profile_id) {
      throw new OperationalReadError(
        "Workspace membership has no owner identity.",
        "degraded",
      );
    }
    const allProperties =
      membership.role === "owner" ||
      membership.role === "administrator" ||
      membership.property_access_mode === "all";
    return Object.freeze({
      profileId,
      ownerId: membership.workspace_id,
      workspaceId: membership.workspace_id,
      ownerProfileId: owner.profile_id,
      membershipId: membership.id,
      accessiblePropertyIds: allProperties
        ? null
        : membership.property_access_mode === "selected"
          ? (membership.access ?? []).map(({ property_id }) => property_id)
          : [],
    });
  }

  const { data, error } = await supabase
    .from("owners")
    .select("id, profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throwOperationalReadError("Owner identity resolution", error);
  return Object.freeze({
    profileId,
    ownerId: data?.id ?? null,
    workspaceId: data?.id ?? null,
    ownerProfileId: profileId,
    membershipId: null,
    accessiblePropertyIds: null,
  });
}
