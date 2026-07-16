import {
  HpmFaqSection,
} from "./hpm-faq-section";

import {
  HpmFinalCta,
} from "./hpm-final-cta";

import {
  HpmFooter,
} from "./hpm-footer";

import {
  HpmFounderSection,
} from "./hpm-founder-section";

import {
  HpmHero,
} from "./hpm-hero";

import {
  HpmIndustrySection,
} from "./hpm-industry-section";

import {
  HpmPartnersSection,
} from "./hpm-partners-section";

import {
  HpmPlatformSection,
} from "./hpm-platform-section";

import {
  HpmProblemSection,
} from "./hpm-problem-section";

import {
  HpmVisionSection,
} from "./hpm-vision-section";

export function HpmPage() {
  return (
    <main className="bg-[#f3eee5]">
      <HpmHero />
      <HpmIndustrySection />
      <HpmProblemSection />
      <HpmPlatformSection />
      <HpmVisionSection />
      <HpmPartnersSection />
      <HpmFounderSection />
      <HpmFaqSection />
      <HpmFinalCta />
      <HpmFooter />
    </main>
  );
}
