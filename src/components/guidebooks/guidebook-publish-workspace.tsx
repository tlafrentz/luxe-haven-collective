import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  QrCode,
  Smartphone,
  Monitor,
} from "lucide-react";
import {
  evaluateGuidebookPublicationReadiness,
  type ApprovalRequestInput,
  type compareGuidebookVersions,
  type GuidebookDraft,
  type MediaDimensionMap,
} from "@/features/guidebook-studio";
import { GuidebookPublicationControl } from "./guidebook-publication-control";

const approvalCopy: Record<ApprovalRequestInput["status"], string> = {
  pending: "Waiting on the customer to review and approve this draft.",
  approved: "The customer approved this draft.",
  changes_requested: "The customer requested changes on this draft.",
  superseded: "A newer approval request has replaced this one.",
};

export function GuidebookPublishWorkspace({
  draft,
  propertyName,
  templateName = "Mesa Modern",
  publicSlug,
  status,
  canPublish,
  basePath,
  currentPublishedVersion = null,
  changesSincePublished = null,
  approvalRequest = null,
  authoringMode = "self",
  mediaDimensions = {},
}: Readonly<{
  draft: GuidebookDraft;
  propertyName: string;
  templateName?: string;
  publicSlug: string;
  status: string;
  canPublish: boolean;
  basePath: string;
  currentPublishedVersion?: number | null;
  changesSincePublished?: ReturnType<typeof compareGuidebookVersions> | null;
  approvalRequest?: ApprovalRequestInput | null;
  authoringMode?: string;
  mediaDimensions?: MediaDimensionMap;
}>) {
  const readiness = evaluateGuidebookPublicationReadiness(
      draft,
      mediaDimensions,
    ),
    errors = readiness.issues.filter((item) => item.severity === "error"),
    warnings = readiness.issues.filter((item) => item.severity === "warning"),
    complete = draft.sections.filter(
      (section) =>
        section.visible && section.blocks.some((block) => block.visible),
    ).length;
  const usedKeys = new Set(
    draft.sections
      .flatMap((section) => section.blocks)
      .filter((block) => block.type === "component")
      .map((block) => block.content.componentKey),
  );
  const photoCount = draft.sections
    .flatMap((section) => section.blocks)
    .reduce(
      (sum, block) =>
        sum +
        (block.type === "component"
          ? block.content.mediaRefs.length
          : block.type === "image" && block.content.mediaRef
            ? 1
            : 0),
      0,
    );
  const checklist = [
    { label: "All essential sections complete", done: readiness.status !== "not-ready" },
    { label: "At least 6 photos added", done: photoCount >= 6 },
    { label: "Property details added", done: usedKeys.has("arrival_instructions") },
    { label: "Emergency contact added", done: usedKeys.has("emergency_contact_card") },
  ];
  return (
    <main className="mx-auto max-w-7xl space-y-7 px-5 py-8">
      <header>
        <Link
          href={`${basePath}/${draft.guidebookId}/edit`}
          className="text-sm font-semibold text-blue-700"
        >
          ← Return to Builder
        </Link>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-violet-700">
          Guidebook Studio · Publish
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Publish {draft.title}</h1>
        <p className="mt-2 text-stone-600">
          Review, validate, preview, and deliver one immutable version to
          guests.
        </p>
      </header>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Recommended before publishing</h2>
        <p className="mt-2 text-sm text-stone-600">
          These content recommendations are separate from the blocking validation checks below.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              ) : (
                <CircleAlert className="size-5 shrink-0 text-amber-600" />
              )}
              <span>{item.label}</span>
              {item.label === "At least 6 photos added" && !item.done ? (
                <Link
                  href={`${basePath}/${draft.guidebookId}/edit#add-photos`}
                  className="ml-auto rounded-lg border px-3 py-2 text-xs font-semibold text-emerald-800"
                >
                  Add photos
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <article className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">Publish Review</h2>
          <dl className="mt-5 grid grid-cols-[9rem_1fr] gap-3 text-sm">
            <dt>Property</dt>
            <dd className="font-semibold">{propertyName}</dd>
            <dt>Template</dt>
            <dd>{templateName}</dd>
            <dt>Draft version</dt>
            <dd>Revision {draft.revision}</dd>
            <dt>Current published version</dt>
            <dd>
              {currentPublishedVersion
                ? `Version ${currentPublishedVersion}`
                : "Not published yet"}
            </dd>
            <dt>Status</dt>
            <dd className="capitalize">{status}</dd>
            <dt>Guest URL</dt>
            <dd>
              {status === "published" ? (
                <a
                  href={`/stay/${publicSlug}`}
                  className="text-blue-700 underline"
                >
                  /stay/{publicSlug}
                </a>
              ) : (
                <span className="text-stone-400">Available after publishing</span>
              )}
            </dd>
            <dt>Sections</dt>
            <dd>
              {complete} complete · {draft.sections.length - complete} in
              progress
            </dd>
          </dl>
          {authoringMode === "managed" ? (
            <div
              className={`mt-5 rounded-lg border p-3 text-sm ${
                approvalRequest?.status === "approved"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : approvalRequest?.status === "changes_requested"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <strong>Customer approval: </strong>
              {approvalRequest
                ? approvalCopy[approvalRequest.status]
                : "No approval has been requested yet."}
            </div>
          ) : null}
          {changesSincePublished ? (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Changes since published version
                {currentPublishedVersion ? ` ${currentPublishedVersion}` : ""}
              </p>
              {changesSincePublished.changes.length ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {changesSincePublished.changes.slice(0, 12).map((change) => (
                    <li key={`${change.category}:${change.key}`}>
                      <span
                        className={
                          change.state === "added"
                            ? "text-emerald-700"
                            : change.state === "removed"
                              ? "text-rose-700"
                              : "text-amber-700"
                        }
                      >
                        {change.state}
                      </span>{" "}
                      <span className="capitalize text-stone-500">
                        {change.category}
                      </span>{" "}
                      · {change.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-stone-500">
                  No changes since the last published version.
                </p>
              )}
            </div>
          ) : null}
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {draft.sections.map((section) => (
              <li
                key={section.id}
                className="flex items-center gap-2 rounded-lg bg-stone-50 p-2 text-sm"
              >
                {section.blocks.some((block) => block.visible) ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <CircleAlert className="size-4 text-amber-600" />
                )}
                {section.name}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">Validation</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Metric
              label="Passed"
              value={Math.max(
                0,
                draft.sections.length - errors.length - warnings.length,
              )}
              tone="green"
            />
            <Metric label="Warnings" value={warnings.length} tone="amber" />
            <Metric label="Errors" value={errors.length} tone="red" />
          </div>
          <div className="mt-5 space-y-2">
            {readiness.issues.map((issue) => (
              <Link
                key={`${issue.code}:${issue.target}`}
                href={`${basePath}/${draft.guidebookId}/edit#${issue.target}`}
                className={`block rounded-lg border p-3 text-sm ${issue.severity === "error" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
              >
                <strong>
                  {issue.severity === "error" ? "Blocking error" : "Warning"}
                </strong>
                <p>{issue.message}</p>
              </Link>
            ))}
            {!readiness.issues.length ? (
              <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
                All publication checks passed.
              </p>
            ) : null}
          </div>
        </article>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Preview and share</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Channel
            icon={<Monitor />}
            title="Desktop"
            href={`/guidebooks/${draft.guidebookId}/preview?viewport=desktop`}
          />
          <Channel
            icon={<Smartphone />}
            title="Mobile"
            href={`/guidebooks/${draft.guidebookId}/preview?viewport=mobile`}
          />
          <Channel
            icon={<QrCode />}
            title="QR code"
            href={`/guidebooks/${draft.guidebookId}/qr`}
          />
        </div>
      </section>
      <GuidebookPublicationControl
        draft={draft}
        canPublish={canPublish}
        publicSlug={publicSlug}
        basePath={basePath}
        mediaDimensions={mediaDimensions}
      />
      {status === "published" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-xl font-semibold text-emerald-900">
            Published guest experience
          </h2>
          <p className="mt-2 text-sm">
            Guests only receive the immutable active snapshot. Later draft edits
            do not change this version.
          </p>
          <Link
            href={`/stay/${publicSlug}`}
            className="mt-4 inline-block rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
          >
            Open /stay/{publicSlug}
          </Link>
        </section>
      ) : null}
    </main>
  );
}
function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "red";
}) {
  const color = {
    green: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-800",
  }[tone];
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <strong className="text-2xl">{value}</strong>
      <p className="text-xs">{label}</p>
    </div>
  );
}
function Channel({
  icon,
  title,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm"
    >
      <span className="text-violet-700 [&_svg]:size-6">{icon}</span>
      <strong className="mt-4 block">{title}</strong>
      <span className="mt-1 block text-xs text-stone-500">
        Open this guidebook view.
      </span>
    </Link>
  );
}
