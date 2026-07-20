import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

export type AreaKind = "feature" | "platform" | "other";
export type Area = Readonly<{ kind: AreaKind; name: string }>;
export type ImportRecord = Readonly<{
  file: string;
  specifier: string;
  source: Area;
  target: Area;
  resolved?: string;
  symbols: readonly string[];
}>;
export type DependencyEdge = Readonly<{ from: string; to: string; count: number }>;
export type ArchitectureViolation = Readonly<{ rule: string; file: string; detail: string }>;

export type MigrationAnalysis = Readonly<{
  root: string;
  files: readonly string[];
  imports: readonly ImportRecord[];
  features: readonly string[];
  platformPackages: readonly string[];
}>;

const lifecycle = [
  "observations", "evidence", "claims", "evaluations", "recommendations", "decisions",
  "actions", "workflows", "automations", "outcomes", "intelligence", "learning",
] as const;

const foundationDependencies: Readonly<Record<string, readonly string[]>> = {
  kernel: [], scoring: ["kernel"], execution: ["kernel"],
};

export function analyzeRepository(root = process.cwd()): MigrationAnalysis {
  const sourceRoot = resolve(root, "src");
  const files = walk(sourceRoot).filter(isProductionSource);
  const features = directories(resolve(sourceRoot, "features"));
  const platformPackages = directories(resolve(sourceRoot, "platform"));
  const imports = files.flatMap((file) => parseImports(file, sourceRoot));
  return { root, files, imports, features, platformPackages };
}

export function dependencyGraph(analysis: MigrationAnalysis): readonly DependencyEdge[] {
  const counts = new Map<string, number>();
  for (const dependency of analysis.imports) {
    if (dependency.source.kind === "other" || dependency.target.kind === "other") continue;
    const from = label(dependency.source), to = label(dependency.target);
    if (from === to) continue;
    counts.set(`${from}\0${to}`, (counts.get(`${from}\0${to}`) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => {
    const [from, to] = key.split("\0");
    return { from, to, count };
  }).sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));
}

export function duplicateImports(analysis: MigrationAnalysis): readonly Readonly<{
  file: string; symbol: string; sources: readonly string[];
}>[] {
  const duplicates: Array<{ file: string; symbol: string; sources: readonly string[] }> = [];
  const byFile = new Map<string, ImportRecord[]>();
  for (const value of analysis.imports) byFile.set(value.file, [...(byFile.get(value.file) ?? []), value]);
  for (const [file, imports] of byFile) {
    const sourcesBySymbol = new Map<string, Set<string>>();
    for (const value of imports.filter((item) => item.target.kind !== "other")) {
      for (const symbol of value.symbols) {
        const sources = sourcesBySymbol.get(symbol) ?? new Set<string>();
        sources.add(value.specifier);
        sourcesBySymbol.set(symbol, sources);
      }
    }
    for (const [symbol, sources] of sourcesBySymbol) {
      if (sources.size > 1) duplicates.push({ file, symbol, sources: [...sources].sort() });
    }
  }
  return duplicates.sort((left, right) => left.file.localeCompare(right.file) || left.symbol.localeCompare(right.symbol));
}

export function adoptionReport(analysis: MigrationAnalysis) {
  const effective = effectivePlatformConsumers(analysis);
  return analysis.features.map((feature) => {
    const featureFiles = analysis.files.filter((file) => areaOf(file, resolve(analysis.root, "src")).name === feature && areaOf(file, resolve(analysis.root, "src")).kind === "feature");
    const imports = analysis.imports.filter((value) => value.source.kind === "feature" && value.source.name === feature);
    const adoptingFiles = new Set(imports.filter((value) => value.target.kind === "platform").map((value) => value.file));
    const effectiveFiles = featureFiles.filter((file) => effective.has(file));
    return {
      feature,
      files: featureFiles.length,
      platformImports: imports.filter((value) => value.target.kind === "platform").length,
      platformPackages: [...new Set(imports.filter((value) => value.target.kind === "platform").map((value) => value.target.name))].sort(),
      featureDependencies: [...new Set(imports.filter((value) => value.target.kind === "feature" && value.target.name !== feature).map((value) => value.target.name))].sort(),
      adoptingFiles: adoptingFiles.size,
      adoptionPercent: featureFiles.length === 0 ? 0 : Math.round(adoptingFiles.size / featureFiles.length * 100),
      effectiveAdoptingFiles: effectiveFiles.length,
      effectiveAdoptionPercent: featureFiles.length === 0 ? 0 : Math.round(effectiveFiles.length / featureFiles.length * 100),
    };
  });
}

function effectivePlatformConsumers(analysis: MigrationAnalysis): ReadonlySet<string> {
  const files = new Set(analysis.files);
  const dependencies = new Map<string, string[]>();
  for (const value of analysis.imports) {
    if (!value.resolved) continue;
    const target = sourceFile(value.resolved, files);
    if (target) dependencies.set(value.file, [...(dependencies.get(value.file) ?? []), target]);
  }
  const memo = new Map<string, boolean>();
  function reachesPlatform(file: string, visiting = new Set<string>()): boolean {
    if (memo.has(file)) return memo.get(file)!;
    if (analysis.imports.some((value) => value.file === file && value.target.kind === "platform")) return true;
    if (visiting.has(file)) return false;
    const next = new Set(visiting); next.add(file);
    const result = (dependencies.get(file) ?? []).some((target) => reachesPlatform(target, next));
    memo.set(file, result); return result;
  }
  return new Set(analysis.files.filter((file) => reachesPlatform(file)));
}

function sourceFile(path: string, files: ReadonlySet<string>): string | undefined {
  return [path, `${path}.ts`, `${path}.tsx`, resolve(path, "index.ts"), resolve(path, "index.tsx")].find((candidate) => files.has(candidate));
}

export function architectureViolations(analysis: MigrationAnalysis): readonly ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const sourceRoot = resolve(analysis.root, "src");
  const platformRoot = resolve(sourceRoot, "platform");
  for (const value of analysis.imports) {
    if (value.source.kind === "platform" && value.target.kind === "feature") {
      violations.push(violation("platform-no-features", value, analysis.root));
    }
    if (value.target.kind === "platform" && value.source.name !== value.target.name && value.resolved && value.resolved !== resolve(platformRoot, value.target.name)) {
      violations.push(violation("platform-public-api-only", value, analysis.root));
    }
    if (value.source.kind === "platform" && value.target.kind === "platform" && value.source.name !== value.target.name && !dependencyAllowed(value.source.name, value.target.name)) {
      violations.push(violation("lifecycle-direction", value, analysis.root));
    }
  }
  for (const packageName of analysis.platformPackages) {
    const barrel = resolve(platformRoot, packageName, "index.ts");
    if (!existsSync(barrel) || !/\bexport\b/.test(readFileSync(barrel, "utf8"))) {
      violations.push({ rule: "platform-package-barrel", file: relative(analysis.root, barrel), detail: `${packageName} has no public index` });
    }
  }
  return violations.sort((left, right) => left.rule.localeCompare(right.rule) || left.file.localeCompare(right.file));
}

function dependencyAllowed(source: string, target: string): boolean {
  const foundations = foundationDependencies[source];
  if (foundations) return foundations.includes(target);
  const sourceRank = lifecycle.indexOf(source as typeof lifecycle[number]);
  const targetRank = lifecycle.indexOf(target as typeof lifecycle[number]);
  return sourceRank >= 0 && (targetRank < 0 || targetRank <= sourceRank);
}

function parseImports(file: string, sourceRoot: string): ImportRecord[] {
  const source = readFileSync(file, "utf8");
  const records: ImportRecord[] = [];
  const pattern = /(?:import|export)\s+(?:type\s+)?(?:\{([\s\S]*?)\}|[^;"']*?)\s+from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[2] ?? match[3];
    const resolved = resolveSpecifier(file, sourceRoot, specifier);
    records.push({
      file,
      specifier,
      source: areaOf(file, sourceRoot),
      target: resolved ? areaOf(resolved, sourceRoot) : { kind: "other", name: specifier },
      ...(resolved ? { resolved } : {}),
      symbols: match[1] ? namedSymbols(match[1]) : [],
    });
  }
  return records;
}

function namedSymbols(value: string): string[] {
  return value.split(",").map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter(Boolean);
}

function resolveSpecifier(file: string, sourceRoot: string, specifier: string): string | undefined {
  if (specifier.startsWith("@/")) return resolve(sourceRoot, specifier.slice(2));
  if (specifier.startsWith(".")) return resolve(dirname(file), specifier);
  return undefined;
}

function areaOf(path: string, sourceRoot: string): Area {
  const parts = relative(sourceRoot, path).split(sep);
  if ((parts[0] === "features" || parts[0] === "platform") && parts[1]) {
    return { kind: parts[0] === "features" ? "feature" : "platform", name: parts[1] };
  }
  return { kind: "other", name: parts[0] ?? "unknown" };
}

function violation(rule: string, value: ImportRecord, root: string): ArchitectureViolation {
  return { rule, file: relative(root, value.file), detail: `${value.specifier} (${label(value.source)} -> ${label(value.target)})` };
}

function label(area: Area): string { return `${area.kind}:${area.name}`; }
function directories(path: string): string[] { return existsSync(path) ? readdirSync(path).filter((entry) => statSync(resolve(path, entry)).isDirectory()).sort() : []; }
function walk(path: string): string[] { return readdirSync(path).flatMap((entry) => { const child = resolve(path, entry); return statSync(child).isDirectory() ? walk(child) : [child]; }); }
function isProductionSource(file: string): boolean { return /\.tsx?$/.test(file) && !/\.(?:test|spec)\.tsx?$/.test(file) && !file.includes(`${sep}test-support${sep}`); }
