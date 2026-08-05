import Link from "next/link";
import { AdminGuidebookNavigation } from "@/components/guidebooks/admin-guidebook-navigation";

export default function GuidebookStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#fbfbfa] lg:grid lg:grid-cols-[234px_minmax(0,1fr)]">
      <aside className="border-b bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
        <Link
          href="/admin/guidebooks"
          className="flex items-center gap-3 px-5 py-6 font-semibold"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-900 text-xs font-bold text-white">
            LH
          </span>
          <span>Guidebook Studio</span>
        </Link>
        <AdminGuidebookNavigation />
        <div className="mx-4 mt-8 hidden rounded-2xl border bg-stone-50 p-4 text-xs text-stone-600 lg:block">
          <p className="font-semibold text-stone-900">Need help?</p>
          <p className="mt-2 leading-5">
            Visit our Help Center or contact support.
          </p>
          <Link
            href="/contact"
            className="mt-3 inline-flex font-semibold text-emerald-800"
          >
            Go to Help Center →
          </Link>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
