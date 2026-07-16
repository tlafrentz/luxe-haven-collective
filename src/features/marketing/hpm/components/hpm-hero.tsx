import Link from "next/link";

import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

function LocalNavigation() {
  return (
    <div className="border-b border-white/10">
      <div className="mx-auto flex min-h-20 w-[min(1380px,calc(100%-32px))] items-center justify-between gap-8">
        <Link
          href="/"
          className="shrink-0"
        >
          <span className="block text-sm font-semibold uppercase tracking-[0.28em] text-white sm:text-base">
            Luxe Haven
          </span>

          <span className="mt-1 hidden text-[9px] uppercase tracking-[0.28em] text-white/45 sm:block">
            Hospitality Collective
          </span>
        </Link>

        <nav
          aria-label="Hospitality Performance Management"
          className="hidden items-center gap-6 text-xs text-white/45 xl:flex"
        >
          {HPM_PAGE_CONTENT.navigation.map(
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

        <Link
          href={
            HPM_PAGE_CONTENT.hero
              .primaryAction.href
          }
          className="rounded-full border border-[#c6a56d]/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#ddc08b] transition hover:border-[#ddc08b] hover:bg-[#ddc08b] hover:text-[#171412]"
        >
          {
            HPM_PAGE_CONTENT.hero
              .primaryAction.label
          }
        </Link>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative min-h-[540px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#201d1a] lg:min-h-[680px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_20%,rgba(198,165,109,0.28),transparent_32%),radial-gradient(circle_at_25%_75%,rgba(255,255,255,0.08),transparent_35%),linear-gradient(145deg,#171412_0%,#29231d_48%,#12100f_100%)]" />

      <div className="absolute left-[10%] top-[14%] h-44 w-44 rounded-full border border-[#c6a56d]/25" />

      <div className="absolute right-[8%] top-[10%] h-72 w-72 rounded-full border border-white/10" />

      <div className="absolute bottom-[10%] left-[10%] right-[10%] rounded-[1.75rem] border border-white/10 bg-black/25 p-6 backdrop-blur-md sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c6a56d]">
          Hospitality Performance Management
        </p>

        <p className="mt-4 max-w-xl font-serif text-3xl leading-tight text-white sm:text-4xl">
          One system for seeing,
          understanding, deciding, executing,
          and learning.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {HPM_PAGE_CONTENT.executionLoop.map(
            (point) => (
              <div
                key={point.value}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-sm font-semibold text-white">
                  {point.value}
                </p>

                <p className="mt-2 text-xs leading-5 text-white/50">
                  {point.description}
                </p>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export function HpmHero() {
  const { hero } =
    HPM_PAGE_CONTENT;

  return (
    <section className="min-h-screen bg-[#171412] text-white">
      <LocalNavigation />

      <div className="mx-auto grid min-h-[calc(100vh-81px)] w-[min(1380px,calc(100%-32px))] gap-20 py-24 sm:py-32 lg:grid-cols-[minmax(0,0.94fr)_minmax(500px,1.06fr)] lg:items-center lg:gap-24 lg:py-40">
        <div>
          <p className="max-w-xl text-xs font-semibold uppercase tracking-[0.28em] text-[#c6a56d]">
            {hero.eyebrow}
          </p>

          <h1 className="mt-8 max-w-4xl font-serif text-5xl leading-[0.91] tracking-[-0.045em] sm:text-7xl lg:text-[6.35rem]">
            {hero.title}

            <span className="mt-3 block text-[#c6a56d]">
              {hero.highlightedTitle}
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
            {hero.description}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href={hero.primaryAction.href}
              className="rounded-full bg-[#c6a56d] px-7 py-3.5 text-center text-sm font-semibold text-[#171412] transition hover:bg-[#d4b77f]"
            >
              {hero.primaryAction.label}
            </Link>

            <a
              href={
                hero.secondaryAction.href
              }
              className="rounded-full border border-white/15 px-7 py-3.5 text-center text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.05]"
            >
              {
                hero.secondaryAction
                  .label
              }
            </a>
          </div>

          <div className="mt-14 border-t border-white/10 pt-8">
            <p className="max-w-xl text-sm leading-7 text-white/45">
              Built for independent short-term
              rental operators today, with a
              path toward boutique hotels,
              small hospitality brands, and
              growing portfolios.
            </p>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
