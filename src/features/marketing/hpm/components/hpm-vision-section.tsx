import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

export function HpmVisionSection() {
  const { vision } =
    HPM_PAGE_CONTENT;

  return (
    <section
      id="vision"
      className="border-b border-white/10 bg-[#171412] py-24 text-white sm:py-32"
    >
      <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#c6a56d]">
              {vision.eyebrow}
            </p>

            <h2 className="mt-6 max-w-4xl font-serif text-4xl leading-[1.02] sm:text-6xl">
              {vision.title}
            </h2>

            <p className="mt-7 max-w-2xl text-base leading-8 text-white/55">
              {vision.description}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#201d1a] p-8 sm:p-10">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[#c6a56d]/20" />

            <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-[#c6a56d]">
              Product principles
            </p>

            <ul className="relative mt-7 space-y-5">
              {vision.principles.map(
                (principle) => (
                  <li
                    key={principle}
                    className="flex gap-4 text-sm leading-7 text-white/65"
                  >
                    <span className="mt-1 text-[#c6a56d]">
                      ✓
                    </span>

                    {principle}
                  </li>
                ),
              )}
            </ul>

            <blockquote className="relative mt-9 border-t border-white/10 pt-7 font-serif text-4xl italic leading-tight text-white">
              Intelligence expires.
              <span className="block text-[#c6a56d]">
                Actions compound.
              </span>
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}
