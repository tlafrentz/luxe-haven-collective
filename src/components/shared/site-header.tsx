import Link from "next/link";

const nav = [
  { href: "/stays", label: "Stays" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Partner" },
  { href: "/dashboard", label: "Owner Portal" }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="container-shell flex h-20 items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-[0.28em] uppercase">Luxe Haven</Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {nav.map((item) => <Link key={item.href} href={item.href} className="hover:text-foreground">{item.label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
