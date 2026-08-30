import Link from "next/link";
import {
  addFsux4ItemAction,
  addFsux4AlternativeAction,
  addFsux4RoomAction,
  adoptFsux4TemplateAction,
  createFsux4PackageAction,
  getFsux4LegacyPackages,
  getFsux4Package,
  getFsux4PackageLibrary,
  retireFsux4PackageAction,
  reviewFsux4PackageAction,
  reviseFsux4PackageAction,
  submitFsux4PackageAction,
  validateFsux4PackageAction,
} from "@/app/actions/fsux4-room-packages";
import { Badge, FurnishingHeader } from "./furnishing-navigation";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const panel = "rounded-2xl border border-stone-200 bg-white p-5";
const field = "mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const money = (minor: unknown, currency = "USD") =>
  typeof minor === "number"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100)
    : "Price unavailable";
const versions = (pkg: Row) => (pkg.furnishing_package_versions ?? []) as Row[];
const currentVersion = (pkg: Row) => versions(pkg).find((v) => v.id === pkg.current_version_id) ?? versions(pkg).sort((a, b) => b.version_number - a.version_number)[0];
const total = (version: Row) => ((version?.fsux4_package_items ?? []) as Row[]).reduce((sum, item) => item.budget_treatment === "included" ? sum + Number(item.unit_price_minor ?? 0) * Number(item.quantity) : sum, 0);

export async function RoomPackageLibraryV2({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const { packages } = await getFsux4PackageLibrary();
  const view = query.view ?? "workspace";
  const search = (query.q ?? "").toLowerCase();
  const shown = packages.filter((pkg: Row) => {
    if (search && !`${pkg.name} ${pkg.style} ${pkg.property_type}`.toLowerCase().includes(search)) return false;
    if (view === "platform") return pkg.governance_scope === "platform";
    if (view === "review") return pkg.lifecycle_status === "in_review";
    if (view === "approved") return pkg.lifecycle_status === "approved";
    if (view === "retired") return pkg.lifecycle_status === "retired";
    return pkg.governance_scope === "workspace" && pkg.lifecycle_status !== "retired";
  });
  return <main className="mx-auto max-w-[1480px] space-y-6 px-4 py-6 sm:px-6">
    <FurnishingHeader title="Room Packages" description="Create, validate, review, and version reusable furnishing plans without creating procurement or customer commitments." current="room-packages" action={<Link href="/admin/furnishing/room-packages/new" className={primary}>Create package</Link>} />
    <nav aria-label="Package views" className="flex flex-wrap gap-2">
      {[["workspace","Workspace Packages"],["platform","Platform Templates"],["review","Needs Review"],["approved","Approved"],["retired","Retired"]].map(([key,label]) => <Link aria-current={view === key ? "page" : undefined} className={`${secondary} ${view === key ? "border-emerald-800 bg-emerald-50 text-emerald-900" : ""}`} href={`?view=${key}`} key={key}>{label}</Link>)}
      <Link className={secondary} href="/admin/furnishing/room-packages/legacy">Legacy governance</Link>
    </nav>
    <form role="search" className="max-w-xl"><label className="font-medium">Search packages<input className={field} name="q" defaultValue={query.q} placeholder="Name, design direction, or property type" /></label><input type="hidden" name="view" value={view} /></form>
    {shown.length ? <section aria-label="Room package results" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((pkg: Row) => { const version = currentVersion(pkg); return <Link className={`${panel} transition hover:border-emerald-300 hover:shadow-sm`} href={`/admin/furnishing/room-packages/${pkg.id}`} key={pkg.id}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{pkg.governance_scope === "platform" ? "Platform template" : "Workspace package"}</p><h2 className="mt-1 text-lg font-semibold">{pkg.name}</h2></div><Badge value={pkg.lifecycle_status} /></div>
      <p className="mt-2 text-sm text-stone-600">{pkg.style} · {pkg.property_type} · up to {version?.guest_max ?? "—"} guests</p>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-stone-500">Rooms</dt><dd className="font-semibold">{version?.fsux4_package_rooms?.length ?? 0}</dd></div><div><dt className="text-stone-500">Products</dt><dd className="font-semibold">{version?.fsux4_package_items?.length ?? 0}</dd></div><div><dt className="text-stone-500">Estimate</dt><dd className="font-semibold">{money(total(version), version?.currency)}</dd></div></dl>
    </Link>; })}</section> : <section className={`${panel} py-14 text-center`}><h2 className="text-xl font-semibold">No packages match this view</h2><p className="mt-2 text-stone-600">Create a workspace package or choose another governed view.</p><Link className={`${primary} mt-5`} href="/admin/furnishing/room-packages/new">Create package</Link></section>}
  </main>;
}

export function NewRoomPackageV2() {
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6"><FurnishingHeader title="Create room package" description="Start a governed draft from scratch. Platform template authority remains separate from workspace creation." current="room-packages" />
    <form action={createFsux4PackageAction} className={`${panel} grid gap-5 sm:grid-cols-2`}>
      <label className="font-medium sm:col-span-2">Package name *<input required name="name" className={field} /></label>
      <label className="font-medium">Scope *<select name="scope" className={field}><option value="workspace">Workspace package</option><option value="platform">Platform template</option></select></label>
      <label className="font-medium">Property type *<input required name="propertyType" className={field} placeholder="House" /></label>
      <label className="font-medium">Design direction *<input required name="designDirection" className={field} placeholder="Warm modern" /></label>
      <label className="font-medium">Quality tier<select name="qualityTier" className={field}><option>essential</option><option>elevated</option><option>luxury</option><option>custom</option></select></label>
      <label className="font-medium">Bedrooms<input required min="0" type="number" name="bedrooms" className={field} /></label><label className="font-medium">Bathrooms<input required min="0" type="number" name="bathrooms" className={field} /></label>
      <label className="font-medium">Maximum guests<input required min="1" type="number" name="maximumGuests" className={field} /></label><label className="font-medium">Currency<input required name="currency" defaultValue="USD" maxLength={3} className={field} /></label>
      <label className="font-medium">Target minimum<input min="0" step="0.01" type="number" name="targetMin" className={field} /></label><label className="font-medium">Target maximum<input min="0" step="0.01" type="number" name="targetMax" className={field} /></label>
      <label className="font-medium sm:col-span-2">Budget basis<select name="budgetBasis" className={field}><option value="products_only">Products only</option><option value="products_delivery">Products and delivery</option><option value="products_delivery_assembly">Products, delivery, and assembly</option><option value="installed_cost">Complete installed cost</option></select></label>
      <label className="font-medium sm:col-span-2">Description<textarea rows={4} name="description" className={field} /></label><div className="sm:col-span-2 flex justify-end"><button className={primary}>Create draft</button></div>
    </form></main>;
}

function VersionNav({ packageId, version }: { packageId: string; version: Row }) {
  return <nav aria-label="Package workspace" className="flex flex-wrap gap-2"><Link className={secondary} href={`/admin/furnishing/room-packages/${packageId}`}>Summary</Link><Link className={secondary} href={`/admin/furnishing/room-packages/${packageId}/edit`}>Compose</Link><Link className={secondary} href={`/admin/furnishing/room-packages/${packageId}/validation`}>Validation</Link><Link className={secondary} href={`/admin/furnishing/room-packages/${packageId}/review`}>Review</Link><Link className={secondary} href={`/admin/furnishing/room-packages/${packageId}/versions/${version.id}`}>Version {version.version_number}</Link></nav>;
}

export async function RoomPackageDetailV2({ packageId, mode = "detail", versionId }: { packageId: string; mode?: "detail"|"edit"|"validation"|"review"|"version"; versionId?: string }) {
  const { pkg, products } = await getFsux4Package(packageId) as { pkg: Row; products: Row[] };
  const version = versionId ? versions(pkg).find((item) => item.id === versionId) : currentVersion(pkg);
  if (!version) throw new Error("ROOM_PACKAGE_VERSION_NOT_FOUND");
  const rooms = (version.fsux4_package_rooms ?? []) as Row[];
  const items = (version.fsux4_package_items ?? []) as Row[];
  const editable = ["draft","changes_requested"].includes(version.lifecycle_status);
  const validation = [...((version.fsux4_package_validation_runs ?? []) as Row[])].sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  return <main className="mx-auto max-w-[1480px] space-y-6 px-4 py-6 sm:px-6">
    <FurnishingHeader title={pkg.name} description={`${pkg.governance_scope === "platform" ? "Platform template" : "Workspace package"} · Version ${version.version_number}. Approved versions remain immutable.`} current="room-packages" action={<Badge value={version.lifecycle_status} />} />
    <VersionNav packageId={packageId} version={version} />
    {pkg.governance_scope === "platform" ? <aside className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><strong>Template boundary:</strong> platform products are recommendations only. Creating a workspace package never silently adopts catalog products.</aside> : null}
    {mode === "edit" ? <PackageEditor pkg={pkg} version={version} rooms={rooms} items={items} products={products} editable={editable} /> : null}
    {mode === "validation" ? <ValidationView pkg={pkg} version={version} validation={validation} /> : null}
    {mode === "review" ? <ReviewView pkg={pkg} version={version} rooms={rooms} items={items} validation={validation} /> : null}
    {mode === "detail" || mode === "version" ? <PackageSummary pkg={pkg} version={version} rooms={rooms} items={items} historical={mode === "version"} /> : null}
  </main>;
}

function PackageSummary({ pkg, version, rooms, items, historical }: { pkg: Row; version: Row; rooms: Row[]; items: Row[]; historical: boolean }) {
  return <><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Rooms" value={rooms.length}/><Metric label="Products" value={items.length}/><Metric label="Maximum guests" value={version.guest_max ?? 0}/><Metric label="Product subtotal" value={money(total(version),version.currency)}/></section>
    <section className={panel}><h2 className="text-lg font-semibold">Package profile</h2><dl className="mt-4 grid gap-4 sm:grid-cols-3"><div><dt className="text-sm text-stone-500">Property</dt><dd>{pkg.property_type}</dd></div><div><dt className="text-sm text-stone-500">Design direction</dt><dd>{pkg.style}</dd></div><div><dt className="text-sm text-stone-500">Budget basis</dt><dd>{String(version.budget_basis).replaceAll("_"," ")}</dd></div></dl></section>
    <section className={panel}><h2 className="text-lg font-semibold">Room composition</h2><div className="mt-4 space-y-4">{rooms.map((room) => <article className="rounded-xl bg-stone-50 p-4" key={room.id}><div className="flex justify-between"><h3 className="font-semibold">{room.display_name}</h3><span className="text-sm text-stone-600">Sleeps {room.sleeping_capacity}</span></div><ul className="mt-3 space-y-2">{items.filter((item) => item.room_id === room.id).map((item) => <li className="flex justify-between gap-3 text-sm" key={item.id}><span>{item.furnishing_products?.name ?? "Unresolved product"} × {item.quantity} · {item.priority}</span><span>{money(item.unit_price_minor,item.currency)}</span></li>)}</ul></article>)}</div></section>
    {!historical && version.lifecycle_status === "approved" ? <div className="flex flex-wrap gap-3">{pkg.governance_scope === "platform" ? <form action={adoptFsux4TemplateAction}><Hidden pkg={pkg} version={version}/><button className={primary}>Create workspace draft</button></form> : <form action={reviseFsux4PackageAction}><Hidden pkg={pkg} version={version}/><input type="hidden" name="reason" value="Governed package revision"/><button className={primary}>Create revision</button></form>}<form action={retireFsux4PackageAction} className="flex gap-2"><Hidden pkg={pkg} version={version}/><input required name="reason" className={field} placeholder="Retirement reason"/><button className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white">Retire</button></form></div> : null}</>;
}

function PackageEditor({ pkg, version, rooms, items, products, editable }: { pkg: Row; version: Row; rooms: Row[]; items: Row[]; products: Row[]; editable: boolean }) {
  if (!editable) return <section className={panel}><h2 className="text-lg font-semibold">Editing locked</h2><p className="mt-2 text-stone-600">This version is {version.lifecycle_status}. Request changes or create a governed revision before editing.</p></section>;
  return <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
    <aside className={panel}><h2 className="font-semibold">Package outline</h2><ol className="mt-3 space-y-2">{rooms.map((room) => <li key={room.id}><a className="block min-h-11 rounded-lg px-3 py-2 hover:bg-stone-50" href={`#room-${room.id}`}>{room.display_name}</a></li>)}</ol>
      <form action={addFsux4RoomAction} className="mt-5 space-y-3"><Hidden pkg={pkg} version={version}/><label className="text-sm font-medium">Room name<input required name="displayName" className={field}/></label><label className="text-sm font-medium">Canonical type<select name="roomType" className={field}>{["whole_property","entry","living_room","dining_area","kitchen","primary_bedroom","guest_bedroom","bathroom","workspace","outdoor","laundry","safety","other"].map(type => <option key={type}>{type}</option>)}</select></label><label className="text-sm font-medium">Sleeping capacity<input name="sleepingCapacity" type="number" min="0" defaultValue="0" className={field}/></label><button className={secondary}>Add room</button></form>
    </aside>
    <section className="space-y-5">{rooms.map((room) => <article className={panel} id={`room-${room.id}`} key={room.id}><div className="flex justify-between"><div><h2 className="text-lg font-semibold">{room.display_name}</h2><p className="text-sm text-stone-500">{room.canonical_room_type.replaceAll("_"," ")} · sleeps {room.sleeping_capacity}</p></div><span className="text-sm">{room.is_required ? "Required room" : "Optional room"}</span></div>
      <div className="mt-4 space-y-2">{items.filter(item => item.room_id === room.id).map(item => <div className="rounded-xl bg-stone-50 p-3 text-sm" key={item.id}><strong>{item.furnishing_products?.name}</strong><p>{item.quantity} × {item.priority} · {money(item.unit_price_minor,item.currency)}</p>{item.placement_guidance ? <p className="text-stone-600">{item.placement_guidance}</p> : null}<p className="mt-1 text-xs text-stone-500">{item.fsux4_package_item_alternatives?.length ?? 0} governed alternatives (excluded from total)</p><form action={addFsux4AlternativeAction} className="mt-3 flex flex-wrap gap-2"><Hidden pkg={pkg} version={version}/><input type="hidden" name="itemId" value={item.id}/><select required aria-label={`Alternative for ${item.furnishing_products?.name}`} name="productId" className={field}><option value="">Add alternative</option>{products.filter(product => product.id !== item.product_id).map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select><input required name="reason" aria-label="Alternative reason" className={field} placeholder="Substitution reason"/><button className={secondary}>Add alternative</button></form></div>)}</div>
      <form action={addFsux4ItemAction} className="mt-5 grid gap-3 sm:grid-cols-2"><Hidden pkg={pkg} version={version}/><input type="hidden" name="roomId" value={room.id}/><label className="text-sm font-medium sm:col-span-2">Approved workspace product<select required name="productId" className={field}><option value="">Select product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} · {product.category}</option>)}</select></label><label className="text-sm font-medium">Quantity<input required type="number" min="1" step="1" name="quantity" defaultValue="1" className={field}/></label><label className="text-sm font-medium">Priority<select name="priority" className={field}><option value="essential">Essential</option><option value="recommended">Recommended</option><option value="optional">Optional</option></select></label><label className="text-sm font-medium">Item kind<select name="itemKind" className={field}>{["other","bed","seating","dining_seating","towel_set","television","mount"].map(kind => <option key={kind}>{kind}</option>)}</select></label><label className="text-sm font-medium">Unit price (minor units)<input type="number" min="0" name="unitPriceMinor" className={field}/></label><label className="text-sm font-medium sm:col-span-2">Placement guidance<input name="placementGuidance" className={field}/></label><div className="sm:col-span-2"><button className={secondary}>Add product</button></div></form>
    </article>)}</section>
    <aside className={`${panel} h-fit lg:sticky lg:top-6`}><h2 className="font-semibold">Package summary</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt>Product subtotal</dt><dd className="font-semibold">{money(total(version),version.currency)}</dd></div><div className="flex justify-between"><dt>Rooms</dt><dd>{rooms.length}</dd></div><div className="flex justify-between"><dt>Unresolved</dt><dd>{items.filter(item => !item.product_id).length}</dd></div></dl><form action={validateFsux4PackageAction} className="mt-5"><Hidden pkg={pkg} version={version}/><button className={`${secondary} w-full`}>Validate package</button></form><form action={submitFsux4PackageAction} className="mt-3"><Hidden pkg={pkg} version={version}/><button className={`${primary} w-full`}>Submit for review</button></form></aside>
  </div>;
}

function ValidationView({ pkg, version, validation }: { pkg: Row; version: Row; validation?: Row }) {
  const issues = (validation?.issues ?? []) as Row[];
  return <><section className="grid gap-4 sm:grid-cols-3"><Metric label="Blocking" value={validation?.blocking_count ?? 0}/><Metric label="Warnings" value={validation?.warning_count ?? 0}/><Metric label="Informational" value={validation?.informational_count ?? 0}/></section><section className={panel}><h2 className="text-lg font-semibold">Authoritative readiness</h2>{validation ? <><p className="mt-2">Status: <strong>{validation.status}</strong></p><ul className="mt-4 space-y-2">{issues.map((issue,index) => <li className="rounded-xl border border-stone-200 p-3" key={`${issue.code}-${index}`}><strong>{String(issue.severity)}</strong> — {String(issue.code).replaceAll("_"," ")}</li>)}</ul></> : <p className="mt-2 text-stone-600">No current validation. Editing invalidates prior results.</p>}<form action={validateFsux4PackageAction} className="mt-5"><Hidden pkg={pkg} version={version}/><button className={primary}>Run validation</button></form></section></>;
}

function ReviewView({ pkg, version, rooms, items, validation }: { pkg: Row; version: Row; rooms: Row[]; items: Row[]; validation?: Row }) {
  return <><PackageSummary pkg={pkg} version={version} rooms={rooms} items={items} historical /><section className={panel}><h2 className="text-lg font-semibold">Review decision</h2><p className="mt-2 text-sm text-stone-600">Validation: {validation?.status ?? "not available"}. Approval stores a complete immutable profile, room, product-version, price, capacity, warning, and lineage snapshot.</p>{version.lifecycle_status === "in_review" ? <form action={reviewFsux4PackageAction} className="mt-5 space-y-4"><Hidden pkg={pkg} version={version}/><label className="font-medium">Retained reason<textarea required minLength={3} name="reason" className={field}/></label><div className="flex flex-wrap gap-3"><button name="decision" value="approve" className={primary}>Approve package</button><button name="decision" value="request_changes" className={secondary}>Request changes</button></div></form> : <p className="mt-4 rounded-xl bg-stone-50 p-4">This version is not awaiting a review decision.</p>}</section></>;
}

export async function LegacyPackageGovernanceV2() { const rows = await getFsux4LegacyPackages(); return <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6"><FurnishingHeader title="Legacy package governance" description="Production-derived ambiguous records remain workspace-null, frozen, and excluded from active package workflows." current="room-packages"/><section className={panel}><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Package</th><th>ID</th><th>Classification</th><th>Workspace</th></tr></thead><tbody>{rows.map(row => <tr className="border-t" key={row.id}><td className="p-3 font-medium">{row.name}</td><td className="font-mono text-xs">{row.id}</td><td>Ambiguous legacy — frozen</td><td>None (preserved)</td></tr>)}</tbody></table></section></main>; }

function Hidden({ pkg, version }: { pkg: Row; version: Row }) { return <><input type="hidden" name="packageId" value={pkg.id}/><input type="hidden" name="versionId" value={version.id}/><input type="hidden" name="expectedVersion" value={version.optimistic_version}/></>; }
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className={panel}><p className="text-sm text-stone-500">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
