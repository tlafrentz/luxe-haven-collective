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
  type GuidebookDraft,
} from "@/features/guidebook-studio";
import { GuidebookPublicationControl } from "./guidebook-publication-control";

export function GuidebookPublishWorkspace({
  draft,
  propertyName,
  templateName = "Mesa Modern",
  publicSlug,
  status,
  canPublish,
  basePath,
}: Readonly<{
  draft: GuidebookDraft;
  propertyName: string;
  templateName?: string;
  publicSlug: string;
  status: string;
  canPublish: boolean;
  basePath: string;
}>) {
  const readiness = evaluateGuidebookPublicationReadiness(draft),
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
    .filter((block) => block.type === "component")
    .reduce((sum, block) => sum + block.content.mediaRefs.length, 0);
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
        <h2 className="text-xl font-semibold">Ready to publish?</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              ) : (
                <CircleAlert className="size-5 shrink-0 text-amber-600" />
              )}
              {item.label}
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
            <dt>Status</dt>
            <dd className="capitalize">{status}</dd>
            <dt>Sections</dt>
            <dd>
              {complete} complete · {draft.sections.length - complete} in
              progress
            </dd>
          </dl>
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
