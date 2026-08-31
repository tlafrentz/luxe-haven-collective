import { notFound } from "next/navigation";
import { requireReleaseControlAccess } from "@/features/furnishing-studio/server-release-control-access";
import { createClient } from "@/lib/supabase/server";
import { FurnishingHeader } from "@/components/furnishing/furnishing-navigation";
import {
  RELEASE_CAPABILITIES,
  type ReleaseCapability,
} from "@/features/furnishing-studio/release-controls";
import ReleaseSequence from "./release-sequence";

export default async function ControlledWorkspacePage({
  params,
}: PageProps<"/admin/furnishing/release-controls/workspaces/[workspaceId]">) {
  const { workspaceId } = await params;
  await requireReleaseControlAccess("view", workspaceId);
  const db = await createClient();
  const { data: workspace } = await db.rpc(
    "resolve_furnishing_activation_control",
    {
      p_target: "workspace",
      p_target_id: workspaceId,
      p_tenant_id: workspaceId,
    },
  );
  const value = workspace as null | {
    status?: string;
    state?: string;
    version?: number;
    killSwitch?: boolean;
    cohort?: string | null;
    expiresAt?: string | null;
    revokedAt?: string | null;
  };
  if (value?.status !== "found") notFound();
  const [
    { data: owner },
    { data: releaseData },
    { data: verificationRows },
    ...responses
  ] = await Promise.all([
    db
      .from("owners")
      .select("display_name,company_name")
      .eq("id", workspaceId)
      .maybeSingle(),
    db.rpc("resolve_furnishing_activation_control", {
      p_target: "global",
      p_target_id: "global",
      p_tenant_id: null,
    }),
    db
      .from("furnishing_activation_capabilities")
      .select("capability,verification_state"),
    ...RELEASE_CAPABILITIES.map((capability) =>
      db.rpc("resolve_furnishing_activation_control", {
        p_target: "capability",
        p_target_id: capability,
        p_tenant_id: workspaceId,
      }),
    ),
  ]);
  const capabilities = RELEASE_CAPABILITIES.map((capability, index) => {
    const row = responses[index].data as null | {
      state?: string;
      version?: number;
    };
    const verification = verificationRows?.find(
      (entry) => entry.capability === capability,
    )?.verification_state;
    return {
      capability: capability as ReleaseCapability,
      enabled: row?.state === "internal",
      verification:
        verification === "verified" || verification === "failed"
          ? verification
          : ("unverified" as const),
      version: Number(row?.version ?? 0),
    };
  });
  const name =
    owner?.display_name || owner?.company_name || "Controlled workspace";
  const release = releaseData as null | {
    version?: number;
    policyVersion?: string;
    state?: string;
    globalKillSwitch?: boolean;
  };
  return (
    <main className="space-y-8 px-4 pb-12 sm:px-6">
      <FurnishingHeader
        title={name}
        description="Activate and verify bounded capabilities in policy order."
        current="release-controls"
      />
      <ReleaseSequence
        workspaceId={workspaceId}
        workspaceName={name}
        release={{
          version: Number(release?.version ?? 0),
          policyVersion: release?.policyVersion ?? "fs008a-v1",
          suspended: release?.state === "paused",
          protected: release?.globalKillSwitch !== false,
        }}
        workspace={{
          enabled: value.state === "internal",
          killSwitch: value.killSwitch !== false,
          cohort: value.cohort,
          expiresAt: value.expiresAt,
          revokedAt: value.revokedAt,
          version: Number(value.version),
        }}
        capabilities={capabilities}
      />
    </main>
  );
}
