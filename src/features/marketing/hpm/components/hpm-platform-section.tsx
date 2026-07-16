import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

export function HpmPlatformSection() {
  const { platform } =
    HPM_PAGE_CONTENT;

  return (
    <section
      id="platform"
      className="border-b border-[#d8cebf] bg-[#f3eee5] py-24 sm:py-32"
    >
      <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
        <div className="grid gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#b28c51]">
              {platform.eyebrow}
            </p>

            <h2 className="mt-6 max-w-2xl font-serif text-4xl leading-[1.04] sm:text-6xl">
              {platform.title}
            </h2>

            <p className="mt-7 max-w-xl text-base leading-8 text-[#766b5f]">
              {platform.description}
            </p>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-[#d8cebf] bg-[#171412] p-5 shadow-2xl shadow-black/10 sm:p-7">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#201d1a] p-5 sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c6a56d]">
                    Luxe Haven
                  </p>

                  <p className="mt-2 text-sm font-medium text-white">
                    Executive Overview
                  </p>
                </div>

                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                  Live intelligence
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {platform.modules.map(
                  (module) => (
                    <article
                      key={module.label}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c6a56d]">
                        {module.label}
                      </p>

                      <p className="mt-4 font-serif text-2xl leading-tight text-white">
                        {module.value}
                      </p>
                    </article>
                  ),
                )}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Improvement loop
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/70">
                  {[
                    "See",
                    "Understand",
                    "Decide",
                    "Execute",
                    "Learn",
                  ].map(
                    (step, index) => (
                      <div
                        key={step}
                        className="flex items-center gap-2"
                      >
                        <span className="rounded-full border border-white/10 px-3 py-1.5">
                          {step}
                        </span>

                        {index < 4 ? (
                          <span className="text-[#c6a56d]">
                            →
                          </span>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {platform.capabilities.map(
            (capability, index) => (
              <article
                key={capability.title}
                className="rounded-[1.75rem] border border-[#d8cebf] bg-[#fbf8f2] p-7"
              >
                <span className="text-xs font-semibold text-[#b28c51]">
                  {String(index + 1).padStart(
                    2,
                    "0",
                  )}
                </span>

                <h3 className="mt-5 font-serif text-2xl">
                  {capability.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-[#766b5f]">
                  {capability.description}
                </p>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
