import type { Audience, QuizAnswers } from "../scoring";

const options: { value: Audience; label: string; copy: string }[] = [
  {
    value: "new-operator",
    label: "New operator",
    copy: "I'm setting up my first property or just getting started.",
  },
  {
    value: "existing-host",
    label: "Existing host",
    copy: "I'm already hosting and want a better system.",
  },
  {
    value: "portfolio",
    label: "Portfolio",
    copy: "I manage a portfolio of properties for myself or others.",
  },
  {
    value: "enterprise",
    label: "Enterprise",
    copy: "I run a management company or large multi-owner operation.",
  },
];

export function AboutYouStep({
  answers,
  onSelect,
}: {
  answers: QuizAnswers;
  onSelect: (audience: Audience) => void;
}) {
  return (
    <fieldset>
      <legend className="font-serif text-3xl">What best describes you?</legend>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-2xl border p-5 transition ${
              answers.audience === option.value
                ? "border-[#087251] bg-[#eff8f3] ring-2 ring-[#087251]/20"
                : "border-[#dce2dd] bg-white hover:border-[#8da098]"
            }`}
          >
            <input
              type="radio"
              name="audience"
              value={option.value}
              checked={answers.audience === option.value}
              onChange={() => onSelect(option.value)}
              className="sr-only"
            />
            <span className="font-semibold">{option.label}</span>
            <span className="mt-1 block text-sm leading-6 text-[#65706a]">
              {option.copy}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
