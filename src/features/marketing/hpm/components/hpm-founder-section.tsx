import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

export function HpmFounderSection() {
  const { founder } =
    HPM_PAGE_CONTENT;

  return (
    <section
      id="about"
      className="border-b border-[#d8cebf] bg-[#f3eee5] py-24 sm:py-32"
    >
      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#b28c51]">
            {founder.eyebrow}
          </p>

          <div className="mt-8 flex h-20 w-20 items-center justify-center rounded-full border border-[#c6a56d]/45 bg-[#fbf8f2] font-serif text-3xl text-[#a47d43]">
            TL
          </div>
        </div>

        <div>
          <h2 className="max-w-4xl font-serif text-4xl leading-[1.04] sm:text-6xl">
            {founder.title}
          </h2>

          <div className="mt-9 space-y-6">
            {founder.paragraphs.map(
              (paragraph) => (
                <p
                  key={paragraph}
                  className="max-w-3xl text-base leading-8 text-[#665c51]"
                >
                  {paragraph}
                </p>
              ),
            )}
          </div>

          <div className="mt-10 border-t border-[#d8cebf] pt-7">
            <p className="font-serif text-2xl italic text-[#171412]">
              {founder.signature}
            </p>

            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#9a7a4a]">
              {founder.role}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
