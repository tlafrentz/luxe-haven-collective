import { createHash } from "node:crypto";
import type { HpmReleaseManifest, HpmReleaseManifestInput, HpmReleaseResult } from "./hpm-release-contracts";

const SECRET_NAME = /(SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY|DATABASE_URL)/i;
const SHA = /^[0-9a-f]{7,64}$/i;

function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`; return JSON.stringify(value); }

export function createHpmReleaseManifest(input: HpmReleaseManifestInput): HpmReleaseResult<HpmReleaseManifest> {
  if (!input.releaseName.trim() || !input.semanticVersion.trim() || !SHA.test(input.gitCommitSha) || !input.buildId.trim() || !input.rollbackTarget.trim()) return { ok: false, code: "HPM_RELEASE_MANIFEST_INVALID", message: "Release identity, immutable commit, build, and rollback target are required." };
  if (input.requiredEnvironmentVariables.some((name) => !/^[A-Z][A-Z0-9_]*$/.test(name))) return { ok: false, code: "HPM_RELEASE_CONFIGURATION_INVALID", message: "Environment requirements must contain names only." };
  const unsafe = stable(input); if (/((sk|pk)_(live|test)_|eyJ[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/)/.test(unsafe)) return { ok: false, code: "HPM_RELEASE_MANIFEST_INVALID", message: "Release manifests cannot contain credentials or secret values." };
  const canonical = { schemaVersion: "hpm-release-manifest-v1" as const, ...input, requiredEnvironmentVariables: [...input.requiredEnvironmentVariables].sort(), featureFlags: [...input.featureFlags].sort((a, b) => a.key.localeCompare(b.key)) };
  return { ok: true, value: Object.freeze({ ...canonical, checksum: createHash("sha256").update(stable(canonical)).digest("hex") }) };
}

export function validateHpmConfiguration(input: Readonly<{ requiredNames: readonly string[]; availableNames: readonly string[]; optionalNames?: readonly string[] }>): HpmReleaseResult<Readonly<{ present: readonly string[]; missing: readonly string[]; safeFingerprint: string }>> {
  if (input.requiredNames.some((name) => SECRET_NAME.test(name) && !/^[A-Z][A-Z0-9_]*$/.test(name))) return { ok: false, code: "HPM_RELEASE_CONFIGURATION_INVALID", message: "Configuration names are invalid." };
  const available = new Set(input.availableNames), missing = input.requiredNames.filter((name) => !available.has(name)), present = input.requiredNames.filter((name) => available.has(name));
  if (missing.length) return { ok: false, code: "HPM_RELEASE_CONFIGURATION_INVALID", message: `Required configuration is missing: ${missing.join(", ")}.` };
  return { ok: true, value: Object.freeze({ present: Object.freeze(present), missing: Object.freeze([]), safeFingerprint: createHash("sha256").update([...present, ...(input.optionalNames ?? []).filter((name) => available.has(name))].sort().join("\n")).digest("hex") }) };
}
