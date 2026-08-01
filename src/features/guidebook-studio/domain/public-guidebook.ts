import type { ArtifactRenderer } from "@/platform/artifact-rendering";
import { sanitizePublicText, sanitizePublicUrl } from "./guest-delivery";
export type PublicGuidebookBlock = Readonly<{
  id: string;
  type:
    | "heading"
    | "paragraph"
    | "instruction"
    | "contact"
    | "checklist"
    | "image"
    | "callout"
    | "location"
    | "link"
    | "unknown";
  text?: string;
  items?: readonly string[];
  url?: string;
  label?: string;
  alt?: string;
  caption?: string;
  name?: string;
  role?: string;
  phone?: string;
}>;
export type PublicGuidebookView = Readonly<{
  title: string;
  description: string;
  propertyName: string;
  coverImage?: string;
  hostContact?: string;
  checkInTime?: string;
  checkoutTime?: string;
  theme: Readonly<{
    primaryColor: string;
    accentColor: string;
    logoUrl?: string;
  }>;
  sections: readonly Readonly<{
    id: string;
    key: string;
    title: string;
    blocks: readonly PublicGuidebookBlock[];
  }>[];
  recommendations: readonly Readonly<{
    id: string;
    category: string;
    title: string;
    description: string;
    website?: string;
    mapUrl?: string;
  }>[];
  meta: Readonly<{
    guidebookVersion: number;
    publishedAt: string;
    artifactVersion: string;
    rendererVersion: string;
  }>;
}>;
export type GuidebookArtifactPayload = Readonly<{
  schemaVersion?: string;
  title?: string;
  description?: string;
  brand?: Record<string, unknown>;
  property?: Record<string, unknown>;
  propertyProjection?: { resolvedValues?: Record<string, unknown> };
  sections?: Record<string, unknown>[];
  recommendations?: Record<string, unknown>[];
  media?:Record<string,{url?:unknown;mimeType?:unknown}>;
}>;
export const guidebookPublicRenderer: ArtifactRenderer<
  GuidebookArtifactPayload,
  PublicGuidebookView
> = {
  artifactType: "guidebook",
  rendererVersion: "guidebook-web-renderer.v1",
  render(artifact) {
    const payload = artifact.payload,
      values = payload.propertyProjection?.resolvedValues ?? {},
      property = payload.property ?? {},
      brand = payload.brand ?? {},
      cover = sanitizePublicUrl(brand.coverImageUrl ?? property.featuredImage, {
        allowRelative: true,
      }),
      logo = sanitizePublicUrl(brand.logoUrl, { allowRelative: true });
    return deepFreeze({
      title: sanitizePublicText(payload.title ?? "Guest Guide", 200),
      description: sanitizePublicText(
        payload.description ?? "Everything you need for your stay.",
        2000,
      ),
      propertyName: sanitizePublicText(
        values.propertyName ?? property.name ?? payload.title ?? "Your stay",
        200,
      ),
      ...(cover ? { coverImage: cover } : {}),
      ...(sanitizePublicText(values.hostContact, 100)
        ? { hostContact: sanitizePublicText(values.hostContact, 100) }
        : {}),
      ...(sanitizePublicText(values.checkInTime ?? property.checkInTime, 50)
        ? {
            checkInTime: sanitizePublicText(
              values.checkInTime ?? property.checkInTime,
              50,
            ),
          }
        : {}),
      ...(sanitizePublicText(values.checkoutTime ?? property.checkoutTime, 50)
        ? {
            checkoutTime: sanitizePublicText(
              values.checkoutTime ?? property.checkoutTime,
              50,
            ),
          }
        : {}),
      theme: {
        primaryColor: color(String(brand.primaryColor ?? "#1d1a17"), "#1d1a17"),
        accentColor: color(String(brand.accentColor ?? "#d7b77d"), "#d7b77d"),
        ...(logo ? { logoUrl: logo } : {}),
      },
      sections: Object.freeze(
        (payload.sections ?? [])
          .filter((section) => section.visible !== false)
          .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
          .map((section) => ({
            id: String(section.id ?? section.section_key),
            key: slug(
              String(section.section_key ?? section.key ?? section.title),
            ),
            title: sanitizePublicText(section.title ?? "Guide", 200),
            blocks: Object.freeze(
              (
                (section.guidebook_blocks as Record<string, unknown>[]) ??
                (section.blocks as Record<string, unknown>[]) ??
                []
              )
                .filter((block) => block.visible !== false)
                .sort(
                  (a, b) => Number(a.position ?? 0) - Number(b.position ?? 0),
                )
                .map((block) => mapBlock(block,payload.media??{})),
            ),
          })),
      ),
      recommendations: Object.freeze(
        (payload.recommendations ?? []).map((item) => ({
          id: String(item.id),
          category: sanitizePublicText(item.category ?? "Local favorite", 100),
          title: sanitizePublicText(item.title, 200),
          description: sanitizePublicText(item.description, 2000),
          ...(sanitizePublicUrl(item.website)
            ? { website: sanitizePublicUrl(item.website)! }
            : {}),
          ...(sanitizePublicUrl(item.map_url ?? item.mapUrl)
            ? { mapUrl: sanitizePublicUrl(item.map_url ?? item.mapUrl)! }
            : {}),
        })),
      ),
      meta: {
        guidebookVersion: artifact.version,
        publishedAt: artifact.publishedAt,
        artifactVersion: artifact.artifactVersion,
        rendererVersion: artifact.rendererVersion,
      },
    });
  },
};
function mapBlock(block: Record<string, unknown>,media:Record<string,{url?:unknown;mimeType?:unknown}>): PublicGuidebookBlock {
  const content = (block.content as Record<string, unknown>) ?? {},
    raw = String(block.block_type ?? block.type ?? ""),
    text = sanitizePublicText(content.markdown ?? content.text),
    id = String(block.id),
    url = sanitizePublicUrl(content.url ?? content.mapUrl, {
      allowContact: true,
      allowRelative: true,
    });
  if (raw === "heading") return { id, type: "heading", text };
  if (raw === "rich-text") return { id, type: "paragraph", text };
  if (raw === "callout") return { id, type: "callout", text };
  if (raw === "checklist")
    return {
      id,
      type: "checklist",
      items: (Array.isArray(content.items) ? content.items : text.split("\n"))
        .map((item) =>
          sanitizePublicText(
            typeof item === "object"
              ? (item as Record<string, unknown>).text
              : item,
            500,
          ),
        )
        .filter(Boolean),
    };
  if (raw === "instruction")
    return {
      id,
      type: "instruction",
      text,
      items: Array.isArray(content.steps)
        ? content.steps
            .map((item) =>
              sanitizePublicText(
                typeof item === "object"
                  ? (item as Record<string, unknown>).text
                  : item,
                1000,
              ),
            )
            .filter(Boolean)
        : undefined,
    };
  if (raw === "contact")
    return {
      id,
      type: "contact",
      name: sanitizePublicText(content.name ?? "Host", 200),
      role: sanitizePublicText(content.role, 200),
      phone:
        sanitizePublicUrl(
          content.phone
            ? `tel:${String(content.phone).replace(/[^\d+]/g, "")}`
            : "",
          { allowContact: true },
        )?.replace(/^tel:/, "") ?? "",
    };
  if (raw === "image"){
    const reference=String(content.mediaRef??""),asset=media[reference],mediaUrl=asset&&["image/jpeg","image/png","image/webp","image/avif"].includes(String(asset.mimeType))?sanitizePublicUrl(asset.url):null;
    return {
      id,
      type: "image",
      ...(mediaUrl ? { url:mediaUrl } : {}),
      alt: sanitizePublicText(content.alt, 500),
      caption: sanitizePublicText(content.caption, 1000),
    };
  }
  if (raw === "location")
    return { id, type: "location", text, ...(url ? { url } : {}) };
  if (raw === "link")
    return {
      id,
      type: "link",
      label: sanitizePublicText(content.label ?? text, 300),
      ...(url ? { url } : {}),
    };
  return { id, type: "unknown" };
}
function color(value: string, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}
function slug(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "guide"
  );
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
