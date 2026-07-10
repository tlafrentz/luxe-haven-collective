import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { getSessionProfile } from "@/lib/auth/session";

const nav = [
  { href: "/stays", label: "Stays" },
  { href: "/services", label: "Services" },
  { href: "/owners", label: "Owners" },
  { href: "/notary", label: "Notary" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export async function SiteHeader() {
  const { user, profile } = await getSessionProfile();
  const portalHref = profile?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="container-shell flex min-h-20 items-center justify-between gap-5">
        <Link
          href="/"
          className="shrink-0 text-base font-semibold uppercase tracking-[0.24em] md:text-lg"
        >
          Luxe Haven
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-muted-foreground xl:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link
                href={portalHref}
                className="rounded-full border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted/50"
              >
                Portal
              </Link>

              <form action={signOutAction}>
                <button className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted/50"
              >
                Sign in
              </Link>

              <Link
                href="/contact"
                className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Start a Conversation
              </Link>
            </>
          )}
        </div>

        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-full border border-border px-4 py-2 text-sm font-semibold">
            Menu
          </summary>

          <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border bg-background p-4 shadow-2xl">
            <nav className="grid gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-4 border-t border-border pt-4">
              {user ? (
                <div className="grid gap-2">
                  <Link
                    href={portalHref}
                    className="rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold"
                  >
                    Portal
                  </Link>

                  <form action={signOutAction}>
                    <button className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Link
                    href="/login"
                    className="rounded-full border border-border px-4 py-2.5 text-center text-sm font-semibold"
                  >
                    Sign in
                  </Link>

                  <Link
                    href="/contact"
                    className="rounded-full bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
                  >
                    Start a Conversation
                  </Link>
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
