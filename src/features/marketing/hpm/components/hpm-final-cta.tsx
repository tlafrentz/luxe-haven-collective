import Link from "next/link";

import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

export function HpmFinalCta() {
  const { finalCta } =
    HPM_PAGE_CONTENT;

  return (
    <section className="bg-[#f3eee5] px-4 py-20 sm:py-28">
      <div className="mx-auto grid min-h-[300px] w-full max-w-[1180px] gap-10 rounded-[2rem] border border-[#d8cebf] bg-[#fbf8f2] p-8 shadow-xl shadow-black/5 sm:p-12 lg:grid-cols-[0.72fr_1.35fr_240px] lg:items-center">
        <p className="max-w-[250px] text-xs font-semibold uppercase leading-6 tracking-[0.22em] text-[#b28c51]">
          {finalCta.eyebrow}
        </p>

        <div>
          <h2 className="max-w-2xl font-serif text-3xl leading-[1.08] text-[#171412] sm:text-4xl">
            {finalCta.title}
          </h2>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#766b5f]">
            {finalCta.description}
          </p>
        </div>

        <div className="flex lg:justify-end">
          <Link
            href={finalCta.action.href}
            aria-label={finalCta.action.label}
            className="relative inline-flex min-h-14 w-full items-center justify-center whitespace-nowrap rounded-full bg-[#171412] px-7 py-4 text-center text-sm font-semibold text-[#fffdf9] transition hover:bg-[#2a241f] focus:outline-none focus:ring-2 focus:ring-[#b28c51] focus:ring-offset-2 focus:ring-offset-[#fbf8f2] lg:w-[240px]"
          >
            <span className="relative z-10 block text-[#fffdf9]">
              {finalCta.action.label}
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
