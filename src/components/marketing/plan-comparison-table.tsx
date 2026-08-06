import { Check, Minus } from "lucide-react";
import { comparisonRowLabels, plans, type ComparisonValue } from "@/lib/plans";

function Cell({ value }: { value: ComparisonValue }) {
  if (value === true) {
    return <Check aria-label="Included" className="mx-auto size-4 text-emerald-700" />;
  }
  if (value === false) {
    return <Minus aria-label="Not included" className="mx-auto size-4 text-stone-300" />;
  }
  return <span className="text-sm text-stone-700">{value}</span>;
}

export function PlanComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#dce2dd] bg-white">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="sticky top-[76px] z-10 bg-white shadow-sm">
            <th className="border-b p-4 text-left font-semibold text-stone-500">
              Compare features
            </th>
            {plans.map((plan) => (
              <th
                key={plan.slug}
                scope="col"
                className="border-b p-4 text-center font-serif text-lg font-normal"
              >
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparisonRowLabels.map((row) => (
            <tr key={row.key} className="border-b last:border-0">
              <th scope="row" className="p-4 text-left font-medium text-stone-700">
                {row.label}
              </th>
              {plans.map((plan) => (
                <td key={plan.slug} className="p-4 text-center">
                  <Cell value={plan.comparisonRow[row.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
