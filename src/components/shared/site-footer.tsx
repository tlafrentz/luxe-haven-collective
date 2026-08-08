import Link from "next/link";

const groups = [
  [
    "Solutions",
    [
      ["Improve Guest Experience", "/solutions/guest-experience"],
      ["Invest Better", "/solutions/investment"],
      ["Launch a Property", "/solutions/property-launch"],
      ["Operate Better", "/solutions/operations"],
    ],
  ],
  [
    "Platform",
    [
      ["Platform Overview", "/performance/overview"],
      ["Compare Plans", "/performance/plans"],
      ["Guidebook Studio", "/guidebook-studio"],
      ["Furnishing Studio", "/furnishing"],
      ["Investment Intelligence", "/dashboard/investments"],
    ],
  ],
  [
    "Resources",
    [
      ["Luxe Haven Press", "/resources"],
      ["Insights", "/resources/insights"],
      ["Playbooks", "/resources/playbooks"],
      ["Templates", "/resources/templates"],
      ["Market Reports", "/resources/market-reports"],
      ["FAQ", "/faq"],
    ],
  ],
  [
    "About",
    [
      ["About Us", "/about"],
      ["Our Approach", "/approach"],
      ["Contact", "/contact"],
    ],
  ],
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-white">
      <div className="container-shell grid gap-10 py-12 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(4,1fr)_1.15fr]">
        <div>
          <Link href="/" className="font-serif text-xl text-emerald-900">
            LH{" "}
            <span className="ml-2 text-xs font-sans font-bold uppercase tracking-[.15em]">
              Luxe Haven Collective
            </span>
          </Link>
          <p className="mt-5 max-w-sm text-xs leading-6 text-stone-600">
            Boutique hospitality, short-term rental performance systems, and
            professional Texas notary services—delivered with care,
            responsiveness, and modern design.
          </p>
          <div className="mt-5 flex gap-4 text-xs">
            <a href="https://www.facebook.com" target="_blank" rel="noreferrer">
              Facebook
            </a>
            <a
              href="https://www.instagram.com"
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
        {groups.map(([title, links]) => (
          <div key={title}>
            <p className="text-xs font-bold uppercase tracking-[.12em]">
              {title}
            </p>
            <div className="mt-4 grid gap-2.5">
              {links.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="text-xs text-stone-600 hover:text-emerald-800"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
        <div className="rounded-xl border p-5">
          <p className="text-xs font-bold uppercase tracking-[.12em]">
            For owners
          </p>
          <p className="mt-3 text-xs leading-5 text-stone-600">
            Discover where your property may be leaving revenue, reviews, or
            repeat stays on the table.
          </p>
          <Link
            href="/lead-magnet"
            className="mt-5 inline-flex text-xs font-semibold text-emerald-800"
          >
            Get the free checklist →
          </Link>
        </div>
      </div>
      <div className="border-t py-5">
        <div className="container-shell flex flex-wrap justify-between gap-3 text-[10px] text-stone-500">
          <p>
            © {new Date().getFullYear()} Luxe Haven Collective. All rights
            reserved.
          </p>
          <div className="flex gap-5">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/notary">Notary Disclaimer</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
