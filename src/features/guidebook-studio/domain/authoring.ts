export const GUIDEBOOK_DRAFT_SCHEMA = "guidebook-draft.v1" as const;
export const GUIDEBOOK_BLOCK_SCHEMA = "guidebook-block.v1" as const;
export const GUIDEBOOK_MEDIA_REFERENCE = /^gbm_[a-z0-9]{26}$/;

export type AuthoringBlockType =
  | "heading"
  | "rich-text"
  | "image"
  | "instruction"
  | "contact"
  | "location"
  | "link"
  | "callout"
  | "checklist";
type GuidebookBlockType = AuthoringBlockType;
type BaseBlock<T extends AuthoringBlockType, C> = Readonly<{
  id: string;
  type: T;
  schemaVersion: typeof GUIDEBOOK_BLOCK_SCHEMA;
  position: number;
  visible: boolean;
  content: Readonly<C>;
}>;
export type HeadingBlock = BaseBlock<
  "heading",
  { text: string; level: 2 | 3 | 4 }
>;
export type RichTextBlock = BaseBlock<"rich-text", { text: string }>;
export type ImageBlock = BaseBlock<
  "image",
  { mediaRef: string; alt: string; caption?: string }
>;
export type InstructionBlock = BaseBlock<
  "instruction",
  {
    title?: string;
    steps: readonly Readonly<{ id: string; text: string }>[];
    emphasis?: "standard" | "important";
  }
>;
export type ContactBlock = BaseBlock<
  "contact",
  { name: string; role?: string; phone?: string; action?: "phone" }
>;
export type LocationBlock = BaseBlock<
  "location",
  { label: string; destination: string; mapUrl?: string }
>;
export type LinkBlock = BaseBlock<"link", { label: string; url: string }>;
export type CalloutBlock = BaseBlock<
  "callout",
  { kind: "information" | "reminder" | "warning"; title?: string; body: string }
>;
export type ChecklistBlock = BaseBlock<
  "checklist",
  { title?: string; items: readonly Readonly<{ id: string; text: string }>[] }
>;
export type AuthoringBlock =
  | HeadingBlock
  | RichTextBlock
  | ImageBlock
  | InstructionBlock
  | ContactBlock
  | LocationBlock
  | LinkBlock
  | CalloutBlock
  | ChecklistBlock;
export type AuthoringSection = Readonly<{
  id: string;
  name: string;
  visible: boolean;
  position: number;
  blocks: readonly AuthoringBlock[];
}>;
export type GuidebookDraft = Readonly<{
  guidebookId: string;
  workspaceId: string;
  propertyId: string;
  schemaVersion: typeof GUIDEBOOK_DRAFT_SCHEMA;
  revision: number;
  title: string;
  description: string;
  sections: readonly AuthoringSection[];
  persistedAt: string;
  persistedBy: string;
  basePublicationVersion?: number;
}>;
export type ReadinessIssue = Readonly<{
  code: string;
  severity: "warning" | "error";
  message: string;
  sectionId?: string;
  blockId?: string;
  target: string;
}>;
export type ReadinessResult = Readonly<{
  status: "ready" | "ready-with-warnings" | "not-ready";
  issues: readonly ReadinessIssue[];
}>;

export class GuidebookAuthoringError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GuidebookAuthoringError";
  }
}
const text = (value: unknown, max: number, required = false) => {
  if (typeof value !== "string")
    throw new GuidebookAuthoringError(
      "BLOCK_CONTENT_INVALID",
      "Text content is invalid.",
    );
  const result = value.trim();
  if (result.length > max || (required && !result))
    throw new GuidebookAuthoringError(
      "BLOCK_CONTENT_INVALID",
      "Text content is outside the supported bounds.",
    );
  return result;
};
const optional = (value: unknown, max: number) =>
  value === undefined || value === null || value === ""
    ? undefined
    : text(value, max);
const url = (value: unknown, required = false) => {
  const result = text(value, 2048, required);
  if (!result) return result;
  if (result.startsWith("/")) return result;
  try {
    if (
      !["https:", "http:", "mailto:", "tel:"].includes(new URL(result).protocol)
    )
      throw new Error();
  } catch {
    throw new GuidebookAuthoringError(
      "BLOCK_CONTENT_INVALID",
      "The destination scheme is not supported.",
    );
  }
  return result;
};
const items = (value: unknown, max: number) => {
  if (!Array.isArray(value) || value.length > max)
    throw new GuidebookAuthoringError(
      "BLOCK_CONTENT_INVALID",
      "The ordered items are invalid.",
    );
  return Object.freeze(
    value.map((item, index) => {
      const row = item as Record<string, unknown>;
      return Object.freeze({
        id: text(row.id ?? `item-${index}`, 100, true),
        text: text(row.text, 1000),
      });
    }),
  );
};

export function initialBlock(
  type: AuthoringBlockType,
  id: string,
  position: number,
): AuthoringBlock {
  const base = {
    id,
    schemaVersion: GUIDEBOOK_BLOCK_SCHEMA,
    position,
    visible: true,
  };
  switch (type) {
    case "heading":
      return { ...base, type, content: { text: "", level: 2 } };
    case "rich-text":
      return { ...base, type, content: { text: "" } };
    case "image":
      return { ...base, type, content: { mediaRef: "", alt: "" } };
    case "instruction":
      return { ...base, type, content: { steps: [], emphasis: "standard" } };
    case "contact":
      return { ...base, type, content: { name: "" } };
    case "location":
      return { ...base, type, content: { label: "", destination: "" } };
    case "link":
      return { ...base, type, content: { label: "", url: "" } };
    case "callout":
      return { ...base, type, content: { kind: "information", body: "" } };
    case "checklist":
      return { ...base, type, content: { items: [] } };
  }
}
export function validateBlock(
  input: unknown,
  mode: "draft" | "publish" = "draft",
): AuthoringBlock {
  if (!input || typeof input !== "object")
    throw new GuidebookAuthoringError(
      "BLOCK_CONTENT_INVALID",
      "Block content is invalid.",
    );
  const row = input as Record<string, unknown>,
    type = row.type as GuidebookBlockType;
  if (
    ![
      "heading",
      "rich-text",
      "image",
      "instruction",
      "contact",
      "location",
      "link",
      "callout",
      "checklist",
    ].includes(type)
  )
    throw new GuidebookAuthoringError(
      "BLOCK_TYPE_UNSUPPORTED",
      "The block type is unsupported.",
    );
  if (row.schemaVersion !== GUIDEBOOK_BLOCK_SCHEMA)
    throw new GuidebookAuthoringError(
      "DRAFT_VERSION_UNSUPPORTED",
      "The block schema is unsupported.",
    );
  const base = {
      id: text(row.id, 100, true),
      type,
      schemaVersion: GUIDEBOOK_BLOCK_SCHEMA,
      position: integer(row.position),
      visible: row.visible !== false,
    },
    c = (row.content ?? {}) as Record<string, unknown>,
    required = mode === "publish" && base.visible;
  switch (type) {
    case "heading": {
      const level = Number(c.level);
      if (![2, 3, 4].includes(level))
        throw new GuidebookAuthoringError(
          "BLOCK_CONTENT_INVALID",
          "Heading level is invalid.",
        );
      return {
        ...base,
        type,
        content: {
          text: text(c.text, 300, required),
          level: level as 2 | 3 | 4,
        },
      };
    }
    case "rich-text":
      return {
        ...base,
        type,
        content: { text: text(c.text, 20000, required) },
      };
    case "image": {
      const mediaRef = text(c.mediaRef, 30, required);
      if (mediaRef && !GUIDEBOOK_MEDIA_REFERENCE.test(mediaRef))
        throw new GuidebookAuthoringError(
          "MEDIA_REFERENCE_INVALID",
          "The image must use an approved Guidebook media reference.",
        );
      return {
        ...base,
        type,
        content: {
          mediaRef,
          alt: text(c.alt, 500, required),
          ...(optional(c.caption, 1000)
            ? { caption: optional(c.caption, 1000) }
            : {}),
        },
      };
    }
    case "instruction":
      return {
        ...base,
        type,
        content: {
          ...(optional(c.title, 300) ? { title: optional(c.title, 300) } : {}),
          steps: items(c.steps, 50),
          emphasis: c.emphasis === "important" ? "important" : "standard",
        },
      };
    case "contact": {
      const phone = optional(c.phone, 100);
      if (phone && !/^\+?[0-9() .-]{7,30}$/.test(phone))
        throw new GuidebookAuthoringError(
          "BLOCK_CONTENT_INVALID",
          "Phone value is invalid.",
        );
      const name = text(c.name, 300, required);
      if (required && !phone)
        throw new GuidebookAuthoringError(
          "BLOCK_CONTENT_INVALID",
          "A visible contact requires a phone value.",
        );
      return {
        ...base,
        type,
        content: {
          name,
          ...(optional(c.role, 300) ? { role: optional(c.role, 300) } : {}),
          ...(phone ? { phone, action: "phone" as const } : {}),
        },
      };
    }
    case "location":
      return {
        ...base,
        type,
        content: {
          label: text(c.label, 300, required),
          destination: text(c.destination, 1000, required),
          ...(optional(c.mapUrl, 2048) ? { mapUrl: url(c.mapUrl) } : {}),
        },
      };
    case "link":
      return {
        ...base,
        type,
        content: {
          label: text(c.label, 300, required),
          url: url(c.url, required),
        },
      };
    case "callout": {
      if (!["information", "reminder", "warning"].includes(String(c.kind)))
        throw new GuidebookAuthoringError(
          "BLOCK_CONTENT_INVALID",
          "Callout classification is invalid.",
        );
      return {
        ...base,
        type,
        content: {
          kind: c.kind as "information" | "reminder" | "warning",
          ...(optional(c.title, 300) ? { title: optional(c.title, 300) } : {}),
          body: text(c.body, 5000, required),
        },
      };
    }
    case "checklist":
      return {
        ...base,
        type,
        content: {
          ...(optional(c.title, 300) ? { title: optional(c.title, 300) } : {}),
          items: items(c.items, 100),
        },
      };
  }
}
export function validateDraft(
  input: GuidebookDraft,
  mode: "draft" | "publish" = "draft",
) {
  if (input.schemaVersion !== GUIDEBOOK_DRAFT_SCHEMA)
    throw new GuidebookAuthoringError(
      "DRAFT_VERSION_UNSUPPORTED",
      "The draft schema is unsupported.",
    );
  if (
    !input.guidebookId ||
    !input.workspaceId ||
    !input.propertyId ||
    input.revision < 1
  )
    throw new GuidebookAuthoringError(
      "DRAFT_PERSIST_FAILED",
      "The draft identity is invalid.",
    );
  return freeze({
    ...input,
    title: text(input.title, 300, true),
    description: text(input.description, 5000),
    sections: normalizeSections(
      input.sections.map((section) => ({
        ...section,
        name: text(section.name, 200, true),
        blocks: section.blocks.map((block) => validateBlock(block, mode)),
      })),
    ),
  });
}
export function evaluateReadiness(draft: GuidebookDraft): ReadinessResult {
  const issues: ReadinessIssue[] = [];
  const visible = draft.sections.filter((section) => section.visible);
  if (!visible.length)
    issues.push({
      code: "NO_VISIBLE_SECTIONS",
      severity: "error",
      message: "Add or show at least one section.",
      target: "sections",
    });
  for (const section of visible) {
    if (!section.blocks.some((block) => block.visible))
      issues.push({
        code: "EMPTY_VISIBLE_SECTION",
        severity: "warning",
        message: "This visible section has no visible content.",
        sectionId: section.id,
        target: `section:${section.id}`,
      });
    for (const block of section.blocks.filter((block) => block.visible))
      try {
        validateBlock(block, "publish");
      } catch (error) {
        issues.push({
          code:
            error instanceof GuidebookAuthoringError
              ? error.code
              : "BLOCK_CONTENT_INVALID",
          severity: "error",
          message:
            error instanceof Error
              ? error.message
              : "Block content is invalid.",
          sectionId: section.id,
          blockId: block.id,
          target: `block:${block.id}`,
        });
      }
  }
  return freeze({
    status: issues.some((issue) => issue.severity === "error")
      ? "not-ready"
      : issues.length
        ? "ready-with-warnings"
        : "ready",
    issues,
  });
}
export function buildSnapshot(
  draft: GuidebookDraft,
  property: Readonly<Record<string, unknown>>,
  publishedAt: string,
) {
  const valid = validateDraft(draft, "publish"),
    readiness = evaluateReadiness(valid);
  if (readiness.status === "not-ready")
    throw new GuidebookAuthoringError(
      "PUBLICATION_NOT_READY",
      "The guidebook is not ready to publish.",
    );
  return freeze({
    schemaVersion: "guidebook-publication-snapshot.v1",
    publishedAt,
    title: valid.title,
    description: valid.description,
    property: { ...property },
    sections: valid.sections
      .filter((section) => section.visible)
      .map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => block.visible),
      })),
  });
}
export function normalizeSections(sections: readonly AuthoringSection[]) {
  return Object.freeze(
    [...sections]
      .sort((a, b) => a.position - b.position)
      .map((section, position) =>
        Object.freeze({
          ...section,
          position,
          blocks: Object.freeze(
            [...section.blocks]
              .sort((a, b) => a.position - b.position)
              .map((block, index) =>
                Object.freeze({ ...block, position: index }),
              ),
          ),
        }),
      ),
  );
}
function integer(value: unknown) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0)
    throw new GuidebookAuthoringError(
      "BLOCK_CONTENT_INVALID",
      "Sort position is invalid.",
    );
  return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
