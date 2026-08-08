import Link from "next/link";
import {
  addDesignTokenAction,
  assignProductStyleAction,
  createDesignProfileAction,
  createNextStyleVersionAction,
  createStyleSystemAction,
  getDesignLibrary,
  getDesignProfile,
  getStyleSystem,
  updateStyleStatusAction,
} from "@/app/actions/furnishing-design";
import { designReview, styleCoverage } from "@/features/furnishing-studio";
import { Badge, FurnishingHeader } from "./furnishing-navigation";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const panel = "rounded-2xl border border-stone-200 bg-white p-5",
  field =
    "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm",
  button =
    "inline-flex rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white";
const current = (row: Row, key: string) =>
  row[key]?.find((x: Row) => x.id === row.current_version_id) ??
  row[key]?.at(-1);
export async function StyleLibrary() {
  const data = await getDesignLibrary();
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Design & Style"
        description="Reusable design systems for cohesive hospitality spaces."
        current="design / style"
        action={
          <div className="flex gap-2">
            <Link
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              href="/admin/furnishing/styles/profiles/new"
            >
              Create design profile
            </Link>
            <Link className={button} href="/admin/furnishing/styles/new">
              + New style system
            </Link>
          </div>
        }
      />
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.styles.map((style: Row) => {
          const version = current(style, "furnishing_style_system_versions"),
            assignments = version?.furnishing_product_style_assignments ?? [],
            coverage = styleCoverage(assignments, data.products.length);
          return (
            <Link
              href={`/admin/furnishing/styles/${style.id}`}
              key={style.id}
              className="overflow-hidden rounded-2xl border bg-white transition hover:shadow-lg"
            >
              <div className="h-40 bg-gradient-to-br from-amber-100 via-stone-200 to-emerald-200" />
              <div className="p-5">
                <div className="flex justify-between">
                  <h2 className="text-lg font-semibold">{style.name}</h2>
                  <Badge value={style.lifecycle_status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-stone-600">
                  {style.description ||
                    "Define principles, palette, materials, and product compatibility."}
                </p>
                <div className="mt-5 flex justify-between text-xs text-stone-500">
                  <span>
                    {version?.furnishing_design_tokens?.length ?? 0} tokens
                  </span>
                  <span>
                    {coverage.preferred} preferred · {coverage.unclassified}{" "}
                    unclassified
                  </span>
                  <span>v{version?.version_number ?? 1}</span>
                </div>
              </div>
            </Link>
          );
        })}
        <Link
          href="/admin/furnishing/styles/new"
          className={`${panel} flex min-h-72 items-center justify-center text-center font-semibold text-violet-700`}
        >
          + Create new style system
        </Link>
      </section>
    </main>
  );
}
export function NewStyleSystem() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Create Style System"
        description="Define a structured and reusable physical-space design vocabulary."
        current="design / style"
      />
      <form
        action={createStyleSystemAction}
        className={`${panel} grid gap-5 md:grid-cols-2`}
      >
        <label className="font-semibold">
          Name *
          <input
            required
            name="name"
            className={`${field} mt-2`}
            placeholder="Desert Modern"
          />
        </label>
        <label className="font-semibold">
          Slug
          <input
            name="slug"
            className={`${field} mt-2`}
            placeholder="desert-modern"
          />
        </label>
        <label className="font-semibold md:col-span-2">
          Description
          <textarea name="description" className={`${field} mt-2`} rows={3} />
        </label>
        {[
          ["principles", "Design principles"],
          ["aestheticTags", "Aesthetic"],
          ["moodTags", "Mood"],
          ["contextualTags", "Context"],
          ["positioningTags", "Positioning"],
        ].map(([name, label]) => (
          <label className="font-semibold" key={name}>
            {label}
            <input
              name={name}
              className={`${field} mt-2`}
              placeholder="Comma-separated"
            />
          </label>
        ))}
        <div className="md:col-span-2 flex justify-end">
          <button className={button}>Create draft style</button>
        </div>
      </form>
    </main>
  );
}
export async function StyleDetail({ styleId }: { styleId: string }) {
  const { style, products, profiles } = (await getStyleSystem(styleId)) as Row,
    version = current(style, "furnishing_style_system_versions"),
    tokens: Row[] = version.furnishing_design_tokens ?? [],
    assignments: Row[] = version.furnishing_product_style_assignments ?? [],
    coverage = styleCoverage(
      assignments.map((item) => ({ compatibility: item.compatibility })),
      products.length,
    ),
    assigned = new Set(assignments.map((x) => x.product_id));
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title={style.name}
        description={style.description || "Reusable furnishing design system"}
        current="design / style"
        action={<Badge value={version.lifecycle_status} />}
      />
      <section className="grid gap-3 sm:grid-cols-5">
        {Object.entries(coverage).map(([x, y]) => (
          <div className={panel} key={x}>
            <p className="text-xs capitalize text-stone-500">{x}</p>
            <p className="mt-2 text-2xl font-semibold">{y}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className={panel}>
          <h2 className="text-xl font-semibold">Design direction</h2>
          <p className="mt-3 text-stone-600">
            {version.design_principles?.join(" · ") ||
              "Add design principles before review."}
          </p>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-stone-500">Mood</dt>
              <dd>{version.mood_tags?.join(", ") || "Not defined"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Context</dt>
              <dd>{version.contextual_tags?.join(", ") || "Not defined"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Positioning</dt>
              <dd>{version.positioning_tags?.join(", ") || "Not defined"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Usage</dt>
              <dd>
                {
                  profiles.filter(
                    (x: Row) => x.style_system_version_id === version.id,
                  ).length
                }{" "}
                design profiles
              </dd>
            </div>
          </dl>
        </section>
        <section className={panel}>
          <h2 className="text-xl font-semibold">Design tokens</h2>
          {[
            "color",
            "material",
            "finish",
            "texture",
            "wood_tone",
            "metal",
            "shape",
            "accent",
          ].map((type) => {
            const group = tokens.filter((x) => x.token_type === type);
            return group.length ? (
              <div className="mt-5" key={type}>
                <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">
                  {type.replaceAll("_", " ")}
                </h3>
                <div className="mt-2 flex flex-wrap gap-3">
                  {group.map((token) => (
                    <div
                      className="min-w-28 rounded-xl border p-3"
                      key={token.id}
                    >
                      <span
                        className="block h-8 rounded-lg border"
                        style={{
                          background:
                            token.token_type === "color"
                              ? token.value
                              : undefined,
                        }}
                      />
                      <strong className="mt-2 block text-sm">
                        {token.name}
                      </strong>
                      <small className="text-stone-500">{token.value}</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })}
          {version.lifecycle_status === "draft" ? (
            <form
              action={addDesignTokenAction}
              className="mt-6 grid gap-2 sm:grid-cols-5"
            >
              <input type="hidden" name="styleId" value={style.id} />
              <input type="hidden" name="versionId" value={version.id} />
              <select name="tokenType" className={field}>
                {[
                  "color",
                  "material",
                  "finish",
                  "texture",
                  "pattern",
                  "shape",
                  "scale",
                  "lighting",
                  "metal",
                  "wood_tone",
                  "upholstery",
                  "accent",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <input
                required
                name="name"
                className={field}
                placeholder="Token name"
              />
              <input
                name="tokenValue"
                className={field}
                placeholder="#hex or descriptor"
              />
              <select name="priority" className={field}>
                <option>primary</option>
                <option>secondary</option>
                <option>accent</option>
              </select>
              <button className={button}>Add token</button>
            </form>
          ) : null}
        </section>
      </div>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Product compatibility</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-3">Product</th>
                <th>Category</th>
                <th>Compatibility</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((x) => (
                <tr className="border-t" key={x.id}>
                  <td className="py-3 font-semibold">
                    {x.furnishing_products?.name}
                  </td>
                  <td>{x.furnishing_products?.category}</td>
                  <td>
                    <Badge value={x.compatibility} />
                  </td>
                  <td>{x.rationale || "Curated by Luxe Haven"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {version.lifecycle_status === "draft" ? (
          <form
            action={assignProductStyleAction}
            className="mt-5 grid gap-3 md:grid-cols-4"
          >
            <input type="hidden" name="styleId" value={style.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <select required name="productId" className={field}>
              <option value="">Select unclassified product</option>
              {products
                .filter((x: Row) => !assigned.has(x.id))
                .map((x: Row) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
            <select name="compatibility" className={field}>
              {["preferred", "compatible", "neutral", "avoid"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              name="rationale"
              className={field}
              placeholder="Visible rationale"
            />
            <button className={button}>Save compatibility</button>
          </form>
        ) : null}
      </section>
      <div className="flex justify-end gap-3">
        {version.lifecycle_status === "draft" ? (
          <form action={updateStyleStatusAction}>
            <input type="hidden" name="styleId" value={style.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <input type="hidden" name="status" value="in_review" />
            <button className={button}>Submit for review</button>
          </form>
        ) : null}
        {version.lifecycle_status === "in_review" ? (
          <form action={updateStyleStatusAction}>
            <input type="hidden" name="styleId" value={style.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <input type="hidden" name="status" value="approved" />
            <button className={button}>
              Approve v{version.version_number}
            </button>
          </form>
        ) : null}
        {version.lifecycle_status === "approved" ? (
          <form action={createNextStyleVersionAction}>
            <input type="hidden" name="styleId" value={style.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <button className={button}>
              Create editable v{version.version_number + 1}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
export async function NewDesignProfile() {
  const data = await getDesignLibrary(),
    approved = data.styles.flatMap((style: Row) =>
      (style.furnishing_style_system_versions ?? [])
        .filter((v: Row) => v.lifecycle_status === "approved")
        .map((v: Row) => ({ ...v, styleName: style.name })),
    );
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Create Design Profile"
        description="Apply a governed style version to a real property without changing the reusable room standard."
        current="design / style"
      />
      <form
        action={createDesignProfileAction}
        className={`${panel} grid gap-5 md:grid-cols-2`}
      >
        <label className="font-semibold">
          Property *
          <select required name="propertyId" className={`${field} mt-2`}>
            <option value="">Select property</option>
            {data.properties.map((x: Row) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="font-semibold">
          Approved style *
          <select required name="styleVersionId" className={`${field} mt-2`}>
            <option value="">Select style</option>
            {approved.map((x: Row) => (
              <option value={x.id} key={x.id}>
                {x.styleName} v{x.version_number}
              </option>
            ))}
          </select>
        </label>
        <label className="font-semibold">
          Profile name *
          <input
            required
            name="name"
            className={`${field} mt-2`}
            placeholder="Luxe Haven Mesa — Desert Modern"
          />
        </label>
        <label className="font-semibold">
          Positioning
          <select name="tier" className={`${field} mt-2`}>
            {["essential", "elevated", "luxury", "custom"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="font-semibold">
          Mood
          <input
            name="moodTags"
            className={`${field} mt-2`}
            placeholder="Warm, Relaxed"
          />
        </label>
        <label className="font-semibold">
          Context
          <input
            name="contextualTags"
            className={`${field} mt-2`}
            placeholder="Desert, Southwestern"
          />
        </label>
        <label className="font-semibold md:col-span-2">
          Notes
          <textarea name="notes" className={`${field} mt-2`} />
        </label>
        <div className="md:col-span-2 flex justify-end">
          <button className={button}>Create design profile</button>
        </div>
      </form>
    </main>
  );
}
export async function DesignProfileDetail({
  profileId,
}: {
  profileId: string;
}) {
  const { profile, rooms } = (await getDesignProfile(profileId)) as Row,
    version = current(profile, "furnishing_design_profile_versions"),
    style = version.furnishing_style_system_versions,
    assignments: Row[] = style.furnishing_product_style_assignments ?? [],
    directions: Row[] = version.furnishing_room_design_directions ?? [],
    issues = designReview({
      assignments: assignments.map((x) => ({ compatibility: x.compatibility })),
      rooms: rooms.map((room: Row) => ({
        hasDirection: directions.some((x) => x.room_id === room.id),
      })),
      accentTokenCount: version.selected_token_ids?.length ?? 0,
    });
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title={profile.name}
        description={`${profile.properties?.name} · ${style.furnishing_style_systems?.name} v${style.version_number}`}
        current="design / style"
        action={<Badge value={profile.status} />}
      />
      <section className="grid gap-4 md:grid-cols-3">
        <div className={panel}>
          <p className="text-stone-500">Mood</p>
          <p className="mt-2 font-semibold">
            {version.mood_tags?.join(", ") || "Inherited from style"}
          </p>
        </div>
        <div className={panel}>
          <p className="text-stone-500">Positioning</p>
          <p className="mt-2 font-semibold capitalize">
            {version.positioning_tier}
          </p>
        </div>
        <div className={panel}>
          <p className="text-stone-500">Room directions</p>
          <p className="mt-2 font-semibold">{directions.length} configured</p>
        </div>
      </section>
      <section
        className={
          issues.length
            ? "rounded-2xl border border-amber-200 bg-amber-50 p-5"
            : "rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
        }
      >
        <h2 className="font-semibold">Design Review</h2>
        <p className="mt-2 text-sm">
          {issues.length
            ? issues.join(" · ")
            : "Direction is coherent and aligned with the approved style version."}
        </p>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Room directions</h2>
        {rooms.length ? (
          <ul className="mt-4 divide-y">
            {rooms.map((room: Row) => (
              <li className="flex justify-between py-3" key={room.id}>
                <span>{room.name}</span>
                <span className="text-sm text-stone-500">
                  {directions.some((x) => x.room_id === room.id)
                    ? "Customized"
                    : "Inherits property direction"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            Connect this profile to a furnishing project to configure room-level
            direction.
          </p>
        )}
      </section>
    </main>
  );
}
