import Link from "next/link";
import {
  addProductAlternativeAction,
  addPropertyPackageRoomAction,
  addRoomPackageItemAction,
  createPropertyPackageAction,
  createNextRoomPackageVersionAction,
  createRoomPackageAction,
  createRoomRequirementAction,
  duplicateRoomPackageAction,
  completePackageImportAction,
  getPackageImport,
  getPackageLibrary,
  getPropertyPackage,
  getRoomPackage,
  submitRoomPackageAction,
  startPackageImportAction,
} from "@/app/actions/furnishing-packages";
import { approveFs008dPackage } from "@/app/actions/fs008d-governance";
import {
  estimatePackage,
  representativeOffer,
  resolveComposition,
  resolveQuantity,
  validateRoomPackage,
} from "@/features/furnishing-studio";
import { Badge, FurnishingHeader } from "./furnishing-navigation";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const panel = "rounded-2xl border border-stone-200 bg-white p-5",
  field =
    "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm",
  button =
    "inline-flex rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white";
const dollars = (minor: unknown) =>
  typeof minor === "number"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(minor / 100)
    : "Price unavailable";
const current = (row: Row, key: string) =>
  row[key]?.find((x: Row) => x.id === row.current_version_id) ??
  row[key]?.at(-1);
const catalogOffer = (offer: Row) => ({
  id: String(offer.id),
  status: offer.status,
  availability: offer.availability,
  listedPrice:
    typeof offer.listed_price_minor === "number"
      ? { amountMinor: offer.listed_price_minor, currency: "USD" }
      : null,
  lastVerifiedAt: offer.last_verified_at ?? null,
});

export async function PropertyPackageLibrary() {
  const data = await getPackageLibrary();
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Furnishing Packages"
        description="Reusable property-wide furnishing systems composed from immutable room-package versions."
        current="packages"
        action={
          <div className="flex gap-2">
            <Link
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              href="/admin/furnishing/packages/rules"
            >
              Quantity rules
            </Link>
            <Link
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              href="/admin/furnishing/packages/rooms"
            >
              Room packages
            </Link>
            <Link className={button} href="/admin/furnishing/packages/new">
              + New package
            </Link>
          </div>
        }
      />
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.propertyPackages.map((pkg: Row) => {
          const version = current(pkg, "furnishing_package_versions");
          return (
            <Link
              key={pkg.id}
              href={`/admin/furnishing/packages/${pkg.id}`}
              className={`${panel} transition hover:shadow-lg`}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{pkg.name}</h2>
                  <p className="mt-1 text-sm capitalize text-stone-500">
                    {pkg.property_type} · {pkg.tier ?? pkg.budget_tier}
                  </p>
                </div>
                <Badge value={pkg.lifecycle_status} />
              </div>
              <div className="mt-6 flex justify-between text-sm">
                <span>
                  {version?.furnishing_package_room_composition?.length ?? 0}{" "}
                  room standards
                </span>
                <span>v{version?.version_number ?? 1}</span>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Estimated range {dollars(version?.estimated_budget_low_minor)} –{" "}
                {dollars(version?.estimated_budget_high_minor)}
              </p>
            </Link>
          );
        })}
      </section>
      {!data.propertyPackages.length ? (
        <Empty
          title="Create a reusable property furnishing system."
          href="/admin/furnishing/packages/new"
          label="Create package"
        />
      ) : null}
    </main>
  );
}

export async function RoomPackageLibrary() {
  const data = await getPackageLibrary();
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Room Packages"
        description="Reusable furnishing standards for individual hospitality spaces."
        current="packages"
        action={
          <div className="flex gap-2">
            <Link
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              href="/admin/furnishing/packages/import"
            >
              Import workbook
            </Link>
            <Link
              className={button}
              href="/admin/furnishing/packages/rooms/new"
            >
              + New room package
            </Link>
          </div>
        }
      />
      <div className="flex gap-2">
        <Link
          href="/admin/furnishing/packages"
          className="text-sm font-semibold text-violet-700"
        >
          ← Property packages
        </Link>
        <Link
          href="/admin/furnishing/packages/rules"
          className="text-sm font-semibold text-violet-700"
        >
          Quantity rule library
        </Link>
      </div>
      <section className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-stone-50">
            <tr>
              {[
                "Package",
                "Room",
                "Tier",
                "Requirements",
                "Estimate",
                "Status",
                "Version",
              ].map((x) => (
                <th className="p-4" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.roomPackages.map((pkg: Row) => {
              const v = current(pkg, "furnishing_room_package_versions");
              return (
                <tr className="border-t" key={pkg.id}>
                  <td className="p-4 font-semibold">
                    <Link href={`/admin/furnishing/packages/rooms/${pkg.id}`}>
                      {pkg.name}
                    </Link>
                  </td>
                  <td className="capitalize">
                    {pkg.room_type.replaceAll("_", " ")}
                  </td>
                  <td className="capitalize">{pkg.tier}</td>
                  <td>{v?.furnishing_room_package_items?.length ?? 0}</td>
                  <td>{dollars(v?.estimated_budget_minor)}</td>
                  <td>
                    <Badge value={pkg.lifecycle_status} />
                  </td>
                  <td>v{v?.version_number ?? 1}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {!data.roomPackages.length ? (
        <Empty
          title="Turn room inventory into a reusable standard."
          href="/admin/furnishing/packages/rooms/new"
          label="Create room package"
        />
      ) : null}
    </main>
  );
}

function Empty({
  title,
  href,
  label,
}: {
  title: string;
  href: string;
  label: string;
}) {
  return (
    <section className={`${panel} py-16 text-center`}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-stone-600">
        Requirements, products, and quantity rules remain independently governed
        and reusable.
      </p>
      <Link className={`${button} mt-5`} href={href}>
        {label}
      </Link>
    </section>
  );
}

export async function NewRoomPackage() {
  const data = await getPackageLibrary();
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Create Room Package"
        description="Define the identity of a reusable room standard, then add its requirements."
        current="packages"
      />
      <form
        action={createRoomPackageAction}
        className={`${panel} grid gap-5 md:grid-cols-2`}
      >
        <label className="font-semibold">
          Package name *
          <input
            required
            name="name"
            className={`${field} mt-2`}
            placeholder="Elevated Queen Bedroom"
          />
        </label>
        <label className="font-semibold">
          Room type *
          <select required name="roomType" className={`${field} mt-2`}>
            <option value="">Select room</option>
            {data.roomTypes.map((x: Row) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="font-semibold">
          Tier *
          <select name="tier" className={`${field} mt-2`}>
            {["essential", "elevated", "luxury", "custom"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="font-semibold">
          Style tags
          <input
            name="styleTags"
            className={`${field} mt-2`}
            placeholder="Desert Modern, Warm Neutral"
          />
        </label>
        <label className="font-semibold md:col-span-2">
          Description
          <textarea rows={4} name="description" className={`${field} mt-2`} />
        </label>
        <div className="md:col-span-2 flex justify-end">
          <button className={button}>Create draft package</button>
        </div>
      </form>
    </main>
  );
}

export async function RoomPackageDetail({ packageId }: { packageId: string }) {
  const { pkg, rules, requirements, products } = (await getRoomPackage(
    packageId,
  )) as Row;
  const version = current(pkg, "furnishing_room_package_versions"),
    items: Row[] = version?.furnishing_room_package_items ?? [];
  const facts = { bedrooms: 1, bathrooms: 1, guests: 2, rooms: 1, beds: 1 };
  const lines = items.map((item) => {
    const offers: Row[] =
        item.furnishing_products?.furnishing_product_offers ?? [],
      rep = representativeOffer(offers.map(catalogOffer));
    let quantity = 0;
    try {
      const r = item.furnishing_quantity_rules;
      quantity = resolveQuantity(
        {
          id: r.id,
          ruleType: r.rule_type,
          multiplier: Number(r.multiplier),
          minimum: r.minimum === null ? null : Number(r.minimum),
          maximum: r.maximum === null ? null : Number(r.maximum),
          customExpression: r.custom_expression
            ? JSON.stringify(r.custom_expression)
            : null,
          rounding: r.rounding,
        },
        facts,
      );
    } catch {}
    return {
      quantity,
      unitPriceMinor: rep?.listedPrice?.amountMinor ?? null,
      unitsPerPurchase: item.furnishing_products?.units_per_purchase ?? 1,
      item,
      rep,
    };
  });
  const estimate = estimatePackage(lines),
    issues = validateRoomPackage(
      items.map((i) => ({
        requirementId: i.room_requirement_id,
        priority: i.priority,
        quantityRuleId: i.quantity_rule_id,
        productId: i.recommended_product_id,
        productStatus: i.furnishing_products?.status,
        hasActiveOffer: i.furnishing_products?.furnishing_product_offers?.some(
          (o: Row) => o.status === "active",
        ),
        hasPrice: i.furnishing_products?.furnishing_product_offers?.some(
          (o: Row) => o.status === "active" && o.listed_price_minor != null,
        ),
      })),
    );
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title={pkg.name}
        description={`${pkg.room_type.replaceAll("_", " ")} · ${pkg.tier} · version ${version.version_number}`}
        current="packages"
        action={<Badge value={version.lifecycle_status} />}
      />
      <section className="grid gap-4 sm:grid-cols-4">
        {[
          ["Requirements", items.length],
          ["Pricing coverage", `${estimate.coveragePercent}%`],
          ["Missing prices", estimate.missingPrice],
          ["Estimated total", dollars(estimate.estimatedTotalMinor)],
        ].map(([x, y]) => (
          <div className={panel} key={String(x)}>
            <p className="text-xs uppercase text-stone-500">{x}</p>
            <p className="mt-2 text-xl font-semibold">{y}</p>
          </div>
        ))}
      </section>
      {issues.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold">Needs attention</h2>
          <p className="mt-1 text-sm">{issues.join(" · ")}</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 font-semibold">
          Ready for review
        </section>
      )}
      <section className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr>
              {[
                "Requirement",
                "Priority",
                "Quantity rule",
                "Resolved",
                "Product",
                "Estimate",
                "Alternatives",
              ].map((x) => (
                <th className="p-4" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(({ item, quantity, rep }) => (
              <tr className="border-t" key={item.id}>
                <td className="p-4 font-semibold">
                  {item.furnishing_room_requirements?.name ??
                    item.requirement_key}
                </td>
                <td className="capitalize">{item.priority}</td>
                <td>
                  {item.furnishing_quantity_rules?.multiplier} ×{" "}
                  {item.furnishing_quantity_rules?.rule_type?.replace(
                    "per_",
                    "per ",
                  )}
                </td>
                <td>{quantity}</td>
                <td>{item.furnishing_products?.name ?? "Not assigned"}</td>
                <td>
                  {rep?.listedPrice
                    ? dollars(rep.listedPrice.amountMinor * quantity)
                    : "Missing price"}
                </td>
                <td>
                  <span>
                    {item.furnishing_package_product_alternatives?.length ?? 0}
                  </span>
                  {version.lifecycle_status === "draft" ? (
                    <details>
                      <summary className="cursor-pointer text-violet-700">
                        Add
                      </summary>
                      <form
                        action={addProductAlternativeAction}
                        className="mt-2 flex gap-2"
                      >
                        <input type="hidden" name="packageId" value={pkg.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <select name="productId" className={field}>
                          {products
                            .filter(
                              (p: Row) => p.id !== item.recommended_product_id,
                            )
                            .map((p: Row) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                        <button className={button}>Add</button>
                      </form>
                    </details>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {version.lifecycle_status === "draft" ? (
        <section className={panel}>
          <h2 className="text-lg font-semibold">Add requirement</h2>
          <form
            action={addRoomPackageItemAction}
            className="mt-4 grid gap-3 md:grid-cols-5"
          >
            <input type="hidden" name="packageId" value={pkg.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <select required name="requirementId" className={field}>
              <option value="">Requirement</option>
              {requirements
                .filter(
                  (r: Row) =>
                    !items.some((i) => i.room_requirement_id === r.id),
                )
                .map((r: Row) => (
                  <option value={r.id} key={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <select required name="quantityRuleId" className={field}>
              <option value="">Quantity rule</option>
              {rules.map((r: Row) => (
                <option value={r.id} key={r.id}>
                  {r.multiplier} × {r.rule_type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select name="priority" className={field}>
              {["required", "recommended", "optional"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select name="productId" className={field}>
              <option value="">No product yet</option>
              {products.map((p: Row) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input type="hidden" name="substitutionPolicy" value="allowed" />
            <button className={button}>Add requirement</button>
          </form>
        </section>
      ) : null}
      <div className="flex justify-end gap-3">
        {version.lifecycle_status === "approved" ? (
          <form action={createNextRoomPackageVersionAction}>
            <input type="hidden" name="packageId" value={pkg.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <button className={button}>
              Create editable v{version.version_number + 1}
            </button>
          </form>
        ) : null}
        <details className="rounded-xl border px-4 py-2">
          <summary className="cursor-pointer text-sm font-semibold">
            Duplicate
          </summary>
          <form action={duplicateRoomPackageAction} className="mt-3 flex gap-2">
            <input type="hidden" name="packageId" value={pkg.id} />
            <input
              required
              name="name"
              className={field}
              defaultValue={`Copy of ${pkg.name}`}
            />
            <button className={button}>Create copy</button>
          </form>
        </details>
        {version.lifecycle_status === "draft" ? (
          <form action={submitRoomPackageAction}>
            <input type="hidden" name="packageId" value={pkg.id} />
            <input type="hidden" name="versionId" value={version.id} />
            <input type="hidden" name="status" value="in_review" />
            <button
              disabled={issues.length > 0}
              className={`${button} disabled:opacity-40`}
            >
              Submit for review
            </button>
          </form>
        ) : null}
        {version.lifecycle_status === "in_review" ? (
          <form action={async (formData) => { "use server"; await approveFs008dPackage({ packageVersionId: version.id, expectedVersion: 1, reason: String(formData.get("reason") ?? "Catalog readiness approved"), correlationId: `fs008d-approval:${version.id}`, idempotencyKey: `fs008d-approval:${version.id}` }); }} className="flex gap-2">
            <input required name="reason" aria-label="Approval reason" placeholder="Approval reason" className={field} />
            <button disabled={issues.length > 0} className={`${button} disabled:opacity-40`}>Approve v{version.version_number}</button>
          </form>
        ) : null}
      </div>
    </main>
  );
}

export async function QuantityRuleLibrary() {
  const data = await getPackageLibrary(),
    facts = { bedrooms: 3, bathrooms: 2, guests: 8, rooms: 8, beds: 3 };
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Quantity Rule Library"
        description="Reusable deterministic policies replace spreadsheet formulas and hard-coded amounts."
        current="packages"
      />
      <section className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-4">Rule</th>
              <th>Multiplier</th>
              <th>Example: 3BR / 2BA / 8 guests</th>
              <th>Rounding</th>
            </tr>
          </thead>
          <tbody>
            {data.rules.map((r: Row) => {
              let resolved = "Requires reviewed expression";
              try {
                resolved = String(
                  resolveQuantity(
                    {
                      id: r.id,
                      ruleType: r.rule_type,
                      multiplier: Number(r.multiplier),
                      minimum: r.minimum === null ? null : Number(r.minimum),
                      maximum: r.maximum === null ? null : Number(r.maximum),
                      customExpression: r.custom_expression
                        ? JSON.stringify(r.custom_expression)
                        : null,
                      rounding: r.rounding,
                    },
                    facts,
                  ),
                );
              } catch {}
              return (
                <tr className="border-t" key={r.id}>
                  <td className="p-4 font-semibold capitalize">
                    {r.rule_type.replaceAll("_", " ")}
                  </td>
                  <td>{r.multiplier}</td>
                  <td>{resolved}</td>
                  <td className="capitalize">{r.rounding}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}

export async function NewPropertyPackage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="New Furnishing Package"
        description="Compose approved room standards into a reusable property-wide system."
        current="packages"
      />
      <form
        action={createPropertyPackageAction}
        className={`${panel} grid gap-5 md:grid-cols-2`}
      >
        <label className="font-semibold">
          Name *
          <input
            required
            name="name"
            className={`${field} mt-2`}
            placeholder="Elevated 3BR STR"
          />
        </label>
        <label className="font-semibold">
          Tier
          <select name="tier" className={`${field} mt-2`}>
            {["essential", "elevated", "luxury", "custom"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="font-semibold">
          Property type
          <input
            required
            name="propertyType"
            defaultValue="short_term_rental"
            className={`${field} mt-2`}
          />
        </label>
        <label className="font-semibold">
          Style
          <input
            name="style"
            defaultValue="custom"
            className={`${field} mt-2`}
          />
        </label>
        {[
          ["bedroomMin", "Minimum bedrooms"],
          ["bedroomMax", "Maximum bedrooms"],
          ["bathroomMin", "Minimum bathrooms"],
          ["bathroomMax", "Maximum bathrooms"],
          ["guestMin", "Minimum guests"],
          ["guestMax", "Maximum guests"],
        ].map(([name, label]) => (
          <label className="font-semibold" key={name}>
            {label}
            <input
              type="number"
              min="0"
              name={name}
              className={`${field} mt-2`}
            />
          </label>
        ))}
        <label className="font-semibold md:col-span-2">
          Description
          <textarea name="description" className={`${field} mt-2`} />
        </label>
        <div className="md:col-span-2 flex justify-end">
          <button className={button}>Create draft package</button>
        </div>
      </form>
    </main>
  );
}

export async function PropertyPackageDetail({
  packageId,
}: {
  packageId: string;
}) {
  const { pkg, rooms, rules } = (await getPropertyPackage(packageId)) as Row,
    version = current(pkg, "furnishing_package_versions"),
    composition: Row[] = version.furnishing_package_room_composition ?? [],
    facts = { bedrooms: 3, bathrooms: 2 };
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title={pkg.name}
        description={`${pkg.property_type} · ${pkg.tier ?? pkg.budget_tier} · v${version.version_number}`}
        current="packages"
        action={<Badge value={version.lifecycle_status} />}
      />
      <section className="grid gap-4 sm:grid-cols-3">
        <div className={panel}>
          <p className="text-stone-500">Room standards</p>
          <p className="mt-2 text-2xl font-semibold">{composition.length}</p>
        </div>
        <div className={panel}>
          <p className="text-stone-500">Resolved rooms (3BR/2BA)</p>
          <p className="mt-2 text-2xl font-semibold">
            {composition.reduce(
              (n, x) => n + resolveComposition(x.composition_rule, facts),
              0,
            )}
          </p>
        </div>
        <div className={panel}>
          <p className="text-stone-500">Lifecycle</p>
          <p className="mt-2 text-2xl font-semibold capitalize">
            {version.lifecycle_status}
          </p>
        </div>
      </section>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Room composition</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-3">Room package</th>
              <th>Rule</th>
              <th>Resolved</th>
              <th>Version</th>
            </tr>
          </thead>
          <tbody>
            {composition.map((x) => (
              <tr className="border-t" key={x.id}>
                <td className="py-4 font-semibold">
                  {
                    x.furnishing_room_package_versions?.furnishing_room_packages
                      ?.name
                  }
                </td>
                <td>
                  {x.composition_rule.kind} {x.composition_rule.value}
                </td>
                <td>{resolveComposition(x.composition_rule, facts)}</td>
                <td>v{x.furnishing_room_package_versions?.version_number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Add approved room package</h2>
        <form
          action={addPropertyPackageRoomAction}
          className="mt-4 grid gap-3 md:grid-cols-4"
        >
          <input type="hidden" name="packageId" value={pkg.id} />
          <input type="hidden" name="versionId" value={version.id} />
          <select required name="roomVersionId" className={field}>
            <option value="">Room package</option>
            {rooms.map((x: Row) => (
              <option value={x.id} key={x.id}>
                {x.furnishing_room_packages?.name} v{x.version_number}
              </option>
            ))}
          </select>
          <select required name="quantityRuleId" className={field}>
            <option value="">Quantity rule</option>
            {rules.map((r: Row) => (
              <option value={r.id} key={r.id}>
                {r.multiplier} × {r.rule_type}
              </option>
            ))}
          </select>
          <select name="compositionKind" className={field}>
            <option value="fixed">Fixed</option>
            <option value="bedrooms_minus">Bedrooms minus</option>
            <option value="per_bathroom">Per bathroom</option>
          </select>
          <div className="flex gap-2">
            <input
              name="compositionValue"
              type="number"
              min="0"
              defaultValue="1"
              className={field}
            />
            <button className={button}>Add</button>
          </div>
        </form>
      </section>
    </main>
  );
}

export async function RequirementLibrary() {
  const data = await getPackageLibrary();
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Room Requirements"
        description="Stable room needs remain independent from changing products and retailer offers."
        current="packages"
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className={panel}>
          <ul className="divide-y">
            {data.requirements.map((r: Row) => (
              <li className="flex justify-between py-3 text-sm" key={r.id}>
                <span>
                  <strong>{r.name}</strong>
                  <small className="ml-2 text-stone-500">
                    {r.requirement_type.replaceAll("_", " ")}
                  </small>
                </span>
                <Badge value={r.lifecycle_status} />
              </li>
            ))}
          </ul>
        </section>
        <form
          action={createRoomRequirementAction}
          className={`${panel} space-y-3`}
        >
          <h2 className="text-lg font-semibold">New requirement</h2>
          <input
            required
            name="name"
            className={field}
            placeholder="Requirement name"
          />
          <select required name="categoryId" className={field}>
            <option value="">Category</option>
            {data.categories.map((x: Row) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select required name="roomType" className={field}>
            <option value="">Default room</option>
            {data.roomTypes.map((x: Row) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select name="requirementType" className={field}>
            {[
              "furnishing",
              "equipment",
              "linen",
              "amenity",
              "safety",
              "operational_supply",
              "consumable",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <textarea
            name="description"
            className={field}
            placeholder="Description"
          />
          <button className={button}>Create requirement</button>
        </form>
      </div>
    </main>
  );
}

export function PackageImportUpload() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Import Package Inventory"
        description="Convert one workbook room sheet into reviewed requirements, catalog matches, and explicit quantity rules."
        current="packages"
      />
      <form
        action={startPackageImportAction}
        className={`${panel} space-y-5 py-12 text-center`}
      >
        <label className="block font-semibold">
          Workbook
          <input
            required
            type="file"
            accept=".xlsx"
            name="file"
            className="mx-auto mt-3 block rounded-xl border p-3"
          />
        </label>
        <label className="mx-auto block max-w-sm text-left font-semibold">
          Source sheet
          <select name="sheet" className={`${field} mt-2`}>
            <option>Living Room</option>
            <option>Bedrooms</option>
            <option>Bathroom</option>
            <option>Kitchen</option>
          </select>
        </label>
        <p className="text-sm text-stone-500">
          Source formulas and totals are retained only as review evidence. They
          are never executed or stored as package quantities.
        </p>
        <button className={button}>Parse and map</button>
      </form>
    </main>
  );
}

export async function PackageImportReview({ importId }: { importId: string }) {
  const { catalogImport, items } = (await getPackageImport(importId)) as Row;
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Review Package Conversion"
        description={`${catalogImport.source_filename} · ${catalogImport.source_sheet} · ${items.length} requirements`}
        current="packages"
      />
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-stone-50">
              <tr>
                {[
                  "Source item",
                  "Requirement",
                  "Catalog product",
                  "Source quantity/formula",
                  "Proposed rule",
                  "Status",
                  "Notes",
                ].map((x) => (
                  <th className="p-4" key={x}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((x: Row) => (
                <tr className="border-t" key={x.id}>
                  <td className="p-4 font-semibold">{x.source_item}</td>
                  <td>
                    {x.furnishing_room_requirements?.name ?? "Create new"}
                  </td>
                  <td>{x.furnishing_products?.name ?? "Unmapped"}</td>
                  <td>{x.source_quantity || "Not explicit"}</td>
                  <td>
                    {x.furnishing_quantity_rules
                      ? `${x.furnishing_quantity_rules.multiplier} × ${x.furnishing_quantity_rules.rule_type.replaceAll("_", " ")}`
                      : "Review required"}
                  </td>
                  <td>
                    <Badge value={x.review_status} />
                  </td>
                  <td className="text-amber-700">{x.notes?.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form
        action={completePackageImportAction}
        className={`${panel} flex flex-wrap items-end justify-between gap-4`}
      >
        <input type="hidden" name="importId" value={catalogImport.id} />
        <label className="font-semibold">
          Draft package name
          <input
            required
            name="name"
            defaultValue={`Imported ${catalogImport.source_sheet}`}
            className={`${field} mt-2 min-w-80`}
          />
        </label>
        <button className={button}>Create reviewed draft package</button>
      </form>
    </main>
  );
}
