import { designSystemTokens } from "@/design-system/tokens";

export const componentTokens = Object.freeze({
  spacing: Object.freeze({ xs: designSystemTokens.spacing[2], sm: designSystemTokens.spacing[4], md: designSystemTokens.spacing[6], lg: designSystemTokens.spacing[8], xl: designSystemTokens.spacing[12], xxl: designSystemTokens.spacing[16] }),
  radius: Object.freeze({ control: designSystemTokens.radius.control, card: designSystemTokens.radius.card, overview: designSystemTokens.radius.panel, pill: designSystemTokens.radius.pill }),
  shadow: Object.freeze({ none: designSystemTokens.elevation.none, card: designSystemTokens.elevation.raised, raised: designSystemTokens.elevation.overlay }),
  color: Object.freeze({ canvas: designSystemTokens.color.light.surfaceCanvas, surface: designSystemTokens.color.light.surfaceRaised, foreground: designSystemTokens.color.light.textPrimary, muted: designSystemTokens.color.light.textSecondary, accent: designSystemTokens.color.light.textLink, focus: designSystemTokens.color.light.borderFocus, success: designSystemTokens.color.light.statusPositive.icon, attention: designSystemTokens.color.light.statusAttention.icon, danger: designSystemTokens.color.light.statusCritical.icon }),
  typography: Object.freeze({ display: designSystemTokens.typography.display, h1: designSystemTokens.typography.pageTitle, h2: designSystemTokens.typography.sectionTitle, h3: designSystemTokens.typography.panelTitle, body: designSystemTokens.typography.body, caption: designSystemTokens.typography.caption, metadata: `${designSystemTokens.typography.metadata} text-stone-500` }),
  motion: Object.freeze({ fast: designSystemTokens.motion.durationFast, standard: designSystemTokens.motion.durationStandard, slow: designSystemTokens.motion.durationSlow, easing: designSystemTokens.motion.easingStandard }),
  touchTarget: designSystemTokens.sizing.touchTarget,
});

export type ComponentDensity = "comfortable" | "standard" | "compact";
export type ComponentStatus = "neutral" | "success" | "attention" | "danger" | "info";
