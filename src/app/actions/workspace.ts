"use server";

import { redirect } from "next/navigation";

import {
  SupabaseWorkspaceRepository,
  initializeWorkspaceOwner,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export async function initializeWorkspaceAction() {
  const { user, profile } = await requireUser();
  await initializeWorkspaceOwner(new SupabaseWorkspaceRepository(), {
    profileId: user.id,
    role: profile?.role ?? "guest",
    displayName: profile?.full_name ?? null,
  });
  redirect("/dashboard/workspace");
}
