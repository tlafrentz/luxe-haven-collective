import type { PropertyCount, QuizAnswers } from "../scoring";

const options: { value: PropertyCount; label: string }[] = [
  { value: "1", label: "1 property" },
  { value: "2-5", label: "2–5 properties" },
  { value: "6-20", label: "6–20 properties" },
  { value: "20+", label: "20+ properties" },
];

export function BusinessStep({
  answers,
  onSelect,
}: {
  answers: QuizAnswers;
  onSelect: (propertyCount: PropertyCount) => void;
}) {
  return (
    <fieldset>
      <legend className="font-serif text-3xl">
        How many properties do you manage?
      </legend>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-2xl border p-5 text-center transition ${
              answers.propertyCount === option.value
                ? "border-[#087251] bg-[#eff8f3] ring-2 ring-[#087251]/20"
                : "border-[#dce2dd] bg-white hover:border-[#8da098]"
            }`}
          >
            <input
              type="radio"
              name="propertyCount"
              value={option.value}
              checked={answers.propertyCount === option.value}
              onChange={() => onSelect(option.value)}
              className="sr-only"
            />
            <span className="font-semibold">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
