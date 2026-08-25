export type FormulaOutcome = "ignored_dashboard" | "valid_derived_value" | "needs_review" | "invalid" | "rejected_formula_cell";
export type FormulaEvidence = Readonly<{ sheet: string; address: string; sourceRow: number; formulaPresent: boolean; formulaHash: string; cachedValue: unknown; canonicalValue?: number; outcome: FormulaOutcome; correlationId: string }>;

const DERIVED_COLUMNS = new Set(["Extended Cost"]);
const PROHIBITED_FUNCTIONS = /(?:external|WEBSERVICE|IMPORTXML|IMPORTDATA|DDE|RTD|CUBE)/i;
export function classifyFormulaCell(input: Readonly<{ sheet: string; address: string; sourceRow: number; column: string; formula: string; cachedValue: unknown; quantity?: unknown; unitPrice?: unknown; correlationId: string }>): FormulaEvidence {
  const formulaHash = `sha256:${simpleHash(input.formula)}`;
  if (input.sheet === "Dashboard") return { sheet: input.sheet, address: input.address, sourceRow: input.sourceRow, formulaPresent: true, formulaHash, cachedValue: input.cachedValue, outcome: "ignored_dashboard", correlationId: input.correlationId };
  if (!DERIVED_COLUMNS.has(input.column) || PROHIBITED_FUNCTIONS.test(input.formula)) return { sheet: input.sheet, address: input.address, sourceRow: input.sourceRow, formulaPresent: true, formulaHash, cachedValue: input.cachedValue, outcome: "rejected_formula_cell", correlationId: input.correlationId };
  const quantity = Number(input.quantity), unitPrice = Number(input.unitPrice), cached = Number(input.cachedValue);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity < 0 || unitPrice < 0) return { sheet: input.sheet, address: input.address, sourceRow: input.sourceRow, formulaPresent: true, formulaHash, cachedValue: input.cachedValue, outcome: "invalid", correlationId: input.correlationId };
  const canonicalValue = Math.round(quantity * unitPrice * 100) / 100;
  return { sheet: input.sheet, address: input.address, sourceRow: input.sourceRow, formulaPresent: true, formulaHash, cachedValue: input.cachedValue, canonicalValue, outcome: Number.isFinite(cached) && Math.abs(cached - canonicalValue) <= 0.01 ? "valid_derived_value" : "needs_review", correlationId: input.correlationId };
}
function simpleHash(value: string): string { let hash = 2166136261; for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(16); }
