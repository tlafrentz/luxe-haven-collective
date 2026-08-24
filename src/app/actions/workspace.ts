"use server";

import {
  SupabaseWorkspaceRepository,
  initializeWorkspaceOwner,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export type InitializeWorkspaceState = Readonly<{ ok?: boolean; message?: string; workspaceId?: string }>;

export async function initializeWorkspaceAction(_previous: InitializeWorkspaceState): Promise<InitializeWorkspaceState> {
  void _previous;
  try {
    const { user, profile } = await requireUser();
    const identity = await initializeWorkspaceOwner(new SupabaseWorkspaceRepository(), {
      profileId: user.id,
      role: profile?.role ?? "guest",
      displayName: profile?.full_name ?? null,
    });
    return { ok: true, workspaceId: identity.workspaceId };
  } catch (error) {
    console.error("Workspace initialization failed.", { error });
    return { ok: false, message: "Workspace setup could not be completed. Your account was not changed; retry or contact support." };
  }
}
