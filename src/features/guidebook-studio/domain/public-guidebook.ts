import type { ArtifactRenderer } from "@/platform/artifact-rendering";
import { MESA_MODERN_TOKENS } from "@/features/template-library";
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
  wifi?: string;
  address?: string;
  emergencyContact?: string;
  theme: Readonly<{
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    headingFontFamily: string;
    bodyFontFamily: string;
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
      ...(sanitizePublicText(values.wifi, 500)
        ? { wifi: sanitizePublicText(values.wifi, 500) }
        : {}),
      ...(sanitizePublicText(values.address, 300)
        ? { address: sanitizePublicText(values.address, 300) }
        : {}),
      ...(sanitizePublicText(values.emergencyContact, 300)
        ? { emergencyContact: sanitizePublicText(values.emergencyContact, 300) }
        : {}),
      theme: {
        ...resolveGuidebookTheme(brand),
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
  if (raw === "heading")
    return { id, type: "heading", text: sanitizePublicText(content.text ?? content.title, 500) };
  if (raw === "rich-text")
    return { id, type: "paragraph", text: sanitizePublicText(content.text ?? content.body ?? content.markdown, 4000) };
  if (raw === "component") {
    const key = String(content.componentKey ?? content.component_key ?? ""),
      fields = content.fields && typeof content.fields === "object"
        ? content.fields as Record<string, unknown>
        : {},
      title = sanitizePublicText(fields.title ?? fields.name ?? fields.label, 500),
      body = sanitizePublicText(fields.body ?? fields.description ?? fields.instructions ?? fields.subtitle ?? fields.alternative, 4000),
      componentText = [title, body].filter(Boolean).join("\n");
    if (["callout", "rule_card", "safety_notice", "critical_action_panel", "thank_you_panel"].includes(key))
      return { id, type: "callout", text: componentText };
    if (["arrival_instructions", "parking_card", "access_instructions", "wifi_card", "appliance_card", "step_list", "timeline"].includes(key))
      return { id, type: "instruction", text: componentText };
    if (["rich_text", "section_header", "amenity_card", "local_guide_category", "newsletter_cta"].includes(key))
      return { id, type: key === "section_header" ? "heading" : "paragraph", text: componentText };
    return { id, type: "paragraph", text: componentText || key.replaceAll("_", " ") };
  }
  if (raw === "callout")
    return {
      id,
      type: "callout",
      text: [sanitizePublicText(content.title, 500), sanitizePublicText(content.body ?? content.text, 4000)].filter(Boolean).join("\n"),
    };
  if (raw === "checklist")
    return {
      id,
      type: "checklist",
      text: sanitizePublicText(content.title, 500),
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
      text: sanitizePublicText(content.title ?? content.text, 1000),
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
    return {
      id,
      type: "location",
      text: [sanitizePublicText(content.label, 500), sanitizePublicText(content.destination ?? content.text, 2000)].filter(Boolean).join("\n"),
      ...(url ? { url } : {}),
    };
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
export type ResolvedGuidebookTheme = Readonly<{
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFontFamily: string;
  bodyFontFamily: string;
}>;
// Maps a stored font *name* (as saved on a template's payload.design.typography,
// e.g. "Cormorant Garamond") to the CSS variable next/font/google actually
// generated for it in src/app/layout.tsx. Satoshi has no Google Fonts entry,
// so it's mapped to Inter (product decision, not a technical substitute).
const FONT_FAMILY_VARS: Readonly<Record<string, string>> = {
  "Playfair Display": "var(--font-serif)",
  "Cormorant Garamond": "var(--font-cormorant-garamond)",
  Merriweather: "var(--font-merriweather)",
  "Source Sans 3": "var(--font-source-sans-3)",
  Montserrat: "var(--font-montserrat)",
  Lato: "var(--font-lato)",
  Inter: "var(--font-inter)",
  Satoshi: "var(--font-inter)",
};
function fontFamilyVar(value: unknown, fallback: string) {
  if (typeof value === "string" && FONT_FAMILY_VARS[value.trim()])
    return FONT_FAMILY_VARS[value.trim()];
  return fallback;
}
export function resolveGuidebookTheme(
  brand: Readonly<{
    primaryColor?: unknown;
    accentColor?: unknown;
    backgroundColor?: unknown;
    textColor?: unknown;
    headingFontFamily?: unknown;
    bodyFontFamily?: unknown;
  }> = {},
): ResolvedGuidebookTheme {
  return {
    primaryColor: color(
      String(brand.primaryColor ?? MESA_MODERN_TOKENS.colors.primary),
      MESA_MODERN_TOKENS.colors.primary,
    ),
    accentColor: color(
      String(brand.accentColor ?? MESA_MODERN_TOKENS.colors.accent),
      MESA_MODERN_TOKENS.colors.accent,
    ),
    backgroundColor: color(
      String(brand.backgroundColor ?? MESA_MODERN_TOKENS.colors.background),
      MESA_MODERN_TOKENS.colors.background,
    ),
    textColor: color(
      String(brand.textColor ?? MESA_MODERN_TOKENS.colors.text),
      MESA_MODERN_TOKENS.colors.text,
    ),
    headingFontFamily: fontFamilyVar(
      brand.headingFontFamily,
      MESA_MODERN_TOKENS.typography.headingFamily,
    ),
    bodyFontFamily: fontFamilyVar(
      brand.bodyFontFamily,
      MESA_MODERN_TOKENS.typography.bodyFamily,
    ),
  };
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
