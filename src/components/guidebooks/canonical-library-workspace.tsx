import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Armchair,
  Boxes,
  FileText,
  ImageIcon,
  LayoutTemplate,
} from "lucide-react";
import {
  createLibraryArtifactAction,
  createGuidebookFromTemplateAction,
  getGuidebookLibraries,
  getGuidebookLibraryArtifact,
  saveLibraryArtifactAction,
  transitionLibraryArtifactAction,
  uploadLibraryMediaAction,
  importLibraryContentAction,
} from "@/app/actions/guidebook-libraries";
import type { LibraryArtifactType } from "@/features/guidebook-libraries";
import { AdminGuidebookNavigation } from "./admin-guidebook-navigation";

type Row = Record<string, unknown>;
const routeByType: Record<LibraryArtifactType, string> = {
  content: "/admin/guidebooks/content",
  component: "/admin/guidebooks/components",
  template: "/admin/guidebooks/templates",
  media: "/admin/guidebooks/media",
};
const labels: Record<LibraryArtifactType, [string, string]> = {
  content: ["Content Library", "Reusable content for every guest experience."],
  component: [
    "Experience Components",
    "Reusable interface blocks that safely consume content and media.",
  ],
  template: [
    "Template Library",
    "Published, versioned structures for consistent guest experiences.",
  ],
  media: [
    "Media Library",
    "Approved images, videos, documents, icons, and brand assets.",
  ],
};

export async function CanonicalLibraryBrowser({
  type,
  filters = {},
}: {
  type: LibraryArtifactType;
  filters?: { q?: string; category?: string; status?: string; tag?: string };
}) {
  const data = await getGuidebookLibraries({ type, ...filters });
  const [title, description] = labels[type];
  if (!data.ok) return <LibraryUnavailable message={data.error} />;
  const artifacts = data.artifacts as Row[];
  const categories = [
    ...new Set(artifacts.map((row) => String(row.category))),
  ].sort();
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <LibraryHeader title={title} description={description} current={type} />
      <section className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-1 flex-wrap gap-2">
          <input
            name="q"
            defaultValue={filters.q}
            aria-label={`Search ${title}`}
            placeholder="Search…"
            className="min-h-11 min-w-52 flex-1 rounded-xl border px-3"
          />
          <select
            name="category"
            defaultValue={filters.category}
            aria-label="Category"
            className="min-h-11 rounded-xl border px-3"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status}
            aria-label="Status"
            className="min-h-11 rounded-xl border px-3"
          >
            <option value="">All statuses</option>
            {[
              "draft",
              "under_review",
              "published",
              "deprecated",
              "superseded",
              "archived",
              "processing",
              "needs_review",
              "approved",
              "rejected",
            ].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <button className="rounded-xl border bg-white px-4 font-semibold">
            Filters
          </button>
          <Link
            href={routeByType[type]}
            className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-stone-600"
          >
            Reset
          </Link>
        </form>
        <div className="flex gap-2">
          {type === "content" ? (
            <>
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-xl border bg-white px-4 py-2 text-sm font-semibold">
                  Import
                </summary>
                <form
                  action={importLibraryContentAction}
                  className="absolute right-0 z-40 mt-2 w-[min(92vw,32rem)] space-y-3 rounded-2xl border bg-white p-5 shadow-2xl"
                >
                  <label className="block text-sm font-semibold">
                    Content JSON
                    <textarea
                      name="contentJson"
                      required
                      rows={10}
                      className="mt-2 block w-full rounded-xl border p-3 font-mono text-xs"
                      placeholder={
                        '[{"name":"Welcome","canonicalKey":"welcome","category":"welcome","body":"Welcome to {{property_name}}."}]'
                      }
                    />
                  </label>
                  <p className="text-xs text-stone-500">
                    Import up to 100 draft records. Existing canonical keys are
                    updated without rewriting published versions.
                  </p>
                  <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">
                    Import drafts
                  </button>
                </form>
              </details>
              <a
                href="/admin/guidebooks/content/export"
                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
              >
                Export
              </a>
            </>
          ) : null}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white">
              + New{" "}
              {type === "content"
                ? "Content"
                : type === "component"
                  ? "Component"
                  : type === "template"
                    ? "Template"
                    : "Asset"}
            </summary>
            <CreatePanel type={type} collections={data.collections as Row[]} />
          </details>
        </div>
      </section>
      {type === "media" ? (
        <MediaGrid artifacts={artifacts} files={data.mediaFiles as Row[]} />
      ) : type === "content" ? (
        <ContentTable artifacts={artifacts} />
      ) : (
        <ArtifactGrid type={type} artifacts={artifacts} />
      )}
    </main>
  );
}

export async function LibraryOverviewSection() {
  const data = await getGuidebookLibraries();
  if (!data.ok) return null;
  const artifacts = data.artifacts as Row[];
  const count = (type: string, statuses?: string[]) =>
    artifacts.filter(
      (row) =>
        row.artifact_type === type &&
        (!statuses || statuses.includes(String(row.status))),
    ).length;
  const cards = [
    [
      "Content Library",
      count("content"),
      "Reusable guest-facing content",
      "/admin/guidebooks/content",
      count("content", ["draft", "under_review", "deprecated"]),
      "Browse content",
      FileText,
    ],
    [
      "Experience Components",
      count("component"),
      "Reusable guest experience components",
      "/admin/guidebooks/components",
      count("component", ["draft", "under_review", "deprecated"]),
      "Browse components",
      Boxes,
    ],
    [
      "Templates",
      count("template", ["published"]),
      "Published, versioned guidebook templates",
      "/admin/guidebooks/templates",
      count("template", ["draft", "under_review"]),
      "Browse templates",
      LayoutTemplate,
    ],
    [
      "Media Library",
      count("media", ["approved"]),
      "Approved media and brand assets",
      "/admin/guidebooks/media",
      count("media", ["processing", "needs_review", "rejected"]),
      "Open library",
      ImageIcon,
    ],
    [
      "Furnishing Packages",
      data.furnishingPackages,
      "Reusable furnishing systems",
      "/admin/furnishing/packages",
      0,
      "Open Furnishing Studio",
      Armchair,
    ],
  ] as const;
  const publishedContent = count("content", ["published"]);
  const allContent = count("content");
  const currentTemplates = count("template", ["published"]);
  const allTemplates = count("template");
  const unusedComponents = artifacts.filter(
    (row) => row.artifact_type === "component" && Number(row.usage_count) === 0,
  ).length;
  const mediaNeedingAttention = count("media", [
    "processing",
    "needs_review",
    "rejected",
  ]);
  const health = [
    [
      "Published content",
      allContent
        ? `${Math.round((publishedContent / allContent) * 100)}%`
        : "Unavailable",
    ],
    [
      "Templates current",
      allTemplates
        ? `${Math.round((currentTemplates / allTemplates) * 100)}%`
        : "Unavailable",
    ],
    ["Unused components", String(unusedComponents)],
    ["Media needs attention", String(mediaNeedingAttention)],
  ];
  return (
    <section aria-labelledby="platform-libraries">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">
            Platform libraries
          </p>
          <h2 id="platform-libraries" className="mt-1 text-2xl font-semibold">
            Canonical reusable assets
          </h2>
        </div>
        <details className="relative text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-stone-700">
            <span>Library health</span>
            <span
              className={`rounded-full px-3 py-1 text-xs ${mediaNeedingAttention ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}
            >
              {mediaNeedingAttention ? "Needs attention" : "Good"}
            </span>
            <span className="text-emerald-800">View details →</span>
          </summary>
          <div
            id="library-health"
            className="absolute right-0 z-20 mt-3 w-72 rounded-2xl border bg-white p-4 shadow-xl"
          >
            {health.map(([label, value]) => (
              <p
                key={label}
                className="flex justify-between gap-4 border-b py-2 last:border-0"
              >
                <span className="text-stone-600">{label}</span>
                <strong>{value}</strong>
              </p>
            ))}
          </div>
        </details>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, note, href, attention, action, Icon]) => (
          <article key={label} className="rounded-2xl border bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-800">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p className="font-semibold">{label}</p>
            </div>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            <p className="mt-2 min-h-10 text-xs text-stone-500">{note}</p>
            {attention ? (
              <p className="mt-2 text-xs font-semibold text-amber-800">
                {attention} need attention
              </p>
            ) : null}
            <Link
              href={href}
              className="mt-4 inline-flex text-sm font-semibold text-emerald-800"
            >
              {action} →
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export async function CanonicalLibraryEditor({
  type,
  id,
}: {
  type: LibraryArtifactType;
  id: string;
}) {
  const data = await getGuidebookLibraryArtifact(id);
  if (!data || data.artifact.artifact_type !== type) notFound();
  const artifact = data.artifact as Row;
  const versions = artifact.guidebook_library_versions as Row[];
  const current =
    versions.find(
      (row) =>
        Number(row.version_number) === Number(artifact.current_version_number),
    ) ??
    versions[0] ??
    {};
  const payload = (current.payload as Row) ?? {};
  const body = Array.isArray(payload.blocks)
    ? (payload.blocks as Row[])
        .map((block) => String(block.text ?? ""))
        .join("\n\n")
    : "";
  const currentStatus = String(current.status ?? artifact.status);
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <LibraryHeader
        title={String(artifact.name)}
        description={`${labels[type][0]} · Version ${current.version_number ?? artifact.current_version_number}`}
        current={type}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={routeByType[type]}
            className="text-sm font-semibold text-stone-600"
          >
            ← {labels[type][0]}
          </Link>
          <Status value={String(artifact.status)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${routeByType[type]}/${id}?preview=1`}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
          >
            Preview
          </Link>
          {currentStatus === "draft" ? (
            <form action={transitionLibraryArtifactAction}>
              <input type="hidden" name="artifactId" value={id} />
              <input type="hidden" name="status" value="under_review" />
              <button className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">
                Submit for review
              </button>
            </form>
          ) : null}
          {currentStatus === "under_review" ? (
            <form action={transitionLibraryArtifactAction}>
              <input type="hidden" name="artifactId" value={id} />
              <input type="hidden" name="status" value="published" />
              <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">
                Publish
              </button>
            </form>
          ) : null}
          {currentStatus === "needs_review" ? (
            <form action={transitionLibraryArtifactAction}>
              <input type="hidden" name="artifactId" value={id} />
              <input type="hidden" name="status" value="approved" />
              <button className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white">
                Approve asset
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {type === "media" ? (
        <MediaDetail
          artifact={artifact}
          version={current}
          file={data.mediaFile as Row | null}
          usages={data.usages as Row[]}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <ArtifactForm
            type={type}
            artifact={artifact}
            payload={payload}
            body={body}
          />
          <LivePreview
            type={type}
            artifact={artifact}
            payload={payload}
            body={body}
          />
        </div>
      )}
      {type === "template" && currentStatus === "published" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-xl font-semibold">Use this published template</h2>
          <p className="mt-2 text-sm text-emerald-950">
            Creates a property-specific guidebook draft and records exact
            template, component, and content version lineage. Existing
            publications are not changed.
          </p>
          <form
            action={createGuidebookFromTemplateAction}
            className="mt-5 grid gap-3 md:grid-cols-2"
          >
            <input type="hidden" name="artifactId" value={id} />
            <label className="text-sm font-semibold">
              Canonical property ID
              <input
                name="propertyId"
                required
                className="mt-2 block min-h-11 w-full rounded-xl border bg-white px-3"
              />
            </label>
            <label className="text-sm font-semibold">
              Required variable bindings (JSON)
              <input
                name="variables"
                defaultValue="{}"
                className="mt-2 block min-h-11 w-full rounded-xl border bg-white px-3 font-mono text-xs"
              />
            </label>
            <button className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white md:col-span-2">
              Create guidebook draft
            </button>
          </form>
        </section>
      ) : null}
      <History versions={versions} />
    </main>
  );
}

function LibraryHeader({
  title,
  description,
  current,
}: {
  title: string;
  description: string;
  current: LibraryArtifactType;
}) {
  return (
    <>
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
          Guidebook Studio · Canonical Libraries
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-stone-600">{description}</p>
      </header>
      <AdminGuidebookNavigation
        current={
          current === "component"
            ? "experience-components"
            : current === "media"
              ? "media-library"
              : current === "template"
                ? "templates"
                : "content-library"
        }
      />
    </>
  );
}
function CreatePanel({
  type,
  collections,
}: {
  type: LibraryArtifactType;
  collections: Row[];
}) {
  return (
    <div className="absolute right-0 z-40 mt-2 w-[min(92vw,28rem)] rounded-2xl border bg-white p-5 text-stone-950 shadow-2xl">
      {type === "media" ? (
        <form action={uploadLibraryMediaAction} className="grid gap-3">
          <label className="text-sm font-semibold">
            File
            <input
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,application/pdf"
              className="mt-1 block w-full rounded-xl border p-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Asset name
            <input
              name="name"
              className="mt-1 block w-full rounded-xl border p-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Alt text
            <input
              name="altText"
              className="mt-1 block w-full rounded-xl border p-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Collection
            <select
              name="collectionId"
              required
              className="mt-1 block w-full rounded-xl border p-2"
            >
              <option value="">Choose collection</option>
              {collections.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.name)}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white">
            Upload for review
          </button>
        </form>
      ) : (
        <form action={createLibraryArtifactAction} className="grid gap-3">
          <input type="hidden" name="artifactType" value={type} />
          <label className="text-sm font-semibold">
            Name
            <input
              name="name"
              required
              className="mt-1 block w-full rounded-xl border p-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Category
            <input
              name="category"
              defaultValue="general"
              required
              className="mt-1 block w-full rounded-xl border p-2"
            />
          </label>
          <label className="text-sm font-semibold">
            Description
            <textarea
              name="description"
              className="mt-1 block w-full rounded-xl border p-2"
            />
          </label>
          {type === "content" ? (
            <label className="text-sm font-semibold">
              Content
              <textarea
                name="body"
                required
                rows={5}
                className="mt-1 block w-full rounded-xl border p-2"
              />
            </label>
          ) : null}
          <button className="rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white">
            Create draft
          </button>
        </form>
      )}
    </div>
  );
}

function ContentTable({ artifacts }: { artifacts: Row[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">Canonical reusable content</caption>
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {[
                "Title",
                "Category",
                "Tags",
                "Language",
                "Status",
                "Used in",
                "Updated",
                "Owner",
                "",
              ].map((label) => (
                <th key={label} className="p-4">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {artifacts.map((row) => (
              <tr key={String(row.id)} className="border-t">
                <td className="p-4 font-semibold">{String(row.name)}</td>
                <td className="p-4 capitalize">
                  {String(row.category).replaceAll("-", " ")}
                </td>
                <td className="p-4 text-stone-500">
                  {(row.tags as string[]).join(", ") || "—"}
                </td>
                <td className="p-4 uppercase">{String(row.language)}</td>
                <td className="p-4">
                  <Status value={String(row.status)} />
                </td>
                <td className="p-4">{usageCount(row)}</td>
                <td className="p-4">{date(row.updated_at)}</td>
                <td className="p-4">{String(row.owner_label)}</td>
                <td className="p-4">
                  <Link
                    href={`/admin/guidebooks/content/${row.id}`}
                    className="font-semibold text-emerald-800"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!artifacts.length ? <Empty filtered /> : null}
    </section>
  );
}
function ArtifactGrid({
  type,
  artifacts,
}: {
  type: LibraryArtifactType;
  artifacts: Row[];
}) {
  return artifacts.length ? (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {artifacts.map((row, index) => (
        <article
          key={String(row.id)}
          className="overflow-hidden rounded-2xl border bg-white"
        >
          <div
            className={`grid h-32 place-items-center ${index % 3 === 0 ? "bg-[#e7f1ec]" : index % 3 === 1 ? "bg-[#eee5d5]" : "bg-stone-100"}`}
          >
            <span className="text-3xl font-semibold text-emerald-900">
              {type === "component" ? "▦" : "LH"}
            </span>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{String(row.name)}</h2>
              <Status value={String(row.status)} />
            </div>
            <p className="mt-2 min-h-10 text-sm text-stone-500">
              {String(row.description)}
            </p>
            <div className="mt-4 flex justify-between text-xs text-stone-500">
              <span>v{String(row.current_version_number)}</span>
              <span>{usageCount(row)} uses</span>
            </div>
            <Link
              href={`${routeByType[type]}/${row.id}`}
              className="mt-4 inline-flex font-semibold text-emerald-800"
            >
              Open {type} →
            </Link>
          </div>
        </article>
      ))}
    </section>
  ) : (
    <Empty filtered />
  );
}
function MediaGrid({ artifacts, files }: { artifacts: Row[]; files: Row[] }) {
  const byArtifact = new Map(
    files.map((file) => [
      String((file.guidebook_library_versions as Row)?.artifact_id),
      file,
    ]),
  );
  return artifacts.length ? (
    <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {artifacts.map((row) => {
        const file = byArtifact.get(String(row.id));
        return (
          <article
            key={String(row.id)}
            className="overflow-hidden rounded-2xl border bg-white"
          >
            <div className="grid aspect-[4/3] place-items-center bg-stone-100 text-stone-500">
              {String(
                (row.metadata as Row)?.assetType ?? "asset",
              ).toUpperCase()}
            </div>
            <div className="p-4">
              <h2 className="truncate font-semibold">{String(row.name)}</h2>
              <p className="mt-1 text-xs text-stone-500">
                {file
                  ? `${Math.round(Number(file.byte_size) / 1024)} KB · ${String(file.mime_type)}`
                  : "Processing metadata"}
              </p>
              <div className="mt-3">
                <Status value={String(row.status)} />
              </div>
              <Link
                href={`/admin/guidebooks/media/${row.id}`}
                className="mt-4 inline-flex text-sm font-semibold text-emerald-800"
              >
                View asset →
              </Link>
            </div>
          </article>
        );
      })}
    </section>
  ) : (
    <Empty />
  );
}

function ArtifactForm({
  type,
  artifact,
  payload,
  body,
}: {
  type: LibraryArtifactType;
  artifact: Row;
  payload: Row;
  body: string;
}) {
  return (
    <form
      action={saveLibraryArtifactAction}
      className="space-y-5 rounded-2xl border bg-white p-6"
    >
      <input type="hidden" name="artifactId" value={String(artifact.id)} />
      <label className="block text-sm font-semibold">
        Name
        <input
          name="name"
          defaultValue={String(artifact.name)}
          required
          className="mt-2 block min-h-11 w-full rounded-xl border px-3"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Category
          <input
            name="category"
            defaultValue={String(artifact.category)}
            className="mt-2 block min-h-11 w-full rounded-xl border px-3"
          />
        </label>
        <label className="block text-sm font-semibold">
          Tags
          <input
            name="tags"
            defaultValue={(artifact.tags as string[]).join(", ")}
            className="mt-2 block min-h-11 w-full rounded-xl border px-3"
          />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        Description
        <textarea
          name="description"
          defaultValue={String(artifact.description)}
          rows={2}
          className="mt-2 block w-full rounded-xl border p-3"
        />
      </label>
      {type === "content" ? (
        <>
          <div
            role="toolbar"
            aria-label="Structured content controls"
            className="flex flex-wrap gap-1 rounded-xl border bg-stone-50 p-2"
          >
            {[
              "Paragraph",
              "Heading",
              "List",
              "Link",
              "Callout",
              "Table",
              "Undo",
              "Redo",
            ].map((item) => (
              <button
                key={item}
                type="button"
                className="min-h-9 rounded-lg border bg-white px-3 text-xs font-semibold"
              >
                {item}
              </button>
            ))}
          </div>
          <label className="block text-sm font-semibold">
            Structured content
            <textarea
              name="body"
              defaultValue={body}
              rows={14}
              className="mt-2 block w-full rounded-xl border p-3 font-mono text-sm"
            />
          </label>
          <label className="block text-sm font-semibold">
            Required variables
            <input
              name="requiredVariables"
              defaultValue={
                Array.isArray(payload.requiredVariables)
                  ? (payload.requiredVariables as string[]).join(", ")
                  : ""
              }
              className="mt-2 block min-h-11 w-full rounded-xl border px-3"
            />
          </label>
          <VariablePanel />
        </>
      ) : (
        <label className="block text-sm font-semibold">
          Configuration JSON
          <textarea
            name="payload"
            defaultValue={JSON.stringify(payload, null, 2)}
            rows={18}
            className="mt-2 block w-full rounded-xl border p-3 font-mono text-xs"
          />
        </label>
      )}
      <label className="block text-sm font-semibold">
        Version notes
        <input
          name="changeSummary"
          placeholder="What changed in this revision?"
          className="mt-2 block min-h-11 w-full rounded-xl border px-3"
        />
      </label>
      <button className="sticky bottom-4 rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white shadow-lg">
        Save draft
      </button>
    </form>
  );
}
function VariablePanel() {
  return (
    <aside className="rounded-xl border bg-stone-50 p-4">
      <h2 className="text-sm font-semibold">Approved variables</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          "property_name",
          "check_in_time",
          "check_out_time",
          "entry_method",
          "door_code",
          "wifi_name",
          "wifi_password",
          "parking_location",
          "quiet_hours",
          "host_phone",
        ].map((variable) => (
          <code
            key={variable}
            className="rounded-md bg-white px-2 py-1 text-xs"
          >
            {"{{"}
            {variable}
            {"}}"}
          </code>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Required variables are checked before a template can create a guidebook
        draft.
      </p>
    </aside>
  );
}
function LivePreview({
  type,
  artifact,
  payload,
  body,
}: {
  type: LibraryArtifactType;
  artifact: Row;
  payload: Row;
  body: string;
}) {
  return (
    <aside
      aria-label="Safe sample preview"
      className="self-start rounded-2xl border bg-stone-50 p-6 xl:sticky xl:top-24"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Preview
          </p>
          <h2 className="mt-1 text-xl font-semibold">Safe sample data</h2>
        </div>
        <div className="flex gap-1" aria-label="Preview device">
          <button className="rounded-lg border bg-white px-3 py-2 text-xs">
            Desktop
          </button>
          <button className="rounded-lg border bg-white px-3 py-2 text-xs">
            Tablet
          </button>
          <button className="rounded-lg border bg-white px-3 py-2 text-xs">
            Mobile
          </button>
        </div>
      </div>
      <div className="mt-5 rounded-[2rem] border bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-stone-500">
          {type} · {String(payload.variant ?? "canonical")}
        </p>
        <h3 className="mt-4 font-serif text-3xl">{String(artifact.name)}</h3>
        <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-stone-600">
          {body
            ? body
                .replaceAll("{{property_name}}", "Ocean View Villa")
                .replaceAll("{{check_in_time}}", "4:00 PM")
                .replaceAll("{{check_out_time}}", "10:00 AM")
                .replaceAll("{{wifi_name}}", "LuxeHaven_Guest")
                .replaceAll("{{wifi_password}}", "••••••••")
                .replaceAll("{{host_phone}}", "(555) 010-0200")
            : "Configuration preview uses placeholders only—never live customer data."}
        </div>
      </div>
    </aside>
  );
}
function MediaDetail({
  artifact,
  version,
  file,
  usages,
}: {
  artifact: Row;
  version: Row;
  file: Row | null;
  usages: Row[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_.7fr]">
      <section className="rounded-2xl border bg-white p-6">
        <div className="grid min-h-80 place-items-center rounded-2xl bg-stone-100 text-stone-500">
          Secure preview · {String(file?.mime_type ?? "processing")}
        </div>
        <h2 className="mt-6 text-xl font-semibold">Asset metadata</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["File", file?.original_file_name],
            ["Format", file?.mime_type],
            [
              "Size",
              file ? `${Math.round(Number(file.byte_size) / 1024)} KB` : null,
            ],
            ["Alt text", file?.alt_text],
            ["Collection", (file?.guidebook_media_collections as Row)?.name],
            ["Scan", file?.scan_status],
            ["Version", version.version_number],
            ["Uploaded", file?.uploaded_at ? date(file.uploaded_at) : null],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs font-bold uppercase text-stone-500">
                {String(label)}
              </dt>
              <dd className="mt-1 text-sm">{String(value ?? "Unavailable")}</dd>
            </div>
          ))}
        </dl>
      </section>
      <aside className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Usage and lineage</h2>
        {usages.length ? (
          <ul className="mt-4 space-y-3">
            {usages.map((row) => (
              <li
                key={String(row.id)}
                className="rounded-xl bg-stone-50 p-3 text-sm"
              >
                {String(row.consumer_type)} · {String(row.consumer_id)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
            This asset is not used by a template or guidebook.
          </p>
        )}
        <p className="mt-5 text-xs text-stone-500">
          Replacing an approved asset creates a new version; published
          guidebooks keep their existing reference.
        </p>
      </aside>
    </div>
  );
}
function History({ versions }: { versions: Row[] }) {
  return (
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">Version history</h2>
      <div className="mt-4 divide-y">
        {versions.map((row) => (
          <div
            key={String(row.id)}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <p className="font-semibold">
                Version {String(row.version_number)}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {String(row.change_summary || "No version notes")}
              </p>
            </div>
            <div className="text-right">
              <Status value={String(row.status)} />
              <p className="mt-1 text-xs text-stone-500">
                {date(row.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">
      {value.replaceAll("_", " ").replaceAll("-", " ")}
    </span>
  );
}
function usageCount(row: Row) {
  return Number(row.usage_count ?? 0);
}
function date(value: unknown) {
  return value ? new Date(String(value)).toLocaleDateString() : "—";
}
function Empty({ filtered = false }: { filtered?: boolean }) {
  return (
    <section className="rounded-2xl border border-dashed bg-white p-12 text-center">
      <h2 className="text-lg font-semibold">
        {filtered ? "No matching records" : "The library is empty"}
      </h2>
      <p className="mt-2 text-sm text-stone-500">
        {filtered
          ? "Reset filters or create a new canonical artifact."
          : "Create the first governed artifact to begin."}
      </p>
    </section>
  );
}
function LibraryUnavailable({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-7xl p-8">
      <section
        role="alert"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-6"
      >
        <h1 className="text-xl font-semibold">
          Canonical libraries need their database migration
        </h1>
        <p className="mt-2 text-sm">{message}</p>
      </section>
    </main>
  );
}
