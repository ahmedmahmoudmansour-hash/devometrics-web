import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import DecisionsSection from "@/components/DecisionsSection";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import SkillRadar from "@/components/SkillRadar";
import Methodology from "@/components/Methodology";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";
import PlatformChatWidget from "@/components/PlatformChatWidget";
import Reveal from "@/components/Reveal";
import { detectVisitorCountry } from "@/lib/billing/detectCountry";
import { tierForCountry } from "@/lib/billing/pricingTiers";

// Reading the visitor's country makes this page render dynamically instead
// of statically — an accepted tradeoff, same as the org-branding layout
// override elsewhere in this app: region-accurate pricing genuinely needs a
// per-request read, there's no way to precompute it at build time.
export default async function Home() {
  const country = await detectVisitorCountry();
  const region = tierForCountry(country);

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        {/* Orientation before depth (2026-08 UX audit, §2/§6): a first-time
            visitor gets "what is this and how does it work" immediately
            after the hero, before the more detailed/technical sections
            that assume that context. SkillRadar (the live Gap Analysis
            demo) moves up right after it — it's the single strongest proof
            of what the product does, not something to bury three sections
            deep behind Decisions/Methodology. */}
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <SkillRadar />
        </Reveal>
        <Reveal>
          <DecisionsSection namespace="individualDecisions" />
        </Reveal>
        <Reveal>
          <Methodology />
        </Reveal>
        <Reveal>
          <Features />
        </Reveal>
        <Reveal>
          <Pricing initialRegion={region} />
        </Reveal>
      </main>
      <Footer />
      <PlatformChatWidget />
    </>
  );
}
