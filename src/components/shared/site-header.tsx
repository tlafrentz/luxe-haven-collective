import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { getSessionProfile } from "@/lib/auth/session";

const nav = [
  { href: "/stays", label: "Stays" },
  { href: "/services", label: "Services" },
  { href: "/owners", label: "Owners" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
];

export async function SiteHeader() {
  const { user, profile } = await getSessionProfile();
  const portalHref = profile?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="container-shell flex h-20 items-center justify-between gap-6">
        <Link href="/" className="text-base font-semibold tracking-[0.26em] uppercase md:text-lg">Luxe Haven</Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {nav.map((item) => <Link key={item.href} href={item.href} className="transition hover:text-foreground">{item.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link href={portalHref} className="rounded-full border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted/50">Portal</Link>
              <form action={signOutAction}><button className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">Sign out</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted/50">Sign in</Link>
              <Link href="/lead-magnet" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">Free STR Audit</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
