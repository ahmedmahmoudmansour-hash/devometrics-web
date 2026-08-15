import { getTranslations } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AudiencePicker from "@/components/AudiencePicker";
import DecisionsSection from "@/components/DecisionsSection";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import SkillRadar from "@/components/SkillRadar";
import Methodology from "@/components/Methodology";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";
import PlatformChatWidget from "@/components/PlatformChatWidget";
import SectionTabs from "@/components/SectionTabs";
import { detectVisitorCountry } from "@/lib/billing/detectCountry";
import { tierForCountry } from "@/lib/billing/pricingTiers";

// Reading the visitor's country makes this page render dynamically instead
// of statically — an accepted tradeoff, same as the org-branding layout
// override elsewhere in this app: region-accurate pricing genuinely needs a
// per-request read, there's no way to precompute it at build time.
export default async function Home() {
  const country = await detectVisitorCountry();
  const region = tierForCountry(country);
  const t = await getTranslations("common");

  // Tabbed instead of one long scroll (tester feedback: "super long and
  // unorganized") — Hero stays outside the tabs since it's the first
  // impression, not something to hide behind a click. Order mirrors the
  // previous scroll order exactly, so nothing's reprioritized, just
  // reachable directly instead of scrolled past.
  const tabs = [
    { key: "how-it-works", label: t("howItWorks"), content: <HowItWorks /> },
    { key: "live-demo", label: t("liveDemo"), content: <SkillRadar /> },
    { key: "decisions", label: t("decisions"), content: <DecisionsSection namespace="individualDecisions" id="decisions" /> },
    { key: "methodology", label: t("methodology"), content: <Methodology /> },
    { key: "features", label: t("features"), content: <Features /> },
    { key: "pricing", label: t("pricing"), content: <Pricing initialRegion={region} /> },
  ];

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <AudiencePicker />
        <SectionTabs tabs={tabs} />
      </main>
      <Footer />
      <PlatformChatWidget />
    </>
  );
}
