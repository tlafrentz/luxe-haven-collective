import Link from "next/link";

import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

export function HpmPartnersSection() {
  const { partners } =
    HPM_PAGE_CONTENT;

  return (
    <section
      id="partners"
      className="border-b border-white/10 bg-[#11100f] py-24 text-white sm:py-32"
    >
      <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#c6a56d]">
              {partners.eyebrow}
            </p>

            <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.02] sm:text-6xl">
              {partners.title}
            </h2>

            <p className="mt-7 max-w-2xl text-base leading-8 text-white/55">
              {partners.description}
            </p>

            <Link
              href={partners.action.href}
              className="mt-9 inline-flex rounded-full bg-[#c6a56d] px-7 py-3.5 text-sm font-semibold text-[#171412] transition hover:bg-[#d4b77f]"
            >
              {partners.action.label}
            </Link>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-[#201d1a] p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c6a56d]">
              Who we are looking for
            </p>

            <ul className="mt-7 space-y-4">
              {partners.idealPartner.map(
                (item) => (
                  <li
                    key={item}
                    className="flex gap-4 text-sm leading-7 text-white/65"
                  >
                    <span className="text-[#c6a56d]">
                      ✓
                    </span>

                    {item}
                  </li>
                ),
              )}
            </ul>
          </aside>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {partners.benefits.map(
            (benefit, index) => (
              <article
                key={benefit.title}
                className="rounded-[1.75rem] border border-[#c6a56d]/20 bg-white/[0.03] p-7"
              >
                <span className="text-xs font-semibold text-[#c6a56d]">
                  {String(index + 1).padStart(
                    2,
                    "0",
                  )}
                </span>

                <h3 className="mt-5 font-serif text-2xl">
                  {benefit.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-white/50">
                  {benefit.description}
                </p>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
