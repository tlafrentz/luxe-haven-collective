import Link from "next/link";
import { notFound } from "next/navigation";
import { getFurnishingStudio } from "@/app/actions/furnishing-studio";
import {
  Badge,
  FurnishingHeader,
  Money,
} from "@/components/furnishing/furnishing-navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ packageId: string; variantId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { packageId, variantId } = await params,
    tab = (await searchParams).tab ?? "overview",
    data = await getFurnishingStudio(),
    pkg = data.packages.find(
      (x: Record<string, unknown>) => x.id === packageId,
    ) as Record<string, unknown> | undefined,
    variant = data.variants.find(
      (x: Record<string, unknown>) =>
        x.id === variantId && x.package_id === packageId,
    ) as Record<string, unknown> | undefined;
  if (!pkg || !variant) notFound();
  const rooms = data.rooms.filter(
      (x: Record<string, unknown>) => x.variant_id === variantId,
    ),
    items = data.items.filter((x: Record<string, unknown>) =>
      rooms.some((r: Record<string, unknown>) => r.id === x.room_id),
    );
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title={`${String(pkg.name)} — ${String(variant.name)}`}
        description={String(pkg.description)}
        current="packages"
      />
      <nav className="text-sm">
        <Link href="/admin/furnishing">Furnishing Studio</Link> ›{" "}
        <Link href="/admin/furnishing/packages">Packages</Link> ›{" "}
        {String(pkg.name)} › {String(variant.name)}
      </nav>
      <div className="flex gap-3">
        <Badge value={String(pkg.status)} />
        <span className="text-sm capitalize text-stone-500">
          {String(pkg.style)} · {String(pkg.property_type)}
        </span>
      </div>
      <nav className="flex gap-6 border-b">
        {[
          "overview",
          "checklist",
          "gallery",
          "budget guide",
          "alternatives",
        ].map((x) => (
          <Link
            key={x}
            href={`?tab=${x.replace(" ", "-")}`}
            className={`border-b-2 py-3 text-sm font-semibold capitalize ${tab === x.replace(" ", "-") ? "border-emerald-700" : "border-transparent"}`}
          >
            {x}
          </Link>
        ))}
      </nav>
      {tab === "overview" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-4">
            <Card l="Items">{items.length}</Card>
            <Card l="Estimated budget">
              <Money value={variant.estimated_budget} />
            </Card>
            <Card l="Install time">
              {String(variant.estimated_install_days)} days
            </Card>
            <Card l="Guest capacity">
              {String(variant.guest_capacity ?? "—")}
            </Card>
          </section>
          <RoomList
            rooms={rooms}
            items={items}
            packageId={packageId}
            variantId={variantId}
          />
        </>
      ) : null}
      {tab === "checklist" ? (
        <RoomList
          rooms={rooms}
          items={items}
          packageId={packageId}
          variantId={variantId}
        />
      ) : null}
      {tab === "gallery" ? (
        <Empty text="No package gallery assets have been uploaded." />
      ) : null}
      {tab === "budget-guide" ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">Budget guide</h2>
          <p className="mt-3 text-3xl font-semibold">
            <Money value={variant.estimated_budget} />
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Estimate only; product price and availability require verification.
          </p>
        </section>
      ) : null}
      {tab === "alternatives" ? (
        <Empty text="Open an item to compare its governed product alternatives." />
      ) : null}
    </main>
  );
}
function RoomList({
  rooms,
  items,
  packageId,
  variantId,
}: {
  rooms: Record<string, unknown>[];
  items: Record<string, unknown>[];
  packageId: string;
  variantId: string;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[.35fr_1fr]">
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="font-semibold">Rooms</h2>
        {rooms.map((r) => (
          <a
            key={String(r.id)}
            href={`#room-${r.id}`}
            className="mt-2 block rounded-xl bg-stone-50 px-3 py-2 text-sm"
          >
            {String(r.name)}
          </a>
        ))}
      </div>
      <div className="space-y-4">
        {rooms.map((r) => (
          <section
            id={`room-${r.id}`}
            key={String(r.id)}
            className="rounded-2xl border bg-white p-5"
          >
            <h2 className="text-lg font-semibold">{String(r.name)}</h2>
            <div className="mt-4 divide-y">
              {items
                .filter((x) => x.room_id === r.id)
                .map((x) => (
                  <div
                    key={String(x.id)}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">{String(x.name)}</p>
                      <p className="text-xs capitalize text-stone-500">
                        {String(x.category)} ·{" "}
                        {x.required ? "Required" : "Optional"}
                      </p>
                    </div>
                    <Link
                      href={`/admin/furnishing/packages/${packageId}/variants/${variantId}/items/${x.id}`}
                      className="text-sm font-semibold text-emerald-800"
                    >
                      Select product
                    </Link>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
function Card({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <p className="text-xs font-bold uppercase text-stone-500">{l}</p>
      <p className="mt-3 text-2xl font-semibold">{children}</p>
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <section className="rounded-2xl border border-dashed bg-white p-12 text-center text-stone-500">
      {text}
    </section>
  );
}
