import { relative } from "node:path";
import { analyzeRepository, adoptionReport, architectureViolations, dependencyGraph, duplicateImports } from "./analyzer";

const command = process.argv[2] ?? "help";
const json = process.argv.includes("--json");
const analysis = analyzeRepository();

const outputs: Record<string, () => unknown> = {
  graph: () => dependencyGraph(analysis),
  duplicates: () => duplicateImports(analysis).map((value) => ({ ...value, file: relative(analysis.root, value.file) })),
  adoption: () => adoptionReport(analysis),
  features: () => adoptionReport(analysis).map(({ feature, files, platformPackages, featureDependencies }) => ({ feature, files, platformPackages, featureDependencies })),
  lint: () => architectureViolations(analysis),
};

if (command === "help" || !outputs[command]) {
  console.log("Usage: npm run migration:<graph|duplicates|adoption|features|lint> -- [--json]");
  process.exitCode = command === "help" ? 0 : 1;
} else {
  const result = outputs[command]();
  console.log(json ? JSON.stringify(result, null, 2) : render(command, result));
  if (command === "lint" && Array.isArray(result) && result.length > 0) process.exitCode = 1;
}

function render(name: string, result: unknown): string {
  const values = result as readonly Record<string, unknown>[];
  if (values.length === 0) return `${name}: no findings`;
  const keys = Object.keys(values[0]);
  const rows = values.map((value) => keys.map((key) => display(value[key])));
  const widths = keys.map((key, index) => Math.max(key.length, ...rows.map((row) => row[index].length)));
  return [keys.map((key, index) => key.padEnd(widths[index])).join("  "), ...rows.map((row) => row.map((cell, index) => cell.padEnd(widths[index])).join("  "))].join("\n");
}

function display(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") || "-" : String(value);
}

