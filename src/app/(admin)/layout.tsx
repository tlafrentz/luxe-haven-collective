import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/session";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/properties", label: "Properties" },
  { href: "/admin/owners", label: "Owners" },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/integrations", label: "Integrations" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["admin"]);

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <aside className="fixed hidden h-full w-72 border-r border-white/10 bg-stone-950 p-8 md:block">
        <Link
          href="/"
          className="text-lg font-semibold uppercase tracking-[0.24em]"
        >
          Luxe Haven
        </Link>

        <p className="mt-4 text-sm text-white/50">
          Admin command center
        </p>

        <nav className="mt-10 grid gap-2">
          {links.map((link) => (
            <Link
              className="rounded-2xl px-4 py-3 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
              key={link.href}
              href={link.href}
            >
              {link.label}
            </Link>
          ))}

          <Link
            className="rounded-2xl px-4 py-3 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
            href="/dashboard"
          >
            Owner portal
          </Link>
        </nav>

        <form
          action={signOutAction}
          className="absolute bottom-8 left-8 right-8"
        >
          <button className="w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold transition hover:bg-white/10">
            Sign out
          </button>
        </form>
      </aside>

      <main className="md:pl-72">
        <div className="container-shell py-10">{children}</div>
      </main>
    </div>
  );
}
