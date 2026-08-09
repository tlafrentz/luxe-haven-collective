export const GUIDEBOOK_DRAFT_SCHEMA = "guidebook-draft.v1" as const;
export const GUIDEBOOK_BLOCK_SCHEMA = "guidebook-block.v1" as const;
export const GUIDEBOOK_MEDIA_REFERENCE = /^gbm_[a-z0-9]{26}$/;

export type AuthoringBlockType =
  | "component"
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
export type ComponentBlock = BaseBlock<"component", {
  componentKey: string;
  componentVersionId: string;
  source: "inline" | "content_record";
  fields: Readonly<Record<string, string>>;
  contentRecordId?: string;
  variableBindings: Readonly<Record<string, string>>;
  mediaRefs: readonly Readonly<{ assetId: string; versionId: string; alt: string; decorative: boolean }>[];
  layout: Readonly<{ width: "standard" | "wide"; alignment: "left" | "center"; variant: "compact" | "standard" | "featured" }>;
}>;
export type AuthoringBlock =
  | ComponentBlock
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
export type GuidebookBrandIdentity = Readonly<{
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
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
  brand?: GuidebookBrandIdentity;
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
  componentKey?: string,
): AuthoringBlock {
  const base = {
    id,
    schemaVersion: GUIDEBOOK_BLOCK_SCHEMA,
    position,
    visible: true,
  };
  switch (type) {
    case "component":
      return { ...base, type, content: { componentKey: text(componentKey,100,true), componentVersionId: `${componentKey}-v1`, source:"inline", fields:{}, variableBindings:{}, mediaRefs:[], layout:{width:"standard",alignment:"left",variant:"standard"} } };
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
      "component",
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
    case "component": {
      const fields=Object.fromEntries(Object.entries((c.fields??{}) as Record<string,unknown>).map(([key,value])=>[text(key,100,true),text(value,20000)]));
      const variableBindings=Object.fromEntries(Object.entries((c.variableBindings??{}) as Record<string,unknown>).map(([key,value])=>[text(key,100,true),text(value,100,true)]));
      const layout=(c.layout??{}) as Record<string,unknown>;
      return {...base,type,content:{componentKey:text(c.componentKey,100,true),componentVersionId:text(c.componentVersionId,150,true),source:c.source==="content_record"?"content_record":"inline",fields,...(c.contentRecordId?{contentRecordId:text(c.contentRecordId,100,true)}:{}),variableBindings,mediaRefs:Array.isArray(c.mediaRefs)?c.mediaRefs.slice(0,12).map(item=>{const media=item as Record<string,unknown>;return{assetId:text(media.assetId,100,true),versionId:text(media.versionId,100,true),alt:text(media.alt,500),decorative:media.decorative===true}}):[],layout:{width:layout.width==="wide"?"wide":"standard",alignment:layout.alignment==="center"?"center":"left",variant:layout.variant==="compact"||layout.variant==="featured"?layout.variant:"standard"}}};
    }
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
      if (required && !optional(c.mediaRef, 30))
        throw new GuidebookAuthoringError(
          "IMAGE_MEDIA_MISSING",
          "Add an image before publishing, or remove this block.",
        );
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
    case "link": {
      if (required && !optional(c.url, 2048))
        throw new GuidebookAuthoringError(
          "LINK_DESTINATION_MISSING",
          "Add a destination link before publishing, or remove this block.",
        );
      return {
        ...base,
        type,
        content: {
          label: text(c.label, 300, required),
          url: url(c.url, required),
        },
      };
    }
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
  const components=visible.flatMap(section=>section.blocks.filter((block):block is ComponentBlock=>block.visible&&block.type==="component"));
  if(components.length){
    const keys=new Set(components.map(block=>block.content.componentKey));
    for(const [key,label] of [["hero","Hero"],["wifi_card","Wi-Fi Card"],["emergency_contact_card","Emergency Contact Card"],["departure_checklist","Departure Checklist"]] as const)
      if(!keys.has(key))issues.push({code:`MISSING_${key.toUpperCase()}`,severity:"error",message:`Add a ${label} before publishing.`,target:"components"});
    for(const block of components){
      const requiredVariables:Record<string,readonly string[]>={wifi_card:["wifi.network","wifi.password"],arrival_instructions:["stay.check_in_time"],departure_checklist:["stay.check_out_time"],emergency_contact_card:["emergency.contact"]};
      for(const key of requiredVariables[block.content.componentKey]??[]){const inline=Object.values(block.content.fields).some(value=>value.includes(`{{${key}}}`));if(!inline&&!block.content.variableBindings[key])issues.push({code:"VARIABLE_BINDING_MISSING",severity:"error",message:`Bind ${key} before publishing.`,blockId:block.id,target:`block:${block.id}`})}
      if(block.content.componentKey==="hero"&&!block.content.mediaRefs.length)issues.push({code:"HERO_MEDIA_MISSING",severity:"error",message:"Choose a hero image before publishing.",blockId:block.id,target:`block:${block.id}`});
      for(const media of block.content.mediaRefs)if(!media.decorative&&!media.alt.trim())issues.push({code:"MEDIA_ALT_MISSING",severity:"warning",message:"Add alt text to this image.",blockId:block.id,target:`block:${block.id}`});
    }
    if(!keys.has("review_cta"))issues.push({code:"REVIEW_CTA_MISSING",severity:"warning",message:"Consider adding a Review CTA.",target:"components"});
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
    brand: { ...(valid.brand ?? {}) },
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
