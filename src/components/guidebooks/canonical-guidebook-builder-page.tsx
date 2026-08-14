import Link from "next/link";
import { notFound } from "next/navigation";
import { getApprovalReviewAction } from "@/app/actions/guidebook-approval-review";
import { loadGuidebookAuthoringAction } from "@/app/actions/guidebook-authoring";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { GuidebookBuilderWorkspace } from "@/components/guidebooks/guidebook-builder-workspace";
import { propertyProjectionVariables } from "@/features/property-projection";
import { createAdminClient } from "@/lib/supabase/admin";

export type GuidebookBuilderSurface = "admin" | "dashboard";

export async function CanonicalGuidebookBuilderPage({
  guidebookId,
  surface,
}: {
  guidebookId: string;
  surface: GuidebookBuilderSurface;
}) {
  const result = await getGuidebookEditorRequest(guidebookId);
  const basePath = surface === "admin" ? "/admin/guidebooks" : "/dashboard/guidebooks";
  if (!result.ok) {
    if (result.code === "guidebook_not_found") notFound();
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-xl font-semibold">Guidebook unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-stone-600">
          This guidebook is outside your authorized workspace or is temporarily unavailable.
        </p>
        <Link href={basePath} className="mt-4 inline-block font-semibold underline">
          Return to Guidebooks
        </Link>
      </main>
    );
  }

  const [authoring, approval, customerLabel] = await Promise.all([
    loadGuidebookAuthoringAction({
      workspaceId: String(result.guidebook.workspace_id),
      guidebookId,
    }),
    getApprovalReviewAction(guidebookId),
    surface === "admin"
      ? resolveCustomerLabel(String(result.guidebook.workspace_id))
      : Promise.resolve(undefined),
  ]);
  if (!authoring.ok)
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-xl font-semibold">Builder unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-stone-600">{authoring.message}</p>
      </main>
    );

  const approvalStatus = approval.request?.status;
  const lifecycleStatus =
    result.guidebook.status === "archived"
      ? "archived"
      : approvalStatus === "pending"
        ? "in_review"
        : approvalStatus === "changes_requested"
          ? "changes_requested"
          : approvalStatus === "approved"
            ? "approved"
            : result.guidebook.status === "published"
              ? "published"
              : "draft";
  const canEdit =
    result.permissions.manage &&
    authoring.canEdit &&
    !["archived", "in_review", "approved"].includes(lifecycleStatus);
  const variables = propertyProjectionVariables(
    result.propertyProjection,
    `/stay/${result.guidebook.public_slug}`,
  );

  return (
    <GuidebookBuilderWorkspace
      initialDraft={authoring.draft}
      versionId={String(result.guidebook.active_draft_version_id ?? result.guidebook.revision)}
      surface={surface}
      lifecycleStatus={lifecycleStatus}
      canEdit={canEdit}
      canPublish={
        result.permissions.manage &&
        result.entitlements.publish &&
        result.entitlements.host &&
        lifecycleStatus !== "archived"
      }
      basePath={basePath}
      propertyName={variables.propertyName}
      customerLabel={customerLabel}
    />
  );
}

async function resolveCustomerLabel(workspaceId: string) {
  const { data } = await createAdminClient()
    .from("owners")
    .select("display_name,company_name,business_email,profiles!owners_profile_id_fkey(full_name,email)")
    .eq("id", workspaceId)
    .maybeSingle();
  const profile = data?.profiles as unknown as
    | { full_name: string | null; email: string | null }
    | null;
  const display = data?.display_name?.trim() || profile?.full_name?.trim() || data?.company_name?.trim();
  const email = profile?.email?.trim() || data?.business_email?.trim();
  return display || (email ? `Profile incomplete — ${email}` : "Profile incomplete");
}
