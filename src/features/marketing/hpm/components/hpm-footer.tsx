import Link from "next/link";

import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

const COMPANY_LINKS = [
  {
    label: "Why HPM",
    href: "#why-hpm",
  },
  {
    label: "The Platform",
    href: "#platform",
  },
  {
    label: "Our Vision",
    href: "#vision",
  },
  {
    label: "Founding Partners",
    href: "#partners",
  },
];

const EXPLORE_LINKS = [
  {
    label: "Luxe Haven Home",
    href: "/",
  },
  {
    label: "Resources",
    href: "/resources",
  },
  {
    label: "About",
    href: "#about",
  },
  {
    label: "FAQ",
    href: "#faq",
  },
];

export function HpmFooter() {
  const action =
    HPM_PAGE_CONTENT.hero.primaryAction;

  return (
    <footer className="border-t border-white/10 bg-[#11100f] text-white">
      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
        <div>
          <Link href="/">
            <span className="block text-base font-semibold uppercase tracking-[0.28em]">
              Luxe Haven
            </span>

            <span className="mt-1 block text-[9px] uppercase tracking-[0.28em] text-white/40">
              Hospitality Collective
            </span>
          </Link>

          <p className="mt-6 max-w-sm text-sm leading-7 text-white/45">
            The operating system for Hospitality Performance
            Management.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c6a56d]">
            HPM
          </p>

          <nav className="mt-5 grid gap-3 text-sm text-white/50">
            {COMPANY_LINKS.map(
              (item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="transition hover:text-white"
                >
                  {item.label}
                </a>
              ),
            )}
          </nav>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c6a56d]">
            Explore
          </p>

          <nav className="mt-5 grid gap-3 text-sm text-white/50">
            {EXPLORE_LINKS.map(
              (item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition hover:text-white"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c6a56d]">
            Let&apos;s start a conversation.
          </p>

          <p className="mt-5 text-sm leading-7 text-white/45">
            We would love to learn more about your hospitality
            business and your goals.
          </p>

          <Link
            href={action.href}
            className="mt-6 inline-flex rounded-full border border-[#c6a56d]/50 px-5 py-3 text-sm font-semibold text-[#ddc08b] transition hover:bg-[#c6a56d] hover:text-[#171412]"
          >
            {action.label}
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 py-6">
        <div className="mx-auto flex w-[min(1180px,calc(100%-32px))] flex-col gap-3 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Luxe Haven Collective.
            All rights reserved.
          </p>

          <div className="flex gap-5">
            <Link
              href="/privacy"
              className="hover:text-white"
            >
              Privacy Policy
            </Link>

            <Link
              href="/terms"
              className="hover:text-white"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
