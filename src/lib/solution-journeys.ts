export const solutionLinks = [
  ["Improve Guest Experience", "/solutions/guest-experience"],
  ["Invest Better", "/solutions/investment"],
  ["Launch a Property", "/solutions/property-launch"],
  ["Operate Better", "/solutions/operations"],
] as const;

export const solutionJourneys = {
  "guest-experience": {
    eyebrow: "Improve Guest Experience",
    title: "Create stays guests love and reviews you’re proud of.",
    description:
      "Elevate every moment of the guest journey with professional guidebooks, thoughtful communication, and hospitality standards that drive satisfaction and repeat bookings.",
    journey: "guidebook-studio",
    packageLabel: "Explore Guidebook Packages",
    outcomes: [
      "Higher guest satisfaction",
      "Fewer repetitive questions",
      "Stronger reviews and referrals",
      "More direct bookings",
    ],
    nextTitle: "Find the right package for your property.",
  },
  investment: {
    eyebrow: "Invest Better",
    title:
      "Make confident investment decisions with data, insights, and expertise.",
    description:
      "Underwrite smarter. Understand risk. See the realistic returns so you can invest with clarity and confidence.",
    journey: "investment-intelligence",
    packageLabel: "Explore Investment Packages",
    outcomes: [
      "Clear financial projections",
      "Understand material risks",
      "Stronger offers and negotiations",
      "Better long-term performance",
    ],
    nextTitle: "Choose your analysis and invest with clarity.",
  },
  "property-launch": {
    eyebrow: "Launch a Property",
    title:
      "Launch beautiful, profitable properties faster and with less stress.",
    description:
      "From furnishing and guidebooks to operations, we coordinate every detail so you can go live with confidence.",
    journey: "furnishing-studio",
    packageLabel: "Explore Launch Packages",
    outcomes: [
      "A guest-ready property",
      "Better conversion from views to bookings",
      "Smarter pricing strategies",
      "More revenue per available night",
    ],
    nextTitle: "See what you’re leaving on the table.",
  },
  operations: {
    eyebrow: "Operate Better",
    title: "Run operations smarter with one system connecting every decision.",
    description:
      "From daily tasks to portfolio performance, our platform helps you see, decide, act, and improve—every day.",
    journey: "hpm",
    packageLabel: "Explore Platform Plans",
    outcomes: [
      "Unified view across properties",
      "Fewer missed tasks",
      "Better team accountability",
      "Continuous improvement",
    ],
    nextTitle: "Choose the plan that fits your business.",
  },
} as const;
export type SolutionSlug = keyof typeof solutionJourneys;
