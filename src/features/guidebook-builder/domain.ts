import type {
  AuthoringBlock,
  GuidebookDraft,
} from "@/features/guidebook-studio";
export type BuilderPreviewMode =
  | "desktop"
  | "tablet"
  | "mobile"
  | "pdf"
  | "guest_portal";
export type BuilderSaveState =
  | "loading"
  | "saving"
  | "saved"
  | "conflict"
  | "offline"
  | "failed";
export type BuilderPanel =
  | "content"
  | "bindings"
  | "media"
  | "actions"
  | "visibility"
  | "layout"
  | "validation";
export type BuilderIssue = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  blocking: boolean;
  sectionId?: string;
  blockId?: string;
};
export const BUILDER_COMPONENTS: ReadonlyArray<{
  key: string;
  name: string;
  category: string;
  description: string;
  sectionHints: string[];
}> = [
  [
    "hero",
    "Hero",
    "foundation",
    "Editorial opening with property media.",
    ["welcome"],
  ],
  [
    "rich_text",
    "Rich Text",
    "foundation",
    "Structured headings, paragraphs, lists, links, and variables.",
    ["all"],
  ],
  [
    "property_summary",
    "Property Summary",
    "arrival",
    "Canonical property and stay facts.",
    ["welcome", "arrival"],
  ],
  [
    "arrival_instructions",
    "Arrival Instructions",
    "arrival",
    "Ordered check-in guidance.",
    ["arrival"],
  ],
  [
    "address_card",
    "Address Card",
    "arrival",
    "Property address and directions.",
    ["arrival", "getting around"],
  ],
  [
    "parking_card",
    "Parking Card",
    "arrival",
    "Parking location and instructions.",
    ["arrival", "parking"],
  ],
  [
    "wifi_card",
    "Wi-Fi Card",
    "stay",
    "Network and password with copy actions.",
    ["wi-fi", "wifi"],
  ],
  ["rule_grid", "Rule Grid", "stay", "Ordered house rules.", ["house rules"]],
  [
    "appliance_card",
    "Appliance Card / List",
    "stay",
    "Appliance guidance.",
    ["appliances"],
  ],
  [
    "faq_accordion",
    "FAQ Accordion",
    "stay",
    "Expandable common questions.",
    ["faq"],
  ],
  [
    "safety_notice",
    "Safety Notice",
    "safety",
    "Important safety guidance.",
    ["safety"],
  ],
  [
    "safety_checklist",
    "Safety Checklist",
    "safety",
    "Ordered safety tasks.",
    ["safety"],
  ],
  [
    "emergency_contact_card",
    "Emergency Contact Card",
    "safety",
    "Critical contact information.",
    ["emergency"],
  ],
  [
    "emergency_resource_card",
    "Emergency Resource Card",
    "safety",
    "Hospital and emergency resources.",
    ["emergency"],
  ],
  [
    "transportation_card",
    "Transportation Card / List",
    "explore",
    "Local transportation options.",
    ["getting around", "transportation"],
  ],
  [
    "recommendation_card",
    "Recommendation Card",
    "explore",
    "A local place with details and image.",
    ["things to do", "where to eat", "going out", "where to buy"],
  ],
  [
    "recommendation_collection",
    "Recommendation Collection",
    "explore",
    "Ordered local recommendations.",
    ["things to do", "where to eat", "going out", "where to buy"],
  ],
  [
    "departure_checklist",
    "Departure Checklist",
    "departure",
    "Ordered checkout tasks.",
    ["before you go", "departure", "checkout"],
  ],
  [
    "review_cta",
    "Review CTA",
    "engagement",
    "Guest review request.",
    ["review"],
  ],
  [
    "social_links",
    "Social Links",
    "engagement",
    "Approved social destinations.",
    ["stay connected"],
  ],
  [
    "thank_you_panel",
    "Thank You Panel",
    "engagement",
    "Closing guest message.",
    ["thank you"],
  ],
  ["image", "Image", "media", "Accessible single image.", ["all"]],
  [
    "gallery",
    "Gallery",
    "media",
    "Accessible property media gallery.",
    ["welcome", "things to do", "where to eat", "going out", "where to buy"],
  ],
].map(([key, name, category, description, sectionHints]) => ({
  key: key as string,
  name: name as string,
  category: category as string,
  description: description as string,
  sectionHints: sectionHints as string[],
}));
export const ESSENTIAL_CONTENT_ITEMS: ReadonlyArray<{
  key: string;
  label: string;
  componentKeys: readonly string[];
}> = [
  {
    key: "arrival",
    label: "Check-in & Check-out",
    componentKeys: ["arrival_instructions", "departure_checklist"],
  },
  { key: "wifi", label: "Wi-Fi & Internet", componentKeys: ["wifi_card"] },
  {
    key: "parking",
    label: "Parking Instructions",
    componentKeys: ["parking_card"],
  },
  { key: "rules", label: "House Rules", componentKeys: ["rule_grid"] },
  {
    key: "emergency",
    label: "Emergency Contact",
    componentKeys: ["emergency_contact_card"],
  },
  { key: "amenities", label: "Amenities", componentKeys: ["appliance_card"] },
];
export function essentialContentGuidance(componentKey: string) {
  return (
    BUILDER_COMPONENTS.find((item) => item.key === componentKey)
      ?.description ?? ""
  );
}
export function compatibleComponents(sectionName: string) {
  const key = sectionName.toLowerCase();
  return BUILDER_COMPONENTS.filter(
    (item) =>
      item.sectionHints.includes("all") ||
      item.sectionHints.some((h) => key.includes(h)),
  );
}
export function guidebookHealth(draft: GuidebookDraft): {
  score: number;
  issues: BuilderIssue[];
  publishable: boolean;
} {
  const issues: BuilderIssue[] = [];
  const visible = draft.sections.filter((s) => s.visible);
  if (!visible.length)
    issues.push({
      code: "sections_required",
      severity: "error",
      message:
        "Guests need at least one visible section before this guidebook can be published.",
      blocking: true,
    });
  const names = visible.map((s) => s.name.toLowerCase());
  for (const [needle, label, reason] of [
    ["wifi", "Wi-Fi", "Guests will not be able to find connection details."],
    [
      "rule",
      "House Rules",
      "Guests may miss important expectations for their stay.",
    ],
    ["depart", "Departure", "Guests need clear checkout guidance."],
  ] as const)
    if (!names.some((n) => n.includes(needle)))
      issues.push({
        code: `missing_${needle}`,
        severity: needle === "wifi" ? "error" : "warning",
        message: `Add ${label}. ${reason}`,
        blocking: needle === "wifi",
      });
  for (const section of visible) {
    if (!section.blocks.length)
      issues.push({
        code: "empty_section",
        severity: "warning",
        message: `Add helpful guest content to ${section.name}, or hide the section until it is ready.`,
        blocking: false,
        sectionId: section.id,
      });
    for (const block of section.blocks)
      if (block.type === "image" && !block.content.alt.trim())
        issues.push({
          code: "image_alt_missing",
          severity: "error",
          message:
            "Describe this image so guests using assistive technology understand its purpose.",
          blocking: true,
          sectionId: section.id,
          blockId: block.id,
        });
  }
  const penalty = issues.reduce(
    (sum, i) =>
      sum + (i.severity === "error" ? 15 : i.severity === "warning" ? 5 : 1),
    0,
  );
  return {
    score: Math.max(0, 100 - penalty),
    issues,
    publishable: !issues.some((i) => i.blocking),
  };
}
export function blockSummary(block: AuthoringBlock) {
  switch (block.type) {
    case "component":
      return (
        block.content.fields.title ||
        block.content.fields.body ||
        block.content.componentKey.replaceAll("_", " ")
      );
    case "heading":
      return block.content.text;
    case "rich-text":
      return block.content.text;
    case "image":
      return block.content.caption || block.content.alt || "Image";
    case "instruction":
      return block.content.title || `${block.content.steps.length} steps`;
    case "contact":
      return block.content.name;
    case "location":
      return block.content.label;
    case "link":
      return block.content.label;
    case "callout":
      return block.content.title || block.content.body;
    case "checklist":
      return block.content.title || `${block.content.items.length} tasks`;
  }
}
export function autosaveDelay(changePending: boolean) {
  return changePending ? 30_000 : null;
}
