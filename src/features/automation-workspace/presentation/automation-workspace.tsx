import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  StatusChip,
  WorkspaceCard,
  WorkspaceEmptyState,
  WorkspaceHeader,
  WorkspaceNavigation,
  WorkspacePage,
  WorkspaceSectionHeading,
} from "@/components/application-layout";
import { executeAutomationWorkspaceCommand } from "@/app/actions/automation-workspace";
import type {
  AutomationExperienceFlags,
  AutomationWorkspaceQuery,
  AutomationWorkspaceView,
} from "../application/automation-workspace-composition";
import type {
  AutomationApprovalItem,
  AutomationExperienceCommand,
  AutomationListItem,
  AutomationRunItem,
  AutomationTemplate,
  AutomationWorkspaceProjection,
} from "../application/automation-workspace-projections";

const NAV: readonly Readonly<{
  view: AutomationWorkspaceView;
  label: string;
  href: string;
}>[] = [
  { view: "overview", label: "Overview", href: "/dashboard/automations" },
  {
    view: "definitions",
    label: "Automations",
    href: "/dashboard/automations/definitions",
  },
  {
    view: "approvals",
    label: "Approvals",
    href: "/dashboard/automations/approvals",
  },
  { view: "runs", label: "Runs", href: "/dashboard/automations/runs" },
  {
    view: "templates",
    label: "Templates",
    href: "/dashboard/automations/templates",
  },
  {
    view: "operations",
    label: "Operations",
    href: "/dashboard/automations/operations",
  },
];
export function AutomationWorkspaceFrame({
  activeView,
  model,
  flags,
  query,
  children,
}: {
  activeView: AutomationWorkspaceView;
  model: AutomationWorkspaceProjection;
  flags: AutomationExperienceFlags;
  query: AutomationWorkspaceQuery;
  children: React.ReactNode;
}) {
  const active = NAV.find(({ view }) => view === activeView)!.href;
  return (
    <>
      <WorkspacePage className="pb-5">
        <WorkspaceHeader
          eyebrow="Governed operations"
          title="Automation"
          description="Configure and monitor accountable automation without bypassing the capability that owns each decision or command."
          context={
            <div className="text-right text-xs text-stone-600">
              <p>{model.scope.label}</p>
              <p>
                <Freshness value={model.freshness} /> ·{" "}
                <time dateTime={model.generatedAt}>
                  {formatTime(model.generatedAt)}
                </time>
              </p>
            </div>
          }
          actions={
            flags.authoring ? (
              <Link
                href="/dashboard/automations/definitions/new"
                className="rounded-full bg-stone-950 px-5 py-2 text-sm font-semibold text-white"
              >
                Create automation
              </Link>
            ) : undefined
          }
        />
        <form
          method="get"
          aria-label="Automation scope and search"
          className="mt-5 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="text-sm font-semibold">
            Search
            <input
              name="search"
              defaultValue={query.search ?? ""}
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
              placeholder="Name or stable ID"
            />
          </label>
          <label className="text-sm font-semibold">
            Status
            <select
              name="status"
              defaultValue={query.status ?? ""}
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
            >
              <option value="">All statuses</option>
              {["draft", "ready-for-review", "active", "paused", "retired"].map(
                (value) => (
                  <option key={value} value={value}>
                    {humanize(value)}
                  </option>
                ),
              )}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 self-end rounded-xl border px-5 font-semibold"
          >
            Apply
          </button>
        </form>
      </WorkspacePage>
      <WorkspaceNavigation
        label="Automation workspace"
        items={NAV.filter(
          ({ view }) => view !== "templates" || flags.templates,
        ).map(({ label, href }) => ({
          label:
            label === "Approvals" && model.counts.approvals
              ? `${label} (${model.counts.approvals})`
              : label,
          href,
        }))}
        activeHref={active}
      />
      <WorkspacePage>
        {model.notices.map((notice) => (
          <div
            role="status"
            key={notice.message}
            className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {notice.message}
          </div>
        ))}
        {flags.readOnly ? (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"
          >
            Read-only cohort: commands are shown for transparency but
            interaction remains disabled.
          </div>
        ) : null}
        {children}
      </WorkspacePage>
    </>
  );
}
export function AutomationOverviewView({
  model,
}: {
  model: AutomationWorkspaceProjection;
}) {
  const cards = [
    ["Active", model.counts.active],
    ["Paused", model.counts.paused],
    ["Draft", model.counts.draft],
    ["Needs attention", model.counts.attention],
    ["Pending approvals", model.counts.approvals],
    ["Running", model.counts.running],
  ] as const;
  return (
    <div className="space-y-10">
      <section>
        <WorkspaceSectionHeading
          title="Automation health"
          description="Counts use the same authorized projection as their destination lists."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([label, value]) => (
            <WorkspaceCard className="p-5" key={label}>
              <p className="text-sm font-semibold text-stone-600">{label}</p>
              <p className="mt-4 text-3xl font-semibold">{value}</p>
            </WorkspaceCard>
          ))}
        </div>
      </section>
      <section>
        <WorkspaceSectionHeading
          title="Requires attention"
          description="Server-projected review, failure, and uncertainty states are shown before routine activity."
        />
        {model.approvals
          .filter(({ status }) => status === "pending")
          .slice(0, 3)
          .map((item) => (
            <ApprovalCard item={item} key={item.id} />
          ))}
        {model.runs
          .filter(({ attention }) => attention !== "none")
          .slice(0, 4)
          .map((item) => (
            <RunCard item={item} key={item.id} />
          ))}
        {!model.counts.attention && !model.counts.approvals ? (
          <WorkspaceEmptyState
            title="No attention required"
            description="The current authorized projection contains no action-required automation state."
          />
        ) : null}
      </section>
      <section>
        <WorkspaceSectionHeading title="Recent automations" />
        <AutomationCards items={model.automations.slice(0, 5)} />
      </section>
    </div>
  );
}
export function AutomationsView({
  model,
}: {
  model: AutomationWorkspaceProjection;
}) {
  return (
    <section>
      <WorkspaceSectionHeading
        title="Automations"
        description={`${model.automations.length} automation definitions in the current filtered page.`}
      />
      {model.automations.length ? (
        <AutomationCards items={model.automations} />
      ) : (
        <WorkspaceEmptyState
          title="No matching automations"
          description="No authorized definition matches the selected scope and filters."
        />
      )}
    </section>
  );
}
export function ApprovalsView({
  model,
}: {
  model: AutomationWorkspaceProjection;
}) {
  return (
    <section>
      <WorkspaceSectionHeading
        title="Approvals"
        description="Automation authority is distinct from approval of the underlying business decision."
      />
      {model.approvals.length ? (
        <div className="space-y-4">
          {model.approvals.map((item) => (
            <ApprovalCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <WorkspaceEmptyState
          title="No approvals assigned"
          description="There are no visible automation approval requests in this scope."
        />
      )}
    </section>
  );
}
export function RunsView({ model }: { model: AutomationWorkspaceProjection }) {
  return (
    <section>
      <WorkspaceSectionHeading
        title="Runs"
        description="Command completion and measured business outcome remain distinct."
      />
      {model.runs.length ? (
        <div className="space-y-4">
          {model.runs.map((item) => (
            <RunCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <WorkspaceEmptyState
          title="No runs in this scope"
          description="No authorized governed runs are available for the selected context."
        />
      )}
    </section>
  );
}
export function TemplatesView({
  model,
  flags,
}: {
  model: AutomationWorkspaceProjection;
  flags: AutomationExperienceFlags;
}) {
  return (
    <section>
      <WorkspaceSectionHeading
        title="Templates"
        description="Templates create version-bound customer drafts; they never execute directly."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {model.templates.map((item) => (
          <TemplateCard
            key={item.id}
            item={item}
            interactive={flags.authoring && !flags.readOnly}
          />
        ))}
      </div>
    </section>
  );
}
export function AutomationDetailView({
  item,
  flags,
}: {
  item: AutomationListItem;
  flags: AutomationExperienceFlags;
}) {
  return (
    <DetailShell
      eyebrow="Automation definition"
      title={item.name}
      back="/dashboard/automations/definitions"
    >
      <div className="flex flex-wrap gap-2">
        <StatusChip>{humanize(item.status)}</StatusChip>
        <StatusChip>Version {item.currentVersion}</StatusChip>
        <StatusChip>{item.scopeLabel}</StatusChip>
      </div>
      <p className="mt-5 max-w-3xl text-stone-600">{item.description}</p>
      <dl className="mt-8 grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2">
        <Fact label="Trigger" value={item.trigger} />
        <Fact label="Owner" value={safeId(item.ownerId)} />
        <Fact label="Stable ID" value={safeId(item.id)} />
        <Fact label="Attention" value={humanize(item.attention)} />
      </dl>
      <CommandBar commands={item.validCommands} interactive={!flags.readOnly} />
      <section className="mt-10">
        <WorkspaceSectionHeading
          title="Version and lineage"
          description="The active version is immutable. Editing creates a derived version through the canonical application service."
        />
        <Link
          className="inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold"
          href={`${item.href}/versions/${item.currentVersion}`}
        >
          Review version {item.currentVersion}
        </Link>
      </section>
    </DetailShell>
  );
}
export function ApprovalDetailView({
  item,
  flags,
}: {
  item: AutomationApprovalItem;
  flags: AutomationExperienceFlags;
}) {
  return (
    <DetailShell
      eyebrow="Automation approval"
      title="Review governed authority"
      back="/dashboard/automations/approvals"
    >
      <div className="flex gap-2">
        <StatusChip tone={item.status === "pending" ? "attention" : "neutral"}>
          {humanize(item.status)}
        </StatusChip>
      </div>
      <p className="mt-5 max-w-3xl text-stone-700">{item.consequence}</p>
      <dl className="mt-8 grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2">
        <Fact label="Automation" value={safeId(item.automationId)} />
        <Fact label="Run" value={safeId(item.runId)} />
        <Fact label="Requested" value={formatTime(item.requestedAt)} />
        <Fact label="Expires" value={formatTime(item.expiresAt)} />
      </dl>
      <CommandBar
        commands={item.validCommands}
        interactive={flags.approvals && !flags.readOnly}
      />
    </DetailShell>
  );
}
export function RunDetailView({
  item,
  flags,
}: {
  item: AutomationRunItem;
  flags: AutomationExperienceFlags;
}) {
  return (
    <DetailShell
      eyebrow="Governed run"
      title={`Run ${safeId(item.id)}`}
      back="/dashboard/automations/runs"
    >
      <div className="flex flex-wrap gap-2">
        <StatusChip
          tone={
            item.attention === "failed" || item.attention === "uncertain"
              ? "attention"
              : "neutral"
          }
        >
          {humanize(item.status)}
        </StatusChip>
        <StatusChip>
          {item.progress.complete} of {item.progress.total} steps complete
        </StatusChip>
      </div>
      <p className="mt-5 text-stone-700">{item.outcome}</p>
      {item.attention === "uncertain" ? (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <h2 className="font-semibold">Outcome uncertain</h2>
          <p className="mt-2 text-sm">
            Blind retry is disabled. Reconciliation queries the owning
            capability using the original deterministic command identity.
          </p>
        </div>
      ) : null}
      <dl className="mt-8 grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2">
        <Fact label="Automation" value={safeId(item.automationId)} />
        <Fact
          label="Definition version"
          value={String(item.definitionVersion)}
        />
        <Fact label="Updated" value={formatTime(item.updatedAt)} />
        <Fact
          label="Scope"
          value={`${item.propertyIds.length} propert${item.propertyIds.length === 1 ? "y" : "ies"}`}
        />
      </dl>
      <CommandBar
        commands={item.validCommands}
        interactive={flags.runControls && !flags.readOnly}
      />
    </DetailShell>
  );
}
export function AutomationFailure({
  code,
  message,
  correlationId,
}: {
  code: string;
  message: string;
  correlationId: string;
}) {
  return (
    <WorkspacePage width="medium">
      <WorkspaceCard role="alert" className="border-amber-200 bg-amber-50 p-8">
        <ShieldAlert className="h-7 w-7 text-amber-800" />
        <h1 className="mt-4 text-2xl font-semibold">
          Automation could not load
        </h1>
        <p className="mt-2 text-stone-700">{message}</p>
        <p className="mt-4 text-xs text-stone-600">
          Reference {correlationId} · {code}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-full bg-stone-950 px-5 py-2 text-sm font-semibold text-white"
        >
          Return to dashboard
        </Link>
      </WorkspaceCard>
    </WorkspacePage>
  );
}
function AutomationCards({ items }: { items: readonly AutomationListItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <WorkspaceCard className="p-5" key={item.id}>
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusChip>{humanize(item.status)}</StatusChip>
                {item.attention !== "none" ? (
                  <StatusChip tone="attention">
                    {humanize(item.attention)}
                  </StatusChip>
                ) : null}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{item.name}</h3>
              <p className="mt-1 text-sm text-stone-600">
                {item.scopeLabel} · {item.trigger} · version{" "}
                {item.currentVersion}
              </p>
            </div>
            <Link
              href={item.href}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-full border px-4 text-sm font-semibold"
            >
              Open <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </WorkspaceCard>
      ))}
    </div>
  );
}
function ApprovalCard({ item }: { item: AutomationApprovalItem }) {
  return (
    <WorkspaceCard className="mb-4 p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <StatusChip
            tone={item.status === "pending" ? "attention" : "neutral"}
          >
            {humanize(item.status)}
          </StatusChip>
          <h3 className="mt-3 font-semibold">Automation authority requested</h3>
          <p className="mt-1 text-sm text-stone-600">
            Run {safeId(item.runId)} · expires {formatTime(item.expiresAt)}
          </p>
        </div>
        <Link
          href={item.href}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border px-4 text-sm font-semibold"
        >
          Review <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </WorkspaceCard>
  );
}
function RunCard({ item }: { item: AutomationRunItem }) {
  return (
    <WorkspaceCard className="mb-4 p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <div className="flex gap-2">
            <StatusChip
              tone={
                item.attention === "failed" || item.attention === "uncertain"
                  ? "attention"
                  : "neutral"
              }
            >
              {humanize(item.status)}
            </StatusChip>
            {item.attention !== "none" ? (
              <StatusChip tone="attention">
                {humanize(item.attention)}
              </StatusChip>
            ) : null}
          </div>
          <h3 className="mt-3 font-semibold">{item.outcome}</h3>
          <p className="mt-1 text-sm text-stone-600">
            {item.progress.complete} of {item.progress.total} steps · updated{" "}
            {formatTime(item.updatedAt)}
          </p>
        </div>
        <Link
          href={item.href}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border px-4 text-sm font-semibold"
        >
          Investigate <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </WorkspaceCard>
  );
}
function TemplateCard({
  item,
  interactive,
}: {
  item: AutomationTemplate;
  interactive: boolean;
}) {
  return (
    <WorkspaceCard className="p-5">
      <StatusChip tone={item.available ? "healthy" : "unavailable"}>
        {item.available ? "Available" : "Unavailable"}
      </StatusChip>
      <h3 className="mt-4 text-lg font-semibold">{item.name}</h3>
      <p className="mt-2 text-sm text-stone-600">{item.purpose}</p>
      <p className="mt-4 text-sm">
        <strong>Trigger:</strong> {item.trigger}
      </p>
      <p className="mt-1 text-sm">
        <strong>Approval:</strong> {item.approval}
      </p>
      {interactive && item.available ? (
        <Link
          href={`/dashboard/automations/definitions/new?template=${encodeURIComponent(item.id)}&version=${item.version}`}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-stone-950 px-5 text-sm font-semibold text-white"
        >
          Create draft <ExternalLink className="h-4 w-4" />
        </Link>
      ) : null}
    </WorkspaceCard>
  );
}
function CommandBar({
  commands,
  interactive,
}: {
  commands: readonly AutomationExperienceCommand[];
  interactive: boolean;
}) {
  return (
    <section className="mt-8" aria-labelledby="commands-heading">
      <h2 id="commands-heading" className="text-lg font-semibold">
        Valid next actions
      </h2>
      {commands.length ? (
        <div className="mt-4 grid gap-3">
          {commands.map((item) => (
            <details
              className="rounded-2xl border bg-white p-4"
              key={item.type}
            >
              <summary className="cursor-pointer font-semibold">
                {item.label}
              </summary>
              <p className="mt-3 text-sm text-stone-600">{item.consequence}</p>
              <p className="mt-1 text-xs text-stone-500">
                Target {safeId(item.targetId)} · expected version{" "}
                {item.expectedVersion} ·{" "}
                {item.createsApproval
                  ? "creates an approval request"
                  : "uses the canonical command boundary"}
              </p>
              <form
                action={executeAutomationWorkspaceCommand}
                className="mt-4 space-y-3"
              >
                <input type="hidden" name="command" value={item.type} />
                <input type="hidden" name="targetId" value={item.targetId} />
                <input
                  type="hidden"
                  name="expectedVersion"
                  value={item.expectedVersion}
                />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={`au001d:${item.type}:${item.targetId}:v${item.expectedVersion}`}
                />
                {item.reason.required ? (
                  <label className="block text-sm font-semibold">
                    Reason
                    <textarea
                      name="reason"
                      required
                      minLength={item.reason.minimumLength}
                      maxLength={item.reason.maximumLength}
                      className="mt-1 min-h-24 w-full rounded-xl border p-3"
                    />
                  </label>
                ) : null}
                <button
                  type="submit"
                  disabled={!interactive}
                  className="min-h-11 rounded-full bg-stone-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  Confirm {item.label.toLocaleLowerCase()}
                </button>
                {!interactive ? (
                  <p className="text-xs text-stone-500">
                    Interaction is disabled for this cohort.
                  </p>
                ) : null}
              </form>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-600">
          No command is valid for this actor and current resource version.
        </p>
      )}
    </section>
  );
}
function DetailShell({
  eyebrow,
  title,
  back,
  children,
}: {
  eyebrow: string;
  title: string;
  back: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      <Link className="text-sm font-semibold text-teal-800" href={back}>
        ← Back
      </Link>
      <header className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      </header>
      {children}
    </article>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}
function Freshness({
  value,
}: {
  value: AutomationWorkspaceProjection["freshness"];
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {value === "current" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Clock3 className="h-3.5 w-3.5" />
      )}
      {humanize(value)}
    </span>
  );
}
function humanize(value: string) {
  return value
    .replaceAll(/[-_:]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function safeId(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}
function formatTime(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Chicago",
      }).format(parsed)
    : "Unavailable";
}
