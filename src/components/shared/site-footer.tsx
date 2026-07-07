import Link from "next/link";

const links = [
  ["Stays", "/stays"], ["Services", "/services"], ["Owners", "/owners"], ["FAQ", "/faq"], ["Contact", "/contact"]
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-[#171412] text-primary-foreground">
      <div className="container-shell grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="text-lg font-semibold uppercase tracking-[0.28em]">Luxe Haven</p>
          <p className="mt-4 max-w-md text-sm leading-7 text-primary-foreground/70">Boutique short-term rental hospitality, direct-booking experiences, and owner performance systems for premium homes.</p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Explore</p>
          <div className="mt-4 grid gap-3 text-sm text-primary-foreground/70">
            {links.map(([label, href]) => <Link key={href} href={href} className="hover:text-primary-foreground">{label}</Link>)}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">For Owners</p>
          <p className="mt-4 text-sm leading-7 text-primary-foreground/70">Download the owner revenue checklist and see where your property may be leaving money, reviews, or repeat stays on the table.</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-6"><div className="container-shell text-xs text-primary-foreground/50">© {new Date().getFullYear()} Luxe Haven Collective. All rights reserved.</div></div>
    </footer>
  );
}
