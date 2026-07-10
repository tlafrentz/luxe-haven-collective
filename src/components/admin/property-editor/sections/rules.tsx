import type { Property } from "@/types/database";
import { lines } from "./shared";

type Props = {
  values: Partial<Property> & Record<string, unknown>;
};

export function RulesSection({ values }: Props) {
  return (
    <label className="grid gap-2 text-sm">
      Rules
      <textarea name="house_rules" defaultValue={lines(values.house_rules as string[])} className="input-dark min-h-40" />
    </label>
  );
}
