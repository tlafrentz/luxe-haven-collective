import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

export function HpmFaqSection() {
  const { faq } =
    HPM_PAGE_CONTENT;

  return (
    <section
      id="faq"
      className="border-b border-[#d8cebf] bg-[#fbf8f2] py-24 sm:py-32"
    >
      <div className="mx-auto w-[min(1180px,calc(100%-32px))]">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#b28c51]">
              {faq.eyebrow}
            </p>

            <h2 className="mt-6 max-w-xl font-serif text-4xl leading-[1.04] sm:text-6xl">
              {faq.title}
            </h2>
          </div>

          <div className="divide-y divide-[#d8cebf] border-y border-[#d8cebf]">
            {faq.items.map(
              (item) => (
                <details
                  key={item.question}
                  className="group py-6"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
                    <span className="font-serif text-2xl leading-tight text-[#171412]">
                      {item.question}
                    </span>

                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#c6a56d]/40 text-lg text-[#9a7a4a] transition group-open:rotate-45">
                      +
                    </span>
                  </summary>

                  <p className="mt-5 max-w-2xl pr-12 text-sm leading-7 text-[#766b5f]">
                    {item.answer}
                  </p>
                </details>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
