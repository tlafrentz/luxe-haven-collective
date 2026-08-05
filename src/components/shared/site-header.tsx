import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/session";
import { resourceLinks } from "@/components/marketing/resources-navigation";
import { platformLinks } from "@/lib/platform-journeys";
import { solutionLinks } from "@/lib/solution-journeys";

const nav = [
  { href: "/solutions", label: "Solutions" },
  { href: "/platform", label: "Platform" },
  { href: "/resources", label: "Resources" },
  { href: "/stays", label: "Properties" },
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteHeader() {
  const { user, profile } = await getSessionProfile();
  const portalHref = profile?.role === "admin" ? "/admin" : "/dashboard";
  return (
    <header className="sticky top-0 z-50 border-b border-[#dde1dd] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8">
        <Link
          href="/"
          aria-label="Luxe Haven Collective home"
          className="flex shrink-0 items-center gap-3 text-[#8d6b1d]"
        >
          <span className="font-serif text-3xl leading-none">LH</span>
          <span className="border-l border-[#d7c89d] pl-3 text-[10px] font-bold uppercase leading-[1.2] tracking-[0.13em]">
            Luxe Haven
            <br />
            Collective
          </span>
        </Link>
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-7 text-sm font-medium text-[#26342e] lg:flex"
        >
          {nav.map((item) =>
            item.label === "Resources" ||
            item.label === "Platform" ||
            item.label === "Solutions" ? (
              <details key={item.href} className="group relative">
                <summary className="cursor-pointer list-none transition hover:text-[#074e38]">
                  {item.label}⌄
                </summary>
                <div className="absolute left-1/2 top-8 w-56 -translate-x-1/2 rounded-xl border bg-white p-2 shadow-xl">
                  {(item.label === "Resources"
                    ? resourceLinks
                    : item.label === "Platform"
                      ? platformLinks
                      : solutionLinks
                  ).map(([label, href]) => (
                    <Link
                      key={href}
                      href={href}
                      className="block rounded-lg px-3 py-2.5 text-sm hover:bg-stone-50 hover:text-emerald-800"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </details>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="transition hover:text-[#074e38]"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {!user ? (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md border border-[#6f8b7f] px-5 text-sm font-semibold text-[#34423b] transition hover:bg-[#f1f5f2]"
            >
              Sign in
            </Link>
          ) : null}
          <Link
            href={user ? portalHref : "/get-started"}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#074e38] px-5 text-sm font-semibold text-white transition hover:bg-[#053d2c]"
          >
            {user ? "Open Portal" : "Talk with an Expert"}
            <ArrowUpRight aria-hidden size={15} />
          </Link>
        </div>
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded-md border border-[#aeb8b2] px-4 py-2 text-sm font-semibold text-[#17372c]">
            Menu
          </summary>
          <div className="absolute right-0 top-12 w-72 rounded-xl border border-[#d8ded9] bg-white p-3 shadow-2xl">
            <nav className="grid gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-sm text-[#4f5953] hover:bg-[#f1f5f2]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-2 border-t pt-2">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Solutions
              </p>
              {solutionLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="block rounded-lg px-3 py-2 text-xs text-stone-500 hover:bg-stone-50"
                >
                  {label}
                </Link>
              ))}
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Platform
              </p>
              {platformLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="block rounded-lg px-3 py-2 text-xs text-stone-500 hover:bg-stone-50"
                >
                  {label}
                </Link>
              ))}
              <p className="mt-2 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Resources
              </p>
              {resourceLinks.slice(1).map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="block rounded-lg px-3 py-2 text-xs text-stone-500 hover:bg-stone-50"
                >
                  {label}
                </Link>
              ))}
            </div>
            {!user ? (
              <Link
                href="/login"
                className="mt-2 flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[#34423b] hover:bg-[#f1f5f2]"
              >
                Sign in
              </Link>
            ) : null}
            <Link
              href={user ? portalHref : "/get-started"}
              className="mt-3 flex min-h-11 items-center justify-center rounded-md bg-[#074e38] px-4 text-sm font-semibold text-white"
            >
              {user ? "Open Portal" : "Get Started"}
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
