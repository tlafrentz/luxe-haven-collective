export type PublicJourney = {
  slug: string;
  title: string;
  eyebrow: string;
  promise: string;
  description: string;
  problem: string;
  capability: string;
  supporting: string[];
  outcomes: string[];
  steps: string[];
  offerCategory: string;
  cta: string;
};

export const publicJourneys: PublicJourney[] = [
  {
    slug: "guest-experience",
    title: "Improve Guest Experience",
    eyebrow: "Delight every guest",
    promise:
      "Create exceptional stays that generate five-star reviews and repeat guests.",
    description:
      "Turn arrival, in-stay, and checkout information into one polished guest experience with guidebooks, communications, and proven hospitality playbooks.",
    problem:
      "Guests should never have to search through messages for the information they need, and operators should not answer the same question repeatedly.",
    capability: "Guidebook Studio",
    supporting: [
      "Guest Communications",
      "Experience Audits",
      "Hospitality Playbooks",
    ],
    outcomes: [
      "Increase guest satisfaction",
      "Reduce repetitive questions",
      "Drive more repeat bookings",
    ],
    steps: [
      "Choose a guidebook package",
      "Create or connect your property",
      "Review and publish",
      "Measure guest engagement",
    ],
    offerCategory: "guidebooks",
    cta: "Explore guest experience packages",
  },
  {
    slug: "investment",
    title: "Invest Better",
    eyebrow: "Decide with confidence",
    promise:
      "Make confident investment decisions with data, insights, and expertise.",
    description:
      "Evaluate an opportunity with transparent assumptions, market evidence, risk analysis, and a durable recommendation.",
    problem:
      "A promising property is not an investment thesis. Decisions need traceable assumptions, comparable evidence, and a clear view of downside risk.",
    capability: "Investment Intelligence",
    supporting: ["Market Analysis", "Underwriting", "Decision Records"],
    outcomes: [
      "Model returns clearly",
      "Understand material risk",
      "Preserve decision evidence",
    ],
    steps: [
      "Choose an analysis",
      "Provide property basics",
      "Review evidence and assumptions",
      "Receive a decision output",
    ],
    offerCategory: "investment",
    cta: "Explore investment packages",
  },
  {
    slug: "property-launch",
    title: "Launch a Property",
    eyebrow: "From empty to guest-ready",
    promise:
      "Launch beautiful, profitable properties faster with an end-to-end plan.",
    description:
      "Coordinate furnishing, content, operations, and launch readiness through one connected activation journey.",
    problem:
      "A property launch fails when design, purchasing, guest content, and operating readiness are managed as disconnected projects.",
    capability: "Launch Program",
    supporting: ["Furnishing Studio", "Guidebook Studio", "Operations Setup"],
    outcomes: [
      "Reuse proven furnishing packages",
      "Coordinate dependencies",
      "Reach guest-ready with confidence",
    ],
    steps: [
      "Select a launch package",
      "Confirm property scope",
      "Activate specialist workspaces",
      "Complete launch readiness",
    ],
    offerCategory: "property-launch",
    cta: "Explore launch packages",
  },
  {
    slug: "revenue",
    title: "Increase Revenue",
    eyebrow: "Find the next opportunity",
    promise:
      "Turn property data into focused actions that improve revenue quality.",
    description:
      "Combine revenue audits, listing optimization, pricing strategy, and ongoing advisory around the decisions that matter most.",
    problem:
      "Lowering rates is not a strategy. Stronger revenue starts with understanding positioning, demand, conversion, and operational constraints.",
    capability: "Revenue Intelligence",
    supporting: ["Revenue Audits", "Listing Optimization", "Advisory"],
    outcomes: [
      "Improve conversion",
      "Protect rate quality",
      "Prioritize measurable actions",
    ],
    steps: [
      "Choose an audit or advisory offer",
      "Connect the required data",
      "Review opportunities",
      "Execute and measure",
    ],
    offerCategory: "revenue",
    cta: "Explore revenue services",
  },
  {
    slug: "operations",
    title: "Operate Better",
    eyebrow: "One operating rhythm",
    promise:
      "Run operations smarter with one platform connecting every decision.",
    description:
      "Move from fragmented tools to a shared system for observing conditions, understanding causes, deciding, executing, and learning.",
    problem:
      "Teams lose time and context when performance signals, recommendations, work, and outcomes live in different systems.",
    capability: "Hospitality Performance Platform",
    supporting: ["Operational Intelligence", "Execute", "Learn"],
    outcomes: [
      "See what needs attention",
      "Connect decisions to work",
      "Measure whether actions worked",
    ],
    steps: [
      "Choose a platform plan",
      "Create your workspace",
      "Connect properties and data",
      "Run the HPM lifecycle",
    ],
    offerCategory: "platform",
    cta: "Compare platform plans",
  },
  {
    slug: "hospitality-performance-management",
    title: "Hospitality Performance Management",
    eyebrow: "The operating system",
    promise:
      "Connect evidence, decisions, execution, and learning in one performance system.",
    description:
      "HPM gives independent hospitality operators the structure to observe, understand, decide, execute, and learn without losing lineage.",
    problem:
      "Dashboards show what happened. Operators also need to understand why, decide what to do, execute the work, and learn from the outcome.",
    capability: "HPM Platform",
    supporting: ["Observe", "Understand", "Decide", "Execute", "Learn"],
    outcomes: [
      "Create a shared operating picture",
      "Preserve evidence and confidence",
      "Build organizational knowledge",
    ],
    steps: [
      "Connect your portfolio",
      "Establish canonical measures",
      "Run the HPM flywheel",
      "Improve future decisions",
    ],
    offerCategory: "platform",
    cta: "Explore the platform",
  },
];

export function findPublicJourney(slug: string) {
  return publicJourneys.find((journey) => journey.slug === slug);
}
