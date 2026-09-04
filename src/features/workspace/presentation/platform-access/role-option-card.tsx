import { Check } from "lucide-react";

export type RoleOption = Readonly<{ id: string; label: string; description: string; bullets?: readonly string[] }>;

export function RoleOptionGrid({
  legend,
  options,
  selectedId,
  onSelect,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: Readonly<{
  legend: string;
  options: readonly RoleOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  columns?: string;
}>) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-stone-800">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className={`mt-3 grid gap-4 ${columns}`}>
        {options.map((option) => (
          <RoleOptionCard key={option.id} option={option} selected={option.id === selectedId} onSelect={() => onSelect(option.id)} />
        ))}
      </div>
    </fieldset>
  );
}

export function RoleOptionCard({ option, selected, onSelect }: Readonly<{ option: RoleOption; selected: boolean; onSelect: () => void }>) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`relative min-h-11 rounded-xl border p-5 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
        selected ? "border-stone-950 bg-stone-50 shadow-sm" : "border-stone-200 bg-white hover:border-stone-300"
      }`}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-stone-950 text-white">
          <Check className="h-3 w-3" />
        </span>
      ) : null}
      <span className="block font-semibold text-stone-950">{option.label}</span>
      <span className="mt-2 block text-sm leading-6 text-stone-600">{option.description}</span>
      {option.bullets?.length ? (
        <span className="mt-4 block space-y-1 text-xs text-stone-600">
          {option.bullets.map((item) => (
            <span key={item} className="block">
              •&nbsp; {item}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

/** Non-interactive variant for read-only role guidance (e.g. the Roles tab) — a clickless role="radio" would be an accessibility bug. */
export function RoleSummaryCard({ option }: Readonly<{ option: RoleOption }>) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="font-semibold text-stone-950">{option.label}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-600">{option.description}</p>
      {option.bullets?.length ? (
        <ul className="mt-4 space-y-1 text-sm text-stone-600">
          {option.bullets.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
