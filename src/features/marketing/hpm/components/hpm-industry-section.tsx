import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

export function HpmIndustrySection() {
  const {
    industry,
    comparison,
    introduction,
  } = HPM_PAGE_CONTENT;

  return (
    <>
      <section
        id="why-hpm"
        className="border-b border-[#d8cebf] bg-[#f3eee5] py-24 sm:py-32"
      >
        <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
        <div className="grid gap-14 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#b28c51]">
                {industry.eyebrow}
              </p>

              <h2 className="mt-6 max-w-xl font-serif text-4xl leading-[1.04] sm:text-6xl">
                {industry.title}
              </h2>
            </div>

            <div className="lg:pt-10">
              <p className="max-w-3xl text-base leading-8 text-[#766b5f]">
                {industry.description}
              </p>

              <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-[#171412]">
                {industry.closing}
              </p>
            </div>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {industry.pillars.map(
              (pillar, index) => (
                <article
                  key={pillar.title}
                  className="rounded-[1.75rem] border border-[#d8cebf] bg-[#fbf8f2] p-7 shadow-sm"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c6a56d]/45 text-sm font-semibold text-[#a47d43]">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <h3 className="mt-6 font-serif text-2xl">
                    {pillar.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-[#766b5f]">
                    {pillar.description}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-[#d8cebf] bg-[#fbf8f2] py-24 sm:py-32">
        <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#b28c51]">
            {comparison.eyebrow}
          </p>

          <div className="mt-6 grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <h2 className="max-w-xl font-serif text-4xl leading-[1.04] sm:text-6xl">
              {comparison.title}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {[comparison.management, comparison.performance].map(
                (column, index) => (
                  <article
                    key={column.title}
                    className={
                      index === 0
                        ? "rounded-[1.75rem] border border-[#d8cebf] bg-white p-7"
                        : "rounded-[1.75rem] border border-[#171412] bg-[#171412] p-7 text-white"
                    }
                  >
                    <p
                      className={
                        index === 0
                          ? "text-xs font-semibold uppercase tracking-[0.18em] text-[#766b5f]"
                          : "text-xs font-semibold uppercase tracking-[0.18em] text-[#c6a56d]"
                      }
                    >
                      {column.title}
                    </p>

                    <ul className="mt-6 space-y-4">
                      {column.items.map(
                        (item) => (
                          <li
                            key={item}
                            className="flex gap-3 text-sm leading-6"
                          >
                            <span className="text-[#c6a56d]">
                              ✓
                            </span>

                            <span
                              className={
                                index === 0
                                  ? "text-[#5f554a]"
                                  : "text-white/65"
                              }
                            >
                              {item}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </article>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#171412] py-24 text-white sm:py-32">
        <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#c6a56d]">
              {introduction.eyebrow}
            </p>

            <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.02] sm:text-6xl">
              {introduction.title}
            </h2>

            <p className="mt-7 max-w-3xl text-base leading-8 text-white/55">
              {introduction.description}
            </p>
          </div>

          <aside className="rounded-[2rem] border border-[#c6a56d]/25 bg-[#201d1a] p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c6a56d]">
              It is not another dashboard.
            </p>

            <blockquote className="mt-6 font-serif text-3xl leading-tight text-white sm:text-4xl">
              {introduction.promise}
            </blockquote>
          </aside>
        </div>
      </section>
    </>
  );
}
