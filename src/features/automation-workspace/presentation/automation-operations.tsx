import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ShieldAlert,
} from "lucide-react";
import {
  StatusChip,
  WorkspaceCard,
  WorkspaceEmptyState,
  WorkspaceSectionHeading,
} from "@/components/application-layout";
import {
  AUTOMATION_STANDARD_REPORTS,
  type AutomationHealthStatus,
  type AutomationOperationsProjection,
} from "@/platform/automations";

export function AutomationOperationsView({
  model,
  reportsEnabled,
  exportsEnabled,
}: {
  model: AutomationOperationsProjection;
  reportsEnabled: boolean;
  exportsEnabled: boolean;
}) {
  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-semibold text-teal-800">
          Authorized operations
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Operational health</h2>
        <div className="mt-4">
          <HealthChip status={model.overallHealth} />
        </div>
        <p className="mt-3 max-w-3xl text-sm text-stone-600">
          Health, backlog, service levels, integration compatibility, and
          reconciliation are derived from authorized canonical facts. Unknown
          and restricted data are never presented as healthy or zero.
        </p>
      </header>
      {model.restrictions.map((item) => (
        <div
          role="status"
          key={item.code}
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"
        >
          <AlertTriangle aria-hidden className="mr-2 inline h-4 w-4" />
          <strong>{human(item.code)}</strong> — {item.message}
        </div>
      ))}
      <section>
        <WorkspaceSectionHeading
          title="System components"
          description={`Policy ${model.components[0]?.policyVersion ?? "Unavailable"}`}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {model.components.map((item) => (
            <WorkspaceCard className="p-5" key={item.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="mt-1 text-xs text-stone-500">
                    {item.critical
                      ? "Critical component"
                      : "Isolated component"}
                  </p>
                </div>
                <HealthChip status={item.status} />
              </div>
              {item.reasons.length ? (
                <ul className="mt-4 space-y-2 text-sm text-stone-600">
                  {item.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-stone-600">
                  No current degradation reason.
                </p>
              )}
              <Link
                href={item.investigationHref}
                className="mt-4 inline-flex text-sm font-semibold text-teal-800"
              >
                Investigate <span aria-hidden>→</span>
              </Link>
            </WorkspaceCard>
          ))}
        </div>
      </section>
      <section>
        <WorkspaceSectionHeading title="Queues and service levels" />
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="p-4">Queue</th>
                <th className="p-4">Count</th>
                <th className="p-4">Oldest</th>
                <th className="p-4">Capacity</th>
                <th className="p-4">Health</th>
              </tr>
            </thead>
            <tbody>
              {model.queues.map((queue) => (
                <tr className="border-t" key={queue.id}>
                  <td className="p-4 font-semibold">{queue.label}</td>
                  <td className="p-4">{queue.count}</td>
                  <td className="p-4">{duration(queue.oldestAgeMs)}</td>
                  <td className="p-4">{human(queue.capacity)}</td>
                  <td className="p-4">
                    <HealthChip status={queue.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {model.serviceLevels.map((item) => (
            <WorkspaceCard className="p-5" key={item.id}>
              <div className="flex justify-between gap-4">
                <h3 className="font-semibold">{item.label}</h3>
                <StatusChip
                  tone={item.status === "met" ? "healthy" : "attention"}
                >
                  {human(item.status)}
                </StatusChip>
              </div>
              <p className="mt-3 text-sm text-stone-600">{item.explanation}</p>
              <p className="mt-2 text-xs text-stone-500">
                Population {item.population} · policy {item.policyVersion}
              </p>
            </WorkspaceCard>
          ))}
        </div>
      </section>
      <section>
        <WorkspaceSectionHeading title="Integration compatibility" />
        <div className="grid gap-4 md:grid-cols-2">
          {model.integrations.map((item) => (
            <WorkspaceCard className="p-5" key={item.id}>
              <div className="flex justify-between gap-4">
                <h3 className="font-semibold">{item.owningCapability}</h3>
                <HealthChip status={item.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-stone-500">Contract</dt>
                  <dd>{item.observedVersion ?? "Unavailable"}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Compatibility</dt>
                  <dd>{human(item.compatibility)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-stone-500">
                Safe degradation: {item.degradation}
              </p>
            </WorkspaceCard>
          ))}
        </div>
      </section>
      <section>
        <WorkspaceSectionHeading
          title="Reconciliation and recovery"
          description="Candidate detection is deterministic and does not mutate source state."
        />
        {model.reconciliation.candidates.length ? (
          <div className="space-y-3">
            {model.reconciliation.candidates.map((item) => (
              <WorkspaceCard className="p-5" key={item.id}>
                <div className="flex justify-between gap-4">
                  <h3 className="font-semibold">{human(item.type)}</h3>
                  <StatusChip
                    tone={item.requiresHumanReview ? "attention" : "neutral"}
                  >
                    {item.requiresHumanReview
                      ? "Human review"
                      : "Projection recovery"}
                  </StatusChip>
                </div>
                <p className="mt-3 text-sm text-stone-600">{item.reason}</p>
                <p className="mt-2 text-xs text-stone-500">
                  Safe recovery: {human(item.safeRecovery)} · Blind command
                  replay is prohibited.
                </p>
              </WorkspaceCard>
            ))}
          </div>
        ) : (
          <WorkspaceEmptyState
            title="No reconciliation candidates"
            description="The authorized scope has no detected stuck, uncertain, or inconsistent work."
          />
        )}
      </section>
      <section>
        <WorkspaceSectionHeading
          title="Governed reports"
          description="Eight versioned definitions disclose freshness, completeness, and inference limits."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {AUTOMATION_STANDARD_REPORTS.map((report) => (
            <WorkspaceCard className="p-5" key={report.key}>
              <h3 className="font-semibold">{report.name}</h3>
              <p className="mt-2 text-sm text-stone-600">{report.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {reportsEnabled ? (
                  <Link
                    href={`/dashboard/automations/operations/reports/${report.key}`}
                    className="rounded-full border px-4 py-2 text-sm font-semibold"
                  >
                    Open report
                  </Link>
                ) : (
                  <span className="text-xs text-stone-500">
                    Reporting disabled
                  </span>
                )}
                {reportsEnabled && exportsEnabled ? (
                  <Link
                    href={`/api/automations/reports/${report.key}/csv`}
                    className="rounded-full border px-4 py-2 text-sm font-semibold"
                  >
                    Export CSV
                  </Link>
                ) : null}
              </div>
            </WorkspaceCard>
          ))}
        </div>
      </section>
    </div>
  );
}
function HealthChip({ status }: { status: AutomationHealthStatus }) {
  const Icon =
    status === "healthy"
      ? CheckCircle2
      : status === "unknown"
        ? CircleHelp
        : ShieldAlert;
  return (
    <StatusChip
      tone={
        status === "healthy"
          ? "healthy"
          : status === "disabled"
            ? "neutral"
            : "attention"
      }
    >
      <Icon aria-hidden className="mr-1 inline h-3 w-3" />
      {human(status)}
    </StatusChip>
  );
}
function duration(value: number | null) {
  if (value === null) return "No queued work";
  if (value < 60_000) return `${Math.round(value / 1000)} sec`;
  if (value < 3_600_000) return `${Math.round(value / 60_000)} min`;
  return `${Math.round(value / 3_600_000)} hr`;
}
function human(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function AutomationReportView({
  report,
}: {
  report: import("@/platform/automations").AutomationReportResult;
}) {
  return (
    <article className="space-y-8">
      <header>
        <Link
          href="/dashboard/automations/operations"
          className="text-sm font-semibold text-teal-800"
        >
          ← Operations
        </Link>
        <h2 className="mt-5 text-3xl font-semibold">{human(report.key)}</h2>
        <p className="mt-2 text-sm text-stone-600">
          Generated {new Date(report.generatedAt).toLocaleString()} ·{" "}
          {report.scopeLabel} · {report.timeZone}
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {report.metrics.map((metric) => (
          <WorkspaceCard className="p-5" key={metric.key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {metric.value ?? "Unavailable"}
            </p>
            <p className="mt-2 text-xs text-stone-500">{metric.explanation}</p>
          </WorkspaceCard>
        ))}
      </div>
      <section>
        <WorkspaceSectionHeading title="Limitations and disclosure" />
        <ul className="space-y-2 rounded-2xl border bg-stone-50 p-5 text-sm">
          {report.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
