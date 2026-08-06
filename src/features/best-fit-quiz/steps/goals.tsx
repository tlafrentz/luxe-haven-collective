import type { PrimaryGoal, QuizAnswers } from "../scoring";

const goalOptions: { value: PrimaryGoal; label: string }[] = [
  { value: "revenue", label: "Increase Revenue" },
  { value: "guest-experience", label: "Guest Experience" },
  { value: "investment", label: "Investment" },
  { value: "operations", label: "Operations" },
  { value: "growth", label: "Growth" },
];

const integrationOptions = ["Airbnb", "Vrbo", "Booking.com", "PMS / channel manager"];

export function GoalsStep({
  answers,
  onSelectGoal,
  onToggleIntegration,
}: {
  answers: QuizAnswers;
  onSelectGoal: (goal: PrimaryGoal) => void;
  onToggleIntegration: (integration: string) => void;
}) {
  const selectedIntegrations = answers.integrations ?? [];
  return (
    <div>
      <fieldset>
        <legend className="font-serif text-3xl">
          What&apos;s your primary goal?
        </legend>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {goalOptions.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-2xl border p-5 transition ${
                answers.primaryGoal === option.value
                  ? "border-[#087251] bg-[#eff8f3] ring-2 ring-[#087251]/20"
                  : "border-[#dce2dd] bg-white hover:border-[#8da098]"
              }`}
            >
              <input
                type="radio"
                name="primaryGoal"
                value={option.value}
                checked={answers.primaryGoal === option.value}
                onChange={() => onSelectGoal(option.value)}
                className="sr-only"
              />
              <span className="font-semibold">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-8">
        <legend className="text-sm font-bold uppercase tracking-[.14em] text-stone-500">
          Integrations (optional)
        </legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {integrationOptions.map((integration) => {
            const checked = selectedIntegrations.includes(integration);
            return (
              <label
                key={integration}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition ${
                  checked
                    ? "border-[#087251] bg-[#eff8f3] text-[#087251]"
                    : "border-[#dce2dd] bg-white text-stone-600 hover:border-[#8da098]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleIntegration(integration)}
                  className="sr-only"
                />
                {integration}
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
