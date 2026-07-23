"use client";

import { useEffect, useId, useState } from "react";
import { normalizeNumericAssumptionDraft, parseNumericAssumptionDraft, type NumericAssumptionPolicy } from "../application/assumptions";

export function InvestmentNumericInput({ value, onCommit, policy, disabled = false, className = "", label }: Readonly<{ value: number; onCommit: (value: number) => void; policy: NumericAssumptionPolicy; disabled?: boolean; className?: string; label?: string }>) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string>();
  const errorId = useId();
  useEffect(() => setText(String(value)), [value]);
  const commit = () => { const result = normalizeNumericAssumptionDraft(text, policy); setError(result.error); if (result.status === "valid" && result.normalizedValue !== null) { setText(result.text); if (result.normalizedValue !== value) onCommit(result.normalizedValue); } };
  return <><input type="text" inputMode={policy.kind === "integer" ? "numeric" : "decimal"} value={text} disabled={disabled} aria-label={label} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => { const next = event.target.value; setText(next); const draft = parseNumericAssumptionDraft(next, policy); setError(draft.status === "invalid" ? draft.error : undefined); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.currentTarget.blur(); } }} className={className} />{error ? <span id={errorId} role="alert" className="mt-1.5 block text-xs text-rose-700">{error}</span> : null}</>;
}
