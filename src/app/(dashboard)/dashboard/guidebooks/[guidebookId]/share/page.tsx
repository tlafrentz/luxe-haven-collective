import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";
import { GuidebookNavigation } from "@/components/guidebooks/guidebook-navigation";
import { CopyGuidebookLink } from "@/components/guidebooks/copy-guidebook-link";
import { ShareGuidebookLink } from "@/components/guidebooks/share-guidebook-link";
import { GuidebookInsufficientPermissions } from "@/components/guidebooks/guidebook-ui";

export default async function GuidebookSharePage({
  params,
}: Readonly<{ params: Promise<{ guidebookId: string }> }>) {
  const { guidebookId } = await params;
  const result = await getGuidebookEditorRequest(guidebookId);
  if (!result.ok) {
    if (result.code === "guidebook_not_found") notFound();
    return <GuidebookInsufficientPermissions />;
  }
  const path = `/stay/${result.guidebook.public_slug}`;
  const absoluteUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
  const available =
    result.guidebook.status === "published" &&
    result.guidebook.public_url_status === "active";
  return (
    <main className="mx-auto max-w-4xl space-y-6 py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-700">
          Guidebook Studio
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Share guidebook</h1>
        <p className="mt-2 text-stone-600">
          The stable guest link always resolves to the active immutable version.
        </p>
      </header>
      <GuidebookNavigation guidebookId={guidebookId} current="share" />
      <section className="rounded-3xl border bg-white p-7">
        <h2 className="font-semibold">Public guest link</h2>
        {available ? (
          <>
            <p className="mt-3 break-all rounded-xl bg-stone-50 p-4 font-mono text-sm">
              {absoluteUrl}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={path}
                className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white"
              >
                Open guest guide
              </a>
              <CopyGuidebookLink path={path} />
              <ShareGuidebookLink path={path} title={result.guidebook.title} />
              <a
                href={`/dashboard/guidebooks/${guidebookId}/share/qr`}
                download
                className="rounded-full border px-5 py-3 text-sm font-semibold"
              >
                Download QR
              </a>
              <a
                href={`/dashboard/guidebooks/${guidebookId}/share/qr`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border px-5 py-3 text-sm font-semibold"
              >
                Print QR
              </a>
              <Link
                href={`/dashboard/communications?property=${result.guidebook.property_id}&guidebookLink=${encodeURIComponent(path)}`}
                className="rounded-full border px-5 py-3 text-sm font-semibold"
              >
                Insert in guest communication
              </Link>
              <Link
                href={`/dashboard/guidebooks/${guidebookId}/settings`}
                className="rounded-full border px-5 py-3 text-sm font-semibold"
              >
                Edit Link
              </Link>
            </div>
            <div className="mt-5 rounded-2xl border bg-white p-4">
              <Image
                src={`/dashboard/guidebooks/${guidebookId}/share/qr`}
                width={192}
                height={192}
                alt={`QR code for ${path}`}
                className="h-48 w-48"
              />
              <p className="mt-3 text-sm text-stone-600">
                Scan to open the published guidebook. If scanning is
                unavailable, copy the link shown above.
              </p>
            </div>
            <p className="mt-4 text-sm text-stone-500">
              The QR contains only the stable public URL and a QR source marker.
              It contains no workspace, owner, guest, or credential data.
            </p>
          </>
        ) : null}
      </section>
      {available ? (
        <section className="rounded-3xl border bg-white p-7">
          <h2 className="font-semibold">Guest View (Mobile)</h2>
          <p className="mt-2 text-sm text-stone-600">
            This is how your guests will see it.
          </p>
          <div className="mx-auto mt-5 w-full max-w-[300px] overflow-hidden rounded-[2rem] border-8 border-stone-950 bg-stone-950 shadow-xl">
            <iframe
              src={path}
              title="Guest guidebook preview"
              className="aspect-[9/19] w-full rounded-[1.4rem] bg-white"
            />
          </div>
        </section>
      ) : null}
      {!available ? (
        <section className="rounded-3xl border bg-white p-7">
          <h2 className="font-semibold">Public guest link</h2>
          <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
            Publish the guidebook before sharing. Draft and archived guidebooks
            are unavailable publicly.
          </p>
        </section>
      ) : null}
    </main>
  );
}
