import { createHash } from "node:crypto";
import {
  AUTOMATION_RELEASE_SCHEMA_VERSION,
  type AutomationReleaseManifest,
  type AutomationReleaseManifestInput,
  type AutomationReleaseResult,
} from "./automation-release-contracts";
import { validateAutomationCommandRisks } from "./automation-release-policy";
const SHA = /^[0-9a-f]{40}$/i,
  NAME = /^[A-Z][A-Z0-9_]*$/;
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function createAutomationReleaseManifest(
  input: AutomationReleaseManifestInput,
): AutomationReleaseResult<AutomationReleaseManifest> {
  if (
    !input.releaseId.trim() ||
    !input.semanticVersion.trim() ||
    !SHA.test(input.gitCommit) ||
    !input.buildArtifactId.trim() ||
    !SHA.test(input.rollbackTarget)
  )
    return {
      ok: false,
      code: "AU_RELEASE_CONFIGURATION_INVALID",
      message:
        "Immutable release, build, commit, and rollback identities are required.",
    };
  if (input.requiredEnvironmentVariableNames.some((name) => !NAME.test(name)))
    return {
      ok: false,
      code: "AU_RELEASE_CONFIGURATION_INVALID",
      message:
        "Configuration inventory must contain environment-variable names only.",
    };
  if (!validateAutomationCommandRisks(input.commandRisks).ok)
    return {
      ok: false,
      code: "AU_RELEASE_AUTONOMOUS_AUTHORITY_DETECTED",
      message:
        "The command-risk inventory exceeds the initial release boundary.",
    };
  const serialized = stable(input);
  if (
    /((sk|pk)_(live|test)_|eyJ[A-Za-z0-9_-]{20,}|postgres(?:ql)?:\/\/)/.test(
      serialized,
    )
  )
    return {
      ok: false,
      code: "AU_RELEASE_CONFIGURATION_INVALID",
      message:
        "Release manifests must not contain credentials or secret values.",
    };
  const canonical = Object.freeze({
    schemaVersion: AUTOMATION_RELEASE_SCHEMA_VERSION,
    ...input,
    requiredEnvironmentVariableNames: Object.freeze(
      [...input.requiredEnvironmentVariableNames].sort(),
    ),
    flags: Object.freeze(
      [...input.flags].sort((a, b) => a.key.localeCompare(b.key)),
    ),
    enabledReportIds: Object.freeze([...input.enabledReportIds].sort()),
  });
  return {
    ok: true,
    value: Object.freeze({
      ...canonical,
      checksum: createHash("sha256").update(stable(canonical)).digest("hex"),
    }),
  };
}
export function validateAutomationReleaseConfiguration(
  input: Readonly<{
    requiredNames: readonly string[];
    availableNames: readonly string[];
  }>,
): AutomationReleaseResult<
  Readonly<{ safeFingerprint: string; names: readonly string[] }>
> {
  const available = new Set(input.availableNames),
    missing = input.requiredNames.filter((name) => !available.has(name));
  if (missing.length)
    return {
      ok: false,
      code: "AU_RELEASE_CONFIGURATION_INVALID",
      message: `Required configuration is missing: ${missing.join(", ")}.`,
    };
  const names = Object.freeze([...input.requiredNames].sort());
  return {
    ok: true,
    value: Object.freeze({
      names,
      safeFingerprint: createHash("sha256")
        .update(names.join("\n"))
        .digest("hex"),
    }),
  };
}
