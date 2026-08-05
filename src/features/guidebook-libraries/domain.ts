export const libraryArtifactTypes = [
  "content",
  "component",
  "template",
  "media",
] as const;
export type LibraryArtifactType = (typeof libraryArtifactTypes)[number];

export const libraryStatuses = [
  "draft",
  "under_review",
  "published",
  "deprecated",
  "superseded",
  "archived",
  "processing",
  "needs_review",
  "approved",
  "rejected",
] as const;
export type LibraryStatus = (typeof libraryStatuses)[number];

export const approvedVariables = new Set([
  "property_name",
  "check_in_time",
  "check_out_time",
  "entry_method",
  "door_code",
  "wifi_name",
  "wifi_password",
  "parking_location",
  "quiet_hours",
  "host_phone",
]);

export function extractPlaceholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)].map(
    (match) => match[1]!,
  );
}

export function validateStructuredContent(value: string) {
  if (/<\/?[a-z][\s\S]*>/i.test(value))
    throw new Error("unsanitized_html_not_allowed");
  const variables = extractPlaceholders(value);
  const unsupported = variables.filter(
    (variable) => !approvedVariables.has(variable),
  );
  if (unsupported.length)
    throw new Error(`unsupported_variables:${unsupported.join(",")}`);
  const opening = (value.match(/\{\{/g) ?? []).length;
  const closing = (value.match(/\}\}/g) ?? []).length;
  if (opening !== closing) throw new Error("invalid_placeholder_syntax");
  return { variables: [...new Set(variables)] };
}

export function contentPayload(body: string, requiredVariables: string[]) {
  const normalized = body.trim();
  const { variables } = validateStructuredContent(normalized);
  const required = [...new Set(requiredVariables)].filter((variable) =>
    variables.includes(variable),
  );
  return Object.freeze({
    blocks: Object.freeze(
      normalized
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((text) => Object.freeze({ type: "paragraph", text })),
    ),
    requiredVariables: Object.freeze(required),
  });
}

export function canTransitionLibraryStatus(
  from: LibraryStatus,
  to: LibraryStatus,
) {
  const allowed: Record<LibraryStatus, readonly LibraryStatus[]> = {
    draft: ["under_review", "archived"],
    under_review: ["draft", "published", "approved", "rejected"],
    published: ["deprecated", "superseded"],
    deprecated: ["archived", "draft"],
    superseded: ["archived"],
    archived: ["draft"],
    processing: ["needs_review", "rejected"],
    needs_review: ["approved", "rejected"],
    approved: ["archived", "superseded"],
    rejected: ["draft", "processing", "archived"],
  };
  return allowed[from].includes(to);
}

export function validateMediaBytes(mimeType: string, bytes: Uint8Array) {
  const prefix = Buffer.from(bytes.subarray(0, 16));
  const signatures: Record<string, boolean> = {
    "image/jpeg":
      prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff,
    "image/png": prefix
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/webp":
      prefix.subarray(0, 4).toString("ascii") === "RIFF" &&
      prefix.subarray(8, 12).toString("ascii") === "WEBP",
    "image/avif": prefix.subarray(4, 12).toString("ascii").includes("ftypavif"),
    "video/mp4": prefix.subarray(4, 8).toString("ascii") === "ftyp",
    "application/pdf": prefix.subarray(0, 5).toString("ascii") === "%PDF-",
  };
  if (!signatures[mimeType]) throw new Error("media_signature_invalid");
  const sample = Buffer.from(
    bytes.subarray(0, Math.min(bytes.length, 1_048_576)),
  )
    .toString("latin1")
    .toLowerCase();
  if (
    ["<script", "javascript:", "/launch", "/embeddedfile"].some((marker) =>
      sample.includes(marker),
    )
  )
    throw new Error("media_security_scan_rejected");
}
