"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { restoreGuidebookVersionAction } from "@/app/actions/guidebook-authoring";
import {
  compareGuidebookVersions,
  type GuidebookVersionRecord,
} from "@/features/guidebook-studio";
import type { ActivityLineageEvent } from "@/platform/activity-lineage";

type Props = {
  guidebookId: string;
  workspaceId: string;
  revision: number;
  versions: readonly GuidebookVersionRecord[];
  timeline: readonly ActivityLineageEvent[];
  deliveries: readonly Record<string, unknown>[];
  canRestore: boolean;
};

export function GuidebookVersionHistory({
  guidebookId,
  workspaceId,
  revision,
  versions,
  timeline,
  deliveries,
  canRestore,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [beforeId, setBeforeId] = useState(versions[1]?.id ?? versions[0]?.id ?? "");
  const [afterId, setAfterId] = useState(versions[0]?.id ?? "");
  const comparison = useMemo(() => {
    const before = versions.find((version) => version.id === beforeId);
    const after = versions.find((version) => version.id === afterId);
    return before && after && before.id !== after.id
      ? compareGuidebookVersions(before, after)
      : null;
  }, [afterId, beforeId, versions]);
  const filteredTimeline = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return timeline.filter(
      (event) =>
        (filter === "all" || category(event.eventType) === filter) &&
        (!normalized ||
          [event.eventType, event.summary, event.actorId, JSON.stringify(event.metadata)]
            .join(" ")
            .toLowerCase()
            .includes(normalized)),
    );
  }, [filter, query, timeline]);

  return (
    <section className="space-y-6 rounded-3xl border bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700">
            Operational record
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Version history & timeline</h2>
          <p className="mt-1 text-sm text-stone-600">
            {versions.length
              ? `Current publication: v${versions[0]?.version} · ${versions.length} immutable version${versions.length === 1 ? "" : "s"}`
              : "No version has been published yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="Search guidebook history"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search history"
            className="rounded-full border px-4 py-2 text-sm"
          />
          <select
            aria-label="Filter guidebook timeline"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-full border bg-white px-4 py-2 text-sm"
          >
            <option value="all">All activity</option>
            <option value="publishing">Publishing</option>
            <option value="draft">Drafts</option>
            <option value="property">Property changes</option>
            <option value="validation">Validation</option>
            <option value="rollback">Restore & rollback</option>
            <option value="system">System events</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-3">
          <h3 className="font-semibold">Published versions</h3>
          {versions.map((version, index) => (
            <article key={version.id} className="rounded-2xl border bg-stone-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    Version {version.version} {index === 0 ? "· Current" : ""}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {new Date(version.publishedAt).toLocaleString()} ·{" "}
                    {version.status}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
                  {version.rendererVersion}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-stone-500">Property projection</dt><dd>{version.propertyVersion ?? "Legacy"}</dd></div>
                <div><dt className="text-stone-500">Projection contract</dt><dd>{version.projectionVersion ?? "Legacy"}</dd></div>
                <div><dt className="text-stone-500">Artifact</dt><dd>{version.artifactVersion}</dd></div>
                <div><dt className="text-stone-500">Published by</dt><dd>{version.publishedBy ?? "System"}</dd></div>
              </dl>
              {version.publicationNotes ? (
                <p className="mt-3 rounded-xl bg-white p-3 text-sm">
                  {version.publicationNotes}
                </p>
              ) : null}
              <Link href={`/dashboard/guidebooks/${guidebookId}/versions/${version.id}/preview`} className="mt-3 inline-flex rounded-full border bg-white px-3 py-2 text-xs font-semibold">Preview immutable version</Link>
              {canRestore ? (
                <form action={async (formData) => { await restoreGuidebookVersionAction(formData); }} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="guidebookId" value={guidebookId} />
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <input type="hidden" name="revision" value={revision} />
                  <input
                    name="reason"
                    aria-label={`Reason for restoring version ${version.version}`}
                    placeholder="Restore reason (optional)"
                    className="min-w-0 flex-1 rounded-full border bg-white px-3 py-2 text-xs"
                  />
                  <button className="rounded-full border bg-white px-3 py-2 text-xs font-semibold">
                    Restore into draft
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Compare versions</h3>
          <div className="grid grid-cols-2 gap-2">
            <VersionSelect label="From" versions={versions} value={beforeId} onChange={setBeforeId} />
            <VersionSelect label="To" versions={versions} value={afterId} onChange={setAfterId} />
          </div>
          {comparison ? (
            <div className="rounded-2xl border p-4">
              <p className="text-sm font-semibold">
                {comparison.summary.added} added · {comparison.summary.updated} updated ·{" "}
                {comparison.summary.removed} removed
              </p>
              {comparison.changes.length ? (
                <ol className="mt-3 max-h-[28rem] space-y-2 overflow-auto">
                  {comparison.changes.map((change) => (
                    <li key={`${change.category}:${change.key}`} className="rounded-xl bg-stone-50 p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold capitalize">{change.label}</span>
                        <span className="text-xs capitalize">{change.state}</span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">{change.category.replace("-", " ")}</p>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-3 text-sm text-stone-500">No published differences.</p>}
            </div>
          ) : (
            <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">
              Select two different published versions.
            </p>
          )}

          <div className="rounded-2xl border p-4">
            <h3 className="font-semibold">Guest traceability</h3>
            <p className="mt-1 text-sm text-stone-600">
              {deliveries.length} recorded version delivery{deliveries.length === 1 ? "" : "ies"}.
            </p>
            {deliveries.slice(0, 5).map((delivery) => (
              <p key={String(delivery.id)} className="mt-2 text-xs text-stone-500">
                Version {versions.find((version) => version.id === String(delivery.guidebook_version_id))?.version ?? "unknown"} ·{" "}
                {String(delivery.delivery_channel).replaceAll("-", " ")} ·{" "}
                {new Date(String(delivery.delivered_at)).toLocaleString()} ·{" "}
                {Number(delivery.view_count)} view(s)
              </p>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Publishing timeline</h3>
        {filteredTimeline.length ? (
          <ol className="mt-4 max-h-[36rem] space-y-3 overflow-auto">
            {filteredTimeline.map((event) => (
              <li key={event.id} className="border-l-2 border-amber-400 pl-4">
                <p className="text-sm font-semibold capitalize">
                  {event.eventType.replaceAll("-", " ")}
                </p>
                <p className="text-sm text-stone-600">{event.summary}</p>
                <time className="text-xs text-stone-400">
                  {new Date(event.occurredAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            No activity matches the current search and filter.
          </p>
        )}
      </div>
    </section>
  );
}

function VersionSelect({
  label,
  versions,
  value,
  onChange,
}: {
  label: string;
  versions: readonly GuidebookVersionRecord[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-semibold text-stone-600">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2 text-sm">
        {versions.map((version) => <option key={version.id} value={version.id}>Version {version.version}</option>)}
      </select>
    </label>
  );
}

function category(eventType: string) {
  if (eventType.includes("validat")) return "validation";
  if (eventType.includes("property") || eventType.includes("projection")) return "property";
  if (eventType.includes("restore") || eventType.includes("rollback")) return "rollback";
  if (eventType.includes("publish") || eventType.includes("activation")) return "publishing";
  if (eventType.includes("draft") || eventType.includes("section") || eventType.includes("image")) return "draft";
  return "system";
}
