import {
  HPM_PAGE_CONTENT,
} from "../content/hpm-content";

export function HpmProblemSection() {
  const { problem } =
    HPM_PAGE_CONTENT;

  return (
    <section className="border-b border-[#d8cebf] bg-[#fbf8f2] py-24 sm:py-32">
      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#b28c51]">
            {problem.eyebrow}
          </p>

          <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[1.04] sm:text-6xl">
            {problem.title}
          </h2>

          <ul className="mt-9 space-y-4">
            {problem.questions.map(
              (question) => (
                <li
                  key={question}
                  className="flex gap-4 text-base leading-7 text-[#5f554a]"
                >
                  <span className="text-[#b28c51]">
                    ✓
                  </span>

                  {question}
                </li>
              ),
            )}
          </ul>
        </div>

        <aside className="rounded-[2rem] bg-[#171412] p-8 text-white shadow-2xl shadow-black/10 sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c6a56d]/40 font-serif text-2xl text-[#c6a56d]">
            ?
          </div>

          <p className="mt-8 text-sm text-white/45">
            The problem is not a lack of information.
          </p>

          <p className="mt-3 font-serif text-3xl italic leading-tight text-[#c6a56d] sm:text-4xl">
            It is a lack of direction.
          </p>
        </aside>
      </div>
    </section>
  );
}
