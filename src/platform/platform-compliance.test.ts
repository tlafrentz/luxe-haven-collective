import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve("src");
const platformRoot = resolve(sourceRoot, "platform");
const productionFiles = walk(sourceRoot).filter(isProductionTypeScript);
const platformFiles = productionFiles.filter((file) => isWithin(file, platformRoot));
const packages = readdirSync(platformRoot)
  .filter((entry) => statSync(resolve(platformRoot, entry)).isDirectory())
  .sort();

const lifecycle = [
  "observations",
  "evidence",
  "claims",
  "evaluations",
  "recommendations",
  "decisions",
  "actions",
  "workflows",
  "automations",
  "outcomes",
  "intelligence",
  "learning",
] as const;

const foundationDependencies: Readonly<Record<string, readonly string[]>> = {
  kernel: [],
  scoring: ["kernel"],
  execution: ["kernel"],
};

describe("Platform v1 compliance", () => {
  it("keeps platform packages independent from features", () => {
    const violations = importsOf(platformFiles).filter(({ specifier, target }) =>
      specifier.startsWith("@/features/") ||
      (target !== undefined && isWithin(target, resolve(sourceRoot, "features")))
    );

    expect(formatImports(violations)).toEqual([]);
  });

  it("requires consumers and sibling packages to use platform package barrels", () => {
    const violations = importsOf(productionFiles).filter(({ importer, target }) => {
      if (!target || !isWithin(target, platformRoot)) return false;
      const sourcePackage = platformPackage(importer);
      const targetPackage = platformPackage(target);
      if (!targetPackage || sourcePackage === targetPackage) return false;
      return target !== resolve(platformRoot, targetPackage);
    });

    expect(formatImports(violations)).toEqual([]);
  });

  it("gives every platform package a public index", () => {
    const violations = packages.filter((packageName) => {
      const barrel = resolve(platformRoot, packageName, "index.ts");
      return !existsSync(barrel) || !/\bexport\b/.test(readFileSync(barrel, "utf8"));
    });

    expect(violations).toEqual([]);
  });

  it("enforces lifecycle dependency direction", () => {
    const violations: string[] = [];

    for (const dependency of importsOf(platformFiles)) {
      if (!dependency.target) continue;
      const sourcePackage = platformPackage(dependency.importer);
      const targetPackage = platformPackage(dependency.target);
      if (!sourcePackage || !targetPackage || sourcePackage === targetPackage) continue;

      const allowedFoundations = foundationDependencies[sourcePackage];
      if (allowedFoundations && !allowedFoundations.includes(targetPackage)) {
        violations.push(describeImport(dependency));
        continue;
      }

      const sourceRank = lifecycle.indexOf(sourcePackage as typeof lifecycle[number]);
      const targetRank = lifecycle.indexOf(targetPackage as typeof lifecycle[number]);
      if (sourceRank >= 0 && targetRank > sourceRank) violations.push(describeImport(dependency));
    }

    expect(violations).toEqual([]);
  });

  it("keeps domain entities immutable", () => {
    const entityBase = readFileSync(resolve(platformRoot, "kernel/domain/entity-with-props.ts"), "utf8");
    const domainFiles = platformFiles.filter((file) => file.includes(`${sep}domain${sep}`));
    const setters = domainFiles.filter((file) => /\bset\s+[A-Za-z_$][\w$]*\s*\(/.test(readFileSync(file, "utf8")));
    const unfrozenEntities = domainFiles.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const classes = [...source.matchAll(/export\s+class\s+(\w+)(?:<[^>{}]*>)?(?:\s+extends\s+([\w]+))?/g)];
      return classes
        .filter(([, name, base]) => isEntity(name, base))
        .filter(([, , base]) => base !== "EntityWithProps" && base !== "ValueObject")
        .filter(() => !source.includes("Object.freeze(this)"))
        .map(([, name]) => `${relative(sourceRoot, file)}: ${name}`);
    });

    expect(entityBase).toContain("Object.freeze(this)");
    expect(setters.map((file) => relative(sourceRoot, file))).toEqual([]);
    expect(unfrozenEntities).toEqual([]);
  });

  it("keeps builders focused on construction", () => {
    const builderFiles = platformFiles.filter((file) => /builder\.ts$/.test(file));
    const violations = builderFiles.filter((file) => {
      const source = readFileSync(file, "utf8");
      const runtimePolicyImport = /import\s+(?!type\b)[^;]*\bPolicy\b[^;]*from/.test(source);
      return runtimePolicyImport || /\b(?:async|await)\b/.test(source) || /\b(?:Executor|Registry|Session)\b/.test(source);
    });

    expect(violations.map((file) => relative(sourceRoot, file))).toEqual([]);
  });

  it("keeps business policy implementations out of executors", () => {
    const executorFiles = platformFiles.filter((file) => /executor\.ts$/.test(file));
    const violations = executorFiles.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /(?:class|interface|type)\s+\w*Policy\b/.test(source) || /new\s+\w*Policy\s*\(/.test(source);
    });

    expect(violations.map((file) => relative(sourceRoot, file))).toEqual([]);
  });
});

type ImportReference = Readonly<{ importer: string; specifier: string; target?: string }>;

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function isProductionTypeScript(file: string): boolean {
  return /\.tsx?$/.test(file) && !/\.(?:test|spec)\.tsx?$/.test(file) && !file.includes(`${sep}test-support${sep}`);
}

function importsOf(files: readonly string[]): ImportReference[] {
  return files.flatMap((importer) => {
    const source = readFileSync(importer, "utf8");
    return [...source.matchAll(/(?:from\s+|import\s*\()\s*["']([^"']+)["']/g)].map((match) => ({
      importer,
      specifier: match[1],
      target: resolveImport(importer, match[1]),
    }));
  });
}

function resolveImport(importer: string, specifier: string): string | undefined {
  if (specifier === "@") return sourceRoot;
  if (specifier.startsWith("@/")) return resolve(sourceRoot, specifier.slice(2));
  if (specifier.startsWith(".")) return resolve(dirname(importer), specifier);
  return undefined;
}

function platformPackage(path: string): string | undefined {
  if (!isWithin(path, platformRoot)) return undefined;
  return relative(platformRoot, path).split(sep)[0];
}

function isWithin(path: string, parent: string): boolean {
  const child = relative(parent, path);
  return child === "" || (!child.startsWith("..") && !child.startsWith(sep));
}

function isEntity(name: string, base?: string): boolean {
  if (base === "EntityWithProps") return true;
  return !/(?:Collection|History|Registry|Builder|Executor|Session|Source|Reference|Options)$/.test(name) &&
    !name.endsWith("Policy") && name !== "Identifier";
}

function describeImport(value: ImportReference): string {
  return `${relative(sourceRoot, value.importer)} -> ${value.specifier}`;
}

function formatImports(values: readonly ImportReference[]): string[] {
  return values.map(describeImport);
}
