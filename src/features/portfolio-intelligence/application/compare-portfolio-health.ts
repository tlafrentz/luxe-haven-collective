import type { PortfolioHealthAssessment, PortfolioHealthBand, PortfolioHealthDimension, PortfolioHealthFindingReference } from "../domain";

export type PortfolioHealthDimensionChange = Readonly<{
  dimension: PortfolioHealthDimension;
  change: "improved" | "unchanged" | "declined" | "not-comparable";
  scoreDelta?: number;
}>;
export type PortfolioHealthChange = Readonly<{
  portfolioId: import("@/features/portfolio").PortfolioId;
  previousAssessmentId?: string;
  currentAssessmentId?: string;
  policyCompatible: boolean;
  overallChange: "improved" | "unchanged" | "declined" | "not-comparable";
  scoreDelta?: number;
  bandChange?: { from: PortfolioHealthBand; to: PortfolioHealthBand };
  dimensionChanges: readonly PortfolioHealthDimensionChange[];
  newFindings: readonly PortfolioHealthFindingReference[];
  resolvedFindings: readonly PortfolioHealthFindingReference[];
}>;

export function comparePortfolioHealth(previous: PortfolioHealthAssessment, current: PortfolioHealthAssessment): PortfolioHealthChange {
  if (!previous.portfolioId.equals(current.portfolioId)) throw new RangeError("Portfolio health assessments must belong to the same portfolio.");
  const policyCompatible = previous.policyVersion === current.policyVersion && windowsCompatible(previous.observationWindow, current.observationWindow);
  if (!policyCompatible) return Object.freeze({ portfolioId: current.portfolioId, policyCompatible: false, overallChange: "not-comparable", dimensionChanges: Object.freeze([]), newFindings: Object.freeze([]), resolvedFindings: Object.freeze([]) });
  const scoreDelta = round(current.overall.score.value - previous.overall.score.value);
  const previousDimensions = new Map(previous.dimensions.map((value) => [value.dimension, value]));
  const currentDimensions = new Map(current.dimensions.map((value) => [value.dimension, value]));
  const dimensions = [...new Set([...previousDimensions.keys(), ...currentDimensions.keys()])].sort();
  const dimensionChanges = dimensions.map((dimension) => {
    const before = previousDimensions.get(dimension), after = currentDimensions.get(dimension);
    if (!before || !after) return Object.freeze({ dimension, change: "not-comparable" as const });
    const delta = round(after.score.value - before.score.value);
    return Object.freeze({ dimension, change: direction(delta), scoreDelta: delta });
  });
  const beforeFindings = findingMap([...previous.strengths, ...previous.risks, ...previous.warnings]);
  const afterFindings = findingMap([...current.strengths, ...current.risks, ...current.warnings]);
  return Object.freeze({
    portfolioId: current.portfolioId,
    policyCompatible: true,
    overallChange: direction(scoreDelta),
    scoreDelta,
    ...(previous.overall.band !== current.overall.band ? { bandChange: Object.freeze({ from: previous.overall.band, to: current.overall.band }) } : {}),
    dimensionChanges: Object.freeze(dimensionChanges),
    newFindings: Object.freeze([...afterFindings.entries()].filter(([key]) => !beforeFindings.has(key)).map(([, value]) => value).sort(sortReference)),
    resolvedFindings: Object.freeze([...beforeFindings.entries()].filter(([key]) => !afterFindings.has(key)).map(([, value]) => value).sort(sortReference)),
  });
}
function findingMap(values: readonly import("../domain").PortfolioHealthFinding[]) {
  return new Map(values.map((value) => [`${value.code}\0${value.subjectId ?? ""}`, Object.freeze({ code: value.code, ...(value.subjectId ? { subjectId: value.subjectId } : {}) })]));
}
function direction(delta: number) { return delta > 0 ? "improved" as const : delta < 0 ? "declined" as const : "unchanged" as const; }
function windowsCompatible(a: PortfolioHealthAssessment["observationWindow"], b: PortfolioHealthAssessment["observationWindow"]) {
  return a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime();
}
function sortReference(a: PortfolioHealthFindingReference, b: PortfolioHealthFindingReference) { return a.code.localeCompare(b.code) || (a.subjectId ?? "").localeCompare(b.subjectId ?? ""); }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
