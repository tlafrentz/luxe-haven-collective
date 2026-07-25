"use server";

import { revalidatePath } from "next/cache";

import {
  OrganizationConcurrencyError,
  OrganizationValidationError,
  SupabaseOrganizationRepository,
  SupabaseWorkspaceRepository,
  SupabaseTeamAccessRepository,
  getOrganizationProfile,
  normalizeOrganizationInput,
  resolveWorkspaceIdentity,
  updateOrganizationProfile,
  type OrganizationInput,
  type WorkspaceIdentity,
  type WorkspacePrincipal,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export type OrganizationActionResult =
  | Readonly<{ ok: true; message: string; revision: number }>
  | Readonly<{
      ok: false;
      message: string;
      fieldErrors?: Readonly<Record<string, string>>;
      code: "validation" | "permission" | "concurrency" | "runtime";
    }>;

export async function updateOrganizationAction(input: Readonly<{
  workspaceId: string;
  expectedRevision: number;
  idempotencyKey: string;
  values: OrganizationInput;
}>): Promise<OrganizationActionResult> {
  const { user, profile } = await requireUser();
  const access = await new SupabaseTeamAccessRepository().resolve(user.id);
  const principal: WorkspacePrincipal = {
    profileId: user.id,
    role: access?.role ?? profile?.role ?? "guest",
    displayName: profile?.full_name ?? profile?.email ?? null,
  };
  try {
    const resolved = await resolveWorkspaceIdentity(
      new SupabaseWorkspaceRepository(),
      principal,
    );
    if (
      !resolved.ownerId ||
      !resolved.workspaceId ||
      resolved.workspaceId !== input.workspaceId
    ) {
      return { ok: false, code: "permission", message: "This organization is not accessible." };
    }
    const identity: WorkspaceIdentity = {
      profileId: resolved.profileId,
      ownerId: resolved.ownerId,
      workspaceId: resolved.workspaceId,
    };
    const changes = normalizeOrganizationInput(input.values);
    const updated = await updateOrganizationProfile(
      new SupabaseOrganizationRepository(),
      principal,
      identity,
      {
        changes,
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
      },
    );
    revalidatePath("/dashboard/workspace");
    revalidatePath("/dashboard/workspace/organization");
    return {
      ok: true,
      message: "Organization settings saved.",
      revision: updated.revision,
    };
  } catch (error) {
    if (error instanceof OrganizationValidationError) {
      return {
        ok: false,
        code: "validation",
        message: error.message,
        fieldErrors: error.fieldErrors,
      };
    }
    if (error instanceof OrganizationConcurrencyError) {
      return { ok: false, code: "concurrency", message: error.message };
    }
    if (error instanceof Error && error.name === "WorkspaceAccessError") {
      return { ok: false, code: "permission", message: error.message };
    }
    console.error("Organization update failed.", { error });
    return {
      ok: false,
      code: "runtime",
      message: "Organization settings could not be saved. Your changes were preserved.",
    };
  }
}

export async function loadCurrentOrganizationForAction() {
  const { user, profile } = await requireUser();
  const access = await new SupabaseTeamAccessRepository().resolve(user.id);
  const principal: WorkspacePrincipal = {
    profileId: user.id,
    role: access?.role ?? profile?.role ?? "guest",
    displayName: profile?.full_name ?? profile?.email ?? null,
  };
  const resolved = await resolveWorkspaceIdentity(
    new SupabaseWorkspaceRepository(),
    principal,
  );
  if (!resolved.ownerId || !resolved.workspaceId) return null;
  return getOrganizationProfile(
    new SupabaseOrganizationRepository(),
    principal,
    {
      profileId: resolved.profileId,
      ownerId: resolved.ownerId,
      workspaceId: resolved.workspaceId,
    },
  );
}
