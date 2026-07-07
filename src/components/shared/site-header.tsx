import Link from "next/link";

const nav = [
  { href: "/stays", label: "Stays" },
  { href: "/services", label: "Services" },
  { href: "/owners", label: "Owners" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="container-shell flex h-20 items-center justify-between gap-6">
        <Link href="/" className="text-base font-semibold tracking-[0.26em] uppercase md:text-lg">Luxe Haven</Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {nav.map((item) => <Link key={item.href} href={item.href} className="transition hover:text-foreground">{item.label}</Link>)}
        </nav>
        <Link href="/lead-magnet" className="hidden rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 md:inline-flex">Free STR Audit</Link>
      </div>
    </header>
  );
}
