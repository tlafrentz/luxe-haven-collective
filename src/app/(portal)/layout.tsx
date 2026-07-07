import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/session";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/properties", label: "Properties" },
  { href: "/bookings", label: "Bookings" },
  { href: "/messages", label: "Messages" }
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  return (
    <div className="min-h-screen bg-muted/25">
      <aside className="fixed hidden h-full w-72 border-r border-border bg-card p-8 md:block">
        <Link href="/" className="text-lg font-semibold tracking-[0.24em] uppercase">Luxe Haven</Link>
        <p className="mt-4 text-sm text-muted-foreground">{profile?.full_name ?? profile?.email ?? "Portal user"}</p>
        <nav className="mt-10 grid gap-2">
          {links.map((link) => <Link className="rounded-2xl px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground" key={link.href} href={link.href}>{link.label}</Link>)}
          {profile?.role === "admin" && <Link className="rounded-2xl px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground" href="/admin">Admin</Link>}
        </nav>
        <form action={signOutAction} className="absolute bottom-8 left-8 right-8">
          <button className="w-full rounded-2xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted/50">Sign out</button>
        </form>
      </aside>
      <main className="md:pl-72"><div className="container-shell py-10">{children}</div></main>
    </div>
  );
}
