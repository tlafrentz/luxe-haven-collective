import { notFound } from "next/navigation";
import Link from "next/link";
import {
  WorkspaceCard,
  WorkspacePage,
  WorkspaceSectionHeading,
} from "@/components/application-layout";
import { createAutomationDraft } from "@/app/actions/automation-workspace";
import {
  getAutomationWorkspaceProjection,
  parseAutomationWorkspaceQuery,
  type AutomationWorkspaceView,
} from "../application";
import {
  ApprovalDetailView,
  ApprovalsView,
  AutomationDetailView,
  AutomationFailure,
  AutomationOverviewView,
  AutomationWorkspaceFrame,
  AutomationsView,
  RunDetailView,
  RunsView,
  TemplatesView,
} from "./automation-workspace";

export async function AutomationWorkspaceRoute({
  view,
  searchParams,
}: {
  view: AutomationWorkspaceView;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseAutomationWorkspaceQuery(await searchParams, view),
    result = await getAutomationWorkspaceProjection(query);
  if (!result.ok) return <AutomationFailure {...result} />;
  const content =
    view === "overview" ? (
      <AutomationOverviewView model={result.value} />
    ) : view === "definitions" ? (
      <AutomationsView model={result.value} />
    ) : view === "approvals" ? (
      <ApprovalsView model={result.value} />
    ) : view === "runs" ? (
      <RunsView model={result.value} />
    ) : (
      <TemplatesView model={result.value} flags={result.flags} />
    );
  return (
    <AutomationWorkspaceFrame
      activeView={view}
      model={result.value}
      flags={result.flags}
      query={query}
    >
      {content}
    </AutomationWorkspaceFrame>
  );
}
export async function AutomationDetailRoute({
  kind,
  id,
  searchParams,
}: {
  kind: "definition" | "approval" | "run";
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    view =
      kind === "definition"
        ? "definitions"
        : kind === "approval"
          ? "approvals"
          : "runs",
    query = parseAutomationWorkspaceQuery(
      { ...raw, search: undefined, status: undefined, page: undefined },
      view,
    ),
    result = await getAutomationWorkspaceProjection(query);
  if (!result.ok) return <AutomationFailure {...result} />;
  if (kind === "definition") {
    const item = result.value.automations.find((entry) => entry.id === id);
    if (!item) notFound();
    return (
      <AutomationWorkspaceFrame
        activeView={view}
        model={result.value}
        flags={result.flags}
        query={query}
      >
        <AutomationDetailView item={item} flags={result.flags} />
      </AutomationWorkspaceFrame>
    );
  }
  if (kind === "approval") {
    const item = result.value.approvals.find((entry) => entry.id === id);
    if (!item) notFound();
    return (
      <AutomationWorkspaceFrame
        activeView={view}
        model={result.value}
        flags={result.flags}
        query={query}
      >
        <ApprovalDetailView item={item} flags={result.flags} />
      </AutomationWorkspaceFrame>
    );
  }
  const item = result.value.runs.find((entry) => entry.id === id);
  if (!item) notFound();
  return (
    <AutomationWorkspaceFrame
      activeView={view}
      model={result.value}
      flags={result.flags}
      query={query}
    >
      <RunDetailView item={item} flags={result.flags} />
    </AutomationWorkspaceFrame>
  );
}
export async function AutomationVersionRoute({
  automationId,
  versionId,
  searchParams,
}: {
  automationId: string;
  versionId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    query = parseAutomationWorkspaceQuery(
      { ...raw, search: undefined, status: undefined, page: undefined },
      "definitions",
    ),
    result = await getAutomationWorkspaceProjection(query);
  if (!result.ok) return <AutomationFailure {...result} />;
  const item = result.value.automations.find(
    (entry) => entry.id === automationId,
  );
  if (!item || String(item.currentVersion) !== versionId) notFound();
  return (
    <AutomationWorkspaceFrame
      activeView="definitions"
      model={result.value}
      flags={result.flags}
      query={query}
    >
      <article>
        <Link href={item.href} className="text-sm font-semibold text-teal-800">
          ← Back to automation
        </Link>
        <WorkspaceSectionHeading
          title={`${item.name} · version ${versionId}`}
          description="Immutable structured version review"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <WorkspaceCard className="p-5">
            <h2 className="font-semibold">Definition</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-stone-500">Scope</dt>
                <dd>{item.scopeLabel}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Trigger</dt>
                <dd>{item.trigger}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Lifecycle</dt>
                <dd>{item.status}</dd>
              </div>
            </dl>
          </WorkspaceCard>
          <WorkspaceCard className="p-5">
            <h2 className="font-semibold">Material change summary</h2>
            <p className="mt-4 text-sm text-stone-600">
              This is the current immutable version. A derived draft will
              display structured trigger, scope, command, approval, and policy
              differences here without exposing raw payloads.
            </p>
          </WorkspaceCard>
        </div>
      </article>
    </AutomationWorkspaceFrame>
  );
}
export async function NewAutomationRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    query = parseAutomationWorkspaceQuery(params, "definitions"),
    result = await getAutomationWorkspaceProjection(query);
  if (!result.ok) return <AutomationFailure {...result} />;
  if (!result.flags.authoring || result.flags.readOnly) notFound();
  const template =
    typeof params.template === "string"
      ? result.value.templates.find(({ id }) => id === params.template)
      : undefined;
  return (
    <AutomationWorkspaceFrame
      activeView="definitions"
      model={result.value}
      flags={result.flags}
      query={query}
    >
      <article>
        <WorkspaceSectionHeading
          title="Create automation draft"
          description="A guided draft uses canonical AU-001B trigger and AU-001C command contracts. Nothing is activated from this screen."
        />
        <form
          action={createAutomationDraft}
          className="space-y-6 rounded-2xl border bg-white p-6"
        >
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 font-semibold">Identity and purpose</legend>
            <label className="text-sm font-semibold">
              Name
              <input
                name="name"
                required
                maxLength={120}
                className="mt-1 min-h-11 w-full rounded-xl border px-3"
                defaultValue={template?.name ?? ""}
              />
            </label>
            <label className="text-sm font-semibold">
              Property
              <select
                name="propertyId"
                required
                className="mt-1 min-h-11 w-full rounded-xl border px-3"
              >
                {result.value.scope.propertyIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Purpose
              <textarea
                name="description"
                required
                maxLength={1000}
                className="mt-1 min-h-28 w-full rounded-xl border p-3"
                defaultValue={template?.purpose ?? ""}
              />
            </label>
          </fieldset>
          <fieldset>
            <legend className="font-semibold">Governed configuration</legend>
            <p className="mt-2 text-sm text-stone-600">
              This initial draft uses a manual AU-001B trigger and the AU-001C
              Execute draft-plan command. Trigger, scope, approval posture,
              retries, and notifications are validated server-side.
            </p>
            {template ? (
              <>
                <input
                  type="hidden"
                  name="templateOrigin"
                  value={`${template.id}:v${template.version}`}
                />
                <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
                  Bound to template {template.id} version {template.version}.
                </p>
              </>
            ) : null}
          </fieldset>
          <button
            type="submit"
            className="min-h-11 rounded-full bg-stone-950 px-5 text-sm font-semibold text-white"
          >
            Create draft
          </button>
        </form>
      </article>
    </AutomationWorkspaceFrame>
  );
}
export function AutomationLoading() {
  return (
    <WorkspacePage>
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">Loading Automation workspace</span>
        {[1, 2, 3].map((value) => (
          <div
            key={value}
            className="h-28 animate-pulse rounded-2xl bg-stone-100 motion-reduce:animate-none"
          />
        ))}
      </div>
    </WorkspacePage>
  );
}
